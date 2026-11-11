#!/usr/bin/env node
// Make the game's generated art from tools/art/manifest.mjs.
//
//   NODE_USE_ENV_PROXY=1 node tools/art/make-art.mjs [people|minerals|species] [--redo id,id] [--bump n]
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
  minerals: { art: manifest.MINERAL_ART, size: 384 },
  species: { art: manifest.SPECIES_ART ?? {}, size: 384 },
  places: { art: manifest.PLACE_ART ?? {}, size: 384 },
};
const args = process.argv.slice(2);
const redo = new Set((args.find((a, i) => args[i - 1] === '--redo') ?? '').split(',').filter(Boolean));
const wanted = args.filter((a) => a in SETS);
// With --redo, a different number here gives a different picture of the same thing.
const bump = args.find((a, i) => args[i - 1] === '--bump') ?? '1';
let made = 0;

async function make(set, id, prompt, size) {
  const raw = `${ROOT}tools/art/cache/${set}/${id}.webp`;
  const out = `${ROOT}public/art/${set}/${id}.webp`;
  if (redo.has(id) || !existsSync(raw)) {
    // The same seed for a subject every time, so a picture can be made again as it was.
    const seed = [...`${set}/${id}`].reduce((h, ch) => (Math.imul(h, 31) + ch.charCodeAt(0)) >>> 0, 7) % 1000000;
    const result = await run(manifest.MODEL, { prompt: `${prompt}. ${manifest.LOOK}`, image_size: 'square', num_inference_steps: 4, seed: seed + (redo.has(id) ? Number(bump) : 0) });
    await save(result.images[0].url, raw);
    made++;
    console.log(`made ${set}/${id}`);
  } else if (existsSync(out)) {
    return;
  }
  mkdirSync(`${ROOT}public/art/${set}`, { recursive: true });
  // Trim the margins, where the model likes to add a caption or a signature, and shrink to the
  // size the game shows it at. Pillow is already needed by the terrain pipeline.
  const trim = set === 'people' ? 0.04 : 0.08;
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
console.log(`${made} new picture(s) asked of fal`);
