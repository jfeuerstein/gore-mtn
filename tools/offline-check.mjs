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
/** Things never shown in a first minute of winter: a postcard, a patch, a portrait, the models, another season's ground. */
const SAMPLES = ['art/places/fire-tower.webp', 'art/patches/first-tracks.webp', 'art/people/hazel.webp', 'models/park.json', 'world/ground-summer.png'];
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
    window.__kept = null;
    navigator.serviceWorker.addEventListener('message', (event) => (window.__kept = event.data));
    await navigator.serviceWorker.register('sw.js');
    const worker = await navigator.serviceWorker.ready;
    worker.active.postMessage('keep-all');
  });
  // The worker says when it has done; give it three minutes, on a slow machine.
  let waitError = '';
  const kept = await page
    .waitForFunction(() => window.__kept !== null, null, { timeout: 180000, polling: 500 })
    .then(() => true)
    .catch((e) => {
      waitError = String(e.message).split('\n')[0];
      return false;
    });
  const count = await page.evaluate(async () => (await (await caches.open('gore-v1')).keys()).length);
  const said = await page.evaluate(() => window.__kept);
  check('the worker keeps every file of the game', kept && said?.kept === true && count >= wanted, `${count} kept of ${wanted} listed${said?.failed ? `: ${said.failed}` : ''}${waitError ? `: ${waitError}` : ''}`);

  // No signal, and nobody at the other end.
  await context.setOffline(true);
  await server.close();
  stopped = true;
  const offline = await context.newPage();
  const errors = [];
  offline.on('pageerror', (e) => errors.push(e.message));
  const said2 = [];
  offline.on('console', (m) => said2.push(`${m.type()}: ${m.text().slice(0, 200)}`));
  offline.on('requestfailed', (r) => said2.push(`failed: ${r.url().slice(-60)}`));
  await offline.goto(`${base}?season=fall&time=midday&weather=clear&intro=0`).catch((e) => errors.push(e.message));
  await offline.waitForFunction(() => window.__gore?.ready || window.__gore?.error, null, { timeout: 240000 }).catch(() => errors.push('never ready'));
  const state = await offline.evaluate(() => ({ error: window.__gore?.error ?? null, season: window.__gore?.state?.().season })).catch(() => ({ error: 'no page', season: null }));
  check('with no network the game opens in a season it has never loaded', !state.error && state.season === 'fall' && errors.length === 0, state.error ?? errors[0] ?? state.season);
  if (problems.length > 0) console.log(said2.slice(0, 25).join('\n'), await offline.evaluate(() => document.getElementById('loading')?.textContent?.slice(0, 200)));
  // Pictures never shown while there was a network: a postcard, a patch, a portrait, the models.
  const had = await offline.evaluate(async (paths) => Promise.all(paths.map((p) => fetch(p).then((r) => r.ok, () => false))), SAMPLES);
  check('and has pictures it has never shown', SAMPLES.every((p) => p in files) && had.length === SAMPLES.length && had.every(Boolean), SAMPLES.map((p, i) => `${p.split('/').pop()}:${p in files ? had[i] : 'not in the game'}`).join(' '));
} finally {
  await browser.close();
  if (!stopped) await server.close();
}
if (problems.length > 0) {
  console.error(`\n${problems.length} failed: ${problems.join('; ')}`);
  process.exit(1);
}
console.log('\nthe game can be played with no signal');
