// Pages de l'application. Chaque vue renvoie { title, html, after?(el) }.

import { audius, apple, radio, GENRES, RADIO_TAGS, searchAll } from './api.js';
import { store } from './store.js';
import { esc, icon, img, fmtDuration, fmtCount, debounce, hydrateIcons } from './ui.js';
import { ctx, reg, trackList, songGrid, card, cardShelf, shelf, pageHead, avatar, spinner, empty, skeletonShelf, regObj } from './core.js';

const settled = async (p, d = []) => { try { return await p; } catch { return d; } };
const profileBtn = () => `<button class="profile-btn" data-action="settings" aria-label="Compte et réglages">${avatar(store.settings.name || 'Moi', 34)}</button>`;

const stationCard = (s) => {
  const k = reg([s], s.title);
  return `<div class="card station" data-l="${k}" data-i="0" data-ctx><div class="card-art radio-art">${img(s.art, s.id, '', '')}<span class="live-dot">EN DIRECT</span></div><div class="card-title">${esc(s.title)}</div><div class="card-sub">${esc(s.artist)}</div></div>`;
};

const genreTile = (g, route) => `<button class="tile" data-go="${route || `genre/${encodeURIComponent(g.id)}`}" style="--c1:${g.c[0]};--c2:${g.c[1]}"><span>${esc(g.name)}</span></button>`;

/* ================= Accueil ================= */
export async function home() {
  return {
    title: 'Accueil',
    html: pageHead('Accueil', profileBtn()) + `<div id="home-body">${skeletonShelf()}${skeletonShelf()}</div>`,
    async after(el) {
      const hist = store.history();
      const favGenres = [...new Set(hist.map((t) => t.genre).filter((g) => GENRES.some((x) => x.id === g)))];
      const picks = (favGenres.length ? favGenres : ['Electronic', 'Hip-Hop/Rap', 'Lo-Fi']).slice(0, 3);
      const [trend, under, pls, ...genreSets] = await Promise.all([
        settled(audius.trending({ time: 'week', limit: 40 })),
        settled(audius.underground(24)),
        settled(audius.trendingPlaylists(16)),
        ...picks.map((g) => settled(audius.trending({ genre: g, time: 'month', limit: 16 }))),
      ]);
      const stations = await settled(radio.byCountry(undefined, 12));
      const body = el.querySelector('#home-body');
      if (!body) return;
      const hero = [
        trend[0] && { kind: 'mix', title: 'Tendances de la semaine', sub: 'Les morceaux les plus écoutés en ce moment', art: trend[0].artLg, tracks: trend, c: '#fa2d48' },
        under[0] && { kind: 'mix', title: 'Mix Découverte', sub: 'De nouveaux talents choisis pour vous', art: under[0].artLg, tracks: under, c: '#5856d6' },
        hist[0] && { kind: 'station', title: 'Ma station', sub: `D'après « ${hist[0].title} »`, art: hist[0].artLg || hist[0].art, seed: hist[0], c: '#ff9500' },
        genreSets[0]?.[0] && { kind: 'mix', title: `Le meilleur : ${GENRES.find((g) => g.id === picks[0])?.name}`, sub: 'Sélection du mois', art: genreSets[0][0].artLg, tracks: genreSets[0], c: '#34c759' },
      ].filter(Boolean);
      const heroHtml = hero.map((h) => {
        const k = h.tracks ? reg(h.tracks, h.title) : reg([h.seed], h.title);
        return `<div class="hero" data-hero="${k}" data-kind="${h.kind}" style="--hc:${h.c}"><div class="hero-art">${img(h.art, h.title)}</div><div class="hero-glass"><div class="hero-k">${h.kind === 'station' ? 'STATION' : 'MIX'}</div><div class="hero-t">${esc(h.title)}</div><div class="hero-s">${esc(h.sub)}</div><button class="hero-play" aria-label="Lire">${icon('play')}</button></div></div>`;
      }).join('');
      body.innerHTML = [
        shelf('Top Picks pour vous', `<div class="shelf-scroll heroes">${heroHtml}</div>`),
        hist.length ? shelf('Récemment écouté', `<div class="shelf-scroll">${hist.slice(0, 14).map((t) => (t.live ? stationCard(t) : histCard(t))).join('')}</div>`, { see: 'library/history' }) : '',
        trend.length ? shelf('Tendances de la semaine', songGrid(trend.slice(0, 24), 'Tendances de la semaine'), { see: 'list/trending/week' }) : '',
        cardShelf(pls, 'Playlists du moment'),
        ...picks.map((g, i) => (genreSets[i]?.length ? shelf(`${GENRES.find((x) => x.id === g)?.name || g}`, songGrid(genreSets[i], g), { see: `genre/${encodeURIComponent(g)}` }) : '')),
        under.length ? shelf('Nouveaux talents', songGrid(under, 'Nouveaux talents'), { see: 'list/underground' }) : '',
        stations.length ? shelf('Radios en direct', `<div class="shelf-scroll">${stations.map(stationCard).join('')}</div>`, { see: 'radio' }) : '',
        !trend.length && !pls.length ? empty('globe', 'Pas de connexion', 'Impossible de charger le catalogue. Vérifiez votre connexion puis réessayez.', '<button class="btn-fill" data-action="reload">Réessayer</button>') : '',
      ].join('');
      hydrateIcons(body);
    },
  };
}

