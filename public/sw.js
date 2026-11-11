// Lets the game start with no signal, as on a chairlift.
//
// Everything is fetched from the network when there is one, so a new version is picked up at
// once and nothing stale is ever shown; each answer is also kept, and served back when the
// network cannot be reached. Only the game's own files are kept: the weather is asked for live
// or not at all.
const CACHE = 'gore-v1';

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((names) => Promise.all(names.filter((n) => n !== CACHE).map((n) => caches.delete(n))))
      .then(() => self.clients.claim()),
  );
});

/** Keep an answer, and drop older builds of the same file so the store does not grow with every release. */
async function keep(request, response) {
  const cache = await caches.open(CACHE);
  await cache.put(request, response);
  const built = /\/assets\/([a-z]+)-[^/]+\.(js|css)$/i.exec(new URL(request.url).pathname);
  if (!built) return;
  for (const old of await cache.keys()) {
    const other = /\/assets\/([a-z]+)-[^/]+\.(js|css)$/i.exec(new URL(old.url).pathname);
    if (other && other[1] === built[1] && other[2] === built[2] && old.url !== request.url) await cache.delete(old);
  }
}

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) return;
  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response.ok) event.waitUntil(keep(request, response.clone()));
        return response;
      })
      // Offline. The page itself is the same whatever options follow it in the address.
      .catch(() => caches.match(request, { ignoreSearch: request.mode === 'navigate' }).then((hit) => hit ?? Response.error())),
  );
});
