// Session partagée (façon SharePlay en voiture / Spotify Jam).
// Le téléphone qui joue la musique est l'« hôte » ; les passagers scannent un QR code
// et pilotent tout depuis leur propre téléphone (iPhone, Android, ordinateur…).
// Transport : MQTT sur WebSocket sécurisé via des brokers publics gratuits — aucun serveur à nous.

import { toast } from './ui.js';

export const BROKERS = [
  'wss://broker.emqx.io:8084/mqtt',
  'wss://broker.hivemq.com:8884/mqtt',
  'wss://test.mosquitto.org:8081/mqtt',
];
const ROOT = 'melo/v1';
const ALPHA = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const JKEY = 'melo:jam';

export const newCode = () => Array.from({ length: 5 }, () => ALPHA[Math.floor(Math.random() * ALPHA.length)]).join('');
export const myId = (() => {
  let id = null;
  try { id = localStorage.getItem('melo:id'); } catch { /* */ }
  if (!id) { id = 'u' + Math.random().toString(36).slice(2, 10); try { localStorage.setItem('melo:id', id); } catch { /* */ } }
  return id;
})();

export function joinUrl(code, b) {
  const u = new URL(location.href);
  u.hash = '';
  u.search = `?jam=${code}${b ? `&b=${b}` : ''}`;
  return u.href;
}

function waitMqtt() {
  return new Promise((res, rej) => {
    if (window.mqtt) return res(window.mqtt);
    let n = 0;
    const t = setInterval(() => {
      if (window.mqtt) { clearInterval(t); res(window.mqtt); }
      else if (++n > 50) { clearInterval(t); rej(new Error('Bibliothèque MQTT indisponible')); }
    }, 100);
  });
}

function connect(url, opts = {}) {
  return waitMqtt().then((mqtt) => new Promise((res, rej) => {
    const c = mqtt.connect(url, { clientId: 'melo_' + Math.random().toString(36).slice(2, 12), clean: true, connectTimeout: 7000, reconnectPeriod: 2500, keepalive: 25, ...opts });
    const fail = setTimeout(() => { c.end(true); rej(new Error('timeout')); }, 8000);
    c.once('connect', () => { clearTimeout(fail); res(c); });
    c.once('error', (e) => { clearTimeout(fail); c.end(true); rej(e); });
  }));
}

async function connectAny(start = 0, opts) {
  let err;
  for (let k = 0; k < BROKERS.length; k++) {
    const i = (start + k) % BROKERS.length;
    try { return { client: await connect(BROKERS[i], opts), b: i }; } catch (e) { err = e; }
  }
  throw err || new Error('Aucun serveur de session joignable');
}

const enc = (o) => JSON.stringify(o);
const dec = (m) => { try { const s = m.toString(); return s ? JSON.parse(s) : null; } catch { return null; } };

/* ======================================================================
   Hôte : publie l'état du lecteur, exécute les commandes des passagers.
   ====================================================================== */
export class JamHost extends EventTarget {
  constructor(player, name) {
    super();
    this.player = player;
    this.name = name || 'Hôte';
    this.code = null;
    this.b = 0;
    this.client = null;
    this.people = new Map();
    this.active = false;
    this.status = 'idle';
    this._onChange = () => this._schedule();
  }

  static saved() {
    try { const s = JSON.parse(localStorage.getItem(JKEY) || 'null'); if (s && Date.now() - s.t < 8 * 3600e3) return s; } catch { /* */ }
    return null;
  }

  get url() { return this.code ? joinUrl(this.code, this.b) : ''; }

  async start(code = newCode(), b = 0) {
    this.code = code;
    this.status = 'connecting';
    this._emit();
    const { client, b: used } = await connectAny(b);
    this.b = used;
    this.client = client;
    this.base = `${ROOT}/${this.code}`;
    client.subscribe([`${this.base}/cmd`, `${this.base}/hi`], { qos: 1 });
    client.on('message', (topic, msg) => this._msg(topic, dec(msg)));
    client.on('reconnect', () => { this.status = 'reconnecting'; this._emit(); });
    client.on('connect', () => { this.status = 'live'; this._emit(); this._publish(); });
    client.on('offline', () => { this.status = 'reconnecting'; this._emit(); });
    this.active = true;
    this.status = 'live';
    this.player.addEventListener('change', this._onChange);
    this._tick = setInterval(() => {
      const now = Date.now();
      let changed = false;
      for (const [id, p] of this.people) if (now - p.last > 70e3) { this.people.delete(id); changed = true; }
      if (changed) this._emit();
      if (this.player.playing || changed) this._publish();
    }, 5000);
    try { localStorage.setItem(JKEY, enc({ code: this.code, b: this.b, t: Date.now() })); } catch { /* */ }
    this._publish();
    this._emit();
    return this.code;
  }

