import * as THREE from 'three/webgpu';
import type { Season } from '../look/season';
import { modelGeometry, type ModelFile } from './modelFiles';
import { blocks, type Block } from './shapes';

/**
 * The creatures and plants of the field guide, each built from a few coloured blocks like
 * everything else in the game. They face -z, stand on y = 0, and are drawn larger than life: a
 * chickadee true to size would be a speck from the camera.
 */

const FUR = { deer: 0xa9774f, fox: 0xd0652a, bear: 0x2a2624, moose: 0x4a3526, otter: 0x5a4334, grey: 0x7c7770, cream: 0xf1e8d6, black: 0x1c1c20, white: 0xf7f9fb };

interface Beast {
  /** Body length, height and width; legs' length; all in metres. */
  body: [number, number, number];
  legs: number;
  colour: number;
  /** Head length, height and width, and how far it is carried above the back. */
  head: [number, number, number];
  neck: number;
  belly?: number;
  /** Ears' height; tail's length and whether it stands up. */
  ears?: number;
  tail?: [number, boolean];
  tailColour?: number;
  muzzle?: number;
  extra?: Block[];
}

/** Anything on four legs. */
function beast(b: Beast): Block[] {
  const [l, h, w] = b.body;
  const top = b.legs + h;
  const leg = Math.max(0.06, w * 0.28);
  const list: Block[] = [
    { size: [w, h, l], at: [0, b.legs + h / 2, 0], colour: b.colour },
    ...[-1, 1].flatMap((sx) => [-1, 1].map((sz): Block => ({ size: [leg, b.legs, leg], at: [sx * (w / 2 - leg / 2), b.legs / 2, sz * (l / 2 - leg / 2)], colour: b.belly ?? b.colour }))),
    // Neck and head, carried forward.
    { size: [b.head[2] * 0.7, b.neck + h * 0.4, b.head[0] * 0.55], at: [0, top + b.neck / 2 - h * 0.2, -l / 2 + 0.02], colour: b.colour },
    { size: [b.head[2], b.head[1], b.head[0]], at: [0, top + b.neck + b.head[1] / 2 - 0.02, -l / 2 - b.head[0] * 0.35], colour: b.colour },
  ];
  if (b.muzzle !== undefined) list.push({ size: [b.head[2] * 0.6, b.head[1] * 0.5, b.head[0] * 0.5], at: [0, top + b.neck + b.head[1] * 0.3, -l / 2 - b.head[0] * 0.95], colour: b.muzzle });
  if (b.ears) for (const sx of [-1, 1]) list.push({ size: [b.head[2] * 0.22, b.ears, b.head[0] * 0.2], at: [sx * b.head[2] * 0.36, top + b.neck + b.head[1] + b.ears / 2 - 0.02, -l / 2 - b.head[0] * 0.1], colour: b.colour });
  if (b.tail) {
    const [len, up] = b.tail;
    list.push(up ? { size: [w * 0.4, len, w * 0.35], at: [0, top + len / 2 - 0.05, l / 2], colour: b.tailColour ?? b.colour } : { size: [w * 0.4, w * 0.35, len], at: [0, top - h * 0.3, l / 2 + len / 2], colour: b.tailColour ?? b.colour });
  }
  return [...list, ...(b.extra ?? [])];
}

interface Bird {
  /** Body length, height, width; legs; colours of back, breast and head. */
  body: [number, number, number];
  legs: number;
  back: number;
  breast: number;
  head: number;
  headSize: number;
  beak: [number, number];
  tail: number;
  extra?: Block[];
}

