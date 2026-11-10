#!/usr/bin/env node
// Drive the built game with emulated phone touches and check that the controls respond.
//
//   npm run build && node tools/touch-check.mjs [screenshot.png]
//
// Covers what unit tests cannot, on an upright phone: one thumb walks the player and the camera
// swings round behind them, a touch at the top of the screen or a second finger turns the camera,
// the overlay fits the narrow screen, and the settings sheet opens and teleports.
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
const open = async (device) => {
  const context = await browser.newContext({ ...devices[device] });
  const page = await context.newPage();
  page.on('pageerror', (e) => failures.push(`page error: ${e.message}`));
  await page.goto(url);
  await page.waitForFunction(() => window.__gore?.ready || window.__gore?.error, null, { timeout: 120000 });
  return { context, page };
};

try {
  const { context, page } = await open('iPhone 15 Pro');
  check('game starts', !(await page.evaluate(() => window.__gore.error)));
  check('no rotate prompt when upright', !(await page.locator('#rotate').isVisible()));

  const { width, height } = page.viewportSize();
  const box = async (sel) => page.locator(sel).boundingBox();
  const overlap = (a, b) => a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
  // The readouts are hidden until they have something to show; measure the layout once they do.
  await page.waitForFunction(() => document.getElementById('stats').textContent && document.getElementById('where').textContent);
  const boxes = {};
  for (const sel of ['#where', '#stats', '#menu-button', '#fast-button']) boxes[sel] = await box(sel);
  const names = Object.keys(boxes);
  const inside = names.every((n) => boxes[n].x >= 0 && boxes[n].y >= 0 && boxes[n].x + boxes[n].width <= width && boxes[n].y + boxes[n].height <= height);
  check('overlay fits inside the upright screen', inside);
  const clashes = names.flatMap((a, i) => names.slice(i + 1).filter((b) => overlap(boxes[a], boxes[b])).map((b) => `${a}/${b}`));
  check('overlay elements do not overlap', clashes.length === 0, clashes.join(', '));
  check('buttons are at least 44 points tall', boxes['#menu-button'].height >= 44 && boxes['#fast-button'].height >= 44);
  check('fast button sits in the lower, thumb-reach part of the screen', boxes['#fast-button'].y > height * 0.6);

  const cdp = await context.newCDPSession(page);
  const touch = (type, touchPoints) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints });
  const state = () => page.evaluate(() => window.__gore.state());
  const thumb = { x: width * 0.5, y: height * 0.78, id: 1 };
  const top = { x: width * 0.5, y: height * 0.2, id: 2 };

  // One thumb, pushed up and to the right: walks, and the camera follows without being touched.
  let before = await state();
  await touch('touchStart', [thumb]);
  const pushed = { ...thumb, x: thumb.x + 60, y: thumb.y - 40 };
  await touch('touchMove', [pushed]);
  await page.waitForTimeout(2500);
  check('stick appears under the thumb', await page.locator('.stick-base').isVisible());
  let after = await state();
  const moved = Math.hypot(after.x - before.x, after.z - before.z);
  check('one thumb walks the player', moved > 1, `${moved.toFixed(1)} m`);
  check('camera swings round behind the player by itself', Math.abs(after.yaw - before.yaw) > 0.15, `yaw ${(after.yaw - before.yaw).toFixed(2)}`);

  // A second finger turns the camera while the thumb keeps walking.
  before = after;
  await touch('touchStart', [pushed, top]);
  await touch('touchMove', [pushed, { ...top, x: top.x - 120, y: top.y + 40 }]);
  await page.waitForTimeout(300);
  if (shot) await page.screenshot({ path: shot });
  after = await state();
  check('second finger turns the camera', after.yaw - before.yaw > 0.4, `yaw ${(after.yaw - before.yaw).toFixed(2)}`);
  check('second finger tilts the camera', Math.abs(after.pitch - before.pitch) > 0.05);
  await touch('touchEnd', []);
  await page.waitForTimeout(300);
  check('stick hides on release', !(await page.locator('.stick-base').isVisible()));
  const still = await state();
  await page.waitForTimeout(400);
  const later = await state();
  check('player stops when the thumb lifts', Math.hypot(later.x - still.x, later.z - still.z) < 0.01);

  // A touch that starts at the top of the screen turns the camera and never becomes a stick.
  await touch('touchStart', [top]);
  await touch('touchMove', [{ ...top, x: top.x + 90 }]);
  await page.waitForTimeout(200);
  const looked = await state();
  check('touch at the top turns the camera', looked.yaw - later.yaw < -0.3, `yaw ${(looked.yaw - later.yaw).toFixed(2)}`);
  check('touch at the top does not show the stick', !(await page.locator('.stick-base').isVisible()));
  await touch('touchEnd', []);

  // Fast toggle.
  await page.tap('#fast-button');
  check('fast button latches on', (await page.getAttribute('#fast-button', 'aria-pressed')) === 'true');
  const slowStart = await state();
  await touch('touchStart', [thumb]);
  await touch('touchMove', [{ ...thumb, y: thumb.y - 70 }]);
  await page.waitForTimeout(1000);
  await touch('touchEnd', []);
  const fastEnd = await state();
  const fastMoved = Math.hypot(fastEnd.x - slowStart.x, fastEnd.z - slowStart.z);
  check('fast travel covers ground quickly', fastMoved > moved * 1.5, `${fastMoved.toFixed(1)} m in 1 s`);
  await page.tap('#fast-button');

  // Settings sheet.
  await page.tap('#menu-button');
  check('settings sheet opens', await page.locator('#menu').isVisible());
  const sheet = await box('#menu');
  check('settings sheet spans the bottom of the screen', sheet.width >= width - 1 && Math.abs(sheet.y + sheet.height - height) < 2);
  await page.locator('#menu button', { hasText: 'Saddle Lodge' }).tap();
  await page.waitForTimeout(600);
  const there = await state();
  check('teleport moves the player up the mountain', there.y > fastEnd.y + 50, `y ${there.y.toFixed(0)}`);
  check('settings sheet closes after teleport', !(await page.locator('#menu').isVisible()));
  console.log(`     label at Saddle Lodge: ${await page.locator('#where').textContent()}`);
  await context.close();

  const sideways = await open('iPhone 15 Pro landscape');
  check('phone held sideways is asked to turn upright', await sideways.page.locator('#rotate').isVisible());
  await sideways.context.close();
} finally {
  await browser.close();
  await server.close();
}
if (failures.length) console.error(`\n${failures.length} failed: ${failures.join('; ')}`);
process.exit(failures.length ? 1 : 0);
