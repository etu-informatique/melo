// Sources musicales gratuites et sans clé :
//  - Audius : morceaux complets (catalogue indépendant ouvert)
//  - Catalogue Apple (iTunes Search) : tout le catalogue, extraits de 30 s
//  - Radio Browser : des milliers de radios en direct
//  - LRCLIB : paroles synchronisées

const AUDIUS = 'https://api.audius.co/v1';
const APP = 'app_name=melo';
const cache = new Map();

async function getJSON(url, { ttl = 5 * 60e3, timeout = 12000 } = {}) {
  const hit = cache.get(url);
  if (hit && Date.now() - hit.t < ttl) return hit.v;
  const ctrl = new AbortController();
  const tm = setTimeout(() => ctrl.abort(), timeout);
  try {
    const r = await fetch(url, { signal: ctrl.signal });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const v = await r.json();
    cache.set(url, { t: Date.now(), v });
    return v;
  } finally {
    clearTimeout(tm);
  }
}

const aud = (path, params = {}) => {
  const q = new URLSearchParams(params);
  return getJSON(`${AUDIUS}${path}${path.includes('?') ? '&' : '?'}${q}${q.toString() ? '&' : ''}${APP}`).then((j) => j.data);
};

/* ---------- Normalisation ---------- */

// Les images Audius sont répliquées sur de nombreux serveurs, parfois lents : on passe par le nœud principal.
const fixArt = (u) => (u ? u.replace(/^https:\/\/[^/]+\/content\//,'https://creatornode.audius.co/content/') : '');

export function audiusTrack(t) {
  if (!t || !t.id) return null;
  if (t.is_streamable === false || t.is_delete || (t.access && t.access.stream === false) || t.is_stream_gated) return null;
  const art = t.artwork || {};
  return {
    id: `au:${t.id}`,
    src: 'audius',
    rid: t.id,
    title: t.title,
    artist: t.user?.name || 'Artiste inconnu',
    artistId: t.user ? `au:${t.user.id}` : null,
    art: fixArt(art['480x480'] || art['150x150']),
    artLg: fixArt(art['1000x1000'] || art['480x480']),
    duration: t.duration || 0,
    genre: t.genre || '',
    mood: t.mood || '',
    plays: t.play_count || 0,
    year: (t.release_date || t.created_at || '').slice(0, 4),
    verified: !!t.user?.is_verified,
  };
}

export function audiusUser(u) {
  if (!u) return null;
  const p = u.profile_picture || {};
  return {
    id: `au:${u.id}`,
    src: 'audius',
    rid: u.id,
    name: u.name,
    handle: u.handle,
    art: fixArt(p['480x480'] || p['150x150']),
    artLg: fixArt(p['1000x1000'] || p['480x480']),
    cover: fixArt(u.cover_photo?.['2000x'] || u.cover_photo?.['640x']),
    bio: u.bio || '',
    followers: u.follower_count || 0,
    tracks: u.track_count || 0,
    verified: !!u.is_verified,
    location: u.location || '',
  };
}

export function audiusPlaylist(p) {
  if (!p) return null;
  const art = p.artwork || {};
  return {
    id: `au:${p.id}`,
    src: 'audius',
    rid: p.id,
    kind: p.is_album ? 'album' : 'playlist',
    title: p.playlist_name,
    artist: p.user?.name || '',
    artistId: p.user ? `au:${p.user.id}` : null,
    art: fixArt(art['480x480'] || art['150x150']),
    artLg: fixArt(art['1000x1000'] || art['480x480']),
    desc: p.description || '',
    count: p.track_count || 0,
  };
}

const big = (u, s = 600) => (u || '').replace(/\/\d+x\d+(bb)?\.(jpg|png|webp)$/, `/${s}x${s}bb.jpg`);

export function appleTrack(t) {
  if (!t || !t.previewUrl) return null;
  return {
    id: `ap:${t.trackId}`,
    src: 'apple',
    rid: t.trackId,
    title: t.trackName,
    artist: t.artistName,
    artistId: t.artistId ? `ap:${t.artistId}` : null,
    album: t.collectionName,
    albumId: t.collectionId ? `ap:${t.collectionId}` : null,
    art: big(t.artworkUrl100, 400),
    artLg: big(t.artworkUrl100, 1000),
    duration: 30,
    fullDuration: Math.round((t.trackTimeMillis || 0) / 1000),
    url: t.previewUrl,
    genre: t.primaryGenreName || '',
    year: (t.releaseDate || '').slice(0, 4),
    explicit: t.trackExplicitness === 'explicit',
    link: t.trackViewUrl,
    preview: true,
    trackNumber: t.trackNumber,
  };
}

export function appleAlbum(a) {
  return {
    id: `ap:${a.collectionId}`,
    src: 'apple',
    rid: a.collectionId,
    kind: 'album',
    title: a.collectionName,
    artist: a.artistName,
    artistId: a.artistId ? `ap:${a.artistId}` : null,
    art: big(a.artworkUrl100, 400),
    artLg: big(a.artworkUrl100, 1000),
    count: a.trackCount || 0,
    year: (a.releaseDate || '').slice(0, 4),
    genre: a.primaryGenreName || '',
    link: a.collectionViewUrl,
  };
}

export function appleArtist(a) {
  return { id: `ap:${a.artistId}`, src: 'apple', rid: a.artistId, name: a.artistName, genre: a.primaryGenreName || '', art: '', link: a.artistLinkUrl };
}

export function radioTrack(s) {
  const url = s.url_resolved || s.url;
  return {
    id: `rd:${s.stationuuid}`,
    src: 'radio',
    rid: s.stationuuid,
    title: s.name.trim(),
    artist: [s.country, (s.tags || '').split(',').slice(0, 2).join(' · ')].filter(Boolean).join(' — ') || 'Radio',
    art: s.favicon && s.favicon.startsWith('https') ? s.favicon : '',
    artLg: s.favicon && s.favicon.startsWith('https') ? s.favicon : '',
    url,
    live: true,
    duration: 0,
    codec: s.codec,
    bitrate: s.bitrate,
    homepage: s.homepage,
  };
}

const clean = (arr, fn) => (arr || []).map(fn).filter(Boolean);

/* ---------- Audius ---------- */

export const GENRES = [
  { id: 'Electronic', name: 'Électro', c: ['#6a5cff', '#22c1c3'] },
  { id: 'Hip-Hop/Rap', name: 'Rap & Hip-hop', c: ['#ff6a3d', '#ffb43d'] },
  { id: 'Pop', name: 'Pop', c: ['#ff3d8b', '#ff8fb1'] },
  { id: 'R&B/Soul', name: 'R&B & Soul', c: ['#a43dff', '#ff5ea8'] },
  { id: 'Lo-Fi', name: 'Lo-fi', c: ['#3d7bff', '#9ed2ff'] },
  { id: 'House', name: 'House', c: ['#00b37a', '#7cf2c4'] },
  { id: 'Rock', name: 'Rock', c: ['#e0262d', '#5a0c10'] },
  { id: 'Alternative', name: 'Alternative', c: ['#4b5563', '#9ca3af'] },
  { id: 'Ambient', name: 'Ambiance', c: ['#2563eb', '#60a5fa'] },
  { id: 'Techno', name: 'Techno', c: ['#111827', '#7c3aed'] },
  { id: 'Dubstep', name: 'Dubstep', c: ['#16a34a', '#a3e635'] },
  { id: 'Trap', name: 'Trap', c: ['#7f1d1d', '#f97316'] },
  { id: 'Jazz', name: 'Jazz', c: ['#92400e', '#fbbf24'] },
  { id: 'Acoustic', name: 'Acoustique', c: ['#a16207', '#fde68a'] },
  { id: 'Latin', name: 'Latino', c: ['#db2777', '#facc15'] },
  { id: 'Experimental', name: 'Expérimental', c: ['#0f766e', '#5eead4'] },
  { id: 'Classical', name: 'Classique', c: ['#78350f', '#d6d3d1'] },
  { id: 'Drum & Bass', name: 'Drum & Bass', c: ['#1e3a8a', '#f43f5e'] },
  { id: 'Reggae', name: 'Reggae', c: ['#15803d', '#eab308'] },
  { id: 'Soundtrack', name: 'Bandes originales', c: ['#334155', '#f59e0b'] },
];

export const audius = {
  trending: (opts = {}) => aud('/tracks/trending', { time: opts.time || 'week', limit: opts.limit || 40, ...(opts.genre ? { genre: opts.genre } : {}) }).then((d) => clean(d, audiusTrack)),
  underground: (limit = 30) => aud('/tracks/trending/underground', { limit }).then((d) => clean(d, audiusTrack)),
  trendingPlaylists: (limit = 20) => aud('/playlists/trending', { time: 'week', limit }).then((d) => clean(d, audiusPlaylist)),
  searchTracks: (q, limit = 30) => aud('/tracks/search', { query: q, limit }).then((d) => clean(d, audiusTrack)),
  searchUsers: (q, limit = 12) => aud('/users/search', { query: q, limit }).then((d) => clean(d, audiusUser)),
  searchPlaylists: (q, limit = 12) => aud('/playlists/search', { query: q, limit }).then((d) => clean(d, audiusPlaylist)),
  user: (rid) => aud(`/users/${rid}`).then((d) => audiusUser(Array.isArray(d) ? d[0] : d)),
  userTracks: (rid, sort = 'plays', limit = 50) => aud(`/users/${rid}/tracks`, { sort, limit }).then((d) => clean(d, audiusTrack)),
  userPlaylists: (rid) => aud(`/users/${rid}/playlists`, { limit: 20 }).then((d) => clean(d, audiusPlaylist)).catch(() => []),
  userAlbums: (rid) => aud(`/users/${rid}/albums`, { limit: 20 }).then((d) => clean(d, audiusPlaylist)).catch(() => []),
  playlist: (rid) => aud(`/playlists/${rid}`).then((d) => audiusPlaylist(Array.isArray(d) ? d[0] : d)),
  playlistTracks: (rid) => aud(`/playlists/${rid}/tracks`).then((d) => clean(d, audiusTrack)),
  streamUrl: (rid) => `${AUDIUS}/tracks/${rid}/stream?${APP}`,
};

/* ---------- Catalogue Apple (extraits) ---------- */

const IT = 'https://itunes.apple.com';

// Versions dérivées (instrumentales, karaoké, ralenties…) : masquées sauf si on les cherche exprès.
const ALT = /instrumental|karaok|a ?cappella|sped ?up|slowed|reverb|8d audio|nightcore|backing track|in the style of/i;
const isAlt = (x) => ALT.test(x.title || '') || ALT.test(x.album || '') || ALT.test(x.trackName || '') || ALT.test(x.collectionName || '');
const wantsAlt = (q) => ALT.test(q || '');
// Un même titre sort souvent sur plusieurs albums (single, album, deluxe) : on n'en garde qu'un.
function dedupe(list) {
  const seen = new Set();
  return list.filter((t) => {
    const k = `${(t.title || '').toLowerCase().replace(/s*[([].*?[)]]/g, '').trim()}|${(t.artist || '').toLowerCase()}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}
const tidy = (list, q) => dedupe(wantsAlt(q) ? list : list.filter((t) => !isAlt(t)));
const country = () => (navigator.language || 'fr-FR').split('-')[1]?.toLowerCase() || 'fr';

export const apple = {
  searchSongs: (q, limit = 30) => getJSON(`${IT}/search?term=${encodeURIComponent(q)}&entity=song&limit=${limit}&country=${country()}`).then((j) => tidy(clean(j.results, appleTrack), q)),
  searchAlbums: (q, limit = 12) => getJSON(`${IT}/search?term=${encodeURIComponent(q)}&entity=album&limit=${limit}&country=${country()}`).then((j) => (j.results || []).filter((a) => wantsAlt(q) || !isAlt(a)).map(appleAlbum)),
  searchArtists: (q, limit = 8) => getJSON(`${IT}/search?term=${encodeURIComponent(q)}&entity=musicArtist&limit=${limit}&country=${country()}`).then((j) => (j.results || []).map(appleArtist)),
  album: async (rid) => {
    const j = await getJSON(`${IT}/lookup?id=${rid}&entity=song&country=${country()}`);
    const res = j.results || [];
    const info = res.find((r) => r.wrapperType === 'collection');
    const tracks = clean(res.filter((r) => r.wrapperType === 'track'), appleTrack).sort((a, b) => (a.trackNumber || 0) - (b.trackNumber || 0));
    return { album: info ? appleAlbum(info) : null, tracks };
  },
  artistSongs: (rid, limit = 40) => getJSON(`${IT}/lookup?id=${rid}&entity=song&limit=${limit}&country=${country()}`).then((j) => tidy(clean((j.results || []).filter((r) => r.wrapperType === 'track'), appleTrack)).slice(0, 25)),
  artist: async (rid) => {
    const [a, s] = await Promise.all([
      getJSON(`${IT}/lookup?id=${rid}&entity=album&limit=30&country=${country()}`),
      getJSON(`${IT}/lookup?id=${rid}&entity=song&limit=40&country=${country()}`),
    ]);
    const info = (a.results || []).find((r) => r.wrapperType === 'artist');
    const albums = (a.results || []).filter((r) => r.wrapperType === 'collection' && !isAlt(r)).map(appleAlbum);
    const songs = tidy(clean((s.results || []).filter((r) => r.wrapperType === 'track'), appleTrack));
    const artist = info ? appleArtist(info) : { id: `ap:${rid}`, name: songs[0]?.artist || 'Artiste' };
    artist.art = albums[0]?.artLg || songs[0]?.artLg || '';
    return { artist, albums, songs };
  },
};

/* ---------- Radio ---------- */

const RADIO_HOSTS = ['https://de1.api.radio-browser.info', 'https://fi1.api.radio-browser.info', 'https://de2.api.radio-browser.info'];

async function radioGet(path) {
  let err;
  for (const h of RADIO_HOSTS) {
    try {
      const d = await getJSON(`${h}/json/${path}`, { ttl: 30 * 60e3, timeout: 9000 });
      // Seuls les flux HTTPS sont lisibles depuis une page sécurisée.
      return d.filter((s) => (s.url_resolved || s.url || '').startsWith('https://') && s.lastcheckok !== 0).map(radioTrack);
    } catch (e) { err = e; }
  }
  throw err;
}

export const RADIO_TAGS = [
  { tag: 'pop', name: 'Pop' }, { tag: 'hits', name: 'Hits' }, { tag: 'rap', name: 'Rap' },
  { tag: 'rock', name: 'Rock' }, { tag: 'jazz', name: 'Jazz' }, { tag: 'lofi', name: 'Lo-fi' },
  { tag: 'electronic', name: 'Électro' }, { tag: 'classical', name: 'Classique' },
  { tag: 'chill', name: 'Chill' }, { tag: 'news', name: 'Infos' }, { tag: '80s', name: 'Années 80' }, { tag: 'reggae', name: 'Reggae' },
];

export const radio = {
  byCountry: (cc = country().toUpperCase(), limit = 40) => radioGet(`stations/search?countrycode=${cc}&order=clickcount&reverse=true&limit=${limit}&hidebroken=true`),
  top: (limit = 40) => radioGet(`stations/topclick/${limit}`),
  byTag: (tag, limit = 40) => radioGet(`stations/search?tag=${encodeURIComponent(tag)}&order=clickcount&reverse=true&limit=${limit}&hidebroken=true`),
  search: (q, limit = 30) => radioGet(`stations/search?name=${encodeURIComponent(q)}&order=clickcount&reverse=true&limit=${limit}&hidebroken=true`),
};

/* ---------- Paroles ---------- */

export async function lyrics(track) {
  if (!track || track.live) return null;
  const clean = (s) => String(s || '').replace(/\s*[\(\[].*?(feat|ft\.|prod|remix|edit|mix).*?[\)\]]/gi, '').replace(/^@/, '').trim();
  const t = clean(track.title), a = clean(track.artist);
  const tries = [
    `https://lrclib.net/api/get?track_name=${encodeURIComponent(t)}&artist_name=${encodeURIComponent(a)}${track.fullDuration || track.duration ? `&duration=${track.fullDuration || track.duration}` : ''}`,
    `https://lrclib.net/api/search?track_name=${encodeURIComponent(t)}&artist_name=${encodeURIComponent(a)}`,
  ];
  for (const u of tries) {
    try {
      let d = await getJSON(u, { ttl: 24 * 3600e3, timeout: 8000 });
      if (Array.isArray(d)) d = d.find((x) => x.syncedLyrics) || d.find((x) => x.plainLyrics) || null;
      if (d && (d.syncedLyrics || d.plainLyrics)) return parseLyrics(d);
    } catch { /* essaie la suivante */ }
  }
  // Secours : paroles non synchronisées.
  try {
    const d = await getJSON(`https://api.lyrics.ovh/v1/${encodeURIComponent(a.split(/,|&| feat/i)[0].trim())}/${encodeURIComponent(t)}`, { ttl: 24 * 3600e3, timeout: 8000 });
    if (d && d.lyrics && d.lyrics.trim()) {
      const text = d.lyrics.replace(/\r/g, '').replace(/^Paroles de la chanson.*\n/i, '').replace(/\n{3,}/g, '\n\n').trim();
      return { synced: false, source: 'lyrics.ovh', lines: text.split('\n').map((x) => ({ t: -1, text: x })) };
    }
  } catch { /* rien */ }
  return null;
}

function parseLyrics(d) {
  if (d.instrumental) return { instrumental: true, lines: [] };
  if (d.syncedLyrics) {
    const lines = [];
    for (const raw of d.syncedLyrics.split('\n')) {
      const m = raw.match(/^\[(\d+):(\d+(?:\.\d+)?)\](.*)$/);
      if (m) lines.push({ t: +m[1] * 60 + +m[2], text: m[3].trim() });
    }
    if (lines.length) return { synced: true, lines };
  }
  return { synced: false, lines: d.plainLyrics.split('\n').map((text) => ({ t: -1, text })) };
}

/* ---------- Photos d'artistes (Deezer, en JSONP car l'API n'autorise pas CORS) ---------- */

let jsonpSeq = 0;
function jsonp(url, timeout = 8000) {
  return new Promise((resolve, reject) => {
    const cb = `__melo_jp${jsonpSeq++}`;
    const s = document.createElement('script');
    const done = (fn, v) => { clearTimeout(t); delete window[cb]; s.remove(); fn(v); };
    const t = setTimeout(() => done(reject, new Error('timeout')), timeout);
    window[cb] = (data) => done(resolve, data);
    s.onerror = () => done(reject, new Error('jsonp'));
    s.src = `${url}${url.includes('?') ? '&' : '?'}output=jsonp&callback=${cb}`;
    document.head.appendChild(s);
  });
}

const norm = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]/g, '');
const photoCache = new Map();

/** Photo d'un artiste à partir de son nom ('' si introuvable). */
export function artistPhoto(name) {
  const k = norm(name);
  if (!k) return Promise.resolve('');
  if (!photoCache.has(k)) {
    photoCache.set(k, jsonp(`https://api.deezer.com/search/artist?q=${encodeURIComponent(name)}&limit=5`)
      .then((d) => {
        const hit = (d.data || []).find((a) => norm(a.name) === k);
        return hit ? (hit.picture_xl || hit.picture_big || '') : '';
      })
      .catch(() => ''));
  }
  return photoCache.get(k);
}

/* ---------- Recherche groupée ---------- */

export async function searchAll(q, scope) {
  if (scope === 'audius') {
    const [songs, artists, playlists, stations] = await Promise.allSettled([audius.searchTracks(q, 30), audius.searchUsers(q, 10), audius.searchPlaylists(q, 12), radio.search(q, 8)]);
    return { songs: songs.value || [], artists: (artists.value || []).filter((a) => a.tracks > 0), playlists: playlists.value || [], albums: [], stations: stations.value || [], full: [] };
  }
  // « Tout » : les vrais artistes du catalogue Apple d'abord, puis les morceaux complets gratuits.
  const [songs, albums, artists, full, users, playlists, stations] = await Promise.allSettled([
    apple.searchSongs(q, 25), apple.searchAlbums(q, 12), apple.searchArtists(q, 8),
    audius.searchTracks(q, 15), audius.searchUsers(q, 6), audius.searchPlaylists(q, 8), radio.search(q, 6),
  ]);
  const apArtists = artists.value || [];
  const taken = new Set(apArtists.map((a) => norm(a.name)));
  // Si la recherche est le nom exact d'un artiste, ses titres passent avant les homonymes.
  let songList = songs.value || [];
  const exact = apArtists.find((a) => norm(a.name) === norm(q));
  if (exact) {
    const own = await apple.artistSongs(exact.rid).catch(() => []);
    const seen = new Set(own.map((t) => t.id));
    songList = [...own, ...songList.filter((t) => !seen.has(t.id))];
  }
  const auArtists = (users.value || []).filter((a) => a.tracks > 0 && a.followers >= 50 && !taken.has(norm(a.name)));
  return {
    songs: songList,
    albums: albums.value || [],
    artists: [...apArtists, ...auArtists],
    playlists: playlists.value || [],
    stations: stations.value || [],
    full: full.value || [],
  };
}

/** Trouve des morceaux proches pour la lecture automatique (∞). */
export async function similar(track, exclude = new Set()) {
  let pool = [];
  try {
    if (track?.src === 'apple' && track.artist) {
      pool = await apple.searchSongs(track.genre ? `${track.genre}` : track.artist, 40);
    } else {
      const genre = track?.genre && GENRES.some((g) => g.id === track.genre) ? track.genre : undefined;
      pool = await audius.trending({ genre, time: Math.random() < 0.5 ? 'week' : 'month', limit: 50 });
      if (track?.artistId && track.src === 'audius') {
        const more = await audius.userTracks(track.artistId.slice(3), 'plays', 10).catch(() => []);
        pool = pool.concat(more.slice(0, 4));
      }
    }
  } catch { /* rien */ }
  const out = pool.filter((t) => !exclude.has(t.id));
  for (let i = out.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [out[i], out[j]] = [out[j], out[i]]; }
  return out.slice(0, 15);
}