function histCard(t) {
  const k = reg([t], 'Récemment écouté');
  return `<div class="card" data-l="${k}" data-i="0" data-ctx><div class="card-art">${img(t.art, t.id)}</div><div class="card-title">${esc(t.title)}</div><div class="card-sub">${esc(t.artist)}</div></div>`;
}

/* ================= Nouveautés ================= */
export async function browse() {
  return {
    title: 'Nouveautés',
    html: pageHead('Nouveautés') + `<div id="br-body">${skeletonShelf()}</div>`,
    async after(el) {
      const [pls, top, fresh] = await Promise.all([settled(audius.trendingPlaylists(10)), settled(audius.trending({ time: 'month', limit: 30 })), settled(audius.trending({ time: 'week', genre: 'Pop', limit: 20 }))]);
      const b = el.querySelector('#br-body');
      if (!b) return;
      const banners = pls.slice(0, 6).map((p) => `<div class="banner" data-go="col/au/${p.rid}" data-o="${regObj(p)}" data-octx><div class="banner-k">PLAYLIST À LA UNE</div><div class="banner-t">${esc(p.title)}</div><div class="banner-s">${esc(p.artist)}</div><div class="banner-art">${img(p.artLg, p.id)}</div></div>`).join('');
      b.innerHTML = [
        banners ? `<div class="shelf-scroll banners">${banners}</div>` : '',
        top.length ? shelf('Top 100 du mois', trackList(top.slice(0, 10), 'Top 100 du mois', { num: true, art: true }), { see: 'list/trending/month' }) : '',
        shelf('Explorer par genre', `<div class="tiles">${GENRES.map((g) => genreTile(g)).join('')}</div>`),
        fresh.length ? shelf('Pop : à découvrir', songGrid(fresh, 'Pop'), { see: 'genre/Pop' }) : '',
        shelf('Catalogue Apple Music', `<div class="promo" data-go-search="apple"><div class="promo-ic">${icon('search')}</div><div><b>Tous les artistes du monde</b><p>Recherchez dans le catalogue Apple et écoutez les extraits de n'importe quel titre.</p></div>${icon('chevR')}</div>`),
        cardShelf(pls.slice(6), 'Plus de playlists'),
      ].join('');
    },
  };
}

