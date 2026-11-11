import type * as THREE from 'three/webgpu';
import type { Season } from '../look/season';
import { PLACE_FOOTPRINT } from './placeSizes';
import { blocks, placed, type Block } from './shapes';
import type { SignSpec } from './signs';
import type { Lift, Place } from './trails';

/**
 * What makes the foot of a ski hill look like one, beyond its buildings: the roped lanes
 * where a lift line forms, a fire with chairs round it, and a big painted map of the trails.
 * Geometry to be joined into the town's meshes.
 */
const TIMBER = 0x6b4530;
const STONE = 0x7d8494;
const ROPE = 0xe8742a;
/** A course so tall that whatever is given it has none: rope, paint and flame are smooth, not boarded. */
const SMOOTH = 1e6;

/** Lifts that people queue for. Nobody queues for a carpet. */
const QUEUED = new Set(['chair_lift', 'gondola']);

/** The lanes behind a lift's loading gate: rows of posts with a rope along each, three lanes wide. */
function corral(lift: Lift, heightAt: (x: number, z: number) => number): Block[] {
  const run = Math.hypot((lift.pts[2] as number) - (lift.pts[0] as number), (lift.pts[3] as number) - (lift.pts[1] as number)) || 1;
  const dx = ((lift.pts[2] as number) - (lift.pts[0] as number)) / run;
  const dz = ((lift.pts[3] as number) - (lift.pts[1] as number)) / run;
  const turn = Math.atan2(dx, dz);
  /** A point in the station's own frame: x across the line, z up it. */
  const at = (lx: number, lz: number): [number, number] => [(lift.pts[0] as number) + lx * dz + lz * dx, (lift.pts[1] as number) - lx * dx + lz * dz];
  const list: Block[] = [];
  for (const lx of [-3.3, -1.1, 1.1, 3.3]) {
    let last: [number, number, number] | null = null;
    for (let lz = -3; lz >= -13.5; lz -= 3.5) {
      const [x, z] = at(lx, lz);
      const y = heightAt(x, z);
      list.push({ size: [0.12, 1.15, 0.12], at: [x, y + 0.57, z], colour: 0x2a2e36, turn });
      if (last) {
        const len = Math.hypot(x - last[0], y - last[1], z - last[2]);
        list.push({ size: [0.05, 0.05, len], at: [(x + last[0]) / 2, (y + last[1]) / 2 + 1.02, (z + last[2]) / 2], colour: ROPE, turn: Math.atan2(x - last[0], z - last[2]), tip: -Math.asin((y - last[1]) / len) });
      }
      last = [x, y, z];
    }
  }
  return list;
}

/** A slatted chair with a high back, facing its own +z, at a place in the world. */
function chair(x: number, y: number, z: number, turn: number, colour: number): Block[] {
  const c = Math.cos(turn);
  const s = Math.sin(turn);
  const at = (lx: number, ly: number, lz: number): [number, number, number] => [x + lx * c + lz * s, y + ly, z - lx * s + lz * c];
  return [
    { size: [0.62, 0.07, 0.6], at: at(0, 0.34, 0.05), colour, turn, tip: -0.18 },
    { size: [0.62, 0.9, 0.07], at: at(0, 0.7, -0.3), colour, turn, tip: -0.32 },
    { size: [0.1, 0.06, 0.7], at: at(-0.36, 0.56, 0.02), colour, turn },
    { size: [0.1, 0.06, 0.7], at: at(0.36, 0.56, 0.02), colour, turn },
    { size: [0.08, 0.5, 0.08], at: at(-0.34, 0.27, 0.3), colour, turn },
    { size: [0.08, 0.5, 0.08], at: at(0.34, 0.27, 0.3), colour, turn },
  ];
}

/** A fire in a ring of stones, with chairs drawn up round it. The glow goes with the windows, so it shows after dark. */
function firePit(x: number, z: number, heightAt: (x: number, z: number) => number): { list: Block[]; glow: Block[] } {
  const y = heightAt(x, z);
  const list: Block[] = [
    { size: [2.3, 0.5, 2.3], at: [x, y + 0.2, z], colour: STONE },
    { size: [2.3, 0.5, 2.3], at: [x, y + 0.2, z], colour: 0x737a88, turn: Math.PI / 4 },
    { size: [1.5, 0.52, 1.5], at: [x, y + 0.22, z], colour: 0x3a3430 },
    { size: [0.22, 0.22, 1.3], at: [x, y + 0.56, z], colour: 0x54463a, turn: 0.5 },
    { size: [0.22, 0.22, 1.3], at: [x, y + 0.6, z], colour: 0x54463a, turn: 2.1 },
    { size: [0.5, 0.75, 0.5], at: [x - 0.08, y + 0.95, z + 0.05], colour: 0xe8742a, turn: 0.6 },
    { size: [0.3, 0.6, 0.3], at: [x + 0.12, y + 1.05, z - 0.08], colour: 0xf2c14e, turn: 0.2 },
  ];
  const paint = [0x2f5a44, 0xa8392b, 0xd9a441, 0x2b4a7a, 0xa8392b, 0x2f5a44];
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + 0.3;
    const cx = x + Math.sin(a) * 3.3;
    const cz = z + Math.cos(a) * 3.3;
    // Facing the fire.
    list.push(...chair(cx, heightAt(cx, cz), cz, a + Math.PI, paint[i] as number));
  }
  return { list, glow: [{ size: [0.42, 0.5, 0.42], at: [x, y + 0.92, z], colour: 0xffffff }] };
}

