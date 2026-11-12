import * as THREE from 'three/webgpu';
import type { Person } from '../game/people';
import type { Season } from '../look/season';
import { STANDING } from '../player/pose';
import type { Outfit } from '../player/skier';
import { madeModel } from './critterModels';
import { figureGeometry } from './figure';
import { joinModels, modelGeometry, type ModelFile } from './modelFiles';
import { blocks, type Block } from './shapes';
import { lit } from '../look/material';

/** People further than this from the player are not drawn, in metres. */
const DRAW_RANGE = 220;
/** Within this distance a person turns to face the player. */
const NOTICE_RANGE = 28;
/** The same scale the player is drawn at. */
const SCALE = 0.75;

export interface Standing {
  person: Person;
  x: number;
  y: number;
  z: number;
  /** Where the thing that stands beside them is, if they have one. */
  prop?: { x: number; y: number; z: number; turn: number };
}

/** Someone who only stands and turns: hands a little forward and apart, as someone waiting does. */
const standingFigure = (outfit: Outfit): THREE.BufferGeometry => figureGeometry(outfit, { ...STANDING, shoulderL: 0.18, shoulderR: 0.1, armsOut: 0.12, elbow: 0.5 });

/** A noticeboard: two posts, a board under a little roof, and papers pinned to it. */
function noticeboard(): THREE.BufferGeometry {
  const papers: Block[] = [
    [-0.55, 1.75, 0xfffdf7, 0.06],
    [0.05, 1.8, 0xf4e4b8, -0.05],
    [0.6, 1.7, 0xfffdf7, 0.03],
    [-0.3, 1.25, 0xe8b9b0, -0.04],
    [0.4, 1.2, 0xfffdf7, 0.07],
  ].map(([x, y, colour, tip]): Block => ({ size: [0.42, 0.5, 0.03], at: [x as number, y as number, -0.09], colour: colour as number, tip: tip as number }));
  return blocks(
    [
      { size: [0.14, 2.4, 0.14], at: [-1.05, 1.2, 0], colour: 0x6b4a33 },
      { size: [0.14, 2.4, 0.14], at: [1.05, 1.2, 0], colour: 0x6b4a33 },
      { size: [2.1, 1.5, 0.1], at: [0, 1.5, 0], colour: 0x8a6a3c },
      { size: [2.5, 0.12, 0.5], at: [0, 2.45, 0], colour: 0x5c6672 },
      ...papers,
    ],
  );
}

/**
 * Blocks for something small. A block gets its dark line only if it is stout enough to make
 * part of a model's outline, and nothing about a dog or a cat is. So the model is built several
 * times its size, where its body, head and legs are stout and its eyes and nose still are not,
 * and then brought back down: the line comes down with it, to about the width of a figure's.
 */
function fine(list: readonly Block[], grow: number): THREE.BufferGeometry {
  const big = list.map((b): Block => ({ ...b, size: [b.size[0] * grow, b.size[1] * grow, b.size[2] * grow], at: [b.at[0] * grow, b.at[1] * grow, b.at[2] * grow] }));
  const geometry = blocks(big);
  geometry.scale(1 / grow, 1 / grow, 1 / grow);
  return geometry;
}

/** A big mountain dog, sitting: white and brown, with a small barrel at his collar. */
function dog(): THREE.BufferGeometry {
  const brown = 0x9a5a2c;
  const white = 0xf4ead8;
  return fine([
    // Haunches and body, tipped up as a sitting dog's is.
    { size: [0.62, 0.5, 0.7], at: [0, 0.3, 0.25], colour: brown },
    { size: [0.56, 0.75, 0.5], at: [0, 0.62, -0.1], colour: white, tip: -0.35 },
    { size: [0.16, 0.6, 0.16], at: [-0.17, 0.3, -0.36], colour: white },
    { size: [0.16, 0.6, 0.16], at: [0.17, 0.3, -0.36], colour: white },
    // Head, muzzle, ears, nose.
    { size: [0.5, 0.44, 0.46], at: [0, 1.16, -0.34], colour: brown },
    { size: [0.2, 0.44, 0.47], at: [0, 1.17, -0.34], colour: white },
    { size: [0.3, 0.24, 0.26], at: [0, 1.06, -0.66], colour: white },
    { size: [0.12, 0.09, 0.06], at: [0, 1.14, -0.8], colour: 0x1c1c20 },
    { size: [0.12, 0.3, 0.2], at: [-0.3, 1.12, -0.3], colour: 0x6b3a1c },
    { size: [0.12, 0.3, 0.2], at: [0.3, 1.12, -0.3], colour: 0x6b3a1c },
    // The barrel, and a tail laid out behind.
    { size: [0.2, 0.2, 0.26], at: [0, 0.82, -0.48], colour: 0xb9853f, turn: Math.PI / 2 },
    { size: [0.14, 0.14, 0.5], at: [0, 0.14, 0.78], colour: brown },
  ], 4);
}

