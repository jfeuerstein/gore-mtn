import * as THREE from 'three/webgpu';
import type { Season } from '../look/season';
import { planHeight, type HouseKind, type HousePlan } from './houseKinds';
import { blocks, placed, roof, siding, type Block } from './shapes';
import type { SignSpec } from './signs';

/**
 * Every building on the map that has no name of its own, built for what it is: a cape, a
 * farmhouse with a porch, a camp in the woods, a shed, a false-fronted shop on Main Street, one
 * of the ski area's own. `houseKinds.ts` says which; this makes them, each to the size of its
 * real plot, with nothing stretched.
 *
 * Each is put together in its own frame (front toward +z, the ground at its front wall at
 * y = 0) and then set down. All of them in one part of the map are one mesh of walls and one of
 * windows, so the whole town is a handful of draw calls.
 */

/** A window pane: a flat rectangle on one face of a building, lit after dark. */
export interface Pane {
  x: number;
  y: number;
  z: number;
  w: number;
  h: number;
  /** Which way it looks: 0 out of the front (+z), 1 the back, 2 the right (+x), 3 the left. */
  face: 0 | 1 | 2 | 3;
}

export interface Kit {
  list: Block[];
  extra: THREE.BufferGeometry[];
  panes: Pane[];
  /** Where its sign hangs, if it has one: height, how far out from the middle, how tall and how wide. */
  sign?: { y: number; out: number; h: number; w: number; board: string; ink: string };
}

/** The floor is this far above the ground at the front wall, and the stone under it goes down this far, so no plot is too steep. */
const FLOOR = 0.45;
const FOOTING = 7;
const STOREY = 2.8;

const SNOW = 0xf2f5fa;
const WHITE = 0xf5f2ea;
const STONE = 0x8a8f9c;
const BRICK = 0x9f5340;
const TIMBER = 0x8a5a3c;
const TIMBER_DARK = 0x5f4230;
const IRON = 0x3a3f48;

/** House paint, as an Adirondack village wears it. */
const PAINTS = [0xf5f2ea, 0xece5d3, 0xe8d9ae, 0xcfd8df, 0xbcc8ae, 0xb9a996, 0xa9483a, 0x8f9a8a, 0x7d8ea0, 0xd8c3a5, 0x9a8a78, 0x5f6f7a];
/** Front doors. */
const DOORS = [0x7a2e26, 0x2f4a3f, 0x2b4a7a, 0x4a3326, 0x22262d, 0xc79a3a];
/** Roofs, when they are not under snow. */
const ROOFS = [0x5c6672, 0x4a4f58, 0x6b5a4a, 0x3f5a4a, 0x7a3a30, 0x3a3f48];
/** Sheds and barns: weathered boards, red lead, grey. */
const ROUGH = [0x8a7a68, 0x9a3a2c, 0x6f6a62, 0x7a5a42, 0xa8a094];
/** Shopfronts on Main Street. */
const SHOP_PAINTS = [0xece5d3, 0xcfd8df, 0xbcc8ae, 0xe8d9ae, 0x8f9a8a, 0x7d8ea0, 0xd9b9a0, 0xf5f2ea, 0xa9483a, 0x6f7f8a];
const BRICKS = [0x9f5340, 0x8a4a3c, 0xb5654a, 0xcdb99a, 0x7a4636];
const AWNINGS = [0x2f6a4c, 0xb53a2a, 0x2b4a7a, 0xe2a52e, 0x5a3a6a, 0x22262d];
const BOARDS: readonly [string, string][] = [
  ['#f5f2ea', '#22304a'],
  ['#2f5a44', '#f1d58a'],
  ['#8f3326', '#f5ecd8'],
  ['#22304a', '#f5ecd8'],
  ['#22262d', '#e8c56a'],
  ['#e8d9ae', '#5a2e22'],
];

const pick = <T>(list: readonly T[], roll: number): T => list[Math.min(list.length - 1, Math.floor(roll * list.length))] as T;
/** A colour a little darker or lighter. */
const shade = (colour: number, by: number): number => new THREE.Color(colour).multiplyScalar(by).getHex();

