import * as THREE from 'three/webgpu';
import { CAIRN_TALL, secretById, type Secret, type SecretKind, thereNow } from '../game/secrets';
import { GENTLE_SPEED } from '../game/wildlife';
import { madeModel } from './critterModels';
import { modelGeometry, type ModelFile } from './modelFiles';
import type { Flue } from './smoke';
import { runCorridor, type Run } from './unmarked';
import { lit } from '../look/material';
import type { Season } from '../look/season';
import type { SecretSite } from './secretSites';
import { blocks, placed, type Block } from './shapes';

const BARK = 0x5a3f2c;
const TIMBER = 0x7a5236;
const TIN = 0x7c8794;
const BRASS = 0xc98f1f;
const STONE = 0x7c8794;
const DARK = 0x2a2e36;
const RUST = 0x9a4a2a;
const GARNET = 0x8f2f2a;
/** A course so tall that whatever is given it has none: iron, tin and stone are smooth, not boarded. */
const SMOOTH = 1e6;
/** How far a thing that meets the ground goes on down below it, so that a slope leaves no gap. */
const DEEP = 2.5;
const sunk = (size: [number, number, number], at: [number, number, number], colour: number, more: Partial<Block> = {}): Block => ({ size: [size[0], size[1] + DEEP, size[2]], at: [at[0], at[1] - DEEP / 2, at[2]], colour, ...more });

/** A geometry in one colour, to be joined with blocks. */
function tinted(geo: THREE.BufferGeometry, colour: number): THREE.BufferGeometry {
  const flat = geo.index ? geo.toNonIndexed() : geo;
  flat.computeVertexNormals();
  const c = new THREE.Color(colour);
  flat.setAttribute('color', new THREE.Float32BufferAttribute(Array.from({ length: flat.getAttribute('position').count }, () => [c.r, c.g, c.b]).flat(), 3));
  return flat;
}

