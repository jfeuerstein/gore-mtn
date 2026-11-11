import * as THREE from 'three/webgpu';
import { blocks, placed, type Block } from './shapes';
import type { SignSpec } from './signs';
import type { Season } from '../look/season';
import type { Kerbside } from './roadways';
import type { Bridge, Fixture } from './streets';

/**
 * The lamps, benches and welcome signs of North Creek as geometry, to be joined into the
 * town's own meshes: the lamps' lanterns go with the windows, so they light when the windows do.
 */
const IRON = 0x2f4a3f;
const TIMBER = 0x7a5232;

/** A street lamp: a post, an arm out over the road (its own +z), and a lantern hung from it. */
function lamp(): { list: Block[]; panes: Block[] } {
  return {
    list: [
      { size: [0.26, 0.5, 0.26], at: [0, 0.25, 0], colour: IRON },
      { size: [0.13, 4.4, 0.13], at: [0, 2.2, 0], colour: IRON },
      { size: [0.08, 0.08, 1.1], at: [0, 4.3, 0.5], colour: IRON },
      { size: [0.42, 0.08, 0.42], at: [0, 4.2, 0.95], colour: IRON },
    ],
    panes: [{ size: [0.3, 0.36, 0.3], at: [0, 3.98, 0.95], colour: 0xffffff }],
  };
}

/** A park bench, its seat toward its own +z. */
function bench(): Block[] {
  return [
    { size: [1.7, 0.08, 0.46], at: [0, 0.46, 0.1], colour: TIMBER },
    { size: [1.7, 0.42, 0.07], at: [0, 0.82, -0.14], colour: TIMBER },
    { size: [0.08, 0.46, 0.44], at: [-0.72, 0.23, 0.1], colour: IRON },
    { size: [0.08, 0.46, 0.44], at: [0.72, 0.23, 0.1], colour: IRON },
    { size: [0.08, 0.6, 0.08], at: [-0.72, 0.74, -0.14], colour: IRON },
    { size: [0.08, 0.6, 0.08], at: [0.72, 0.74, -0.14], colour: IRON },
  ];
}

/**
 * A bridge, its length along its own x: a deck, a railing down each side, and for a long span a
 * steel truss over the road, painted the green of Adirondack highway bridges.
 */
function bridge(length: number): Block[] {
  const GREEN = 0x3f6b5a;
  const half = 4.6;
  const list: Block[] = [{ size: [length + 6, 0.5, half * 2 + 0.6], at: [0, 0.05, 0], colour: 0x5a5f68 }];
  const posts = Math.max(2, Math.round(length / 3));
  for (const side of [-1, 1]) {
    list.push({ size: [length + 4, 0.14, 0.14], at: [0, 1.25, side * half], colour: 0xc9ced6 }, { size: [length + 4, 0.1, 0.1], at: [0, 0.8, side * half], colour: 0xc9ced6 });
    for (let i = 0; i <= posts; i++) list.push({ size: [0.14, 1.1, 0.14], at: [-length / 2 - 2 + (i * (length + 4)) / posts, 0.75, side * half], colour: 0xc9ced6 });
  }
  if (length < 30) return list;
  // The truss: a top chord each side on uprights, braced crosswise overhead, with sloped ends.
  const bays = Math.max(4, Math.round(length / 7));
  const bay = length / bays;
  const top = 6.2;
  for (const side of [-1, 1]) {
    list.push({ size: [length - bay * 2, 0.4, 0.4], at: [0, top, side * (half + 0.3)], colour: GREEN });
    for (let i = 1; i < bays; i++) list.push({ size: [0.3, top, 0.3], at: [-length / 2 + i * bay, top / 2, side * (half + 0.3)], colour: GREEN });
    for (const end of [-1, 1]) {
      // The end post leans in from the abutment to the first upright.
      const run = Math.hypot(bay, top);
      list.push({ size: [0.36, 0.36, run], at: [end * (length / 2 - bay / 2), top / 2, side * (half + 0.3)], colour: GREEN, turn: end * (Math.PI / 2), tip: Math.atan2(top, bay) });
    }
  }
  for (let i = 1; i < bays; i++) list.push({ size: [0.3, 0.3, half * 2 + 0.6], at: [-length / 2 + i * bay, top, 0], colour: GREEN });
  return list;
}

