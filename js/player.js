// Moteur de lecture : file d'attente, aléatoire, répétition, lecture auto, minuteur,
// commandes de l'écran de verrouillage / CarPlay / Android Auto (Media Session).

import { audius, similar } from './api.js';
import { store } from './store.js';
import { toast } from './ui.js';
import { yt, ytEvents, findVideos, cachedVideos } from './yt.js';

const QKEY = 'melo:queue';
let qidSeq = Date.now() % 1e6;
const newQid = () => 'q' + (qidSeq++).toString(36);

export function sourceUrl(t) {
  if (t.src === 'audius') return audius.streamUrl(t.rid);
  return t.url;
}

export class Player extends EventTarget {
  constructor(audio) {
    super();
    this.audio = audio;
    this.queue = [];
    this.index = -1;
    this.shuffle = false;
    this.repeat = 'off';
    this.autoplay = store.settings.autoplay !== false;
    this.from = '';
    this.origOrder = null;
    this.errors = 0;
    this.sleepAt = 0;
    this.sleepEnd = false;
    this.remote = false;
    this.loadingMore = false;
    this.wantPlay = false;
    this.engine = 'audio';   // 'audio' (fichier direct) ou 'yt' (lecteur YouTube officiel)
    this.full = false;       // titre du catalogue Apple joué en entier via YouTube
    this._loadTok = 0;
    this._bind();
    this._bindYt();
    this._restore();
  }

  /* ---------- état ---------- */
  get current() { return this.queue[this.index] || null; }
  get playing() { return this.engine === 'yt' ? yt.playing : !this.audio.paused && !this.audio.ended; }
  get position() { return this.engine === 'yt' ? yt.position : this.audio.currentTime || 0; }
  get duration() {
    const c = this.current;
    if (c?.live) return Infinity;
    const d = this.engine === 'yt' ? yt.duration : this.audio.duration;
    return isFinite(d) && d > 0 ? d : (c?.duration || 0);
  }
  get upNext() { return this.queue.slice(this.index + 1); }
  get past() { return this.queue.slice(0, Math.max(0, this.index)); }

  _emit(type = 'change') { this.dispatchEvent(new Event(type)); if (type === 'change') this._persist(); }

  _wrap(tracks, by) { return tracks.filter(Boolean).map((t) => ({ ...store.slim(t), qid: newQid(), ...(by ? { by } : {}) })); }

  /* ---------- commandes ---------- */
  playList(tracks, start = 0, { from = '', shuffle = false, by } = {}) {
    if (!tracks.length) return;
    let items = this._wrap(tracks, by);
    this.gen = (this.gen || 0) + 1;
    this.origOrder = null;
    this.shuffle = false;
    if (shuffle) {
      const orig = items.map((x) => x.qid);
      const first = items.splice(start > 0 ? start : Math.floor(Math.random() * items.length), 1)[0];
      this._shuffleArr(items);
      items = [first, ...items];
      this.origOrder = orig;
      this.shuffle = true;
      start = 0;
    }
    this.queue = items;
    this.index = Math.max(0, Math.min(start, items.length - 1));
    this.from = from;
    this._load(true);
  }

  playNow(track, opts = {}) {
    if (!this.current) return this.playList([track], 0, opts);
    const [item] = this._wrap([track], opts.by);
    this.queue.splice(this.index + 1, 0, item);
    this.index++;
    this._load(true);
  }

  playNext(tracks, by) {
    const items = this._wrap(Array.isArray(tracks) ? tracks : [tracks], by);
    if (!this.current) { this.queue = items; this.index = 0; this._load(false); this._emit(); return; }
    this.queue.splice(this.index + 1, 0, ...items);
    this._emit();
  }

  addLast(tracks, by) {
    const items = this._wrap(Array.isArray(tracks) ? tracks : [tracks], by);
    if (!this.current) { this.queue = items; this.index = 0; this._load(false); this._emit(); return; }
    // « Lire en dernier » = fin de « À suivre », avant les morceaux de lecture automatique.
    let at = this.queue.findIndex((x, i) => i > this.index && x.auto);
    if (at < 0) at = this.queue.length;
    this.queue.splice(at, 0, ...items);
    this._emit();
  }

  play() {
    if (!this.current) return;
    this.wantPlay = true;
    if (this.engine === 'yt') { yt.play(); return; }
    if (!this.audio.src) return this._load(true);
    const p = this.audio.play();
    if (p) p.catch((e) => { if (e.name === 'NotAllowedError') { this.wantPlay = false; this._emit(); toast('Touchez ▶︎ pour lancer la lecture', 'info'); } });
  }
  pause() { this.wantPlay = false; if (this.engine === 'yt') yt.pause(); else this.audio.pause(); }
  toggle() { this.playing ? this.pause() : this.play(); }

