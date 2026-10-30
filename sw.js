// Hält die App offline verfügbar. Nach jeder Änderung an den Dateien die Versionsnummer erhöhen,
// damit das iPhone die neue Version lädt.
const CACHE = 'golf-tagebuch-v6';
const FILES = [
  './',
  'index.html',
  'platzdaten.js',
  'app.js',
  'styles.css',
  'manifest.webmanifest',
  'icons/icon-180.png',
  'icons/icon-192.png',
  'icons/icon-512.png',
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (url.origin !== self.location.origin || e.request.method !== 'GET') return; // Wetter immer live
  e.respondWith(
    caches.match(e.request, { ignoreSearch: true })
      .then(hit => hit || fetch(e.request).catch(() => caches.match('index.html')))
  );
});
