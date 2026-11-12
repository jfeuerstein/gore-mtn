import * as THREE from 'three/webgpu';
import { hipRoof, paneCorners, row, win, type Kit, type Pane } from './houses';
import { blocks, placed, roof, siding, type Block } from './shapes';
import type { SignSpec } from './signs';
import type { Flue } from './smoke';
import type { WallBox } from './walls';
import type { Place } from './trails';
import { lit } from '../look/material';

export { PLACE_FOOTPRINT, PLACE_HEIGHT } from './placeSizes';

const TIMBER = 0x8a5a3c;
const TIMBER_DARK = 0x6b4530;
const STONE = 0x7d8494;
/** Roofs: under snow in winter; the rest of the year each lodge keeps its own. Set when the buildings are made. */
let ROOF_SNOW = 0xf2f5fa;
let SNOWED = true;
const roofOf = (own: number): number => (SNOWED ? ROOF_SNOW : own);
const GREEN_ROOF = 0x3f5a4a;
const TRIM = 0xf4ead8;
const DOOR = 0x4a3326;
const STEEL = 0x4d5666;
const RED = 0xa8392b;
const PLANK = 0x7a5a42;

/** How far below the ground a model's own y = 0 is: every lodge is sunk a little so that it meets a slope. */
const SUNK = 0.8;
/** The top of the stone a lodge stands on: its floor. */
const BASE = 1.1;
/** How far down the stone goes, so that no slope leaves a gap under it. */
const FOOT = 6;

/** A board with words on it, in a model's own frame: facing its own +z unless turned. */
interface Board {
  text: string;
  x: number;
  y: number;
  z: number;
  height: number;
  maxWidth: number;
  board: string;
  ink: string;
  turn?: number;
}

/** A lodge, a hut or a tower, in its own frame: the middle of its footprint at the origin, its door side toward +z. */
interface Model extends Kit {
  boards?: Board[];
  /** The tops of its chimneys, for smoke. */
  flues?: [number, number, number][];
  /** Whatever else of it is solid, beyond its footprint: a terrace, a pair of yurts. In its own frame. */
  solid?: { x: number; z: number; w: number; d: number }[];
}

/** Stone under a building, and timber walls on it, with dark posts at the corners and a band under the eaves. Returns the height of the eaves. */
function timberBox(m: Model, w: number, d: number, h: number, x = 0, z = 0, wall = TIMBER, post = TIMBER_DARK): number {
  m.list.push(
    { size: [w + 0.6, BASE + FOOT, d + 0.6], at: [x, (BASE - FOOT) / 2, z], colour: STONE },
    { size: [w, h, d], at: [x, BASE + h / 2, z], colour: wall },
    { size: [w + 0.3, 0.4, d + 0.3], at: [x, BASE + h - 0.2, z], colour: post },
  );
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) m.list.push({ size: [0.5, h, 0.5], at: [x + (sx * w) / 2, BASE + h / 2, z + (sz * d) / 2], colour: post });
  return BASE + h;
}

/** A stone chimney up through a roof, with a cap, and smoke from it. */
function stack(m: Model, x: number, z: number, top: number, size = 1.7): void {
  m.list.push({ size: [size, top, size], at: [x, top / 2, z], colour: STONE }, { size: [size + 0.4, 0.3, size + 0.4], at: [x, top + 0.1, z], colour: 0x5a606c });
  (m.flues ??= []).push([x, top + 0.3, z]);
}

/** A gabled way in: a roof on heavy posts, out over a door and a step. */
function entry(m: Model, x: number, front: number, wide = 5.6, out = 3, top = GREEN_ROOF): void {
  m.extra.push(placed(roof(out + 0.8, wide + 0.8, 1.9, roofOf(top), TIMBER_DARK), x, BASE + 3.4, front + out / 2, Math.PI / 2));
  for (const s of [-1, 1]) m.list.push({ size: [0.42, 3.4, 0.42], at: [x + s * (wide / 2 - 0.3), BASE + 1.7, front + out - 0.3], colour: TIMBER_DARK });
  m.list.push(
    { size: [wide, 0.3, 0.3], at: [x, BASE + 3.25, front + out - 0.3], colour: TIMBER_DARK },
    { size: [wide + 0.6, BASE + FOOT, out + 0.4], at: [x, (BASE - FOOT) / 2, front + out / 2], colour: STONE },
    { size: [3, 2.7, 0.3], at: [x, BASE + 1.35, front + 0.1], colour: DOOR },
  );
  m.panes.push({ x: x - 0.75, y: BASE + 1.6, z: front + 0.27, w: 1, h: 1.5, face: 0 }, { x: x + 0.75, y: BASE + 1.6, z: front + 0.27, w: 1, h: 1.5, face: 0 });
}

/**
 * A terrace with a rail round it: `sides` says which edges are railed (n, s, e, w). At floor
 * level it is stone under planks; raised (`lift` above the floor) it is a deck on timber posts.
 * Tables and chairs on it are placed with the same `lift`.
 */
