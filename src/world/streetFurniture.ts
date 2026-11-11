import type * as THREE from 'three/webgpu';
import { blocks, placed, type Block } from './shapes';
import type { SignSpec } from './signs';
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