/** A fat orange cat, sitting very upright, in a chain of office. */
function cat(): THREE.BufferGeometry {
  const orange = 0xd9822b;
  const cream = 0xf4ead8;
  const gold = 0xe2b94a;
  return fine([
    { size: [0.34, 0.34, 0.44], at: [0, 0.19, 0.08], colour: orange },
    { size: [0.28, 0.42, 0.26], at: [0, 0.44, -0.1], colour: orange },
    { size: [0.15, 0.28, 0.03], at: [0, 0.42, -0.235], colour: cream },
    { size: [0.07, 0.3, 0.08], at: [-0.08, 0.15, -0.2], colour: cream },
    { size: [0.07, 0.3, 0.08], at: [0.08, 0.15, -0.2], colour: cream },
    // Head, ears, muzzle, and a pair of green eyes with opinions.
    { size: [0.32, 0.27, 0.27], at: [0, 0.76, -0.14], colour: orange },
    { size: [0.09, 0.11, 0.07], at: [-0.11, 0.94, -0.13], colour: orange },
    { size: [0.09, 0.11, 0.07], at: [0.11, 0.94, -0.13], colour: orange },
    { size: [0.15, 0.09, 0.06], at: [0, 0.7, -0.29], colour: cream },
    { size: [0.055, 0.05, 0.02], at: [-0.08, 0.8, -0.28], colour: 0x4f8a3a },
    { size: [0.055, 0.05, 0.02], at: [0.08, 0.8, -0.28], colour: 0x4f8a3a },
    // The chain of office, and a tail curled round.
    { size: [0.24, 0.035, 0.03], at: [0, 0.6, -0.245], colour: gold },
    { size: [0.08, 0.08, 0.03], at: [0, 0.53, -0.255], colour: gold },
    { size: [0.08, 0.08, 0.42], at: [0.2, 0.06, 0.26], colour: orange, turn: 0.7 },
  ], 4);
}

/** Coal eyes, a carrot and a striped scarf: what Tom keeps, whatever else he is made of that season. */
function tomsFace(y: number, front: number): Block[] {
  return [
    { size: [0.07, 0.07, 0.04], at: [-0.12, y + 0.08, front], colour: 0x1c1c20 },
    { size: [0.07, 0.07, 0.04], at: [0.12, y + 0.08, front], colour: 0x1c1c20 },
    { size: [0.08, 0.08, 0.3], at: [0, y - 0.02, front - 0.14], colour: 0xe8742a },
  ];
}
function tomsScarf(y: number, width: number): Block[] {
  return [
    { size: [width, 0.13, width], at: [0, y, 0], colour: 0xb53a2a },
    { size: [0.15, 0.2, 0.05], at: [0.18, y - 0.16, -width / 2 - 0.02], colour: 0xe2a52e },
    { size: [0.15, 0.2, 0.05], at: [0.18, y - 0.36, -width / 2 - 0.02], colour: 0xb53a2a },
  ];
}

/** Tom's top hat, with its band, sitting at a height. */
function tomsHat(y: number): Block[] {
  const black = 0x22262d;
  return [
    { size: [0.62, 0.05, 0.62], at: [0, y, 0], colour: black },
    { size: [0.4, 0.36, 0.4], at: [0, y + 0.2, 0], colour: black },
    { size: [0.42, 0.07, 0.42], at: [0, y + 0.07, 0], colour: 0xf4ead8 },
  ];
}

/**
 * Tom. In winter a snowman in a top hat; in spring what is left of one; in summer and fall a
 * scarecrow in the same scarf, with a pumpkin for company once the leaves turn.
 */