/** What each kind of secret looks like, its front at its own +z. A room has nothing of its own: it is a door. */
function model(secret: Secret, season: Season): { list: Block[]; extra: THREE.BufferGeometry[] } {
  const list: Block[] = [];
  const extra: THREE.BufferGeometry[] = [];
  if (secret.kind === 'register') {
    // A tin box on a post, with a lid that slopes to shed the rain.
    list.push(sunk([0.14, 1.15, 0.14], [0, 0.575, 0], BARK), { size: [0.52, 0.34, 0.36], at: [0, 1.3, 0.02], colour: TIN }, { size: [0.6, 0.05, 0.46], at: [0, 1.5, 0.04], colour: DARK, tip: 0.22 }, { size: [0.3, 0.12, 0.02], at: [0, 1.3, 0.21], colour: 0xfbf8ee });
  } else if (secret.kind === 'plaque') {
    // A brass plate on a short post, tipped back to be read, with three lines of lettering.
    list.push(sunk([0.12, 0.7, 0.12], [0, 0.35, 0], BARK), { size: [0.66, 0.44, 0.05], at: [0, 0.86, 0.06], colour: BRASS, tip: -0.5 });
    for (let i = 0; i < 3; i++) list.push({ size: [i === 0 ? 0.4 : 0.5, 0.035, 0.02], at: [0, 0.96 - i * 0.1, 0.13 - i * 0.05], colour: DARK, tip: -0.5 });
  } else if (secret.kind === 'cairn') {
    // Only the flat stone the first one is set on: the stones themselves are the player's, and are drawn as they are added.
    list.push({ size: [1.0, 0.16, 0.9], at: [0, 0.04, 0], colour: STONE, turn: 0.4 });
  } else if (secret.kind === 'bell') {
    // A ship's bell hung in a timber frame, with a rope to ring it by.
    for (const sx of [-0.6, 0.6]) list.push(sunk([0.16, 2.1, 0.16], [sx, 1.05, 0], TIMBER));
    list.push({ size: [1.6, 0.16, 0.2], at: [0, 2.15, 0], colour: TIMBER }, { size: [0.05, 0.3, 0.05], at: [0, 1.95, 0], colour: DARK }, { size: [0.03, 0.7, 0.03], at: [0.02, 1.25, 0.02], colour: 0xe2c99a });
    extra.push(placed(tinted(new THREE.CylinderGeometry(0.13, 0.3, 0.4, 8), 0x7fa9b8), 0, 1.62, 0), placed(tinted(new THREE.CylinderGeometry(0.33, 0.33, 0.05, 8), 0x7fa9b8), 0, 1.42, 0));
  } else if (secret.id === 'working-adit') {
    // The mouth of a tunnel: two posts and a lintel, the dark going back into the hill, garnet in the walls, and an ore cart on its rails.
    for (const sx of [-1.15, 1.15]) list.push(sunk([0.32, 2.3, 0.32], [sx, 1.15, 0], TIMBER));
    list.push({ size: [2.9, 0.34, 0.4], at: [0, 2.45, 0], colour: TIMBER }, sunk([2.0, 2.3, 4], [0, 1.15, -2.15], DARK), sunk([3.4, 3.0, 3.6], [0, 1.5, -2.6], STONE));
    const glints: [number, number][] = [[-0.9, 0.5], [-0.82, 1.3], [-0.7, 1.9], [0.88, 0.8], [0.8, 1.6], [0.6, 2.05], [-0.3, 2.1], [0.92, 0.3]];
    glints.forEach(([x, y], i) => list.push({ size: [0.14, 0.14, 0.1], at: [x, y, -0.2 - (i % 3) * 0.5], colour: i % 2 ? GARNET : 0xc8402d, turn: 0.7 }));
    for (const sx of [-0.35, 0.35]) list.push({ size: [0.07, 0.07, 5], at: [sx, 0.06, 1.2], colour: RUST });
    list.push({ size: [0.9, 0.5, 1.3], at: [0, 0.55, 2.4], colour: RUST }, { size: [0.7, 0.14, 1.0], at: [0, 0.86, 2.4], colour: GARNET });
    for (const sz of [1.95, 2.85]) list.push({ size: [0.95, 0.3, 0.3], at: [0, 0.2, sz], colour: DARK });
  } else if (secret.id === 'working-cellar') {
    // Four walls of fieldstone with no house on them, and the apple tree by the door that is not there.
    for (const [x, z, w, d] of [[0, -2.1, 4.8, 0.55], [0, 2.1, 1.6, 0.55], [-1.9, 2.1, 1.0, 0.55], [1.9, 2.1, 1.0, 0.55], [-2.15, 0, 0.55, 4.2], [2.15, 0, 0.55, 4.2]] as const) list.push(sunk([w, 0.75, d], [x, 0.375, z], STONE));
    list.push({ size: [0.9, 0.12, 0.7], at: [-1.3, 0.1, -1.4], colour: 0xa9b3c0, turn: 0.3 }, sunk([0.3, 2.0, 0.3], [3.4, 1.0, 2.6], BARK));
    if (season === 'winter') {
      for (const [a, len] of [[0.5, 1.3], [-0.6, 1.1], [0.1, 1.5]] as const) list.push({ size: [0.1, len, 0.1], at: [3.4 + Math.sin(a) * 0.5, 2.5, 2.6], colour: BARK, tip: 0, turn: a });
    } else {
      const leaf = season === 'fall' ? 0xc98f1f : 0x4f8a3f;
      list.push({ size: [2.2, 1.5, 2.2], at: [3.4, 2.7, 2.6], colour: leaf }, { size: [1.4, 0.8, 1.4], at: [3.6, 3.6, 2.4], colour: leaf });
      if (season !== 'spring') for (const [x, y, z] of [[2.5, 2.4, 3.4], [4.2, 2.9, 2.2], [3.3, 2.1, 3.75]] as const) list.push({ size: [0.2, 0.2, 0.2], at: [x, y, z], colour: 0xc8402d });
    }
  } else if (secret.id === 'working-rope-tow') {
    // A truck engine on a sled, a wheel as tall as a person, and a post the rope ran up to.
    for (const sx of [-0.7, 0.7]) list.push({ size: [0.2, 0.2, 3.2], at: [sx, 0.1, 0], colour: TIMBER });
    list.push({ size: [1.3, 0.85, 1.0], at: [0, 0.65, -0.6], colour: RUST }, { size: [0.9, 0.3, 0.6], at: [0, 1.2, -0.6], colour: DARK }, { size: [0.08, 0.9, 0.08], at: [0.75, 0.8, 0.5], colour: DARK, tip: 0.3 }, { size: [0.34, 0.5, 0.12], at: [0.76, 1.05, 0.62], colour: 0xb3472d });
    const wheel = tinted(new THREE.CylinderGeometry(0.95, 0.95, 0.14, 12), DARK);
    wheel.rotateZ(Math.PI / 2);
    extra.push(placed(wheel, -0.2, 1.05, 0.75), placed(tinted(new THREE.CylinderGeometry(0.2, 0.2, 0.2, 8).rotateZ(Math.PI / 2), RUST), -0.2, 1.05, 0.75));
    list.push(sunk([0.24, 3.4, 0.24], [-0.2, 1.7, 7], BARK), { size: [0.5, 0.5, 0.1], at: [-0.2, 3.2, 7.15], colour: DARK }, { size: [0.05, 0.05, 6.4], at: [-0.2, 2.5, 3.9], colour: 0xe2c99a, tip: -0.2 });
  }
  else if (secret.kind === 'den') {
    // A bank of earth with a hole in its face, and across the top of it the birch whose roots the hole is under.
    const cap = season === 'winter' ? SNOW : season === 'fall' ? 0xa9763f : 0x5a6b3a;
    list.push(sunk([5.0, 1.25, 3.4], [0, 0.62, -1.7], EARTH), { size: [5.1, 0.22, 3.5], at: [0, 1.34, -1.7], colour: cap });
    list.push(sunk([1.3, 0.8, 1.2], [-1.9, 0.4, 0.3], EARTH, { turn: 0.3 }), sunk([1.1, 0.6, 1.0], [1.8, 0.3, 0.25], EARTH, { turn: -0.3 }));
    list.push({ size: [1.25, 0.95, 0.5], at: [0, 0.48, -0.2], colour: DARK }, { size: [1.6, 0.22, 0.7], at: [0, 1.05, -0.1], colour: 0x4a3326 });
    // The birch, lying along the top, white with dark marks; its roots stood up at the near end.
    list.push({ size: [0.62, 0.62, 6.6], at: [1.2, 1.8, -2.2], colour: BIRCH, turn: 1.1 });
    for (const t of [-2.2, -0.7, 0.8, 2.2]) list.push({ size: [0.64, 0.64, 0.3], at: [1.2 + Math.sin(1.1) * t, 1.8, -2.2 + Math.cos(1.1) * t], colour: DARK, turn: 1.1 });
    for (const [dy, tip, turn] of [[0.9, 0.5, 0.2], [0.75, -0.5, 1.9], [0.2, 1.2, 0.9], [0.3, -1.1, 1.4]] as const) list.push({ size: [0.2, 1.3, 0.2], at: [1.2 - Math.sin(1.1) * 3.4, 1.8 + dy * 0.6, -2.2 - Math.cos(1.1) * 3.4], colour: 0x4a3326, tip, turn });
    list.push({ size: [1.3, 1.3, 0.3], at: [1.2 - Math.sin(1.1) * 3.35, 1.8, -2.2 - Math.cos(1.1) * 3.35], colour: 0x4a3326, turn: 1.1 });
  } else if (secret.kind === 'nest') {
    // A bowl of reeds lined with down, in among the reeds that are still standing.
    for (let i = 0; i < 11; i++) {
      const a = Math.PI * 0.55 + (i / 10) * Math.PI * 1.9;
      const tall = 0.9 + ((i * 7) % 5) * 0.14;
      list.push({ size: [0.14, tall, 0.14], at: [Math.sin(a) * 1.0, tall / 2, Math.cos(a) * 1.0 - 0.2], colour: i % 3 ? 0xc9a36b : 0x4f8a3f, tip: Math.cos(a) * 0.12 });
      if (i % 4 === 1) list.push({ size: [0.2, 0.34, 0.2], at: [Math.sin(a) * 1.0, tall + 0.1, Math.cos(a) * 1.0 - 0.2], colour: 0x6b4a33 });
    }
    list.push({ size: [0.95, 0.24, 0.95], at: [0, 0.12, 0], colour: 0x9a7b5c, turn: 0.4 }, { size: [0.62, 0.08, 0.62], at: [0, 0.26, 0], colour: 0xfbf8ee, turn: 0.4 }, { size: [0.16, 0.1, 0.12], at: [0.12, 0.32, 0.1], colour: 0xd3dae4, turn: 0.8 });
  } else if (secret.kind === 'shack') {
    // A sugar shack: board walls, a roof with a vent along its ridge to let the steam out, a woodpile as long as itself.
    const boiling = season === 'spring';
    const top = season === 'winter' ? SNOW : 0x5c6672;
    list.push(sunk([4.4, 2.5, 3.4], [0, 1.25, 0], 0x8a6a4a), { size: [4.5, 0.5, 0.2], at: [0, 2.75, 1.6], colour: 0x8a6a4a }, { size: [4.5, 0.5, 0.2], at: [0, 2.75, -1.6], colour: 0x8a6a4a });
    for (const sz of [-1, 1]) list.push({ size: [5.0, 0.16, 2.35], at: [0, 3.05, sz * 0.95], colour: top, tip: sz * 0.5 });
    list.push({ size: [2.0, 0.55, 0.9], at: [0, 3.75, 0], colour: 0x6b4a33 }, { size: [2.4, 0.12, 1.3], at: [0, 4.08, 0], colour: top });
    list.push({ size: [0.95, 1.85, 0.08], at: [-0.5, 0.95, 1.72], colour: 0x6b4a33 }, { size: [0.3, 0.36, 0.03], at: [-0.5, 1.4, 1.78], colour: 0xfbf8ee, turn: 0.05 }, { size: [0.9, 0.7, 0.06], at: [1.25, 1.5, 1.72], colour: boiling ? 0xf2d16b : DARK });
    list.push(sunk([0.34, 1.9, 0.34], [-1.6, 3.6, -0.7], DARK));
    list.push(sunk([3.2, 1.2, 0.8], [3.6, 0.6, 0.2], 0xa9763f));
    for (let i = 0; i < 6; i++) list.push({ size: [0.36, 0.36, 0.82], at: [2.3 + i * 0.52, 0.3 + (i % 2) * 0.5, 0.2], colour: 0xe2c99a });
    if (boiling) for (const [x, z] of [[-1.7, 2.3], [-1.2, 2.6], [1.9, 2.4]] as const) list.push({ size: [0.36, 0.42, 0.36], at: [x, 0.21, z], colour: TIN }, { size: [0.3, 0.04, 0.3], at: [x, 0.43, z], colour: 0xe2c99a });
  } else if (secret.kind === 'ribbon') {
    list.push(...ribboned(3.2));
  } else if (secret.kind === 'light') {
    // An iron post with an arm, a lantern hung from the arm (bigger than life, to be seen across the quarry), and a nail lower down with something hung on it.
    list.push(sunk([0.2, 3.3, 0.2], [0, 1.65, 0], DARK), { size: [1.1, 0.12, 0.12], at: [0.5, 3.2, 0], colour: DARK }, { size: [0.06, 0.3, 0.06], at: [0.95, 3.0, 0], colour: DARK });
    list.push({ size: [0.62, 0.1, 0.62], at: [0.95, 2.86, 0], colour: DARK }, { size: [0.3, 0.14, 0.3], at: [0.95, 2.96, 0], colour: DARK }, { size: [0.62, 0.1, 0.62], at: [0.95, 2.1, 0], colour: DARK });
    for (const [x, z] of [[0.68, -0.27], [1.22, -0.27], [0.68, 0.27], [1.22, 0.27]] as const) list.push({ size: [0.06, 0.7, 0.06], at: [x, 2.48, z], colour: DARK });
    list.push({ size: [0.42, 0.16, 0.08], at: [0, 1.5, 0.14], colour: 0x2b62c9 }, { size: [0.08, 0.22, 0.05], at: [0.16, 1.24, 0.14], colour: 0x7fa9b8 });
  }
  return { list, extra };
}

