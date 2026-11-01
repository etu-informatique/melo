// Point d'entrée : navigation, lecteur plein écran, file d'attente, paroles,
// menus, session partagée (QR code) et mode voiture.

import { audius, apple, lyrics as fetchLyrics } from './api.js';
import { store } from './store.js';
import { Player } from './player.js';
import { JamHost, RemotePlayer, joinUrl, newCode } from './jam.js';
import { esc, icon, img, hydrateIcons, setIcon, fmtTime, toast, openSheet, openMenu, prompt, onLongPress, makeSlider, enableSwipeDown, closeTopSheet } from './ui.js';
import { ctx, getList, getObj, avatar, spinner, routeOf, trackRow, reg } from './core.js';
import * as V from './views.js';

const $ = (s, r = document) => r.querySelector(s);
const main = $('#main');
const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
document.documentElement.classList.toggle('ios', isIOS);
hydrateIcons();

/* =====================================================================
   Démarrage : hôte (lecture locale) ou passager (télécommande)
   ===================================================================== */
const params = new URLSearchParams(location.search);
const joinCode = (params.get('jam') || '').toUpperCase().replace(/[^A-Z0-9]/g, '');

let player;
if (joinCode) {
  ctx.guest = true;
  player = new RemotePlayer(joinCode, params.get('b') || 0, store.settings.name || '');
} else {
  player = new Player($('#audio'));
}
ctx.player = player;

/* =====================================================================
   Navigation par onglets (chaque onglet garde sa pile de pages)
   ===================================================================== */
const TABS = ['home', 'browse', 'radio', 'library', 'search'];
const ROOTS = { home: V.home, browse: V.browse, radio: V.radioHome, library: V.library, search: V.search };
const stacks = Object.fromEntries(TABS.map((t) => [t, []]));
const titles = new Map();
const scrolls = new Map();
let curTab = 'home';
let curHash = '';
let renderTok = 0;
let currentView = null;