function tom(season: Season): THREE.BufferGeometry {
  const snow = 0xf4f6fa;
  const black = 0x22262d;
  const hat = tomsHat;
  if (season === 'winter') {
    return fine([
      { size: [1.15, 0.85, 1.15], at: [0, 0.42, 0], colour: snow },
      { size: [0.86, 0.7, 0.86], at: [0, 1.15, 0], colour: snow },
      { size: [0.6, 0.55, 0.6], at: [0, 1.74, 0], colour: snow },
      ...tomsFace(1.74, -0.31),
      ...tomsScarf(1.47, 0.72),
      { size: [0.08, 0.08, 0.04], at: [0, 1.25, -0.44], colour: black },
      { size: [0.08, 0.08, 0.04], at: [0, 1.02, -0.44], colour: black },
      ...hat(2.04),
      // Twig arms, raised a little, as if about to make a point.
      { size: [0.05, 0.05, 0.75], at: [-0.74, 1.4, 0], colour: 0x6b4a33, turn: Math.PI / 2, tip: 0.45 },
      { size: [0.05, 0.05, 0.75], at: [0.74, 1.4, 0], colour: 0x6b4a33, turn: -Math.PI / 2, tip: 0.45 },
    ], 2);
  }
  if (season === 'spring') {
    // Travelling light.
    return fine([
      { size: [0.8, 0.38, 0.8], at: [0, 0.19, 0], colour: snow },
      { size: [0.5, 0.42, 0.5], at: [0, 0.58, 0], colour: snow },
      ...tomsFace(0.58, -0.26),
      ...tomsScarf(0.36, 0.62),
      ...hat(0.82),
      { size: [0.05, 0.05, 0.75], at: [0.7, 0.04, 0.2], colour: 0x6b4a33, turn: 0.9 },
    ], 2);
  }
  const straw = 0xd9b65a;
  return fine([
    { size: [0.12, 2.1, 0.12], at: [0, 1.05, 0.06], colour: 0x6b4a33 },
    { size: [1.7, 0.1, 0.1], at: [0, 1.58, 0.06], colour: 0x6b4a33 },
    // A plaid shirt and patched trousers, stuffed.
    { size: [0.7, 0.75, 0.32], at: [0, 1.38, 0], colour: 0xa9483a },
    { size: [0.5, 0.24, 0.24], at: [-0.56, 1.58, 0], colour: 0xa9483a },
    { size: [0.5, 0.24, 0.24], at: [0.56, 1.58, 0], colour: 0xa9483a },
    { size: [0.18, 0.22, 0.18], at: [-0.88, 1.56, 0], colour: straw },
    { size: [0.18, 0.22, 0.18], at: [0.88, 1.56, 0], colour: straw },
    { size: [0.5, 0.62, 0.28], at: [0, 0.74, 0], colour: 0x4a5a78 },
    { size: [0.42, 0.14, 0.22], at: [0, 0.38, 0], colour: straw },
    // A burlap head, with the same face.
    { size: [0.42, 0.44, 0.42], at: [0, 2.02, 0], colour: 0xcdb38a },
    ...tomsFace(2.02, -0.22),
    ...tomsScarf(1.79, 0.5),
    { size: [0.84, 0.05, 0.84], at: [0, 2.26, 0], colour: straw },
    { size: [0.42, 0.2, 0.42], at: [0, 2.37, 0], colour: straw },
    ...(season === 'fall'
      ? [
          { size: [0.46, 0.34, 0.46], at: [0.62, 0.17, -0.25], colour: 0xe8742a } as Block,
          { size: [0.08, 0.12, 0.08], at: [0.62, 0.39, -0.25], colour: 0x4f6b3a } as Block,
        ]
      : []),
  ], 2);
}

