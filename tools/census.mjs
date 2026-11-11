#!/usr/bin/env node
// Where the draw calls go: counts what is set to be drawn, by part of the scene, at a few spots.
//
//   npm run build && node tools/census.mjs ["at=summit" "at=depot&season=fall" ...]
//
// The counts are of things in the scene that are switched on, before the renderer leaves out
// what is off screen, so they are an upper bound; `drawCalls` is what the renderer reported.
import { preview } from 'vite';
import { launchBrowser } from './browser.mjs';

const queries = process.argv.slice(2);
if (queries.length === 0) queries.push('at=base-lodge', 'at=summit', 'at=depot', 'at=cafe&season=fall');
const server = await preview({ preview: { port: 0, host: '127.0.0.1' }, logLevel: 'silent' });
const browser = await launchBrowser();
for (const query of queries) {
  const params = new URLSearchParams(query);
  for (const [k, v] of [['season', 'winter'], ['intro', '0'], ['time', 'midday'], ['weather', 'clear']]) if (!params.has(k)) params.set(k, v);
  const page = await browser.newPage({ viewport: { width: 402, height: 874 } });
  await page.goto(`http://127.0.0.1:${server.httpServer.address().port}/?${params}`);
  await page.waitForFunction(() => window.__gore?.ready || window.__gore?.error, null, { timeout: 120000 });
  await page.waitForTimeout(1500);
  const { census, drawCalls, triangles } = await page.evaluate(() => ({ census: window.__gore.census(), ...window.__gore.state() }));
  const total = Object.values(census).reduce((a, b) => a + b, 0);
  console.log(`${query}: ${drawCalls} draw calls reported, ${triangles} triangles; ${total} things switched on`);
  console.log('   ' + Object.entries(census).sort((a, b) => b[1] - a[1]).map(([k, n]) => `${k} ${n}`).join(', '));
  await page.close();
}
await browser.close();
await server.close();