function parseHash(h = location.hash) {
  const parts = h.replace(/^#\/?/, '').split('/').filter(Boolean);
  const tab = TABS.includes(parts[0]) ? parts.shift() : 'home';
  return { tab, parts };
}

function viewFor(parts, tab) {
  if (!parts.length) return () => ROOTS[tab]();
  const [head, ...rest] = parts;
  switch (head) {
    case 'artist': return () => V.artist(rest);
    case 'col': return () => V.collection(rest);
    case 'genre': return () => V.genre(rest);
    case 'list': return () => V.list(rest);
    case 'library': return () => V.librarySub(rest);
    case 'radio': return rest[0] === 'tag' ? () => V.radioTag(rest.slice(1)) : () => V.radioHome();
    default: return () => ROOTS[tab]();
  }
}

function go(route, tab = curTab) {
  if (route === 'radio') return goTab('radio');
  const h = `#/${tab}${route ? '/' + route : ''}`;
  if (h === location.hash) return render(true);
  // On mémorise la page d'origine pour que « Retour » remonte vraiment l'historique.
  history.pushState({ prev: location.hash }, '', h);
  render();
}
go.refresh = () => render(true);
ctx.go = go;

function goTab(tab) {
  if (tab === curTab) {
    const root = `#/${tab}`;
    if (location.hash !== root && location.hash !== '') { location.hash = root; return; }
    window.scrollTo({ top: 0, behavior: 'smooth' });
    if (tab === 'search') setTimeout(() => $('#q')?.focus(), 50);
    return;
  }
  const st = stacks[tab];
  location.hash = st[st.length - 1] || `#/${tab}`;
}

window.addEventListener('hashchange', () => render());

async function render(keepScroll = false) {
  const h = location.hash || '#/home';
  const { tab, parts } = parseHash(h);
  if (curHash) scrolls.set(curHash, window.scrollY);
  const st = stacks[tab];
  const known = st.indexOf(h);
  const back = known >= 0;
  if (back) st.length = known + 1; else st.push(h);
  curTab = tab;
  curHash = h;
  document.querySelectorAll('[data-tab]').forEach((a) => a.classList.toggle('on', a.dataset.tab === tab && (a.closest('#tabbar') || a.closest('#sidebar'))));
  document.querySelectorAll('#sidebar [data-go]').forEach((a) => a.classList.toggle('on', h === `#/library/${a.dataset.go}`));
  const prev = st[st.length - 2];
  const backBtn = $('#nav-back');
  backBtn.hidden = !parts.length;
  backBtn.querySelector('.lbl').textContent = prev ? (titles.get(prev) || 'Retour') : '';
  document.body.classList.toggle('is-root', !parts.length);
  const my = ++renderTok;
  const scrollTo = back || keepScroll ? (scrolls.get(h) ?? (keepScroll ? window.scrollY : 0)) : 0;
  if (!keepScroll) { main.innerHTML = spinner(); window.scrollTo(0, 0); }
  $('#nav-actions').innerHTML = '';
  let v;
  try { v = await viewFor(parts, tab)(); } catch (e) { console.error(e); v = { title: 'Erreur', html: `<div class="empty">${icon('info')}<h3>Une erreur est survenue</h3><p>${esc(e.message)}</p><button class="btn-fill" data-action="reload">Réessayer</button></div>` }; }
  if (my !== renderTok) return;
  currentView = v;
  titles.set(h, v.title);
  main.innerHTML = `<div class="page ${parts.length ? 'sub' : 'root'} ${back ? '' : 'enter'}">${v.html}</div>`;
  $('#nav-title').textContent = v.title || '';
  $('#nav-actions').innerHTML = v.navActions || '';
  hydrateIcons(main);
  document.title = v.title && v.title !== 'Accueil' ? `${v.title} — Mélo` : 'Mélo';
  clampTexts(main);
  window.scrollTo(0, scrollTo);
  onScroll();
  if (v.after) { await v.after(main); if (my === renderTok) { hydrateIcons(main); clampTexts(main); markPlaying(); if (scrollTo) window.scrollTo(0, scrollTo); } }
}

function clampTexts(root) {
  root.querySelectorAll('[data-clamp]').forEach((p) => {
    if (p.dataset.done) return;
    p.dataset.done = 1;
    if (p.scrollHeight > p.clientHeight + 4) { p.classList.add('clamped'); p.addEventListener('click', () => p.classList.toggle('open')); }
  });
}

// Grand titre qui se replie dans la barre en haut au défilement (comme iOS).
function onScroll() {
  const y = window.scrollY;
  const nav = $('#navbar');
  const large = main.querySelector('.large-title, .col-title, .artist-hero h1, .genre-hero h1');
  const threshold = large ? large.getBoundingClientRect().bottom - 50 : -1;
  nav.classList.toggle('scrolled', y > 4);
  nav.classList.toggle('show-title', !large || threshold < 0);
  nav.classList.toggle('over-hero', !!main.querySelector('.artist-hero, .genre-hero') && threshold > 0);
}
window.addEventListener('scroll', onScroll, { passive: true });

$('#nav-back').addEventListener('click', () => {
  const st = stacks[curTab];
  const prev = st[st.length - 2] || `#/${curTab}`;
  if (history.state?.prev === prev) history.back();
  else { history.replaceState(null, '', prev); render(); }
});

/* =====================================================================
   Actions globales (délégation de clics)
   ===================================================================== */
const trackOf = (el) => { const l = getList(el.dataset.l); return l ? l.tracks[+el.dataset.i] : null; };

function playFrom(key, i, { shuffle = false } = {}) {
  const l = getList(key);
  if (!l) return;
  const t = l.tracks[i];
  if (t && t.live) return player.playList([t], 0, { from: 'Radio en direct' });
  const playable = l.tracks.filter((x) => !x.live);
  if (!playable.length) return;
  if (!shuffle && t && ctx.player.current?.id === t.id) return openNP();
  const idx = t ? playable.indexOf(t) : 0;
  player.playList(playable, shuffle ? -1 : Math.max(0, idx), { from: l.from, shuffle });
  if (!shuffle && window.innerWidth < 700 && !ctx.guest && false) openNP();
}

async function tracksOf(o) {
  if (!o) return [];
  const p = o.id.slice(0, 2), rid = o.id.slice(3);
  if (o.kind === 'lib') return store.playlist(o.id)?.tracks || [];
  if (o.tracks) return o.tracks;
  if (o.name && !o.title) {
    if (p === 'au') return audius.userTracks(rid, 'plays', 40);
    if (p === 'ap') return (await apple.artist(rid)).songs;
  }
  if (p === 'au') return audius.playlistTracks(rid);
  if (p === 'ap') return (await apple.album(rid)).tracks;
  return [];
}

async function playObj(o, opts = {}) {
  try {
    const tr = (await tracksOf(o)).filter((t) => !t.live);
    if (!tr.length) return toast('Aucun morceau lisible', 'info');
    if (opts.next) { player.playNext(tr); return toast('Lecture ensuite', 'list'); }
    if (opts.last) { player.addLast(tr); return toast('Ajouté à la fin de la file', 'list'); }
    player.playList(tr, opts.shuffle ? -1 : 0, { from: o.title || o.name, shuffle: !!opts.shuffle });
  } catch { toast('Chargement impossible', 'info'); }
}

document.addEventListener('click', async (e) => {
  const t = e.target;
  if (t.closest('#np')) return;

  const more = t.closest('[data-more]');
  if (more) { const row = more.closest('[data-l]'); const tr = row && trackOf(row); if (tr) trackMenu(tr, plCtx(row)); return; }

  const op = t.closest('[data-oplay]');
  if (op) { e.stopPropagation(); playObj(getObj(op.dataset.oplay)); return; }

  const cm = t.closest('[data-colmore]');
  if (cm) { colMenu(getObj(cm.dataset.o), cm.dataset.l); return; }

  const act = t.closest('[data-act][data-l]');
  if (act) { playFrom(act.dataset.l, 0, { shuffle: act.dataset.act === 'shuffle' }); return; }

  const hero = t.closest('[data-hero]');
  if (hero) {
    const l = getList(hero.dataset.hero);
    if (hero.dataset.kind === 'station') player.startStation(l.tracks[0]);
    else player.playList(l.tracks, 0, { from: l.from });
    return;
  }

  const row = t.closest('[data-l][data-i]');
  if (row) { playFrom(row.dataset.l, +row.dataset.i); return; }

  const tab = t.closest('[data-tab]');
  if (tab) { e.preventDefault(); closeTopSheet(); goTab(tab.dataset.tab); return; }

  const gs = t.closest('[data-go-search]');
  if (gs) { ctx.searchScope = gs.dataset.goSearch; goTab('search'); if (curTab === 'search') render(); return; }

  const g = t.closest('[data-go]');
  if (g) {
    e.preventDefault();
    closeTopSheet();
    if (g.closest('#sidebar')) { location.hash = `#/library/${g.dataset.go}`; return; }
    go(g.dataset.go);
    return;
  }

  const a = t.closest('[data-action]');
  if (a) { actions[a.dataset.action]?.(a, e); return; }

  if (t.closest('#mini') && !t.closest('[data-p]')) { openNP(); return; }
  const pb = t.closest('[data-p]');
  if (pb && pb.closest('#mini')) { e.stopPropagation(); pcmd(pb.dataset.p); }
});

function plCtx(row) {
  const pl = row.closest('[data-pl]');
  return pl && pl.dataset.pl ? { plId: pl.dataset.pl, plIndex: +row.dataset.i } : {};
}

onLongPress(document.body, '[data-ctx],[data-octx]', (el) => {
  if (el.closest('#np')) return;
  if (el.matches('[data-ctx]')) { const tr = trackOf(el); if (tr) trackMenu(tr, plCtx(el)); } else { const o = getObj(el.dataset.o); if (o) colMenu(o); }
});

const actions = {
  reload: () => render(true),
  settings: () => openSettings(),
  jam: () => openJam(),
  car: () => openCar(),
  'new-playlist': () => newPlaylist(),
  'clear-history': () => { store.clearHistory(); render(true); },
  'edit-playlist': (a) => editPlaylist(a.dataset.id),
  'save-col': async (a) => {
    const o = getObj(a.dataset.o);
    if (store.hasAlbum(o.id)) { store.removeAlbum(o.id); toast('Retiré de la bibliothèque', 'minus'); }
    else { const l = getList(a.dataset.l); store.saveAlbum(o, l ? l.tracks.filter((x) => !x.live) : await tracksOf(o)); toast('Ajouté à la bibliothèque'); }
    a.classList.toggle('on', store.hasAlbum(o.id));
    a.innerHTML = icon(store.hasAlbum(o.id) ? 'check' : 'plus');
  },
};

/* =====================================================================
   Menus contextuels
   ===================================================================== */
const menuHead = (art, seed, title, sub) => `<div class="mh">${img(art, seed)}<div><div class="mh-t">${esc(title)}</div><div class="mh-s">${esc(sub)}</div></div></div>`;

function trackMenu(t, { plId, plIndex, fromNP } = {}) {
  const inLib = store.inLibrary(t.id), fav = store.isFav(t.id);
  const artistRoute = t.artistId && !t.live ? `artist/${t.artistId.slice(0, 2)}/${t.artistId.slice(3)}` : '';
  const albumRoute = t.albumId ? `col/${t.albumId.slice(0, 2)}/${t.albumId.slice(3)}` : '';
  openMenu({
    header: menuHead(t.art, t.id, t.title, t.artist),
    items: [
      !fromNP && !t.live && { label: 'Lire ensuite', icon: 'list', action: () => { player.playNext([t]); toast('Lecture ensuite', 'list'); } },
      !fromNP && !t.live && { label: 'Lire en dernier', icon: 'list', action: () => { player.addLast([t]); toast('Ajouté à la file', 'list'); } },
      { sep: true },
      !t.live && { label: inLib ? 'Supprimer de la bibliothèque' : 'Ajouter à la bibliothèque', icon: inLib ? 'trash' : 'plus', danger: inLib, action: () => { if (inLib) { store.removeTrack(t.id); toast('Supprimé de la bibliothèque', 'trash'); } else { store.addTrack(t); toast('Ajouté à la bibliothèque'); } refreshMarks(); } },
      !t.live && { label: 'Ajouter à une playlist…', icon: 'playlist', action: () => pickPlaylist([t]) },
      plId && { label: 'Retirer de cette playlist', icon: 'minus', danger: true, action: () => { store.removeFromPlaylist(plId, plIndex); render(true); } },
      { label: fav ? 'Retirer des favoris' : 'Favori', icon: fav ? 'starFill' : 'star', action: () => { const on = store.toggleFav(t); toast(on ? 'Ajouté aux favoris' : 'Retiré des favoris', on ? 'starFill' : 'star'); refreshMarks(); } },
      { sep: true },
      !t.live && { label: 'Créer une station', icon: 'station', action: () => { player.startStation(t); toast('Station créée', 'station'); } },
      artistRoute && { label: "Aller à l'artiste", icon: 'mic', action: () => goFromNP(artistRoute) },
      albumRoute && { label: "Aller à l'album", icon: 'album', action: () => goFromNP(albumRoute) },
      { label: 'Partager…', icon: 'share', action: () => shareTrack(t) },
      t.link && { label: 'Écouter en entier sur Apple Music', icon: 'link', action: () => window.open(t.link, '_blank', 'noopener') },
      fromNP && !ctx.guest && { sep: true },
      fromNP && !ctx.guest && { label: player.sleepAt || player.sleepEnd ? `Minuteur : ${sleepLabel()}` : 'Minuteur de veille', icon: 'timer', action: sleepMenu },
    ],
  });
}

function colMenu(o, key) {
  if (!o) return;
  const isLib = o.kind === 'lib';
  const isArtist = o.name && !o.title;
  const saved = store.hasAlbum(o.id);
  openMenu({
    header: menuHead(o.art, o.id, o.title || o.name, isArtist ? 'Artiste' : o.artist || ''),
    items: [
      { label: 'Lecture', icon: 'play', action: () => playObj(o) },
      { label: 'Aléatoire', icon: 'shuffle', action: () => playObj(o, { shuffle: true }) },
      { label: 'Lire ensuite', icon: 'list', action: () => playObj(o, { next: true }) },
      { label: 'Lire en dernier', icon: 'list', action: () => playObj(o, { last: true }) },
      { sep: true },
      !isLib && !isArtist && { label: saved ? 'Retirer de la bibliothèque' : 'Ajouter à la bibliothèque', icon: saved ? 'trash' : 'plus', danger: saved, action: async () => { if (saved) store.removeAlbum(o.id); else store.saveAlbum(o, key ? getList(key).tracks : await tracksOf(o)); toast(saved ? 'Retiré de la bibliothèque' : 'Ajouté à la bibliothèque'); render(true); } },
      { label: 'Ajouter à une playlist…', icon: 'playlist', action: async () => pickPlaylist(await tracksOf(o)) },
      isLib && { label: 'Modifier la playlist', icon: 'edit', action: () => editPlaylist(o.id) },
      isLib && { label: 'Supprimer la playlist', icon: 'trash', danger: true, action: () => deletePlaylist(o.id) },
      { sep: true },
      !isLib && { label: 'Partager…', icon: 'share', action: () => share(o.title || o.name, `#/home/${routeOf(o)}`) },
    ],
  });
}

function refreshMarks() {
  renderNP();
  if (/library/.test(curHash)) render(true);
}

async function share(title, hash) {
  const url = new URL(location.href);
  url.search = '';
  url.hash = hash;
  const data = { title: `${title} — Mélo`, url: url.href };
  try {
    if (navigator.share) await navigator.share(data);
    else { await navigator.clipboard.writeText(url.href); toast('Lien copié', 'link'); }
  } catch { /* annulé */ }
}
function shareTrack(t) {
  if (t.link) {
    const data = { title: `${t.title} · ${t.artist}`, url: t.link };
    return (navigator.share ? navigator.share(data) : navigator.clipboard.writeText(t.link).then(() => toast('Lien copié', 'link'))).catch(() => {});
  }
  const r = t.artistId ? `artist/${t.artistId.slice(0, 2)}/${t.artistId.slice(3)}` : '';
  return share(`${t.title} · ${t.artist}`, `#/home/${r}`);
}

/* Playlists */
async function newPlaylist(tracks = []) {
  const r = await prompt({ title: 'Nouvelle playlist', placeholder: 'Titre de la playlist', ok: 'Créer' });
  if (!r) return null;
  const p = store.createPlaylist(r.value, tracks);
  toast(tracks.length ? `Ajouté à « ${p.name} »` : 'Playlist créée', 'playlist');
  if (!tracks.length) go(`col/lib/${p.id}`, 'library');
  else if (/library/.test(curHash)) render(true);
  return p;
}

function pickPlaylist(tracks) {
  tracks = tracks.filter((t) => !t.live);
  if (!tracks.length) return;
  const pls = store.playlists();
  openSheet({
    html: `<h3 class="sheet-title">Ajouter à une playlist</h3><div class="list"><button class="row" data-np><div class="row-art plus">${icon('plus')}</div><div class="row-main"><div class="row-title accent">Nouvelle playlist…</div></div></button>${pls.map((p) => `<button class="row" data-pid="${p.id}"><div class="row-art">${V.plArt(p)}</div><div class="row-main"><div class="row-title">${esc(p.name)}</div><div class="row-sub">${p.tracks.length} morceaux</div></div></button>`).join('')}</div>`,
    onMount(b, close) {
      b.addEventListener('click', (e) => {
        if (e.target.closest('[data-np]')) { close(); setTimeout(() => newPlaylist(tracks), 200); return; }
        const r = e.target.closest('[data-pid]');
        if (!r) return;
        const p = store.playlist(r.dataset.pid);
        const dup = tracks.length === 1 && p.tracks.some((x) => x.id === tracks[0].id);
        store.addToPlaylist(p.id, tracks);
        close();
        toast(dup ? `Déjà présent — ajouté à nouveau à « ${p.name} »` : `Ajouté à « ${p.name} »`, 'playlist');
        if (curHash.includes(p.id)) render(true);
      });
    },
  });
}

function deletePlaylist(id) {
  const p = store.playlist(id);
  openMenu({ header: `<div class="mh-q">Supprimer « ${esc(p?.name)} » ?</div>`, items: [{ label: 'Supprimer la playlist', icon: 'trash', danger: true, action: () => { store.deletePlaylist(id); toast('Playlist supprimée', 'trash'); go('library/playlists', 'library'); } }] });
}

function editPlaylist(id) {
  const orig = store.playlist(id);
  if (!orig) return;
  // On modifie une copie : « Annuler » ne garde rien.
  const p = { ...orig, tracks: [...orig.tracks] };
  const rows = () => p.tracks.map((t, i) => `<div class="edit-row" data-i="${i}"><button class="er-del" data-del="${i}" aria-label="Retirer">${icon('minus')}</button>${img(t.art, t.id)}<div class="row-main"><div class="row-title">${esc(t.title)}</div><div class="row-sub">${esc(t.artist)}</div></div><button class="er-mv" data-up="${i}" aria-label="Monter" ${i === 0 ? 'disabled' : ''}>${icon('chevL')}</button><button class="er-mv" data-down="${i}" aria-label="Descendre" ${i === p.tracks.length - 1 ? 'disabled' : ''}>${icon('chevL')}</button></div>`).join('');
  openSheet({
    cls: 'tall',
    html: `<div class="sheet-bar"><button data-close class="link-btn">Annuler</button><h3>Modifier</h3><button class="link-btn bold" data-save>OK</button></div>
      <div class="edit-head"><div class="col-art small">${V.plArt(p)}</div><input class="edit-name" value="${esc(p.name)}" maxlength="80" placeholder="Titre"><textarea class="edit-desc" maxlength="300" placeholder="Description">${esc(p.desc || '')}</textarea></div>
      <div class="edit-list">${rows()}</div>
      <button class="danger-btn" data-delpl>Supprimer la playlist</button>`,
    onMount(b, close) {
      const list = b.querySelector('.edit-list');
      const redraw = () => { list.innerHTML = rows(); };
      b.addEventListener('click', (e) => {
        const d = e.target.closest('[data-del]'), u = e.target.closest('[data-up]'), dn = e.target.closest('[data-down]');
        if (d) { p.tracks.splice(+d.dataset.del, 1); redraw(); }
        if (u) { const i = +u.dataset.up; [p.tracks[i - 1], p.tracks[i]] = [p.tracks[i], p.tracks[i - 1]]; redraw(); }
        if (dn) { const i = +dn.dataset.down; [p.tracks[i + 1], p.tracks[i]] = [p.tracks[i], p.tracks[i + 1]]; redraw(); }
        if (e.target.closest('[data-save]')) { store.setPlaylistTracks(id, p.tracks); store.renamePlaylist(id, b.querySelector('.edit-name').value.trim() || p.name, b.querySelector('.edit-desc').value.trim()); close(); render(true); }
        if (e.target.closest('[data-delpl]')) { close(); setTimeout(() => deletePlaylist(id), 250); }
      });
    },
    onClose: () => render(true),
  });
}

/* =====================================================================
   Commandes du lecteur
   ===================================================================== */
function pcmd(c) {
  const cur = player.current;
  switch (c) {
    case 'toggle': return player.toggle();
    case 'next': return player.next();
    case 'prev': return player.prev();
    case 'fav': if (cur) { const on = store.toggleFav(cur); toast(on ? 'Ajouté aux favoris' : 'Retiré des favoris', on ? 'starFill' : 'star'); renderNP(); } return;
    case 'more': if (cur) trackMenu(cur, { fromNP: true }); return;
    case 'lyrics': return setMode(npMode === 'lyrics' ? 'art' : 'lyrics');
    case 'queue': return setMode(npMode === 'queue' ? 'art' : 'queue');
    case 'jam': return openJam();
    default: return undefined;
  }
}

/* Minuteur de veille */
function sleepLabel() {
  if (player.sleepEnd) return 'fin du morceau';
  if (player.sleepAt) return `${Math.max(1, Math.round((player.sleepAt - Date.now()) / 60e3))} min`;
  return 'désactivé';
}
function sleepMenu() {
  openMenu({
    header: `<div class="mh-q">Arrêter la lecture dans…</div>`,
    items: [
      ...[15, 30, 45, 60, 90].map((m) => ({ label: `${m} minutes`, icon: 'timer', action: () => { player.setSleep(m); toast(`Arrêt dans ${m} min`, 'timer'); } })),
      { label: 'À la fin du morceau', icon: 'note', action: () => { player.setSleep('end'); toast('Arrêt à la fin du morceau', 'timer'); } },
      (player.sleepAt || player.sleepEnd) && { label: 'Désactiver le minuteur', icon: 'x', danger: true, action: () => { player.setSleep(0); toast('Minuteur désactivé', 'timer'); } },
    ],
  });
}

/* =====================================================================
   Mini-lecteur + lecteur plein écran
   ===================================================================== */
const np = $('#np');
const mini = $('#mini');
let npMode = 'art';
let lastArt = '';
let artLayer = 1;

function openNP() {
  if (!player.current) return;
  if (np.classList.contains('open')) return;
  np.classList.add('open');
  np.setAttribute('aria-hidden', 'false');
  document.body.classList.add('np-open');
  history.pushState({ np: 1 }, '');
  renderNP();
  tick();
}
function closeNP(fromPop = false) {
  if (!np.classList.contains('open')) return;
  np.classList.remove('open');
  np.setAttribute('aria-hidden', 'true');
  document.body.classList.remove('np-open');
  if (!fromPop && history.state?.np) history.back();
}
let pendingRoute = null;
// Fermer le lecteur puis naviguer : on attend que le retour d'historique soit fait.
function goFromNP(route) {
  if (np.classList.contains('open') && history.state?.np) { pendingRoute = route; closeNP(); }
  else { closeNP(); go(route); }
}
window.addEventListener('popstate', () => {
  if (np.classList.contains('open')) closeNP(true);
  if (pendingRoute) { const r = pendingRoute; pendingRoute = null; go(r); }
});
enableSwipeDown(np.querySelector('.np-inner'), $('.np-grab'), () => closeNP(), (e) => !e.target.closest('.np-panel'));
$('.np-grab').addEventListener('click', () => closeNP());

np.addEventListener('click', (e) => {
  const b = e.target.closest('[data-p]');
  if (b) { pcmd(b.dataset.p); return; }
  if (e.target.closest('.np-artist') || e.target.closest('.np-head-meta .a')) {
    const t = player.current;
    if (t?.artistId && !t.live) goFromNP(`artist/${t.artistId.slice(0, 2)}/${t.artistId.slice(3)}`);
    return;
  }
  if (e.target.closest('.np-head-art') || e.target.closest('.np-head-meta .t')) setMode('art');
});

function setMode(m) {
  npMode = m;
  np.classList.toggle('mode-lyrics', m === 'lyrics');
  np.classList.toggle('mode-queue', m === 'queue');
  np.querySelectorAll('[data-p="lyrics"],[data-p="queue"]').forEach((b) => b.classList.toggle('on', b.dataset.p === m));
  if (m === 'lyrics') loadLyrics();
  if (m === 'queue') renderQueue();
}

function renderMini() {
  const t = player.current;
  mini.hidden = !t;
  document.body.classList.toggle('has-mini', !!t);
  if (!t) return;
  const im = mini.querySelector('img');
  const a = t.art || '';
  if (im.dataset.src !== a) { im.dataset.src = a; im.src = a || 'icons/icon.svg'; }
  mini.querySelector('.mini-title').textContent = t.title;
  mini.querySelector('.mini-sub').textContent = ctx.guest && player.host ? `${t.artist} · chez ${player.host.name}` : t.artist;
  setIcon(mini.querySelector('[data-p="toggle"]'), player.playing ? 'pause' : 'play');
  mini.classList.toggle('playing', player.playing);
}

function renderNP() {
  renderMini();
  const t = player.current;
  if (!t) { closeNP(); return; }
  const big = t.artLg || t.art || '';
  if (big !== lastArt) {
    lastArt = big;
    const artImg = np.querySelector('.np-art img');
    artImg.src = big || 'icons/icon.svg';
    np.querySelector('.np-head-art').src = t.art || big || 'icons/icon.svg';
    const next = np.querySelector(artLayer === 1 ? '.b2' : '.b1');
    const prev = np.querySelector(artLayer === 1 ? '.b1' : '.b2');
    next.src = t.art || big || 'icons/icon.svg';
    next.classList.add('on'); prev.classList.remove('on');
    artLayer = artLayer === 1 ? 2 : 1;
  }
  if (npMode === 'lyrics') loadLyrics();
  const titleSpan = np.querySelector('.np-title span');
  if (titleSpan.textContent !== t.title) {
    titleSpan.textContent = t.title;
    const box = np.querySelector('.np-title');
    box.classList.remove('marquee');
    requestAnimationFrame(() => { if (titleSpan.scrollWidth > box.clientWidth + 2) { box.classList.add('marquee'); box.style.setProperty('--mw', `${titleSpan.scrollWidth - box.clientWidth + 30}px`); } });
  }
  np.querySelector('.np-artist').textContent = t.artist + (t.album ? ` — ${t.album}` : '');
  np.querySelector('.np-head-meta .t').textContent = t.title;
  np.querySelector('.np-head-meta .a').textContent = t.artist;
  const badge = np.querySelector('.np-badge');
  badge.hidden = !(t.preview || t.live);
  badge.textContent = t.live ? 'EN DIRECT' : 'EXTRAIT 30 s';
  np.querySelectorAll('.np-fav').forEach((b) => { setIcon(b, store.isFav(t.id) ? 'starFill' : 'star'); b.classList.toggle('on', store.isFav(t.id)); });
  setIcon(np.querySelector('[data-p="toggle"]'), player.playing ? 'pause' : 'play');
  np.classList.toggle('paused', !player.playing);
  np.classList.toggle('live', !!t.live);
  np.querySelector('.np-scrub .live').hidden = !t.live;
  const cnt = np.querySelector('.np-jam-count');
  const n = ctx.guest ? (player.people?.length || 0) + 1 : (ctx.host?.active ? ctx.host.people.size + 1 : 0);
  cnt.hidden = !n; cnt.textContent = n;
  np.querySelector('[data-p="jam"]').classList.toggle('on', !!n);
  np.querySelector('.np-vol').hidden = isIOS && !ctx.guest;
  if (npMode === 'queue') renderQueue();
  markPlaying();
  renderCar();
}

function tick() {
  const t = player.current;
  const pos = player.position, dur = player.duration;
  const live = !!t?.live || !isFinite(dur);
  const p = !live && dur ? Math.min(1, pos / dur) : 0;
  mini.querySelector('.mini-prog i').style.transform = `scaleX(${live ? 0 : p})`;
  if (np.classList.contains('open')) {
    if (!scrub.dragging) {
      np.querySelector('.np-scrub .fill').style.transform = `scaleX(${p})`;
      np.querySelector('.np-scrub .cur').textContent = live ? '' : fmtTime(pos);
      np.querySelector('.np-scrub .rem').textContent = live ? '' : '-' + fmtTime(Math.max(0, dur - pos));
    }
    if (!volSlider.dragging) np.querySelector('.np-vol .fill').style.transform = `scaleX(${ctx.guest ? player.volume : player.audio.volume})`;
    if (npMode === 'lyrics') syncLyrics(pos);
  }
  carTick(pos, dur, live);
}

const scrub = makeSlider(np.querySelector('.np-scrub'), {
  onInput: (r) => {
    const d = player.duration;
    if (!isFinite(d) || !d) return;
    np.querySelector('.np-scrub .fill').style.transform = `scaleX(${r})`;
    np.querySelector('.np-scrub .cur').textContent = fmtTime(r * d);
    np.querySelector('.np-scrub .rem').textContent = '-' + fmtTime(d - r * d);
  },
  onCommit: (r) => { const d = player.duration; if (isFinite(d) && d) player.seek(r * d); },
});
const volSlider = makeSlider(np.querySelector('.np-vol'), {
  onInput: (r) => { np.querySelector('.np-vol .fill').style.transform = `scaleX(${r})`; if (!ctx.guest) player.setVolume(r); },
  onCommit: (r) => player.setVolume(r),
});

function markPlaying() {
  const id = player.current?.id;
  document.querySelectorAll('#main .row[data-tid]').forEach((r) => {
    const on = r.dataset.tid === id;
    if (on !== r.classList.contains('cur')) r.classList.toggle('cur', on);
  });
  document.body.classList.toggle('is-playing', player.playing);
}

/* ---------- File d'attente (« À suivre ») ---------- */
let qDragging = false;
let showHistory = false;

function qRow(x, cls = '') {
  return `<div class="q-row ${cls} ${x.auto ? 'auto' : ''}" data-qid="${x.qid}"><div class="q-swipe"><div class="row-art">${img(x.art, x.id)}</div><div class="row-main"><div class="row-title">${esc(x.title)}</div><div class="row-sub">${x.by ? `${avatar(x.by.name, 16, 'tiny')} ` : ''}${esc(x.artist)}</div></div>${cls === 'past' ? '' : `<button class="q-del" data-qdel aria-label="Retirer">${icon('minus')}</button><span class="q-handle" data-qdrag aria-label="Déplacer">${icon('drag')}</span>`}</div></div>`;
}

function renderQueue() {
  if (qDragging) return;
  const box = np.querySelector('.np-queue');
  const up = player.upNext;
  const manual = up.filter((x) => !x.auto), auto = up.filter((x) => x.auto);
  const past = player.past.slice(-25);
  const on = (b) => (b ? 'on' : '');
  box.innerHTML = `
    ${past.length ? `<button class="q-hist-btn" data-qhist>${showHistory ? 'Masquer l\'historique' : 'Historique'} ${icon('chevD')}</button>${showHistory ? `<div class="q-list">${past.map((x) => qRow(x, 'past')).join('')}</div>` : ''}` : ''}
    <div class="q-toggles">
      <button data-q="shuffle" class="${on(player.shuffle)}" aria-label="Aléatoire">${icon('shuffle')}</button>
      <button data-q="repeat" class="${on(player.repeat !== 'off')}" aria-label="Répéter">${icon(player.repeat === 'one' ? 'repeat1' : 'repeat')}</button>
      <button data-q="autoplay" class="${on(player.autoplay)}" aria-label="Lecture automatique">${icon('infinity')}</button>
    </div>
    <div class="q-sec"><div><h3>À suivre</h3>${player.from ? `<p>Lecture depuis : ${esc(player.from)}</p>` : ''}</div>${manual.length ? '<button class="q-clear" data-q="clear">Effacer</button>' : ''}</div>
    <div class="q-list" data-zone="manual">${manual.length ? manual.map((x) => qRow(x)).join('') : '<div class="q-empty">Rien à suivre. Ajoutez des morceaux avec « Lire ensuite ».</div>'}</div>
    ${player.autoplay ? `<div class="q-sec"><div><h3>Lecture automatique</h3><p>Des morceaux similaires s'enchaînent</p></div></div><div class="q-list" data-zone="auto">${auto.length ? auto.map((x) => qRow(x)).join('') : `<div class="q-empty">${spinner()}</div>`}</div>` : ''}
  `;
}

np.querySelector('.np-queue').addEventListener('click', (e) => {
  const q = e.target.closest('[data-q]');
  if (q) {
    const k = q.dataset.q;
    if (k === 'shuffle') player.setShuffle(!player.shuffle);
    if (k === 'repeat') player.cycleRepeat();
    if (k === 'autoplay') player.setAutoplay(!player.autoplay);
    if (k === 'clear') player.clearUpNext();
    return;
  }
  if (e.target.closest('[data-qhist]')) { showHistory = !showHistory; renderQueue(); return; }
  const row = e.target.closest('.q-row');
  if (!row) return;
  if (e.target.closest('[data-qdel]')) { row.classList.add('gone'); setTimeout(() => player.remove(row.dataset.qid), 180); return; }
  if (e.target.closest('[data-qdrag]')) return;
  player.jump(row.dataset.qid);
});

// Réordonner par glisser-déposer (poignée) et retirer par balayage vers la gauche.
(() => {
  const box = np.querySelector('.np-queue');
  let drag = null;
  box.addEventListener('pointerdown', (e) => {
    const h = e.target.closest('[data-qdrag]');
    const row = e.target.closest('.q-row');
    if (!row || row.classList.contains('past')) return;
    if (h) {
      e.preventDefault();
      const rows = [...row.parentElement.querySelectorAll('.q-row')];
      drag = { mode: 'move', row, rows, y0: e.clientY, h: row.offsetHeight, from: rows.indexOf(row), to: rows.indexOf(row) };
      qDragging = true;
      row.classList.add('dragging');
      h.setPointerCapture(e.pointerId);
    } else {
      drag = { mode: 'swipe', row, x0: e.clientX, y0: e.clientY, dx: 0, locked: false };
    }
  });
  box.addEventListener('pointermove', (e) => {
    if (!drag) return;
    if (drag.mode === 'move') {
      const dy = e.clientY - drag.y0;
      drag.row.style.transform = `translateY(${dy}px)`;
      const to = Math.max(0, Math.min(drag.rows.length - 1, drag.from + Math.round(dy / drag.h)));
      drag.to = to;
      drag.rows.forEach((r, i) => {
        if (r === drag.row) return;
        let s = 0;
        if (drag.from < to && i > drag.from && i <= to) s = -drag.h;
        if (drag.from > to && i < drag.from && i >= to) s = drag.h;
        r.style.transform = s ? `translateY(${s}px)` : '';
      });
    } else {
      const dx = e.clientX - drag.x0, dy = e.clientY - drag.y0;
      if (!drag.locked) { if (Math.abs(dy) > 10) { drag = null; return; } if (Math.abs(dx) > 10) drag.locked = true; }
      if (drag.locked) { drag.dx = Math.min(0, dx); drag.row.querySelector('.q-swipe').style.transform = `translateX(${drag.dx}px)`; drag.row.classList.toggle('arm', drag.dx < -90); }
    }
  });
  const end = () => {
    if (!drag) return;
    const d = drag;
    drag = null;
    if (d.mode === 'move') {
      d.rows.forEach((r) => { r.style.transform = ''; });
      d.row.classList.remove('dragging');
      qDragging = false;
      if (d.to !== d.from) {
        const target = d.rows[d.to];
        player.move(d.row.dataset.qid, target.dataset.qid, d.to > d.from);
      }
      renderQueue();
    } else if (d.locked) {
      const sw = d.row.querySelector('.q-swipe');
      if (d.dx < -90) { sw.style.transform = 'translateX(-110%)'; d.row.classList.add('gone'); setTimeout(() => player.remove(d.row.dataset.qid), 200); }
      else sw.style.transform = '';
      const stop = (ev) => { ev.stopPropagation(); ev.preventDefault(); };
      d.row.addEventListener('click', stop, { capture: true, once: true });
      setTimeout(() => d.row.removeEventListener('click', stop, true), 50);
    }
  };
  box.addEventListener('pointerup', end);
  box.addEventListener('pointercancel', end);
})();

/* ---------- Paroles synchronisées ---------- */
let lyr = { id: null, data: null };
let lyrUserScroll = 0;
const lbox = np.querySelector('.np-lyrics');
lbox.addEventListener('scroll', () => { if (!lbox.dataset.auto) lyrUserScroll = Date.now(); }, { passive: true });
lbox.addEventListener('click', (e) => {
  const l = e.target.closest('[data-lt]');
  if (l && +l.dataset.lt >= 0) { player.seek(+l.dataset.lt); lyrUserScroll = 0; }
});

async function loadLyrics() {
  const t = player.current;
  if (!t) return;
  if (lyr.id === t.id) return;
  lyr = { id: t.id, data: null };
  if (t.live) { lbox.innerHTML = `<div class="ly-none">${icon('radio')}<p>Radio en direct — pas de paroles.</p></div>`; return; }
  lbox.innerHTML = `<div class="ly-none">${spinner()}</div>`;
  const d = await fetchLyrics(t);
  if (lyr.id !== t.id) return;
  lyr.data = d;
  if (!d || (!d.lines.length && !d.instrumental)) { lbox.innerHTML = `<div class="ly-none">${icon('quote')}<p>Paroles indisponibles pour ce morceau.</p></div>`; return; }
  if (d.instrumental) { lbox.innerHTML = `<div class="ly-none">${icon('note')}<p>Morceau instrumental</p></div>`; return; }
  lbox.innerHTML = `<div class="ly ${d.synced ? 'synced' : 'plain'}">${d.lines.map((l, i) => `<p data-lt="${l.t}" data-li="${i}">${esc(l.text) || '<span class="ly-dots">• • •</span>'}</p>`).join('')}<div class="ly-src">Paroles : ${d.source === 'lyrics.ovh' ? 'lyrics.ovh' : 'LRCLIB'}</div></div>`;
  lyrIdx = -1;
  syncLyrics(player.position);
}
let lyrIdx = -1;
function syncLyrics(pos) {
  const d = lyr.data;
  if (!d || !d.synced) return;
  let i = -1;
  for (let k = 0; k < d.lines.length; k++) { if (d.lines[k].t <= pos + 0.25) i = k; else break; }
  if (i === lyrIdx) return;
  lyrIdx = i;
  lbox.querySelectorAll('p.on').forEach((p) => p.classList.remove('on'));
  const p = lbox.querySelector(`p[data-li="${i}"]`);
  if (!p) return;
  p.classList.add('on');
  if (Date.now() - lyrUserScroll > 3500) {
    lbox.dataset.auto = 1;
    lbox.scrollTo({ top: p.offsetTop - lbox.clientHeight * 0.3, behavior: 'smooth' });
    setTimeout(() => delete lbox.dataset.auto, 600);
  }
}

/* =====================================================================
   Session partagée : QR code, participants, bandeau
   ===================================================================== */
function qrSvg(text) {
  if (!window.qrcode) return `<div class="qr-fallback">${esc(text)}</div>`;
  const q = window.qrcode(0, 'M');
  q.addData(text);
  q.make();
  return q.createSvgTag({ cellSize: 8, margin: 2, scalable: true });
}

function sessionInfo() {
  if (ctx.guest) return { code: player.code, url: joinUrl(player.code, player.b), people: [player.host, ...player.people].filter(Boolean) };
  const h = ctx.host;
  if (h?.active) return { code: h.code, url: h.url, people: [{ id: 'me', name: `${store.settings.name || 'Moi'} (hôte)` }, ...h.people.values()] };
  return null;
}

async function startHost() {
  if (ctx.guest) return null;
  if (ctx.host?.active) return ctx.host;
  ctx.host = ctx.host || new JamHost(player, store.settings.name || 'Hôte');
  ctx.host.addEventListener('change', onJamChange);
  try {
    const saved = JamHost.saved();
    await ctx.host.start(saved?.code || newCode(), saved?.b || 0);
    return ctx.host;
  } catch (e) {
    console.error(e);
    toast('Impossible de démarrer la session (réseau)', 'info');
    return null;
  }
}

function onJamChange() { renderBanner(); renderNP(); refreshJamSheet(); renderCar(); }

let jamSheetBody = null;
function jamHtml() {
  const s = sessionInfo();
  if (!s) {
    return `<div class="jam-intro"><div class="jam-ic">${icon('people')}</div><h2>Écoutez ensemble</h2><p>Lancez une session : vos passagers scannent le QR code avec l'appareil photo de leur téléphone — iPhone ou Android, sans rien installer — et peuvent ajouter, passer, réordonner et choisir la musique.</p>
      <button class="btn-fill wide" data-jam="start">Démarrer une session</button>
      <div class="jam-or">ou rejoignez une session</div>
      <form class="jam-join" data-jam-join><input name="code" maxlength="5" placeholder="Code (ex. K7P2Q)" autocomplete="off" autocapitalize="characters"><button class="btn-tint">Rejoindre</button></form></div>`;
  }
  const status = ctx.guest ? player.status : ctx.host.status;
  const st = { live: 'Connecté', waiting: 'En attente de l\'hôte…', connecting: 'Connexion…', reconnecting: 'Reconnexion…', ended: 'Session terminée' }[status] || status;
  return `<div class="jam">
    <h2>${ctx.guest ? `Session de ${esc(player.host?.name || '…')}` : 'Session partagée'}</h2>
    <div class="jam-status ${status}"><i></i>${esc(st)}</div>
    <div class="qr">${qrSvg(s.url)}</div>
    <div class="jam-code">${s.code.split('').map((c) => `<span>${c}</span>`).join('')}</div>
    <p class="jam-hint">Scannez avec l'appareil photo pour choisir la musique. Aucun compte ni application nécessaire.</p>
    <div class="jam-btns"><button class="btn-tint" data-jam="share">${icon('share')}Partager le lien</button><button class="btn-tint" data-jam="car">${icon('car')}Mode voiture</button></div>
    <h3 class="jam-sub">Participants · ${s.people.length}</h3>
    <div class="jam-people">${s.people.map((p) => `<div class="person">${avatar(p.name, 40)}<span>${esc(p.name)}</span></div>`).join('')}</div>
    ${ctx.guest ? `<button class="btn-ghost wide" data-jam="rename">Changer mon nom (${esc(player.name)})</button><button class="danger-btn" data-jam="leave">Quitter la session</button>` : '<button class="danger-btn" data-jam="stop">Terminer la session</button>'}
  </div>`;
}

function refreshJamSheet() { if (jamSheetBody && jamSheetBody.isConnected) { jamSheetBody.innerHTML = jamHtml(); hydrateIcons(jamSheetBody); } }

function openJam() {
  openSheet({
    cls: 'jam-sheet',
    html: '<div class="jam-body"></div>',
    onMount(b, close) {
      jamSheetBody = b.querySelector('.jam-body');
      refreshJamSheet();
      b.addEventListener('submit', (e) => {
        e.preventDefault();
        const code = new FormData(e.target).get('code').toString().toUpperCase().replace(/[^A-Z0-9]/g, '');
        if (code.length < 4) return toast('Code invalide', 'info');
        location.href = joinUrl(code, 0);
      });
      b.addEventListener('click', async (e) => {
        const a = e.target.closest('[data-jam]')?.dataset.jam;
        if (!a) return;
        if (a === 'start') { e.target.closest('button').disabled = true; jamSheetBody.innerHTML = spinner(); await startHost(); refreshJamSheet(); }
        if (a === 'share') { const s = sessionInfo(); try { if (navigator.share) await navigator.share({ title: 'Rejoins ma session Mélo', text: `Choisis la musique avec moi ! Code ${s.code}`, url: s.url }); else { await navigator.clipboard.writeText(s.url); toast('Lien copié', 'link'); } } catch { /* */ } }
        if (a === 'car') { close(); openCar(); }
        if (a === 'stop') { ctx.host.stop(); toast('Session terminée', 'people'); refreshJamSheet(); }
        if (a === 'leave') leaveGuest();
        if (a === 'rename') { const r = await prompt({ title: 'Votre nom', value: player.name, ok: 'OK' }); if (r) { store.setSetting('name', r.value); player.setName(r.value); refreshJamSheet(); } }
      });
    },
    onClose: () => { jamSheetBody = null; },
  });
}

function renderBanner() {
  const b = $('#jam-banner');
  let html = '';
  if (ctx.guest) {
    const st = player.status;
    const txt = st === 'live' ? `Vous choisissez la musique de <b>${esc(player.host?.name || 'l\'hôte')}</b>` : st === 'ended' ? 'Session terminée' : st === 'waiting' ? 'En attente de l\'hôte…' : 'Connexion à la session…';
    html = `${icon('people')}<span>${txt}</span><span class="jb-n">${(player.people?.length || 0) + 1}</span>`;
  } else if (ctx.host?.active) {
    html = `${icon('people')}<span>Session partagée · code <b>${esc(ctx.host.code)}</b></span><span class="jb-n">${ctx.host.people.size + 1}</span>`;
  }
  b.hidden = !html;
  document.body.classList.toggle('has-banner', !!html);
  b.innerHTML = html;
}
$('#jam-banner').addEventListener('click', () => openJam());

function leaveGuest() {
  player.leave();
  const u = new URL(location.href);
  u.search = '';
  location.href = u.href;
}

/* =====================================================================
   Mode voiture : grandes commandes + QR code toujours visible
   ===================================================================== */
let car = null;
let wakeLock = null;

async function openCar() {
  if (!ctx.guest && !ctx.host?.active) await startHost();
  if (car) return;
  car = document.createElement('div');
  car.id = 'car';
  car.innerHTML = `<button class="car-x" data-car="x" aria-label="Fermer">${icon('x')}</button>
    <div class="car-now"><div class="car-art"><img alt=""></div>
      <div class="car-meta"><div class="car-t"></div><div class="car-a"></div></div>
      <div class="car-bar"><i></i></div>
      <div class="car-ctrl"><button data-car="prev">${icon('backward')}</button><button data-car="toggle" class="big">${icon('play')}</button><button data-car="next">${icon('forward')}</button></div>
    </div>
    <div class="car-side"><div class="car-qr"></div><div class="car-code"></div><div class="car-hint">Scannez pour choisir la musique</div><div class="car-next"></div></div>`;
  document.body.appendChild(car);
  document.body.classList.add('car-on');
  car.addEventListener('click', (e) => {
    const a = e.target.closest('[data-car]')?.dataset.car;
    if (a === 'x') return closeCar();
    if (a) pcmd(a);
  });
  try { wakeLock = await navigator.wakeLock?.request('screen'); } catch { /* non dispo */ }
  try { await document.documentElement.requestFullscreen?.(); } catch { /* */ }
  renderCar();
}
function closeCar() {
  car?.remove();
  car = null;
  document.body.classList.remove('car-on');
  wakeLock?.release?.();
  wakeLock = null;
  if (document.fullscreenElement) document.exitFullscreen?.();
}
document.addEventListener('visibilitychange', async () => { if (car && document.visibilityState === 'visible') { try { wakeLock = await navigator.wakeLock?.request('screen'); } catch { /* */ } } });

let carUrl = '';
function renderCar() {
  if (!car) return;
  const t = player.current;
  car.querySelector('.car-art img').src = t?.artLg || t?.art || 'icons/icon.svg';
  car.querySelector('.car-t').textContent = t ? t.title : 'Rien en lecture';
  car.querySelector('.car-a').textContent = t ? t.artist : 'Les passagers peuvent choisir la musique';
  setIcon(car.querySelector('[data-car="toggle"]'), player.playing ? 'pause' : 'play');
  const s = sessionInfo();
  if (s && s.url !== carUrl) { carUrl = s.url; car.querySelector('.car-qr').innerHTML = qrSvg(s.url); car.querySelector('.car-code').textContent = s.code; }
  const next = player.upNext.slice(0, 3);
  car.querySelector('.car-next').innerHTML = next.length ? `<div class="cn-h">À suivre</div>${next.map((x) => `<div class="cn">${img(x.art, x.id)}<div><b>${esc(x.title)}</b><span>${x.by ? `${esc(x.by.name)} · ` : ''}${esc(x.artist)}</span></div></div>`).join('')}` : '';
}
function carTick(pos, dur, live) {
  if (!car) return;
  car.querySelector('.car-bar i').style.transform = `scaleX(${live || !dur ? 0 : Math.min(1, pos / dur)})`;
}

/* =====================================================================
   Réglages
   ===================================================================== */
let installEvt = null;
window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); installEvt = e; });
const standalone = matchMedia('(display-mode: standalone)').matches || navigator.standalone;

function openSettings() {
  const s = store.settings;
  openSheet({
    cls: 'tall',
    html: `<div class="sheet-bar"><span></span><h3>Compte</h3><button class="link-btn bold" data-close>OK</button></div>
      <div class="set-profile">${avatar(s.name || 'Moi', 64)}<input class="set-name" value="${esc(s.name)}" placeholder="Votre prénom" maxlength="24"><p>Affiché aux autres pendant les sessions partagées.</p></div>
      <div class="set-group">
        <label class="set-row"><span>${icon('infinity')}Lecture automatique</span><input type="checkbox" class="switch" data-set="autoplay" ${player.autoplay ? 'checked' : ''}></label>
        ${ctx.guest ? '' : `<button class="set-row" data-s="sleep"><span>${icon('timer')}Minuteur de veille</span><em>${sleepLabel()}</em></button>`}
        <button class="set-row" data-s="jam"><span>${icon('people')}Session partagée</span>${icon('chevR', 'chev')}</button>
        <button class="set-row" data-s="car"><span>${icon('car')}Mode voiture</span>${icon('chevR', 'chev')}</button>
      </div>
      ${standalone ? '' : `<div class="set-group"><button class="set-row" data-s="install"><span>${icon('download')}Installer l'application</span>${icon('chevR', 'chev')}</button></div>`}
      <div class="set-group">
        <button class="set-row" data-s="export"><span>${icon('share')}Exporter ma bibliothèque</span></button>
        <label class="set-row"><span>${icon('download')}Importer une bibliothèque</span><input type="file" accept="application/json" data-s-import hidden></label>
      </div>
      <div class="set-about"><b>Mélo</b> — gratuit, sans compte, sans publicité.<br>Morceaux complets : Audius · Catalogue et extraits : Apple (iTunes Search) · Radios : Radio Browser · Paroles : LRCLIB.<br>En voiture : CarPlay / Android Auto via le lecteur « À l'écoute » du téléphone (Bluetooth ou câble).</div>`,
    onMount(b, close) {
      const nm = b.querySelector('.set-name');
      nm.addEventListener('change', () => { const v = nm.value.trim(); store.setSetting('name', v); if (ctx.host) ctx.host.name = v || 'Hôte'; if (ctx.guest) player.setName(v || 'Passager'); });
      b.querySelector('[data-set="autoplay"]').addEventListener('change', (e) => player.setAutoplay(e.target.checked));
      b.querySelector('[data-s-import]').addEventListener('change', async (e) => {
        const f = e.target.files[0];
        if (!f) return;
        try { store.import(await f.text()); toast('Bibliothèque importée'); render(true); } catch { toast('Fichier invalide', 'info'); }
      });
      b.addEventListener('click', (e) => {
        const a = e.target.closest('[data-s]')?.dataset.s;
        if (a === 'sleep') { close(); setTimeout(sleepMenu, 250); }
        if (a === 'jam') { close(); setTimeout(openJam, 250); }
        if (a === 'car') { close(); openCar(); }
        if (a === 'export') {
          const blob = new Blob([store.export()], { type: 'application/json' });
          const u = URL.createObjectURL(blob);
          const l = Object.assign(document.createElement('a'), { href: u, download: `melo-bibliotheque-${new Date().toISOString().slice(0, 10)}.json` });
          l.click();
          setTimeout(() => URL.revokeObjectURL(u), 1000);
        }
        if (a === 'install') {
          if (installEvt) { installEvt.prompt(); installEvt = null; return; }
          close();
          setTimeout(() => openSheet({ html: `<div class="install"><h3>Installer Mélo</h3>${isIOS ? `<ol><li>Touchez ${icon('share')} <b>Partager</b> en bas de Safari</li><li>Choisissez <b>Sur l'écran d'accueil</b></li><li>Touchez <b>Ajouter</b></li></ol>` : '<ol><li>Ouvrez le menu ⋮ du navigateur</li><li>Choisissez <b>Installer l\'application</b> ou <b>Ajouter à l\'écran d\'accueil</b></li></ol>'}<p>Mélo s'ouvre alors en plein écran, comme une vraie application, et continue de jouer écran verrouillé.</p><button class="btn-fill wide" data-close>Compris</button></div>` }), 250);
        }
      });
    },
  });
}