/** The snowcat: tracks, a red cab, a blade in front and the comb behind that lays the corduroy. Its front is its own -z. */
function snowcat(): THREE.BufferGeometry {
  const red = 0xc8402d;
  const dark = 0x22262d;
  const glass = 0x3d4a5e;
  return blocks([
    { size: [0.75, 0.7, 4.7], at: [-1.2, 0.35, 0], colour: dark },
    { size: [0.75, 0.7, 4.7], at: [1.2, 0.35, 0], colour: dark },
    { size: [1.9, 0.5, 4.3], at: [0, 0.9, 0], colour: red },
    { size: [1.9, 1.3, 1.9], at: [0, 1.8, -0.7], colour: red },
    { size: [1.7, 0.75, 0.06], at: [0, 2, -1.66], colour: glass },
    { size: [0.06, 0.75, 1.5], at: [-0.96, 2, -0.7], colour: glass },
    { size: [0.06, 0.75, 1.5], at: [0.96, 2, -0.7], colour: glass },
    { size: [2.05, 0.12, 2.05], at: [0, 2.5, -0.7], colour: dark },
    { size: [0.2, 0.2, 0.2], at: [0, 2.66, -0.7], colour: 0xe8742a },
    { size: [1.9, 0.65, 1.7], at: [0, 1.47, 1.15], colour: 0x9f3324 },
    // The blade, carried just off the snow.
    { size: [3.7, 0.85, 0.25], at: [0, 0.6, -2.85], colour: 0xe2a52e, tip: 0.18 },
    { size: [0.16, 0.16, 0.7], at: [-0.8, 0.65, -2.5], colour: dark },
    { size: [0.16, 0.16, 0.7], at: [0.8, 0.65, -2.5], colour: dark },
    // The tiller and its comb.
    { size: [3.5, 0.4, 0.55], at: [0, 0.32, 2.8], colour: dark },
    { size: [3.5, 0.06, 0.6], at: [0, 0.1, 3.25], colour: 0xe2a52e },
  ]);
}

/** A patrol sled: an orange toboggan with long handles, a blanket roll and a white cross. */
function sled(): THREE.BufferGeometry {
  return blocks([
    { size: [0.62, 0.22, 2.1], at: [0, 0.16, 0], colour: 0xe8742a },
    { size: [0.5, 0.2, 0.55], at: [0, 0.37, 0.45], colour: 0xb53a2a },
    { size: [0.3, 0.02, 0.1], at: [0, 0.28, -0.4], colour: 0xfffdf7 },
    { size: [0.1, 0.02, 0.3], at: [0, 0.28, -0.4], colour: 0xfffdf7 },
    { size: [0.05, 0.05, 1.3], at: [-0.3, 0.55, -1.5], colour: 0x9aa0a8, tip: -0.5 },
    { size: [0.05, 0.05, 1.3], at: [0.3, 0.55, -1.5], colour: 0x9aa0a8, tip: -0.5 },
    { size: [0.66, 0.05, 0.05], at: [0, 0.86, -2.07], colour: 0x9aa0a8 },
  ]);
}

/** A small upright diamond that hangs over someone with something to say, or something to be picked up. */
function flag(colour: number): THREE.Mesh {
  const w = 0.2;
  const h = 0.42;
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute([0, h, 0, -w, 0, 0, w, 0, 0, 0, -h, 0, w, 0, 0, -w, 0, 0], 3));
  geo.computeVertexNormals();
  return new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: colour, side: THREE.DoubleSide }));
}

/** A painter's easel: three legs, a board, and whatever is on the board today. */
function easel(): THREE.BufferGeometry {
  const wood = 0xa9763f;
  return fine(
    [
      { size: [0.07, 1.7, 0.07], at: [-0.34, 0.82, 0.02], colour: wood, tip: -0.12 },
      { size: [0.07, 1.7, 0.07], at: [0.34, 0.82, 0.02], colour: wood, tip: -0.12 },
      { size: [0.07, 1.7, 0.07], at: [0, 0.8, -0.42], colour: wood, tip: 0.3 },
      { size: [0.9, 0.06, 0.12], at: [0, 0.8, 0.12], colour: wood },
      // The picture: sky, a far ridge, a near one.
      { size: [0.8, 0.62, 0.05], at: [0, 1.16, 0.12], colour: 0xfbf8ee, tip: -0.12 },
      { size: [0.7, 0.2, 0.02], at: [0, 1.34, 0.19], colour: 0x9fc0d8, tip: -0.12 },
      { size: [0.7, 0.16, 0.02], at: [0, 1.16, 0.17], colour: 0x5e7f9a, tip: -0.12 },
      { size: [0.7, 0.16, 0.02], at: [0, 1.0, 0.15], colour: 0x4f8a3f, tip: -0.12 },
      // A stool, and a box of paints on it.
      { size: [0.5, 0.06, 0.4], at: [0.95, 0.5, 0.2], colour: wood },
      { size: [0.06, 0.5, 0.06], at: [0.75, 0.25, 0.05], colour: wood },
      { size: [0.06, 0.5, 0.06], at: [1.15, 0.25, 0.05], colour: wood },
      { size: [0.06, 0.5, 0.06], at: [0.95, 0.25, 0.36], colour: wood },
      { size: [0.34, 0.1, 0.24], at: [0.95, 0.58, 0.2], colour: 0x2a2e36 },
      { size: [0.07, 0.03, 0.07], at: [0.85, 0.64, 0.2], colour: 0xc8402d },
      { size: [0.07, 0.03, 0.07], at: [0.95, 0.64, 0.2], colour: 0xf2d16b },
      { size: [0.07, 0.03, 0.07], at: [1.05, 0.64, 0.2], colour: 0x2b62c9 },
    ],
    2.4,
  );
}