  next(auto = false) {
    if (!this.queue.length) return;
    if (auto && this.sleepEnd) { this.sleepEnd = false; this._emit(); this.pause(); return; }
    if (auto && this.repeat === 'one') { this.seek(0); this.play(); return; }
    if (this.index < this.queue.length - 1) { this.index++; this._load(true); return; }
    if (this.repeat === 'all') { this.index = 0; this._load(true); return; }
    if (this.autoplay) { this._extend(true); return; }
    if (auto) { this.pause(); this.audio.currentTime = 0; this._emit(); }
  }

  prev() {
    if (!this.current) return;
    if (this.position > 3 || this.index === 0) { this.seek(0); this.play(); return; }
    this.index--;
    this._load(true);
  }

  seek(sec) {
    if (!this.current || this.current.live) return;
    const to = Math.max(0, Math.min(sec, (this.duration || 0) - 0.25));
    if (this.engine === 'yt') yt.seek(to);
    else try { this.audio.currentTime = to; } catch { /* pas encore prêt */ }
    this._emit('time');
    this._emit('seeked');
  }

  jump(qid) {
    const i = this.queue.findIndex((x) => x.qid === qid);
    if (i < 0) return;
    this.index = i;
    this._load(true);
  }

  remove(qid) {
    const i = this.queue.findIndex((x) => x.qid === qid);
    if (i < 0) return;
    if (i === this.index) { this.queue.splice(i, 1); if (this.index >= this.queue.length) { this.index = this.queue.length - 1; this.pause(); } this._load(this.playing || this.wantPlay); return; }
    this.queue.splice(i, 1);
    if (i < this.index) this.index--;
    this._emit();
  }

  move(qid, toQid, after = false) {
    const from = this.queue.findIndex((x) => x.qid === qid);
    if (from < 0 || qid === toQid) return;
    const cur = this.current;
    const [item] = this.queue.splice(from, 1);
    let to = this.queue.findIndex((x) => x.qid === toQid);
    if (to < 0) to = this.queue.length - 1; else if (after) to++;
    this.queue.splice(to, 0, item);
    this.index = this.queue.indexOf(cur);
    this._emit();
  }

  clearUpNext() { this.queue.splice(this.index + 1); this._emit(); }
  clearHistory() { const c = this.current; if (!c) return; this.queue = this.queue.slice(this.index); this.index = 0; this._emit(); }

  setShuffle(on) {
    if (on === this.shuffle) return;
    this.shuffle = on;
    const cur = this.current;
    if (on) {
      this.origOrder = this.queue.map((x) => x.qid);
      const rest = this.queue.slice(this.index + 1);
      this._shuffleArr(rest);
      this.queue = [...this.queue.slice(0, this.index + 1), ...rest];
    } else if (this.origOrder) {
      const pos = new Map(this.origOrder.map((q, i) => [q, i]));
      const known = this.queue.filter((x) => pos.has(x.qid)).sort((a, b) => pos.get(a.qid) - pos.get(b.qid));
      const extra = this.queue.filter((x) => !pos.has(x.qid));
      this.queue = [...known, ...extra];
      this.index = Math.max(0, this.queue.indexOf(cur));
      this.origOrder = null;
    }
    this._emit();
  }

  cycleRepeat() { this.setRepeat({ off: 'all', all: 'one', one: 'off' }[this.repeat]); }
  setRepeat(r) { this.repeat = r; this._emit(); }
  setAutoplay(on) { this.autoplay = on; store.setSetting('autoplay', on); this._emit(); if (on && this.index >= this.queue.length - 2) this._extend(false); }
  setVolume(v) { this.audio.volume = Math.max(0, Math.min(1, v)); yt.setVolume(this.audio.volume); this._emit('time'); }

  setSleep(min) {
    clearTimeout(this._sleepT);
    this.sleepAt = 0; this.sleepEnd = false;
    if (min === 'end') this.sleepEnd = true;
    else if (min > 0) {
      this.sleepAt = Date.now() + min * 60e3;
      this._sleepT = setTimeout(() => { this.sleepAt = 0; this.pause(); this._emit(); toast('Minuteur terminé — lecture en pause', 'timer'); }, min * 60e3);
    }
    this._emit();
  }

  startStation(track) {
    this.playList([track], 0, { from: `Station : ${track.title}` });
    if (this.autoplay) this._extend(false); else this.setAutoplay(true);
  }

