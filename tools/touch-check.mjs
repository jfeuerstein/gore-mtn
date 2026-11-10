#!/usr/bin/env node
// Drive the built game with emulated phone touches and check that the controls respond.
//
//   npm run build && node tools/touch-check.mjs [screenshot.png]
//
// Covers what unit tests cannot, on an upright phone: one thumb walks the player and the camera
// swings round behind them, a touch at the top of the screen or a second finger turns the camera,
// the overlay fits the narrow screen, the settings sheet opens and teleports, and on skis the
// thumb steers, tucks and brakes while the slope does the rest.
import { readFileSync } from 'node:fs';
import { preview } from 'vite';
import { devices, launchBrowser } from './browser.mjs';

const shot = process.argv[2];

const server = await preview({ preview: { port: 0, host: '127.0.0.1' }, logLevel: 'silent' });
const url = `http://127.0.0.1:${server.httpServer.address().port}/?trees=2000`;
const browser = await launchBrowser();
const failures = [];
const check = (label, ok, detail = '') => {
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${label}${detail ? ` (${detail})` : ''}`);
  if (!ok) failures.push(label);
};
const open = async (device, extra = '') => {
  const context = await browser.newContext({ ...devices[device] });
  const page = await context.newPage();
  page.on('pageerror', (e) => failures.push(`page error: ${e.message}`));
  await page.goto(url + extra);
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
  for (const sel of ['#where', '#stats', '#menu-button', '#fast-button', '#ski-button', '#map-button']) boxes[sel] = await box(sel);
  const names = Object.keys(boxes);
  const inside = names.every((n) => boxes[n].x >= 0 && boxes[n].y >= 0 && boxes[n].x + boxes[n].width <= width && boxes[n].y + boxes[n].height <= height);
  check('overlay fits inside the upright screen', inside);
  const clashes = names.flatMap((a, i) => names.slice(i + 1).filter((b) => overlap(boxes[a], boxes[b])).map((b) => `${a}/${b}`));
  check('overlay elements do not overlap', clashes.length === 0, clashes.join(', '));
  check('buttons are at least 44 points tall', ['#menu-button', '#fast-button', '#ski-button', '#map-button'].every((b) => boxes[b].height >= 44));
  check('skis and fast buttons sit in the lower, thumb-reach part of the screen', boxes['#fast-button'].y > height * 0.6 && boxes['#ski-button'].y > height * 0.6);

  // Trail map.
  await page.tap('#map-button');
  check('map button opens the trail map', await page.locator('#map-sheet').isVisible());
  const mapBox = await page.locator('#map-sheet canvas').boundingBox();
  check('the map fits the screen and is taller than wide', mapBox.width > 200 && mapBox.width <= width && mapBox.height > mapBox.width && mapBox.y + mapBox.height <= height);
  const inks = await page.evaluate(() => {
    const c = document.querySelector('#map-sheet canvas');
    const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
    const seen = new Set();
    for (let i = 0; i < d.length; i += 4 * 97) seen.add(`${d[i] >> 4},${d[i + 1] >> 4},${d[i + 2] >> 4}`);
    return seen.size;
  });
  check('the map is drawn: backdrop, trails, lifts and marks', inks > 12, `${inks} colours`);
  // Tap down the middle of the map until something is named.
  let named = '';
  for (let f = 0.15; f < 0.9 && !named; f += 0.05) {
    await page.touchscreen.tap(mapBox.x + mapBox.width * 0.5, mapBox.y + mapBox.height * f);
    const text = await page.locator('#map-sheet .caption').textContent();
    if (!text.startsWith('Tap a trail')) named = text;
  }
  check('tapping the map names a trail or lift', named !== '', named);
  await page.locator('#map-sheet button', { hasText: 'Close' }).tap();
  check('the map closes', !(await page.locator('#map-sheet').isVisible()));

  // Trees are solid: walk straight at the nearest one and never end up inside its trunk.
  const tree = (await page.evaluate(() => window.__gore.state())).nearestTree;
  check('there is a tree nearby to walk into', tree !== null);
  if (tree) {
    // Stand a few metres south of it and face it (north is yaw 0).
    await page.evaluate((t) => {
      window.__gore.place(t.x, t.z + t.radius + 5);
      window.__gore.face(0);
    }, tree);
    await page.keyboard.down('KeyW');
    let closest = Infinity;
    let reached = false;
    for (let i = 0; i < 120 && !reached; i++) {
      await page.waitForTimeout(250);
      const s = await page.evaluate(() => window.__gore.state());
      const d = Math.hypot(s.x - tree.x, s.z - tree.z);
      closest = Math.min(closest, d);
      reached = d < tree.radius + 0.6;
    }
    await page.waitForTimeout(1500);
    const s = await page.evaluate(() => window.__gore.state());
    closest = Math.min(closest, Math.hypot(s.x - tree.x, s.z - tree.z));
    await page.keyboard.up('KeyW');
    check('walking reaches the tree', reached, `closest ${closest.toFixed(2)} m`);
    check('and is stopped at its trunk', closest >= tree.radius + 0.3, `closest ${closest.toFixed(2)} m, trunk ${tree.radius.toFixed(2)} m`);
  }

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
  // Software rendering runs in slow motion, so wait on distance covered, not on the clock.
  const walked = await page
    .waitForFunction((from) => Math.hypot(window.__gore.state().x - from.x, window.__gore.state().z - from.z) > 3, before, { timeout: 60000 })
    .then(() => true, () => false);
  check('stick appears under the thumb', await page.locator('.stick-base').isVisible());
  let after = await state();
  const moved = Math.hypot(after.x - before.x, after.z - before.z);
  check('one thumb walks the player', walked, `${moved.toFixed(1)} m`);
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
  check('no ride is offered away from a lift station', !(await page.locator('#action-button').isVisible()));
  console.log(`     label at Saddle Lodge: ${await page.locator('#where').textContent()}`);
  await context.close();

  // Skiing, starting on skis halfway down Sunway (the start position and mode come from the URL).
  // Software rendering runs the game in slow motion, so these wait on what happens, not the clock.
  const world = JSON.parse(readFileSync(new URL('../public/world/world.json', import.meta.url), 'utf8'));
  const sunway = world.trails.filter((t) => t.name === 'Sunway' && !t.area).sort((a, b) => b.pts.length - a.pts.length)[0];
  const mid = Math.floor(sunway.pts.length / 4) * 2;
  const ski = await open('iPhone 15 Pro', `&ski=1&pos=${sunway.pts[mid]},${sunway.pts[mid + 1]}`);
  const sp = ski.page;
  const skiCdp = await ski.context.newCDPSession(sp);
  const skiTouch = (type, touchPoints) => skiCdp.send('Input.dispatchTouchEvent', { type, touchPoints });
  const skiState = () => sp.evaluate(() => window.__gore.state());
  const settle = (fn, arg) => sp.waitForFunction(fn, arg, { timeout: 60000 }).then(() => true, () => false);

  check('starts on skis from the URL, with the button lit', (await skiState()).mode === 'ski' && (await sp.getAttribute('#ski-button', 'aria-pressed')) === 'true');
  // Facing straight across the slope, the edges hold.
  await sp.evaluate(() => window.__gore.face(window.__gore.state().fallLineYaw + Math.PI / 2));
  await sp.waitForTimeout(800);
  check('stands still across the slope', (await skiState()).speed === 0);
  // Thumb up from a standstill: pole push.
  await skiTouch('touchStart', [thumb]);
  await skiTouch('touchMove', [{ ...thumb, y: thumb.y - 70 }]);
  check('thumb up poles away from a standstill', await settle(() => window.__gore.state().speed > 1));
  await skiTouch('touchEnd', []);

  await sp.evaluate(() => window.__gore.face(window.__gore.state().fallLineYaw));
  const atTop = await skiState();
  check('gravity carries the skier down the fall line', await settle(() => window.__gore.state().speed > 4));
  check('skiing loses height', await settle((y) => window.__gore.state().y < y - 2, atTop.y));
  check('skis leave tracks in the snow', (await skiState()).tracks > 5, `${(await skiState()).tracks} stretches`);
  // Whichever trail is underfoot by now (Wild Air runs alongside Sunway here).
  check('label names a trail and shows speed', /\S .* · [\d,]+ ft · \d+ mph/.test(await sp.locator('#where').textContent()), await sp.locator('#where').textContent());

  // Thumb to the right: the skis turn right (yaw falls) and the camera comes round with them.
  const beforeTurn = await skiState();
  await skiTouch('touchStart', [thumb]);
  await skiTouch('touchMove', [{ ...thumb, x: thumb.x + 70 }]);
  check('thumb right turns the skis right', await settle((h) => window.__gore.state().heading < h - 0.5, beforeTurn.heading));
  check('camera follows the skis round', await settle((y) => window.__gore.state().yaw < y - 0.3, beforeTurn.yaw));
  // Let go and build some speed again, then thumb down: a hockey stop.
  await skiTouch('touchEnd', []);
  await sp.evaluate(() => window.__gore.face(window.__gore.state().fallLineYaw));
  await settle(() => window.__gore.state().speed > 6);
  await skiTouch('touchStart', [thumb]);
  await skiTouch('touchMove', [{ ...thumb, y: thumb.y + 70 }]);
  check('thumb down swings the skis sideways', await settle(() => Math.abs(window.__gore.state().slip) > 1));
  check('and brings the skier to a stop', await settle(() => window.__gore.state().speed === 0));
  // Still holding the thumb to one side at a standstill: turn on the spot, and the camera follows.
  const stopped = await skiState();
  await skiTouch('touchMove', [{ ...thumb, x: thumb.x - 70, y: thumb.y + 70 }]);
  check('camera follows a turn made at a standstill', await settle((y) => window.__gore.state().yaw > y + 0.3, stopped.yaw));
  await skiTouch('touchEnd', []);
  if (shot) await sp.screenshot({ path: shot.replace(/\.png$/, '-ski.png') });

  await sp.tap('#ski-button');
  const offSkis = await skiState();
  check('taking skis off stops and goes back to walking', offSkis.mode === 'walk' && offSkis.speed === 0);
  await ski.context.close();

  // Lifts. Start at the foot of a short one so the ride finishes quickly in slow motion.
  const length = (l) => Math.hypot(l.pts.at(-2) - l.pts[0], l.pts.at(-1) - l.pts[1]);
  const shortLift = world.lifts.filter((l) => length(l) > 60).sort((a, b) => length(a) - length(b))[0];
  const lift = await open('iPhone 15 Pro', `&pos=${shortLift.pts[0]},${shortLift.pts[1]}`);
  const lp = lift.page;
  const liftState = () => lp.evaluate(() => window.__gore.state());
  const liftSettle = (fn, arg) => lp.waitForFunction(fn, arg, { timeout: 90000 }).then(() => true, () => false);
  await lp.waitForSelector('#action-button:not([hidden])', { timeout: 20000 }).catch(() => {});
  const offer = await lp.locator('#action-button').textContent();
  check('standing at the foot of a lift offers a ride by name', offer === `Ride ${shortLift.name}`, offer);
  const actionBox = await lp.locator('#action-button').boundingBox();
  const skiBox = await lp.locator('#ski-button').boundingBox();
  check('the ride button is by the thumb and clear of the other buttons', actionBox.y > lp.viewportSize().height * 0.6 && actionBox.y + actionBox.height <= skiBox.y && actionBox.height >= 44);
  const foot = await liftState();
  await lp.tap('#action-button');
  check('tapping it boards the lift', (await liftState()).mode === 'lift' && (await liftState()).lift === shortLift.name);
  check('the offer goes away while riding', await liftSettle(() => document.getElementById('action-button').hidden));
  // Boarding lifts the rider to chair height at once, so look for a climb well beyond that.
  check('the ride climbs', await liftSettle((y) => window.__gore.state().y > y + 9, foot.y));
  check('label names the lift while riding', await liftSettle((name) => document.getElementById('where').textContent.startsWith(name), shortLift.name), await lp.locator('#where').textContent());
  check('the ride ends back on foot', await liftSettle(() => window.__gore.state().mode === 'walk'));
  const off = await liftState();
  const topDist = Math.hypot(off.x - shortLift.pts.at(-2), off.z - shortLift.pts.at(-1));
  check('and sets the player down near the top station, higher than they started', topDist < 190 && off.y > foot.y, `${topDist.toFixed(0)} m from the top`);
  await lift.context.close();

  // The Home Screen quirk: iOS lays the page out shorter than the screen it shows. It cannot be
  // reproduced here, but its effect on layout can: tell the page the screen is 62 points taller
  // than the page, as fillScreen() would, and check where things end up.
  const short = await open('iPhone 15 Pro');
  const pageHeight = short.page.viewportSize().height;
  await short.page.evaluate((extra) => {
    const root = document.documentElement.style;
    root.setProperty('--app-height', `${window.innerHeight + extra}px`);
    root.setProperty('--app-extra', `${extra}px`);
  }, 62);
  await short.page.waitForFunction(() => document.getElementById('stats').textContent);
  const canvasHeight = await short.page.evaluate(() => document.getElementById('game').clientHeight);
  check('picture extends over the whole screen when the page is short', canvasHeight === pageHeight + 62, `${canvasHeight} of ${pageHeight + 62}`);
  const bottomOf = (sel) => short.page.evaluate((q) => document.querySelector(q).getBoundingClientRect().bottom, sel);
  check('buttons stay on the part the page covers', (await bottomOf('#ski-button')) <= pageHeight && (await bottomOf('#fast-button')) <= pageHeight);
  check('buttons stay near the bottom', (await bottomOf('#ski-button')) > pageHeight - 40);
  await short.page.evaluate(() => document.getElementById('menu-button').click());
  check('settings sheet reaches the bottom of the screen', Math.abs((await bottomOf('#menu')) - (pageHeight + 62)) < 2);
  const scrollBottom = await short.page.evaluate(() => {
    const menu = document.getElementById('menu');
    return menu.getBoundingClientRect().bottom - parseFloat(getComputedStyle(menu).borderBottomWidth);
  });
  check('but the part of it that holds the options stays on the part the page covers', scrollBottom <= pageHeight, `${scrollBottom} of ${pageHeight}`);
  await short.context.close();

  const sideways = await open('iPhone 15 Pro landscape');
  check('phone held sideways is asked to turn upright', await sideways.page.locator('#rotate').isVisible());
  await sideways.context.close();
} finally {
  await browser.close();
  await server.close();
}
if (failures.length) console.error(`\n${failures.length} failed: ${failures.join('; ')}`);
process.exit(failures.length ? 1 : 0);