/* ================= Radio ================= */
export async function radioHome() {
  return {
    title: 'Radio',
    html: pageHead('Radio') + `<div class="radio-hero"><div><div class="rh-k">EN DIRECT</div><div class="rh-t">Des milliers de radios, gratuitement</div><div class="rh-s">Infos, hits, jazz, lo-fi… du monde entier.</div></div><div class="rh-ic">${icon('radio')}</div></div><div id="rd-body">${skeletonShelf()}</div>`,
    async after(el) {
      const [local, world] = await Promise.all([settled(radio.byCountry(undefined, 24)), settled(radio.top(24))]);
      const favs = store.favStations();
      const b = el.querySelector('#rd-body');
      if (!b) return;
      b.innerHTML = [
        favs.length ? shelf('Mes radios', `<div class="shelf-scroll">${favs.map(stationCard).join('')}</div>`) : '',
        local.length ? shelf('Populaires près de chez vous', `<div class="shelf-scroll">${local.map(stationCard).join('')}</div>`) : '',
        shelf('Par style', `<div class="tiles">${RADIO_TAGS.map((t, i) => genreTile({ name: t.name, c: GENRES[i % GENRES.length].c }, `radio/tag/${encodeURIComponent(t.tag)}`)).join('')}</div>`),
        world.length ? shelf('Les plus écoutées au monde', trackList(world.slice(0, 20), 'Radios du monde')) : '',
        !local.length && !world.length ? empty('radio', 'Radios indisponibles', 'Le service de radios ne répond pas pour le moment.') : '',
      ].join('');
    },
  };
}

export async function radioTag([tag]) {
  tag = decodeURIComponent(tag);
  const name = RADIO_TAGS.find((t) => t.tag === tag)?.name || tag;
  const list = await settled(radio.byTag(tag, 50));
  return { title: name, html: pageHead(name) + (list.length ? trackList(list, `Radio ${name}`) : empty('radio', 'Aucune radio', 'Rien trouvé pour ce style.')) };
}

/* ================= Bibliothèque ================= */
export async function library() {
  const rows = [
    ['playlists', 'Playlists', 'playlist'], ['artists', 'Artistes', 'mic'], ['albums', 'Albums', 'album'],
    ['songs', 'Morceaux', 'note'], ['favorites', 'Favoris', 'star'], ['stations', 'Radios', 'radio'], ['history', 'Historique', 'timer'],
  ];
  const recent = [
    ...store.playlists().map((p) => ({ t: p.updated, o: { id: p.id, kind: 'lib', title: p.name, artist: `${p.tracks.length} morceaux`, art: p.tracks[0]?.art } })),
    ...store.savedAlbums().map((a) => ({ t: a.saved, o: a.col })),
  ].sort((a, b) => b.t - a.t).slice(0, 12);
  const recentTracks = store.libraryTracks().slice(0, 12);
  return {
    title: 'Bibliothèque',
    html: pageHead('Bibliothèque', profileBtn()) +
      `<div class="menu-list">${rows.map(([r, l, i]) => `<button class="ml-row" data-go="library/${r}"><span class="ml-ic">${icon(i)}</span><span>${l}</span>${icon('chevR', 'chev')}</button>`).join('')}</div>` +
      (recent.length ? shelf('Ajoutés récemment', `<div class="grid-cards">${recent.map((x) => card(x.o)).join('')}</div>`) : '') +
      (recentTracks.length ? shelf('Morceaux ajoutés récemment', trackList(recentTracks, 'Bibliothèque'), { see: 'library/songs' }) : '') +
      (!recent.length && !recentTracks.length ? empty('library', 'Votre bibliothèque est vide', 'Ajoutez des morceaux, albums et playlists avec le bouton + ou en restant appuyé sur un titre.') : ''),
  };
}

const sortBar = (key, cur) => `<div class="seg small" data-sort="${key}">${[['recent', 'Récents'], ['title', 'Titre'], ['artist', 'Artiste']].map(([v, l]) => `<button data-v="${v}" class="${cur === v ? 'on' : ''}">${l}</button>`).join('')}</div>`;
let songSort = 'recent';

