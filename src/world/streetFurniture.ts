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

const CHROME = 0xc9ced6;
const LAMP_GLASS = 0xf2d16b;
const TAIL_GLASS = 0xc8402d;
const SKI_PAINT = [0xc8402d, 0x2b62c9, 0xf2d16b, 0x4f8a3f];

/**
 * A parked car, its nose toward its own +z: one of three kinds (a saloon, a wagon with a long
 * roof, a pickup), each a body with a bonnet lower than its cabin, a band of glass round the
 * cabin under a roof of its own paint, wheels with hubs, bumpers and lamps. In winter there is
 * snow on the roof and the bonnet, and a wagon has skis on a rack.
 */
function car(roll: number, winter: boolean): Block[] {
  const paint = CAR_PAINT[Math.floor(roll * CAR_PAINT.length) % CAR_PAINT.length] as number;
  const kind = (roll * 7) % 1;
  const pickup = kind < 0.28;
  const wagon = !pickup && kind < 0.62;
  // The cabin: where it sits along the car and how long it is.
  const cabZ = pickup ? 0.35 : wagon ? -0.55 : -0.3;
  const cabLong = pickup ? 1.45 : wagon ? 2.7 : 2.0;
  const sill = 0.9;
  const top = pickup ? 1.52 : wagon ? 1.5 : 1.42;
  const list: Block[] = [
    // The body, sill to wheel arch, and the bonnet in front of the cabin.
    { size: [1.76, 0.52, 4.3], at: [0, 0.64, 0], colour: paint },
    { size: [1.66, 0.1, 2.15 - (cabZ + cabLong / 2)], at: [0, sill + 0.03, (2.15 + cabZ + cabLong / 2) / 2], colour: paint },
    // Glass all round, and the roof on it.
    { size: [1.58, top - sill - 0.08, cabLong], at: [0, (top + sill - 0.08) / 2, cabZ], colour: WINDSCREEN },
    { size: [1.64, 0.1, cabLong - 0.1], at: [0, top - 0.03, cabZ], colour: paint },
    // The posts at the corners of the glass, in the car's paint.
    ...[-1, 1].flatMap((sx) => [-1, 1].map((sz) => ({ size: [0.1, top - sill - 0.08, 0.1] as [number, number, number], at: [sx * 0.76, (top + sill - 0.08) / 2, cabZ + sz * (cabLong / 2 - 0.05)] as [number, number, number], colour: paint }))),
    // Bumpers, lamps in front, lamps behind.
    { size: [1.82, 0.16, 0.14], at: [0, 0.46, 2.17], colour: CHROME },
    { size: [1.82, 0.16, 0.14], at: [0, 0.46, -2.17], colour: CHROME },
    { size: [0.34, 0.16, 0.06], at: [-0.6, 0.76, 2.16], colour: LAMP_GLASS },
    { size: [0.34, 0.16, 0.06], at: [0.6, 0.76, 2.16], colour: LAMP_GLASS },
    { size: [0.3, 0.14, 0.06], at: [-0.64, 0.78, -2.16], colour: TAIL_GLASS },
    { size: [0.3, 0.14, 0.06], at: [0.64, 0.78, -2.16], colour: TAIL_GLASS },
  ];
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      list.push({ size: [0.26, 0.68, 0.68], at: [sx * 0.8, 0.34, sz * 1.38], colour: RUBBER }, { size: [0.04, 0.3, 0.3], at: [sx * 0.94, 0.34, sz * 1.38], colour: CHROME });
    }
  }
  if (pickup) {
    // An open bed behind the cab: two sides and a tailgate.
    for (const sx of [-1, 1]) list.push({ size: [0.1, 0.36, 1.75], at: [sx * 0.83, sill + 0.14, -1.25], colour: paint });
    list.push({ size: [1.76, 0.36, 0.1], at: [0, sill + 0.14, -2.1], colour: paint });
    if (winter) list.push({ size: [1.5, 0.22, 1.65], at: [0, sill + 0.06, -1.25], colour: SNOW });
  } else if (!wagon) {
    // A saloon's boot, behind the glass.
    list.push({ size: [1.66, 0.1, cabZ - cabLong / 2 + 2.15], at: [0, sill + 0.03, (cabZ - cabLong / 2 - 2.15) / 2], colour: paint });
  }
  if (wagon) {
    // A rack on the roof, and in winter two pairs of skis on it.
    for (const sz of [-0.7, 0.7]) list.push({ size: [1.5, 0.05, 0.07], at: [0, top + 0.07, cabZ + sz], colour: RUBBER });
    if (winter) {
      [-0.42, -0.26, 0.26, 0.42].forEach((sx, i) => list.push({ size: [0.09, 0.04, 1.9], at: [sx, top + 0.12, cabZ - 0.1], colour: SKI_PAINT[(Math.floor(roll * 97) + (i >> 1)) % SKI_PAINT.length] as number }));
    }
  }
  if (winter) {
    // Snow on the roof (not under the skis) and on the bonnet.
    if (!wagon) list.push({ size: [1.5, 0.13, cabLong - 0.3], at: [0, top + 0.08, cabZ], colour: SNOW });
    list.push({ size: [1.5, 0.08, 0.9], at: [0, sill + 0.12, 1.55], colour: SNOW });
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

/** The flags' colours, in order along a string: all the print's own inks. */
const FLAGS = [0xc8402d, 0xf2d16b, 0xfbf8ee, 0x2b62c9, 0x4f8a3f, 0xd9772b];
/** How high on a lamp a string is tied, how far it sags in the middle, and how far apart its flags hang, in metres. */
const TIED = 4.25;
const SAG = 1.1;
const FLAG_EVERY = 1.15;

/**
 * Strings of flags hung lamp to lamp over the street, as one geometry: a dark cord and a
 * pennant every stride, each a flat colour. Coloured on its corners, and to be drawn two-sided.
 */
export function buildBunting(spans: readonly { from: Fixture; to: Fixture }[], heightAt: (x: number, z: number) => number): THREE.BufferGeometry {
  const positions: number[] = [];
  const normals: number[] = [];
  const colours: number[] = [];
  const paint = new THREE.Color();
  const face = (corners: number[][], colour: number, nx: number, nz: number): void => {
    paint.setHex(colour);
    for (const c of corners) {
      positions.push(c[0] as number, c[1] as number, c[2] as number);
      normals.push(nx, 0, nz);
      colours.push(paint.r, paint.g, paint.b);
    }
  };
  let flag = 0;
  for (const { from, to } of spans) {
    const ay = heightAt(from.x, from.z) + TIED;
    const by = heightAt(to.x, to.z) + TIED;
    const length = Math.hypot(to.x - from.x, to.z - from.z);
    const dx = (to.x - from.x) / length;
    const dz = (to.z - from.z) / length;
    // A point a way along the cord, which hangs in a curve.
    const at = (metres: number): number[] => {
      const t = metres / length;
      return [from.x + dx * metres, ay + (by - ay) * t - SAG * 4 * t * (1 - t), from.z + dz * metres];
    };
    const count = Math.floor(length / FLAG_EVERY);
    const first = (length - count * FLAG_EVERY) / 2;
    for (let n = 0; n < count; n++) {
      const a = at(first + n * FLAG_EVERY);
      const b = at(first + (n + 1) * FLAG_EVERY);
      // The cord, as a thin band.
      face([a, b, [b[0] as number, (b[1] as number) - 0.05, b[2] as number], a, [b[0] as number, (b[1] as number) - 0.05, b[2] as number], [a[0] as number, (a[1] as number) - 0.05, a[2] as number]], 0x2a2e36, -dz, dx);
      // A pennant under the middle of this stretch of it.
      const l = at(first + (n + 0.22) * FLAG_EVERY);
      const r = at(first + (n + 0.78) * FLAG_EVERY);
      const tip = [((l[0] as number) + (r[0] as number)) / 2, ((l[1] as number) + (r[1] as number)) / 2 - 0.72, ((l[2] as number) + (r[2] as number)) / 2];
      face([l, r, tip], FLAGS[flag++ % FLAGS.length] as number, -dz, dx);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colours, 3));
  return geometry;
}
