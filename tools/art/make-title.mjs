#!/usr/bin/env node
// Make the four pictures on the way in, one for each season: park posters, on one sheet.
//
//   NODE_USE_ENV_PROXY=1 node tools/art/make-title.mjs [--redo]
//
// The sheet is asked of Tripo's image model once and kept in tools/art/cache/title/ (not in
// the repository); it is then cut into its four posters, public/art/title/<season>.webp.
// Running this again asks for nothing, and cuts the sheet again. About 10 Tripo credits.
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync } from 'node:fs';
import { TITLE_BRIEF, TITLE_MODEL, TITLE_SEASONS } from './manifest.mjs';
import { save, task } from './tripo.mjs';

const ROOT = new URL('../../', import.meta.url).pathname;
const sheet = `${ROOT}tools/art/cache/title/sheet.png`;
if (process.argv.includes('--redo') || !existsSync(sheet)) {
  const done = await task('generation/text-to-image', { prompt: TITLE_BRIEF, model: TITLE_MODEL, size: '2048x1152', quality: 'medium', output_format: 'png' });
  await save(done.output.generated_image_url, sheet);
  console.log(`made the title sheet (${done.credits_consumed} credits)`);
}
mkdirSync(`${ROOT}public/art/title`, { recursive: true });
// Each poster is a quarter of the sheet, less the gutter, cut to the shape of a phone held upright.
execFileSync(
  'python3',
  [
    '-c',
    `
import sys
from PIL import Image
sheet, out = sys.argv[1], sys.argv[2]
im = Image.open(sheet).convert('RGB')
w, h = im.size
for i, season in enumerate(sys.argv[3:]):
    panel = im.crop((round(i * w / 4), 0, round((i + 1) * w / 4), h))
    # In from the gutters, and to nine by sixteen about its middle.
    pw, ph = panel.size
    inset = round(pw * 0.035)
    panel = panel.crop((inset, inset, pw - inset, ph - inset))
    pw, ph = panel.size
    tall = min(ph, round(pw * 16 / 9))
    wide = round(tall * 9 / 16)
    left, top = (pw - wide) // 2, (ph - tall) // 2
    panel.crop((left, top, left + wide, top + tall)).resize((540, 960), Image.LANCZOS).save(f'{out}/{season}.webp', 'WEBP', quality=84, method=6)
`,
    sheet,
    `${ROOT}public/art/title`,
    ...TITLE_SEASONS,
  ],
  { stdio: 'inherit' },
);
