// État partagé et gabarits HTML réutilisés par toutes les pages.

import { esc, icon, img, fmtTime, fmtCount, initials, hueOf } from './ui.js';
import { store } from './store.js';

export const ctx = {
  player: null,      // Player local ou RemotePlayer (passager)
  host: null,        // JamHost quand on partage sa session
  guest: false,
  go: null,          // navigation (défini dans app.js)
};

/* Registre des listes de morceaux affichées, pour lancer la lecture depuis un clic. */
const lists = new Map();
let lseq = 0;
export function reg(tracks, from = '') {
  const k = 'L' + (lseq++).toString(36);
  lists.set(k, { tracks, from });
  if (lists.size > 400) lists.delete(lists.keys().next().value);
  return k;
}
export const getList = (k) => lists.get(k);

const objs = new Map();
let oseq = 0;
export function regObj(o) { const k = 'O' + (oseq++).toString(36); objs.set(k, o); if (objs.size > 600) objs.delete(objs.keys().next().value); return k; }
export const getObj = (k) => objs.get(k);

export const isCurrent = (t) => ctx.player?.current?.id === t.id;

const badge = (t) => `${t.explicit ? '<span class="tag-e" title="Explicite">E</span>' : ''}${t.preview ? '<span class="tag-p">Extrait</span>' : ''}${t.live ? '<span class="tag-live">Direct</span>' : ''}`;

export function eq() { return '<span class="eq"><i></i><i></i><i></i><i></i></span>'; }

/** Ligne de morceau façon liste Apple Music. */
export function trackRow(t, i, key, { num = false, art = true, sub = null, removable = false } = {}) {
  const cur = isCurrent(t);
  const subtitle = sub ?? [t.artist, t.album && !num ? t.album : ''].filter(Boolean).join(' · ');
  return `<div class="row ${cur ? 'cur' : ''}" data-l="${key}" data-i="${i}" data-ctx data-tid="${esc(t.id)}">
    ${num ? `<div class="row-num">${cur ? eq() : i + 1}</div>` : ''}
    ${art ? `<div class="row-art ${t.live ? 'live' : ''}">${img(t.art, t.id + t.title)}${cur ? `<div class="row-eq">${eq()}</div>` : ''}</div>` : ''}
    <div class="row-main"><div class="row-title">${esc(t.title)}${badge(t)}</div><div class="row-sub">${store.isFav(t.id) ? icon('starFill', 'mini-star') : ''}${esc(subtitle)}</div></div>
    ${t.duration && !t.live && !art ? `<div class="row-dur">${fmtTime(t.fullDuration || t.duration)}</div>` : ''}
    <button class="row-more" data-more aria-label="Plus">${icon('more')}</button>
    ${removable ? '' : ''}
  </div>`;
}

export function trackList(tracks, from, opts = {}) {
  if (!tracks.length) return '';
  const k = reg(tracks, from);
  return `<div class="list">${tracks.map((t, i) => trackRow(t, i, k, opts)).join('')}</div>`;
}

/** Grille horizontale de morceaux (4 lignes par colonne), comme « Top morceaux ». */
export function songGrid(tracks, from, rows = 4) {
  if (!tracks.length) return '';
  const k = reg(tracks, from);
  const cols = [];
  for (let i = 0; i < tracks.length; i += rows) cols.push(tracks.slice(i, i + rows).map((t, j) => trackRow(t, i + j, k)).join(''));
  return `<div class="shelf-scroll songgrid">${cols.map((c) => `<div class="sg-col">${c}</div>`).join('')}</div>`;
}

/** Carte carrée (album, playlist, station, artiste). */
export function card(o, { round = false, wide = false, route = '', sub = null, play = true } = {}) {
  const r = route || routeOf(o);
  const k = regObj(o);
  const name = o.title || o.name;
  return `<div class="card ${round ? 'round' : ''} ${wide ? 'wide' : ''}" ${r ? `data-go="${esc(r)}"` : ''} data-o="${k}" data-octx>
    <div class="card-art">${img(o.art, o.id + name, '', o.kind === 'station' ? '' : '')}${play && !round ? `<button class="card-play" data-oplay="${k}" aria-label="Lire">${icon('play')}</button>` : ''}</div>
    <div class="card-title">${esc(name)}</div>
    <div class="card-sub">${esc(sub ?? o.artist ?? (o.followers != null ? `${fmtCount(o.followers)} abonnés` : ''))}</div>
  </div>`;
}

export function routeOf(o) {
  if (!o || !o.id) return '';
  const [p, rid] = [o.id.slice(0, 2), o.id.slice(3)];
  if (o.name && !o.title) return p === 'au' || p === 'ap' ? `artist/${p}/${rid}` : '';
  if (o.kind === 'album' || o.kind === 'playlist') return `col/${p}/${rid}`;
  if (o.kind === 'lib') return `col/lib/${o.id}`;
  return '';
}

export function shelf(title, inner, { see = '', sub = '' } = {}) {
  if (!inner) return '';
  return `<section class="shelf"><div class="shelf-head">${see ? `<button class="shelf-title" data-go="${esc(see)}">${esc(title)}${icon('chevR')}</button>` : `<h2 class="shelf-title">${esc(title)}</h2>`}${sub ? `<div class="shelf-sub">${esc(sub)}</div>` : ''}</div>${inner}</section>`;
}

export function cardShelf(items, title, opts = {}) {
  if (!items?.length) return '';
  return shelf(title, `<div class="shelf-scroll">${items.map((o) => card(o, opts.card || {})).join('')}</div>`, opts);
}

export function pageHead(title, right = '') {
  return `<div class="page-head"><h1 class="large-title">${esc(title)}</h1>${right}</div>`;
}

export function avatar(name, size = 36, cls = '') {
  const h = hueOf(name);
  return `<span class="avatar ${cls}" style="--s:${size}px;background:linear-gradient(135deg,hsl(${h},65%,58%),hsl(${(h + 40) % 360},65%,42%))">${esc(initials(name))}</span>`;
}

export function spinner() { return '<div class="spin-wrap"><div class="spinner"></div></div>'; }

export function empty(iconName, title, text, btn = '') {
  return `<div class="empty">${icon(iconName)}<h3>${esc(title)}</h3><p>${esc(text)}</p>${btn}</div>`;
}

export function skeletonShelf(n = 6) {
  return `<section class="shelf"><div class="shelf-head"><div class="sk sk-title"></div></div><div class="shelf-scroll">${Array.from({ length: n }, () => '<div class="card"><div class="card-art sk"></div><div class="sk sk-line"></div><div class="sk sk-line short"></div></div>').join('')}</div></section>`;
}