  /** Exécute une commande reçue d'un passager (session partagée). */
  exec(cmd, a = {}, by) {
    switch (cmd) {
      case 'toggle': return this.toggle();
      case 'play': return this.play();
      case 'pause': return this.pause();
      case 'next': return this.next();
      case 'prev': return this.prev();
      case 'seek': return this.seek(a.t);
      case 'jump': return this.jump(a.qid);
      case 'remove': return this.remove(a.qid);
      case 'move': return this.move(a.qid, a.to, a.after);
      case 'playList': return this.playList(a.tracks || [], a.start || 0, { from: a.from, shuffle: a.shuffle, by });
      case 'playNow': return this.playNow(a.track, { by });
      case 'playNext': return this.playNext(a.tracks || [], by);
      case 'addLast': return this.addLast(a.tracks || [], by);
      case 'shuffle': return this.setShuffle(!!a.on);
      case 'repeat': return this.setRepeat(a.mode);
      case 'cycleRepeat': return this.cycleRepeat();
      case 'autoplay': return this.setAutoplay(!!a.on);
      case 'clearUpNext': return this.clearUpNext();
      case 'station': return this.startStation(a.track);
      case 'volume': return this.setVolume(a.v);
      default: return undefined;
    }
  }

  /** État compact partagé avec les passagers. */
  snapshot() {
    const lo = Math.max(0, this.index - 15);
    return {
      queue: this.queue.slice(lo, this.index + 120),
      index: this.index - lo,
      playing: this.playing || (this.wantPlay && !this.audio.ended),
      pos: this.position,
      dur: isFinite(this.duration) ? this.duration : 0,
      at: Date.now(),
      shuffle: this.shuffle,
      repeat: this.repeat,
      autoplay: this.autoplay,
      from: this.from,
      vol: this.audio.volume,
      full: this.full,
    };
  }