/* =====================================================================
   Liaisons lecteur → interface
   ===================================================================== */
player.addEventListener('change', () => { renderNP(); if (ctx.guest) { renderBanner(); refreshJamSheet(); } });
player.addEventListener('time', () => tick());
player.addEventListener('status', () => { renderBanner(); refreshJamSheet(); if (player.status === 'ended') guestEnded(); });

let endedShown = false;
function guestEnded() {
  if (endedShown) return;
  endedShown = true;
  if (car) closeCar();
  openSheet({
    dismissable: false,
    html: `<div class="jam-intro"><div class="jam-ic">${icon('people')}</div><h2>La session est terminée</h2><p>L'hôte a arrêté la session partagée. Vous pouvez continuer à utiliser Mélo sur votre téléphone.</p><button class="btn-fill wide" data-ended>Continuer</button></div>`,
    onMount(b) { b.querySelector('[data-ended]').addEventListener('click', leaveGuest); },
  });
}

// Animation fluide de la progression (le lecteur n'émet « time » que ~4 fois/s).
let rafOn = false;
function loop() {
  if (player.playing && (np.classList.contains('open') || car || !mini.hidden)) tick();
  requestAnimationFrame(loop);
}
if (!rafOn) { rafOn = true; requestAnimationFrame(loop); }

