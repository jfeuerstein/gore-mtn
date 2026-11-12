#!/usr/bin/env node
// Make the game's generated 3D models from tools/models/manifest.mjs.
//
//   NODE_USE_ENV_PROXY=1 node tools/models/make-models.mjs [id ...] [--redo id,id] [--bump n]
//
// For each model: a picture is painted, a shape is made of the picture, and
// tools/models/convert.py turns the shape into the game's look. Most are painted and shaped
// through fal. A model marked `by: 'tripo'` in the manifest is painted and shaped by Tripo
// instead, which makes a better job of plants and anything else made of thin things (about 40
// credits each). The picture and the shape are kept in tools/models/cache/ (not in the
// repository), so running this again costs nothing and a change to the converter can be tried
// on every model at once. What the game loads is one small file, public/models/park.json,
// holding every model.
//
// Needs Python with the packages in tools/requirements.txt for the converter.
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { run, save } from '../art/fal.mjs';
import { save as saveTripo, task } from '../art/tripo.mjs';
import { FAL_TRIPO, IMAGE_MODEL, LOOKS, MODELS, SHAPE_LOOK, SHAPE_MODEL, TRIPO } from './manifest.mjs';

const ROOT = new URL('../../', import.meta.url).pathname;
const CACHE = `${ROOT}tools/models/cache`;
const args = process.argv.slice(2);
const redo = new Set((args.find((a, i) => args[i - 1] === '--redo') ?? '').split(',').filter(Boolean));
const bump = Number(args.find((a, i) => args[i - 1] === '--bump') ?? '1');
const wanted = args.filter((a, i) => a in MODELS && !args[i - 1]?.startsWith('--'));
const ids = wanted.length ? wanted : Object.keys(MODELS);
mkdirSync(CACHE, { recursive: true });
let made = 0;
let spent = 0;

async function shape(id) {
  if (MODELS[id].by === 'tripo') return tripoShape(id);
  if (MODELS[id].by === 'fal-tripo') return falTripoShape(id);
  const picture = `${CACHE}/${id}.jpg`;
  const glb = `${CACHE}/${id}.glb`;
  if (redo.has(id) || !existsSync(glb) || !existsSync(picture)) {
    // The same seed for a thing every time, so it can be made again as it was.
    const seed = [...id].reduce((h, ch) => (Math.imul(h, 31) + ch.charCodeAt(0)) >>> 0, 11) % 1000000;
    const painted = await run(IMAGE_MODEL, { prompt: `${MODELS[id].what}. ${MODELS[id].against ? SHAPE_LOOK.replace('plain white background', `plain ${MODELS[id].against} background`) : SHAPE_LOOK}`, image_size: 'square', num_inference_steps: 4, seed: seed + (redo.has(id) ? bump : 0) });
    await save(painted.images[0].url, picture);
    const shaped = await run(SHAPE_MODEL, { image_url: painted.images[0].url }, { timeoutMs: 600000 });
    await save(shaped.model_mesh.url, glb);
    made++;
    console.log(`made ${id}`);
  }
  for (const look of LOOKS) {
    execFileSync('python3', [`${ROOT}tools/models/convert.py`, glb, `${CACHE}/${id}.${look}.json`, '--look', look, '--like', picture, '--turn', String(MODELS[id].turn ?? 180), '--inks', MODELS[id].inks ?? 'animal', '--preview', `${CACHE}/${id}.${look}.png`]);
  }
}