/** A camp: a small tent, a ring of stones with a fire in it, a log to sit on, a pot. */
function camp(): THREE.BufferGeometry {
  const canvas = 0xd9c9a0;
  const list: Block[] = [
    // The tent, to one side of the fire with its door toward it: two sloping sides that meet in a ridge, a groundsheet, a dark doorway.
    { size: [2.5, 0.07, 1.75], at: [-3.0, 0.72, -0.14], colour: canvas, tip: 1.0 },
    { size: [2.5, 0.07, 1.75], at: [-3.0, 0.72, -1.06], colour: canvas, tip: -1.0 },
    { size: [2.6, 0.1, 0.16], at: [-3.0, 1.46, -0.6], colour: 0xb3472d },
    { size: [2.3, 0.06, 1.7], at: [-3.0, 0.04, -0.6], colour: 0x7c8794 },
    { size: [0.06, 0.95, 0.75], at: [-1.76, 0.5, -0.6], colour: 0x4a3326 },
    { size: [0.06, 0.5, 0.36], at: [-1.75, 1.1, -0.6], colour: 0x4a3326 },
    // The fire: stones in a ring, three logs, and the fire itself.
    ...Array.from({ length: 8 }, (_, i): Block => ({ size: [0.3, 0.22, 0.3], at: [Math.sin((i / 8) * Math.PI * 2) * 0.62, 0.1, Math.cos((i / 8) * Math.PI * 2) * 0.62], colour: i % 2 ? 0x7c8794 : 0xa9b3c0, turn: i })),
    { size: [0.16, 0.16, 0.8], at: [0, 0.14, 0], colour: 0x4a3326, turn: 0.5 },
    { size: [0.16, 0.16, 0.8], at: [0, 0.2, 0], colour: 0x4a3326, turn: -0.7 },
    { size: [0.3, 0.42, 0.3], at: [0, 0.42, 0], colour: 0xe8742a, turn: 0.78 },
    { size: [0.18, 0.3, 0.18], at: [0.03, 0.7, 0.02], colour: 0xf2d16b, turn: 0.3 },
    // A log to sit on, and the coffee.
    { size: [1.7, 0.4, 0.42], at: [0.2, 0.2, 1.5], colour: 0x6b4a33, turn: 0.2 },
    { size: [0.26, 0.3, 0.26], at: [0.95, 0.15, 0.3], colour: 0x2a2e36 },
    { size: [0.08, 0.06, 0.2], at: [1.12, 0.22, 0.3], colour: 0x2a2e36 },
  ];
  return fine(list, 1.6);
}

/** A music stand, with the tune on it. */
function musicStand(): THREE.BufferGeometry {
  return fine(
    [
      { size: [0.05, 1.15, 0.05], at: [0, 0.58, 0], colour: 0x2a2e36 },
      { size: [0.5, 0.04, 0.05], at: [0, 0.03, 0], colour: 0x2a2e36 },
      { size: [0.05, 0.04, 0.5], at: [0, 0.03, 0], colour: 0x2a2e36 },
      { size: [0.56, 0.4, 0.04], at: [0, 1.28, 0.04], colour: 0x2a2e36, tip: -0.35 },
      { size: [0.46, 0.32, 0.03], at: [0, 1.29, 0.07], colour: 0xfbf8ee, tip: -0.35 },
    ],
    3,
  );
}

const PROPS: Record<NonNullable<Person['prop']>, () => THREE.BufferGeometry> = { snowcat, sled, easel, camp, stand: musicStand };

/**
 * What stands beside one of the people who roam, as models made outside the game (`thing-*` in
 * tools/models/manifest.mjs): an easel, a camp, a music stand. Each is set down with its front
 * at its own +z, as the ones built from blocks are. Null when the made models are not loaded,
 * and the blocks are used.
 */
