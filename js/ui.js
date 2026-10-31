// Petites briques d'interface : icônes, échappement, toasts, feuilles, menus.

const S = (d, extra = '') => `<path d="${d}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" ${extra}/>`;
const F = (d) => `<path d="${d}" fill="currentColor"/>`;

export const ICONS = {
  play: F('M7 4.6v14.8a1 1 0 0 0 1.52.85l12.1-7.4a1 1 0 0 0 0-1.7L8.52 3.75A1 1 0 0 0 7 4.6z'),
  pause: F('M6.5 4h3a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1h-3a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1zm8 0h3a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1h-3a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1z'),
  stop: F('M6 5h12a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z'),
  forward: F('M1.5 6.3v11.4a.8.8 0 0 0 1.22.68L11.5 13v4.7a.8.8 0 0 0 1.22.68l9.3-5.7a.8.8 0 0 0 0-1.36l-9.3-5.7a.8.8 0 0 0-1.22.68V11L2.72 5.62a.8.8 0 0 0-1.22.68z'),
  backward: F('M22.5 6.3v11.4a.8.8 0 0 1-1.22.68L12.5 13v4.7a.8.8 0 0 1-1.22.68l-9.3-5.7a.8.8 0 0 1 0-1.36l9.3-5.7a.8.8 0 0 1 1.22.68V11l8.78-5.38a.8.8 0 0 1 1.22.68z'),
  home: S('M3.5 10.2 12 3.5l8.5 6.7V19.5a1 1 0 0 1-1 1H15v-6h-6v6H4.5a1 1 0 0 1-1-1z'),
  grid: S('M4 4h6.5v6.5H4zM13.5 4H20v6.5h-6.5zM4 13.5h6.5V20H4zM13.5 13.5H20V20h-6.5z'),
  radio: `<circle cx="12" cy="12" r="2.2" fill="currentColor"/>` + S('M8.4 8.4a5.1 5.1 0 0 0 0 7.2M15.6 8.4a5.1 5.1 0 0 1 0 7.2M5.3 5.3a9.5 9.5 0 0 0 0 13.4M18.7 5.3a9.5 9.5 0 0 1 0 13.4'),
  library: S('M4.5 4v16M9.5 4v16M14 4.6l5.5 15'),
  search: S('M10.5 17.5a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM15.6 15.6 21 21'),
  note: S('M9 18V5.5l11-2V16') + `<circle cx="6" cy="18" r="3" fill="currentColor"/><circle cx="17" cy="16" r="3" fill="currentColor"/>`,
  mic: S('M12 3a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3zM5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21'),
  album: S('M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z') + `<circle cx="12" cy="12" r="2.5" fill="currentColor"/>`,
  star: S('M12 3.2l2.7 5.6 6.1.8-4.5 4.2 1.1 6.1L12 17l-5.4 2.9 1.1-6.1-4.5-4.2 6.1-.8z'),
  starFill: F('M12 2.6l2.9 5.9 6.5.9-4.7 4.5 1.1 6.4L12 17.3l-5.8 3 1.1-6.4-4.7-4.5 6.5-.9z'),
  playlist: S('M3.5 6h11M3.5 11h11M3.5 16h6M18 18.5V8.5l3.5-1') + `<circle cx="16" cy="18.5" r="2.2" fill="currentColor"/>`,
  people: `<circle cx="9" cy="8" r="3.4" fill="currentColor"/><circle cx="17.2" cy="9.2" r="2.5" fill="currentColor"/>` + F('M2.5 19.4C2.5 15.9 5.4 13.5 9 13.5s6.5 2.4 6.5 5.9c0 .6-.4.9-1 .9h-11c-.6 0-1-.3-1-.9zM16.5 20.3c.3-.3.5-.6.5-1 0-1.8-.7-3.3-1.9-4.4.7-.3 1.4-.4 2.1-.4 2.7 0 4.8 1.9 4.8 4.6 0 .7-.4 1.2-1 1.2z'),
  car: S('M3.5 16.5v-3.8l1.9-5.1A2.2 2.2 0 0 1 7.5 6.2h9a2.2 2.2 0 0 1 2.1 1.4l1.9 5.1v3.8a1 1 0 0 1-1 1h-15a1 1 0 0 1-1-1zM3.8 12.5h16.4M5.5 17.5v2M18.5 17.5v2') + `<circle cx="7.5" cy="14.8" r="1.1" fill="currentColor"/><circle cx="16.5" cy="14.8" r="1.1" fill="currentColor"/>`,
  chevL: S('M15 4.5 7.5 12l7.5 7.5', 'stroke-width="2.6"'),
  chevR: S('M9 4.5l7.5 7.5L9 19.5', 'stroke-width="2.2"'),
  chevD: S('M5 9l7 7 7-7', 'stroke-width="2.4"'),
  more: `<circle cx="5" cy="12" r="2" fill="currentColor"/><circle cx="12" cy="12" r="2" fill="currentColor"/><circle cx="19" cy="12" r="2" fill="currentColor"/>`,
  quote: S('M20.5 12a8.5 8.5 0 0 1-12.6 7.45L3.5 20.5l1.1-4.2A8.5 8.5 0 1 1 20.5 12z') + F('M8.2 13.6c0-1.9.9-3.3 2.4-4l.4.7c-.8.5-1.2 1.1-1.3 1.8.8 0 1.4.6 1.4 1.4s-.6 1.5-1.5 1.5c-.9 0-1.4-.6-1.4-1.4zm4.6 0c0-1.9.9-3.3 2.4-4l.4.7c-.8.5-1.2 1.1-1.3 1.8.8 0 1.4.6 1.4 1.4s-.6 1.5-1.5 1.5c-.9 0-1.4-.6-1.4-1.4z'),
  list: S('M9 6h11.5M9 12h11.5M9 18h11.5') + `<circle cx="4.3" cy="6" r="1.4" fill="currentColor"/><circle cx="4.3" cy="12" r="1.4" fill="currentColor"/><circle cx="4.3" cy="18" r="1.4" fill="currentColor"/>`,
  shuffle: S('M16.5 3.5h4v4M3.5 19.5l17-16M20.5 16.5v4h-4M14.5 14.5l6 6M3.5 4.5l5 5'),
  repeat: S('M17 2.5l3.5 3.5L17 9.5M3.5 11.5V9.5a3.5 3.5 0 0 1 3.5-3.5h13.5M7 21.5 3.5 18 7 14.5M20.5 12.5v2a3.5 3.5 0 0 1-3.5 3.5H3.5'),
  repeat1: S('M17 2.5l3.5 3.5L17 9.5M3.5 11.5V9.5a3.5 3.5 0 0 1 3.5-3.5h13.5M7 21.5 3.5 18 7 14.5M20.5 12.5v2a3.5 3.5 0 0 1-3.5 3.5H3.5') + F('M11.3 9.6h1.6v5.4h-1.5v-3.8l-1 .6-.6-1.1z'),
  infinity: S('M12 12c-2-2.6-3.6-4-5.6-4a4 4 0 0 0 0 8c2 0 3.6-1.4 5.6-4zm0 0c2 2.6 3.6 4 5.6 4a4 4 0 0 0 0-8c-2 0-3.6 1.4-5.6 4z'),
  plus: S('M12 4.5v15M4.5 12h15', 'stroke-width="2.3"'),
  plusCircle: S('M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 8v8M8 12h8'),
  check: S('M4.5 12.5l5 5 10-11', 'stroke-width="2.4"'),
  checkCircle: F('M12 2.5a9.5 9.5 0 1 1 0 19 9.5 9.5 0 0 1 0-19zm4.3 6.2a1 1 0 0 0-1.4.1l-4.1 4.9-1.9-1.9a1 1 0 1 0-1.4 1.4l2.7 2.7a1 1 0 0 0 1.5-.1l4.8-5.7a1 1 0 0 0-.2-1.4z'),
  x: S('M6 6l12 12M18 6 6 18', 'stroke-width="2.4"'),
  trash: S('M4 6.5h16M9.5 6.5V4.5h5v2M6 6.5l1 13a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-13M10 10.5v6M14 10.5v6'),
  timer: S('M12 21a8 8 0 1 0 0-16 8 8 0 0 0 0 16zM12 9v4l2.5 2M9.5 2.5h5'),
  share: S('M12 3.5v11M7.5 7.5 12 3l4.5 4.5M6.5 11h-1a1 1 0 0 0-1 1v7.5a1 1 0 0 0 1 1h13a1 1 0 0 0 1-1V12a1 1 0 0 0-1-1h-1'),
  volLow: F('M3.5 9h3.2l4.3-3.9c.6-.5 1.5-.1 1.5.7v12.4c0 .8-.9 1.2-1.5.7L6.7 15H3.5a1 1 0 0 1-1-1v-4a1 1 0 0 1 1-1z') + S('M15.5 9.5a3.5 3.5 0 0 1 0 5'),
  volHigh: F('M2.5 9h3.2L10 5.1c.6-.5 1.5-.1 1.5.7v12.4c0 .8-.9 1.2-1.5.7L5.7 15H2.5a1 1 0 0 1-1-1v-4a1 1 0 0 1 1-1z') + S('M14.5 9.5a3.5 3.5 0 0 1 0 5M17.3 6.8a7.3 7.3 0 0 1 0 10.4M20 4.3a11 11 0 0 1 0 15.4'),
  qr: S('M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h2.5v2.5H14zM17.5 17.5H20V20h-2.5zM17.5 14H20M14 20h1'),
  edit: S('M4 20h4L19.3 8.7a2.1 2.1 0 0 0-3-3L5 17v3zM14.5 7.5l3 3'),
  drag: S('M5 9h14M5 15h14'),
  user: S('M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4.5 20.5a7.5 7.5 0 0 1 15 0'),
  info: S('M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 11v5.5') + `<circle cx="12" cy="7.8" r="1.2" fill="currentColor"/>`,
  station: S('M12 13.5v7M8 20.5h8') + `<circle cx="12" cy="11" r="2.2" fill="currentColor"/>` + S('M7.8 6.8a6 6 0 0 0 0 8.4M16.2 6.8a6 6 0 0 1 0 8.4'),
  minus: S('M5 12h14', 'stroke-width="2.4"'),
  link: S('M10 14a4.5 4.5 0 0 0 6.4 0l3-3a4.5 4.5 0 0 0-6.4-6.4l-1 1M14 10a4.5 4.5 0 0 0-6.4 0l-3 3a4.5 4.5 0 0 0 6.4 6.4l1-1'),
  exit: S('M14.5 4.5h4a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-4M10 8l-4 4 4 4M6 12h10'),
  sparkle: F('M12 2.5l1.9 5.6 5.6 1.9-5.6 1.9L12 17.5l-1.9-5.6L4.5 10l5.6-1.9zM19 15l.9 2.1L22 18l-2.1.9L19 21l-.9-2.1L16 18l2.1-.9z'),
  settings: S('M12 15.2a3.2 3.2 0 1 0 0-6.4 3.2 3.2 0 0 0 0 6.4z') + S('M19.4 13.5a7.6 7.6 0 0 0 0-3l2-1.6-2-3.4-2.4 1a7.6 7.6 0 0 0-2.6-1.5L14 2.5h-4l-.4 2.5A7.6 7.6 0 0 0 7 6.5l-2.4-1-2 3.4 2 1.6a7.6 7.6 0 0 0 0 3l-2 1.6 2 3.4 2.4-1a7.6 7.6 0 0 0 2.6 1.5l.4 2.5h4l.4-2.5a7.6 7.6 0 0 0 2.6-1.5l2.4 1 2-3.4z'),
  globe: S('M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM3 12h18M12 3c2.5 2.5 3.6 5.6 3.6 9s-1.1 6.5-3.6 9c-2.5-2.5-3.6-5.6-3.6-9S9.5 5.5 12 3z'),
  download: S('M12 3.5v12M7.5 11l4.5 4.5 4.5-4.5M4.5 20.5h15'),
};

