#!/usr/bin/env node
// Make the game's generated 3D models from tools/models/manifest.mjs.
//
//   NODE_USE_ENV_PROXY=1 node tools/models/make-models.mjs [id ...] [--redo id,id] [--bump n] [--tripo id,id]
//
// For each model: a picture is painted (fal), a shape is made of the picture (fal), and
// tools/models/convert.py turns the shape into each of the looks. The picture and the shape
// are kept in tools/models/cache/ (not in the repository), so running this again costs nothing
// and a change to the converter can be tried on every model at once. What the game loads is
// one small file per look, public/models/<look>.json, holding every model in that look.
//
// --tripo makes the named models a second way, to set beside the first: Tripo makes the shape
// straight from the words, already low-poly and plainly coloured, and the converter only tidies
// it (the toy look). Those go to public/models/toy.json. A shape costs Tripo credits, so only the ones named are made.
//
// Needs Python with trimesh, fast-simplification, scipy and Pillow for the converter.
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { run, save } from '../art/fal.mjs';
import { save as saveTripo, task } from '../art/tripo.mjs';
import { IMAGE_MODEL, LOOKS, MODELS, SHAPE_LOOK, SHAPE_MODEL, TRIPO_SHAPE } from './manifest.mjs';

const ROOT = new URL('../../', import.meta.url).pathname;
const CACHE = `${ROOT}tools/models/cache`;
const args = process.argv.slice(2);
const redo = new Set((args.find((a, i) => args[i - 1] === '--redo') ?? '').split(',').filter(Boolean));
const bump = Number(args.find((a, i) => args[i - 1] === '--bump') ?? '1');
const tripo = (args.find((a, i) => args[i - 1] === '--tripo') ?? '').split(',').filter((id) => id in MODELS);
const wanted = args.filter((a, i) => a in MODELS && !args[i - 1]?.startsWith('--'));
// With only --tripo, nothing is asked of fal: the looks are just put together again from what is kept.
const ids = wanted.length ? wanted : tripo.length ? [] : Object.keys(MODELS);
mkdirSync(CACHE, { recursive: true });
let made = 0;

async function shape(id) {
  const picture = `${CACHE}/${id}.jpg`;
  const glb = `${CACHE}/${id}.glb`;
  if (redo.has(id) || !existsSync(glb) || !existsSync(picture)) {
    // The same seed for a thing every time, so it can be made again as it was.
    const seed = [...id].reduce((h, ch) => (Math.imul(h, 31) + ch.charCodeAt(0)) >>> 0, 11) % 1000000;
    const painted = await run(IMAGE_MODEL, { prompt: `${MODELS[id].what}. ${SHAPE_LOOK}`, image_size: 'square', num_inference_steps: 4, seed: seed + (redo.has(id) ? bump : 0) });
    await save(painted.images[0].url, picture);
    const shaped = await run(SHAPE_MODEL, { image_url: painted.images[0].url }, { timeoutMs: 600000 });
    await save(shaped.model_mesh.url, glb);
    made++;
    console.log(`made ${id}`);
  }
  for (const look of LOOKS) {
    execFileSync('python3', [`${ROOT}tools/models/convert.py`, glb, `${CACHE}/${id}.${look}.json`, '--look', look, '--like', picture, '--turn', String(MODELS[id].turn ?? 180), '--preview', `${CACHE}/${id}.${look}.png`]);
  }
}

/** The same animal as Tripo shapes it from the words alone. */
async function tripoShape(id) {
  const glb = `${CACHE}/tripo-${id}.glb`;
  const picture = `${CACHE}/tripo-${id}.webp`;
  if (redo.has(id) || !existsSync(glb)) {
    const done = await task('generation/text-to-model', { prompt: `${MODELS[id].what}, ${TRIPO_SHAPE.words}`, ...TRIPO_SHAPE.ask });
    await saveTripo(done.output.model_url ?? done.output.pbr_model_url, glb);
    if (done.output.rendered_image_url) await saveTripo(done.output.rendered_image_url, picture);
    console.log(`made ${id} with Tripo (${done.credits_consumed ?? '?'} credits)`);
  }
  execFileSync('python3', [`${ROOT}tools/models/convert.py`, glb, `${CACHE}/tripo-${id}.json`, '--look', 'toy', '--turn', String(MODELS[id].tripoTurn ?? TRIPO_SHAPE.turn), '--preview', `${CACHE}/tripo-${id}.png`]);
}

// A few at a time: a shape takes half a minute.
for (let i = 0; i < ids.length; i += 4) {
  await Promise.all(ids.slice(i, i + 4).map((id) => shape(id).catch((e) => console.error(`FAILED ${id}: ${e.message}`))));
}
// One file for each look, with every model that has been made in it.
mkdirSync(`${ROOT}public/models`, { recursive: true });
for (const look of LOOKS) {
  const all = {};
  for (const id of Object.keys(MODELS)) {
    const file = `${CACHE}/${id}.${look}.json`;
    if (existsSync(file)) all[id] = JSON.parse(readFileSync(file, 'utf8'));
  }
  writeFileSync(`${ROOT}public/models/${look}.json`, JSON.stringify(all));
  console.log(`${look}: ${Object.keys(all).length} models`);
}
// Tripo's, one at a time, as the account allows; then the file of every one made so far.
for (const id of tripo) await tripoShape(id).catch((e) => console.error(`FAILED ${id} with Tripo: ${e.message.slice(0, 300)}`));
const theirs = {};
for (const id of Object.keys(MODELS)) {
  const file = `${CACHE}/tripo-${id}.json`;
  if (existsSync(file)) theirs[id] = JSON.parse(readFileSync(file, 'utf8'));
}
if (Object.keys(theirs).length) {
  writeFileSync(`${ROOT}public/models/toy.json`, JSON.stringify(theirs));
  console.log(`toy: ${Object.keys(theirs).length} models`);
}
console.log(`${made} new model(s) asked of fal`);