function terrace(m: Model, x: number, z: number, w: number, d: number, sides: string, lift = 0): void {
  if (lift === 0) m.list.push({ size: [w, BASE + FOOT, d], at: [x, (BASE - FOOT) / 2 - 0.06, z], colour: STONE });
  else {
    m.list.push({ size: [w, 0.3, d], at: [x, BASE + lift - 0.2, z], colour: TIMBER_DARK });
    const nx = Math.max(1, Math.round(w / 4.5));
    for (let i = 0; i <= nx; i++) for (const sz of [-1, 1]) m.list.push({ size: [0.4, lift + BASE + FOOT, 0.4], at: [x - w / 2 + 0.3 + (i * (w - 0.6)) / nx, (lift + BASE - FOOT) / 2 - 0.3, z + sz * (d / 2 - 0.3)], colour: TIMBER_DARK });
  }
  m.list.push({ size: [w, 0.12, d], at: [x, BASE + lift, z], colour: PLANK });
  const rail = (ax: number, az: number, bx: number, bz: number): void => {
    const len = Math.hypot(bx - ax, bz - az);
    const along = Math.abs(bx - ax) > Math.abs(bz - az);
    const n = Math.max(1, Math.round(len / 2.6));
    for (let i = 0; i <= n; i++) m.list.push({ size: [0.16, 1.05, 0.16], at: [ax + ((bx - ax) * i) / n, BASE + lift + 0.52, az + ((bz - az) * i) / n], colour: TIMBER_DARK });
    for (const y of [1.02, 0.55]) m.list.push({ size: along ? [len, 0.1, 0.1] : [0.1, 0.1, len], at: [(ax + bx) / 2, BASE + lift + y, (az + bz) / 2], colour: TIMBER_DARK });
  };
  const x0 = x - w / 2 + 0.1;
  const x1 = x + w / 2 - 0.1;
  const z0 = z - d / 2 + 0.1;
  const z1 = z + d / 2 - 0.1;
  if (sides.includes('n')) rail(x0, z0, x1, z0);
  if (sides.includes('s')) rail(x0, z1, x1, z1);
  if (sides.includes('w')) rail(x0, z0, x0, z1);
  if (sides.includes('e')) rail(x1, z0, x1, z1);
  (m.solid ??= []).push({ x, z, w, d });
}

/** A picnic table with a bench either side, on a deck. */
function table(m: Model, x: number, z: number, turn = 0, lift = 0): void {
  const c = Math.cos(turn);
  const s = Math.sin(turn);
  const at = (lx: number, y: number, lz: number): [number, number, number] => [x + lx * c + lz * s, BASE + lift + y, z - lx * s + lz * c];
  m.list.push(
    { size: [1.8, 0.07, 0.8], at: at(0, 0.8, 0), colour: 0x9a7448, turn },
    { size: [1.8, 0.06, 0.3], at: at(0, 0.5, 0.62), colour: 0x9a7448, turn },
    { size: [1.8, 0.06, 0.3], at: at(0, 0.5, -0.62), colour: 0x9a7448, turn },
    { size: [0.08, 0.75, 1.4], at: at(-0.7, 0.43, 0), colour: 0x5a3e28, turn },
    { size: [0.08, 0.75, 1.4], at: at(0.7, 0.43, 0), colour: 0x5a3e28, turn },
  );
}

/** A slatted chair with a high back and wide arms, as stands on every porch in these mountains. It faces its own +z. */
function chair(m: Model, x: number, y: number, z: number, turn: number, colour: number): void {
  const c = Math.cos(turn);
  const s = Math.sin(turn);
  const at = (lx: number, ly: number, lz: number): [number, number, number] => [x + lx * c + lz * s, y + ly, z - lx * s + lz * c];
  m.list.push(
    { size: [0.62, 0.07, 0.6], at: at(0, 0.34, 0.05), colour, turn, tip: -0.18 },
    { size: [0.62, 0.9, 0.07], at: at(0, 0.7, -0.3), colour, turn, tip: -0.32 },
    { size: [0.1, 0.06, 0.7], at: at(-0.36, 0.56, 0.02), colour, turn },
    { size: [0.1, 0.06, 0.7], at: at(0.36, 0.56, 0.02), colour, turn },
    { size: [0.08, 0.5, 0.08], at: at(-0.34, 0.27, 0.3), colour, turn },
    { size: [0.08, 0.5, 0.08], at: at(0.34, 0.27, 0.3), colour, turn },
  );
}

/** A flagpole and its flag, out in the wind toward +x. */
function flag(m: Model, x: number, z: number, kind: 'stars' | 'state' | 'mountain'): void {
  m.list.push({ size: [0.14, 9 + SUNK, 0.14], at: [x, (9 + SUNK) / 2, z], colour: 0xc9ced6 }, { size: [0.24, 0.24, 0.24], at: [x, 9 + SUNK + 0.1, z], colour: 0xd9a441 });
  const top = 9 + SUNK - 0.3;
  if (kind === 'stars') {
    for (let i = 0; i < 5; i++) m.list.push({ size: [2, 0.24, 0.05], at: [x + 1.05, top - 0.12 - i * 0.24, z], colour: i % 2 === 0 ? 0xb53a2a : TRIM });
    m.list.push({ size: [0.9, 0.72, 0.07], at: [x + 0.5, top - 0.36, z], colour: 0x2b4a7a });
  } else if (kind === 'state') {
    m.list.push({ size: [2, 1.2, 0.05], at: [x + 1.05, top - 0.6, z], colour: 0x2b4a7a }, { size: [0.5, 0.5, 0.07], at: [x + 1.05, top - 0.6, z], colour: 0xd9a441 });
  } else {
    // The mountain's own: green, with a white peak on it.
    m.list.push({ size: [2, 1.2, 0.05], at: [x + 1.05, top - 0.6, z], colour: 0x2f5a44 }, { size: [0.9, 0.3, 0.07], at: [x + 1.05, top - 0.8, z], colour: TRIM }, { size: [0.5, 0.3, 0.07], at: [x + 1.05, top - 0.5, z], colour: TRIM });
  }
}