export function icon(name, cls = '') {
  return `<svg class="ic ${cls}" viewBox="0 0 24 24" aria-hidden="true">${ICONS[name] || ''}</svg>`;
}

/** Remplace tous les <span data-icon="x"> par leur SVG. */
export function hydrateIcons(root = document) {
  root.querySelectorAll('[data-icon]').forEach((n) => {
    n.innerHTML = icon(n.dataset.icon);
  });
}

export function setIcon(node, name) {
  if (!node) return;
  const span = node.matches('[data-icon]') ? node : node.querySelector('[data-icon]');
  if (span && span.dataset.icon !== name) {
    span.dataset.icon = name;
    span.innerHTML = icon(name);
  }
}

export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export function fmtTime(sec) {
  if (!isFinite(sec) || sec < 0) sec = 0;
  sec = Math.floor(sec);
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
  return h ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}` : `${m}:${String(s).padStart(2, '0')}`;
}

export function fmtDuration(sec) {
  const m = Math.round(sec / 60);
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  return `${h} h ${m % 60} min`;
}

export function fmtCount(n) {
  if (!n) return '0';
  if (n >= 1e6) return (n / 1e6).toFixed(1).replace('.0', '').replace('.', ',') + ' M';
  if (n >= 1e3) return (n / 1e3).toFixed(1).replace('.0', '').replace('.', ',') + ' k';
  return String(n);
}

export const debounce = (fn, ms) => {
  let t;
  return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
};

/** Couleur stable à partir d'un texte (pour avatars et pochettes de repli). */
export function hueOf(str) {
  let h = 0;
  for (const c of String(str)) h = (h * 31 + c.charCodeAt(0)) % 360;
  return h;
}

export function initials(name) {
  const words = String(name || '').replace(/\(.*?\)/g, '').replace(/[^\p{L}\p{N}\s]/gu, ' ').trim().split(/\s+/).filter(Boolean);
  return words.slice(0, 2).map((w) => w[0]).join('').toUpperCase() || '?';
}

/** Pochette de repli dessinée en SVG (data URI) quand une image manque. */
export function fallbackArt(seed, label = '') {
  const h = hueOf(seed);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 300"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="hsl(${h},70%,62%)"/><stop offset="1" stop-color="hsl(${(h + 50) % 360},70%,38%)"/></linearGradient></defs><rect width="300" height="300" fill="url(#g)"/><text x="150" y="175" font-family="Inter,Arial" font-size="${label ? 64 : 110}" font-weight="700" fill="rgba(255,255,255,.85)" text-anchor="middle">${esc(label || '♪')}</text></svg>`;
  return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
}

