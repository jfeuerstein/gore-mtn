#!/usr/bin/env node
// Renders the Home Screen icon from tools/art/icon.svg to public/icon-180.png and public/icon-512.png.
//
//   node tools/art/make-icon.mjs
//
// The icon is drawn by hand as an SVG, in the game's own look, and needs no outside service.
import { readFileSync } from 'node:fs';
import { launchBrowser } from '../browser.mjs';

const svg = readFileSync(new URL('./icon.svg', import.meta.url), 'utf8');
const browser = await launchBrowser();
try {
  for (const size of [180, 512]) {
    const page = await browser.newPage({ viewport: { width: size, height: size } });
    await page.setContent(`<body style="margin:0">${svg.replace('<svg ', `<svg width="${size}" height="${size}" style="display:block" `)}</body>`);
    await page.screenshot({ path: new URL(`../../public/icon-${size}.png`, import.meta.url).pathname });
    await page.close();
    console.log(`public/icon-${size}.png`);
  }
} finally {
  await browser.close();
}