/**
 * The Base Lodge: two timber wings either side of a great hall whose gable stands above them.
 * The door, the ticket windows and the flags are on the side the car parks are; the hall's wall
 * of glass and a long terrace of tables are on the side the lifts are.
 */
function baseLodge(): Model {
  const m: Model = { list: [], extra: [], panes: [] };
  const w = 44;
  const d = 16;
  const front = d / 2;
  // The door is a little west of the middle, where everything that stands by it expects it.
  const hx = -w * 0.12;
  const eaves = timberBox(m, w, d, 6.8);
  const rise = d * 0.4;
  m.extra.push(placed(roof(w + 2.4, d + 3, rise, roofOf(GREEN_ROOF), TIMBER_DARK), 0, eaves, 0));
  // The great hall, across the wings and out toward the mountain.
  const hw = 14;
  const hd = d + 5;
  const hz = -2.5;
  const hall = timberBox(m, hw, hd, 9.4, hx, hz);
  m.extra.push(placed(roof(hd + 2.6, hw + 2.6, hw * 0.44, roofOf(GREEN_ROOF), TIMBER_DARK), hx, hall, hz, Math.PI / 2));
  // The way in, with the name over it and a clock in the gable.
  entry(m, hx, front, 6.2, 3.2);
  m.boards = [{ text: 'GORE MOUNTAIN', x: hx, y: BASE + 6.1, z: front + 0.2, height: 1.15, maxWidth: 11, board: '#2f5a44', ink: '#f1d58a' }];
  m.list.push(
    { size: [2, 2, 0.12], at: [hx, BASE + 8.4, front + 0.05], colour: TIMBER_DARK },
    { size: [1.7, 1.7, 0.12], at: [hx, BASE + 8.4, front + 0.1], colour: TRIM },
    { size: [0.1, 0.62, 0.06], at: [hx, BASE + 8.68, front + 0.17], colour: 0x22262d },
    { size: [0.5, 0.1, 0.06], at: [hx + 0.22, BASE + 8.4, front + 0.17], colour: 0x22262d },
  );
  // The mountain side of the hall: glass from the floor to the gable.
  const back = -(hz - hd / 2);
  for (let r = 0; r < 3; r++) for (let c = 0; c < 4; c++) win(m, 1, back, hx - 4.35 + c * 2.9, BASE + 1.7 + r * 2.6, 2.4, 2.1, TIMBER_DARK);
  win(m, 1, back, hx, BASE + 9.6, 2.4, 1.6, TIMBER_DARK);
  // Windows down both wings, upstairs and down, and at the ends.
  const clear = (x: number): boolean => Math.abs(x - hx) < hw / 2 + 1.2;
  const tickets = (x: number): boolean => x > 7.2 && x < 19.2;
  for (let s = 0; s < 2; s++) {
    const y = BASE + 2 + s * 3.3;
    row(m, 0, front, w * 0.95, y, 12, 1.5, 1.5, TIMBER_DARK, null, (x) => clear(x) || (s === 0 && tickets(x)));
    row(m, 1, front, w * 0.95, y, 12, 1.5, 1.5, TIMBER_DARK, null, clear);
    for (const f of [2, 3] as const) row(m, f, w / 2, d * 0.7, y, 2, 1.5, 1.5, TIMBER_DARK);
  }
  // Dormers in the roofs of the wings.
  for (const x of [-17.5, 7.5, 12.5, 17.5]) {
    for (const side of [-1, 1]) {
      const z = side * d * 0.27;
      m.list.push({ size: [2.4, 1.9, 2.8], at: [x, eaves + rise * 0.34, z], colour: TIMBER });
      m.extra.push(placed(roof(3.2, 3, 0.9, roofOf(GREEN_ROOF), TIMBER_DARK), x, eaves + rise * 0.34 + 0.95, z, Math.PI / 2));
      m.panes.push({ x, y: eaves + rise * 0.34 + 0.1, z: z + side * 1.42, w: 1.4, h: 1.1, face: side > 0 ? 0 : 1 });
    }
  }
  stack(m, 15.5, -1.5, eaves + rise + 1.6);
  stack(m, -18.5, 1.5, eaves + rise + 1.2, 1.5);
  // Ticket windows under an awning, east of the door.
  m.list.push(
    { size: [12, 3.1, 1.1], at: [13.2, BASE + 1.55, front + 0.55], colour: TIMBER_DARK },
    { size: [12.6, 0.14, 2.2], at: [13.2, BASE + 3.2, front + 1.1], colour: roofOf(GREEN_ROOF), tip: 0.2 },
    { size: [12, 0.2, 0.5], at: [13.2, BASE + 1.05, front + 1.25], colour: PLANK },
  );
  for (let i = 0; i < 4; i++) win(m, 0, front + 1.1, 8.9 + i * 2.85, BASE + 1.85, 1.5, 1.2, TRIM);
  m.boards.push({ text: 'TICKETS', x: 13.2, y: BASE + 4.05, z: front + 0.2, height: 0.7, maxWidth: 5, board: '#f5f2ea', ink: '#22304a' });
  // The sun deck, along the mountain side at the level of the upper floor: on posts, railed on
  // the open edges, with tables, and a stair down to the snow at its west end.
  const tz = -front - 4.6;
  const up = 3.3;
  terrace(m, hx - 2, tz - 2.2, 34, 9.2, 'nwe', up);
  for (const [x, z, turn] of [[-21, tz - 0.5, 0.1], [-16.5, tz - 4, -0.2], [-12, tz - 4.6, 0.3], [4.5, tz - 4.4, -0.15], [8.5, tz - 1, 0.25], [8.2, tz - 4.6, 0]] as const) table(m, x, z, turn, up);
  for (let i = 0; i < 11; i++) m.list.push({ size: [0.55, 0.16, 2.2], at: [hx - 19.3 - i * 0.55, BASE + up - 0.1 - i * 0.4, tz - 2.2], colour: PLANK });
  // Flags by the door: the country's, the state's, and the mountain's own.
  flag(m, hx - 7, front + 8.5, 'stars');
  flag(m, hx - 9.6, front + 8.5, 'state');
  flag(m, hx - 12.2, front + 8.5, 'mountain');
  return m;
}