function madeProp(kind: NonNullable<Person['prop']>): { geometry: THREE.BufferGeometry; shell: THREE.BufferGeometry | null } | null {
  const has = (id: string): ModelFile | null => madeModel(id) ?? null;
  // (A made model faces its own -z: half a turn brings its front to +z.)
  if (kind === 'easel') {
    const easel = has('thing-easel');
    return easel ? joinModels([{ file: easel, tall: 1.9, turn: Math.PI }]) : null;
  }
  if (kind === 'stand') {
    const stand = has('thing-stand');
    return stand ? joinModels([{ file: stand, tall: 1.35, turn: Math.PI }]) : null;
  }
  if (kind === 'camp') {
    const tent = has('thing-tent');
    const fire = has('thing-campfire');
    // The fire where the camp is said to be, and the tent to one side of it with its door toward the fire.
    return tent && fire ? joinModels([{ file: fire, tall: 0.95, turn: Math.PI }, { file: tent, tall: 1.9, x: -3.3, z: -0.4, turn: -Math.PI / 2 }]) : null;
  }
  return null;
}

/**
 * The people of the mountain and the town, each standing at their post in their own colours. They
 * are the same jointed figure as the player. One turns to watch the player come up, and carries a
 * mark overhead while they have something to ask, hand over or say thanks for.
 */
export class Folk {
  readonly group = new THREE.Group();
  private readonly figures: { standing: Standing; body: THREE.Mesh; mark: THREE.Mesh; yaw: number }[] = [];
  private readonly props = new Map<string, THREE.Mesh>();
  /** Whoever is not about just now: not drawn, and not to be talked to. */
  private readonly away = new Set<string>();
  private time = 0;

  /** @param season some of them dress for it, and one of them is made of it */
  constructor(people: readonly Standing[], castShadow: boolean, season: Season = 'winter') {
    this.group.name = 'folk';
    const material = lit({ vertexColors: true, flatShading: true });
    // The line round a made model: its own shape a little larger, inside out, in ink.
    const ink = new THREE.MeshBasicMaterial({ color: 0x22304a, side: THREE.BackSide });
    for (const standing of people) {
      const kind = standing.person.kind ?? 'person';
      // The dog and the cat have models made outside the game, as the animals of the field guide
      // do, when those have been loaded: otherwise the ones built here from blocks.
      const file = kind === 'dog' || kind === 'cat' ? madeModel(standing.person.id) : undefined;
      // In winter Tom is the snowman of the field guide, in his own top hat: one snowman on the mountain, not two.
      const snow = kind === 'snowman' && season === 'winter' ? madeModel('snowman') : undefined;
      const pet = file ? modelGeometry(file, kind === 'dog' ? 1.4 : 1) : snow ? modelGeometry(snow, 1.95) : null;
      const geometry = pet ? pet.geometry : kind === 'board' ? noticeboard() : kind === 'dog' ? dog() : kind === 'cat' ? cat() : kind === 'snowman' ? tom(season) : standingFigure(standing.person.look);
      const body = new THREE.Mesh(geometry, material);
      if (pet?.shell) body.add(new THREE.Mesh(pet.shell, ink));
      if (snow) {
        const hat = new THREE.Mesh(fine(tomsHat(0), 2), material);
        hat.position.y = 1.9;
        body.add(hat);
      }
      body.scale.setScalar(kind === 'person' ? SCALE : kind === 'cat' ? 0.62 : 1);
      // Whatever stands beside them: one more mesh, shown and hidden with its owner.
      if (standing.prop && standing.person.prop) {
        const made = madeProp(standing.person.prop);
        const prop = new THREE.Mesh(made ? made.geometry : PROPS[standing.person.prop](), material);
        if (made?.shell) prop.add(new THREE.Mesh(made.shell, ink));
        prop.position.set(standing.prop.x, standing.prop.y, standing.prop.z);
        prop.rotation.y = standing.prop.turn;
        prop.castShadow = castShadow;
        this.group.add(prop);
        this.props.set(standing.person.id, prop);
      }
      body.position.set(standing.x, standing.y, standing.z);
      // Facing south to begin with, out from the door.
      body.rotation.y = Math.PI;
      body.castShadow = castShadow;
      const mark = flag(0xffb02e);
      mark.visible = false;
      this.group.add(body, mark);
      this.figures.push({ standing, body, mark, yaw: Math.PI });
    }
  }

  /** The nearest person within reach of a position, if any. */
  nearest(x: number, z: number, reach: number): Standing | null {
    let best: Standing | null = null;
    let bestDist = reach;
    for (const f of this.figures) {
      if (this.away.has(f.standing.person.id)) continue;
      const d = Math.hypot(f.standing.x - x, f.standing.z - z);
      if (d < bestDist) {
        bestDist = d;
        best = f.standing;
      }
    }
    return best;
  }