const EARTH = 0x6b5a4a;
const BIRCH = 0xf1e9cf;
const SNOW = 0xf2f5fa;
const TAPE = 0xe8742a;

/** A birch with a strip of orange ribbon tied round it. */
function ribboned(tall: number): Block[] {
  const list: Block[] = [
    sunk([0.34, tall, 0.34], [0, tall / 2, 0], BIRCH),
    { size: [0.5, 0.3, 0.5], at: [0, tall * 0.56, 0], colour: TAPE },
    { size: [0.16, 0.8, 0.06], at: [0.3, tall * 0.56 - 0.45, 0.2], colour: TAPE, tip: 0.3 },
    { size: [0.16, 0.6, 0.06], at: [-0.28, tall * 0.56 - 0.36, 0.22], colour: TAPE, tip: 0.2, turn: 0.5 },
  ];
  for (let y = 0.5; y < tall - 0.3; y += 0.8) list.push({ size: [0.36, 0.1, 0.22], at: [0, y, (y * 7) % 2 > 1 ? 0.07 : -0.07], colour: DARK });
  return list;
}

/** What leads to something in the trees, set down along the way to it: a fox's prints in the snow, or buckets on the maples. */
function leadPieces(marks: 'tracks' | 'buckets', pts: readonly number[], heightAt: (x: number, z: number) => number, trunks: { x: number; z: number; turn?: number; tall?: number }[], made = false): THREE.BufferGeometry[] {
  const pieces: THREE.BufferGeometry[] = [];
  let gone = 0;
  let next = marks === 'tracks' ? 2 : 9;
  let n = 0;
  for (let i = 0; i + 3 < pts.length; i += 2) {
    const ax = pts[i] as number;
    const az = pts[i + 1] as number;
    const dx = (pts[i + 2] as number) - ax;
    const dz = (pts[i + 3] as number) - az;
    const seg = Math.hypot(dx, dz);
    if (seg === 0) continue;
    while (next <= gone + seg) {
      const t = (next - gone) / seg;
      const side = n % 2 ? 1 : -1;
      if (marks === 'tracks') {
        // A fox walks one foot in front of the other: a line of single prints, a hand apart side to side.
        const x = ax + dx * t + (-dz / seg) * side * 0.09;
        const z = az + dz * t + (dx / seg) * side * 0.09;
        pieces.push(placed(blocks([{ size: [0.26, 0.08, 0.36], at: [0, 0.02, 0], colour: 0x5e7f9a }], [], SMOOTH), x, heightAt(x, z), z, Math.atan2(dx, dz)));
        next += 0.95;
      } else {
        // A maple a few steps off the way, to one side and then the other, with a bucket hung at the height of a hand.
        const x = ax + dx * t + (-dz / seg) * side * 2.6;
        const z = az + dz * t + (dx / seg) * side * 2.6;
        const tall = 6.5 + (n % 3) * 0.9;
        const list: Block[] = [sunk([0.5, tall, 0.5], [0, tall / 2, 0], 0x6b5a4a), { size: [0.36, 0.42, 0.34], at: [0, 1.25, 0.42], colour: TIN }, { size: [0.44, 0.05, 0.44], at: [0, 1.5, 0.44], colour: DARK, tip: 0.25 }, { size: [0.05, 0.05, 0.2], at: [0, 1.52, 0.3], colour: DARK }];
        for (const [y, a, len] of [[tall * 0.62, 0.8, 2.2], [tall * 0.78, -1.9, 1.8], [tall * 0.9, 2.6, 1.4], [tall, 0.2, 1.3]] as const) list.push({ size: [0.16, len, 0.16], at: [Math.sin(a) * 0.55, y + len * 0.3, Math.cos(a) * 0.55], colour: 0x6b5a4a, tip: 0.75, turn: a });
        // The bucket faces the way that is walked. (A made maple is stood there by whoever asked; this is the one built from blocks.)
        const turn = Math.atan2(-(-dz / seg) * side, -(dx / seg) * side);
        if (!made) pieces.push(placed(blocks(list, [], SMOOTH), x, heightAt(x, z), z, turn));
        trunks.push({ x, z, turn, tall });
        next += 8.5;
      }
      n++;
    }
    gone += seg;
  }
  return pieces;
}

