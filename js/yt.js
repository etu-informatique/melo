// Titres complets des artistes du catalogue Apple : on trouve le clip ou l'audio officiel
// sur YouTube (API Data v3, clé limitée au site) et on le joue dans le lecteur YouTube officiel.

const KEY = 'AIzaSyDkHyUQMhFaa5cfl8SYWynZScD7dikb72Q';
const CKEY = 'melo:yt';
const QKEY = 'melo:ytq';

export const ytEvents = new EventTarget();
const emit = (type, detail) => ytEvents.dispatchEvent(new CustomEvent(type, { detail }));

/* ---------- Recherche du bon clip (avec cache local, la recherche coûte du quota) ---------- */

const norm = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
const mainArtist = (a) => String(a || '').split(/,|&| feat\.?| ft\.?| x /i)[0].trim();
const cleanTitle = (t) => String(t || '').replace(/\s*[\(\[](feat|ft|with)\.?[^\)\]]*[\)\]]/gi, '').trim();

let cache = {};
let curKey = '';
try { cache = JSON.parse(localStorage.getItem(CKEY) || '{}'); } catch { /* */ }
const saveCache = () => { try { localStorage.setItem(CKEY, JSON.stringify(cache)); } catch { /* plein */ } };
const keyOf = (t) => `${norm(mainArtist(t.artist))}|${norm(cleanTitle(t.title))}`;

// Quota épuisé : on attend le lendemain (remise à zéro à minuit, heure du Pacifique).
const quotaDay = () => new Date(Date.now() - 8 * 3600e3).toISOString().slice(0, 10);
export function quotaOk() {
  try { return localStorage.getItem(QKEY) !== quotaDay(); } catch { return true; }
}

const BAD = ['live', 'cover', 'karaoke', 'instrumental', 'remix', 'sped up', 'slowed', 'nightcore', '8d', 'reaction', 'tutorial', 'piano', 'concert', 'acoustic', 'parody', 'reverb', 'extended', 'clean version'];

function score(item, t) {
  const sn = item.snippet;
  const title = norm(sn.title), ch = norm(sn.channelTitle);
  const want = norm(cleanTitle(t.title)), artist = norm(mainArtist(t.artist));
  let s = 0;
  if (/ topic$/.test(ch)) s += 6;                       // audio officiel généré par YouTube Music
  if (artist && (ch === artist || ch.startsWith(artist))) s += 5;
  if (ch.includes('vevo')) s += 4;
  if (want && title.includes(want)) s += 4;
  if (artist && title.includes(artist)) s += 2;
  if (/official|officiel/.test(title)) s += 2;
  if (/audio/.test(title)) s += 1;
  if (/lyrics|paroles|lyric video/.test(title)) s -= 2;
  const has = (txt, w) => new RegExp(`(^| )${w}( |$)`).test(txt);
  for (const w of BAD) if (has(title, w) && !has(want, w)) s -= 5;
  return s;
}