export async function librarySub([what, ...rest]) {
  switch (what) {
    case 'songs': {
      let list = store.libraryTracks();
      if (songSort === 'title') list = [...list].sort((a, b) => a.title.localeCompare(b.title, 'fr'));
      if (songSort === 'artist') list = [...list].sort((a, b) => a.artist.localeCompare(b.artist, 'fr'));
      return { title: 'Morceaux', html: pageHead('Morceaux') + (list.length ? collectionButtons(reg(list, 'Bibliothèque')) + sortBar('songs', songSort) + trackList(list, 'Bibliothèque') : empty('note', 'Aucun morceau', 'Les morceaux que vous ajoutez apparaissent ici.')),
        after(el) { el.querySelector('[data-sort]')?.addEventListener('click', (e) => { const b = e.target.closest('[data-v]'); if (b) { songSort = b.dataset.v; ctx.go.refresh(); } }); } };
    }
    case 'favorites': {
      const list = store.favTracks();
      return { title: 'Favoris', html: pageHead('Favoris') + (list.length ? collectionButtons(reg(list.filter((t) => !t.live), 'Favoris')) + trackList(list, 'Favoris') : empty('star', 'Aucun favori', 'Touchez l\'étoile ☆ dans le lecteur pour marquer un morceau comme favori.')) };
    }
    case 'history': {
      const list = store.history();
      return { title: 'Historique', html: pageHead('Historique', list.length ? '<button class="link-btn" data-action="clear-history">Effacer</button>' : '') + (list.length ? trackList(list, 'Historique') : empty('timer', 'Aucune écoute', 'Ce que vous écoutez apparaîtra ici.')) };
    }
    case 'stations': {
      const list = store.favStations();
      return { title: 'Radios', html: pageHead('Radios') + (list.length ? trackList(list, 'Mes radios') : empty('radio', 'Aucune radio', 'Ajoutez une radio en favori avec l\'étoile ☆.', '<button class="btn-fill" data-tab="radio">Parcourir les radios</button>')) };
    }
    case 'artists': {
      const list = store.artists();
      return { title: 'Artistes', html: pageHead('Artistes') + (list.length ? `<div class="list">${list.map((a) => `<button class="row artist-row" data-go="library/artist/${encodeURIComponent(a.name)}"><div class="row-art round">${img(a.art, a.name)}</div><div class="row-main"><div class="row-title">${esc(a.name)}</div><div class="row-sub">${a.tracks.length} morceau${a.tracks.length > 1 ? 'x' : ''}</div></div>${icon('chevR', 'chev')}</button>`).join('')}</div>` : empty('mic', 'Aucun artiste', 'Les artistes de vos morceaux apparaissent ici.')) };
    }
    case 'artist': {
      const name = decodeURIComponent(rest.join('/'));
      const a = store.artists().find((x) => x.name === name);
      const list = a?.tracks || [];
      const link = a?.id ? `<button class="link-btn" data-go="artist/${a.id.slice(0, 2)}/${a.id.slice(3)}">Voir tout ${icon('chevR')}</button>` : '';
      return { title: name, html: pageHead(name, link) + (list.length ? collectionButtons(reg(list, name)) + trackList(list, name) : empty('mic', 'Rien ici', '')) };
    }
    case 'albums': {
      const list = store.savedAlbums();
      return { title: 'Albums', html: pageHead('Albums') + (list.length ? `<div class="grid-cards">${list.map((a) => card(a.col)).join('')}</div>` : empty('album', 'Aucun album', 'Ajoutez un album ou une playlist du catalogue avec le bouton +.')) };
    }
    case 'playlists': {
      const list = store.playlists();
      return {
        title: 'Playlists',
        html: pageHead('Playlists') + `<div class="list"><button class="row" data-action="new-playlist"><div class="row-art plus">${icon('plus')}</div><div class="row-main"><div class="row-title accent">Nouvelle playlist…</div></div></button>${list.map((p) => `<button class="row" data-go="col/lib/${p.id}" data-o="${regObj({ id: p.id, kind: 'lib', title: p.name, artist: '', art: p.tracks[0]?.art })}" data-octx><div class="row-art">${plArt(p)}</div><div class="row-main"><div class="row-title">${esc(p.name)}</div><div class="row-sub">${p.tracks.length} morceau${p.tracks.length > 1 ? 'x' : ''}</div></div>${icon('chevR', 'chev')}</button>`).join('')}</div>`,
      };
    }
    default: return library();
  }
}