/**
 * The model each secret has that was made outside the game (see `thing-*` in
 * tools/models/manifest.mjs), and how tall it stands, in metres. The owner found the same
 * things built from blocks too blocky beside the animals; the blocks above are what is drawn
 * when the made models are not loaded (`models=blocks`).
 */
function madeFor(secret: Secret, season: Season): { id: string; tall: number } | null {
  switch (secret.kind) {
    case 'register':
      return { id: 'thing-register', tall: 1.7 };
    case 'plaque':
      return { id: 'thing-plaque', tall: 1.15 };
    case 'bell':
      return { id: 'thing-bell', tall: 2.6 };
    case 'den':
      return { id: season === 'winter' ? 'thing-den-snow' : 'thing-den', tall: 2.2 };
    case 'nest':
      return { id: 'thing-nest', tall: 1.5 };
    case 'shack':
      return season === 'winter' ? { id: 'thing-shack-snow', tall: 3.9 } : { id: 'thing-shack', tall: 4.2 };
    case 'ribbon':
      // (A birch stump, as it came out: about as wide as it is tall.)
      return { id: 'thing-ribbon', tall: 1.7 };
    case 'light':
      return { id: 'thing-lantern', tall: 3.5 };
    case 'working':
      return secret.id === 'working-adit' ? { id: 'thing-adit', tall: 3.6 } : secret.id === 'working-cellar' ? { id: 'thing-cellar', tall: 3.2 } : secret.id === 'working-rope-tow' ? { id: 'thing-rope-tow', tall: 2.2 } : null;
    default:
      return null;
  }
}

