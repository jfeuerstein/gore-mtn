import * as THREE from 'three/webgpu';
import type { Season } from '../look/season';
import { blocks, placed, roof, siding, type Block } from './shapes';
import { hanging, type Kit as HouseKit } from './houses';
import { hasShopPicture, type Hanging } from './shopSigns';
import type { SignSpec } from './signs';
import type { Flue } from './smoke';
import type { TownPlace, TownStyle } from './townPlaces';
import { lit } from '../look/material';

/**
 * The buildings that have a look of their own, each put together from a small kit: walls, a roof,
 * rows of windows, and whatever makes it itself (a porch, a steeple, an awning, a smokestack).
 * Every one is built facing its own +z, where its door and sign are, then turned and set down on
 * its plot. All of them together are joined into one mesh for walls and one for windows.
 */
const CREAM = 0xece4d0;
const BRICK = 0x9f5340;
const WHITE = 0xf5f2ea;
const TIMBER = 0x7a5232;
const DARK = 0x4a3a2e;
const STONE = 0x8a8f9c;
const RUST = 0x8f4b35;
const DOOR = 0x4a3326;

/** How far the stonework under a building goes down, so that it stands on a sloping plot without a gap. */
const FOOTING = 7;

/** Snow lies on every roof in winter; otherwise each building keeps its own. */
const SNOW = 0xf2f5fa;
const roofOf = (season: number, own: number): number => (season === SNOW ? SNOW : own);

interface Kit {
  list: Block[];
  extra: THREE.BufferGeometry[];
  panes: Block[];
  /** Height at which the sign hangs, and how tall it stands, in metres. */
  signY: number;
  signH: number;
  /** The tops of its chimneys, in its own frame, for smoke to rise from. */
  flues?: [number, number, number][];
}

/** A four-sided point: a spire, or the cap of a cupola. Its base sits at y = 0. */
function pyramid(size: number, height: number, colour: number): THREE.BufferGeometry {
  const h = size / 2;
  const corners = [
    [-h, 0, -h],
    [h, 0, -h],
    [h, 0, h],
    [-h, 0, h],
  ];
  const positions: number[] = [];
  for (let i = 0; i < 4; i++) positions.push(...(corners[(i + 1) % 4] as number[]), ...(corners[i] as number[]), 0, height, 0);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.computeVertexNormals();
  const c = new THREE.Color(colour);
  geo.setAttribute('color', new THREE.Float32BufferAttribute(Array.from({ length: 12 }, () => [c.r, c.g, c.b]).flat(), 3));
  return geo;
}

/** A stone with its colour, for standing outside a rock shop. */
function boulder(radius: number, colour: number): THREE.BufferGeometry {
  const geo = new THREE.OctahedronGeometry(radius, 0);
  const c = new THREE.Color(colour);
  geo.setAttribute('color', new THREE.Float32BufferAttribute(Array.from({ length: geo.getAttribute('position').count }, () => [c.r, c.g, c.b]).flat(), 3));
  return geo;
}

/** Rows of windows along the front and the back. */
function windows(w: number, d: number, floors: number, floorH: number, base: number, skipDoor = true, tall = 1.3): Block[] {
  const panes: Block[] = [];
  const count = Math.max(2, Math.floor(w / 3.4));
  for (let f = 0; f < floors; f++) {
    const y = base + 1.7 + f * floorH;
    for (let i = 0; i < count; i++) {
      const x = -w / 2 + ((i + 0.5) * w) / count;
      if (!(skipDoor && f === 0 && Math.abs(x) < 1.6)) panes.push({ size: [1.3, tall, 0.16], at: [x, y, d / 2 + 0.05], colour: 0xffffff });
      panes.push({ size: [1.3, tall, 0.16], at: [x, y, -d / 2 - 0.05], colour: 0xffffff });
    }
  }
  return panes;
}

