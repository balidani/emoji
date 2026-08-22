// Offline cache for the static, no-build ES-module site (see
// OFFLINE_DESIGN.md Phase 2). Deliberately has no precache manifest: the
// catalog eagerly imports every symbol source on the first loadSettings()
// call (see src/catalog.js), and sim/harness.js's static imports are pulled
// in at boot too, so a single online session already requests the entire
// runtime module graph -- cache-on-fetch below warms all of it in one go.
// Bump CACHE_VERSION to invalidate everything cached under a previous one.
const CACHE_VERSION = 3;
const CACHE_NAME = `emoji-v${CACHE_VERSION}`;

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys();
      await Promise.all(
        names
          .filter((name) => name.startsWith('emoji-v') && name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      );
      await self.clients.claim();
    })()
  );
});

// Lets a client-side "Update available" prompt (Phase 3, src/main.js) hand
// control to the new worker on the player's own schedule, instead of this
// worker yanking assets out from under an in-progress game the moment it
// finishes installing.
self.addEventListener('message', (event) => {
  if (event.data === 'skipWaiting') {
    self.skipWaiting();
  }
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') {
    return;
  }
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) {
    return;
  }
  if (request.mode === 'navigate') {
    event.respondWith(staleWhileRevalidate(event));
  } else {
    event.respondWith(cacheFirst(request));
  }
});

// Static assets (src/**.js, style.css, thumb.png, ...): serve the cached
// copy instantly if we have one, otherwise fetch and store it for next time.
async function cacheFirst(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request);
  if (cached) {
    return cached;
  }
  const response = await fetch(request);
  if (response.ok) {
    cache.put(request, response.clone());
  }
  return response;
}

// Navigations (index.html, simulator/index.html): serve the cached page
// immediately so a reload never blocks on the network, while a background
// fetch freshens the cache for the next load.
async function staleWhileRevalidate(event) {
  const { request } = event;
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request);
  const revalidate = fetch(request)
    .then((response) => {
      if (response.ok) {
        cache.put(request, response.clone());
      }
      return response;
    })
    .catch(() => null);
  event.waitUntil(revalidate);
  if (cached) {
    return cached;
  }
  const fresh = await revalidate;
  if (fresh) {
    return fresh;
  }
  throw new Error('Navigation request failed and nothing is cached yet.');
}
