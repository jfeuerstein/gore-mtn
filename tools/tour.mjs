#!/usr/bin/env node
// Look at many things in one go: loads the built game once, then stands the player in front of
// each stop in turn and takes a picture. Far quicker than a fresh page for every picture.
//
//   npm run build && node tools/tour.mjs <out-prefix> "<query>" place:cafe person:tom pos:2114,-1906,2.4 ...
//
// A `place:` is one of the town's named places (seen from across the street), a `person:` is
// someone to talk to (seen face on, from the south: add me=0 to the query so the player's own
// figure is not in the way), a `secret:` is one of the mountain's secrets by id (seen from in
// front), a `roamer:` is someone who is somewhere different every day, a `run:` is the top of
// an unmarked run (run-1), and a `pos:` is x,z,yaw.
// Pictures are saved as <out-prefix>-<n>.png, 402 x 600, with the HUD off.
import { preview } from 'vite';
import { launchBrowser } from './browser.mjs';

const [prefix = 'tour', query = '', ...stops] = process.argv.slice(2);
const params = new URLSearchParams(query);
for (const [k, v] of [['season', 'winter'], ['intro', '0'], ['time', 'midday'], ['weather', 'clear'], ['hud', '0'], ['pitch', '0.1']]) if (!params.has(k)) params.set(k, v);
const server = await preview({ preview: { port: 0, host: '127.0.0.1' }, logLevel: 'silent' });
const browser = await launchBrowser();
const page = await browser.newPage({ viewport: { width: 402, height: 600 } });
page.on('pageerror', (e) => console.error(`[page error] ${e.message}`));
await page.goto(`http://127.0.0.1:${server.httpServer.address().port}/?${params}`);
await page.waitForFunction(() => window.__gore?.ready || window.__gore?.error, null, { timeout: 120000 });
let n = 0;
for (const stop of stops) {
  const [kind, what] = [stop.slice(0, stop.indexOf(':')), stop.slice(stop.indexOf(':') + 1)];
  const ok = await page.evaluate(
    ([kind, what]) => {
      const g = window.__gore;
      const state = g.state();
      const lookAt = (px, pz, tx, tz) => {
        g.place(px, pz);
        const s = g.state();
        g.face(Math.atan2(-(tx - s.x), -(tz - s.z)));
      };
      if (kind === 'place') {
        const p = state.town.find((t) => t.id === what);
        if (!p) return false;
        const back = p.d / 2 + 13;
        lookAt(p.x + Math.sin(p.turn) * back, p.z + Math.cos(p.turn) * back, p.x, p.z);
      } else if (kind === 'person') {
        const p = state.people.find((t) => t.id === what);
        if (!p) return false;
        // Just behind them, with the camera to their south: with me=0 the picture is of them, face on.
        g.place(p.x, p.z - 0.45);
        g.face(0);
      } else if (kind === 'secret' || kind === 'roamer' || kind === 'run') {
        // One of the mountain's secrets, seen from in front of it; someone who roams, from a few steps south; the top of an unmarked run.
        const p = kind === 'run' ? state.runs.map((r) => ({ id: r.id, x: r.top[0], z: r.top[1] })).find((t) => t.id === what) : (kind === 'secret' ? state.secrets : state.roamers).find((t) => t.id === what);
        if (!p) return false;
        const turn = p.turn ?? 0;
        const back = kind === 'roamer' ? 6 : 9;
        lookAt(p.x + Math.sin(turn) * back, p.z + Math.cos(turn) * back, p.x, p.z);
      } else {
        const [x, z, yaw] = what.split(',').map(Number);
        g.place(x, z);
        g.face(yaw);
      }
      return true;
    },
    [kind, what],
  );
  if (!ok) {
    console.error(`no such stop: ${stop}`);
    continue;
  }
  // Let the surroundings build and people turn to look.
  await page.waitForFunction((f) => window.__gore.state().frames > f + 6, await page.evaluate(() => window.__gore.state().frames), { timeout: 120000 });
  await page.waitForTimeout(700);
  n++;
  await page.screenshot({ path: `${prefix}-${n}.png`, timeout: 180000 });
  console.log(`${prefix}-${n}.png ${stop}`);
}
await browser.close();
await server.close();