async function search(q, t, exclude = new Set()) {
  if (!quotaOk()) return null;
  const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&videoEmbeddable=true&maxResults=10&q=${encodeURIComponent(q)}&key=${KEY}`;
  let j;
  try { j = await (await fetch(url)).json(); } catch { return null; }
  if (j.error) {
    const reason = j.error.errors?.[0]?.reason || '';
    if (/quota|rateLimit|dailyLimit/i.test(reason)) { try { localStorage.setItem(QKEY, quotaDay()); } catch { /* */ } emit('quota'); }
    return null;
  }
  return (j.items || []).map((it) => ({ id: it.id.videoId, s: score(it, t) })).filter((x) => x.id && x.s > 0 && !exclude.has(x.id)).sort((a, b) => b.s - a.s).map((x) => x.id).slice(0, 6);
}

/** Renvoie une liste d'identifiants de vidéos (meilleure d'abord), ou null. */
export async function findVideos(t) {
  const k = keyOf(t);
  curKey = k;
  const hit = cache[k];
  if (hit && (hit.ids?.length || Date.now() - hit.at < 864e5)) return hit.ids?.length ? hit.ids : null;
  const ranked = await search(`${mainArtist(t.artist)} ${cleanTitle(t.title)}`, t);
  if (!ranked) return null;
  cache[k] = { ids: ranked, tried: [], at: Date.now() };
  saveCache();
  return ranked.length ? ranked : null;
}

/** Seconde chance quand toutes les vidéos officielles refusent l'intégration : autres versions du titre. */
export async function findMore(t) {
  const k = keyOf(t);
  const c = cache[k] || { ids: [], tried: [], at: Date.now() };
  if (c.more && Date.now() - c.at < 864e5) return null;
  const ranked = await search(`${mainArtist(t.artist)} ${cleanTitle(t.title)} lyrics`, t, new Set(c.tried || []));
  cache[k] = { ...c, ids: ranked || [], more: true, at: Date.now() };
  saveCache();
  return ranked?.length ? ranked : null;
}

/** Version synchrone : identifiants déjà connus (pour enchaîner sans attendre). */
export function cachedVideos(t) {
  curKey = keyOf(t);
  const hit = cache[curKey];
  return hit?.ids?.length ? hit.ids : null;
}

/* ---------- Lecteur YouTube intégré ---------- */

let apiP = null;
let player = null;
let readyP = null;
let ids = [];
let loadKey = '';
let idx = 0;
let timer = null;
let state = -1;
let hasPlayed = false;   // une première lecture a eu lieu (sur iPhone, il faut un appui)
let watchdog = null;

// Vidéo qui ne démarre jamais (restriction silencieuse) : on passe à la suivante.
function arm(autoplay) {
  clearTimeout(watchdog);
  if (!autoplay || !hasPlayed) return;
  watchdog = setTimeout(() => { if (state !== 1 && state !== 2) skip(); }, 9000);
}
function skip() {
  clearTimeout(watchdog);
  if (idx + 1 < ids.length) { idx++; player.loadVideoById(ids[idx]); arm(true); }
  else { stopTimer(); emit('fail'); }
}

function loadApi() {
  if (!apiP) {
    apiP = new Promise((res) => {
      if (window.YT?.Player) return res(window.YT);
      const prev = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = () => { prev && prev(); res(window.YT); };
      const s = document.createElement('script');
      s.src = 'https://www.youtube.com/iframe_api';
      document.head.appendChild(s);
    });
  }
  return apiP;
}

function ensure() {
  if (!readyP) {
    readyP = loadApi().then((YT) => new Promise((res) => {
      player = new YT.Player('yt-frame', {
        width: '100%', height: '100%',
        playerVars: { playsinline: 1, controls: 0, rel: 0, modestbranding: 1, iv_load_policy: 3, fs: 0, disablekb: 1, origin: location.origin },
        events: {
          onReady: () => { timer = setInterval(poll, 250); res(player); },
          onStateChange: (e) => setState(e.data),
          onError: (e) => {
            // 101/150/151 : intégration interdite par la maison de disques -> on oublie cette vidéo.
            // Les autres erreurs (réseau, lecteur) sont passagères : on passe sans la bannir.
            const bad = ids[idx];
            const c = cache[loadKey];
            if (c && [100, 101, 150, 151].includes(e?.data)) { c.ids = (c.ids || []).filter((x) => x !== bad); c.tried = [...new Set([...(c.tried || []), bad])]; saveCache(); }
            // Vidéo non intégrable ou supprimée : on tente la suivante, sinon on abandonne.
            skip();
          },
        },
      });
    }));
  }
  return readyP;
}

// État suivi par l'événement YouTube ET par sondage (l'événement se perd parfois en arrière-plan).
function setState(st) {
  if (st === state) return;
  state = st;
  if (st === 1) { hasPlayed = true; clearTimeout(watchdog); emit('playing'); }
  else if (st === 2) emit('pause');
  else if (st === 0) emit('ended');
  else if (st === 3) emit('waiting');
}
let lastT = 0;
function poll() {
  let st, t;
  try { st = player.getPlayerState(); t = player.getCurrentTime() || 0; } catch { return; }
  if (!ids.length) return;
  // YouTube renvoie parfois « non démarré » alors que le temps avance : c'est qu'il joue.
  if (st !== 0 && st !== 2 && t > lastT + 0.1) st = 1;
  lastT = t;
  setState(st);
  if (st === 1) emit('time');
}
function stopTimer() { /* le sondage tourne en continu, rien à arrêter */ }

export const yt = {
  preload: () => ensure(),
  async load(videoIds, autoplay, track) {
    ids = [...videoIds]; idx = 0; loadKey = track ? keyOf(track) : curKey;
    const p = await ensure();
    if (autoplay) p.loadVideoById(ids[0]); else p.cueVideoById(ids[0]);
    arm(autoplay);
  },
  play() { player?.playVideo(); },
  pause() { player?.pauseVideo(); },
  stop() { clearTimeout(watchdog); ids = []; state = -1; try { player?.stopVideo(); } catch { /* */ } },
  seek(t) { player?.seekTo(t, true); },
  setVolume(v) { player?.setVolume(Math.round(v * 100)); },
  get needsTap() { return !hasPlayed; },
  get playing() { return state === 1 || state === 3; },
  get position() { try { return player?.getCurrentTime() || 0; } catch { return 0; } },
  get duration() { try { return player?.getDuration() || 0; } catch { return 0; } },
};
