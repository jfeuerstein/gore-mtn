#!/usr/bin/env node
// Drive the built game with emulated phone touches and check that the controls respond.
//
//   npm run build && node tools/touch-check.mjs [screenshot.png]
//
// Covers what unit tests cannot, on an upright phone: one thumb walks the player and the camera
// swings round behind them, a touch at the top of the screen or a second finger turns the camera,
// the overlay fits the narrow screen, the settings sheet opens and teleports, on skis the thumb
// steers, tucks and brakes while the slope does the rest, lifts carry the player up, and the book
// fills with stamps and stones and is still there after a reload.
import { readFileSync } from 'node:fs';
import { preview } from 'vite';
import { devices, launchBrowser } from './browser.mjs';

const shot = process.argv[2];

const server = await preview({ preview: { port: 0, host: '127.0.0.1' }, logLevel: 'silent' });
// A fixed time and sky, so the checks do not depend on when they are run, and light settings,
// because software rendering is slow and several checks wait on the game to cover ground.
const url = `http://127.0.0.1:${server.httpServer.address().port}/?trees=2000&shadows=0&stride=2&view=1500&dpr=1&time=midday&weather=clear`;
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
  // Starting beside the Base Lodge earns its stamp at once, so an announcement is up as well.
  await page.waitForSelector('#toasts .toast', { timeout: 20000 }).catch(() => {});
  for (const sel of ['#where', '#stats', '#menu-button', '#book-button', '#ski-button', '#map-button', '#toasts .toast']) boxes[sel] = await box(sel);
  check('the first stamp is announced on arrival', boxes['#toasts .toast'] !== null && (await page.evaluate(() => window.__gore.state().toast)).startsWith('Base Lodge'));
  boxes['#toasts .toast'] ??= { x: 0, y: 0, width: 0, height: 0 };
  const names = Object.keys(boxes);
  const inside = names.every((n) => boxes[n].x >= 0 && boxes[n].y >= 0 && boxes[n].x + boxes[n].width <= width && boxes[n].y + boxes[n].height <= height);
  check('overlay fits inside the upright screen', inside);
  const clashes = names.flatMap((a, i) => names.slice(i + 1).filter((b) => overlap(boxes[a], boxes[b])).map((b) => `${a}/${b}`));
  check('overlay elements do not overlap', clashes.length === 0, clashes.join(', '));
  check('buttons are at least 44 points tall', ['#menu-button', '#book-button', '#ski-button', '#map-button'].every((b) => boxes[b].height >= 44));
  check('skis, map and book buttons sit in the lower, thumb-reach part of the screen', ['#book-button', '#ski-button', '#map-button'].every((b) => boxes[b].y > height * 0.6));
  check('announcements sit in the upper part of the screen, clear of the thumb', boxes['#toasts .toast'].y + boxes['#toasts .toast'].height < height * 0.4);

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

  // Fast travel, a testing aid kept in Settings.
  const setFast = async () => {
    await page.tap('#menu-button');
    await page.locator('#fast-button').tap();
    await page.locator('#menu .close').tap();
  };
  await setFast();
  check('fast travel latches on from Settings', (await page.getAttribute('#fast-button', 'aria-pressed')) === 'true' && !(await page.locator('#menu').isVisible()));
  const slowStart = await state();
  await touch('touchStart', [thumb]);
  await touch('touchMove', [{ ...thumb, y: thumb.y - 70 }]);
  await page.waitForTimeout(1000);
  await touch('touchEnd', []);
  const fastEnd = await state();
  const fastMoved = Math.hypot(fastEnd.x - slowStart.x, fastEnd.z - slowStart.z);
  check('fast travel covers ground quickly', fastMoved > moved * 1.5, `${fastMoved.toFixed(1)} m in 1 s`);
  await setFast();
  check('and latches off again', (await page.getAttribute('#fast-button', 'aria-pressed')) === 'false');

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

  // Time of day and weather: choosing one in Settings repaints the mountain, at the same spot.
  const sky = await open('iPhone 15 Pro', '&at=saddle-lodge');
  const kp = sky.page;
  const noon = await kp.evaluate(() => window.__gore.state());
  // These checks run with the view distance set to 1,500 m; clear air leaves all of it.
  check('midday has the sun well up and the full view', noon.sunElevationDeg > 20 && noon.viewDist >= 1500, `sun ${noon.sunElevationDeg.toFixed(0)} degrees, view ${Math.round(noon.viewDist)} m`);
  await kp.tap('#menu-button');
  const offered = await kp.locator('#menu a', { hasText: /^(Dawn|Midday|Evening|Dusk|Night|Clear|Cloudy|Snow)$/ }).count();
  check('settings offer times of day and kinds of weather', offered === 8, `${offered}`);
  await Promise.all([kp.waitForNavigation(), kp.locator('#menu a', { hasText: /^Night$/ }).tap()]);
  await kp.waitForFunction(() => window.__gore?.ready || window.__gore?.error, null, { timeout: 120000 });
  const night = await kp.evaluate(() => window.__gore.state());
  check('choosing night puts the sun below the horizon', kp.url().includes('time=night') && night.sunElevationDeg < -20 && !(await kp.evaluate(() => window.__gore.error)));
  check('at the same spot, facing the same way', Math.hypot(night.x - noon.x, night.z - noon.z) < 1 && Math.abs(night.yaw - noon.yaw) < 0.01);
  await kp.tap('#menu-button');
  await Promise.all([kp.waitForNavigation(), kp.locator('#menu a', { hasText: /^Snow$/ }).tap()]);
  await kp.waitForFunction(() => window.__gore?.ready || window.__gore?.error, null, { timeout: 120000 });
  const snowy = await kp.evaluate(() => window.__gore.state());
  check('choosing snow closes the view in and keeps the chosen time', snowy.weather.snowing === 1 && snowy.viewDist < 1300 && kp.url().includes('time=night'), `view ${Math.round(snowy.viewDist)} m`);
  // Left to itself the game follows the clock, and makes up weather if it cannot fetch the real thing.
  await kp.goto(url.replace('&time=midday&weather=clear', ''));
  await kp.waitForFunction(() => window.__gore?.ready || window.__gore?.error, null, { timeout: 120000 });
  const real = await kp.evaluate(() => window.__gore.state());
  check('with nothing chosen it runs on the real clock and a real or invented sky', !(await kp.evaluate(() => window.__gore.error)) && ['real', 'invented'].includes(real.weatherSource) && Number.isFinite(real.sunElevationDeg), real.weatherSource);
  await sky.context.close();

  // Lifts. Start at the foot of the shortest chairlift so the ride finishes quickly in slow motion.
  const length = (l) => Math.hypot(l.pts.at(-2) - l.pts[0], l.pts.at(-1) - l.pts[1]);
  const shortLift = world.lifts.filter((l) => l.kind === 'chair_lift').sort((a, b) => length(a) - length(b))[0];
  const lift = await open('iPhone 15 Pro', `&pos=${shortLift.pts[0]},${shortLift.pts[1]}`);
  const lp = lift.page;
  const liftState = () => lp.evaluate(() => window.__gore.state());
  const liftSettle = (fn, arg) => lp.waitForFunction(fn, arg, { timeout: 240000 }).then(() => true, () => false);
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
  check('the ride earns the lift its pin', off.book.lifts === 1 && off.toast === `${shortLift.name} · Lift pin`, off.toast);
  await lift.context.close();

  // A lift that runs along the snow carries the rider up on their feet.
  const carpetLift = world.lifts.filter((l) => l.kind === 'j-bar' || l.kind === 'magic_carpet').sort((a, b) => length(b) - length(a))[0];
  const carpet = await open('iPhone 15 Pro', `&pos=${carpetLift.pts[0]},${carpetLift.pts[1]}`);
  const cp = carpet.page;
  await cp.waitForSelector('#action-button:not([hidden])', { timeout: 20000 }).catch(() => {});
  const low = await cp.evaluate(() => window.__gore.state());
  await cp.tap('#action-button');
  const rides = await cp.waitForFunction(() => window.__gore.state().mode === 'lift', null, { timeout: 20000 }).then(() => true, () => false);
  const onSnow = await cp.evaluate(() => window.__gore.state().y);
  check(`${carpetLift.name} carries the rider along the snow, not in the air`, rides && Math.abs(onSnow - low.y) < 3, `${(onSnow - low.y).toFixed(1)} m above the start`);
  check('and sets them down at the top', await cp.waitForFunction(() => window.__gore.state().mode === 'walk', null, { timeout: 240000 }).then(() => true, () => false));
  const high = await cp.evaluate(() => window.__gore.state());
  check('higher than they started', high.y > low.y, `${(high.y - low.y).toFixed(1)} m`);
  await carpet.context.close();

  // The book: stamps and stones, earned by being somewhere, and kept between visits.
  const collect = await open('iPhone 15 Pro');
  const bp = collect.page;
  const bookState = () => bp.evaluate(() => window.__gore.state());
  const bookSettle = (fn, arg) => bp.waitForFunction(fn, arg, { timeout: 60000 }).then(() => true, () => false);
  /** Stand the player somewhere and let the game take a couple of frames to notice. */
  const standAt = (x, z) =>
    bp.evaluate(
      ([px, pz]) =>
        new Promise((done) => {
          window.__gore.place(px, pz);
          requestAnimationFrame(() => requestAnimationFrame(() => done()));
        }),
      [x, z],
    );
  check('the book starts with the Base Lodge stamp and nothing else', await bookSettle(() => window.__gore.state().book.landmarks === 1));
  const fresh = (await bookState()).book;
  check('and counts what there is to find', fresh.trails === 0 && fresh.trailsTotal > 90 && fresh.liftsTotal === 14 && fresh.mineralsTotal === 12 && fresh.specimens === 0, JSON.stringify(fresh));

  await bp.tap('#book-button');
  check('the book button opens the book at the passport', (await bp.locator('#book-sheet').isVisible()) && (await bp.getAttribute('#book-sheet [data-tab=passport]', 'aria-pressed')) === 'true');
  const bookBox = await bp.locator('#book-sheet').boundingBox();
  check('the book is a sheet across the bottom of the screen', bookBox.width >= width - 1 && Math.abs(bookBox.y + bookBox.height - height) < 2 && bookBox.y > height * 0.1);
  check('the Base Lodge stamp is inked and the rest are still to earn', (await bp.locator('#book-sheet .stamp.earned').count()) === 1 && (await bp.locator('#book-sheet .stamp.earned b').textContent()) === 'Base Lodge' && (await bp.locator('#book-sheet .stamp.todo').count()) === 4 + 4 + 5 + 14);
  check('every trail is listed', (await bp.locator('#book-sheet .trail').count()) === fresh.trailsTotal);
  await bp.tap('#book-sheet [data-tab=minerals]');
  check('the minerals page lists all twelve, none found yet', (await bp.locator('#book-sheet .mineral').count()) === 12 && (await bp.locator('#book-sheet .mineral.earned').count()) === 0);
  // An open sheet covers the bottom row, so only one can be opened by hand. Should another be
  // opened some other way, the first gets out of its way.
  await bp.evaluate(() => document.getElementById('map-button').click());
  check('opening the map puts the book away', (await bp.locator('#map-sheet').isVisible()) && !(await bp.locator('#book-sheet').isVisible()));
  await bp.evaluate(() => document.getElementById('book-button').click());
  check('and opening the book puts the map away', (await bp.locator('#book-sheet').isVisible()) && !(await bp.locator('#map-sheet').isVisible()));
  await bp.locator('#book-sheet .close').tap();
  check('the book closes', !(await bp.locator('#book-sheet').isVisible()));

  // A stone: walk onto the nearest find.
  const lying = (await bookState()).finds;
  check('there are stones lying near the lodge', lying.length > 3, `${lying.length}`);
  const here = await bookState();
  const stone = lying.map((f) => ({ ...f, d: Math.hypot(f.x - here.x, f.z - here.z) })).sort((a, b) => a.d - b.d)[0];
  await standAt(stone.x + 1, stone.z);
  check('coming up to a stone picks it up', await bookSettle(() => window.__gore.state().book.specimens >= 1));
  const picked = await bookState();
  check('it is announced by name and size', /^.+ · \d+\.\d cm · New mineral$/.test(picked.toast), picked.toast);
  check('and it is gone from the snow', !picked.finds.some((f) => f.x === stone.x && f.z === stone.z) && picked.book.minerals >= 1);

  // A trail: on skis, visit the length of a short one.
  const pieces = (name) => world.trails.filter((t) => t.name === name && !t.area);
  const run = (t) => {
    let d = 0;
    for (let i = 0; i + 3 < t.pts.length; i += 2) d += Math.hypot(t.pts[i + 2] - t.pts[i], t.pts[i + 3] - t.pts[i + 1]);
    return d;
  };
  const short1 = world.trails
    .filter((t) => t.name && !t.area && !t.glade && pieces(t.name).length === 1 && run(t) > 150)
    .sort((a, b) => run(a) - run(b))[0];
  await bp.tap('#ski-button');
  for (let i = 0; i + 3 < short1.pts.length; i += 2) {
    const [ax, az, bx, bz] = short1.pts.slice(i, i + 4);
    const steps = Math.ceil(Math.hypot(bx - ax, bz - az) / 25);
    for (let k = 0; k <= steps; k++) await standAt(ax + ((bx - ax) * k) / steps, az + ((bz - az) * k) / steps);
  }
  const skied = await bookState();
  check(`skiing the length of ${short1.name} stamps it`, skied.book.trails >= 1, `${skied.book.trails} stamped, ${run(short1).toFixed(0)} m`);
  await bp.tap('#book-button');
  check('the book opens at the page it was left on', (await bp.getAttribute('#book-sheet [data-tab=minerals]', 'aria-pressed')) === 'true' && (await bp.locator('#book-sheet .mineral.earned').count()) === 1);
  await bp.tap('#book-sheet [data-tab=passport]');
  const inked = await bp.locator('#book-sheet .trail.earned .name').allTextContents();
  check('and the passport shows it inked', inked.includes(short1.name), inked.join(', '));
  await bp.locator('#book-sheet .close').tap();

  // The book is written down as it fills, and is there the next time the game is opened.
  await bp.waitForTimeout(1500);
  await bp.reload();
  await bp.waitForFunction(() => window.__gore?.ready || window.__gore?.error, null, { timeout: 120000 });
  const back = await bookState();
  check('the book is still there after a reload', back.book.trails === skied.book.trails && back.book.specimens === skied.book.specimens && back.book.landmarks >= 1, JSON.stringify(back.book));
  await standAt(stone.x + 200, stone.z);
  await standAt(stone.x + 8, stone.z);
  check('and a stone picked up today stays picked up', !(await bookState()).finds.some((f) => f.x === stone.x && f.z === stone.z));

  // A save code carries the book to another browser.
  await bp.tap('#menu-button');
  await bp.locator('#save-copy').tap();
  const code = await bp.inputValue('#save-field');
  check('settings give the book as a save code', /^GORE1\.[A-Za-z0-9+/=]+$/.test(code), `${code.length} characters`);
  await collect.context.close();
  const other = await open('iPhone 15 Pro');
  const op = other.page;
  await op.tap('#menu-button');
  await op.fill('#save-field', 'not a code');
  await op.locator('#save-restore').tap();
  check('a wrong code is turned away', (await op.locator('#menu').textContent()).includes('That is not a save code'));
  await op.fill('#save-field', code);
  await op.locator('#save-restore').tap();
  check('restoring asks before replacing the book', (await op.evaluate(() => window.__gore.state().book.trails)) === 0 && (await op.locator('#menu').textContent()).includes('Tap Restore again'));
  await op.locator('#save-restore').tap();
  const carried = await op.evaluate(() => window.__gore.state().book);
  check('and then brings the whole book across', carried.trails === skied.book.trails && carried.specimens === skied.book.specimens, JSON.stringify(carried));
  await other.context.close();

  // The Home Screen quirk: iOS lays the page out shorter than the screen it shows. It cannot be
  // reproduced here, but its effect on layout can: the `shortpage` option tells the game the
  // screen is 62 points taller than the page.
  const short = await open('iPhone 15 Pro', '&shortpage=62');
  const pageHeight = short.page.viewportSize().height;
  await short.page.waitForFunction(() => document.getElementById('stats').textContent);
  const canvasHeight = await short.page.evaluate(() => document.getElementById('game').clientHeight);
  check('picture extends over the whole screen when the page is short', canvasHeight === pageHeight + 62, `${canvasHeight} of ${pageHeight + 62}`);
  const bottomOf = (sel) => short.page.evaluate((q) => document.querySelector(q).getBoundingClientRect().bottom, sel);
  check('buttons stay on the part the page covers', (await bottomOf('#ski-button')) <= pageHeight && (await bottomOf('#book-button')) <= pageHeight);
  check('buttons stay near the bottom', (await bottomOf('#ski-button')) > pageHeight - 40);
  await short.page.evaluate(() => document.getElementById('menu-button').click());
  check('settings sheet reaches the bottom of the screen', Math.abs((await bottomOf('#menu')) - (pageHeight + 62)) < 2);
  const scrollBottom = await short.page.evaluate(() => {
    const menu = document.getElementById('menu');
    return menu.getBoundingClientRect().bottom - parseFloat(getComputedStyle(menu).borderBottomWidth);
  });
  check('but the part of it that holds the options stays on the part the page covers', scrollBottom <= pageHeight, `${scrollBottom} of ${pageHeight}`);
  await short.page.evaluate(() => document.getElementById('book-button').click());
  check('the book reaches the bottom of the screen too', Math.abs((await bottomOf('#book-sheet')) - (pageHeight + 62)) < 2);
  check('and its pages stay on the part the page covers', (await bottomOf('#book-sheet .body')) <= pageHeight, `${await bottomOf('#book-sheet .body')} of ${pageHeight}`);
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