/**
 * The glass of a made lantern, as a shape of its own: whatever of the model is yellow, stood a
 * finger's width proud of it, to be drawn unlit after dark so that the panes themselves burn.
 * Null if none of it is yellow.
 */
function glassOf(file: ModelFile, tall: number): THREE.BufferGeometry | null {
  const yellow = file.p.map((hex) => {
    const c = new THREE.Color(hex);
    return c.r > 0.75 && c.g > 0.55 && c.b < 0.6;
  });
  const k = tall / 1000;
  const positions: number[] = [];
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const c = new THREE.Vector3();
  const n = new THREE.Vector3();
  const corner = (i: number, into: THREE.Vector3): THREE.Vector3 => into.set((file.v[i * 3] as number) * k, (file.v[i * 3 + 1] as number) * k, (file.v[i * 3 + 2] as number) * k);
  for (let t = 0; t < file.f.length; t += 3) {
    if (!yellow[file.c[t / 3] as number]) continue;
    corner(file.f[t] as number, a);
    corner(file.f[t + 1] as number, b);
    corner(file.f[t + 2] as number, c);
    n.copy(b).sub(a).cross(c.clone().sub(a)).normalize().multiplyScalar(0.03);
    for (const p of [a, b, c]) positions.push(p.x + n.x, p.y + n.y, p.z + n.z);
  }
  if (positions.length === 0) return null;
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.computeBoundingSphere();
  return geometry;
}

/** How far off a made thing is still drawn, in metres. */
const SEEN_FROM = 420;

/** How close the player must come to a secret for it to be offered, by kind, in metres. */
const REACH: Record<SecretKind, number> = { register: 3, plaque: 3, working: 6.5, room: 3.6, cairn: 3.2, bell: 3, den: 4.5, nest: 3.6, shack: 5.2, ribbon: 3.4, light: 3.6 };
/** How near a shy thing is when a hurry sends it off, and how far the player must go before it is back. */
const STARTLE = 38;
const SETTLE = 110;
/** How far trees are kept back from one, in metres. */
const CLEAR: Record<SecretKind, number> = { register: 3.5, plaque: 2.5, working: 8, room: 0, cairn: 4, bell: 4.5, den: 7, nest: 2, shack: 9, ribbon: 2.5, light: 7 };

/** What else there is to build from: the unmarked runs, and the way to each thing that something leads to. */
export interface SecretExtras {
  runs?: readonly Run[];
  leads?: ReadonlyMap<string, readonly number[]>;
}

/**
 * The mountain's secrets as they stand in the world: a made model at each, a mesh apiece and
 * drawn only near the player (or, with `models=blocks`, every one of them built from blocks
 * and joined into one mesh), and the stones of the cairns as one more, since those are the
 * player's and grow.
 */
