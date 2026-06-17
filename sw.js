/* ── Planner Service Worker v2.11.0 ── */
/* Safari iOS compatible — explicit skipWaiting only via SKIP_WAITING message */
const APP_VERSION = '2.11.0';
const CACHE_NAME  = 'planner-v' + APP_VERSION;

const PRECACHE = ['./', './index.html'];

/* ── Install ──
   Pre-cache the app shell. Do NOT call skipWaiting() automatically —
   the app will send SKIP_WAITING when the user taps "Update". */
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_NAME)
      .then(c => c.addAll(PRECACHE))
      .catch(() => { /* non-fatal — offline install may fail */ })
  );
});

/* ── Activate ──
   Delete every old cache (any key that isn't this version),
   then claim all open clients so the new SW serves them immediately. */
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys
          .filter(k => k !== CACHE_NAME)
          .map(k => {
            console.log('[SW] Deleting old cache:', k);
            return caches.delete(k);
          })
      ))
      .then(() => {
        console.log('[SW] v' + APP_VERSION + ' activated — claiming clients');
        return self.clients.claim();
      })
  );
});

/* ── Fetch ──
   Safari iOS quirks handled:
   - opaque (no-cors) responses must NOT be cached
   - chrome-extension / non-http must be ignored
   - navigate: network-first → cache shell fallback
   - assets: cache-first → network fallback + update cache
*/
self.addEventListener('fetch', e => {
  const req = e.request;
  const url = new URL(req.url);

  /* Ignore non-http(s) and cross-origin (Firebase, CDN, fonts, APIs) */
  if (!url.protocol.startsWith('http') || url.origin !== self.location.origin) return;

  /* Navigate (HTML page): always try network first so users get latest shell */
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req, { cache: 'no-cache' })
        .then(r => {
          if (r && r.status === 200) {
            /* Update the cache with fresh shell */
            caches.open(CACHE_NAME).then(c => c.put(req, r.clone()));
          }
          return r;
        })
        .catch(() =>
          /* Offline fallback: serve cached shell */
          caches.match(req).then(c => c || caches.match('./'))
        )
    );
    return;
  }

  /* All other same-origin assets: cache-first, network fallback */
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

/* ── Message handler ──
   SKIP_WAITING: app sends this when user taps "Update Now".
   The SW immediately takes control → controllerchange fires → app reloads.

   CLIENTS_CLAIM: optional — app can request the SW to claim all tabs.
*/
self.addEventListener('message', e => {
  if (!e.data) return;

  if (e.data.type === 'SKIP_WAITING') {
    console.log('[SW] skipWaiting called — activating new SW');
    self.skipWaiting();
  }

  if (e.data.type === 'CLIENTS_CLAIM') {
    self.clients.claim();
  }

  /* Version ping — app can ask SW what version it is */
  if (e.data.type === 'GET_VERSION') {
    e.source && e.source.postMessage({ type: 'SW_VERSION', version: APP_VERSION });
  }
});