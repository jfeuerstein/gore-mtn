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

/** Keep an answer. */
async function keep(request, response) {
  const cache = await caches.open(CACHE);
  await cache.put(request, response);
}

/** How long a page is waited for before the kept copy is shown instead, in milliseconds: a weak signal is worse than none. */
const PATIENCE = 4000;

/** The kept copy of the page, whatever options follow it in the address. */
function keptPage(request) {
  return caches.match(request, { ignoreSearch: true, ignoreVary: true }).then((hit) => hit ?? caches.match(new URL('index.html', self.registration.scope).href));
}

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) return;
  if (request.mode === 'navigate') {
    // The page. It is asked for from the network, but not waited on for long, and it is never
    // kept from here: a new page names a new script, and must not be kept before that script
    // has been. `keepAll` keeps the page last, once everything it names is in hand.
    event.respondWith(
      (async () => {
        const kept = await keptPage(request);
        const fresh = fetch(request);
        if (!kept) return fresh;
        const waited = new Promise((resolve) => setTimeout(() => resolve(null), PATIENCE));
        const answer = await Promise.race([fresh.catch(() => null), waited]);
        return answer && answer.ok ? answer : kept;
      })(),
    );
    return;
  }
  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response.ok) event.waitUntil(keep(request, response.clone()));
        return response;
      })
      // Offline. A copy is a copy whoever asked for it: the page asks for its script one way and
      // the worker fetched it another, and a server's Vary header must not come between them.
      .catch(() => caches.match(request, { ignoreVary: true }).then((hit) => hit ?? Response.error())),
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
  // The page goes last: it is only kept once every file it names has been.
  const wanted = Object.keys(files)
    .filter((path) => kept[path] !== files[path])
    .sort((a, b) => Number(a === 'index.html') - Number(b === 'index.html'));
  if (wanted.length === 0) return;
  const page = wanted[wanted.length - 1] === 'index.html' ? wanted.pop() : null;
  let since = 0;
  let failed = null;
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
      } catch (error) {
        // No signal, or it went: leave the rest for next time.
        failed = String(error);
        return;
      }
    }
  };
  await Promise.all([one(), one()]);
  if (!failed && page) {
    wanted.push(page);
    await one();
  }
  if (!failed) {
    // Everything of this version is in hand, the page included: now what belonged only to an
    // older version can go, and not before, since until now the older page still needed it.
    const scope = self.registration.scope;
    for (const old of await cache.keys()) {
      const url = new URL(old.url);
      const path = url.href.startsWith(scope) ? url.pathname.slice(new URL(scope).pathname.length) : null;
      if (path !== null && path !== KEPT && !(path in files)) await cache.delete(old);
    }
    for (const path of Object.keys(kept)) if (!(path in files)) delete kept[path];
  }
  await note();
  return failed;
}

self.addEventListener('message', (event) => {
  if (event.data !== 'keep-all' || keeping) return;
  keeping = keepAll()
    .catch((error) => String(error))
    // Say how it went to whoever asked: the tools listen, the game does not.
    .then((failed) => event.source?.postMessage({ kept: !failed, failed: failed ?? null }))
    .finally(() => {
      keeping = null;
    });
  event.waitUntil(keeping);
});