/** Walls, a pitched roof with its ridge along the front, and a door. */
function shell(w: number, d: number, h: number, wall: number, roofColour: number, roofH: number, gable = wall): Kit {
  return {
    list: [
      { size: [w + 0.4, 0.7 + FOOTING, d + 0.4], at: [0, 0.35 - FOOTING / 2, 0], colour: STONE },
      { size: [w, h, d], at: [0, 0.7 + h / 2, 0], colour: wall },
      { size: [1.5, 2.4, 0.2], at: [0, 0.7 + 1.2, d / 2 + 0.08], colour: DOOR },
    ],
    extra: [placed(roof(w + 1.2, d + 1.4, roofH, roofColour, gable), 0, 0.7 + h, 0)],
    panes: [],
    signY: Math.min(0.7 + h - 0.7, 4.3),
    signH: 0.9,
  };
}

/** A porch along the front: a deck, posts and a roof of its own. */
function porch(kit: Kit, w: number, d: number, roofColour: number, depth = 2.8): void {
  kit.list.push({ size: [w, 0.3, depth], at: [0, 0.6, d / 2 + depth / 2], colour: DARK }, { size: [w + 0.4, 0.25, depth + 0.5], at: [0, 3.5, d / 2 + depth / 2], colour: roofColour });
  const posts = Math.max(2, Math.round(w / 4));
  for (let i = 0; i <= posts; i++) kit.list.push({ size: [0.22, 2.8, 0.22], at: [-w / 2 + (i * w) / posts, 2.1, d / 2 + depth - 0.15], colour: WHITE });
}

/** A shop awning over the front windows, in stripes. */
function awning(kit: Kit, w: number, d: number, colour: number): void {
  const stripes = Math.max(4, Math.round(w / 1.3));
  for (let i = 0; i < stripes; i++) {
    kit.list.push({ size: [w / stripes + 0.02, 0.12, 1.9], at: [-w / 2 + ((i + 0.5) * w) / stripes, 3.25, d / 2 + 0.85], colour: i % 2 === 0 ? colour : WHITE, tip: 0.38 });
  }
}

