#!/usr/bin/env node
// Make the game's generated art from tools/art/manifest.mjs.
//
//   NODE_USE_ENV_PROXY=1 node tools/art/make-art.mjs [people|places|shops] [--redo id,id] [--bump n]
//
// (The pictures on the way in are make-title.mjs's, and the marks on the ground make-ground.mjs's.)
//
// Each picture is asked of fal once and kept at full size in tools/art/cache/ (not in the
// repository); the small copy the game loads goes to public/art/. Pictures already made are
// left alone unless named with --redo, so running this again costs nothing.
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync } from 'node:fs';
import { run, save } from './fal.mjs';
import * as manifest from './manifest.mjs';

const ROOT = new URL('../../', import.meta.url).pathname;
const SETS = {
  people: { art: manifest.PEOPLE_ART, size: 256 },
  // Postcards are little park posters, painted to the edge: they have a look of their own, written into each.
  places: { art: manifest.PLACE_ART ?? {}, size: 384, own: true },
  // The insides of the rooms behind the locked doors: prints in the postcards' hand, shown wide over what is read there.
  rooms: { art: manifest.ROOM_ART ?? {}, size: 512, own: true },
  // Everything in the Book that is a patch (stamps, pins, hats, bakes, minerals, the field guide) is made by make-patches.mjs.
  // The pictures for the shop signs go onto one sheet (see the end of this file), not into public/art one by one.
  shops: { art: manifest.SHOP_ART, size: 128, item: true, sheet: true },
};
/** A file name for something whose name has spaces and marks in it. */
const slug = (id) => id.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const args = process.argv.slice(2);
const redo = new Set((args.find((a, i) => args[i - 1] === '--redo') ?? '').split(',').filter(Boolean));
const wanted = args.filter((a) => a in SETS);
// With --redo, a different number here gives a different picture of the same thing.
const bump = args.find((a, i) => args[i - 1] === '--bump') ?? '1';
let made = 0;

async function make(set, id, prompt, size) {
  const { item, sheet, tall, own } = SETS[set];
  const raw = `${ROOT}tools/art/cache/${set}/${slug(id)}.webp`;
  // A picture bound for a sheet is kept small in the cache, beside the big one.
  const out = sheet ? `${ROOT}tools/art/cache/${set}/small/${slug(id)}.png` : `${ROOT}public/art/${set}/${slug(id)}.webp`;
  if (redo.has(id) || !existsSync(raw)) {
    // The same seed for a subject every time, so a picture can be made again as it was.
    const seed = [...`${set}/${id}`].reduce((h, ch) => (Math.imul(h, 31) + ch.charCodeAt(0)) >>> 0, 7) % 1000000;
    const result = await run(manifest.MODEL, {
      prompt: tall || own ? prompt : `${prompt}. ${item ? manifest.ITEM_LOOK : manifest.LOOK}`,
      image_size: tall ? 'portrait_16_9' : 'square',
      num_inference_steps: 4,
      seed: seed + (redo.has(id) ? Number(bump) : 0),
    });
    await save(result.images[0].url, raw);
    made++;
    console.log(`made ${set}/${id}`);
  } else if (existsSync(out)) {
    return;
  }
  mkdirSync(out.slice(0, out.lastIndexOf('/')), { recursive: true });
  if (tall) {
    execFileSync('python3', ['-c', `from PIL import Image; im = Image.open(${JSON.stringify(raw)}).convert('RGB'); im.resize((540, 960), Image.LANCZOS).save(${JSON.stringify(out)}, 'WEBP', quality=80, method=6)`]);
    return;
  }
  if (item) {
    // The model's idea of a plain cream background differs from one picture to the next. Each is
    // balanced so that its own background, read from round its edge, comes out as the paper's.
    execFileSync('python3', [
      '-c',
      `
from PIL import Image
import statistics
im = Image.open(${JSON.stringify(raw)}).convert('RGB')
w, h = im.size
px = im.load()
ring = [px[x, y] for x in range(0, w, 7) for y in (3, h - 4)] + [px[x, y] for y in range(0, h, 7) for x in (3, w - 4)]
bg = [statistics.median(c[i] for c in ring) for i in range(3)]
paper = (255, 253, 247)
luts = []
for i in range(3):
    g = paper[i] / max(bg[i], 1)
    luts += [min(255, round(v * g)) for v in range(256)]
im = im.point(luts)
m = 0.07
im = im.crop((int(w * m), int(h * m), int(w * (1 - m)), int(h * (1 - m)))).resize((${size}, ${size}), Image.LANCZOS)
im.save(${JSON.stringify(out)}${sheet ? '' : ", 'WEBP', quality=84, method=6"})
`,
    ]);
    return;
  }
  if (set === 'people') {
    // A portrait's paper differs from one to the next too, and one or two came back on white.
    // Each is balanced so that its own paper, read along the top and down the sides above the
    // shoulders, comes out the same cream as the rest.
    execFileSync('python3', [
      '-c',
      `
from PIL import Image
import statistics
im = Image.open(${JSON.stringify(raw)}).convert('RGB')
w, h = im.size
px = im.load()
ring = [px[x, 3] for x in range(0, w, 7)] + [px[x, y] for y in range(0, h // 2, 7) for x in (3, w - 4)]
bg = [statistics.median(c[i] for c in ring) for i in range(3)]
paper = (251, 245, 228)
luts = []
for i in range(3):
    g = paper[i] / max(bg[i], 1)
    luts += [min(255, round(v * g)) for v in range(256)]
im = im.point(luts)
m = 0.04
im.crop((int(w * m), int(h * m), int(w * (1 - m)), int(h * (1 - m)))).resize((${size}, ${size}), Image.LANCZOS).save(${JSON.stringify(out)}, 'WEBP', quality=82, method=6)
`,
    ]);
    return;
  }
  // Trim the margins, where the model likes to add a caption or a signature, and shrink to the
  // size the game shows it at. Pillow is already needed by the terrain pipeline.
  const trim = 0.08;
  execFileSync('python3', [
    '-c',
    `from PIL import Image; im = Image.open(${JSON.stringify(raw)}).convert('RGB'); w, h = im.size; m = ${trim}; im.crop((int(w * m), int(h * m), int(w * (1 - m)), int(h * (1 - m)))).resize((${size}, ${size}), Image.LANCZOS).save(${JSON.stringify(out)}, 'WEBP', quality=82, method=6)`,
  ]);
}