/** A model made by Tripo: a chunky picture of the thing, then a shape of that picture. */
async function tripoShape(id) {
  const picture = `${CACHE}/t-${id}.png`;
  const glb = `${CACHE}/t-${id}.glb`;
  if (redo.has(id) || !existsSync(glb) || !existsSync(picture)) {
    const painted = await task('generation/text-to-image', { prompt: `${MODELS[id].what}, ${TRIPO.look}`, model: TRIPO.image, size: '1024x1024', quality: 'medium', output_format: 'png' });
    await saveTripo(painted.output.generated_image_url, picture);
    // The shape is asked for by the picture's own task, so nothing has to be uploaded.
    const shaped = await task('generation/image-to-model', { input: painted.task_id, model: TRIPO.shape, texture: true, pbr: false, texture_quality: 'standard', face_limit: 30000 });
    await saveTripo(shaped.output.model_url ?? shaped.output.pbr_model_url, glb);
    spent += (painted.credits_consumed ?? 0) + (shaped.credits_consumed ?? 0);
    console.log(`made ${id} with Tripo`);
  }
  for (const look of LOOKS) {
    execFileSync('python3', [`${ROOT}tools/models/convert.py`, glb, `${CACHE}/${id}.${look}.json`, '--look', look, '--like', picture, '--turn', String(MODELS[id].turn ?? TRIPO.turn), '--inks', MODELS[id].inks ?? 'animal', '--preview', `${CACHE}/${id}.${look}.png`]);
  }
}

/** A made thing: a chunky picture of it painted through fal, and a shape of the picture from Tripo's model, also through fal. */
async function falTripoShape(id) {
  const picture = `${CACHE}/ft-${id}.png`;
  const glb = `${CACHE}/ft-${id}.glb`;
  const look = MODELS[id].against ? FAL_TRIPO.look.replace('plain white background', `plain ${MODELS[id].against} background`) : FAL_TRIPO.look;
  if (redo.has(id) || !existsSync(glb) || !existsSync(picture)) {
    let url = null;
    if (redo.has(id) || !existsSync(picture) || !existsSync(`${picture}.url`)) {
      const painted = await run(FAL_TRIPO.image, { prompt: `${MODELS[id].what}, ${look}`, image_size: '1024x1024', quality: 'medium', background: 'opaque', output_format: 'png', num_images: 1 });
      url = painted.images[0].url;
      await save(url, picture);
      writeFileSync(`${picture}.url`, url);
    } else url = readFileSync(`${picture}.url`, 'utf8');
    const shaped = await run(FAL_TRIPO.shape, { image_url: url, texture: true, pbr: false, texture_quality: 'standard', geometry_quality: 'standard', face_limit: 30000, ...(redo.has(id) ? { model_seed: bump } : {}) }, { timeoutMs: 900000 });
    await save((shaped.model_mesh ?? shaped.base_model ?? shaped.pbr_model).url, glb);
    made++;
    console.log(`made ${id} with Tripo, through fal`);
  }
  for (const look of LOOKS) {
    const out = `${CACHE}/${id}.${look}.json`;
    execFileSync('python3', [`${ROOT}tools/models/convert.py`, glb, out, '--look', look, '--like', picture, '--turn', String(MODELS[id].turn ?? FAL_TRIPO.turn), '--inks', MODELS[id].inks ?? 'made', '--faces', String(MODELS[id].faces ?? 1200), '--preview', `${CACHE}/${id}.${look}.png`]);
    // An ink that came out wrong for what the thing is made of (brass that printed as paper) is put right by name.
    const inks = MODELS[id].reink;
    if (inks) {
      const model = JSON.parse(readFileSync(out, 'utf8'));
      model.p = model.p.map((ink) => inks[ink] ?? ink);
      writeFileSync(out, JSON.stringify(model));
    }
  }
}

// A few at a time: a shape takes half a minute.
const theirs = ids.filter((id) => MODELS[id].by === 'tripo');
const ours = ids.filter((id) => MODELS[id].by !== 'tripo');
// (Those shaped by Tripo through fal go with the rest: fal takes several at once.)
for (let i = 0; i < ours.length; i += 4) {
  await Promise.all(ours.slice(i, i + 4).map((id) => shape(id).catch((e) => console.error(`FAILED ${id}: ${e.message}`))));
}
// Tripo's one at a time, as the account allows.
for (const id of theirs) await shape(id).catch((e) => console.error(`FAILED ${id} with Tripo: ${e.message.slice(0, 300)}`));
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
console.log(`${made} new model(s) asked of fal${spent ? `, ${spent} Tripo credits spent` : ''}`);