export function plArt(p) {
  const arts = [...new Set(p.tracks.map((t) => t.art).filter(Boolean))].slice(0, 4);
  if (arts.length >= 4) return `<div class="mosaic">${arts.map((a) => img(a, a)).join('')}</div>`;
  return img(arts[0], p.id + p.name, '', '');
}

const collectionButtons = (k, extra = '') => `<div class="col-btns"><button class="btn-tint" data-act="play" data-l="${k}">${icon('play')}Lecture</button><button class="btn-tint" data-act="shuffle" data-l="${k}">${icon('shuffle')}Aléatoire</button>${extra}</div>`;

/* ================= Collection (album / playlist) ================= */
export async function collection([src, ...idp]) {
  const id = idp.join('/');
  let col, tracks = [], local = null;
  if (src === 'lib') {
    local = store.playlist(id);
    if (!local) return { title: 'Playlist', html: empty('playlist', 'Playlist introuvable', 'Elle a peut-être été supprimée.') };
    col = { id: local.id, kind: 'lib', title: local.name, artist: store.settings.name || 'Moi', desc: local.desc, art: local.tracks[0]?.artLg || local.tracks[0]?.art };
    tracks = local.tracks;
  } else if (src === 'au') {
    [col, tracks] = await Promise.all([settled(audius.playlist(id), null), settled(audius.playlistTracks(id))]);
  } else if (src === 'ap') {
    const r = await settled(apple.album(id), { album: null, tracks: [] });
    col = r.album; tracks = r.tracks;
  }
  const saved = store.savedAlbums().find((a) => a.col.id === `${src}:${id}`);
  if (!col && saved) { col = saved.col; tracks = saved.tracks; }
  if (!col) return { title: '', html: empty('album', 'Introuvable', 'Impossible de charger cette collection. Vérifiez votre connexion.') };
  const k = reg(tracks, col.title);
  const total = tracks.reduce((s, t) => s + (t.fullDuration || t.duration || 0), 0);
  const isAlbum = col.kind === 'album';
  const inLib = src === 'lib' || store.hasAlbum(col.id);
  const ok = regObj(col);
  const art = src === 'lib' ? `<div class="col-art">${plArt(local)}</div>` : `<div class="col-art">${img(col.artLg || col.art, col.id)}</div>`;
  const meta = [isAlbum ? 'Album' : 'Playlist', col.genre, col.year].filter(Boolean).join(' · ');
  const right = `<div class="head-actions">${src !== 'lib' ? `<button class="circle-btn ${inLib ? 'on' : ''}" data-action="save-col" data-o="${ok}" data-l="${k}" aria-label="Ajouter à la bibliothèque">${icon(inLib ? 'check' : 'plus')}</button>` : `<button class="circle-btn" data-action="edit-playlist" data-id="${col.id}" aria-label="Modifier">${icon('edit')}</button>`}<button class="circle-btn" data-colmore data-o="${ok}" data-l="${k}" aria-label="Plus">${icon('more')}</button></div>`;
  return {
    title: col.title,
    navActions: right,
    html: `<div class="col-head" style="--h:${(col.title || '').length * 37 % 360}">
      ${art}
      <h1 class="col-title">${esc(col.title)}</h1>
      ${col.artistId ? `<button class="col-artist" data-go="artist/${col.artistId.slice(0, 2)}/${col.artistId.slice(3)}">${esc(col.artist)}</button>` : `<div class="col-artist">${esc(col.artist || '')}</div>`}
      <div class="col-meta">${esc(meta)}${col.src === 'apple' ? ' · <span class="tag-p">Extraits 30 s</span>' : ''}</div>
      ${tracks.length ? collectionButtons(k) : ''}
      ${col.desc ? `<p class="col-desc" data-clamp>${esc(col.desc)}</p>` : ''}
    </div>
    ${tracks.length ? `<div class="list ${isAlbum ? 'album-list' : ''}" data-pl="${src === 'lib' ? col.id : ''}">${tracks.map((t, i) => (isAlbum ? albumRow(t, i, k) : null) || rowFor(t, i, k)).join('')}</div>` : (src === 'lib' ? empty('note', 'Playlist vide', 'Ajoutez-y des morceaux depuis n\'importe quel menu « … ».', '<button class="btn-fill" data-tab="search">Rechercher de la musique</button>') : empty('note', 'Aucun morceau lisible', ''))}
    ${tracks.length ? `<div class="col-foot">${tracks.length} morceau${tracks.length > 1 ? 'x' : ''}, ${fmtDuration(total)}${col.link ? ` · <a href="${esc(col.link)}" target="_blank" rel="noopener">Ouvrir dans Apple Music</a>` : ''}</div>` : ''}`,
  };
}