const CAR_PAINT = [0x7a8590, 0x8a3a30, 0x2f4a3f, 0xd9d3c5, 0x3a3f48, 0xb9a26a, 0x2b4a7a, 0x9aa7b0];
const SNOW = 0xf2f5fa;
const RUBBER = 0x1f2228;
const WINDSCREEN = 0x2a3440;

/** A parked car, or now and then a pickup, its nose toward its own +z. Under snow in winter. */
function car(roll: number, winter: boolean): Block[] {
  const paint = CAR_PAINT[Math.floor(roll * CAR_PAINT.length) % CAR_PAINT.length] as number;
  const pickup = (roll * 7) % 1 < 0.3;
  const list: Block[] = [
    { size: [1.76, 0.58, 4.3], at: [0, 0.6, 0], colour: paint },
    // Bumpers, front and back.
    { size: [1.8, 0.16, 0.12], at: [0, 0.42, 2.16], colour: 0xc9ced6 },
    { size: [1.8, 0.16, 0.12], at: [0, 0.42, -2.16], colour: 0xc9ced6 },
  ];
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) list.push({ size: [0.24, 0.64, 0.64], at: [sx * 0.8, 0.32, sz * 1.35], colour: RUBBER });
  if (pickup) {
    // The cab forward, an open bed behind.
    list.push({ size: [1.6, 0.56, 1.5], at: [0, 1.17, 0.45], colour: WINDSCREEN }, { size: [1.66, 0.1, 1.56], at: [0, 1.48, 0.45], colour: paint });
    for (const sx of [-1, 1]) list.push({ size: [0.1, 0.34, 1.9], at: [sx * 0.83, 1.04, -1.15], colour: paint });
    list.push({ size: [1.76, 0.34, 0.1], at: [0, 1.04, -2.1], colour: paint });
    if (winter) list.push({ size: [1.5, 0.14, 1.4], at: [0, 1.59, 0.45], colour: SNOW }, { size: [1.5, 0.2, 1.8], at: [0, 0.98, -1.15], colour: SNOW }, { size: [1.5, 0.08, 1], at: [0, 0.93, 1.55], colour: SNOW });
  } else {
    list.push({ size: [1.56, 0.5, 2.3], at: [0, 1.14, -0.25], colour: WINDSCREEN }, { size: [1.62, 0.1, 2], at: [0, 1.42, -0.25], colour: paint });
    if (winter) list.push({ size: [1.5, 0.14, 1.8], at: [0, 1.53, -0.25], colour: SNOW }, { size: [1.5, 0.08, 1], at: [0, 0.93, 1.5], colour: SNOW }, { size: [1.5, 0.08, 0.7], at: [0, 0.93, -1.7], colour: SNOW });
  }
  return list;
}

/** A utility pole: a tall pole with a crossarm near the top, and now and then a transformer hung on it. */
const POLE_TOP = 7.6;
/** A course so tall that whatever is given it has none: paintwork and iron are smooth, not boarded. */
const SMOOTH = 1e6;
function pole(roll: number): Block[] {
  const wood = 0x54463a;
  const list: Block[] = [
    { size: [0.24, POLE_TOP + 0.5, 0.24], at: [0, (POLE_TOP + 0.5) / 2, 0], colour: wood },
    { size: [1.9, 0.12, 0.12], at: [0, POLE_TOP, 0], colour: wood },
  ];
  for (const sx of [-0.85, 0, 0.85]) list.push({ size: [0.08, 0.16, 0.08], at: [sx, POLE_TOP + 0.14, 0], colour: 0xc9ced6 });
  if (roll < 0.3) list.push({ size: [0.5, 0.8, 0.5], at: [0.42, POLE_TOP - 1.3, 0], colour: 0x7c8088 });
  return list;
}