  stop() {
    if (!this.client) return;
    this.player.removeEventListener('change', this._onChange);
    clearInterval(this._tick);
    const c = this.client;
    c.publish(`${this.base}/state`, enc({ ended: true, at: Date.now() }), { qos: 1, retain: true }, () => {
      setTimeout(() => { c.publish(`${this.base}/state`, '', { qos: 1, retain: true }); setTimeout(() => c.end(), 500); }, 1500);
    });
    this.client = null;
    this.active = false;
    this.status = 'idle';
    this.people.clear();
    try { localStorage.removeItem(JKEY); } catch { /* */ }
    this._emit();
  }

  _emit() { this.dispatchEvent(new Event('change')); }

  _schedule() {
    if (this._pending) return;
    this._pending = setTimeout(() => { this._pending = null; this._publish(); }, 120);
  }

  _publish() {
    if (!this.client || !this.client.connected) return;
    const s = this.player.snapshot();
    s.host = { id: myId, name: this.name };
    s.people = [...this.people.values()].map(({ id, name }) => ({ id, name }));
    this.client.publish(`${this.base}/state`, enc(s), { qos: 0, retain: true });
  }

  _msg(topic, m) {
    if (!m) return;
    if (topic.endsWith('/hi')) {
      if (m.id === myId) return;
      const known = this.people.has(m.id);
      if (m.bye) {
        if (known) { const p = this.people.get(m.id); this.people.delete(m.id); toast(`${p.name} a quitté la session`, 'people'); this._emit(); this._publish(); }
        return;
      }
      this.people.set(m.id, { id: m.id, name: (m.name || 'Passager').slice(0, 24), last: Date.now() });
      if (!known) { toast(`${m.name || 'Un passager'} a rejoint la session`, 'people'); this._emit(); }
      this._publish();
      return;
    }
    if (topic.endsWith('/cmd')) {
      if (m.id === myId) return;
      const who = { id: m.id, name: (m.name || 'Passager').slice(0, 24) };
      if (!this.people.has(m.id)) { this.people.set(m.id, { ...who, last: Date.now() }); this._emit(); }
      else this.people.get(m.id).last = Date.now();
      const a = m.a || {};
      const label = { playNow: () => `${who.name} a lancé « ${a.track?.title} »`, playNext: () => `${who.name} a ajouté ${a.tracks?.length > 1 ? `${a.tracks.length} morceaux` : `« ${a.tracks?.[0]?.title} »`} à suivre`, addLast: () => `${who.name} a ajouté ${a.tracks?.length > 1 ? `${a.tracks.length} morceaux` : `« ${a.tracks?.[0]?.title} »`}`, playList: () => `${who.name} a lancé ${a.from || 'une sélection'}`, station: () => `${who.name} a lancé une station` }[m.cmd];
      if (label) toast(label(), 'people');
      this.player.exec(m.cmd, a, who);
      this._schedule();
    }
  }
}

/* ======================================================================
   Passager : miroir du lecteur de l'hôte, même interface que Player.
   ====================================================================== */
export class RemotePlayer extends EventTarget {
  constructor(code, b, name) {
    super();
    this.remote = true;
    this.code = code;
    this.b = +b || 0;
    this.name = name;
    this.s = { queue: [], index: -1, playing: false, pos: 0, dur: 0, shuffle: false, repeat: 'off', autoplay: true, from: '', people: [], host: null };
    this.recvAt = Date.now();
    this.status = 'connecting';
    this.ended = false;
    this.sleepAt = 0; this.sleepEnd = false;
  }

  async connect() {
    this.base = `${ROOT}/${this.code}`;
    const will = { topic: `${this.base}/hi`, payload: enc({ id: myId, bye: true }), qos: 1, retain: false };
    const { client, b } = await connectAny(this.b, { will });
    this.client = client;
    this.b = b;
    client.subscribe(`${this.base}/state`, { qos: 0 });
    client.on('message', (_t, msg) => this._state(dec(msg)));
    client.on('reconnect', () => { this.status = 'reconnecting'; this._emit('status'); });
    client.on('connect', () => { this.status = this.gotState ? 'live' : 'waiting'; this._hello(); this._emit('status'); });
    client.on('offline', () => { this.status = 'reconnecting'; this._emit('status'); });
    this.status = 'waiting';
    this._hello();
    this._hi = setInterval(() => this._hello(), 20e3);
    this._ti = setInterval(() => { if (this.s.playing) this._emit('time'); }, 500);
    this._emit('status');
  }

