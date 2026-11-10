#!/usr/bin/env node
// Take a screenshot of the built game so changes can be checked by eye without a phone.
//
//   npm run build && node tools/shot.mjs <out.png> ["at=summit&trees=20000"] [width] [height] [scale]
//
// Defaults to an upright iPhone 17 Pro screen (402 x 874 points). Use scale 2 for an image a
// person will look at.
//
// Serves dist/ with Vite's preview server, opens it in headless Chromium (software WebGL, so
// frame rates mean nothing here), waits until the game reports ready, and prints its state.
import { preview } from 'vite';
import { launchBrowser } from './browser.mjs';


const [out = 'shot.png', query = '', width = '402', height = '874', scale = '1'] = process.argv.slice(2);

const server = await preview({ preview: { port: 0, host: '127.0.0.1' }, logLevel: 'silent' });
const address = server.httpServer.address();
const url = `http://127.0.0.1:${address.port}/?${query}`;

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
