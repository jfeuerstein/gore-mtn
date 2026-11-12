#!/usr/bin/env node
// Checks that the game can be played with no signal, in a season it has never loaded.
//
//   npm run build && node tools/offline-check.mjs
//
// The game registers its service worker only over https, so the other tools never meet it.
// This one registers it by hand on the preview server, asks it to keep the whole game as the
// game itself does twenty seconds after starting (`keep-all`), waits until every file listed
// in dist/files.json has been kept, then cuts the network and stops the server, and opens the
// game in fall, having only ever loaded winter. It fails if the game does not start, or if a
// picture it has never shown cannot be had.
import { readFileSync } from 'node:fs';
import { preview } from 'vite';
import { launchBrowser } from './browser.mjs';

const files = JSON.parse(readFileSync('dist/files.json', 'utf8'));
const wanted = Object.keys(files).length;
const server = await preview({ preview: { port: 0, host: '127.0.0.1' }, logLevel: 'silent' });
const base = `http://127.0.0.1:${server.httpServer.address().port}/`;
const browser = await launchBrowser();
const context = await browser.newContext({ viewport: { width: 402, height: 874 } });
const page = await context.newPage();
const problems = [];
const check = (name, ok, detail = '') => {
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${detail ? ` (${detail})` : ''}`);
  if (!ok) problems.push(name);
};
let stopped = false;
try {
  await page.goto(`${base}?season=winter&time=midday&weather=clear&intro=0`);
  await page.waitForFunction(() => window.__gore?.ready || window.__gore?.error, null, { timeout: 120000 });
  check('the game starts with a network', !(await page.evaluate(() => window.__gore.error)));
  await page.evaluate(async () => {
    await navigator.serviceWorker.register('sw.js');
    const worker = await navigator.serviceWorker.ready;
    worker.active.postMessage('keep-all');
  });
  const kept = await page
    .waitForFunction(
      async (n) => {
        const cache = await caches.open('gore-v1');
        const note = await cache.match('__kept.json');
        return note ? Object.keys(await note.json()).length >= n : false;
      },
      wanted,
      { timeout: 180000, polling: 1000 },
    )
    .then(() => true)
    .catch(() => false);
  const count = await page.evaluate(async () => (await (await caches.open('gore-v1')).keys()).length);
  check('the worker keeps every file of the game', kept && count >= wanted, `${count} kept of ${wanted} listed`);

  // No signal, and nobody at the other end.
  await context.setOffline(true);
  await server.close();
  stopped = true;
  const offline = await context.newPage();
  const errors = [];
  offline.on('pageerror', (e) => errors.push(e.message));
  await offline.goto(`${base}?season=fall&time=midday&weather=clear&intro=0`).catch((e) => errors.push(e.message));
  await offline.waitForFunction(() => window.__gore?.ready || window.__gore?.error, null, { timeout: 120000 }).catch(() => errors.push('never ready'));
  const state = await offline.evaluate(() => ({ error: window.__gore?.error ?? null, season: window.__gore?.state?.().season })).catch(() => ({ error: 'no page', season: null }));
  check('with no network the game opens in a season it has never loaded', !state.error && state.season === 'fall' && errors.length === 0, state.error ?? errors[0] ?? state.season);
  // Pictures never shown while there was a network: a postcard, a patch, a portrait, the models.
  const had = await offline.evaluate(async (paths) => Promise.all(paths.map((p) => fetch(p).then((r) => r.ok, () => false))), ['art/places/summit.webp', 'art/patches/first-tracks.webp', 'art/people/hazel.webp', 'models/park.json', 'world/ground-summer.png'].filter((p) => p in files));
  check('and has pictures it has never shown', had.length >= 4 && had.every(Boolean), had.join(' '));
} finally {
  await browser.close();
  if (!stopped) await server.close();
}
if (problems.length > 0) {
  console.error(`\n${problems.length} failed: ${problems.join('; ')}`);
  process.exit(1);
}
console.log('\nthe game can be played with no signal');
