import type * as THREE from 'three/webgpu';
import type { Season } from '../look/season';
import { PLACE_FOOTPRINT } from './placeSizes';
import { blocks, placed, type Block } from './shapes';
import type { Place } from './trails';

/**
 * What stands outside a lodge: in the snow months a rack of skis by the door, the rest of the
 * year a couple of picnic tables. Geometry to be joined into the town's meshes.
 */
const TIMBER = 0x7a5232;
const SKI_PAINT = [0xd9a441, 0xc8402d, 0x2b62c9, 0x2f8a4e, 0xf4f1ea, 0x7a4ab0, 0xe8742a, 0x22262d];

/** The lodges with a yard, and which side of the door it is on (-1 west, 1 east). */
const YARDS: Record<string, number> = { 'base-lodge': -1, 'saddle-lodge': 1, 'ski-bowl-lodge': 1, 'gore-mountain-lodge': -1 };

/** A rail on two posts with skis leaned against it in pairs, tips up. It stands along its own x, skis on its +z side. */
function skiRack(pairs: number, seed: number): Block[] {
  const width = pairs * 0.5 + 0.4;
  const list: Block[] = [
    { size: [0.1, 1.3, 0.1], at: [-width / 2, 0.65, 0], colour: TIMBER },
    { size: [0.1, 1.3, 0.1], at: [width / 2, 0.65, 0], colour: TIMBER },
    { size: [width + 0.2, 0.1, 0.12], at: [0, 1.25, 0], colour: TIMBER },
  ];
  for (let i = 0; i < pairs; i++) {
    const colour = SKI_PAINT[(i * 3 + seed) % SKI_PAINT.length] as number;
    const x = -width / 2 + 0.45 + i * 0.5;
    // Leaning back onto the rail: feet out in front, tips resting above it.
    for (const dx of [-0.07, 0.07]) list.push({ size: [0.1, 1.75, 0.03], at: [x + dx, 0.86, 0.22], colour, tip: 0.24 });
  }
  return list;
}

/** A picnic table with a bench either side. */
function picnicTable(): Block[] {
  return [
    { size: [1.8, 0.07, 0.8], at: [0, 0.75, 0], colour: TIMBER },
    { size: [1.8, 0.06, 0.3], at: [0, 0.45, 0.62], colour: TIMBER },
    { size: [1.8, 0.06, 0.3], at: [0, 0.45, -0.62], colour: TIMBER },
    { size: [0.08, 0.75, 1.4], at: [-0.7, 0.375, 0], colour: 0x5a3e28 },
    { size: [0.08, 0.75, 1.4], at: [0.7, 0.375, 0], colour: 0x5a3e28 },
  ];
}

/**
 * @param settings where a lodge stands when not simply at its place (none of those with a yard are moved, but the door is found the same way)
 */
export function buildYards(places: readonly Place[], season: Season, heightAt: (x: number, z: number) => number): THREE.BufferGeometry[] {
  const out: THREE.BufferGeometry[] = [];
  places.forEach((place, n) => {
    const side = YARDS[place.id];
    const size = PLACE_FOOTPRINT[place.id];
    if (side === undefined || !size) return;
    const [w, d] = size;
    // The door is on the south wall, a little west of the middle (as `locate` has it).
    const doorX = place.x - w * 0.12;
    const wall = place.z + d / 2;
    if (season === 'winter' || season === 'spring') {
      // Against the wall, a few steps along from the door.
      const x = doorX + side * 6.5;
      out.push(placed(blocks(skiRack(place.id === 'base-lodge' ? 8 : 5, n)), x, heightAt(x, wall + 1.1), wall + 1.1, 0));
      if (place.id === 'base-lodge') {
        const x2 = doorX + side * 12.5;
        out.push(placed(blocks(skiRack(8, n + 3)), x2, heightAt(x2, wall + 1.1), wall + 1.1, 0));
      }
    } else {
      for (const [dx, dz, turn] of [
        [side * 7, 4.5, 0.2],
        [side * 11, 7, -0.3],
      ] as const) {
        const x = doorX + dx;
        const z = wall + dz;
        out.push(placed(blocks(picnicTable()), x, heightAt(x, z), z, turn));
      }
    }
  });
  return out;
}
