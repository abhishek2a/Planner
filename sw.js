/* ── Planner Service Worker v2.9.5 ── */
/* Safari iOS compatible — no auto skipWaiting */
const APP_VERSION = '2.9.5';
const CACHE_NAME  = 'planner-v' + APP_VERSION;

const PRECACHE = ['./', './index.html'];

/* ── Install ── */
self.addEventListener('install', e => {
  /* Do NOT call skipWaiting() — wait for explicit user action */
  e.waitUntil(
    caches.open(CACHE_NAME)
      .then(c => c.addAll(PRECACHE))
      .catch(() => { /* non-fatal */ })
  );
});

/* ── Activate: wipe old caches, claim clients ── */
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

/* ── Fetch ──
   Safari iOS quirks:
   - opaque (no-cors) responses must NOT be cached
   - chrome-extension / non-http must be ignored
   - navigate: network-first, cache fallback
*/
self.addEventListener('fetch', e => {
  const req = e.request;
  const url = new URL(req.url);

  /* Ignore non-http(s) and cross-origin (Firebase, CDN, fonts, APIs) */
  if (!url.protocol.startsWith('http') || url.origin !== self.location.origin) return;

  /* Navigate (HTML): network-first, no-cache header, fallback to shell */
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req, { cache: 'no-cache' })
        .then(r => {
          if (r && r.status === 200) {
            caches.open(CACHE_NAME).then(c => c.put(req, r.clone()));
          }
          return r;
        })
        .catch(() =>
          caches.match(req).then(c => c || caches.match('./'))
        )
    );
    return;
  }

  /* Other same-origin assets: cache-first, network fallback */
  e.respondWith(
    caches.match(req).then(cached => {
      if (cached) return cached;
      return fetch(req).then(r => {
        /* Only cache valid, non-opaque same-origin responses */
        if (r && r.status === 200 && r.type === 'basic') {
          caches.open(CACHE_NAME).then(c => c.put(req, r.clone()));
        }
        return r;
      });
    })
  );
});

/* ── Message: manual skipWaiting trigger from app ── */
self.addEventListener('message', e => {
  if (e.data && e.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
