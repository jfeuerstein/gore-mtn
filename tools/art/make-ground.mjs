#!/usr/bin/env node
// Make the sheets of marks that are printed on the ground near the camera.
//
//   NODE_USE_ENV_PROXY=1 node tools/art/make-ground.mjs [--redo kind,kind] [--bump n]
//
// Each kind of mark (leaves, tufts, flower heads ...) is asked of fal once, as a sheet of
// separate black shapes on white, and kept in tools/art/cache/ground/ (not in the
// repository). ground-sheet.py then cuts the shapes out and scatters them over a sheet that
// repeats, for each season: public/art/ground/<season>.png, four kinds to a sheet. Running
// this again asks fal for nothing, and lays the sheets out again from what is kept.
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { run, save } from './fal.mjs';
import * as manifest from './manifest.mjs';

const ROOT = new URL('../../', import.meta.url).pathname;
const args = process.argv.slice(2);
const redo = new Set((args.find((a, i) => args[i - 1] === '--redo') ?? '').split(',').filter(Boolean));
const bump = args.find((a, i) => args[i - 1] === '--bump') ?? '1';

for (const [kind, prompt] of Object.entries(manifest.GROUND_ART)) {
  const raw = `${ROOT}tools/art/cache/ground/${kind}.webp`;
  if (!redo.has(kind) && existsSync(raw)) continue;
  // The same seed for a kind every time, so a sheet can be made again as it was.
  const seed = [...`ground/${kind}`].reduce((h, ch) => (Math.imul(h, 31) + ch.charCodeAt(0)) >>> 0, 7) % 1000000;
  const result = await run(manifest.MODEL, {
    prompt: `${prompt}. ${manifest.GROUND_LOOK}`,
    image_size: 'square_hd',
    num_inference_steps: 4,
    seed: seed + (redo.has(kind) ? Number(bump) : 0),
  });
  await save(result.images[0].url, raw);
  console.log(`made ground/${kind}`);
}
if (existsSync(`${ROOT}tools/art/ground-sheet.py`)) execFileSync('python3', [`${ROOT}tools/art/ground-sheet.py`, `${ROOT}tools/art/cache/ground`, `${ROOT}public/art/ground`], { stdio: 'inherit' });
