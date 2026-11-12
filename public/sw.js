// Lets the game start with no signal, as on a chairlift.
//
// Everything is fetched from the network when there is one, so a new version is picked up at
// once and nothing stale is ever shown; each answer is also kept, and served back when the
// network cannot be reached. Only the game's own files are kept: the weather is asked for live
// or not at all.
//
// The game also asks, once it is running, for the rest of itself to be kept (see `keepAll`):
// the seasons not yet visited and the pictures not yet earned, so that a new season or a new
// patch can turn up with no signal.
const CACHE = 'gore-v1';
/** Where the marks of the files already kept are written down, inside the cache. */
const KEPT = '__kept.json';

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

/**
 * Keep a copy of every file of the game. `files.json` (written when the game is built) lists
 * them with a mark of what is in each; only those whose mark has changed since they were last
 * kept are fetched, two at a time, so a new version costs little. If the worker is stopped
 * part way, what was done is remembered and the rest is done next time.
 */
let keeping = null;
async function keepAll() {
  const cache = await caches.open(CACHE);
  const listed = await fetch('files.json', { cache: 'no-store' });
  if (!listed.ok) return;
  const files = await listed.json();
  const before = await cache.match(KEPT);
  const kept = before ? await before.json() : {};
  const wanted = Object.keys(files).filter((path) => kept[path] !== files[path]);
  if (wanted.length === 0) return;
  let since = 0;
  const note = () => cache.put(KEPT, new Response(JSON.stringify(kept), { headers: { 'Content-Type': 'application/json' } }));
  const one = async () => {
    for (let path = wanted.shift(); path !== undefined; path = wanted.shift()) {
      try {
        const url = new URL(path, self.registration.scope).href;
        const response = await fetch(url, { cache: 'no-cache' });
        if (!response.ok) continue;
        await keep(new Request(url), response);
        kept[path] = files[path];
        if (++since % 20 === 0) await note();
      } catch {
        // No signal, or it went: leave the rest for next time.
        return;
      }
    }
  };
  await Promise.all([one(), one()]);
  // Forget marks for files that are no longer part of the game.
  for (const path of Object.keys(kept)) if (!(path in files)) delete kept[path];
  await note();
}

self.addEventListener('message', (event) => {
  if (event.data !== 'keep-all' || keeping) return;
  keeping = keepAll()
    .catch(() => undefined)
    .finally(() => {
      keeping = null;
    });
  event.waitUntil(keeping);
});