/**
 * The Saddle Lodge, halfway up: one long low room, all windows, with a chimney big enough to
 * stand in and a terrace of chairs at the end that looks out over the valley.
 */
function saddleLodge(): Model {
  const m: Model = { list: [], extra: [], panes: [] };
  const w = 22;
  const d = 11;
  const front = d / 2;
  const hx = -w * 0.12;
  const eaves = timberBox(m, w, d, 4.2);
  // Stone to the sills, as a building has that spends the winter in the wind.
  m.list.push({ size: [w + 0.2, 1.2, d + 0.2], at: [0, BASE + 0.6, 0], colour: STONE });
  const rise = d * 0.36;
  m.extra.push(placed(roof(w + 3, d + 3.6, rise, roofOf(0x5c6672), TIMBER_DARK), 0, eaves, 0));
  entry(m, hx, front, 4.6, 2.6, 0x5c6672);
  m.boards = [{ text: 'SADDLE LODGE', x: hx + 7.4, y: BASE + 3.3, z: front + 0.2, height: 0.75, maxWidth: 6.4, board: '#2f5a44', ink: '#f1d58a' }];
  const clear = (x: number): boolean => Math.abs(x - hx) < 3;
  row(m, 0, front, w * 0.94, BASE + 2.35, 7, 2.2, 1.7, TIMBER_DARK, null, (x) => clear(x) || Math.abs(x - hx - 7.4) < 3.4);
  row(m, 1, front, w * 0.94, BASE + 2.35, 7, 2.2, 1.7, TIMBER_DARK);
  for (const f of [2, 3] as const) row(m, f, w / 2, d * 0.8, BASE + 2.35, 3, 2.2, 1.7, TIMBER_DARK);
  stack(m, -w * 0.36, -1, eaves + rise + 1.4, 2.2);
  // The terrace, at the east end, where the morning comes up.
  terrace(m, w / 2 + 3.6, 0, 6.6, d + 2, 'nse');
  for (const [z, turn, colour] of [[-3.6, -1.75, 0x2f5a44], [-1.2, -1.57, 0xa8392b], [1.2, -1.5, 0xd9a441], [3.6, -1.35, 0x2f5a44]] as const) chair(m, w / 2 + 4.6, BASE + 0.06, z, turn + Math.PI, colour);
  table(m, w / 2 + 2, 3.4, 1.4);
  return m;
}

/**
 * The lodge at the Ski Bowl, where it began in 1934: a town park's building, not a resort's.
 * Dark green boards with cream trim, a porch along the front, and two yurts beside it.
 */