const STYLES: Record<TownStyle, (p: TownPlace, roofColour: number) => Kit> = {
  inn(p, r) {
    const h = p.w > 40 ? 9.6 : 6.6;
    const floors = p.w > 40 ? 3 : 2;
    const kit = shell(p.w, p.d, h, CREAM, roofOf(r, 0x3f5a4a), Math.min(6, p.d * 0.3), 0xd8ceb4);
    porch(kit, p.w * 0.94, p.d, roofOf(r, 0x3f5a4a));
    // Dormers, and a chimney at each end.
    const dormers = Math.max(2, Math.round(p.w / 12));
    for (let i = 0; i < dormers; i++) {
      const x = -p.w / 2 + ((i + 0.5) * p.w) / dormers;
      kit.list.push({ size: [2.2, 1.7, 2.4], at: [x, 0.7 + h + 1.2, p.d * 0.24], colour: CREAM });
      kit.panes.push({ size: [1.2, 1, 0.14], at: [x, 0.7 + h + 1.3, p.d * 0.24 + 1.22], colour: 0xffffff });
    }
    for (const sx of [-1, 1]) kit.list.push({ size: [1.3, h + 5, 1.3], at: [sx * p.w * 0.4, 0.7 + (h + 5) / 2, -p.d * 0.1], colour: BRICK });
    kit.flues = [-1, 1].map((sx): [number, number, number] => [sx * p.w * 0.4, 0.7 + h + 5.2, -p.d * 0.1]);
    kit.panes.push(...windows(p.w, p.d, floors, 3.1, 0.7));
    kit.signY = 4.6;
    kit.signH = 1.1;
    return kit;
  },
  store(p) {
    // A flat-roofed market with a red band across the front for its name.
    const h = 5.2;
    const kit: Kit = {
      list: [
        { size: [p.w, h + FOOTING, p.d], at: [0, (h - FOOTING) / 2, 0], colour: 0xd9d3c5 },
        { size: [p.w + 0.6, 0.4, p.d + 0.6], at: [0, h + 0.2, 0], colour: 0x6b7480 },
        { size: [p.w * 0.9, 1.5, 0.3], at: [0, h - 1.1, p.d / 2 + 0.12], colour: 0xb53a2a },
        { size: [3, 2.6, 0.2], at: [0, 1.3, p.d / 2 + 0.1], colour: 0x3d4a5e },
      ],
      extra: [],
      panes: [],
      signY: h - 1.1,
      signH: 1.2,
    };
    for (const sx of [-1, 1]) kit.panes.push({ size: [p.w * 0.3, 2, 0.16], at: [sx * p.w * 0.27, 1.8, p.d / 2 + 0.06], colour: 0xffffff });
    return kit;
  },
  postoffice(p) {
    const h = 4.8;
    const kit: Kit = {
      list: [
        { size: [p.w, h + FOOTING, p.d], at: [0, (h - FOOTING) / 2, 0], colour: BRICK },
        { size: [p.w + 0.5, 0.5, p.d + 0.5], at: [0, h + 0.25, 0], colour: WHITE },
        { size: [1.6, 2.5, 0.2], at: [0, 1.25, p.d / 2 + 0.08], colour: 0x2b4a7a },
        { size: [3.4, 0.25, 1.6], at: [0, 0.12, p.d / 2 + 0.8], colour: STONE },
        // A flagpole, with the flag out in the wind.
        { size: [0.14, 8, 0.14], at: [p.w / 2 + 2, 4, p.d / 2 + 1.5], colour: 0xc9ced6 },
        { size: [1.7, 0.36, 0.05], at: [p.w / 2 + 2.9, 7.6, p.d / 2 + 1.5], colour: 0xb53a2a },
        { size: [1.7, 0.36, 0.05], at: [p.w / 2 + 2.9, 7.24, p.d / 2 + 1.5], colour: WHITE },
        { size: [1.7, 0.36, 0.05], at: [p.w / 2 + 2.9, 6.88, p.d / 2 + 1.5], colour: 0xb53a2a },
        { size: [0.75, 0.72, 0.06], at: [p.w / 2 + 2.45, 7.42, p.d / 2 + 1.5], colour: 0x2b4a7a },
        // A blue mailbox by the door.
        { size: [0.6, 1.1, 0.6], at: [2.3, 0.55, p.d / 2 + 1], colour: 0x2b4a7a },
      ],
      extra: [],
      panes: windows(p.w, p.d, 1, 3, 0),
      signY: 3.6,
      signH: 0.9,
    };
    return kit;
  },
  church(p, r) {
    // The nave runs along the front; the tower stands at its west end, with a spire.
    const h = 6.5;
    const kit = shell(p.w, p.d, h, WHITE, roofOf(r, 0x5c6672), p.d * 0.55, WHITE);
    const tower = Math.min(4.4, p.d * 0.5);
    const tx = -p.w / 2 + tower / 2;
    kit.list.push({ size: [tower, h + 7, tower], at: [tx, 0.7 + (h + 7) / 2, p.d / 2 - tower / 2 + 0.6], colour: WHITE }, { size: [tower + 0.5, 0.4, tower + 0.5], at: [tx, 0.7 + h + 7.1, p.d / 2 - tower / 2 + 0.6], colour: 0x5c6672 });
    kit.extra.push(placed(pyramid(tower + 0.2, 7, 0x5c6672), tx, 0.7 + h + 7.3, p.d / 2 - tower / 2 + 0.6));
    // A cross on the point, and tall windows down each side.
    kit.list.push({ size: [0.12, 1.4, 0.12], at: [tx, 0.7 + h + 15, p.d / 2 - tower / 2 + 0.6], colour: 0xd9a441 }, { size: [0.7, 0.12, 0.12], at: [tx, 0.7 + h + 15.2, p.d / 2 - tower / 2 + 0.6], colour: 0xd9a441 });
    kit.panes.push(...windows(p.w, p.d, 1, 3, 1.4, false, 3));
    return kit;
  },
  hall(p, r) {
    const h = 7.2;
    const kit = shell(p.w, p.d, h, BRICK, roofOf(r, 0x4d5666), p.d * 0.3, BRICK);
    // White columns and a pediment at the door, and a cupola on the ridge.
    for (const x of [-3, -1, 1, 3]) kit.list.push({ size: [0.5, 5, 0.5], at: [x, 0.7 + 2.5, p.d / 2 + 1.6], colour: WHITE });
    kit.list.push({ size: [8, 0.5, 2.4], at: [0, 0.35, p.d / 2 + 1.3], colour: STONE }, { size: [7.6, 1.1, 2.2], at: [0, 0.7 + 5.5, p.d / 2 + 1.2], colour: WHITE });
    kit.extra.push(placed(roof(7.6, 2.4, 1.5, WHITE, WHITE), 0, 0.7 + 6.05, p.d / 2 + 1.2));
    const top = 0.7 + h + p.d * 0.3;
    kit.list.push({ size: [2.4, 2.4, 2.4], at: [0, top + 0.9, 0], colour: WHITE });
    kit.extra.push(placed(pyramid(3, 2.2, 0x3f6b5a), 0, top + 2.1, 0));
    kit.panes.push(...windows(p.w, p.d, 2, 3.2, 0.7), { size: [1, 1, 0.1], at: [0, top + 1, 1.22], colour: 0xffffff });
    kit.signY = 0.7 + 5.5;
    kit.signH = 0.9;
    return kit;
  },
  barn(p, r) {
    const h = 6.4;
    const kit = shell(p.w, p.d, h, 0x9a3a2c, roofOf(r, 0x4d5666), p.d * 0.36, 0x9a3a2c);
    // Barn doors, framed in white, and a hayloft door above them.
    kit.list.push({ size: [4.4, 3.6, 0.2], at: [0, 0.7 + 1.8, p.d / 2 + 0.1], colour: 0x7e2c20 });
    for (const x of [-2.2, 0, 2.2]) kit.list.push({ size: [0.2, 3.6, 0.12], at: [x, 0.7 + 1.8, p.d / 2 + 0.22], colour: WHITE });
    for (const y of [0.1, 1.8, 3.5]) kit.list.push({ size: [4.6, 0.2, 0.12], at: [0, 0.7 + y, p.d / 2 + 0.22], colour: WHITE });
    kit.panes.push(...windows(p.w, p.d, 1, 3, 3.6));
    kit.signY = 0.7 + h - 0.4;
    return kit;
  },
  cafe(p, r) {
    const kit = shell(p.w, p.d, 4.6, 0xf1e2c0, roofOf(r, 0x7a4a3a), p.d * 0.3, 0xf1e2c0);
    awning(kit, p.w * 0.9, p.d, 0xe2a52e);
    for (const sx of [-1, 1]) kit.panes.push({ size: [p.w * 0.3, 1.7, 0.16], at: [sx * p.w * 0.27, 1.9, p.d / 2 + 0.06], colour: 0xffffff });
    // Two tables outside, whatever the weather.
    for (const sx of [-1, 1]) kit.list.push({ size: [0.9, 0.08, 0.9], at: [sx * p.w * 0.3, 0.85, p.d / 2 + 3], colour: WHITE }, { size: [0.12, 0.8, 0.12], at: [sx * p.w * 0.3, 0.42, p.d / 2 + 3], colour: DARK });
    kit.signY = 4.5;
    return kit;
  },
  deli(p, r) {
    const kit = shell(p.w, p.d, 4.6, BRICK, roofOf(r, 0x4d5666), p.d * 0.28, BRICK);
    awning(kit, p.w * 0.9, p.d, 0x2f7a4c);
    for (const sx of [-1, 1]) kit.panes.push({ size: [p.w * 0.3, 1.7, 0.16], at: [sx * p.w * 0.27, 1.9, p.d / 2 + 0.06], colour: 0xffffff });
    kit.signY = 4.5;
    return kit;
  },
  house(p, r) {
    const kit = shell(p.w, p.d, 5.6, 0xb9c8d6, roofOf(r, 0x5c6672), p.d * 0.4, 0xa9b8c6);
    porch(kit, Math.min(p.w, 7), p.d, roofOf(r, 0x5c6672), 2.2);
    kit.panes.push(...windows(p.w, p.d, 2, 2.8, 0.7));
    kit.list.push({ size: [1, 3.4, 1], at: [p.w * 0.3, 0.7 + 5.6 + 1.7, 0], colour: BRICK });
    kit.flues = [[p.w * 0.3, 0.7 + 5.6 + 3.6, 0]];
    kit.signY = 3.9;
    kit.signH = 0.7;
    return kit;
  },
  mill(p, r) {
    // A long shed of the old garnet works: rust-red iron, a low grey roof, a row of small panes.
    const h = Math.min(9, 4 + Math.min(p.w, p.d) * 0.22);
    const kit = shell(p.w, p.d, h, RUST, roofOf(r, 0x7c8088), p.d * 0.18, 0x7e4230);
    kit.list.push({ size: [3.4, 3.2, 0.2], at: [p.w * 0.25, 0.7 + 1.6, p.d / 2 + 0.1], colour: 0x5a2e22 });
    kit.panes.push(...windows(p.w, p.d, 1, 3, h - 2.6, false, 0.9));
    kit.signY = 0.7 + h - 1;
    return kit;
  },
  powerhouse(p, r) {
    const kit = STYLES.mill(p, r);
    // The stack.
    kit.list.push({ size: [1.6, 15, 1.6], at: [-p.w * 0.32, 7.5, -p.d * 0.15], colour: BRICK }, { size: [1.9, 0.5, 1.9], at: [-p.w * 0.32, 15.2, -p.d * 0.15], colour: 0x3a3430 });
    return kit;
  },
  cabin(p, r) {
    // The rock shop: a log cabin, with a garnet the size of a pony out front on a plinth.
    const kit = shell(p.w, p.d, 3.8, TIMBER, roofOf(r, 0x3f5a4a), p.d * 0.42, 0x6b4530);
    porch(kit, p.w * 0.9, p.d, roofOf(r, 0x3f5a4a), 2.4);
    kit.panes.push(...windows(p.w, p.d, 1, 3, 0.7));
    kit.list.push({ size: [1.6, 0.9, 1.6], at: [p.w / 2 + 2.6, 0.45, p.d / 2 + 2.4], colour: STONE }, { size: [1, 3.6, 1], at: [-p.w * 0.3, 0.7 + 3.8 + 1.6, -p.d * 0.1], colour: STONE });
    kit.flues = [[-p.w * 0.3, 0.7 + 3.8 + 3.6, -p.d * 0.1]];
    kit.extra.push(placed(boulder(1.25, 0x8f1d2c), p.w / 2 + 2.6, 2.05, p.d / 2 + 2.4, 0.5));
    kit.signY = 4.1;
    return kit;
  },
  station(p) {
    // What is left of the first gondola's mid station: concrete, a wide dark mouth, a bullwheel on top.
    const h = 6;
    return {
      list: [
        { size: [p.w, h + FOOTING, p.d], at: [0, (h - FOOTING) / 2, 0], colour: 0x9aa0a8 },
        { size: [p.w + 0.8, 0.5, p.d + 0.8], at: [0, h + 0.25, 0], colour: 0x7c8088 },
        { size: [p.w * 0.5, h * 0.62, 0.3], at: [0, h * 0.31, p.d / 2 + 0.1], colour: 0x2a2e36 },
        { size: [4.4, 0.5, 4.4], at: [0, h + 1.2, 0], colour: 0x5a3a2a, turn: Math.PI / 4 },
        { size: [0.6, 1.4, 0.6], at: [0, h + 0.7, 0], colour: 0x4d5666 },
      ],
      extra: [],
      panes: [],
      signY: h - 0.9,
      signH: 0.9,
    };
  },
  tavern(p, r) {
    const kit = shell(p.w, p.d, 4.8, 0x5a4030, roofOf(r, 0x3a3430), p.d * 0.36, 0x4a3326);
    porch(kit, p.w * 0.8, p.d, roofOf(r, 0x3a3430), 2.2);
    kit.panes.push(...windows(p.w, p.d, 1, 3, 0.7));
    kit.list.push({ size: [1.2, 4, 1.2], at: [p.w * 0.32, 0.7 + 4.8 + 1.6, 0], colour: STONE });
    kit.flues = [[p.w * 0.32, 0.7 + 4.8 + 3.8, 0]];
    kit.signY = 4.3;
    return kit;
  },
  shed(p, r) {
    const kit = shell(p.w, p.d, 4.2, 0x8a5a3c, roofOf(r, 0x5c6672), p.d * 0.3, 0x6b4530);
    kit.panes.push(...windows(p.w, p.d, 1, 3, 0.7));
    kit.signY = 4;
    return kit;
  },
  firehouse(p, r) {
    const kit = shell(p.w, p.d, 4.6, 0xb53a2a, roofOf(r, 0x4d5666), p.d * 0.3, 0xb53a2a);
    kit.list.push({ size: [p.w * 0.6, 3.2, 0.2], at: [0, 0.7 + 1.6, p.d / 2 + 0.1], colour: WHITE });
    kit.signY = 4.7;
    kit.signH = 0.7;
    return kit;
  },
};