export class SecretThings {
  readonly group = new THREE.Group();
  private readonly stones: THREE.InstancedMesh;
  private readonly cairns: { id: string; x: number; y: number; z: number; count: number }[] = [];
  private readonly placedAt: { site: SecretSite; secret: Secret }[] = [];
  /** Steam and smoke that rises from them: the sugar shack, when it is boiling. */
  readonly flues: Flue[] = [];
  /** What burns after dark, and what has gone for now because it was come upon in a hurry. */
  private readonly lamps = new THREE.Group();
  private readonly gone = new Set<string>();
  private night = false;
  private readonly trunks: { x: number; z: number; turn?: number; tall?: number }[] = [];
  /** The made things, each a mesh of its own, drawn only when the player is near enough to see it. */
  private readonly made: { x: number; z: number; mesh: THREE.Object3D }[] = [];
  private readonly inRun: (x: number, z: number) => boolean;
  /** Small animals at home: the kits at the den, the ducklings at the nest. */
  private readonly young: { id: string; mesh: THREE.Object3D; x: number; z: number; y: number; seed: number }[] = [];

  constructor(sites: readonly SecretSite[], heightAt: (x: number, z: number) => number, season: Season, shadows: boolean, extras: SecretExtras = {}) {
    this.group.name = 'secrets';
    const runs = extras.runs ?? [];
    this.inRun = runCorridor(runs);
    const pieces: THREE.BufferGeometry[] = [];
    const material = lit({ vertexColors: true, flatShading: true });
    const ink = new THREE.MeshBasicMaterial({ color: 0x22304a, side: THREE.BackSide });
    // A made model is shared by every secret that looks like it: twenty-eight plaques are one geometry.
    const shapes = new Map<string, { geometry: THREE.BufferGeometry; shell: THREE.BufferGeometry | null }>();
    const shapeOf = (id: string, tall: number): { geometry: THREE.BufferGeometry; shell: THREE.BufferGeometry | null } | null => {
      const file = madeModel(id);
      if (!file) return null;
      const key = `${id}:${tall}`;
      const shape = shapes.get(key) ?? modelGeometry(file, tall);
      shapes.set(key, shape);
      return shape;
    };
    /** Stand a made model somewhere, its front (its own -z) turned to face along `turn`. */
    const stand = (id: string, tall: number, x: number, y: number, z: number, turn: number): boolean => {
      const shape = shapeOf(id, tall);
      if (!shape) return false;
      const mesh = new THREE.Mesh(shape.geometry, material);
      if (shape.shell) mesh.add(new THREE.Mesh(shape.shell, ink));
      mesh.position.set(x, y, z);
      mesh.rotation.y = turn + Math.PI;
      mesh.castShadow = shadows;
      mesh.receiveShadow = true;
      mesh.visible = false;
      this.group.add(mesh);
      this.made.push({ x, z, mesh });
      return true;
    };
    for (const site of sites) {
      const secret = secretById(site.id);
      // Something that keeps to a season is simply not there in the others.
      // (Whether one that keeps to the dark is lit is asked as the hour changes, not here.)
      if (!secret || !thereNow(secret, season, true)) continue;
      this.placedAt.push({ site, secret });
      const y = heightAt(site.x, site.z);
      const sin = Math.sin(site.turn);
      const cos = Math.cos(site.turn);
      /** A point of the thing's own, front at +z, as a place in the world. */
      const out = (lx: number, lz: number): { x: number; z: number } => ({ x: site.x + lx * cos + lz * sin, z: site.z - lx * sin + lz * cos });
      const cast = madeFor(secret, season);
      const stood = cast !== null && stand(cast.id, cast.tall, site.x, y - 0.04, site.z, site.turn);
      if (secret.kind === 'shack' && season === 'spring') this.flues.push({ ...out(0, 0), y: y + 4.2, size: 1.7 });
      if (secret.kind === 'light') {
        // In a made lantern it is the glass itself that burns; in the one built from blocks, a flame in the open frame.
        const file = stood && cast ? madeModel(cast.id) : undefined;
        const glass = file && cast ? glassOf(file, cast.tall) : null;
        const flame = new THREE.Mesh(glass ?? new THREE.OctahedronGeometry(0.36, 0), new THREE.MeshBasicMaterial({ color: 0xffd27a }));
        if (glass) {
          flame.position.set(site.x, y - 0.04, site.z);
          flame.rotation.y = site.turn + Math.PI;
        } else {
          const at = out(0.95, 0);
          flame.position.set(at.x, y + 2.48, at.z);
          flame.scale.set(0.7, 1, 0.7);
        }
        flame.name = secret.id;
        this.lamps.add(flame);
      }
      // Whoever lives there, when they are at home: young foxes at the den once the snow has gone, ducklings at the nest.
      const who = secret.kind === 'den' && (season === 'spring' || season === 'summer') ? 'pet-kit' : secret.kind === 'nest' ? 'pet-duckling' : null;
      if (who) {
        const file = madeModel(who);
        for (let i = 0; i < 3; i++) {
          const at = out(-1.4 + i * 1.3 + (i === 1 ? 0.2 : 0), 1.5 + (i % 2) * 0.9);
          let mesh: THREE.Mesh;
          if (file) {
            const made = modelGeometry(file, who === 'pet-kit' ? 0.55 : 0.34);
            mesh = new THREE.Mesh(made.geometry, material);
            if (made.shell) mesh.add(new THREE.Mesh(made.shell, ink));
          } else {
            const c = who === 'pet-kit' ? 0xd9772b : 0xf2d16b;
            mesh = new THREE.Mesh(blocks([{ size: [0.2, 0.2, 0.4], at: [0, 0.16, 0], colour: c }, { size: [0.18, 0.18, 0.18], at: [0, 0.3, -0.24], colour: c }], [], SMOOTH), material);
          }
          mesh.position.set(at.x, heightAt(at.x, at.z), at.z);
          mesh.rotation.y = site.turn + i * 2.1;
          mesh.castShadow = shadows;
          this.group.add(mesh);
          this.young.push({ id: secret.id, mesh, x: at.x, z: at.z, y: mesh.position.y, seed: i * 1.7 });
        }
      }
      const lead = secret.lead?.seasons.includes(season) ? extras.leads?.get(secret.id) : undefined;
      if (secret.lead && lead && lead.length >= 4) {
        const from = this.trunks.length;
        // (A made maple is a stout sawn-off trunk, not a whole tree: a little over head height.)
        const maple = secret.lead.marks === 'buckets' ? shapeOf('thing-maple', 3.3) : null;
        pieces.push(...leadPieces(secret.lead.marks, lead, heightAt, this.trunks, maple !== null));
        // The maples with buckets on them, when they are made models: the one model, stood again and again, in two draw calls.
        if (maple) this.rows(maple, this.trunks.slice(from).map((t) => ({ x: t.x, y: heightAt(t.x, t.z) - 0.05, z: t.z, turn: (t.turn ?? 0) + Math.PI, scale: (t.tall ?? 7) / 7 })), material, ink, shadows);
      }
      if (secret.kind === 'cairn') this.cairns.push({ id: secret.id, x: site.x, y, z: site.z, count: 0 });
      if (stood) continue;
      const { list, extra } = model(secret, season);
      if (list.length + extra.length > 0) pieces.push(placed(blocks(list, extra, SMOOTH), site.x, y, site.z, site.turn));
    }
    // A ribbon on a birch every so often down each unmarked run, at its edge, to say that this is still the way.
    const birch = shapeOf('thing-ribbon', 1.1);
    const ribbons: { x: number; y: number; z: number; turn: number; scale: number }[] = [];
    for (const run of runs) {
      for (let i = 20; i + 12 < run.pts.length; i += 20) {
        const dx = (run.pts[i + 2] as number) - (run.pts[i] as number);
        const dz = (run.pts[i + 3] as number) - (run.pts[i + 1] as number);
        const len = Math.hypot(dx, dz) || 1;
        const side = (i / 20) % 2 ? 1 : -1;
        const x = (run.pts[i] as number) + (-dz / len) * side * 5.6;
        const z = (run.pts[i + 1] as number) + (dx / len) * side * 5.6;
        if (birch) ribbons.push({ x, y: heightAt(x, z) - 0.04, z, turn: i, scale: 1 });
        else pieces.push(placed(blocks(ribboned(2.4), [], SMOOTH), x, heightAt(x, z), z, i));
        this.trunks.push({ x, z });
      }
    }
    if (birch && ribbons.length > 0) this.rows(birch, ribbons, material, ink, shadows);
    this.lamps.visible = false;
    this.group.add(this.lamps);
    const mesh = new THREE.Mesh(blocks([], pieces, SMOOTH), material);
    mesh.castShadow = shadows;
    mesh.receiveShadow = true;
    mesh.matrixAutoUpdate = false;
    this.group.add(mesh);
    // A stone: a lump with flat faces, each its own tone.
    const lump = new THREE.DodecahedronGeometry(0.17, 0).toNonIndexed();
    lump.computeVertexNormals();
    this.stones = new THREE.InstancedMesh(lump, lit({ color: 0xffffff, flatShading: true }), Math.max(1, this.cairns.length * CAIRN_TALL));
    this.stones.count = 0;
    this.stones.castShadow = shadows;
    this.stones.frustumCulled = false;
    this.group.add(this.stones);
  }