function bird(b: Bird): Block[] {
  const [l, h, w] = b.body;
  const y = b.legs + h / 2;
  return [
    { size: [w, h, l], at: [0, y, 0], colour: b.back, tip: -0.25 },
    { size: [w * 0.8, h * 0.6, l * 0.7], at: [0, y - h * 0.22, -l * 0.08], colour: b.breast, tip: -0.25 },
    { size: [b.headSize, b.headSize, b.headSize], at: [0, y + h * 0.5 + b.headSize * 0.3, -l * 0.42], colour: b.head },
    { size: [b.headSize * 0.25, b.headSize * 0.22, b.beak[0]], at: [0, y + h * 0.5 + b.headSize * 0.25, -l * 0.42 - b.headSize / 2 - b.beak[0] / 2], colour: b.beak[1] },
    { size: [w * 0.6, h * 0.18, b.tail], at: [0, y + h * 0.1, l / 2 + b.tail / 2 - 0.02], colour: b.back, tip: 0.2 },
    ...[-1, 1].map((sx): Block => ({ size: [w * 0.12, b.legs, w * 0.12], at: [sx * w * 0.22, b.legs / 2, 0], colour: 0x3a3230 })),
    ...(b.extra ?? []),
  ];
}

/** A clump of flowers or the like: stems with a coloured head each, scattered over a small patch. */
function clump(count: number, spread: number, height: number, stem: number, head: number, headSize: [number, number, number], centre?: number): Block[] {
  const list: Block[] = [];
  for (let i = 0; i < count; i++) {
    // A fixed scatter: the same clump every time.
    const a = i * 2.4;
    const r = spread * Math.sqrt((i + 0.5) / count);
    const x = Math.cos(a) * r;
    const z = Math.sin(a) * r;
    const h = height * (0.75 + 0.5 * ((i * 37) % 10) / 10);
    list.push({ size: [0.05, h, 0.05], at: [x, h / 2, z], colour: stem }, { size: headSize, at: [x, h + headSize[1] / 2, z], colour: head, turn: a });
    if (centre !== undefined) list.push({ size: [headSize[0] * 0.4, headSize[1] * 1.3, headSize[2] * 0.4], at: [x, h + headSize[1] / 2, z], colour: centre });
  }
  return list;
}

const antlers = (y: number, z: number, span: number, colour: number): Block[] =>
  [-1, 1].flatMap((sx): Block[] => [
    { size: [0.06, 0.5, 0.06], at: [sx * span * 0.5, y + 0.25, z], colour },
    { size: [span * 0.5, 0.06, 0.06], at: [sx * span * 0.75, y + 0.45, z], colour },
    { size: [0.06, 0.3, 0.06], at: [sx * span, y + 0.58, z], colour },
  ]);