/** How high each style stands, roof and all, in metres: for the camera and for people to walk round. */
export function townPlaceHeight(style: TownStyle, w: number, d: number): number {
  const walls: Partial<Record<TownStyle, number>> = { inn: w > 40 ? 9.6 : 6.6, store: 5.2, postoffice: 4.8, church: 6.5, hall: 7.2, barn: 6.4, mill: 6, powerhouse: 6, station: 6 };
  return (walls[style] ?? 4.8) + 0.7 + Math.min(6, d * 0.35);
}

/**
 * All the named places as geometry: one for walls and roofs, one for windows, and the signs to
 * be painted for them.
 * @param roofColour snow in winter, each building's own roof otherwise
 */
/** How far out each kind of porch comes, for hanging things from its front edge. */
const PORCH_DEPTH: Partial<Record<TownStyle, number>> = { inn: 2.8, cabin: 2.4, tavern: 2.2, house: 2.2 };

/** The kinds of place that are dressed for the season: where somebody is in and out of the door all day. */
const DRESSED: readonly TownStyle[] = ['inn', 'postoffice', 'hall', 'cafe', 'deli', 'house', 'tavern', 'cabin', 'store', 'church'];

/**
 * What the season puts round a front door: a wreath and a string of lights along the front in
 * winter (the lights go with the windows, so they come on at dusk), tubs of flowers in spring
 * and summer, pumpkins in the fall.
 */