function skiBowlLodge(): Model {
  const m: Model = { list: [], extra: [], panes: [] };
  const w = 24;
  const d = 11;
  const front = d / 2;
  const hx = -w * 0.12;
  const green = 0x3f5a4a;
  const eaves = timberBox(m, w, d, 4.6, 0, 0, green, TRIM);
  const rise = d * 0.44;
  m.extra.push(placed(roof(w + 2, d + 2.4, rise, roofOf(0x6b5a4a), green), 0, eaves, 0));
  // A long dormer over the door, with a row of little windows.
  m.list.push({ size: [9, 1.7, 3.4], at: [hx, eaves + rise * 0.36, d * 0.2], colour: green }, { size: [9.6, 0.16, 4], at: [hx, eaves + rise * 0.36 + 0.95, d * 0.2 + 0.2], colour: roofOf(0x6b5a4a), tip: 0.2 });
  for (let i = 0; i < 4; i++) win(m, 0, d * 0.2 + 1.7, hx - 3 + i * 2, eaves + rise * 0.36 + 0.05, 1.2, 0.9, TRIM);
  // The porch, the width of the front, on cream posts.
  const out = 2.8;
  m.list.push(
    { size: [w, BASE + FOOT, out], at: [0, (BASE - FOOT) / 2 - 0.05, front + out / 2], colour: STONE },
    { size: [w, 0.1, out], at: [0, BASE - 0.02, front + out / 2], colour: PLANK },
    { size: [w + 0.6, 0.18, out + 0.7], at: [0, BASE + 3.1, front + out / 2 + 0.1], colour: roofOf(0x6b5a4a), tip: 0.12 },
    { size: [w, 0.25, 0.2], at: [0, BASE + 2.85, front + out - 0.15], colour: TRIM },
    { size: [1.6, 2.4, 0.2], at: [hx, BASE + 1.2, front + 0.1], colour: RED },
  );
  for (let i = 0; i <= 8; i++) m.list.push({ size: [0.24, 2.9, 0.24], at: [-w / 2 + 0.15 + (i * (w - 0.3)) / 8, BASE + 1.45, front + out - 0.15], colour: TRIM });
  m.boards = [
    { text: 'SKI BOWL', x: hx, y: BASE + 3.75, z: front + out + 0.3, height: 0.9, maxWidth: 7, board: '#f5f2ea', ink: '#2f5a44' },
    { text: 'RIDE UP · SLIDE DOWN · SINCE 1934', x: hx + 8.2, y: BASE + 2.1, z: front + 0.2, height: 0.5, maxWidth: 6.6, board: '#f5f2ea', ink: '#8f3326' },
  ];
  row(m, 0, front, w * 0.92, BASE + 1.9, 8, 1.4, 1.5, TRIM, null, (x) => Math.abs(x - hx) < 1.6 || Math.abs(x - hx - 8.2) < 3.5);
  row(m, 1, front, w * 0.92, BASE + 1.9, 8, 1.4, 1.5, TRIM);
  for (const f of [2, 3] as const) {
    row(m, f, w / 2, d * 0.7, BASE + 1.9, 2, 1.4, 1.5, TRIM);
    win(m, f, w / 2, 0, eaves + rise * 0.3, 1.2, 1.2, TRIM);
  }
  stack(m, w * 0.36, -1.5, eaves + rise + 0.9, 1.3);
  // Two yurts east of the lodge: round canvas on a deck, a stovepipe out of the top.
  for (const [x, z] of [[w / 2 + 7, -1.5], [w / 2 + 14.5, 2]] as const) {
    m.list.push(
      { size: [6.6, 0.5 + FOOT, 6.6], at: [x, SUNK + 0.25 - FOOT / 2, z], colour: PLANK },
      { size: [5.4, 2.3, 5.4], at: [x, SUNK + 1.65, z], colour: 0xe8e0c8 },
      { size: [5.4, 2.3, 5.4], at: [x, SUNK + 1.65, z], colour: 0xdfd6bc, turn: Math.PI / 4 },
      { size: [1, 1.9, 0.14], at: [x, SUNK + 1.45, z + 2.72], colour: RED },
      { size: [0.2, 1.4, 0.2], at: [x + 0.9, SUNK + 4.6, z], colour: STEEL },
    );
    m.extra.push(placed(hipRoof(6.4, 6.4, 1.9, roofOf(0xc9c0a6)), x, SUNK + 2.8, z), placed(hipRoof(6.4, 6.4, 1.9, roofOf(0xc2b99e)), x, SUNK + 2.8, z, Math.PI / 4));
    m.panes.push({ x: x + 1.7, y: SUNK + 1.9, z: z + 2.72, w: 0.9, h: 0.7, face: 0 });
    (m.flues ??= []).push([x + 0.9, SUNK + 5.4, z]);
    (m.solid ??= []).push({ x, z, w: 6, d: 6 });
  }
  return m;
}

/**
 * The lodge on Peaceful Valley Road: rooms in a row on two floors behind a long balcony, an
 * outside stair, and an office under its own gable at the end.
 */
function roadLodge(): Model {
  const m: Model = { list: [], extra: [], panes: [] };
  const w = 30;
  const d = 13;
  const front = d / 2;
  const hx = -w * 0.12;
  const honey = 0xa9744a;
  const eaves = timberBox(m, w, d - 2.4, 6, 0, -1.2, honey);
  const wall = front - 2.4;
  m.extra.push(placed(roof(w + 1.6, d + 1.4, d * 0.3, roofOf(0x5c6672), TIMBER_DARK), 0, eaves, 0));
  // Two galleries along the front, one above the other, with rails.
  for (const y of [BASE, BASE + 3]) {
    m.list.push({ size: [w, 0.18, 2.4], at: [0, y - 0.03, front - 1.2], colour: PLANK });
    for (const ry of [1, 0.5]) m.list.push({ size: [w, 0.08, 0.08], at: [0, y + ry, front - 0.1], colour: TRIM });
  }
  m.list.push({ size: [w, BASE + FOOT, 2.4], at: [0, (BASE - FOOT) / 2 - 0.1, front - 1.2], colour: STONE });
  for (let i = 0; i <= 10; i++) m.list.push({ size: [0.2, 6, 0.2], at: [-w / 2 + 0.12 + (i * (w - 0.24)) / 10, BASE + 3, front - 0.1], colour: TIMBER_DARK });
  // A door and a window for every room, upstairs and down.
  for (let s = 0; s < 2; s++) {
    for (let i = 0; i < 6; i++) {
      const x = -w / 2 + 2.6 + i * 4.3;
      if (s === 0 && Math.abs(x - hx) < 1.2) continue;
      m.list.push({ size: [1, 2.1, 0.12], at: [x, BASE + s * 3 + 1.05, wall + 0.05], colour: 0x2f5a44 });
      win(m, 0, wall, x + 1.75, BASE + s * 3 + 1.5, 1.4, 1.2, TRIM);
    }
  }
  m.list.push({ size: [1.6, 2.4, 0.2], at: [hx, BASE + 1.2, wall + 0.1], colour: DOOR });
  // The stair at the west end, and the office at the east under a gable of its own.
  for (let i = 0; i < 8; i++) m.list.push({ size: [1.3, 0.16, 0.5], at: [-w / 2 - 0.8, BASE + 0.2 + i * 0.37, front - 0.3 - i * 0.48], colour: PLANK });
  m.extra.push(placed(roof(5, 6.4, 2.2, roofOf(0x5c6672), honey), w / 2 - 3.2, BASE + 3.1, front + 0.6, Math.PI / 2));
  for (const s of [-1, 1]) m.list.push({ size: [0.36, 3.1, 0.36], at: [w / 2 - 3.2 + s * 2.6, BASE + 1.55, front + 2.4], colour: TIMBER_DARK });
  m.boards = [
    { text: 'GORE MOUNTAIN LODGE', x: 0, y: BASE + 6.55, z: front + 0.05, height: 0.8, maxWidth: 12, board: '#2f5a44', ink: '#f1d58a' },
    { text: 'OFFICE · VACANCY', x: w / 2 - 3.2, y: BASE + 3.3, z: front + 2.65, height: 0.55, maxWidth: 4.6, board: '#f5f2ea', ink: '#8f3326' },
  ];
  row(m, 1, front - 2.4, w * 0.92, BASE + 1.6, 7, 1.2, 1.2, null);
  row(m, 1, front - 2.4, w * 0.92, BASE + 4.6, 7, 1.2, 1.2, null);
  stack(m, w * 0.4, -3, eaves + d * 0.3 + 0.6, 1.3);
  return m;
}