  /**
   * Stand someone somewhere else, with whatever stands beside them; or, given nothing, send
   * them home: they are not drawn and cannot be talked to until they are stood somewhere again.
   */
  move(id: string, to: { x: number; y: number; z: number; prop?: { x: number; y: number; z: number; turn: number } } | null): void {
    const f = this.figures.find((g) => g.standing.person.id === id);
    if (!f) return;
    const prop = this.props.get(id);
    if (!to) {
      this.away.add(id);
      f.body.visible = false;
      f.mark.visible = false;
      if (prop) prop.visible = false;
      return;
    }
    this.away.delete(id);
    f.standing.x = to.x;
    f.standing.y = to.y;
    f.standing.z = to.z;
    f.body.position.set(to.x, to.y, to.z);
    if (prop && to.prop) {
      prop.position.set(to.prop.x, to.prop.y, to.prop.z);
      prop.rotation.y = to.prop.turn;
      f.standing.prop = to.prop;
    }
  }

  /** True if someone is about: stood somewhere, to be seen and talked to. */
  about(id: string): boolean {
    return !this.away.has(id) && this.figures.some((f) => f.standing.person.id === id);
  }

  /**
   * @param hasBusiness whether a person has something for the player, by id
   * @param cameraYaw so the marks face the camera
   */
  update(dt: number, player: { x: number; z: number }, hasBusiness: (id: string) => boolean, cameraYaw: number): void {
    this.time += dt;
    for (const f of this.figures) {
      const { standing, body, mark } = f;
      if (this.away.has(standing.person.id)) continue;
      const dx = player.x - standing.x;
      const dz = player.z - standing.z;
      const dist = Math.hypot(dx, dz);
      const shown = dist < DRAW_RANGE;
      body.visible = shown;
      const prop = this.props.get(standing.person.id);
      if (prop) prop.visible = shown;
      mark.visible = shown && hasBusiness(standing.person.id);
      if (!shown) continue;
      const kind = standing.person.kind ?? 'person';
      // A board and a snowman stay as they were put.
      if (kind === 'board' || kind === 'snowman') {
        if (mark.visible) {
          mark.position.set(standing.x, standing.y + 3 + Math.sin(this.time * 2.2) * 0.08, standing.z);
          mark.rotation.y = cameraYaw;
        }
        continue;
      }
      // Turn to face whoever is coming; otherwise look out from the door.
      const want = dist < NOTICE_RANGE && dist > 0.5 ? Math.atan2(-dx, -dz) : Math.PI;
      const turn = Math.atan2(Math.sin(want - f.yaw), Math.cos(want - f.yaw));
      f.yaw += turn * Math.min(1, dt * 4);
      // Rocking a little on their heels, as people do who stand outside all day.
      // A dog who sees someone coming wags all over.
      const wag = kind === 'dog' && dist < NOTICE_RANGE ? Math.sin(this.time * 11) * 0.09 : 0;
      body.rotation.set(Math.sin(this.time * 0.8 + standing.x) * 0.025, f.yaw + wag, Math.sin(this.time * 0.6 + standing.z) * 0.02 + wag * 0.5);
      if (mark.visible) {
        mark.position.set(standing.x, standing.y + (kind === 'dog' ? 1.9 : kind === 'cat' ? 1.25 : 2.25) + Math.sin(this.time * 2.2 + standing.z) * 0.08, standing.z);
        mark.rotation.y = cameraYaw;
      }
    }
  }
}

export interface Keepsake {
  id: string;
  x: number;
  y: number;
  z: number;
}

const KEEPSAKE_MODEL: Record<string, Block[]> = {
  mitten: [
    { size: [0.34, 0.14, 0.46], at: [0, 0.1, 0], colour: 0xf0d040 },
    { size: [0.14, 0.12, 0.2], at: [0.22, 0.09, 0.08], colour: 0xf0d040 },
    { size: [0.36, 0.15, 0.12], at: [0, 0.1, 0.26], colour: 0xfafafa },
  ],
  goggles: [
    { size: [0.5, 0.2, 0.12], at: [0, 0.14, 0], colour: 0x2b3a55 },
    { size: [0.42, 0.13, 0.04], at: [0, 0.14, -0.07], colour: 0xf0a030 },
    { size: [0.7, 0.06, 0.05], at: [0, 0.14, 0.12], colour: 0xe86aa0 },
  ],
  kite: [
    { size: [0.9, 0.04, 0.9], at: [0, 0.2, 0], colour: 0xd02a2a, turn: Math.PI / 4, tip: 0.25 },
    { size: [0.05, 0.03, 1.2], at: [0, 0.22, 0], colour: 0x6b4a33, tip: 0.25 },
    { size: [0.06, 0.03, 0.9], at: [0.1, 0.05, 0.8], colour: 0xf0d040, turn: 0.4 },
  ],
};