/** The models, by species id. Some change with the season. */
const MODELS: Record<string, (season: Season) => Block[]> = {
  deer: () => beast({ body: [1.5, 0.6, 0.5], legs: 0.9, colour: FUR.deer, belly: 0x8a6040, head: [0.5, 0.3, 0.26], neck: 0.5, ears: 0.26, tail: [0.3, true], tailColour: FUR.white, muzzle: 0x6e4c34 }),
  fox: () => beast({ body: [1.0, 0.36, 0.34], legs: 0.42, colour: FUR.fox, belly: FUR.black, head: [0.4, 0.26, 0.28], neck: 0.12, ears: 0.2, tail: [0.75, false], tailColour: FUR.white, muzzle: FUR.white }),
  hare: (season) => beast({ body: [0.7, 0.42, 0.36], legs: 0.28, colour: season === 'winter' ? FUR.white : 0x8c7358, head: [0.3, 0.26, 0.24], neck: 0.08, ears: 0.42, tail: [0.14, true], tailColour: FUR.white }),
  bear: () => beast({ body: [1.7, 0.85, 0.8], legs: 0.6, colour: FUR.bear, head: [0.55, 0.45, 0.5], neck: 0.05, ears: 0.14, muzzle: 0x8a6a4a }),
  moose: () =>
    beast({ body: [2.5, 1.0, 0.8], legs: 1.5, colour: FUR.moose, belly: 0x6a5240, head: [0.9, 0.5, 0.4], neck: 0.35, ears: 0.22, muzzle: 0x5a4636, extra: antlers(3.15, -1.5, 0.9, 0xd8c8a0) }),
  otter: () => beast({ body: [1.1, 0.3, 0.32], legs: 0.16, colour: FUR.otter, head: [0.32, 0.24, 0.28], neck: 0.06, tail: [0.7, false], muzzle: FUR.cream }),
  beaver: () => beast({ body: [0.9, 0.42, 0.5], legs: 0.12, colour: 0x6b4a30, head: [0.3, 0.28, 0.32], neck: 0.02, tail: [0.5, false], tailColour: 0x2e2622, muzzle: 0x8a6a4a }),
  porcupine: () =>
    beast({
      body: [0.9, 0.55, 0.6],
      legs: 0.14,
      colour: 0x3a342e,
      head: [0.26, 0.24, 0.26],
      neck: 0.0,
      tail: [0.4, false],
      // Quills, as pale spikes along the back.
      extra: [-0.3, -0.05, 0.2].flatMap((z): Block[] => [-0.15, 0.15].map((x): Block => ({ size: [0.08, 0.3, 0.08], at: [x, 0.8, z], colour: 0xd8d0b8, tip: 0.5 }))),
    }),
  squirrel: () => beast({ body: [0.5, 0.26, 0.22], legs: 0.14, colour: 0xa8502a, belly: FUR.cream, head: [0.22, 0.2, 0.2], neck: 0.06, ears: 0.1, tail: [0.5, true] }),
  chipmunk: () =>
    beast({ body: [0.45, 0.22, 0.2], legs: 0.1, colour: 0xb8824a, belly: FUR.cream, head: [0.2, 0.18, 0.18], neck: 0.04, ears: 0.07, tail: [0.36, true], extra: [{ size: [0.06, 0.02, 0.44], at: [0, 0.33, 0], colour: FUR.black }] }),
  marten: () => beast({ body: [0.95, 0.26, 0.24], legs: 0.24, colour: 0x7a5232, belly: 0xe2a45a, head: [0.3, 0.22, 0.22], neck: 0.1, ears: 0.12, tail: [0.6, false] }),
  bobcat: () => beast({ body: [1.0, 0.42, 0.36], legs: 0.5, colour: 0xa58a66, belly: FUR.cream, head: [0.34, 0.32, 0.32], neck: 0.1, ears: 0.18, tail: [0.16, false], tailColour: FUR.black }),
  raccoon: () =>
    beast({ body: [0.8, 0.42, 0.42], legs: 0.2, colour: FUR.grey, head: [0.3, 0.26, 0.3], neck: 0.04, ears: 0.1, tail: [0.5, false], tailColour: FUR.black, extra: [{ size: [0.32, 0.08, 0.06], at: [0, 0.78, -0.62], colour: FUR.black }] }),
  coyote: () => beast({ body: [1.3, 0.44, 0.36], legs: 0.62, colour: 0x9a8a72, belly: FUR.cream, head: [0.46, 0.28, 0.26], neck: 0.22, ears: 0.2, tail: [0.6, false], muzzle: 0xc9bca6 }),

  chickadee: () => bird({ body: [0.42, 0.34, 0.32], legs: 0.1, back: 0x8a9096, breast: FUR.cream, head: FUR.black, headSize: 0.26, beak: [0.08, 0x2a2a2a], tail: 0.3, extra: [{ size: [0.28, 0.12, 0.1], at: [0, 0.42, -0.27], colour: FUR.white }] }),
  raven: () => bird({ body: [0.9, 0.5, 0.42], legs: 0.2, back: 0x15161c, breast: 0x1c1d26, head: 0x15161c, headSize: 0.36, beak: [0.28, 0x2a2a30], tail: 0.5 }),
  turkey: () =>
    bird({
      body: [1.0, 0.75, 0.7],
      legs: 0.45,
      back: 0x4a3526,
      breast: 0x6a4a30,
      head: 0xb0483a,
      headSize: 0.24,
      beak: [0.12, 0xd8c070],
      tail: 0.1,
      // The fan.
      extra: [{ size: [1.1, 0.9, 0.08], at: [0, 1.15, 0.5], colour: 0x7a5a38, tip: 0.3 }, { size: [0.12, 0.5, 0.12], at: [0, 1.3, -0.42], colour: 0x6a4a30 }],
    }),
  owl: () =>
    bird({
      body: [0.5, 0.8, 0.55],
      legs: 0.08,
      back: 0x7a6a56,
      breast: 0xd8cdb8,
      head: 0x8a7a64,
      headSize: 0.52,
      beak: [0.08, 0xd8b040],
      tail: 0.2,
      extra: [-1, 1].map((sx): Block => ({ size: [0.14, 0.14, 0.04], at: [sx * 0.13, 1.14, -0.48], colour: FUR.black })),
    }),
  loon: () => bird({ body: [1.0, 0.34, 0.5], legs: 0.02, back: 0x1c1f24, breast: FUR.white, head: 0x14161a, headSize: 0.28, beak: [0.24, 0x2a2a30], tail: 0.16, extra: [{ size: [0.2, 0.3, 0.2], at: [0, 0.42, -0.4], colour: 0x14161a }] }),
  heron: () =>
    bird({ body: [0.9, 0.42, 0.36], legs: 1.1, back: 0x7f8fa3, breast: 0xc9d0d8, head: FUR.white, headSize: 0.24, beak: [0.4, 0xd8a040], tail: 0.3, extra: [{ size: [0.1, 0.9, 0.1], at: [0, 1.95, -0.42], colour: 0xa9b4c2 }] }),
  eagle: () => bird({ body: [0.95, 0.75, 0.55], legs: 0.2, back: 0x3a2c22, breast: 0x4a382a, head: FUR.white, headSize: 0.36, beak: [0.2, 0xe8b830], tail: 0.4, extra: [{ size: [0.36, 0.1, 0.3], at: [0, 0.5, 0.6], colour: FUR.white }] }),
  bluejay: () => bird({ body: [0.5, 0.36, 0.32], legs: 0.12, back: 0x3f6fb5, breast: FUR.white, head: 0x3f6fb5, headSize: 0.28, beak: [0.12, 0x2a2a2a], tail: 0.45, extra: [{ size: [0.1, 0.18, 0.1], at: [0, 0.68, -0.14], colour: 0x3f6fb5 }] }),
  grouse: () => bird({ body: [0.7, 0.5, 0.5], legs: 0.14, back: 0x8a6a4a, breast: 0xc9b89a, head: 0x8a6a4a, headSize: 0.24, beak: [0.08, 0x4a4038], tail: 0.4 }),
  grayjay: () => bird({ body: [0.5, 0.38, 0.34], legs: 0.12, back: 0x7c8088, breast: 0xe2e2de, head: 0xf0f0ec, headSize: 0.3, beak: [0.1, 0x2a2a2a], tail: 0.42 }),
  hummingbird: () =>
    bird({
      body: [0.3, 0.24, 0.2],
      legs: 0.02,
      back: 0x3f8f5a,
      breast: FUR.white,
      head: 0x3f8f5a,
      headSize: 0.18,
      beak: [0.2, 0x2a2a2a],
      tail: 0.14,
      extra: [{ size: [0.14, 0.08, 0.06], at: [0, 0.2, -0.2], colour: 0xc8203a }, ...[-1, 1].map((sx): Block => ({ size: [0.34, 0.03, 0.14], at: [sx * 0.24, 0.3, 0], colour: 0xcfe0d6 }))],
    }),

  trillium: () => clump(5, 0.6, 0.35, 0x3f6b3a, 0x8a1f2c, [0.3, 0.06, 0.3], 0xe8d060),
  troutlily: () => clump(7, 0.7, 0.26, 0x6b7a4a, 0xf0d040, [0.2, 0.1, 0.2]),
  fiddlehead: () => clump(6, 0.5, 0.5, 0x5a8a3a, 0x6fa040, [0.16, 0.16, 0.08]),
  ladyslipper: () => clump(2, 0.25, 0.5, 0x4f7a3f, 0xe88aa8, [0.2, 0.24, 0.2]),
  daisy: () => clump(9, 0.9, 0.5, 0x4f8a3f, 0xfafafa, [0.3, 0.05, 0.3], 0xf0c030),
  blueberry: () => [
    { size: [1.1, 0.4, 0.9], at: [0, 0.2, 0], colour: 0x3f6b3a },
    ...[0, 1, 2, 3, 4, 5, 6].map((i): Block => ({ size: [0.14, 0.14, 0.14], at: [Math.cos(i * 2.4) * 0.4, 0.42 + (i % 2) * 0.04, Math.sin(i * 2.4) * 0.32], colour: 0x3a4a9a })),
  ],
  cattail: () => clump(6, 0.5, 1.3, 0x6b8a4a, 0x5a3a26, [0.12, 0.4, 0.12]),
  goldenrod: () => clump(7, 0.7, 0.9, 0x5a7a3a, 0xe8b820, [0.2, 0.34, 0.2]),
  chanterelle: () => clump(5, 0.4, 0.14, 0xe8b040, 0xf0a020, [0.26, 0.08, 0.26]),
  flyagaric: () => [
    ...clump(3, 0.35, 0.3, 0xf2ecd8, 0xc8281e, [0.4, 0.14, 0.4]),
    ...[0, 1, 2].flatMap((i): Block[] => {
      const a = i * 2.4;
      const r = 0.35 * Math.sqrt((i + 0.5) / 3);
      const h = 0.3 * (0.75 + 0.5 * ((i * 37) % 10) / 10);
      return [{ size: [0.1, 0.04, 0.1], at: [Math.cos(a) * r + 0.08, h + 0.15, Math.sin(a) * r - 0.06], colour: 0xfafafa }];
    }),
  ],
  mapleleaf: () => [
    { size: [0.5, 0.03, 0.5], at: [0, 0.12, 0], colour: 0xd43a26, turn: 0.6, tip: 0.2 },
    { size: [0.3, 0.03, 0.3], at: [0.18, 0.13, -0.16], colour: 0xe2562a, turn: 0.2, tip: 0.2 },
    { size: [0.04, 0.03, 0.3], at: [-0.2, 0.1, 0.24], colour: 0x8a3a20, turn: 0.6 },
  ],
  balsamcone: () => [-0.2, 0.05, 0.28].map((x, i): Block => ({ size: [0.14, 0.4, 0.14], at: [x, 0.2, (i - 1) * 0.16], colour: 0x6a4a6a, tip: (i - 1) * 0.3 })),
  icicles: () => [-0.5, -0.25, 0, 0.22, 0.48].map((x, i): Block => ({ size: [0.14, 0.9 + ((i * 7) % 5) * 0.2, 0.14], at: [x, 0.5 + ((i * 7) % 5) * 0.1, 0], colour: 0xa8d0f0 })),
  birchbark: () => [
    { size: [0.5, 0.22, 0.22], at: [0, 0.13, 0], colour: 0xf4f0e6, turn: 0.5 },
    { size: [0.52, 0.06, 0.06], at: [0, 0.13, 0], colour: 0x3a3430, turn: 0.5 },
  ],

  snowman: () => [
    { size: [1.0, 0.9, 1.0], at: [0, 0.45, 0], colour: FUR.white },
    { size: [0.74, 0.66, 0.74], at: [0, 1.2, 0], colour: FUR.white, turn: 0.4 },
    { size: [0.5, 0.46, 0.5], at: [0, 1.75, 0], colour: FUR.white },
    { size: [0.1, 0.1, 0.34], at: [0, 1.76, -0.36], colour: 0xe8742a },
    { size: [0.56, 0.12, 0.56], at: [0, 1.5, 0], colour: 0xc2412d },
    { size: [0.12, 0.4, 0.12], at: [0.2, 1.32, -0.3], colour: 0xc2412d },
    ...[-1, 1].map((sx): Block => ({ size: [0.7, 0.06, 0.06], at: [sx * 0.66, 1.3, 0], colour: 0x5a4030, tip: 0 })),
    ...[-1, 1].map((sx): Block => ({ size: [0.07, 0.07, 0.04], at: [sx * 0.11, 1.86, -0.25], colour: FUR.black })),
    { size: [0.46, 0.08, 0.46], at: [0, 2.0, 0], colour: FUR.black },
    { size: [0.3, 0.3, 0.3], at: [0, 2.16, 0], colour: FUR.black },
  ],
  cairn: () => [
    { size: [0.8, 0.3, 0.7], at: [0, 0.15, 0], colour: 0x8a8880 },
    { size: [0.6, 0.26, 0.56], at: [0.04, 0.43, 0], colour: 0x9a9890, turn: 0.5 },
    { size: [0.44, 0.22, 0.4], at: [-0.03, 0.67, 0.02], colour: 0x7c7a74, turn: 0.2 },
    { size: [0.28, 0.2, 0.26], at: [0, 0.88, 0], colour: 0xa8a69e, turn: 0.9 },
    { size: [0.16, 0.14, 0.16], at: [0.01, 1.05, 0], colour: 0x8f1d2c, turn: 0.4 },
  ],
  // Tall, shaggy, and never quite seen: a dark figure with long arms.
  rumor: () => [
    ...[-1, 1].map((sx): Block => ({ size: [0.34, 1.2, 0.36], at: [sx * 0.24, 0.6, 0], colour: 0x2a221e })),
    { size: [0.9, 1.2, 0.56], at: [0, 1.75, 0], colour: 0x332a24 },
    { size: [0.5, 0.5, 0.46], at: [0, 2.58, -0.04], colour: 0x2a221e },
    ...[-1, 1].map((sx): Block => ({ size: [0.26, 1.5, 0.3], at: [sx * 0.6, 1.5, 0], colour: 0x2a221e, tip: 0 })),
    ...[-1, 1].map((sx): Block => ({ size: [0.07, 0.05, 0.04], at: [sx * 0.11, 2.62, -0.28], colour: 0xffd88a })),
  ],
};