import { trackRow } from './core.js';
const rowFor = (t, i, k) => trackRow(t, i, k);
const albumRow = (t, i, k) => trackRow(t, i, k, { num: true, art: false, sub: '' });

/* ================= Artiste ================= */
export async function artist([src, id]) {
  if (src === 'ap') {
    const r = await settled(apple.artist(id), null);
    if (!r) return { title: '', html: empty('mic', 'Artiste introuvable', '') };
    const { artist: a, albums, songs } = r;
    const k = reg(songs, a.name);
    return {
      title: a.name,
      html: `<div class="artist-hero">${img(a.art, a.name)}<div class="ah-fade"></div><div class="ah-row"><h1>${esc(a.name)}</h1><button class="ah-play" data-act="play" data-l="${k}" aria-label="Lire">${icon('play')}</button></div></div>
        <div class="pad-note">${icon('info')}Catalogue Apple Music : extraits de 30 secondes.</div>
        ${songs.length ? shelf('Top morceaux', songGrid(songs, a.name)) : ''}
        ${cardShelf(albums.filter((x) => x.count > 3), 'Albums')}
        ${cardShelf(albums.filter((x) => x.count <= 3), 'Singles et EP')}`,
    };
  }
  const [a, top, recent, albums, pls] = await Promise.all([settled(audius.user(id), null), settled(audius.userTracks(id, 'plays', 30)), settled(audius.userTracks(id, 'date', 20)), settled(audius.userAlbums(id)), settled(audius.userPlaylists(id))]);
  if (!a) return { title: '', html: empty('mic', 'Artiste introuvable', 'Vérifiez votre connexion.') };
  const k = reg(top, a.name);
  const latest = recent[0];
  return {
    title: a.name,
    html: `<div class="artist-hero">${img(a.cover || a.artLg, a.id)}<div class="ah-fade"></div><div class="ah-row"><h1>${esc(a.name)}${a.verified ? ` <span class="verified">${icon('checkCircle')}</span>` : ''}</h1>${top.length ? `<button class="ah-play" data-act="play" data-l="${k}" aria-label="Lire">${icon('play')}</button>` : ''}</div></div>
      ${latest ? `<div class="latest" data-l="${reg([latest], a.name)}" data-i="0" data-ctx>${img(latest.art, latest.id)}<div><div class="latest-k">DERNIÈRE SORTIE</div><div class="latest-t">${esc(latest.title)}</div><div class="latest-s">${esc(latest.genre)} ${latest.year ? '· ' + latest.year : ''}</div></div><button class="row-more" data-more>${icon('more')}</button></div>` : ''}
      ${top.length ? shelf('Top morceaux', songGrid(top, a.name)) : empty('note', 'Aucun morceau', '')}
      ${cardShelf(albums, 'Albums')}
      ${cardShelf(pls, 'Playlists')}
      ${recent.length > 1 ? shelf('Sorties récentes', songGrid(recent.slice(1), a.name)) : ''}
      ${a.bio || a.location ? shelf(`À propos de ${a.name}`, `<div class="about"><p data-clamp>${esc(a.bio)}</p><div class="about-stats">${a.location ? `<div><b>${esc(a.location)}</b><span>Origine</span></div>` : ''}<div><b>${fmtCount(a.followers)}</b><span>Abonnés</span></div><div><b>${a.tracks}</b><span>Morceaux</span></div></div></div>`) : ''}`,
  };
}