export function img(src, seed, cls = '', label = '') {
  const fb = fallbackArt(seed || src || 'x', label);
  return `<img class="${cls}" src="${esc(src || fb)}" loading="lazy" decoding="async" alt="" data-fb="${esc(fb)}">`;
}

// Remplace les images cassées par leur pochette de repli.
document.addEventListener('error', (e) => {
  const t = e.target;
  if (!t || t.tagName !== 'IMG') return;
  // Les pochettes Audius existent sur plusieurs serveurs : on réessaie sur le serveur principal.
  const m = t.src.match(/^https:\/\/[^/]+(\/content\/.+)$/);
  if (m && !t.dataset.retried) { t.dataset.retried = 1; t.src = (t.src.startsWith('https://creatornode.audius.co') ? 'https://audius-content-1.figment.io' : 'https://creatornode.audius.co') + m[1]; return; }
  if (t.dataset.fb && t.src !== t.dataset.fb) t.src = t.dataset.fb;
  else if (!t.dataset.fb && !t.src.endsWith('icon.svg')) t.src = 'icons/icon.svg';
}, true);

/* ---------- Toasts ---------- */
export function toast(msg, iconName = 'checkCircle') {
  const root = document.getElementById('toast-root');
  const n = document.createElement('div');
  n.className = 'toast';
  n.innerHTML = `${icon(iconName)}<span>${esc(msg)}</span>`;
  root.appendChild(n);
  requestAnimationFrame(() => n.classList.add('in'));
  setTimeout(() => { n.classList.remove('in'); setTimeout(() => n.remove(), 400); }, 2200);
}

