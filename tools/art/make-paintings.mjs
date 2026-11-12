#!/usr/bin/env node
// Paint the painter's pictures: each of her views in every season.
//
//   NODE_USE_ENV_PROXY=1 node tools/art/make-paintings.mjs [--redo view,view]
//
// A view's four seasons are asked for on one sheet, so that they are one place seen four
// times, and the sheet is cut into public/art/paintings/<view>-<season>.webp. Sheets are kept
// in tools/art/cache/paintings/ (not in the repository); running this again asks only for
// what is missing, and cuts every sheet again.
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync } from 'node:fs';
import { run, save } from './fal.mjs';
import { PAINTING_MODEL, PAINTING_SEASONS, PAINTINGS, paintingBrief } from './manifest.mjs';

const ROOT = new URL('../../', import.meta.url).pathname;
const args = process.argv.slice(2);
const redo = new Set((args.find((a, i) => args[i - 1] === '--redo') ?? '').split(',').filter(Boolean));
mkdirSync(`${ROOT}public/art/paintings`, { recursive: true });
await Promise.all(
  Object.entries(PAINTINGS).map(async ([view, scene]) => {
    const sheet = `${ROOT}tools/art/cache/paintings/${view}.png`;
    if (redo.has(view) || !existsSync(sheet)) {
      const made = await run(PAINTING_MODEL, { prompt: paintingBrief(scene), image_size: '1024x1024', quality: 'high', background: 'opaque', output_format: 'png', num_images: 1 });
      await save(made.images[0].url, sheet);
      console.log(`made the sheet for ${view}`);
    }
    // Each painting is a quarter of the sheet: found by where the paint is, trimmed of its
    // paper, and brought to four by three about its middle.
    execFileSync(
      'python3',
      [
        '-c',
        `
import sys
import numpy as np
from PIL import Image
sheet, out, view = sys.argv[1], sys.argv[2], sys.argv[3]
im = Image.open(sheet).convert('RGB')
w, h = im.size
def run(on):
    # The longest unbroken stretch of paint: the painting itself, and not the edge of its neighbour across the gutter.
    best, start = (0, 0), None
    for k, v in enumerate(list(on) + [False]):
        if v and start is None:
            start = k
        elif not v and start is not None:
            if k - start > best[1] - best[0]:
                best = (start, k)
            start = None
    return best
def found(i):
    a = np.asarray(im.crop(((i % 2) * w // 2, (i // 2) * h // 2, (i % 2 + 1) * w // 2, (i // 2 + 1) * h // 2))).astype(int)
    # Paint is whatever is not paper: darker than it, or coloured.
    paint = (a.min(axis=2) < 228) | ((a.max(axis=2) - a.min(axis=2)) > 26)
    return run(paint.mean(axis=0) > 0.5), run(paint.mean(axis=1) > 0.5)
# Snow is as white as the paper, so the winter painting cannot be found by its paint. The four are
# laid out square: it is as wide as the summer one under it and as tall as the spring one beside it.
boxes = [found(i) for i in range(4)]
boxes[0] = (boxes[2][0], boxes[1][1])
for i, season in enumerate(sys.argv[4:]):
    panel = im.crop(((i % 2) * w // 2, (i // 2) * h // 2, (i % 2 + 1) * w // 2, (i // 2 + 1) * h // 2))
    (c0, c1), (r0, r1) = boxes[i]
    if c1 - c0 > 40 and r1 - r0 > 40:
        panel = panel.crop((c0 + 3, r0 + 3, c1 - 3, r1 - 3))
    pw, ph = panel.size
    wide = min(pw, round(ph * 4 / 3))
    tall = round(wide * 3 / 4)
    left, top = (pw - wide) // 2, (ph - tall) // 2
    panel.crop((left, top, left + wide, top + tall)).resize((480, 360), Image.LANCZOS).save(f'{out}/{view}-{season}.webp', 'WEBP', quality=86, method=6)
`,
        sheet,
        `${ROOT}public/art/paintings`,
        view,
        ...PAINTING_SEASONS,
      ],
      { stdio: 'inherit' },
    );
  }),
);