  leave() {
    clearInterval(this._hi); clearInterval(this._ti);
    if (this.client) {
      const c = this.client;
      c.publish(`${this.base}/hi`, enc({ id: myId, name: this.name, bye: true }), { qos: 1 }, () => c.end());
      this.client = null;
    }
  }

  setName(n) { this.name = n; this._hello(); }

  _hello() { if (this.client?.connected) this.client.publish(`${this.base}/hi`, enc({ id: myId, name: this.name }), { qos: 1 }); }

  _state(m) {
    if (m === null) return;
    if (m.ended) { this.ended = true; this.status = 'ended'; this._emit('status'); return; }
    if (!m.queue) return;
    this.gotState = true;
    if (this.status !== 'live') { this.status = 'live'; this._emit('status'); }
    // Le message retenu peut dater : on garde l'âge annoncé par l'hôte si plausible.
    this.s = m;
    this.recvAt = Date.now();
    this._emit('change');
    this._emit('time');
  }

  _emit(t) { this.dispatchEvent(new Event(t)); }

  send(cmd, a = {}) {
    if (!this.client?.connected) { toast('Connexion à la session…', 'info'); return; }
    this.client.publish(`${this.base}/cmd`, enc({ id: myId, name: this.name, cmd, a, n: Math.random() }), { qos: 1 });
  }

  /* --- même interface que Player --- */
  get queue() { return this.s.queue || []; }
  get index() { return this.s.index; }
  get current() { return this.queue[this.index] || null; }
  get playing() { return !!this.s.playing; }
  get position() {
    const p = (this.s.pos || 0) + (this.s.playing ? (Date.now() - this.recvAt) / 1000 : 0);
    return this.s.dur ? Math.min(p, this.s.dur) : p;
  }
  get duration() { return this.current?.live ? Infinity : (this.s.dur || this.current?.duration || 0); }
  get upNext() { return this.queue.slice(this.index + 1); }
  get past() { return this.queue.slice(0, Math.max(0, this.index)); }
  get shuffle() { return this.s.shuffle; }
  get repeat() { return this.s.repeat; }
  get autoplay() { return this.s.autoplay; }
  get from() { return this.s.from; }
  get people() { return this.s.people || []; }
  get host() { return this.s.host; }
  get volume() { return this.s.vol ?? 1; }

  _optimistic(fn) { fn(this.s); this.recvAt = Date.now(); this._emit('change'); this._emit('time'); }

  slim(t) { const { qid, by, ...rest } = t; return rest; }

  playList(tracks, start = 0, { from = '', shuffle = false } = {}) { this.send('playList', { tracks: tracks.slice(0, 150).map((t) => this.slim(t)), start, from, shuffle }); }
  playNow(track) { this.send('playNow', { track: this.slim(track) }); }
  playNext(tracks) { this.send('playNext', { tracks: (Array.isArray(tracks) ? tracks : [tracks]).map((t) => this.slim(t)) }); }
  addLast(tracks) { this.send('addLast', { tracks: (Array.isArray(tracks) ? tracks : [tracks]).map((t) => this.slim(t)) }); }
  play() { this._optimistic((s) => { s.pos = this.position; s.playing = true; }); this.send('play'); }
  pause() { this._optimistic((s) => { s.pos = this.position; s.playing = false; }); this.send('pause'); }
  toggle() { this.playing ? this.pause() : this.play(); }
  next() { this.send('next'); }
  prev() { this.send('prev'); }
  seek(t) { this._optimistic((s) => { s.pos = t; }); this.send('seek', { t }); }
  jump(qid) { this.send('jump', { qid }); }
  remove(qid) { this._optimistic((s) => { const i = s.queue.findIndex((x) => x.qid === qid); if (i > s.index) s.queue.splice(i, 1); }); this.send('remove', { qid }); }
  move(qid, to, after) { this.send('move', { qid, to, after }); }
  clearUpNext() { this._optimistic((s) => { s.queue.splice(s.index + 1); }); this.send('clearUpNext'); }
  clearHistory() { /* l'historique reste chez l'hôte */ }
  setShuffle(on) { this._optimistic((s) => { s.shuffle = on; }); this.send('shuffle', { on }); }
  cycleRepeat() { this._optimistic((s) => { s.repeat = { off: 'all', all: 'one', one: 'off' }[s.repeat]; }); this.send('repeat', { mode: this.s.repeat }); }
  setRepeat(mode) { this.send('repeat', { mode }); }
  setAutoplay(on) { this._optimistic((s) => { s.autoplay = on; }); this.send('autoplay', { on }); }
  setVolume(v) { this._optimistic((s) => { s.vol = v; }); this.send('volume', { v }); }
  startStation(track) { this.send('station', { track: this.slim(track) }); }
  setSleep() { toast('Le minuteur se règle sur le téléphone qui joue la musique', 'info'); }
}