/* ---------- Feuilles (bottom sheets / modales) ---------- */
const sheetStack = [];

export function openSheet({ html, cls = '', onMount, onClose, dismissable = true }) {
  const root = document.getElementById('sheet-root');
  const wrap = document.createElement('div');
  wrap.className = `sheet-wrap ${cls}`;
  wrap.innerHTML = `<div class="sheet-dim"></div><div class="sheet" role="dialog"><div class="sheet-grab"><i></i></div><div class="sheet-body">${html}</div></div>`;
  root.appendChild(wrap);
  hydrateIcons(wrap);
  const sheet = wrap.querySelector('.sheet');
  let closed = false;
  const close = () => {
    if (closed) return;
    closed = true;
    wrap.classList.remove('in');
    const i = sheetStack.indexOf(close);
    if (i >= 0) sheetStack.splice(i, 1);
    setTimeout(() => wrap.remove(), 350);
    onClose && onClose();
  };
  if (dismissable) wrap.querySelector('.sheet-dim').addEventListener('click', close);
  wrap.addEventListener('click', (e) => { if (e.target.closest('[data-close]')) close(); });
  enableSwipeDown(sheet, wrap.querySelector('.sheet-grab'), close, () => sheet.querySelector('.sheet-body').scrollTop <= 0);
  sheetStack.push(close);
  requestAnimationFrame(() => requestAnimationFrame(() => wrap.classList.add('in')));
  onMount && onMount(wrap.querySelector('.sheet-body'), close);
  return close;
}