/** A warming hut: logs, a roof that comes out over the door, a stovepipe, a bench, and the wood stacked along the wall. */
function hut(): Model {
  const m: Model = { list: [], extra: [], panes: [] };
  const w = 7;
  const d = 5.5;
  const front = d / 2;
  const log = 0x7a5232;
  m.list.push({ size: [w + 0.4, BASE + FOOT, d + 0.4], at: [0, (BASE - FOOT) / 2, 0], colour: STONE }, { size: [w, 2.9, d], at: [0, BASE + 1.45, 0], colour: log });
  // The ends of the logs, standing proud at the corners.
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) m.list.push({ size: [0.45, 2.9, 0.45], at: [sx * (w / 2 + 0.05), BASE + 1.45, sz * (d / 2 + 0.05)], colour: 0x5f4230 });
  const rise = 2.3;
  m.extra.push(placed(roof(w + 1.6, d + 4.6, rise, roofOf(GREEN_ROOF), log), 0, BASE + 2.9, 1.2));
  for (const sx of [-1, 1]) m.list.push({ size: [0.3, 2.3, 0.3], at: [sx * (w / 2 - 0.2), BASE + 1.15, front + 2.6], colour: 0x5f4230 });
  m.list.push(
    { size: [w, BASE + FOOT, 2.8], at: [0, (BASE - FOOT) / 2 - 0.08, front + 1.4], colour: PLANK },
    { size: [1.1, 2.1, 0.16], at: [-w * 0.12, BASE + 1.05, front + 0.06], colour: RED },
    // A bench by the door, and the woodpile.
    { size: [1.8, 0.1, 0.45], at: [1.7, BASE + 0.5, front + 0.5], colour: PLANK },
    { size: [0.1, 0.5, 0.4], at: [0.95, BASE + 0.25, front + 0.5], colour: 0x5f4230 },
    { size: [0.1, 0.5, 0.4], at: [2.45, BASE + 0.25, front + 0.5], colour: 0x5f4230 },
    { size: [0.7, 1.1, d * 0.8], at: [-w / 2 - 0.6, SUNK + 0.55, 0], colour: 0xb89a6a },
    { size: [0.24, 2.4, 0.24], at: [w * 0.28, BASE + 2.9 + 1.6, -0.6], colour: STEEL },
    { size: [0.4, 0.14, 0.4], at: [w * 0.28, BASE + 2.9 + 2.85, -0.6], colour: STEEL },
  );
  m.flues = [[w * 0.28, BASE + 2.9 + 3, -0.6]];
  win(m, 0, front, 1.7, BASE + 1.7, 1.2, 1, 0x5f4230);
  win(m, 1, front, 0, BASE + 1.6, 1.2, 1, 0x5f4230);
  for (const f of [2, 3] as const) win(m, f, w / 2, 0, BASE + 1.6, 1.2, 1, 0x5f4230);
  m.boards = [{ text: 'WARMING HUT', x: 0, y: BASE + 2.6, z: front + 2.75, height: 0.5, maxWidth: 3.6, board: '#2f5a44', ink: '#f1d58a' }];
  return m;
}