/* ================= Genre & listes ================= */
export async function genre([gid]) {
  gid = decodeURIComponent(gid);
  const g = GENRES.find((x) => x.id === gid) || { name: gid, c: ['#888', '#444'] };
  const [week, month, all] = await Promise.all([settled(audius.trending({ genre: gid, time: 'week', limit: 30 })), settled(audius.trending({ genre: gid, time: 'month', limit: 30 })), settled(audius.trending({ genre: gid, time: 'allTime', limit: 30 }))]);
  return {
    title: g.name,
    html: `<div class="genre-hero" style="--c1:${g.c[0]};--c2:${g.c[1]}"><h1>${esc(g.name)}</h1></div>
      ${week.length ? shelf('En vogue cette semaine', songGrid(week, g.name)) : ''}
      ${month.length ? shelf('Top du mois', trackList(month.slice(0, 15), g.name, { num: true })) : ''}
      ${all.length ? shelf('Incontournables', songGrid(all, g.name)) : ''}
      ${!week.length && !month.length ? empty('note', 'Rien pour le moment', 'Réessayez plus tard.') : ''}`,
  };
}

export async function list([kind, arg]) {
  let title = 'Morceaux', tracks = [];
  if (kind === 'trending') {
    title = arg === 'month' ? 'Top 100 du mois' : arg === 'allTime' ? 'Top 100 de tous les temps' : 'Tendances de la semaine';
    tracks = await settled(audius.trending({ time: arg || 'week', limit: 100 }));
  } else if (kind === 'underground') {
    title = 'Nouveaux talents';
    tracks = await settled(audius.underground(60));
  }
  const k = reg(tracks, title);
  return { title, html: pageHead(title) + (tracks.length ? collectionButtons(k) + trackList(tracks, title, { num: true }) : empty('note', 'Rien à afficher', '')) };
}

/* ================= Recherche ================= */
let scope = 'audius';
let lastQ = '';

export async function search() {
  return {
    title: 'Recherche',
    html: pageHead('Recherche') + `<div class="search-box"><div class="sb-field">${icon('search')}<input id="q" type="search" enterkeyhint="search" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="Artistes, morceaux, paroles, radios…" value="${esc(lastQ)}"><button class="sb-clear" ${lastQ ? '' : 'hidden'} aria-label="Effacer">${icon('x')}</button></div></div>
      <div class="seg" id="scope"><button data-v="audius" class="${scope === 'audius' ? 'on' : ''}">Mélo · complets</button><button data-v="apple" class="${scope === 'apple' ? 'on' : ''}">Apple · extraits</button><button data-v="lib" class="${scope === 'lib' ? 'on' : ''}">Bibliothèque</button></div>
      <div id="sr"></div>`,
    after(el) {
      const inp = el.querySelector('#q');
      const out = el.querySelector('#sr');
      const clear = el.querySelector('.sb-clear');
      let tok = 0;
      const run = async (commit = false) => {
        const q = inp.value.trim();
        lastQ = inp.value;
        clear.hidden = !q;
        const my = ++tok;
        if (!q) { out.innerHTML = browseCats(); hydrateIcons(out); return; }
        if (commit) store.pushSearch(q);
        if (scope === 'lib') { out.innerHTML = libResults(q); return; }
        out.innerHTML = spinner();
        const r = await searchAll(q, scope);
        if (my !== tok) return;
        out.innerHTML = results(r, q);
      };
      const deb = debounce(() => run(false), 320);
      inp.addEventListener('input', deb);
      inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') { inp.blur(); run(true); } });
      inp.addEventListener('blur', () => { if (inp.value.trim()) store.pushSearch(inp.value); });
      clear.addEventListener('click', () => { inp.value = ''; run(); inp.focus(); });
      el.querySelector('#scope').addEventListener('click', (e) => {
        const b = e.target.closest('[data-v]');
        if (!b) return;
        scope = b.dataset.v;
        el.querySelectorAll('#scope button').forEach((x) => x.classList.toggle('on', x === b));
        run();
      });
      out.addEventListener('click', (e) => {
        const r = e.target.closest('[data-recent]');
        if (r) { inp.value = r.dataset.recent; run(true); }
        if (e.target.closest('[data-action="clear-searches"]')) { store.clearSearches(); run(); }
      });
      if (ctx.searchScope) { scope = ctx.searchScope; ctx.searchScope = null; el.querySelectorAll('#scope button').forEach((x) => x.classList.toggle('on', x.dataset.v === scope)); setTimeout(() => inp.focus(), 300); }
      run();
    },
  };
}

