#!/usr/bin/env node
// Take a screenshot of the built game so changes can be checked by eye without a phone.
//
//   npm run build && node tools/shot.mjs <out.png> ["at=summit&trees=20000"] [width] [height] [scale] [script]
//
// The optional script runs in the page once the game is ready, to set a scene the address cannot:
// "document.getElementById('book-button').click()" opens the book, for example. It may be async.
//
// Defaults to an upright iPhone 17 Pro screen (402 x 874 points). Use scale 2 for an image a
// person will look at.
//
// Serves dist/ with Vite's preview server, opens it in headless Chromium (software WebGL, so
// frame rates mean nothing here), waits until the game reports ready, and prints its state.
import { preview } from 'vite';
import { launchBrowser } from './browser.mjs';


const [out = 'shot.png', query = '', width = '402', height = '874', scale = '1', script = ''] = process.argv.slice(2);

const server = await preview({ preview: { port: 0, host: '127.0.0.1' }, logLevel: 'silent' });
const address = server.httpServer.address();
// The game follows the real clock and weather, which would make screenshots differ from one run
// to the next. Unless the query says otherwise, take them at midday under a clear sky.
const params = new URLSearchParams(query);
if (!params.has('time')) params.set('time', 'midday');
if (!params.has('weather')) params.set('weather', 'clear');
const url = `http://127.0.0.1:${address.port}/?${params}`;

const browser = await launchBrowser();
let failed = false;
try {
  const page = await browser.newPage({
    viewport: { width: Number(width), height: Number(height) },
    deviceScaleFactor: Number(scale),
  });
  page.on('console', (m) => {
    if (m.type() === 'error' || m.type() === 'warning') console.error(`[page ${m.type()}] ${m.text()}`);
  });
  page.on('pageerror', (e) => console.error(`[page error] ${e.message}`));
  await page.goto(url);
  await page.waitForFunction(() => window.__gore?.ready || window.__gore?.error, null, { timeout: 120000 });
  const error = await page.evaluate(() => window.__gore.error);
  if (error) {
    failed = true;
    console.error(`game failed to start:\n${error}`);
  } else {
    if (script) {
      await page.evaluate(`(async () => { ${script} })()`);
      // Let the game draw a few frames of whatever the script set up.
      await page.waitForFunction((n) => window.__gore.state().frames > n + 4, await page.evaluate(() => window.__gore.state().frames), { timeout: 120000 });
    }
    await page.waitForTimeout(600);
    console.log(JSON.stringify(await page.evaluate(() => window.__gore.state())));
  }
  // Software rendering can take seconds per frame at full size, so allow well over the default.
  await page.screenshot({ path: out, timeout: 180000 });
  console.error(`saved ${out}`);
} finally {
  await browser.close();
  await server.close();
}
process.exit(failed ? 1 : 0);
