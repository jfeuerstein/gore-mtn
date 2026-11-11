#!/usr/bin/env node
// The only check of the WebGPU rendering path that can run off the phone.
//
//   npm run build && node tools/webgpu-smoke.mjs ["trees=20000"]
//
// Headless Chromium here can start WebGPU but cannot present it (see tools/browser.mjs): a moment
// after the first frames it destroys the device, and whatever the game does next fails. So this
// loads the game, lets it draw what it can through the WebGPU backend, and fails if three.js
// reports a shader or pipeline error, or if not even one whole frame was drawn before the device
// went. Errors after the device has gone are this environment's, not the game's, and are only
// printed. It cannot show what the frames look like.
import { preview } from 'vite';
import { launchBrowser } from './browser.mjs';

// Winter is the plain path; fall also dresses each tree in its own colour.
const queries = process.argv[2] ? [process.argv[2]] : ['season=winter&trees=20000&view=900&intro=0', 'season=fall&trees=20000&view=900&intro=0', 'season=summer&zoo=1&trees=20000&view=900&intro=0', 'season=winter&look=plain&models=blocks&trees=20000&view=900&intro=0'];
const server = await preview({ preview: { port: 0, host: '127.0.0.1' }, logLevel: 'silent' });
const browser = await launchBrowser({ webgpu: true });
const allProblems = [];
for (const query of queries) {
const problems = [];
let frames = 0;
let backend = '';
let stones = 0;
let error = null;
/** Frames drawn when the device was lost, or null if it never was. */
let lostAfter = null;
{
  const page = await browser.newPage({ viewport: { width: 402, height: 874 } });
  const note = (text) => {
    // Expected here: the instance is dropped once Chromium fails to present the canvas.
    // three.js also reports the loss itself, when it hears of it in time. The loss is recorded
    // separately below (`lostAfter`), so its announcement is not a shader or pipeline problem.
    if (/Instance dropped|WebGPU Device Lost|external Instance reference/.test(text)) return;
    if (/pipeline|shader|WGSL|WebGPU|validation|GPUValidationError/i.test(text)) problems.push(text.slice(0, 400));
  };
  page.on('console', (m) => {
    if (m.type() === 'error' || m.type() === 'warning') note(m.text());
  });
  page.on('pageerror', (e) => note(e.message));
  // Note when the device is lost, in frames drawn, so later errors can be told from earlier ones.
  await page.addInitScript(() => {
    window.__gpuLostAfter = null;
    if (typeof GPUAdapter === 'undefined') return;
    const request = GPUAdapter.prototype.requestDevice;
    GPUAdapter.prototype.requestDevice = async function (...args) {
      const device = await request.apply(this, args);
      void device.lost.then(() => {
        window.__gpuLostAfter = window.__gore?.state?.().frames ?? 0;
      });
      return device;
    };
  });
  await page.goto(`http://127.0.0.1:${server.httpServer.address().port}/?${query}`);
  await page.waitForFunction(() => window.__gore?.ready || window.__gore?.error, null, { timeout: 120000 });
  await page.waitForTimeout(300);
  ({ frames, backend, stones, error, lostAfter } = await page.evaluate(() => {
    const state = window.__gore.state();
    return { frames: state.frames, backend: state.backend, stones: state.finds?.length ?? 0, error: window.__gore.error, lostAfter: window.__gpuLostAfter };
  }));
  await page.close();
}
console.log(`${query}: backend ${backend}, ${frames} frames drawn, ${stones} stones on show`);
if (backend !== 'WebGPU') problems.push(`expected the WebGPU backend, got ${backend || 'none'}`);
if (lostAfter === null) {
  // The device held, so the game should simply have run.
  if (error) problems.push(`the game stopped: ${error.split('\n')[0]}`);
  if (frames < 3) problems.push('fewer than three frames were drawn');
} else {
  console.log(`     this browser destroyed its WebGPU device after ${lostAfter} frame(s), as expected here`);
  if (error) console.log(`     and the game then stopped, as it must: ${error.split('\n')[0].slice(0, 160)}`);
  if (lostAfter < 1) problems.push('the WebGPU device was lost before a single frame was drawn');
}
for (const p of problems) console.error(`FAIL ${p}`);
allProblems.push(...problems);
}
await browser.close();
await server.close();
console.log(allProblems.length ? `${allProblems.length} problem(s)` : 'ok   first frames drew through WebGPU with no shader or pipeline errors');
process.exit(allProblems.length ? 1 : 0);