for (const set of wanted.length ? wanted : Object.keys(SETS)) {
  const { art, size } = SETS[set];
  const jobs = Object.entries(art);
  // A few at a time: quick enough, and gentle on the queue.
  for (let i = 0; i < jobs.length; i += 4) {
    await Promise.all(jobs.slice(i, i + 4).map(([id, prompt]) => make(set, id, prompt, size).catch((e) => console.error(`FAILED ${set}/${id}: ${e.message}`))));
  }
}
// The shop signs' sheet: every picture in a grid, in the order the manifest lists them, and
// beside it the list of which sign each cell is for, for the game to read.
if (!wanted.length || wanted.includes('shops')) {
  const names = Object.keys(manifest.SHOP_ART);
  const cols = 8;
  const cell = SETS.shops.size;
  // The printed signs made a sheet at a time (make-patches.mjs signs) where there are any; else the ones painted singly.
  const files = names.map((n) => {
    const printed = `${ROOT}tools/art/cache/shops/print/${slug(n)}.webp`;
    return existsSync(printed) ? printed : `${ROOT}tools/art/cache/shops/small/${slug(n)}.png`;
  });
  if (files.every((f) => existsSync(f))) {
    execFileSync('python3', [
      '-c',
      `
from PIL import Image
import json, math
files = json.loads(${JSON.stringify(JSON.stringify(files))})
cols, cell = ${cols}, ${cell}
rows = math.ceil(len(files) / cols)
sheet = Image.new('RGB', (cols * cell, rows * cell), (255, 253, 247))
for i, f in enumerate(files):
    im = Image.open(f).convert('RGBA').resize((cell, cell), Image.LANCZOS)
    sheet.paste(im, ((i % cols) * cell, (i // cols) * cell), im)
sheet.save(${JSON.stringify(`${ROOT}public/art/shop-signs.webp`)}, 'WEBP', quality=84, method=6)
`,
    ]);
    const { writeFileSync } = await import('node:fs');
    writeFileSync(
      `${ROOT}src/world/shopSignArt.ts`,
      `// Written by tools/art/make-art.mjs: which picture on the shop signs' sheet is for which sign. Not edited by hand.\nexport const SHOP_SIGN_COLS = ${cols};\nexport const SHOP_SIGN_ART: readonly string[] = ${JSON.stringify(names, null, 2)};\n`,
    );
    console.log(`shop signs' sheet: ${names.length} pictures`);
  } else console.error('some shop sign pictures are missing; the sheet was not made');
}
console.log(`${made} new picture(s) asked of fal`);