/** Lost property lying on the mountain while someone is looking for it: a small thing with a mark over it. */
export class Keepsakes {
  readonly group = new THREE.Group();
  private readonly material = lit({ vertexColors: true, flatShading: true });
  private readonly shown = new Map<string, { item: Keepsake; mesh: THREE.Mesh; mark: THREE.Mesh }>();
  private time = 0;

  /** The items lying about just now. */
  set(items: readonly Keepsake[]): void {
    const wanted = new Set(items.map((i) => i.id));
    for (const [id, s] of this.shown) {
      if (wanted.has(id)) continue;
      this.group.remove(s.mesh, s.mark);
      this.shown.delete(id);
    }
    for (const item of items) {
      if (this.shown.has(item.id)) continue;
      const mesh = new THREE.Mesh(blocks(KEEPSAKE_MODEL[item.id] ?? [{ size: [0.4, 0.3, 0.4], at: [0, 0.15, 0], colour: 0xc2412d }]), this.material);
      // Bigger than life, like everything small in the game.
      mesh.scale.setScalar(1.6);
      mesh.position.set(item.x, item.y + 0.05, item.z);
      const mark = flag(0xffb02e);
      this.group.add(mesh, mark);
      this.shown.set(item.id, { item, mesh, mark });
    }
  }

  /** The item within reach of a position, if any. */
  near(x: number, z: number, reach: number): Keepsake | null {
    for (const s of this.shown.values()) if (Math.hypot(s.item.x - x, s.item.z - z) <= reach) return s.item;
    return null;
  }

  update(dt: number, cameraYaw: number): void {
    this.time += dt;
    for (const s of this.shown.values()) {
      s.mark.position.set(s.item.x, s.item.y + 1.6 + Math.sin(this.time * 2.4) * 0.1, s.item.z);
      s.mark.rotation.y = cameraYaw;
    }
  }
}

export interface Stop {
  id: string;
  name: string;
  x: number;
  y: number;
  z: number;
}

/** The shuttle's stops: a sign, and the little bus that waits there. */
export function buildStops(stops: readonly Stop[], castShadow: boolean): THREE.Group {
  const group = new THREE.Group();
  group.name = 'stops';
  const material = lit({ vertexColors: true, flatShading: true });
  for (const stop of stops) {
    const list: Block[] = [
      // The sign.
      { size: [0.12, 2.6, 0.12], at: [0, 1.3, 0], colour: 0x4d5666 },
      { size: [0.9, 0.6, 0.08], at: [0, 2.5, 0], colour: 0x2b62c9 },
      { size: [0.5, 0.26, 0.1], at: [0, 2.5, 0], colour: 0xf4f1ea },
      // The bus: cream with a red stripe, as old ski shuttles were.
      { size: [2.3, 1.9, 5.6], at: [3.4, 1.4, 0], colour: 0xf1e8d6 },
      { size: [2.34, 0.34, 5.64], at: [3.4, 1.0, 0], colour: 0xc2412d },
      { size: [2.1, 0.12, 5.2], at: [3.4, 2.4, 0], colour: 0xd9d2c0 },
      { size: [2.32, 0.6, 4.6], at: [3.4, 1.75, -0.2], colour: 0x3d4a5e },
      ...[-1.7, 1.7].flatMap((z): Block[] => [-1, 1].map((sx): Block => ({ size: [0.3, 0.8, 0.8], at: [3.4 + sx * 1.1, 0.4, z], colour: 0x1c1c20 }))),
    ];
    const mesh = new THREE.Mesh(blocks(list), material);
    mesh.position.set(stop.x, stop.y - 0.1, stop.z);
    mesh.castShadow = castShadow;
    mesh.matrixAutoUpdate = false;
    mesh.updateMatrix();
    group.add(mesh);
  }
  return group;
}