/** North Creek's depot: a long, low station with a wide platform roof and a sign. */
function depot(): Model {
  const m: Model = { list: [], extra: [], panes: [] };
  const w = 26;
  const d = 8;
  const eaves = timberBox(m, w, d, 3.6, 0, 0, 0xc9b48a, 0x7a2e26);
  // A hipped roof with eaves wide enough to wait under, as the D&H built its stations.
  m.extra.push(placed(hipRoof(w + 5, d + 7.4, 3.2, roofOf(0x5c6672)), 0, eaves, 0));
  // Brackets under the eaves, and a bay where the agent watched the line.
  for (let i = 0; i <= 8; i++) for (const s of [-1, 1]) m.list.push({ size: [0.2, 1.2, 1.8], at: [-w / 2 + (i * w) / 8, eaves - 0.7, s * (d / 2 + 0.9)], colour: 0x7a2e26, tip: s * -0.6 });
  m.list.push({ size: [3.4, 3.2, 1.2], at: [0, BASE + 1.6, d / 2 + 0.6], colour: 0xc9b48a }, { size: [28, 0.5 + FOOT, 3], at: [0, 0.25 - FOOT / 2 + SUNK - 0.3, 5.55], colour: STONE });
  win(m, 0, d / 2 + 1.2, 0, BASE + 1.9, 2.4, 1.5, 0x7a2e26);
  row(m, 0, d / 2, w * 0.9, BASE + 1.9, 8, 1.2, 1.6, 0x7a2e26, null, (x) => Math.abs(x) < 2.6);
  row(m, 1, d / 2, w * 0.9, BASE + 1.9, 8, 1.2, 1.6, 0x7a2e26, null, (x) => Math.abs(x + w * 0.12) < 1.6);
  m.list.push({ size: [1.6, 2.5, 0.2], at: [-w * 0.12, BASE + 1.25, -d / 2 - 0.08], colour: 0x7a2e26 }, { size: [2.2, 2.6, 0.2], at: [7, BASE + 1.3, d / 2 + 0.08], colour: 0x7a2e26 }, { size: [2.2, 2.6, 0.2], at: [-7, BASE + 1.3, d / 2 + 0.08], colour: 0x7a2e26 });
  for (const f of [2, 3] as const) win(m, f, w / 2, 0, BASE + 1.9, 1.2, 1.6, 0x7a2e26);
  stack(m, 6, 0, eaves + 3.6, 1);
  // A station is its platform. Dark boards to the sill all round; two benches; a baggage cart
  // with a trunk, a case and a milk can on it; a lamp by each door; and by the bay the mast with
  // its two blades that told a driver whether there were orders to stop for.
  const OXBLOOD = 0x7a2e26;
  m.list.push({ size: [w + 0.08, 1.05, d + 0.08], at: [0, BASE + 0.52, 0], colour: OXBLOOD });
  const deck = SUNK + 0.2;
  for (const x of [-11, 11]) {
    m.list.push(
      { size: [1.8, 0.08, 0.46], at: [x, deck + 0.46, d / 2 + 0.75], colour: TIMBER_DARK },
      { size: [1.8, 0.42, 0.07], at: [x, deck + 0.8, d / 2 + 0.5], colour: TIMBER_DARK },
      { size: [0.08, 0.46, 0.44], at: [x - 0.8, deck + 0.23, d / 2 + 0.75], colour: STEEL },
      { size: [0.08, 0.46, 0.44], at: [x + 0.8, deck + 0.23, d / 2 + 0.75], colour: STEEL },
    );
  }
  const cart = 4.2;
  m.list.push(
    { size: [2.3, 0.12, 1.15], at: [cart, deck + 0.62, d / 2 + 2.2], colour: 0x2f6b4f },
    { size: [0.1, 0.78, 0.78], at: [cart - 0.5, deck + 0.39, d / 2 + 1.6], colour: OXBLOOD },
    { size: [0.1, 0.78, 0.78], at: [cart - 0.5, deck + 0.39, d / 2 + 2.8], colour: OXBLOOD },
    { size: [0.1, 0.5, 0.1], at: [cart + 1.0, deck + 0.3, d / 2 + 2.2], colour: STEEL },
    { size: [0.9, 0.08, 0.08], at: [cart + 1.55, deck + 0.75, d / 2 + 2.2], colour: STEEL },
    { size: [1.0, 0.55, 0.62], at: [cart - 0.4, deck + 0.96, d / 2 + 2.15], colour: 0x7a5236 },
    { size: [0.62, 0.34, 0.44], at: [cart - 0.35, deck + 1.4, d / 2 + 2.2], colour: 0xc9a36b },
    { size: [0.34, 0.62, 0.34], at: [cart + 0.6, deck + 0.99, d / 2 + 2.2], colour: 0xc9ced6 },
    { size: [0.2, 0.16, 0.2], at: [cart + 0.6, deck + 1.38, d / 2 + 2.2], colour: 0xc9ced6 },
  );
  const mast = -3.3;
  m.list.push(
    { size: [0.2, 6.4, 0.2], at: [mast, deck + 3.2, d / 2 + 2.85], colour: 0xfbf8ee },
    { size: [1.5, 0.3, 0.08], at: [mast + 0.75, deck + 5.9, d / 2 + 2.85], colour: 0xc8402d },
    { size: [1.5, 0.3, 0.08], at: [mast - 0.75, deck + 5.3, d / 2 + 2.85], colour: 0xc8402d },
    { size: [0.34, 0.3, 0.1], at: [mast + 1.35, deck + 5.9, d / 2 + 2.85], colour: 0xfbf8ee },
    { size: [0.34, 0.3, 0.1], at: [mast - 1.35, deck + 5.3, d / 2 + 2.85], colour: 0xfbf8ee },
  );
  for (const x of [-7, 7, 0]) m.panes.push({ x: x + (x === 0 ? 2.2 : 1.5), y: BASE + 2.9, z: d / 2 + (x === 0 ? 1.3 : 0.2), w: 0.3, h: 0.4, face: 0 });
  return m;
}