export function closeTopSheet() {
  const c = sheetStack[sheetStack.length - 1];
  if (c) { c(); return true; }
  return false;
}

/** Glisser vers le bas pour fermer (feuilles et lecteur plein écran). */
export function enableSwipeDown(panel, handle, onClose, canStart = () => true) {
  let y0 = null, dy = 0, t0 = 0, active = false;
  const start = (e) => {
    if (e.target.closest('input,textarea,.np-scrub,.np-vol,[data-noswipe]')) return;
    if (!canStart(e)) return;
    y0 = e.touches ? e.touches[0].clientY : e.clientY;
    t0 = Date.now(); dy = 0; active = false;
  };
  const move = (e) => {
    if (y0 == null) return;
    const y = e.touches ? e.touches[0].clientY : e.clientY;
    dy = y - y0;
    if (!active && dy > 8) { active = true; panel.style.transition = 'none'; }
    if (active) {
      if (e.cancelable) e.preventDefault();
      panel.style.transform = `translateY(${Math.max(0, dy)}px)`;
    }
  };
  const end = () => {
    if (y0 == null) return;
    const v = dy / Math.max(1, Date.now() - t0);
    panel.style.transition = '';
    panel.style.transform = '';
    if (active && (dy > 140 || v > 0.6)) onClose();
    y0 = null; active = false;
  };
  const target = panel;
  target.addEventListener('touchstart', start, { passive: true });
  target.addEventListener('touchmove', move, { passive: false });
  target.addEventListener('touchend', end);
  target.addEventListener('touchcancel', end);
  if (handle) {
    handle.addEventListener('mousedown', (e) => { start(e); const mm = (ev) => move(ev); const mu = () => { end(); removeEventListener('mousemove', mm); removeEventListener('mouseup', mu); }; addEventListener('mousemove', mm); addEventListener('mouseup', mu); });
  }
}

/**
 * Menu contextuel façon iOS : en-tête optionnel + groupes d'actions.
 * items: [{label, icon, danger, action, sep}]
 */
export function openMenu({ header = '', items }) {
  const groups = [[]];
  items.filter(Boolean).forEach((it) => { if (it.sep) groups.push([]); else groups[groups.length - 1].push(it); });
  const html = `${header ? `<div class="menu-head">${header}</div>` : ''}
    ${groups.filter((g) => g.length).map((g) => `<div class="menu-group">${g.map((it, i) => `<button class="menu-item ${it.danger ? 'danger' : ''}" data-mi="${items.indexOf(it)}"><span>${esc(it.label)}</span>${it.icon ? icon(it.icon) : ''}</button>`).join('')}</div>`).join('')}
    <button class="menu-cancel" data-close>Annuler</button>`;
  return openSheet({
    html, cls: 'menu-sheet',
    onMount(body, close) {
      body.addEventListener('click', (e) => {
        const b = e.target.closest('[data-mi]');
        if (!b) return;
        const it = items[+b.dataset.mi];
        close();
        setTimeout(() => it.action && it.action(), 120);
      });
    },
  });
}

