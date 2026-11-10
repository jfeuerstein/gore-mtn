#!/usr/bin/env node
// Drive the built game with emulated phone touches and check that the controls respond.
//
//   npm run build && node tools/touch-check.mjs [screenshot.png]
//
// Covers what unit tests cannot: the left-thumb stick walks the player, a right-thumb drag turns
// the camera at the same time, and the settings menu opens and teleports.
import { createRequire } from 'node:module';
import { preview } from 'vite';

const { chromium, devices } = createRequire(import.meta.url)('playwright');
const shot = process.argv[2];

const server = await preview({ preview: { port: 0, host: '127.0.0.1' }, logLevel: 'silent' });
const url = `http://127.0.0.1:${server.httpServer.address().port}/?trees=2000`;
const browser = await chromium.launch({
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});
const failures = [];
const check = (label, ok, detail = '') => {
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${label}${detail ? ` (${detail})` : ''}`);
  if (!ok) failures.push(label);
};

try {
  const context = await browser.newContext({ ...devices['iPhone 15 Pro landscape'] });
  const page = await context.newPage();
  page.on('pageerror', (e) => failures.push(`page error: ${e.message}`));
  await page.goto(url);
  await page.waitForFunction(() => window.__gore?.ready || window.__gore?.error, null, { timeout: 120000 });
  check('game starts', !(await page.evaluate(() => window.__gore.error)));
  check('no rotate prompt in landscape', !(await page.locator('#rotate').isVisible()));

  const cdp = await context.newCDPSession(page);
  const touch = (type, touchPoints) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints });
  const state = () => page.evaluate(() => window.__gore.state());
  const { width, height } = page.viewportSize();
  const left = { x: width * 0.18, y: height * 0.7, id: 1 };
  const right = { x: width * 0.7, y: height * 0.5, id: 2 };

  const before = await state();
  await touch('touchStart', [left]);
  const pushed = { ...left, y: left.y - 70 };
  await touch('touchMove', [pushed]);
  await page.waitForTimeout(1500);
  check('stick appears under the left thumb', await page.locator('.stick-base').isVisible());

  await touch('touchStart', [pushed, right]);
  await touch('touchMove', [pushed, { ...right, x: right.x + 100, y: right.y + 30 }]);
  await page.waitForTimeout(500);
  if (shot) await page.screenshot({ path: shot });
  await touch('touchEnd', []);
  await page.waitForTimeout(300);

  const after = await state();
  const moved = Math.hypot(after.x - before.x, after.z - before.z);
  check('left stick walks the player', moved > 1, `${moved.toFixed(1)} m`);
  check('right drag turns the camera', Math.abs(after.yaw - before.yaw) > 0.3, `yaw ${(after.yaw - before.yaw).toFixed(2)}`);
  check('right drag tilts the camera', Math.abs(after.pitch - before.pitch) > 0.05);
  check('stick hides on release', !(await page.locator('.stick-base').isVisible()));

  const still = await state();
  await page.waitForTimeout(400);
  const later = await state();
  check('player stops when the thumb lifts', Math.hypot(later.x - still.x, later.z - still.z) < 0.01);

  await page.tap('#menu-button');
  check('settings menu opens', await page.locator('#menu').isVisible());
  await page.locator('#menu button', { hasText: 'Saddle Lodge' }).tap();
  await page.waitForTimeout(600);
  const there = await state();
  check('teleport moves the player up the mountain', there.y > after.y + 50, `y ${there.y.toFixed(0)}`);
  console.log(`     label at Saddle Lodge: ${await page.locator('#where').textContent()}`);
} finally {
  await browser.close();
  await server.close();
}
if (failures.length) console.error(`\n${failures.length} failed: ${failures.join('; ')}`);
process.exit(failures.length ? 1 : 0);
