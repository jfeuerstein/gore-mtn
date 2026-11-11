#!/usr/bin/env node
// Run the in-game benchmark end to end on an emulated upright phone and check that it finishes
// with a full set of results. Slow (a few minutes in software rendering), so run it when the
// benchmark or frame-timing code changes rather than before every push.
//
//   npm run build && node tools/bench-check.mjs [screenshot.png]
import { preview } from 'vite';
import { devices, launchBrowser } from './browser.mjs';

const shot = process.argv[2];
const STEPS = 13;

const server = await preview({ preview: { port: 0, host: '127.0.0.1' }, logLevel: 'silent' });
const base = `http://127.0.0.1:${server.httpServer.address().port}/`;
const browser = await launchBrowser();
const failures = [];
const check = (label, ok, detail = '') => {
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${label}${detail ? ` (${detail})` : ''}`);
  if (!ok) failures.push(label);
};

try {
  const context = await browser.newContext({ ...devices['iPhone 15 Pro'] });
  const page = await context.newPage();
  page.on('pageerror', (e) => failures.push(`page error: ${e.message}`));
  // A short measuring time keeps this quick; zoom is here to prove the player's own settings come back.
  await page.goto(`${base}?zoom=1.3&benchsecs=0.3&intro=0`);
  await page.waitForFunction(() => window.__gore?.ready, null, { timeout: 120000 });
  await page.tap('#menu-button');
  await page.locator('#menu button', { hasText: 'Run benchmark' }).tap();

  await page.waitForURL(/bench=0/, { timeout: 30000 });
  await page.waitForSelector('#bench-banner', { timeout: 120000 });
  check('banner names the step', (await page.locator('#bench-banner').textContent()).includes(`1 of ${STEPS}`));

  await page.waitForURL(/bench=done/, { timeout: 900000 });
  await page.waitForSelector('#bench-results', { timeout: 120000 });
  const text = await page.locator('#bench-results pre').textContent();
  const lines = text.split('\n');
  const numbered = lines.filter((l) => /^\d+\. /.test(l));
  check('every step reported', numbered.length === STEPS, `${numbered.length} of ${STEPS}`);
  check('each line carries frame, cpu and scene numbers', numbered.every((l) => / fps, p95 .* cpu .* calls, .* tris, \d+ trees/.test(l)));
  check('both renderers were asked for', numbered.some((l) => l.split(' [')[0].includes('WebGL 2')) && numbered.some((l) => !l.split(' [')[0].includes('WebGL 2')));
  check('tree counts differ between steps', new Set(numbered.map((l) => l.match(/(\d+) trees/)[1])).size >= 3);
  check('returns to the player\'s own settings', page.url().includes('zoom=1.3') && !page.url().includes('trees='));
  if (shot) await page.screenshot({ path: shot });
  console.log(text);

  await page.locator('#bench-results button', { hasText: 'Close' }).tap();
  check('closing removes the sheet and the URL flag', !(await page.locator('#bench-results').count()) && !page.url().includes('bench='));
} finally {
  await browser.close();
  await server.close();
}
if (failures.length) console.error(`\n${failures.length} failed: ${failures.join('; ')}`);
process.exit(failures.length ? 1 : 0);