function dressing(p: TownPlace, season: Season): { list: Block[]; panes: Block[] } {
  const list: Block[] = [];
  const panes: Block[] = [];
  const front = p.d / 2;
  // The model is sunk half a metre, so the ground at the front wall is at 0.5 in its own heights.
  const ground = 0.5;
  if (season === 'winter') {
    list.push(
      { size: [0.66, 0.66, 0.07], at: [0, 2.45, front + 0.2], colour: 0x2f6a44 },
      { size: [0.32, 0.32, 0.08], at: [0, 2.45, front + 0.21], colour: DOOR },
      { size: [0.2, 0.14, 0.09], at: [0, 2.17, front + 0.22], colour: 0xc8402d },
    );
    // Along the front of the porch where there is one, so its roof does not hide them; else under the eaves.
    const porchDepth = PORCH_DEPTH[p.style] ?? 0;
    const span = Math.min(p.w * (porchDepth ? 0.8 : 0.9), 24);
    const bulbs = Math.max(6, Math.round(span / 1.1));
    for (let i = 0; i <= bulbs; i++) {
      // Hung in shallow loops from one end of the front to the other.
      const sag = Math.abs(Math.sin((i / bulbs) * Math.PI * Math.max(2, Math.round(span / 5)))) * 0.22;
      panes.push({ size: [0.13, 0.13, 0.13], at: [-span / 2 + (i * span) / bulbs, (porchDepth ? 3.3 : 3.72) - sag, front + (porchDepth ? porchDepth + 0.2 : 0.45)], colour: 0xffffff });
    }
  } else if (season === 'fall') {
    list.push(
      { size: [0.52, 0.4, 0.52], at: [1.45, ground + 0.2, front + 0.75], colour: 0xe8742a },
      { size: [0.36, 0.28, 0.36], at: [1.95, ground + 0.14, front + 1.05], colour: 0xd9822b },
      { size: [0.08, 0.12, 0.08], at: [1.45, ground + 0.45, front + 0.75], colour: 0x4f6b3a },
      { size: [0.44, 0.34, 0.44], at: [-1.5, ground + 0.17, front + 0.8], colour: 0xe2a52e },
    );
  } else {
    const petals = season === 'spring' ? [0xe2a52e, 0xc8402d] : [0xd9638a, 0xf4ead8];
    for (const side of [-1, 1]) {
      list.push(
        { size: [0.62, 0.5, 0.62], at: [side * 1.5, ground + 0.25, front + 0.7], colour: 0x6b4a33 },
        { size: [0.56, 0.2, 0.56], at: [side * 1.5, ground + 0.58, front + 0.7], colour: 0x4f8a3a },
        { size: [0.2, 0.16, 0.2], at: [side * 1.5 - 0.13, ground + 0.72, front + 0.62], colour: petals[0] as number },
        { size: [0.2, 0.16, 0.2], at: [side * 1.5 + 0.14, ground + 0.72, front + 0.82], colour: petals[1] as number },
        { size: [0.16, 0.14, 0.16], at: [side * 1.5 + 0.1, ground + 0.74, front + 0.56], colour: petals[0] as number },
      );
    }
  }
  return { list, panes };
}