/** A roof with four slopes: a ridge along the longer side, or a point if it is square. Its eaves sit at y = 0. */
export function hipRoof(w: number, d: number, height: number, colour: number): THREE.BufferGeometry {
  const hw = w / 2;
  const hd = d / 2;
  // Half the length of the ridge, along whichever side is longer.
  const rx = Math.max(0, (w - d) / 2);
  const rz = Math.max(0, (d - w) / 2);
  const a = [-rx, height, -rz];
  const b = [rx, height, rz];
  const c0 = [-hw, 0, -hd];
  const c1 = [hw, 0, -hd];
  const c2 = [hw, 0, hd];
  const c3 = [-hw, 0, hd];
  const faces: number[][][] = w >= d ? [[c3, c2, b], [c3, b, a], [c1, c0, a], [c1, a, b], [c2, c1, b], [c0, c3, a]] : [[c2, c1, a], [c2, a, b], [c0, c3, b], [c0, b, a], [c3, c2, b], [c1, c0, a]];
  const positions: number[] = [];
  for (const f of faces) {
    const [p, q, r] = f as [number[], number[], number[]];
    // Whichever way round it was written, a roof faces up.
    const ny = ((q[2] as number) - (p[2] as number)) * ((r[0] as number) - (p[0] as number)) - ((q[0] as number) - (p[0] as number)) * ((r[2] as number) - (p[2] as number));
    positions.push(...p, ...(ny >= 0 ? q : r), ...(ny >= 0 ? r : q));
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.computeVertexNormals();
  const col = new THREE.Color(colour);
  geo.setAttribute('color', new THREE.Float32BufferAttribute(Array.from({ length: positions.length / 3 }, () => [col.r, col.g, col.b]).flat(), 3));
  return geo;
}

/** The stone a building stands on, and its walls: a box of one colour on the footing. Returns the height of the top of the walls. */
function body(kit: Kit, w: number, d: number, h: number, colour: number, x = 0, z = 0, footing = STONE): number {
  kit.list.push({ size: [w + 0.3, FLOOR + FOOTING, d + 0.3], at: [x, (FLOOR - FOOTING) / 2, z], colour: footing }, { size: [w, h, d], at: [x, FLOOR + h / 2, z], colour });
  return FLOOR + h;
}

/** A pitched roof over a box: ridge along the front, or running back from it. */
export function gable(kit: Kit, w: number, d: number, y: number, height: number, top: number, end: number, back = false, x = 0, z = 0, eaves = 0.5): void {
  kit.extra.push(back ? placed(roof(d + eaves * 2, w + eaves * 2, height, top, end), x, y, z, Math.PI / 2) : placed(roof(w + eaves * 2, d + eaves * 2, height, top, end), x, y, z));
}

/**
 * A window on one face: a pane, with a frame round it, and shutters if asked for.
 * @param wall how far the wall is from the middle of the building, along the way the window looks
 * @param along where it is along that wall
 */
export function win(kit: Kit, face: 0 | 1 | 2 | 3, wall: number, along: number, y: number, w: number, h: number, frame: number | null = WHITE, shutters: number | null = null): void {
  const out = face === 0 || face === 2 ? 1 : -1;
  const side = face >= 2;
  const at = (a: number, off: number): [number, number, number] => (side ? [out * (wall + off), y, a] : [a, y, out * (wall + off)]);
  const size = (sw: number, sh: number, t: number): [number, number, number] => (side ? [t, sh, sw] : [sw, sh, t]);
  if (frame !== null) kit.list.push({ size: size(w + 0.26, h + 0.26, 0.1), at: at(along, 0.01), colour: frame });
  if (shutters !== null) for (const s of [-1, 1]) kit.list.push({ size: size(0.36, h + 0.1, 0.08), at: at(along + s * (w / 2 + 0.33), 0.02), colour: shutters });
  const [px, py, pz] = at(along, frame !== null ? 0.075 : 0.03);
  kit.panes.push({ x: px, y: py, z: pz, w, h, face });
}

/** A row of windows along a face, evenly spaced, leaving out any that `skip` names. */
export function row(kit: Kit, face: 0 | 1 | 2 | 3, wall: number, span: number, y: number, n: number, w: number, h: number, frame: number | null = WHITE, shutters: number | null = null, skip: (along: number) => boolean = () => false, mid = 0): void {
  for (let i = 0; i < n; i++) {
    const along = mid - span / 2 + ((i + 0.5) * span) / n;
    if (!skip(along)) win(kit, face, wall, along, y, w, h, frame, shutters);
  }
}

/** A front door, with a step up to it. */
function door(kit: Kit, x: number, front: number, colour: number, w = 1.05, h = 2.1, trim: number | null = WHITE): void {
  if (trim !== null) kit.list.push({ size: [w + 0.3, h + 0.2, 0.1], at: [x, FLOOR + h / 2 + 0.05, front + 0.01], colour: trim });
  kit.list.push({ size: [w, h, 0.12], at: [x, FLOOR + h / 2, front + 0.03], colour }, { size: [w + 0.9, FLOOR, 1.1], at: [x, FLOOR / 2, front + 0.55], colour: STONE });
}

/** A chimney from the ground to above the roof. */
function chimney(kit: Kit, x: number, z: number, top: number, colour = BRICK, size = 0.8): void {
  kit.list.push({ size: [size, top, size], at: [x, top / 2, z], colour }, { size: [size + 0.2, 0.16, size + 0.2], at: [x, top + 0.02, z], colour: shade(colour, 0.7) });
}

/** A porch across a front: a deck, posts, and a roof of its own that slopes away from the wall. */
function porch(kit: Kit, w: number, front: number, depth: number, roofColour: number, posts = WHITE, top = FLOOR + 2.55, x = 0, rail: number | null = null): void {
  kit.list.push(
    { size: [w, FLOOR, depth], at: [x, FLOOR / 2, front + depth / 2], colour: shade(TIMBER, 0.8) },
    { size: [w + 0.5, 0.16, depth + 0.5], at: [x, top + 0.18, front + depth / 2 + 0.05], colour: roofColour, tip: 0.12 },
    { size: [w, 0.22, 0.16], at: [x, top - 0.08, front + depth - 0.1], colour: posts },
  );
  const n = Math.max(2, Math.round(w / 2.6));
  for (let i = 0; i <= n; i++) kit.list.push({ size: [0.18, top - FLOOR, 0.18], at: [x - w / 2 + 0.12 + (i * (w - 0.24)) / n, (top + FLOOR) / 2, front + depth - 0.1], colour: posts });
  if (rail !== null) kit.list.push({ size: [w, 0.08, 0.08], at: [x, FLOOR + 0.85, front + depth - 0.1], colour: rail });
}

/** A shopfront: a kick panel, two big windows either side of a door, and a board above for the name. */
function shopfront(kit: Kit, w: number, front: number, trim: number, doorColour: number, signY = FLOOR + 3.1): void {
  const span = w * 0.88;
  const glass = (span - 1.7) / 2;
  kit.list.push(
    // The kick panel under the windows, and the band the sign goes on.
    { size: [span, 0.62, 0.14], at: [0, FLOOR + 0.31, front + 0.03], colour: shade(trim, 0.55) },
    { size: [span + 0.2, 0.9, 0.16], at: [0, signY, front + 0.04], colour: trim },
    { size: [1.15, 2.15, 0.1], at: [0, FLOOR + 1.08, front - 0.02], colour: doorColour },
    { size: [1.9, FLOOR, 1], at: [0, FLOOR / 2, front + 0.5], colour: STONE },
  );
  for (const s of [-1, 1]) {
    const x = s * (0.85 + glass / 2);
    kit.list.push({ size: [glass + 0.2, 1.95, 0.1], at: [x, FLOOR + 1.55, front + 0.02], colour: trim });
    kit.panes.push({ x, y: FLOOR + 1.55, z: front + 0.085, w: glass, h: 1.75, face: 0 });
  }
  // A light over the door.
  kit.panes.push({ x: 0, y: FLOOR + 2.42, z: front + 0.04, w: 1.05, h: 0.4, face: 0 });
}

/** An awning over a shopfront: a sloping sheet of one colour with a pale edge. */
function awning(kit: Kit, w: number, front: number, colour: number, y = FLOOR + 2.55): void {
  kit.list.push({ size: [w, 0.08, 1.5], at: [0, y - 0.05, front + 0.7], colour, tip: 0.36 }, { size: [w, 0.26, 0.05], at: [0, y - 0.42, front + 1.4], colour: 0xf4ead8 });
}

/** A string of lights along a front, for the dark months: they go with the windows, so they come on at dusk. */
function lights(kit: Kit, w: number, z: number, y: number): void {
  const n = Math.max(5, Math.round(w / 1.1));
  for (let i = 0; i <= n; i++) kit.panes.push({ x: -w / 2 + (i * w) / n, y: y - Math.abs(Math.sin((i / n) * Math.PI * Math.max(2, Math.round(w / 4)))) * 0.18, z, w: 0.14, h: 0.14, face: 0 });
}

/** A rail of skis leaned up in pairs, as outside any door at the foot of a ski hill. */
export function skis(kit: Kit, x: number, z: number, pairs: number, seed: number): void {
  const paint = [0xd9a441, 0xc8402d, 0x2b62c9, 0x2f8a4e, 0xf4f1ea, 0x7a4ab0, 0xe8742a];
  const width = pairs * 0.5 + 0.4;
  kit.list.push({ size: [0.1, 1.3, 0.1], at: [x - width / 2, 0.65, z], colour: TIMBER_DARK }, { size: [0.1, 1.3, 0.1], at: [x + width / 2, 0.65, z], colour: TIMBER_DARK }, { size: [width + 0.2, 0.1, 0.12], at: [x, 1.25, z], colour: TIMBER_DARK });
  for (let i = 0; i < pairs; i++) for (const dx of [-0.07, 0.07]) kit.list.push({ size: [0.1, 1.75, 0.03], at: [x - width / 2 + 0.45 + i * 0.5 + dx, 0.86, z + 0.22], colour: paint[(i * 3 + seed) % paint.length] as number, tip: 0.24 });
}

interface Look {
  /** The colour of roofs under snow, or null when each building keeps its own. */
  snow: number | null;
  season: Season;
}

/** What a roof is this season. */
const roofOf = (look: Look, own: number): number => look.snow ?? own;

const KITS: Record<HouseKind, (p: HousePlan, look: Look) => Kit> = {
  cape(p, look) {
    // A storey and a half under a steep roof, with dormers and a chimney in the middle.
    const kit: Kit = { list: [], extra: [], panes: [] };
    const [, r1, r2, r3] = p.rolls;
    const paint = pick(PAINTS, r1);
    const top = roofOf(look, pick(ROOFS, r2));
    const front = p.d / 2;
    const eaves = body(kit, p.w, p.d, 3, paint);
    const rise = Math.min(4.4, p.d * 0.46);
    gable(kit, p.w, p.d, eaves, rise, top, paint);
    door(kit, 0, front, pick(DOORS, r3));
    // A little hood over the door.
    kit.extra.push(placed(roof(1.9, 1.1, 0.5, top, WHITE), 0, FLOOR + 2.3, front + 0.5));
    const shut = r3 < 0.6 ? pick([0x2f4a3f, 0x22262d, 0x4a3326, 0x2b4a7a], r2) : null;
    const pairs = p.w >= 10.5 ? 2 : 1;
    for (const s of [-1, 1]) for (let i = 0; i < pairs; i++) win(kit, 0, front, s * (p.w * (pairs === 2 ? 0.2 + i * 0.2 : 0.3)), FLOOR + 1.55, 0.95, 1.3, WHITE, shut);
    for (const s of [-1, 1]) {
      const x = s * p.w * 0.24;
      kit.list.push({ size: [1.5, 1.25, 1.7], at: [x, eaves + rise * 0.36, p.d * 0.2], colour: paint });
      kit.extra.push(placed(roof(2, 1.9, 0.6, top, paint), x, eaves + rise * 0.36 + 0.62, p.d * 0.2, Math.PI / 2));
      kit.panes.push({ x, y: eaves + rise * 0.36 + 0.05, z: p.d * 0.2 + 0.86, w: 0.8, h: 0.8, face: 0 });
    }
    chimney(kit, p.w * 0.12, 0, eaves + rise + 0.9, BRICK, 0.9);
    row(kit, 1, front, p.w * 0.8, FLOOR + 1.55, 2, 0.95, 1.2, null);
    for (const f of [2, 3] as const) {
      win(kit, f, p.w / 2, 0, FLOOR + 1.55, 0.95, 1.2, null);
      win(kit, f, p.w / 2, 0, eaves + rise * 0.3, 0.8, 0.9, null);
    }
    return kit;
  },

  farmhouse(p, look) {
    // Two storeys, a porch the width of the front, and a lower kitchen wing out the back.
    const kit: Kit = { list: [], extra: [], panes: [] };
    const [, r1, r2, r3] = p.rolls;
    const paint = pick(PAINTS, r1);
    const top = roofOf(look, pick(ROOFS, r2));
    const ell = p.d >= 10 && p.w >= 8;
    const deep = ell ? p.d * 0.6 : p.d;
    const z = (p.d - deep) / 2;
    const front = p.d / 2;
    const eaves = body(kit, p.w, deep, STOREY * 2, paint, 0, z);
    const rise = Math.min(3.8, deep * 0.36);
    gable(kit, p.w, deep, eaves, rise, top, paint, false, 0, z);
    const side = r3 < 0.5 ? -1 : 1;
    if (ell) {
      const we = p.w * 0.52;
      const de = p.d - deep;
      const ex = side * (p.w / 2 - we / 2);
      const ez = -p.d / 2 + de / 2;
      const low = body(kit, we, de + 0.2, STOREY + 0.3, paint, ex, ez + 0.1);
      gable(kit, we, de, low, Math.min(2.6, we * 0.3), top, paint, true, ex, ez);
      win(kit, side > 0 ? 2 : 3, Math.abs(ex) + we / 2, ez, FLOOR + 1.55, 0.95, 1.2, null);
      win(kit, 1, front, ex, FLOOR + 1.55, 0.95, 1.2, null);
    }
    porch(kit, p.w * 0.94, front, 2.1, top, WHITE, FLOOR + 2.5, 0, r2 < 0.5 ? WHITE : null);
    door(kit, 0, front, pick(DOORS, r3), 1.05, 2.1);
    const shut = r1 < 0.55 ? pick([0x2f4a3f, 0x22262d, 0x4a3326], r3) : null;
    for (const s of [-1, 1]) win(kit, 0, front, s * p.w * 0.3, FLOOR + 1.5, 0.95, 1.4, WHITE, shut);
    row(kit, 0, front, p.w * 0.9, FLOOR + STOREY + 1.6, p.w >= 9 ? 3 : 2, 0.95, 1.4, WHITE, shut);
    row(kit, 1, deep / 2 - z, p.w * 0.9, FLOOR + STOREY + 1.6, 2, 0.95, 1.3, null);
    for (const f of [2, 3] as const) {
      win(kit, f, p.w / 2, z, FLOOR + 1.5, 0.95, 1.3, null);
      win(kit, f, p.w / 2, z, FLOOR + STOREY + 1.6, 0.95, 1.3, null);
    }
    chimney(kit, -side * p.w * 0.32, z, eaves + rise * 0.7 + 1.1);
    return kit;
  },

  gablefront(p, look) {
    // Its gable to the road, a porch across the front, the door to one side.
    const kit: Kit = { list: [], extra: [], panes: [] };
    const [, r1, r2, r3] = p.rolls;
    const paint = pick(PAINTS, r1);
    const top = roofOf(look, pick(ROOFS, r2));
    const front = p.d / 2;
    const tall = p.w >= 6.5;
    const eaves = body(kit, p.w, p.d, tall ? STOREY * 2 - 0.3 : STOREY + 0.5, paint);
    const rise = Math.min(4, p.w * 0.42);
    gable(kit, p.w, p.d, eaves, rise, top, paint, true);
    // The gable faces the road: fish-scale shingles in another colour, and an attic window.
    kit.panes.push({ x: 0, y: eaves + rise * 0.3, z: front + 0.03, w: 0.8, h: 0.9, face: 0 });
    const side = r3 < 0.5 ? -1 : 1;
    porch(kit, p.w * 0.96, front, 1.9, top, WHITE, FLOOR + 2.45, 0, r2 < 0.6 ? WHITE : null);
    door(kit, side * p.w * 0.24, front, pick(DOORS, r3));
    win(kit, 0, front, -side * p.w * 0.2, FLOOR + 1.5, 1.2, 1.4);
    if (tall) row(kit, 0, front, p.w * 0.84, FLOOR + STOREY + 1.45, 2, 0.9, 1.4);
    const along = Math.max(2, Math.round(p.d / 4));
    for (const f of [2, 3] as const) {
      row(kit, f, p.w / 2, p.d * 0.84, FLOOR + 1.5, along, 0.9, 1.3, null);
      if (tall) row(kit, f, p.w / 2, p.d * 0.84, FLOOR + STOREY + 1.45, along, 0.9, 1.3, null);
    }
    chimney(kit, -side * (p.w / 2 - 0.5), -p.d * 0.15, eaves + rise * 0.3 + 1.6, BRICK, 0.7);
    return kit;
  },

  foursquare(p, look) {
    // A square house under a four-sided roof, with a dormer and a deep porch on brick piers.
    const kit: Kit = { list: [], extra: [], panes: [] };
    const [, r1, r2, r3] = p.rolls;
    const paint = pick(PAINTS, r1);
    const top = roofOf(look, pick(ROOFS, r2));
    const front = p.d / 2;
    const eaves = body(kit, p.w, p.d, STOREY * 2, paint);
    const rise = Math.min(3.4, Math.min(p.w, p.d) * 0.32);
    kit.extra.push(placed(hipRoof(p.w + 1.2, p.d + 1.2, rise, top), 0, eaves, 0));
    // A band between the storeys, as these houses have.
    kit.list.push({ size: [p.w + 0.1, 0.2, p.d + 0.1], at: [0, FLOOR + STOREY + 0.2, 0], colour: WHITE });
    kit.list.push({ size: [1.7, 1, 1.4], at: [0, eaves + rise * 0.42, p.d * 0.26], colour: paint });
    kit.extra.push(placed(hipRoof(2.2, 1.9, 0.6, top), 0, eaves + rise * 0.42 + 0.5, p.d * 0.26));
    kit.panes.push({ x: 0, y: eaves + rise * 0.42, z: p.d * 0.26 + 0.71, w: 1.1, h: 0.6, face: 0 });
    porch(kit, p.w * 0.98, front, 2.4, top, pick([BRICK, WHITE, STONE], r3), FLOOR + 2.6);
    const side = r3 < 0.5 ? -1 : 1;
    door(kit, side * p.w * 0.2, front, pick(DOORS, r2));
    win(kit, 0, front, -side * p.w * 0.22, FLOOR + 1.5, 1.5, 1.4);
    row(kit, 0, front, p.w * 0.84, FLOOR + STOREY + 1.6, 2, 1.1, 1.4);
    row(kit, 1, front, p.w * 0.84, FLOOR + STOREY + 1.6, 2, 1, 1.3, null);
    for (const f of [2, 3] as const) {
      row(kit, f, p.w / 2, p.d * 0.8, FLOOR + 1.5, 2, 0.95, 1.3, null);
      row(kit, f, p.w / 2, p.d * 0.8, FLOOR + STOREY + 1.6, 2, 0.95, 1.3, null);
    }
    chimney(kit, -side * p.w * 0.3, -p.d * 0.2, eaves + rise * 0.5 + 1.3);
    return kit;
  },

  camp(p, look) {
    // An Adirondack camp: dark boards, a green roof with deep eaves, a screened porch, a stone chimney, and the wood stacked by the door.
    const kit: Kit = { list: [], extra: [], panes: [] };
    const [, r1, r2, r3] = p.rolls;
    const boards = pick([0x6b4a33, 0x5f4230, 0x7a5232, 0x54463a], r1);
    const trim = pick([0x7a2e26, 0x2f4a3f, 0xc9b98a], r2);
    const top = roofOf(look, pick([0x3f5a4a, 0x4a4f58, 0x6b3a30], r2));
    const front = p.d / 2;
    const eaves = body(kit, p.w, p.d, 2.9, boards);
    const rise = Math.min(3, p.d * 0.3);
    gable(kit, p.w, p.d, eaves, rise, top, boards, false, 0, 0, 0.9);
    // The porch: a low wall of boards, dark screens above it, and the roof carried on over.
    const depth = 2.2;
    const wide = p.w * 0.9;
    kit.list.push(
      { size: [wide, FLOOR, depth], at: [0, FLOOR / 2, front + depth / 2], colour: shade(boards, 0.8) },
      { size: [wide, 0.8, 0.12], at: [0, FLOOR + 0.4, front + depth - 0.06], colour: boards },
      { size: [wide, 1.45, 0.05], at: [0, FLOOR + 1.55, front + depth - 0.08], colour: 0x2b302a },
      { size: [wide + 0.8, 0.16, depth + 0.8], at: [0, FLOOR + 2.55, front + depth / 2], colour: top, tip: 0.16 },
      { size: [1, 2, 0.1], at: [wide * 0.3, FLOOR + 1, front + depth], colour: trim },
      { size: [1.6, FLOOR, 0.9], at: [wide * 0.3, FLOOR / 2, front + depth + 0.45], colour: STONE },
    );
    for (const x of [-wide / 2, wide / 2]) kit.list.push({ size: [0.2, 2.5, 0.2], at: [x, FLOOR + 1.25, front + depth - 0.08], colour: boards });
    const side = r3 < 0.5 ? -1 : 1;
    kit.list.push({ size: [1.5, eaves + rise + 0.9, 1], at: [side * (p.w / 2 + 0.3), (eaves + rise + 0.9) / 2, -p.d * 0.1], colour: STONE });
    // Firewood under the eaves, and now and then a canoe on its side.
    kit.list.push({ size: [0.7, 1.1, Math.min(3, p.d * 0.4)], at: [-side * (p.w / 2 + 0.5), 0.55, p.d * 0.1], colour: 0xb89a6a });
    if (r1 > 0.55) kit.list.push({ size: [0.75, 0.42, 4.2], at: [-side * (p.w / 2 + 1.5), 0.5, -p.d * 0.1], colour: pick([0x2f6a4c, 0xa8392b, 0xd9c9a8], r3), tip: 0.06 });
    row(kit, 1, front, p.w * 0.8, FLOOR + 1.5, 2, 0.9, 1, trim);
    for (const f of [2, 3] as const) win(kit, f, p.w / 2, p.d * 0.15, FLOOR + 1.5, 0.9, 1, trim);
    return kit;
  },

  ranch(p, look) {
    // Long and low, with the garage at one end and a picture window.
    const kit: Kit = { list: [], extra: [], panes: [] };
    const [, r1, r2, r3] = p.rolls;
    const paint = pick(PAINTS, r1);
    const top = roofOf(look, pick(ROOFS, r2));
    const front = p.d / 2;
    const longFront = p.w >= p.d;
    const eaves = body(kit, p.w, p.d, 2.7, paint);
    gable(kit, p.w, p.d, eaves, Math.min(2.2, Math.min(p.w, p.d) * 0.26), top, paint, !longFront, 0, 0, 0.6);
    // Brick to the sills along the front.
    kit.list.push({ size: [p.w + 0.06, 1, 0.08], at: [0, FLOOR + 0.5, front + 0.01], colour: shade(BRICK, 1.05) });
    const side = r3 < 0.5 ? -1 : 1;
    if (longFront && p.w >= 12) {
      const gx = side * (p.w / 2 - 2);
      kit.list.push({ size: [2.8, 2.15, 0.1], at: [gx, FLOOR + 1.08 - 0.3, front + 0.05], colour: WHITE });
      for (const y of [0.5, 1.05, 1.6]) kit.list.push({ size: [2.8, 0.04, 0.03], at: [gx, FLOOR + y - 0.3, front + 0.11], colour: 0xb9b4ac });
      door(kit, side * (p.w / 2 - 5), front, pick(DOORS, r2), 1, 2.05);
      win(kit, 0, front, -side * p.w * 0.1, FLOOR + 1.6, 2.3, 1.2);
      win(kit, 0, front, -side * p.w * 0.34, FLOOR + 1.7, 1, 1);
    } else {
      door(kit, side * p.w * 0.2, front, pick(DOORS, r2), 1, 2.05);
      win(kit, 0, front, -side * p.w * 0.2, FLOOR + 1.6, Math.min(2.2, p.w * 0.3), 1.2);
    }
    row(kit, 1, front, p.w * 0.85, FLOOR + 1.6, Math.max(2, Math.round(p.w / 5)), 1, 1, null);
    for (const f of [2, 3] as const) row(kit, f, p.w / 2, p.d * 0.8, FLOOR + 1.6, Math.max(1, Math.round(p.d / 6)), 1, 1, null);
    chimney(kit, -side * p.w * 0.15, 0, eaves + 2.2, BRICK, 1.1);
    return kit;
  },

  shed(p, look) {
    // Four walls, a roof that slopes one way, and a pair of doors.
    const kit: Kit = { list: [], extra: [], panes: [] };
    const [, r1, r2] = p.rolls;
    const boards = pick(ROUGH, r1);
    const top = roofOf(look, pick([0x6f6a62, 0x7a4a3a, 0x4a4f58], r2));
    const front = p.d / 2;
    kit.list.push(
      { size: [p.w, 2.3 + FOOTING, p.d], at: [0, (2.3 - FOOTING) / 2, 0], colour: boards },
      { size: [p.w + 0.5, 0.14, p.d + 0.6], at: [0, 2.55, 0], colour: top, tip: -Math.min(0.2, 0.9 / p.d) },
      { size: [Math.min(1.8, p.w * 0.6), 1.9, 0.08], at: [0, 0.97, front + 0.03], colour: shade(boards, 0.72) },
      { size: [0.05, 1.9, 0.1], at: [0, 0.97, front + 0.04], colour: shade(boards, 0.5) },
    );
    if (p.w > 3.2) win(kit, 2, p.w / 2, 0, 1.5, 0.7, 0.7, shade(boards, 0.8));
    return kit;
  },

  garage(p, look) {
    // One wide door with panels, a gable over it, and a window in the side.
    const kit: Kit = { list: [], extra: [], panes: [] };
    const [, r1, r2] = p.rolls;
    const paint = pick([...PAINTS, ...ROUGH], r1);
    const top = roofOf(look, pick(ROOFS, r2));
    const front = p.d / 2;
    kit.list.push({ size: [p.w, 2.7 + FOOTING, p.d], at: [0, (2.7 - FOOTING) / 2, 0], colour: paint });
    gable(kit, p.w, p.d, 2.7, Math.min(2.2, Math.min(p.w, p.d) * 0.3), top, paint, p.w <= p.d * 1.25, 0, 0, 0.35);
    const wide = Math.min(p.w - 1.2, p.w > 8 ? 5 : 2.9);
    kit.list.push({ size: [wide + 0.3, 2.35, 0.08], at: [0, 1.17, front + 0.02], colour: WHITE }, { size: [wide, 2.15, 0.1], at: [0, 1.07, front + 0.04], colour: 0xe4dfd2 });
    for (const y of [0.55, 1.1, 1.65]) kit.list.push({ size: [wide, 0.04, 0.03], at: [0, y, front + 0.1], colour: 0xa9a49a });
    win(kit, 2, p.w / 2, 0, 1.6, 0.8, 0.8);
    win(kit, 3, p.w / 2, 0, 1.6, 0.8, 0.8, null);
    return kit;
  },

  barn(p, look) {
    // A big barn: a steep roof, sliding doors framed in white, a loft door, and a cupola on the ridge.
    const kit: Kit = { list: [], extra: [], panes: [] };
    const [, r1, r2] = p.rolls;
    const boards = pick([0x9a3a2c, 0x8a3226, 0x8a7a68, 0x9a3a2c], r1);
    const top = roofOf(look, pick([0x5c6672, 0x4a4f58, 0x6f6a62], r2));
    const front = p.d / 2;
    const longFront = p.w >= p.d;
    const eaves = body(kit, p.w, p.d, 5.4, boards);
    const rise = Math.min(5.5, Math.min(p.w, p.d) * 0.4);
    gable(kit, p.w, p.d, eaves, rise, top, boards, !longFront, 0, 0, 0.7);
    kit.list.push({ size: [4.6, 3.8, 0.1], at: [0, FLOOR + 1.9, front + 0.03], colour: shade(boards, 0.82) });
    for (const x of [-2.3, 0, 2.3]) kit.list.push({ size: [0.2, 3.8, 0.1], at: [x, FLOOR + 1.9, front + 0.08], colour: WHITE });
    for (const y of [0.1, 1.9, 3.7]) kit.list.push({ size: [4.8, 0.2, 0.1], at: [0, FLOOR + y, front + 0.08], colour: WHITE });
    kit.list.push({ size: [1.5, 1.3, 0.1], at: [0, FLOOR + 4.9, front + 0.03], colour: shade(boards, 0.82) }, { size: [1.9, 0.16, 0.1], at: [0, FLOOR + 5.6, front + 0.06], colour: WHITE });
    kit.list.push({ size: [1.6, 1.5, 1.6], at: [0, eaves + rise + 0.5, 0], colour: WHITE });
    kit.extra.push(placed(hipRoof(2.2, 2.2, 1.1, top), 0, eaves + rise + 1.25, 0));
    const along = Math.max(2, Math.round(p.w / 6));
    row(kit, 0, front, p.w * 0.9, FLOOR + 1.6, along, 0.8, 0.8, WHITE, null, (a) => Math.abs(a) < 3.2);
    for (const f of [2, 3] as const) row(kit, f, p.w / 2, p.d * 0.85, FLOOR + 1.6, Math.max(2, Math.round(p.d / 6)), 0.8, 0.8);
    // A silo beside the biggest of them.
    if (p.w * p.d > 900) {
      const sx = p.w / 2 + 2.6;
      kit.list.push({ size: [3.2, 10 + FOOTING, 3.2], at: [sx, (10 - FOOTING) / 2, -p.d * 0.2], colour: 0xa8a8a4 }, { size: [3.2, 10 + FOOTING, 3.2], at: [sx, (10 - FOOTING) / 2, -p.d * 0.2], colour: 0x9a9a96, turn: Math.PI / 4 });
      kit.extra.push(placed(hipRoof(4.4, 4.4, 1.8, roofOf(look, 0x7c8088)), sx, 10, -p.d * 0.2));
    }
    return kit;
  },

  warehouse(p, look) {
    // A long metal shed with loading doors: what stands by a railway or behind a supermarket.
    const kit: Kit = { list: [], extra: [], panes: [] };
    const [, r1, r2] = p.rolls;
    const metal = pick([0x8a949c, 0x6f7f74, 0xb9ae98, 0x7a8590, 0x9a6a50], r1);
    const top = roofOf(look, pick([0x7c8088, 0x5c6672, 0x8a8f96], r2));
    const front = p.d / 2;
    const eaves = body(kit, p.w, p.d, 4.8, metal);
    gable(kit, p.w, p.d, eaves, Math.min(2.4, Math.min(p.w, p.d) * 0.12), top, metal, p.w < p.d, 0, 0, 0.4);
    // A darker band to the height of a truck bed, and a door every so often along the front.
    kit.list.push({ size: [p.w + 0.06, 1.2, p.d + 0.06], at: [0, FLOOR + 0.6, 0], colour: shade(metal, 0.72) });
    const bays = Math.max(1, Math.round(p.w / 11));
    for (let i = 0; i < bays; i++) {
      const x = -p.w / 2 + ((i + 0.5) * p.w) / bays;
      kit.list.push({ size: [3.2, 3.4, 0.1], at: [x, FLOOR + 1.7, front + 0.03], colour: shade(metal, 0.55) }, { size: [3.6, 0.5, 1.4], at: [x, FLOOR - 0.2, front + 0.7], colour: STONE });
      for (const y of [0.9, 1.7, 2.5]) kit.list.push({ size: [3.2, 0.05, 0.03], at: [x, FLOOR + y, front + 0.09], colour: shade(metal, 0.4) });
    }
    row(kit, 0, front, p.w * 0.92, FLOOR + 4, Math.max(2, Math.round(p.w / 5)), 1.2, 0.5, null, null, () => false);
    row(kit, 1, front, p.w * 0.92, FLOOR + 4, Math.max(2, Math.round(p.w / 5)), 1.2, 0.5, null);
    return kit;
  },

  falsefront(p, look) {
    // A plain gabled building behind a tall square front: what a shop on an old main street is.
    const kit: Kit = { list: [], extra: [], panes: [] };
    const [, r1, r2, r3] = p.rolls;
    const paint = pick(SHOP_PAINTS, r1);
    const trim = paint === WHITE ? pick([0x2f4a3f, 0x22304a, 0x7a2e26], r2) : WHITE;
    const top = roofOf(look, pick(ROOFS, r2));
    const front = p.d / 2;
    const tall = p.w >= 6.5;
    const eaves = body(kit, p.w, p.d, tall ? 5.7 : 3.9, paint);
    const rise = Math.min(3.4, p.w * 0.36);
    gable(kit, p.w, p.d - 0.3, eaves, rise, top, paint, true, 0, -0.15, 0.3);
    // The front itself, rising square above the roof behind it, with a cornice on brackets.
    const crown = eaves + rise * 0.85;
    kit.list.push(
      { size: [p.w + 0.3, crown - FLOOR, 0.4], at: [0, (crown + FLOOR) / 2, front + 0.02], colour: paint },
      { size: [p.w + 0.9, 0.3, 0.9], at: [0, crown + 0.1, front + 0.1], colour: trim },
      { size: [p.w + 0.5, 0.25, 0.6], at: [0, crown - 0.3, front + 0.1], colour: shade(trim, 0.85) },
    );
    if (r3 < 0.5) kit.list.push({ size: [p.w * 0.45, 0.7, 0.4], at: [0, crown + 0.55, front + 0.02], colour: paint }, { size: [p.w * 0.45 + 0.4, 0.2, 0.7], at: [0, crown + 0.95, front + 0.08], colour: trim });
    const face = front + 0.22;
    shopfront(kit, p.w, face, trim, pick(DOORS, r3));
    if (tall) row(kit, 0, face, p.w * 0.86, FLOOR + 3.1 + 1.75, Math.max(2, Math.floor(p.w / 2.8)), 0.85, 1.5, trim);
    if (r2 < 0.55) awning(kit, p.w * 0.88, face, pick(AWNINGS, r3));
    for (const f of [2, 3] as const) row(kit, f, p.w / 2, p.d * 0.7, FLOOR + (tall ? 4.6 : 1.7), Math.max(1, Math.round(p.d / 6)), 0.85, 1.3, null, null, () => false, -p.d * 0.1);
    chimney(kit, p.w * 0.3, -p.d * 0.3, eaves + rise * 0.4 + 1.4, BRICK, 0.7);
    if (look.season === 'winter') lights(kit, p.w * 0.86, face + 0.2, FLOOR + 2.72);
    const [board, ink] = pick(BOARDS, r1);
    kit.sign = { y: FLOOR + 3.1, out: face + 0.14, h: 0.66, w: p.w * 0.82, board, ink };
    return kit;
  },

  brickblock(p, look) {
    // A brick block of two or three storeys: flat roof, a heavy cornice, stone over every window, a shopfront between piers.
    const kit: Kit = { list: [], extra: [], panes: [] };
    const [, r1, r2, r3] = p.rolls;
    const brick = pick(BRICKS, r1);
    const stone = brick === 0xcdb99a ? 0x8a7a68 : 0xd9d3c5;
    const front = p.d / 2;
    const storeys = p.w >= 10.5 && r2 < 0.55 ? 3 : 2;
    const h = 3.7 + (storeys - 1) * 3;
    const eaves = body(kit, p.w, p.d, h, brick);
    kit.list.push(
      // The roof, behind a parapet; the cornice out over the street.
      { size: [p.w - 0.5, 0.2, p.d - 0.5], at: [0, eaves + 0.05, 0], colour: look.snow ?? 0x4a4f58 },
      { size: [p.w + 0.2, 0.5, p.d + 0.2], at: [0, eaves + 0.05, 0], colour: shade(brick, 0.82) },
      { size: [p.w + 1, 0.34, 0.8], at: [0, eaves + 0.25, front + 0.2], colour: stone },
      { size: [p.w + 0.6, 0.3, 0.5], at: [0, eaves - 0.1, front + 0.15], colour: shade(stone, 0.86) },
      // Piers at the corners of the shopfront, and a band over it.
      { size: [0.6, 3.45, 0.3], at: [-p.w / 2 + 0.3, FLOOR + 1.72, front + 0.08], colour: stone },
      { size: [0.6, 3.45, 0.3], at: [p.w / 2 - 0.3, FLOOR + 1.72, front + 0.08], colour: stone },
      { size: [p.w + 0.1, 0.24, 0.3], at: [0, FLOOR + 3.62, front + 0.08], colour: stone },
    );
    const trim = pick([0x22304a, 0x2f4a3f, 0x4a3326, 0x22262d, 0x7a2e26], r3);
    shopfront(kit, p.w - 1.1, front + 0.02, trim, pick(DOORS, r2));
    const n = Math.max(2, Math.floor(p.w / 2.6));
    for (let s = 1; s < storeys; s++) {
      const y = FLOOR + 3.7 + (s - 1) * 3 + 1.6;
      row(kit, 0, front, p.w * 0.86, y, n, 0.9, 1.7, null);
      // A stone lintel over each window and a sill under it.
      for (let i = 0; i < n; i++) {
        const x = (-p.w * 0.86) / 2 + ((i + 0.5) * p.w * 0.86) / n;
        kit.list.push({ size: [1.2, 0.24, 0.1], at: [x, y + 0.98, front + 0.03], colour: stone }, { size: [1.1, 0.12, 0.16], at: [x, y - 0.92, front + 0.05], colour: stone });
      }
      for (const f of [1, 2, 3] as const) row(kit, f, f === 1 ? front : p.w / 2, (f === 1 ? p.w : p.d) * 0.8, y, Math.max(2, Math.round((f === 1 ? p.w : p.d) / 4)), 0.9, 1.5, null);
    }
    if (r3 < 0.6) awning(kit, p.w - 1.4, front + 0.05, pick(AWNINGS, r2));
    chimney(kit, -p.w * 0.3, -p.d * 0.3, eaves + 1.5, shade(brick, 0.9), 0.9);
    if (look.season === 'winter') lights(kit, p.w - 1.4, front + 0.3, FLOOR + 2.72);
    const [board, ink] = pick(BOARDS, r2);
    kit.sign = { y: FLOOR + 3.1, out: front + 0.16, h: 0.66, w: (p.w - 1.1) * 0.82, board, ink };
    return kit;
  },

  porchshop(p, look) {
    // A store with a porch on both floors, as the old hotels and general stores of the Adirondacks have.
    const kit: Kit = { list: [], extra: [], panes: [] };
    const [, r1, r2, r3] = p.rolls;
    const paint = pick(SHOP_PAINTS, r1);
    const trim = paint === WHITE ? pick([0x2f4a3f, 0x22304a], r2) : WHITE;
    const top = roofOf(look, pick(ROOFS, r2));
    const front = p.d / 2;
    const eaves = body(kit, p.w, p.d, 5.8, paint);
    gable(kit, p.w, p.d, eaves, Math.min(3.4, p.d * 0.3), top, paint, false, 0, 0, 0.5);
    const depth = 2.5;
    const out = front + depth - 0.12;
    const upper = FLOOR + 2.95;
    kit.list.push(
      { size: [p.w, FLOOR, depth], at: [0, FLOOR / 2, front + depth / 2], colour: shade(TIMBER, 0.8) },
      { size: [p.w, 0.2, depth], at: [0, upper, front + depth / 2], colour: trim },
      { size: [p.w + 0.6, 0.16, depth + 0.6], at: [0, eaves - 0.1, front + depth / 2], colour: top, tip: 0.1 },
      // Rails round the upper porch.
      { size: [p.w, 0.08, 0.08], at: [0, upper + 0.95, out], colour: trim },
      { size: [p.w, 0.08, 0.08], at: [0, upper + 0.35, out], colour: trim },
    );
    const n = Math.max(2, Math.round(p.w / 2.8));
    for (let i = 0; i <= n; i++) {
      const x = -p.w / 2 + 0.12 + (i * (p.w - 0.24)) / n;
      kit.list.push({ size: [0.2, eaves - FLOOR - 0.2, 0.2], at: [x, (eaves + FLOOR) / 2 - 0.1, out], colour: trim });
    }
    shopfront(kit, p.w * 0.9, front, trim, pick(DOORS, r3), FLOOR + 2.55);
    row(kit, 0, front, p.w * 0.9, upper + 1.55, Math.max(2, Math.floor(p.w / 2.8)), 0.9, 1.5, trim);
    for (const f of [2, 3] as const) {
      row(kit, f, p.w / 2, p.d * 0.8, FLOOR + 1.6, Math.max(1, Math.round(p.d / 5)), 0.9, 1.3, null);
      row(kit, f, p.w / 2, p.d * 0.8, upper + 1.55, Math.max(1, Math.round(p.d / 5)), 0.9, 1.3, null);
    }
    row(kit, 1, front, p.w * 0.85, upper + 1.55, Math.max(2, Math.round(p.w / 4)), 0.9, 1.3, null);
    chimney(kit, p.w * 0.36, 0, eaves + Math.min(3.4, p.d * 0.3) + 0.7);
    if (look.season === 'winter') lights(kit, p.w * 0.96, out + 0.14, upper - 0.2);
    const [board, ink] = pick(BOARDS, r3);
    // The name is on the edge of the upper porch, where the street can read it.
    kit.sign = { y: upper + 0.62, out: out + 0.08, h: 0.6, w: Math.min(p.w * 0.7, 9), board, ink };
    return kit;
  },

  storefront(p, look) {
    // One storey behind a stepped front: a diner, a barber, a little shop.
    const kit: Kit = { list: [], extra: [], panes: [] };
    const [, r1, r2, r3] = p.rolls;
    const paint = pick([0xece5d3, 0x9fb8b0, 0xd9b9a0, 0xcfd8df, 0xe8d9ae], r1);
    const trim = pick([0x22304a, 0x7a2e26, 0x2f4a3f], r2);
    const front = p.d / 2;
    const eaves = body(kit, p.w, p.d, 3.7, paint);
    kit.list.push(
      { size: [p.w - 0.4, 0.2, p.d - 0.4], at: [0, eaves + 0.05, 0], colour: look.snow ?? 0x4a4f58 },
      { size: [p.w + 0.2, 1.1, 0.4], at: [0, eaves + 0.4, front], colour: paint },
      { size: [p.w * 0.5, 0.6, 0.4], at: [0, eaves + 1.2, front], colour: paint },
      { size: [p.w * 0.5 + 0.4, 0.16, 0.6], at: [0, eaves + 1.55, front + 0.05], colour: trim },
      { size: [p.w + 0.5, 0.16, 0.6], at: [0, eaves + 0.98, front + 0.05], colour: trim },
    );
    const face = front + 0.2;
    shopfront(kit, p.w, face, trim, pick(DOORS, r3), FLOOR + 2.95);
    awning(kit, p.w * 0.9, face, pick(AWNINGS, r3), FLOOR + 2.45);
    for (const f of [2, 3] as const) row(kit, f, p.w / 2, p.d * 0.7, FLOOR + 1.7, Math.max(1, Math.round(p.d / 6)), 0.9, 1.1, null);
    if (look.season === 'winter') lights(kit, p.w * 0.9, face + 1.45, FLOOR + 2.02);
    const [board, ink] = pick(BOARDS, r2);
    kit.sign = { y: eaves + 0.42, out: face + 0.03, h: 0.7, w: p.w * 0.8, board, ink };
    return kit;
  },

  lodgewing(p, look) {
    // One of the ski area's big timber buildings: stone to the sills, a deep roof, a gabled entry, skis by the door.
    const kit: Kit = { list: [], extra: [], panes: [] };
    const [, r1, , r3] = p.rolls;
    const top = roofOf(look, 0x3f5a4a);
    const front = p.d / 2;
    const longFront = p.w >= p.d;
    const h = 6.4;
    const eaves = body(kit, p.w, p.d, h, TIMBER, 0, 0, 0x7d8494);
    kit.list.push({ size: [p.w + 0.2, 1.3, p.d + 0.2], at: [0, FLOOR + 0.65, 0], colour: 0x7d8494 }, { size: [p.w + 0.3, 0.4, p.d + 0.3], at: [0, eaves - 0.2, 0], colour: TIMBER_DARK });
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) kit.list.push({ size: [0.5, h, 0.5], at: [(sx * p.w) / 2, FLOOR + h / 2, (sz * p.d) / 2], colour: TIMBER_DARK });
    const rise = Math.min(6, Math.min(p.w, p.d) * 0.34);
    gable(kit, p.w, p.d, eaves, rise, top, TIMBER_DARK, !longFront, 0, 0, 1.3);
    // The way in: a gable on timber posts, out over the door.
    const ex = (r3 - 0.5) * p.w * 0.3;
    kit.extra.push(placed(roof(4.4, 6.4, 2, top, TIMBER_DARK), ex, FLOOR + 3.3, front + 1.6, Math.PI / 2));
    for (const s of [-1, 1]) kit.list.push({ size: [0.4, 3.3, 0.4], at: [ex + s * 2.7, FLOOR + 1.65, front + 3], colour: TIMBER_DARK });
    kit.list.push({ size: [6.6, FLOOR, 3.6], at: [ex, FLOOR / 2, front + 1.8], colour: 0x7d8494 }, { size: [2.6, 2.5, 0.14], at: [ex, FLOOR + 1.25, front + 0.04], colour: 0x4a3326 });
    kit.panes.push({ x: ex - 0.65, y: FLOOR + 1.5, z: front + 0.12, w: 0.9, h: 1.5, face: 0 }, { x: ex + 0.65, y: FLOOR + 1.5, z: front + 0.12, w: 0.9, h: 1.5, face: 0 });
    const clear = (a: number): boolean => Math.abs(a - ex) < 3.6;
    for (let s = 0; s < 2; s++) {
      const y = FLOOR + 2.2 + s * 3;
      row(kit, 0, front, p.w * 0.92, y, Math.max(2, Math.floor(p.w / 3.4)), 1.4, 1.4, TIMBER_DARK, null, s === 0 ? clear : () => false);
      row(kit, 1, front, p.w * 0.92, y, Math.max(2, Math.floor(p.w / 3.4)), 1.4, 1.4, null);
      for (const f of [2, 3] as const) row(kit, f, p.w / 2, p.d * 0.86, y, Math.max(2, Math.floor(p.d / 4)), 1.4, 1.4, TIMBER_DARK);
    }
    kit.list.push({ size: [1.7, eaves + rise + 1.2, 1.7], at: [-p.w * 0.3, (eaves + rise + 1.2) / 2, -p.d * 0.12], colour: 0x7d8494 });
    if (look.season === 'winter' || look.season === 'spring') {
      skis(kit, ex + 6, front + 1, 6, Math.floor(r1 * 7));
      skis(kit, ex - 6, front + 1, 6, Math.floor(r3 * 7));
    }
    kit.sign = { y: FLOOR + 4.55, out: front + 3.24, h: 0.72, w: 6, board: '#2f5a44', ink: '#f1d58a' };
    return kit;
  },

  workshop(p, look) {
    // Where the snowcats and the mowers live: green iron, a row of tall doors, a fuel tank round the side.
    const kit: Kit = { list: [], extra: [], panes: [] };
    const [, r1, r2] = p.rolls;
    const metal = pick([0x4f6b5a, 0x5a6672, 0x6b5a48], r1);
    const top = roofOf(look, 0x7c8088);
    const front = p.d / 2;
    const eaves = body(kit, p.w, p.d, 4.6, metal, 0, 0, 0x7d8494);
    gable(kit, p.w, p.d, eaves, Math.min(2.6, Math.min(p.w, p.d) * 0.16), top, metal, p.w < p.d, 0, 0, 0.5);
    const bays = Math.max(1, Math.min(4, Math.floor((p.w - 2) / 4.2)));
    for (let i = 0; i < bays; i++) {
      const x = -p.w / 2 + 1 + ((i + 0.5) * (p.w - 3.4)) / bays;
      kit.list.push({ size: [3.4, 3.7, 0.1], at: [x, FLOOR + 1.85 - 0.4, front + 0.03], colour: 0xc9ced6 });
      for (const y of [0.6, 1.4, 2.2, 3]) kit.list.push({ size: [3.4, 0.05, 0.03], at: [x, FLOOR + y - 0.4, front + 0.09], colour: 0x8a8f96 });
      kit.panes.push({ x, y: FLOOR + 2.4, z: front + 0.1, w: 2.6, h: 0.5, face: 0 });
    }
    kit.list.push({ size: [1, 2.1, 0.1], at: [p.w / 2 - 1, FLOOR + 1.05, front + 0.03], colour: shade(metal, 0.6) });
    if (r2 < 0.6) kit.list.push({ size: [1.3, 1.3, 2.6], at: [-p.w / 2 - 1.2, 1.25, 0], colour: 0xd9d3c5 }, { size: [1, 0.6, 0.3], at: [-p.w / 2 - 1.2, 0.3, -0.9], colour: IRON }, { size: [1, 0.6, 0.3], at: [-p.w / 2 - 1.2, 0.3, 0.9], colour: IRON });
    for (const f of [2, 3] as const) row(kit, f, p.w / 2, p.d * 0.8, FLOOR + 3.2, Math.max(1, Math.round(p.d / 5)), 1.2, 0.6, null);
    return kit;
  },

  liftshack(p, look) {
    // A lift attendant's hut: timber, one big window toward the lift, a flat roof that holds the snow.
    const kit: Kit = { list: [], extra: [], panes: [] };
    const front = p.d / 2;
    kit.list.push(
      { size: [p.w, 2.6 + FOOTING, p.d], at: [0, (2.6 - FOOTING) / 2, 0], colour: TIMBER },
      { size: [p.w + 1, 0.22, p.d + 1.4], at: [0, 2.75, 0.2], colour: TIMBER_DARK },
      { size: [p.w + 0.9, 0.2, p.d + 1.3], at: [0, 2.95, 0.2], colour: look.snow ?? 0x5c6672 },
      { size: [0.9, 2, 0.1], at: [p.w / 2 - 0.8, 1, front + 0.03], colour: 0x4a3326 },
    );
    win(kit, 0, front, -p.w * 0.14, 1.6, Math.max(1, p.w * 0.5), 1, TIMBER_DARK);
    for (const f of [2, 3] as const) win(kit, f, p.w / 2, 0, 1.6, Math.max(0.9, p.d * 0.4), 1, TIMBER_DARK);
    return kit;
  },
};