  /** One made model stood in many places: an instanced mesh, and another for its outline. */
  private rows(shape: { geometry: THREE.BufferGeometry; shell: THREE.BufferGeometry | null }, at: readonly { x: number; y: number; z: number; turn: number; scale: number }[], material: THREE.Material, ink: THREE.Material, shadows: boolean): void {
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const up = new THREE.Vector3(0, 1, 0);
    const p = new THREE.Vector3();
    const s = new THREE.Vector3();
    for (const [geometry, mat] of [[shape.geometry, material], [shape.shell, ink]] as const) {
      if (!geometry) continue;
      const mesh = new THREE.InstancedMesh(geometry, mat, at.length);
      at.forEach((spot, i) => mesh.setMatrixAt(i, m.compose(p.set(spot.x, spot.y, spot.z), q.setFromAxisAngle(up, spot.turn), s.setScalar(spot.scale))));
      mesh.instanceMatrix.needsUpdate = true;
      mesh.castShadow = shadows && mat === material;
      mesh.computeBoundingSphere();
      this.group.add(mesh);
    }
  }

  /** The secret within reach of a point, the nearest if there are two. */
  near(x: number, z: number): { site: SecretSite; secret: Secret } | null {
    let best: { site: SecretSite; secret: Secret } | null = null;
    let least = Infinity;
    for (const at of this.placedAt) {
      const d = Math.hypot(at.site.x - x, at.site.z - z);
      if ((at.secret.nightly && !this.night) || this.gone.has(at.secret.id)) continue;
      if (d < REACH[at.secret.kind] && d < least) {
        least = d;
        best = at;
      }
    }
    return best;
  }

