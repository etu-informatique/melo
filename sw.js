// Service worker : met l'interface en cache pour un lancement instantané et hors ligne.
// L'audio et les API ne sont jamais mis en cache ici.

const VERSION = 'melo-v11';
const SHELL = [
  './', 'index.html', 'manifest.webmanifest', 'css/app.css',
  'js/app.js', 'js/api.js', 'js/core.js', 'js/jam.js', 'js/player.js', 'js/store.js', 'js/ui.js', 'js/views.js', 'js/yt.js',
  'icons/icon.svg', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/apple-touch-icon.png',
];
const LIBS = [
  'https://unpkg.com/mqtt@5.10.1/dist/mqtt.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/qrcode-generator/1.4.4/qrcode.min.js',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then(async (c) => {
    await c.addAll(SHELL);
    await Promise.all(LIBS.map((u) => c.add(new Request(u, { mode: 'cors' })).catch(() => {})));
  }).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== VERSION).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  const sameOrigin = url.origin === location.origin;
  const isLib = LIBS.includes(req.url) || url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com';
  if (!sameOrigin && !isLib) return; // API, audio, images : réseau direct
  if (req.headers.get('range')) return;

  // Réseau d'abord pour l'interface (mises à jour immédiates), cache en secours.
  if (sameOrigin) {
    // « no-cache » : on revalide auprès du serveur pour ne jamais servir une ancienne version.
    e.respondWith(fetch(req, { cache: 'no-cache' }).then((res) => {
      if (res.ok) { const copy = res.clone(); caches.open(VERSION).then((c) => c.put(req, copy)); }
      return res;
    }).catch(() => caches.match(req, { ignoreSearch: true }).then((r) => r || caches.match('index.html'))));
    return;
  }
  // Bibliothèques et polices : cache d'abord.
  e.respondWith(caches.match(req).then((r) => r || fetch(req).then((res) => {
    const copy = res.clone();
    caches.open(VERSION).then((c) => c.put(req, copy));
    return res;
  })));
});
