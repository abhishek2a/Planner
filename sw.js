/* ── Planner Service Worker ── */
const APP_VERSION = '2.9.3';
const CACHE_NAME  = 'planner-v' + APP_VERSION;

/* Core shell to pre-cache */
const PRECACHE = [
  './',
  './index.html'
];

/* ── Install: pre-cache shell ── */
self.addEventListener('install', e => {
  /* Do NOT skipWaiting automatically — wait for manual trigger */
  e.waitUntil(
    caches.open(CACHE_NAME).then(c => c.addAll(PRECACHE)).catch(() => {})
  );
});

/* ── Activate: delete old caches ── */
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

/* ── Fetch: network-first for HTML, cache-first for assets ── */
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);

  /* Skip cross-origin (Firebase, Google Fonts, CDN) */
  if (url.origin !== location.origin) return;

  /* HTML: network-first so fresh updates are available */
  if (e.request.mode === 'navigate') {
    e.respondWith(
      fetch(e.request)
        .then(r => { caches.open(CACHE_NAME).then(c => c.put(e.request, r.clone())); return r; })
        .catch(() => caches.match(e.request))
    );
    return;
  }

  /* Other assets: cache-first */
  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) return cached;
      return fetch(e.request).then(r => {
        if (r && r.status === 200) {
          caches.open(CACHE_NAME).then(c => c.put(e.request, r.clone()));
        }
        return r;
      });
    })
  );
});

/* ── Message: manual skipWaiting trigger ── */
self.addEventListener('message', e => {
  if (e.data && e.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