/** A fire hydrant. In winter, somebody has been putting hats on them. */
function hydrant(roll: number, winter: boolean): Block[] {
  const red = 0xb53a2a;
  const list: Block[] = [
    { size: [0.3, 0.7, 0.3], at: [0, 0.35, 0], colour: red },
    { size: [0.38, 0.12, 0.38], at: [0, 0.74, 0], colour: red },
    { size: [0.56, 0.14, 0.14], at: [0, 0.48, 0], colour: 0xc9ced6 },
  ];
  if (winter && roll < 0.75) {
    const wool = [0xe2a52e, 0x2b62c9, 0x7a4ab0, 0x2f8a4e][Math.floor(roll * 16) % 4] as number;
    list.push({ size: [0.42, 0.2, 0.42], at: [0, 0.9, 0], colour: wool }, { size: [0.32, 0.14, 0.32], at: [0, 1.06, 0], colour: wool }, { size: [0.14, 0.14, 0.14], at: [0, 1.2, 0], colour: 0xf4ead8 });
  }
  return list;
}

/** A four-sided point, for the tiers of a tree: its base at y = 0. */
function tier(size: number, height: number, colour: number): THREE.BufferGeometry {
  const h = size / 2;
  const corners = [[-h, 0, -h], [h, 0, -h], [h, 0, h], [-h, 0, h]];
  const positions: number[] = [];
  for (let i = 0; i < 4; i++) positions.push(...(corners[(i + 1) % 4] as number[]), ...(corners[i] as number[]), 0, height, 0);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.computeVertexNormals();
  const c = new THREE.Color(colour);
  geo.setAttribute('color', new THREE.Float32BufferAttribute(Array.from({ length: 12 }, () => [c.r, c.g, c.b]).flat(), 3));
  return geo;
}

/** The town's tree, put up outside the town hall for the winter: a tall fir hung with lights, a star on top. */
function townTree(): { walls: THREE.BufferGeometry; panes: Block[] } {
  const green = 0x2f5a44;
  const tiers: THREE.BufferGeometry[] = [];
  const panes: Block[] = [{ size: [0.5, 0.5, 0.12], at: [0, 9.5, 0], colour: 0xffffff }, { size: [0.12, 0.5, 0.5], at: [0, 9.5, 0], colour: 0xffffff }];
  for (let i = 0; i < 4; i++) {
    const size = 5.2 - i * 1.15;
    const y = 1.2 + i * 1.9;
    tiers.push(placed(tier(size, 3, green), 0, y, 0), placed(tier(size * 0.96, 0.5, SNOW), 0, y + 2.52 - i * 0.04, 0));
    // Lights round each tier, where the boughs end.
    const n = 4 - (i > 2 ? 1 : 0);
    for (let k = 0; k < n * 4; k++) {
      const a = (k / (n * 4)) * Math.PI * 2 + i;
      const r = (size / 2) * 0.62;
      panes.push({ size: [0.16, 0.16, 0.16], at: [Math.cos(a) * r, y + 0.75, Math.sin(a) * r], colour: 0xffffff });
    }
  }
  return { walls: blocks([{ size: [0.5, 1.4, 0.5], at: [0, 0.7, 0], colour: 0x54463a }], tiers, SMOOTH), panes };
}

