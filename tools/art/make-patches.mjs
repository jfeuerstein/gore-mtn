#!/usr/bin/env node
// Make the Book's patches from tools/art/manifest.mjs, a sheet at a time, with Tripo's image model.
//
//   NODE_USE_ENV_PROXY=1 node tools/art/make-patches.mjs [set ...] [--redo set,set]
//
// Patches asked for one by one come out as so many different patches. Asked for sixteen to a
// sheet, to one brief, they come out as one set: the same cloth, border and stitch, in the
// game's own colours. Each sheet is kept in tools/art/cache/sheets/ (not in the repository) and
// cut into its patches, which go to public/art/<set>/<id>.webp with nothing behind them.
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync } from 'node:fs';
import { PATCH_BRIEF, PATCH_SETS } from './manifest.mjs';
import { save, task } from './tripo.mjs';

const ROOT = new URL('../../', import.meta.url).pathname;
const CACHE = `${ROOT}tools/art/cache/sheets`;
const MODEL = 'chat_image_2.5_flare';
const COLS = 4;
/** The size each patch is saved at, in pixels. */
const SIZE = 176;
const slug = (id) => id.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const args = process.argv.slice(2);
const redo = new Set((args.find((a, i) => args[i - 1] === '--redo') ?? '').split(',').filter(Boolean));
const wanted = args.filter((a) => a in PATCH_SETS);
mkdirSync(CACHE, { recursive: true });
let asked = 0;

/** One sheet: up to sixteen patches. A short last row is filled out with stars, which are thrown away. Gives back the ids it could not find on it. */
async function sheet(set, n, ids) {
  const { border, subjects, into, dir, brief } = PATCH_SETS[set];
  const file = `${CACHE}/${slug(set)}-${n}.png`;
  // A few patches are a sheet of two by two; otherwise four across.
  const cols = ids.length <= 4 ? 2 : COLS;
  const rows = Math.max(2, Math.ceil(ids.length / cols));
  const cells = cols * rows;
  if (redo.has(set) || !existsSync(file)) {
    const said = [...ids.map((id) => subjects[id]), ...Array(cells - ids.length).fill('a plain gold star')];
    const body = { prompt: (brief ?? PATCH_BRIEF)(cells, cols, rows, border, said), model: MODEL, size: `${cols * 512}x${rows * 512}`, quality: 'medium', background: 'transparent', output_format: 'png' };
    if (body.prompt.length > 1800) throw new Error(`the brief is ${body.prompt.length} characters; the model takes 1800`);
    // Only so many generations may be asked for at once: wait and ask again.
    let done;
    for (let tries = 0; ; tries++) {
      try {
        done = await task('generation/text-to-image', body);
        break;
      } catch (e) {
        if (tries >= 6 || !String(e.message).includes('(429)')) throw e;
        await new Promise((r) => setTimeout(r, 20000));
      }
    }
    await save(done.output.generated_image_url, file);
    asked++;
    console.log(`made ${set} sheet ${n} (${done.credits_consumed} credits)`);
  }
  // Cut the sheet into its patches, and say which of them were not on it.
  // A set may be kept somewhere of its own (the shop signs go to the cache, to be laid out on one sheet).
  const out = dir ? `${ROOT}${dir}` : `${ROOT}public/art/${into ?? set}`;
  mkdirSync(out, { recursive: true });
  return JSON.parse(execFileSync('python3', [`${ROOT}tools/art/cut-sheet.py`, file, out, String(cols), String(SIZE), JSON.stringify(ids.map(slug))], { encoding: 'utf8' }));
}

for (const set of wanted.length ? wanted : Object.keys(PATCH_SETS)) {
  const ids = Object.keys(PATCH_SETS[set].subjects);
  const missing = [];
  // One sheet at a time: that is all the account may ask for at once.
  for (let i = 0; i < ids.length; i += 16) {
    const n = i / 16 + 1;
    try {
      missing.push(...(await sheet(set, n, ids.slice(i, i + 16))));
    } catch (e) {
      console.error(`FAILED ${set} sheet ${n}: ${e.message.slice(0, 300)}`);
    }
  }
  // A sheet sometimes comes back a patch or a row short. Whatever was left off is asked for once more, on a sheet of its own.
  if (missing.length) {
    const back = new Map(ids.map((id) => [slug(id), id]));
    const still = await sheet(set, 'more', missing.map((m) => back.get(m))).catch((e) => (console.error(`FAILED ${set}, the extra sheet: ${e.message.slice(0, 300)}`), missing));
    if (still.length) console.error(`MISSING from ${set}: ${still.join(', ')}`);
  }
}
console.log(`${asked} new sheet(s) asked of Tripo`);