export function buildTownPlaces(
  places: readonly TownPlace[],
  roofColour: number,
  season: Season = 'winter',
): { walls: THREE.BufferGeometry; panes: THREE.BufferGeometry; signs: SignSpec[]; flues: Flue[]; hangs: Hanging[] } {
  const flues: Flue[] = [];
  const hangs: Hanging[] = [];
  const wallParts: THREE.BufferGeometry[] = [];
  const paneParts: THREE.BufferGeometry[] = [];
  const signs: SignSpec[] = [];
  for (const p of places) {
    const kit = STYLES[p.style](p, roofColour);
    if (DRESSED.includes(p.style)) {
      const dress = dressing(p, season);
      kit.list.push(...dress.list);
      kit.panes.push(...dress.panes);
    }
    // Sunk a little, so the footing meets the ground on a slope.
    const set = (geo: THREE.BufferGeometry): THREE.BufferGeometry => placed(geo, p.x, p.y - 0.5, p.z, p.turn);
    wallParts.push(set(blocks(kit.list, kit.extra)));
    if (kit.panes.length > 0) paneParts.push(set(blocks(kit.panes)));
    // Fires are lit when it is cold: every season but summer.
    if (season !== 'summer') {
      const cos = Math.cos(p.turn);
      const sin = Math.sin(p.turn);
      for (const [lx, ly, lz] of kit.flues ?? []) flues.push({ x: p.x + lx * cos + lz * sin, y: p.y - 0.5 + ly, z: p.z - lx * sin + lz * cos, size: 1 });
    }
    // A shop with a picture for its trade has it hung out over the door, as its neighbours have.
    if (p.sign && hasShopPicture(p.sign)) {
      const porch = PORCH_DEPTH[p.style] ?? (p.style === 'cafe' || p.style === 'deli' ? 1.7 : 0);
      const kitWith: HouseKit = { list: [], extra: [], panes: [] };
      hanging(kitWith, Math.min(p.w / 2 - 0.5, 4.5), 3.05, p.d / 2 + porch + 0.1);
      wallParts.push(set(blocks(kitWith.list)));
      const [lx, ly, lz] = kitWith.hang as [number, number, number];
      hangs.push({ text: p.sign, x: p.x + lx * Math.cos(p.turn) + lz * Math.sin(p.turn), y: p.y - 0.5 + ly, z: p.z - lx * Math.sin(p.turn) + lz * Math.cos(p.turn), turn: p.turn });
    }
    if (p.sign) {
      const out = p.d / 2 + (p.style === 'hall' ? 2.35 : 0.2);
      signs.push({
        text: p.sign,
        x: p.x + Math.sin(p.turn) * out,
        y: p.y - 0.5 + kit.signY,
        z: p.z + Math.cos(p.turn) * out,
        turn: p.turn,
        height: kit.signH,
        maxWidth: p.style === 'hall' ? 7.2 : Math.min(p.w * 0.8, 11),
        board: p.style === 'store' ? '#b53a2a' : p.style === 'postoffice' ? '#2b4a7a' : '#f5f2ea',
        ink: p.style === 'store' || p.style === 'postoffice' ? '#fffdf7' : '#22304a',
      });
    }
  }
  return { walls: blocks([], wallParts), panes: blocks([], paneParts), signs, flues, hangs };
}