/** What stands along the kerb: parked cars, utility poles and the wires between them, hydrants, and in winter the town's tree. */
export function buildKerbside(
  cars: readonly Kerbside[],
  poles: readonly Kerbside[],
  hydrants: readonly Kerbside[],
  tree: { x: number; z: number } | null,
  heightAt: (x: number, z: number) => number,
  season: Season,
): { walls: THREE.BufferGeometry[]; panes: THREE.BufferGeometry[] } {
  const walls: THREE.BufferGeometry[] = [];
  const panes: THREE.BufferGeometry[] = [];
  const winter = season === 'winter';
  for (const at of cars) walls.push(placed(blocks(car(at.roll, winter), [], SMOOTH), at.x, heightAt(at.x, at.z), at.z, at.turn + (at.roll < 0.5 ? Math.PI : 0)));
  for (const at of hydrants) walls.push(placed(blocks(hydrant(at.roll, winter), [], SMOOTH), at.x, heightAt(at.x, at.z), at.z, at.turn));
  const wires: Block[] = [];
  poles.forEach((at, i) => {
    const y = heightAt(at.x, at.z);
    // The crossarm lies across the street: the pole's own +z is along it.
    walls.push(placed(blocks(pole(at.roll), [], SMOOTH), at.x, y, at.z, at.turn));
    const next = poles[i + 1];
    if (!next) return;
    const far = Math.hypot(next.x - at.x, next.z - at.z);
    // Only to the next pole down the street, not across a gap in them.
    if (far > 70) return;
    const ny = heightAt(next.x, next.z);
    for (const side of [-0.85, 0.85]) {
      const ax = at.x + Math.cos(at.turn) * side;
      const az = at.z - Math.sin(at.turn) * side;
      const bx = next.x + Math.cos(next.turn) * side;
      const bz = next.z - Math.sin(next.turn) * side;
      const len = Math.hypot(bx - ax, ny - y, bz - az);
      wires.push({ size: [0.035, 0.035, len], at: [(ax + bx) / 2, (y + ny) / 2 + POLE_TOP + 0.2, (az + bz) / 2], colour: 0x2a2e36, turn: Math.atan2(bx - ax, bz - az), tip: -Math.asin((ny - y) / len) });
    }
  });
  if (wires.length > 0) walls.push(blocks(wires, [], SMOOTH));
  if (tree && winter) {
    const model = townTree();
    const y = heightAt(tree.x, tree.z);
    walls.push(placed(model.walls, tree.x, y, tree.z));
    panes.push(placed(blocks(model.panes), tree.x, y, tree.z));
  }
  return { walls, panes };
}

export function buildStreetFurniture(
  lamps: readonly Fixture[],
  seats: readonly Fixture[],
  welcomes: readonly Fixture[],
  heightAt: (x: number, z: number) => number,
  spans: readonly Bridge[] = [],
): { walls: THREE.BufferGeometry[]; panes: THREE.BufferGeometry[]; signs: SignSpec[] } {
  const walls: THREE.BufferGeometry[] = [];
  const panes: THREE.BufferGeometry[] = [];
  const signs: SignSpec[] = [];
  for (const at of lamps) {
    const model = lamp();
    const y = heightAt(at.x, at.z);
    walls.push(placed(blocks(model.list), at.x, y, at.z, at.turn));
    panes.push(placed(blocks(model.panes), at.x, y, at.z, at.turn));
  }
  // A bridge is level, at the height of the road where it meets the bank.
  for (const span of spans) {
    const ex = (Math.cos(span.turn) * (span.length / 2 + 2));
    const ez = (-Math.sin(span.turn) * (span.length / 2 + 2));
    const y = Math.max(heightAt(span.x + ex, span.z + ez), heightAt(span.x - ex, span.z - ez), heightAt(span.x, span.z));
    walls.push(placed(blocks(bridge(span.length)), span.x, y, span.z, span.turn));
  }
  for (const at of seats) walls.push(placed(blocks(bench()), at.x, heightAt(at.x, at.z), at.z, at.turn));
  for (const at of welcomes) {
    const y = heightAt(at.x, at.z);
    // Two posts and a board, with the name on both faces.
    walls.push(
      placed(
        blocks([
          { size: [0.2, 3, 0.2], at: [-2.6, 1.5, 0], colour: TIMBER },
          { size: [0.2, 3, 0.2], at: [2.6, 1.5, 0], colour: TIMBER },
          { size: [5.2, 1.5, 0.08], at: [0, 2.1, 0], colour: 0x3a2e26 },
        ]),
        at.x,
        y,
        at.z,
        at.turn,
      ),
    );
    const common = { x: at.x, z: at.z, turn: at.turn, maxWidth: 5.1, width: 5.1, board: '#2f5a44', ink: '#f1d58a', twoSided: true };
    signs.push({ ...common, text: 'NORTH CREEK', y: y + 2.42, height: 0.8 }, { ...common, text: 'RIDE UP · SLIDE DOWN · SINCE 1934', y: y + 1.74, height: 0.56 });
  }
  return { walls, panes, signs };
}