  /** True where a tree would stand in the way of one. */
  clears(x: number, z: number): boolean {
    if (this.inRun(x, z)) return true;
    for (const at of this.placedAt) if (Math.abs(at.site.x - x) < 9 && Math.hypot(at.site.x - x, at.site.z - z) < CLEAR[at.secret.kind]) return true;
    for (const t of this.trunks) if (Math.abs(t.x - x) < 2.2 && Math.abs(t.z - z) < 2.2) return true;
    return false;
  }

  /** Whether it is dark: what burns after dark is lit, and can be come upon. */
  setNight(night: boolean): void {
    this.night = night;
    this.lamps.visible = night;
    for (const lamp of this.lamps.children) lamp.visible = !this.gone.has(lamp.name);
  }

  /**
   * The player is about, at such a speed. Whatever is shy and near, come upon in a hurry, is
   * gone until they have been well away: the lantern is out, the nest is empty.
   * @returns what has just gone, if anything, to say so
   */
  about(x: number, z: number, speed: number, time: number): Secret | null {
    let startled: Secret | null = null;
    // A made thing is drawn while the player is near enough to see it, and not otherwise.
    for (const thing of this.made) thing.mesh.visible = Math.abs(thing.x - x) < SEEN_FROM && Math.abs(thing.z - z) < SEEN_FROM;
    for (const at of this.placedAt) {
      if (!at.secret.shy) continue;
      const d = Math.hypot(at.site.x - x, at.site.z - z);
      const was = this.gone.has(at.secret.id);
      if (!was && d < STARTLE && d > REACH[at.secret.kind] && speed > GENTLE_SPEED && (!at.secret.nightly || this.night)) {
        this.gone.add(at.secret.id);
        startled = at.secret;
      } else if (was && d > SETTLE) this.gone.delete(at.secret.id);
      else continue;
      for (const lamp of this.lamps.children) lamp.visible = !this.gone.has(lamp.name);
      for (const y of this.young) if (y.id === at.secret.id) y.mesh.visible = !this.gone.has(y.id);
    }
    // The young at home do not keep still.
    for (const y of this.young) {
      if (!y.mesh.visible || Math.abs(y.x - x) > 60 || Math.abs(y.z - z) > 60) continue;
      y.mesh.position.y = y.y + Math.max(0, Math.sin(time * 5 + y.seed * 3)) * 0.1;
      y.mesh.rotation.y += Math.sin(time * 0.9 + y.seed) * 0.02;
    }
    return startled;
  }

  /** Where a secret stands, for the map. */
  where(id: string): SecretSite | undefined {
    return this.placedAt.find((p) => p.site.id === id)?.site;
  }

  /**
   * Pile the player's stones on the cairns: so many on each, in rings that draw in toward the
   * top, the same pile every time for the same number.
   */
  setStones(count: (id: string) => number): void {
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const e = new THREE.Euler();
    const p = new THREE.Vector3();
    const s = new THREE.Vector3();
    const c = new THREE.Color();
    let n = 0;
    for (const cairn of this.cairns) {
      const stones = Math.min(CAIRN_TALL, count(cairn.id));
      let level = 0;
      let inLevel = 0;
      for (let i = 0; i < stones; i++) {
        const room = Math.max(1, 6 - level);
        const a = (inLevel / room) * Math.PI * 2 + level * 0.7;
        const r = room === 1 ? 0 : 0.36 * (1 - level / 6.5);
        // Each a little its own size and a little turned, by where it comes in the pile.
        const size = 0.85 + ((i * 37) % 10) / 28;
        p.set(cairn.x + Math.sin(a) * r, cairn.y + 0.2 + level * 0.2, cairn.z + Math.cos(a) * r);
        q.setFromEuler(e.set(i * 1.3, i * 2.1, i * 0.7));
        this.stones.setMatrixAt(n, m.compose(p, q, s.set(size, size * 0.8, size)));
        this.stones.setColorAt(n, c.setHex([0xa9b3c0, 0x7c8794, 0xd3dae4, 0x9a7b5c][(i * 7) % 4] as number));
        n++;
        if (++inLevel >= room) {
          inLevel = 0;
          level++;
        }
      }
    }
    this.stones.count = n;
    this.stones.instanceMatrix.needsUpdate = true;
    if (this.stones.instanceColor) this.stones.instanceColor.needsUpdate = true;
  }
}