/**
 * Window panes as triangles: two to a pane, facing out of whichever wall it is on.
 * @param out takes a point in the building's own frame to the world
 * @param into the flat list of positions they are added to
 */
export function paneCorners(panes: readonly Pane[], out: (x: number, y: number, z: number) => [number, number, number], into: number[]): void {
  for (const pane of panes) {
    const along: [number, number] = pane.face < 2 ? [1, 0] : [0, 1];
    const flip = pane.face === 0 || pane.face === 3 ? 1 : -1;
    const corner = (sa: number, sy: number): [number, number, number] => out(pane.x + along[0] * sa * flip * (pane.w / 2), pane.y + sy * (pane.h / 2), pane.z + along[1] * sa * flip * (pane.w / 2));
    into.push(...corner(-1, -1), ...corner(1, -1), ...corner(1, 1), ...corner(-1, -1), ...corner(1, 1), ...corner(-1, 1));
  }
}

/** How much of the map one mesh of houses covers, in metres: small enough that most of them are out of sight and skipped. */
const CHUNK = 1900;

const GLASS_DARK = 0x3d4a5e;
const GLASS_LIT = 0xffc56e;

/**
 * The houses, shops and sheds, standing: a mesh of walls and a mesh of windows for each part of
 * the map. Their signs are painted with every other sign in the game (`buildSigns`).
 */