/** The summit fire tower: four splayed legs, cross braces, and a cab with a roof on top. */
function fireTower(): Model {
  const height = 18;
  const list: Block[] = [];
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      list.push({ size: [0.3, height, 0.3], at: [sx * 1.9, height / 2, sz * 1.9], colour: STEEL });
    }
  }
  for (let y = 3; y < height; y += 3.6) {
    for (const s of [-1, 1]) {
      list.push({ size: [4.1, 0.16, 0.16], at: [0, y, s * 1.9], colour: STEEL }, { size: [0.16, 0.16, 4.1], at: [s * 1.9, y, 0], colour: STEEL });
    }
  }
  list.push(
    { size: [5, 0.3, 5], at: [0, height, 0], colour: TIMBER_DARK },
    { size: [4.2, 2.4, 4.2], at: [0, height + 1.35, 0], colour: RED },
    { size: [5.2, 0.3, 5.2], at: [0, height + 2.7, 0], colour: TIMBER_DARK },
  );
  const cap = placed(roof(5.2, 5.2, 1.6, ROOF_SNOW, RED), 0, height + 2.85, 0);
  const panes: Pane[] = [];
  for (const f of [0, 1, 2, 3] as const) panes.push({ x: f === 2 ? 2.12 : f === 3 ? -2.12 : 0, y: height + 1.6, z: f === 0 ? 2.12 : f === 1 ? -2.12 : 0, w: 3.2, h: 1.1, face: f });
  return { list, extra: [cap], panes };
}

const MODELS: Record<string, () => Model> = {
  'base-lodge': baseLodge,
  'saddle-lodge': saddleLodge,
  'gore-mountain-lodge': roadLodge,
  'ski-bowl-lodge': skiBowlLodge,
  'warming-hut': hut,
  'warming-hut-2': hut,
  depot,
  summit: fireTower,
};

/** Dark glass by day; lamplight after dark. */
const GLASS_DARK = new THREE.Color(0x3d4a5e);
const GLASS_LIT = new THREE.Color(0xffc56e);

/** The lodges, huts, depot and fire tower, each standing at its real place. */
export class Buildings {
  readonly group = new THREE.Group();
  /** The boards on them, to be painted with every other sign. */
  readonly signs: SignSpec[] = [];
  /** The tops of their chimneys, for smoke. */
  readonly flues: Flue[] = [];
  /** What is solid about them beyond their footprints: terraces, yurts. */
  readonly solid: WallBox[] = [];
  private readonly glass = new THREE.MeshBasicMaterial({ color: GLASS_DARK.getHex() });

  /**
   * @param roof the colour of the roofs: snow in winter; any other colour means each keeps its own
   * @param settings where a building stands and how it is turned, when that is not simply at its place, square to the compass
   */
  constructor(places: readonly Place[], castShadow: boolean, roof = 0xf2f5fa, settings: Record<string, { x: number; y: number; z: number; turn: number }> = {}, textured = true) {
    this.group.name = 'buildings';
    ROOF_SNOW = roof;
    SNOWED = roof === 0xf2f5fa;
    // Every lodge, hut and tower is set down where it stands and joined to the rest: two draw
    // calls for all of them, walls and windows, wherever the player is.
    const list: Block[] = [];
    const extra: THREE.BufferGeometry[] = [];
    const glass: number[] = [];
    for (const place of places) {
      const make = MODELS[place.id];
      if (!make) continue;
      const model = make();
      const set = settings[place.id];
      const x = set?.x ?? place.x;
      // Sunk a little, so the footing meets the snow on sloping ground.
      const y = (set?.y ?? place.y) - SUNK;
      const z = set?.z ?? place.z;
      const turn = set?.turn ?? 0;
      const cos = Math.cos(turn);
      const sin = Math.sin(turn);
      const out = (lx: number, ly: number, lz: number): [number, number, number] => [x + lx * cos + lz * sin, y + ly, z - lx * sin + lz * cos];
      for (const b of model.list) list.push({ size: b.size, at: out(...b.at), colour: b.colour, turn: (b.turn ?? 0) + turn, ...(b.tip !== undefined ? { tip: b.tip } : {}) });
      for (const geo of model.extra) extra.push(placed(geo, x, y, z, turn));
      paneCorners(model.panes, out, glass);
      for (const b of model.boards ?? []) {
        const [bx, by, bz] = out(b.x, b.y, b.z);
        this.signs.push({ text: b.text, x: bx, y: by, z: bz, turn: turn + (b.turn ?? 0), height: b.height, maxWidth: b.maxWidth, board: b.board, ink: b.ink });
      }
      for (const [fx, fy, fz] of model.flues ?? []) {
        const [wx, wy, wz] = out(fx, fy, fz);
        this.flues.push({ x: wx, y: wy, z: wz, size: 1.3 });
      }
      for (const box of model.solid ?? []) {
        const [wx, , wz] = out(box.x, 0, box.z);
        this.solid.push({ x: wx, z: wz, w: box.w, d: box.d, turn });
      }
    }
    if (list.length === 0) return;
    const body = new THREE.Mesh(blocks(list, extra), lit({ vertexColors: true, flatShading: true, map: textured ? siding() : null }));
    body.castShadow = castShadow;
    body.receiveShadow = true;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(glass, 3));
    geo.computeBoundingSphere();
    const panes = new THREE.Mesh(geo, this.glass);
    for (const mesh of [body, panes]) {
      mesh.matrixAutoUpdate = false;
      this.group.add(mesh);
    }
  }

  /** How lit the windows are: 0 by day, 1 after dark. */
  setLamps(amount: number): void {
    this.glass.color.copy(GLASS_DARK).lerp(GLASS_LIT, Math.min(1, Math.max(0, amount)));
  }
}