  /* ---------- interne ---------- */
  _shuffleArr(a) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }

  async _extend(thenPlay) {
    if (this.loadingMore) { if (thenPlay) this._playAfterExtend = true; return; }
    this.loadingMore = true;
    this._playAfterExtend = !!thenPlay;
    const gen = this.gen;
    try {
      const seed = this.current || this.queue[this.queue.length - 1];
      const exclude = new Set(this.queue.map((x) => x.id));
      const more = await similar(seed, exclude);
      if (gen !== this.gen) return; // une autre sélection a été lancée entre-temps
      const play = this._playAfterExtend && this.index >= this.queue.length - 1;
      if (more.length) {
        const items = this._wrap(more).map((x) => ({ ...x, auto: true }));
        this.queue.push(...items);
        if (play) { this.index++; this._load(true); } else this._emit();
      } else if (play) this.pause();
    } finally { this.loadingMore = false; this._playAfterExtend = false; }
  }

  _load(autoplay) {
    const t = this.current;
    const tok = ++this._loadTok;
    if (!t) { this._stopYt(); this.audio.removeAttribute('src'); this.audio.load(); this._emit(); this._media(); return; }
    this.wantPlay = autoplay;
    store.pushHistory(t);
    if (t.src === 'apple') {
      // Catalogue Apple : on cherche le titre officiel complet sur YouTube.
      const known = cachedVideos(t);
      if (known) this._playYt(known, autoplay, t);
      else {
        this.full = false;
        this.audio.pause();
        if (this.engine === 'yt') yt.pause();
        this._emit();
        findVideos(t).then((ids) => {
          if (tok !== this._loadTok) return;
          if (ids) this._playYt(ids, this.wantPlay, t);
          else this._playAudio(t, this.wantPlay);
        });
      }
    } else this._playAudio(t, autoplay);
    this._emit();
    this._media();
    this._prefetch();
    if (this.autoplay && this.index >= this.queue.length - 2 && !t.live) this._extend(false);
  }

  _playAudio(t, autoplay) {
    this._stopYt();
    this.full = false;
    this.audio.src = sourceUrl(t);
    this.audio.load();
    if (autoplay) {
      const p = this.audio.play();
      if (p) p.catch((e) => { if (e.name === 'NotAllowedError') { this.wantPlay = false; this._emit(); } });
    }
    this._emit();
  }

  _playYt(ids, autoplay, t) {
    this.audio.pause();
    this.audio.removeAttribute('src');
    this.audio.load();
    this.engine = 'yt';
    this.full = true;
    yt.load(ids, autoplay, t);
    this._emit();
  }

  _stopYt() {
    if (this.engine === 'yt') yt.stop();
    this.engine = 'audio';
  }

  // Cherche à l'avance le clip du titre suivant pour enchaîner sans attente.
  _prefetch() {
    const n = this.queue[this.index + 1];
    if (n && n.src === 'apple' && !cachedVideos(n)) setTimeout(() => findVideos(n), 4000);
  }

  _bindYt() {
    ytEvents.addEventListener('playing', () => { if (this.engine === 'yt') { this.errors = 0; this._emit(); this._mediaState(); } });
    ytEvents.addEventListener('pause', () => { if (this.engine === 'yt') { this._emit(); this._mediaState(); } });
    ytEvents.addEventListener('waiting', () => { if (this.engine === 'yt') this._emit('time'); });
    ytEvents.addEventListener('time', () => { if (this.engine === 'yt') this._emit('time'); });
    ytEvents.addEventListener('ended', () => { if (this.engine === 'yt') this.next(true); });
    ytEvents.addEventListener('fail', () => { if (this.engine === 'yt' && this.current) this._playAudio(this.current, this.wantPlay); });
    ytEvents.addEventListener('quota', () => toast('Limite YouTube du jour atteinte : extraits jusqu’à demain', 'info'));
  }

  _bind() {
    const a = this.audio;
    a.addEventListener('ended', () => this.next(true));
    a.addEventListener('playing', () => { this.errors = 0; this._emit(); this._mediaState(); });
    a.addEventListener('pause', () => { this._emit(); this._mediaState(); });
    a.addEventListener('waiting', () => this._emit('time'));
    a.addEventListener('loadedmetadata', () => { this._emit('time'); this._mediaPos(); });
    let last = 0;
    a.addEventListener('timeupdate', () => {
      this._emit('time');
      const now = Date.now();
      if (now - last > 4000) { last = now; this._persistPos(); this._mediaPos(); }
    });
    a.addEventListener('error', () => {
      if (!this.current || !a.src || this.engine === 'yt') return;
      this.errors++;
      if (this.errors > 4) { toast('Plusieurs morceaux illisibles — vérifiez la connexion', 'info'); this.pause(); this.errors = 0; return; }
      toast(`« ${this.current.title} » est indisponible`, 'info');
      setTimeout(() => this.next(), 700);
    });

    // Écran de verrouillage, CarPlay, Android Auto, casques Bluetooth, volant.
    const ms = navigator.mediaSession;
    if (ms) {
      const set = (k, f) => { try { ms.setActionHandler(k, f); } catch { /* non pris en charge */ } };
      set('play', () => this.play());
      set('pause', () => this.pause());
      set('stop', () => this.pause());
      set('previoustrack', () => this.prev());
      set('nexttrack', () => this.next());
      set('seekto', (d) => this.seek(d.seekTime));
      // Pas de seekbackward/seekforward : sur iOS ils remplacent les boutons précédent/suivant
      // (écran verrouillé, CarPlay, commandes au volant).
    }
  }

  _media() {
    const ms = navigator.mediaSession;
    const t = this.current;
    if (!ms || !t) return;
    try {
      const art = [t.art, t.artLg].filter(Boolean);
      ms.metadata = new MediaMetadata({
        title: t.title,
        artist: t.artist,
        album: t.album || this.from || (t.live ? 'Radio en direct' : 'Mélo'),
        artwork: art.length ? [{ src: art[0], sizes: '480x480', type: 'image/jpeg' }, ...(art[1] ? [{ src: art[1], sizes: '1000x1000', type: 'image/jpeg' }] : [])] : [{ src: new URL('icons/icon-512.png', location.href).href, sizes: '512x512', type: 'image/png' }],
      });
    } catch { /* ignore */ }
  }
  _mediaState() { if (navigator.mediaSession) navigator.mediaSession.playbackState = this.playing ? 'playing' : 'paused'; }
  _mediaPos() {
    const ms = navigator.mediaSession;
    if (!ms || !ms.setPositionState || this.current?.live) return;
    const d = this.duration;
    if (!isFinite(d) || d <= 0) return;
    try { ms.setPositionState({ duration: d, position: Math.min(this.position, d), playbackRate: 1 }); } catch { /* ignore */ }
  }

  _persist() {
    if (this.remote) return;
    clearTimeout(this._pT);
    this._pT = setTimeout(() => {
      try {
        const lo = Math.max(0, this.index - 30);
        localStorage.setItem(QKEY, JSON.stringify({ queue: this.queue.slice(lo, lo + 300), index: this.index - lo, shuffle: this.shuffle, repeat: this.repeat, from: this.from, pos: this.position }));
      } catch { /* ignore */ }
    }, 400);
  }
  _persistPos() {
    try { const s = JSON.parse(localStorage.getItem(QKEY) || 'null'); if (s) { s.pos = this.position; localStorage.setItem(QKEY, JSON.stringify(s)); } } catch { /* ignore */ }
  }
  _restore() {
    try {
      const s = JSON.parse(localStorage.getItem(QKEY) || 'null');
      if (!s || !s.queue?.length) return;
      this.queue = s.queue;
      this.index = Math.min(s.index, s.queue.length - 1);
      this.shuffle = !!s.shuffle; this.repeat = s.repeat || 'off'; this.from = s.from || '';
      const t = this.current;
      if (t) {
        if (t.src !== 'apple') this.audio.src = sourceUrl(t);
        this.audio.preload = 'metadata';
        if (s.pos && !t.live) this.audio.addEventListener('loadedmetadata', () => { try { this.audio.currentTime = s.pos; } catch { /* */ } }, { once: true });
        this._media();
      }
    } catch { /* ignore */ }
  }
}