function browseCats() {
  const rec = store.data.recentSearches;
  return (rec.length ? `<section class="shelf"><div class="shelf-head"><h2 class="shelf-title">Recherches récentes</h2><button class="link-btn" data-action="clear-searches">Effacer</button></div><div class="list">${rec.map((q) => `<button class="row recent" data-recent="${esc(q)}">${icon('search')}<div class="row-main"><div class="row-title">${esc(q)}</div></div></button>`).join('')}</div></section>` : '') +
    shelf('Parcourir les catégories', `<div class="tiles">${GENRES.map((g) => genreTile(g)).join('')}</div>`);
}

function results(r, q) {
  const { songs, artists, playlists, albums, stations = [] } = r;
  if (!songs.length && !artists.length && !playlists.length && !albums.length && !stations.length) return empty('search', 'Aucun résultat', `Aucun résultat pour « ${q} ». Essayez l'autre catalogue ci-dessus.`);
  const ql = q.toLowerCase();
  const topArtist = artists.find((a) => a.name.toLowerCase() === ql) || (songs[0] && songs[0].artist.toLowerCase().includes(ql) ? null : null);
  let top = '';
  if (topArtist) top = `<div class="top-hit" data-go="artist/${topArtist.id.slice(0, 2)}/${topArtist.id.slice(3)}"><div class="row-art round big">${img(topArtist.art, topArtist.name)}</div><div><div class="th-t">${esc(topArtist.name)}</div><div class="th-s">Artiste</div></div></div>`;
  else if (songs[0]) { const k = reg([songs[0]], 'Recherche'); top = `<div class="top-hit" data-l="${k}" data-i="0" data-ctx><div class="row-art big">${img(songs[0].art, songs[0].id)}</div><div><div class="th-t">${esc(songs[0].title)}</div><div class="th-s">Morceau · ${esc(songs[0].artist)}</div></div><button class="th-play" aria-label="Lire">${icon('play')}</button></div>`; }
  const arts = artists.map((a) => ({ ...a, art: a.art || '' }));
  return [
    shelf('Meilleur résultat', top),
    songs.length ? shelf('Morceaux', trackList(songs, `Recherche « ${q} »`)) : '',
    arts.length ? shelf('Artistes', `<div class="shelf-scroll">${arts.map((a) => card(a, { round: true, sub: a.genre || (a.followers != null ? `${fmtCount(a.followers)} abonnés` : 'Artiste') })).join('')}</div>`) : '',
    cardShelf(albums, 'Albums'),
    cardShelf(playlists, 'Playlists'),
    stations.length ? shelf('Radios', trackList(stations, 'Radios')) : '',
  ].join('');
}

function libResults(q) {
  const ql = q.toLowerCase();
  const songs = store.libraryTracks().filter((t) => `${t.title} ${t.artist} ${t.album || ''}`.toLowerCase().includes(ql));
  const pls = store.playlists().filter((p) => p.name.toLowerCase().includes(ql));
  if (!songs.length && !pls.length) return empty('library', 'Rien dans votre bibliothèque', `Aucun élément ne correspond à « ${q} ».`);
  return (pls.length ? cardShelf(pls.map((p) => ({ id: p.id, kind: 'lib', title: p.name, artist: `${p.tracks.length} morceaux`, art: p.tracks[0]?.art })), 'Playlists') : '') + (songs.length ? shelf('Morceaux', trackList(songs, 'Bibliothèque')) : '');
}