export class Houses {
  readonly group = new THREE.Group();
  /** The boards over the shop doors, to be painted. */
  readonly signs: SignSpec[] = [];
  private readonly glass = new THREE.MeshBasicMaterial({ color: GLASS_DARK });
  private readonly dark = new THREE.Color(GLASS_DARK);
  private readonly lit = new THREE.Color(GLASS_LIT);

  /**
   * @param roofColour snow in winter; any other colour means each building keeps its own roof
   * @param textured whether walls and roofs wear their courses of boards and shingles
   */
  constructor(plans: readonly HousePlan[], castShadow: boolean, roofColour: number, season: Season, textured = true) {
    this.group.name = 'town';
    if (plans.length === 0) return;
    const look: Look = { snow: roofColour === SNOW ? SNOW : null, season };
    const walls = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true, map: textured ? siding() : null });
    const chunks = new Map<string, { list: Block[]; extra: THREE.BufferGeometry[]; panes: number[] }>();
    for (const p of plans) {
      const kit = KITS[p.kind](p, look);
      const key = `${Math.floor(p.x / CHUNK)},${Math.floor(p.z / CHUNK)}`;
      let chunk = chunks.get(key);
      if (!chunk) chunks.set(key, (chunk = { list: [], extra: [], panes: [] }));
      const cos = Math.cos(p.turn);
      const sin = Math.sin(p.turn);
      // From the building's own frame to the world's: turned about the upright axis, then set down.
      const out = (x: number, y: number, z: number): [number, number, number] => [p.x + x * cos + z * sin, p.y + y, p.z - x * sin + z * cos];
      for (const b of kit.list) chunk.list.push({ size: b.size, at: out(...b.at), colour: b.colour, turn: (b.turn ?? 0) + p.turn, ...(b.tip !== undefined ? { tip: b.tip } : {}) });
      for (const geo of kit.extra) chunk.extra.push(placed(geo, p.x, p.y, p.z, p.turn));
      paneCorners(kit.panes, out, chunk.panes);
      if (p.sign && kit.sign) {
        this.signs.push({ text: p.sign, x: p.x + sin * kit.sign.out, y: p.y + kit.sign.y, z: p.z + cos * kit.sign.out, turn: p.turn, height: kit.sign.h, maxWidth: kit.sign.w, board: kit.sign.board, ink: kit.sign.ink });
      }
    }
    for (const chunk of chunks.values()) {
      const body = new THREE.Mesh(blocks(chunk.list, chunk.extra), walls);
      body.castShadow = castShadow;
      body.receiveShadow = true;
      body.matrixAutoUpdate = false;
      this.group.add(body);
      if (chunk.panes.length === 0) continue;
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(chunk.panes, 3));
      geo.computeBoundingSphere();
      const panes = new THREE.Mesh(geo, this.glass);
      panes.matrixAutoUpdate = false;
      this.group.add(panes);
    }
  }

  /** How lit the windows are: 0 by day, 1 after dark. */
  setLamps(amount: number): void {
    this.glass.color.copy(this.dark).lerp(this.lit, Math.min(1, Math.max(0, amount)));
  }
}

export { planHeight };