/**
 * The big map: a painted board under a little roof, with every trail on it. It is built facing
 * its own +x, so that the lines painted on it can lie at any slant, and then turned.
 */
function mapBoard(snow: boolean): Block[] {
  const list: Block[] = [
    { size: [0.26, 4.4, 0.26], at: [0, 2.2, -3], colour: TIMBER },
    { size: [0.26, 4.4, 0.26], at: [0, 2.2, 3], colour: TIMBER },
    { size: [0.14, 3.1, 5.8], at: [0, 2.45, 0], colour: 0xf1ead8 },
    { size: [0.2, 0.16, 6.1], at: [0, 0.86, 0], colour: TIMBER },
    { size: [1.3, 0.16, 6.9], at: [0, 4.42, 0], colour: snow ? 0xf2f5fa : 0x3f5a4a },
    // The mountain, in a pale wash, with the sky over it.
    { size: [0.02, 1.1, 5.6], at: [0.075, 3.4, 0], colour: 0xcfe0ee },
    { size: [0.02, 0.5, 3.4], at: [0.08, 3.05, 0.2], colour: 0xdfe6ea },
    { size: [0.02, 0.4, 1.6], at: [0.085, 3.4, 0.5], colour: 0xdfe6ea },
  ];
  // The trails, fanning down from the top: green, blue, black, and the lift lines in red.
  const paint = [0x2f8a4e, 0x2b62c9, 0x22262d, 0x2b62c9, 0x2f8a4e, 0x22262d, 0x2f8a4e, 0x2b62c9, 0x22262d];
  for (let i = 0; i < 9; i++) {
    const slant = (i - 4) * 0.19;
    const len = 1.5 + (i % 3) * 0.3;
    list.push({ size: [0.03, 0.07, len], at: [0.1, 2.25 + (i % 2) * 0.12, 0.3 + (i - 4) * 0.46], colour: paint[i] as number, tip: Math.PI / 2 - slant });
  }
  for (const z of [-1.4, 0.9]) list.push({ size: [0.03, 0.04, 2.2], at: [0.105, 2.35, z], colour: 0xc8402d, tip: Math.PI / 2 - (z < 0 ? -0.5 : 0.35) });
  // You are here.
  list.push({ size: [0.04, 0.2, 0.2], at: [0.11, 1.25, 0.2], colour: 0xc8402d });
  return list;
}

/**
 * @returns geometry for the walls mesh and the windows mesh, the signs to be painted, and
 * where each fire is (for smoke)
 */
export function buildResort(
  places: readonly Place[],
  lifts: readonly Lift[],
  heightAt: (x: number, z: number) => number,
  season: Season,
): { walls: THREE.BufferGeometry[]; panes: THREE.BufferGeometry[]; signs: SignSpec[]; fires: { x: number; y: number; z: number }[] } {
  const walls: THREE.BufferGeometry[] = [];
  const panes: THREE.BufferGeometry[] = [];
  const signs: SignSpec[] = [];
  const fires: { x: number; y: number; z: number }[] = [];
  const ropes: Block[] = [];
  for (const lift of lifts) if (QUEUED.has(lift.kind) && lift.pts.length >= 4) ropes.push(...corral(lift, heightAt));
  if (ropes.length > 0) walls.push(blocks(ropes, [], SMOOTH));

  // A fire outside each lodge at the foot of the hill, on the side the mountain is.
  for (const [id, dx, dz] of [['base-lodge', -33, -3], ['ski-bowl-lodge', 17, 13], ['saddle-lodge', -17, 10]] as const) {
    const place = places.find((p) => p.id === id);
    if (!place) continue;
    const fire = firePit(place.x + dx, place.z + dz, heightAt);
    walls.push(blocks(fire.list, [], SMOOTH));
    panes.push(blocks(fire.glow));
    fires.push({ x: place.x + dx, y: heightAt(place.x + dx, place.z + dz) + 1.5, z: place.z + dz });
  }

  // The trail map, out in front of the Base Lodge where people arrive.
  const base = places.find((p) => p.id === 'base-lodge');
  const size = PLACE_FOOTPRINT['base-lodge'];
  if (base && size) {
    const x = base.x + 6;
    const z = base.z + size[1] / 2 + 15;
    const y = heightAt(x, z);
    // Built facing its own +x; a quarter turn sets it facing south, toward whoever is walking up.
    walls.push(placed(blocks(mapBoard(season === 'winter'), [], SMOOTH), x, y, z, -Math.PI / 2));
    signs.push({ text: 'TRAIL MAP', x, y: y + 4.0, z: z + 0.1, turn: 0, height: 0.55, maxWidth: 3.4, board: '#2f5a44', ink: '#f1d58a' });
  }
  return { walls, panes, signs, fires };
}
