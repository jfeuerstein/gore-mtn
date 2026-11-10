#!/usr/bin/env node
// The only check of the WebGPU rendering path that can run off the phone.
//
//   npm run build && node tools/webgpu-smoke.mjs ["trees=20000"]
//
// Headless Chromium here can start WebGPU but cannot present it (see tools/browser.mjs), so this
// loads the game, lets it draw its first frames through the WebGPU backend, and fails if three.js
// reports a shader or pipeline error while doing so. It cannot show what the frames look like.
import { preview } from 'vite';
import { launchBrowser } from './browser.mjs';

const query = process.argv[2] ?? 'trees=20000&view=900';
const server = await preview({ preview: { port: 0, host: '127.0.0.1' }, logLevel: 'silent' });
const browser = await launchBrowser({ webgpu: true });
const problems = [];
let frames = 0;
let backend = '';
try {
  const page = await browser.newPage({ viewport: { width: 402, height: 874 } });
  const note = (text) => {
    // Expected here: the instance is dropped once Chromium fails to present the canvas.
    if (/Instance dropped/.test(text)) return;
    if (/pipeline|shader|WGSL|WebGPU|validation|GPUValidationError/i.test(text)) problems.push(text.slice(0, 400));
  };
  page.on('console', (m) => {
    if (m.type() === 'error' || m.type() === 'warning') note(m.text());
  });
  page.on('pageerror', (e) => note(e.message));
  await page.goto(`http://127.0.0.1:${server.httpServer.address().port}/?${query}`);
  await page.waitForFunction(() => window.__gore?.ready || window.__gore?.error, null, { timeout: 120000 });
  ({ frames, backend } = await page.evaluate(() => window.__gore.state()));
  await page.waitForTimeout(300);
} finally {
  await browser.close();
  await server.close();
}
console.log(`backend ${backend}, ${frames} frames drawn before the check ended`);
if (backend !== 'WebGPU') problems.push(`expected the WebGPU backend, got ${backend || 'none'}`);
if (frames < 3) problems.push('fewer than three frames were drawn');
for (const p of problems) console.error(`FAIL ${p}`);
console.log(problems.length ? `${problems.length} problem(s)` : 'ok   first frames drew through WebGPU with no shader or pipeline errors');
process.exit(problems.length ? 1 : 0);