const cache = new Map<string, THREE.BufferGeometry>();

/** Models made outside the game, by species id, in whichever look has been asked for; and how each is to be shaded. */
let made: Record<string, ModelFile> = {};

/**
 * Use models made outside the game (see `modelFiles.ts`) for the species that have one, in
 * place of the ones built here from blocks. Each stands as tall as the blocks did.
 */
export function useMadeModels(models: Record<string, ModelFile>): void {
  made = models;
  cache.clear();
}

/** Whether a species has a model in the look that is on. */
export function hasMadeModel(id: string): boolean {
  return id in made;
}

/** The model for a species in a season. Built once and shared. */
export function critterGeometry(id: string, season: Season): THREE.BufferGeometry {
  const key = id === 'hare' ? `${id}:${season === 'winter' ? 'white' : 'brown'}` : id;
  let geo = cache.get(key);
  if (!geo) {
    const make = MODELS[id];
    // Anything without a model of its own is a small stone marker, so it can at least be found.
    geo = blocks(make ? make(season) : [{ size: [0.4, 0.4, 0.4], at: [0, 0.2, 0], colour: 0xb0a090 }]);
    // The hare has a model for its winter coat and one for the rest of the year.
    const file = (id === 'hare' && season === 'winter' ? made['hare-white'] : undefined) ?? made[id];
    if (file) {
      // As tall as the one built from blocks, so that it is found and seen from as far.
      geo.computeBoundingBox();
      const { geometry, shell } = modelGeometry(file, geo.boundingBox?.max.y ?? 1);
      geometry.userData = { shell, smooth: file.smooth };
      geo = geometry;
    }
    cache.set(key, geo);
  }
  return geo;
}

/** Whether a species has a model of its own. For tests. */
export const hasCritterModel = (id: string): boolean => id in MODELS;
