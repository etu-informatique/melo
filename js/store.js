// Bibliothèque personnelle, playlists, favoris, historique — tout reste sur l'appareil.

const KEY = 'melo:v1';
const listeners = new Set();

const blank = () => ({
  tracks: {},        // id -> morceau
  added: [],         // ids dans l'ordre d'ajout (plus récent en premier)
  favs: {},          // id -> horodatage
  albums: {},        // id -> {collection, tracks}
  albumOrder: [],
  playlists: [],     // {id, name, desc, tracks:[morceau], created, updated}
  history: [],       // derniers morceaux écoutés
  recentSearches: [],
  stations: {},      // radios favorites
  settings: { name: '', autoplay: true, crossfade: false },
});

let db = load();

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return { ...blank(), ...JSON.parse(raw), settings: { ...blank().settings, ...JSON.parse(raw).settings } };
  } catch { /* stockage indisponible */ }
  return blank();
}

let saveT;
function save() {
  clearTimeout(saveT);
  saveT = setTimeout(() => {
    try { localStorage.setItem(KEY, JSON.stringify(db)); } catch { /* plein ou bloqué */ }
  }, 150);
  listeners.forEach((fn) => fn());
}

const slim = (t) => {
  const o = {};
  for (const k of ['id', 'src', 'rid', 'title', 'artist', 'artistId', 'album', 'albumId', 'art', 'artLg', 'duration', 'fullDuration', 'url', 'genre', 'year', 'explicit', 'link', 'preview', 'live', 'verified']) if (t[k] !== undefined && t[k] !== '') o[k] = t[k];
  return o;
};

export const store = {
  on(fn) { listeners.add(fn); return () => listeners.delete(fn); },
  get data() { return db; },
  slim,

  /* Bibliothèque */
  inLibrary: (id) => !!db.tracks[id],
  addTrack(t) {
    if (!t || t.live) return;
    if (!db.tracks[t.id]) db.added.unshift(t.id);
    db.tracks[t.id] = slim(t);
    save();
  },
  addTracks(list) { list.forEach((t) => { if (!t.live) { if (!db.tracks[t.id]) db.added.unshift(t.id); db.tracks[t.id] = slim(t); } }); save(); },
  removeTrack(id) {
    delete db.tracks[id];
    db.added = db.added.filter((x) => x !== id);
    save();
  },
  libraryTracks: () => db.added.map((id) => db.tracks[id]).filter(Boolean),

  /* Albums / playlists enregistrés depuis le catalogue */
  hasAlbum: (id) => !!db.albums[id],
  saveAlbum(col, tracks) {
    if (!db.albums[col.id]) db.albumOrder.unshift(col.id);
    db.albums[col.id] = { col: { ...col }, tracks: tracks.map(slim), saved: Date.now() };
    this.addTracks(tracks);
  },
  removeAlbum(id) { delete db.albums[id]; db.albumOrder = db.albumOrder.filter((x) => x !== id); save(); },
  savedAlbums: () => db.albumOrder.map((id) => db.albums[id]).filter(Boolean),

  /* Favoris */
  isFav: (id) => !!db.favs[id],
  toggleFav(t) {
    if (db.favs[t.id]) delete db.favs[t.id];
    else { db.favs[t.id] = Date.now(); if (!t.live) this.addTrack(t); else db.stations[t.id] = slim(t); }
    save();
    return !!db.favs[t.id];
  },
  favTracks: () => Object.entries(db.favs).sort((a, b) => b[1] - a[1]).map(([id]) => db.tracks[id] || db.stations[id]).filter(Boolean),
  favStations: () => Object.keys(db.favs).map((id) => db.stations[id]).filter(Boolean),

  /* Playlists */
  playlists: () => db.playlists,
  playlist: (id) => db.playlists.find((p) => p.id === id),
  createPlaylist(name, tracks = [], desc = '') {
    const p = { id: 'pl' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5), name, desc, tracks: tracks.map(slim), created: Date.now(), updated: Date.now() };
    db.playlists.unshift(p);
    save();
    return p;
  },
  renamePlaylist(id, name, desc) { const p = this.playlist(id); if (p) { p.name = name; if (desc !== undefined) p.desc = desc; p.updated = Date.now(); save(); } },
  deletePlaylist(id) { db.playlists = db.playlists.filter((p) => p.id !== id); save(); },
  addToPlaylist(id, tracks) {
    const p = this.playlist(id);
    if (!p) return 0;
    const add = tracks.filter((t) => !t.live).map(slim);
    p.tracks.push(...add);
    p.updated = Date.now();
    this.addTracks(add);
    return add.length;
  },
  removeFromPlaylist(id, index) { const p = this.playlist(id); if (p) { p.tracks.splice(index, 1); p.updated = Date.now(); save(); } },
  setPlaylistTracks(id, tracks) { const p = this.playlist(id); if (p) { p.tracks = tracks; p.updated = Date.now(); save(); } },
  movePlaylistTrack(id, from, to) { const p = this.playlist(id); if (p) { const [x] = p.tracks.splice(from, 1); p.tracks.splice(to, 0, x); save(); } },

  /* Historique */
  pushHistory(t) {
    db.history = [slim(t), ...db.history.filter((x) => x.id !== t.id)].slice(0, 80);
    save();
  },
  history: () => db.history,
  clearHistory() { db.history = []; save(); },

  /* Recherches récentes */
  pushSearch(q) { q = q.trim(); if (!q) return; db.recentSearches = [q, ...db.recentSearches.filter((x) => x.toLowerCase() !== q.toLowerCase())].slice(0, 12); save(); },
  clearSearches() { db.recentSearches = []; save(); },

  /* Artistes dérivés de la bibliothèque */
  artists() {
    const m = new Map();
    for (const t of this.libraryTracks()) {
      const k = t.artist;
      if (!m.has(k)) m.set(k, { name: t.artist, id: t.artistId, art: t.art, tracks: [] });
      m.get(k).tracks.push(t);
    }
    return [...m.values()].sort((a, b) => a.name.localeCompare(b.name, 'fr', { sensitivity: 'base' }));
  },

  /* Réglages */
  get settings() { return db.settings; },
  setSetting(k, v) { db.settings[k] = v; save(); },

  /* Sauvegarde / restauration */
  export: () => JSON.stringify(db),
  import(json) { const d = JSON.parse(json); db = { ...blank(), ...d }; save(); },
};