/* Raccourcis clavier (ordinateur) */
document.addEventListener('keydown', (e) => {
  if (e.target.closest('input,textarea')) return;
  if (e.key === ' ') { e.preventDefault(); player.toggle(); }
  else if (e.key === 'ArrowRight' && e.shiftKey) player.next();
  else if (e.key === 'ArrowLeft' && e.shiftKey) player.prev();
  else if (e.key === 'ArrowRight') player.seek(player.position + 10);
  else if (e.key === 'ArrowLeft') player.seek(player.position - 10);
  else if (e.key === 'Escape') { if (!closeTopSheet()) { if (car) closeCar(); else closeNP(); } }
  else if (e.key === '/' ) { e.preventDefault(); goTab('search'); }
});

/* =====================================================================
   Lancement
   ===================================================================== */
async function boot() {
  if (!location.hash) history.replaceState(null, '', location.pathname + location.search + '#/home');
  render();
  renderNP();
  renderBanner();
  if (ctx.guest) {
    if (!store.settings.name) {
      const r = await prompt({ title: 'Comment vous appelez-vous ?', placeholder: 'Votre prénom', ok: 'Rejoindre', extra: '<p class="prompt-note">Les autres verront votre nom à côté des morceaux que vous ajoutez.</p>' });
      const name = r?.value || `Passager ${Math.floor(Math.random() * 90 + 10)}`;
      store.setSetting('name', name);
      player.name = name;
    } else player.name = store.settings.name;
    try { await player.connect(); toast('Connecté à la session', 'people'); } catch { toast('Impossible de rejoindre la session', 'info'); }
    renderBanner();
  } else if (JamHost.saved()) {
    // Reprend automatiquement la session après un rechargement de la page.
    startHost();
  }
}
boot();

if ('serviceWorker' in navigator && location.protocol === 'https:') {
  navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' }).then((reg) => {
    // Vérifie s'il existe une nouvelle version à chaque retour sur l'appli.
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') reg.update().catch(() => {}); });
  }).catch(() => {});
  // Nouvelle version installée : on recharge, mais jamais en pleine lecture.
  let hadController = !!navigator.serviceWorker.controller;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!hadController) { hadController = true; return; }
    const reload = () => { if (!player.playing) location.reload(); };
    if (player.playing) { toast('Mise à jour prête — elle s\'appliquera à la prochaine pause', 'download'); player.addEventListener('change', reload); }
    else reload();
  });
}