/** Petite boîte de saisie (ex. nom d'une playlist). */
export function prompt({ title, placeholder = '', value = '', ok = 'OK', extra = '' }) {
  return new Promise((resolve) => {
    let done = false;
    const finish = (v) => { if (!done) { done = true; resolve(v); } };
    openSheet({
      cls: 'prompt-sheet',
      html: `<form class="prompt"><h3>${esc(title)}</h3><input name="v" autocomplete="off" placeholder="${esc(placeholder)}" value="${esc(value)}" maxlength="80">${extra}<div class="prompt-btns"><button type="button" data-close class="btn-ghost">Annuler</button><button class="btn-fill">${esc(ok)}</button></div></form>`,
      onMount(body, close) {
        const f = body.querySelector('form');
        const inp = f.querySelector('input');
        setTimeout(() => inp.focus(), 250);
        f.addEventListener('submit', (e) => {
          e.preventDefault();
          const v = inp.value.trim();
          if (!v) return inp.focus();
          finish({ value: v, form: f });
          close();
        });
      },
      onClose: () => finish(null),
    });
  });
}

/** Appui long (et clic droit) sur un élément → callback. */
export function onLongPress(root, selector, cb) {
  let timer = null, startX = 0, startY = 0, fired = false, target = null;
  root.addEventListener('pointerdown', (e) => {
    const t = e.target.closest(selector);
    if (!t || e.button > 0) return;
    target = t; fired = false; startX = e.clientX; startY = e.clientY;
    timer = setTimeout(() => {
      fired = true;
      t.classList.add('pressed');
      setTimeout(() => t.classList.remove('pressed'), 200);
      navigator.vibrate && navigator.vibrate(12);
      cb(t, e);
    }, 480);
  });
  const cancel = (e) => {
    if (!timer) return;
    if (e && e.type === 'pointermove' && Math.hypot(e.clientX - startX, e.clientY - startY) < 10) return;
    clearTimeout(timer); timer = null;
  };
  root.addEventListener('pointermove', cancel);
  root.addEventListener('pointerup', cancel);
  root.addEventListener('pointercancel', cancel);
  root.addEventListener('click', (e) => {
    if (fired && target && target.contains(e.target)) { e.preventDefault(); e.stopPropagation(); fired = false; }
  }, true);
  root.addEventListener('contextmenu', (e) => {
    const t = e.target.closest(selector);
    if (!t) return;
    e.preventDefault();
    cb(t, e);
  });
}

/** Barre de progression manipulable (position, volume). */
export function makeSlider(el, { onInput, onCommit }) {
  let dragging = false;
  const ratio = (e) => {
    const r = el.querySelector('.track').getBoundingClientRect();
    const x = (e.touches ? e.touches[0].clientX : e.clientX);
    return Math.min(1, Math.max(0, (x - r.left) / r.width));
  };
  const down = (e) => {
    dragging = true; el.classList.add('active');
    onInput && onInput(ratio(e));
    e.stopPropagation();
  };
  const move = (e) => { if (dragging) { if (e.cancelable) e.preventDefault(); onInput && onInput(ratio(e)); } };
  const up = (e) => {
    if (!dragging) return;
    dragging = false; el.classList.remove('active');
    const p = e.changedTouches ? ratio({ clientX: e.changedTouches[0].clientX }) : ratio(e);
    onCommit && onCommit(p);
  };
  el.addEventListener('mousedown', down);
  addEventListener('mousemove', move);
  addEventListener('mouseup', up);
  el.addEventListener('touchstart', down, { passive: true });
  el.addEventListener('touchmove', move, { passive: false });
  el.addEventListener('touchend', up);
  return { get dragging() { return dragging; } };
}