/**
 * The named places, standing in the scene: two draw calls (walls, windows) for all of them.
 * Their signs are painted with every other sign in the game (`buildSigns`).
 */
export class TownPlaces {
  readonly group = new THREE.Group();
  private readonly glass = new THREE.MeshBasicMaterial({ color: 0x3d4a5e });
  private readonly dark = new THREE.Color(0x3d4a5e);
  private readonly lit = new THREE.Color(0xffc56e);

  /** The signs to be painted for these places. */
  readonly signs: SignSpec[];
  /** The tops of the chimneys that are smoking this season. */
  readonly flues: Flue[];
  /** The picture signs hung out over the doors of those that are shops. */
  readonly hangs: Hanging[];

  /**
   * @param season the doors are dressed for it
   * @param also other things made the same way (the train, the street lamps), to be joined into the same two meshes
   * @param textured whether the walls wear their courses of boards
   */
  constructor(places: readonly TownPlace[], castShadow: boolean, roofColour: number, season: Season, also: { walls: THREE.BufferGeometry[]; panes: THREE.BufferGeometry[]; signs: SignSpec[] } = { walls: [], panes: [], signs: [] }, textured = true) {
    this.group.name = 'town-places';
    const built = buildTownPlaces(places, roofColour, season);
    this.signs = [...built.signs, ...also.signs];
    this.flues = built.flues;
    this.hangs = built.hangs;
    if (places.length === 0 && also.walls.length === 0) return;
    const walls = new THREE.Mesh(blocks([], [built.walls, ...also.walls]), lit({ vertexColors: true, flatShading: true, map: textured ? siding() : null }));
    walls.castShadow = castShadow;
    walls.receiveShadow = true;
    const panes = new THREE.Mesh(blocks([], [built.panes, ...also.panes]), this.glass);
    for (const mesh of [walls, panes]) {
      mesh.matrixAutoUpdate = false;
      this.group.add(mesh);
    }
  }

  /** How lit the windows are: 0 by day, 1 after dark. */
  setLamps(amount: number): void {
    this.glass.color.copy(this.dark).lerp(this.lit, Math.min(1, Math.max(0, amount)));
  }
}
