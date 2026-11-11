import type * as THREE from 'three/webgpu';
import { fromLocal } from './footprints';
import type { Car } from './railway';
import { blocks, placed, type Block } from './shapes';
import type { SignSpec } from './signs';
import type { Flue } from './smoke';

/**
 * The Snow Train, standing at the North Creek depot: a small black engine with a garnet-red cab,
 * a tender and two green coaches. Built from blocks like everything else, and joined into the
 * town's own meshes, so the whole train costs no draw calls of its own. Its windows and
 * headlamp are lit with the town's.
 */
const BLACK = 0x22262d;
const IRON = 0x15171b;
const GARNET = 0x8f1d2c;
const BRASS = 0xd9a441;
const GREEN = 0x2f5a44;
const CREAM = 0xece4d0;

/** Wheels along both sides of a car: big ones for an engine's drivers, small ones in pairs for the rest. */
function wheels(at: readonly number[], size: number, colour: number): Block[] {
  return at.flatMap((x): Block[] => [-1, 1].map((side): Block => ({ size: [size, size, 0.28], at: [x, size / 2 + 0.05, side * 1.12], colour })));
}

function engine(): { list: Block[]; panes: Block[] } {
  return {
    list: [
      { size: [8.4, 0.45, 2.1], at: [0, 1.25, 0], colour: IRON },
      // The boiler, with a narrower strip along the top to round it off.
      { size: [5.2, 1.8, 1.8], at: [1.1, 2.35, 0], colour: BLACK },
      { size: [5.2, 0.35, 1.2], at: [1.1, 3.4, 0], colour: BLACK },
      { size: [0.5, 2, 2], at: [3.85, 2.35, 0], colour: 0x2f343c },
      // Stack, with a lip; a brass dome and a brass bell.
      { size: [0.7, 1.3, 0.7], at: [3.1, 4.1, 0], colour: IRON },
      { size: [1, 0.3, 1], at: [3.1, 4.8, 0], colour: IRON },
      { size: [0.9, 0.7, 0.9], at: [1.5, 3.85, 0], colour: BRASS },
      { size: [0.5, 0.5, 0.5], at: [0.1, 3.75, 0], colour: BRASS },
      // The cab, in garnet red.
      { size: [2.5, 2.9, 2.5], at: [-2.75, 2.9, 0], colour: GARNET },
      { size: [3.1, 0.25, 2.9], at: [-2.75, 4.45, 0], colour: IRON },
      // The pilot at the front, and a red buffer beam behind it.
      { size: [1.3, 0.8, 2.1], at: [4.75, 0.75, 0], colour: 0xc8402d, tip: 0 },
      { size: [0.3, 0.7, 2.3], at: [4.15, 1.2, 0], colour: 0xc8402d },
      ...wheels([-0.9, 0.7, 2.3], 1.5, GARNET),
      ...wheels([3.7], 0.9, IRON),
      ...wheels([-2.9], 1, IRON),
    ],
    panes: [
      { size: [1.3, 0.9, 0.1], at: [-2.75, 3.4, 1.27], colour: 0xffffff },
      { size: [1.3, 0.9, 0.1], at: [-2.75, 3.4, -1.27], colour: 0xffffff },
      // The headlamp.
      { size: [0.12, 0.55, 0.55], at: [4.14, 3.6, 0], colour: 0xffffff },
    ],
  };
}

function tender(): { list: Block[]; panes: Block[] } {
  return {
    list: [
      { size: [4.4, 0.4, 2.1], at: [0, 1.2, 0], colour: IRON },
      { size: [4.2, 1.9, 2.4], at: [0, 2.35, 0], colour: BLACK },
      // Coal, heaped.
      { size: [3.4, 0.4, 1.8], at: [0.1, 3.45, 0], colour: 0x0e0f12 },
      { size: [1.8, 0.3, 1.2], at: [0.5, 3.75, 0], colour: 0x0e0f12 },
      ...wheels([-1.3, 1.3], 0.9, IRON),
    ],
    panes: [],
  };
}

function coach(length: number, roofColour: number): { list: Block[]; panes: Block[] } {
  const body = length - 0.9;
  const panes: Block[] = [];
  const count = 7;
  for (let i = 0; i < count; i++) {
    const x = -body / 2 + ((i + 0.5) * body) / count;
    for (const side of [-1, 1]) panes.push({ size: [1.05, 0.85, 0.1], at: [x, 3.05, side * 1.38], colour: 0xffffff });
  }
  return {
    list: [
      { size: [length - 0.2, 0.35, 2.3], at: [0, 1.15, 0], colour: IRON },
      // Green below and above, a cream band for the windows.
      { size: [body, 1.3, 2.7], at: [0, 1.95, 0], colour: GREEN },
      { size: [body, 1.05, 2.66], at: [0, 3.05, 0], colour: CREAM },
      { size: [body, 0.35, 2.7], at: [0, 3.75, 0], colour: GREEN },
      // The roof, with a raised lantern along the middle.
      { size: [body + 0.5, 0.25, 2.95], at: [0, 4.05, 0], colour: roofColour },
      { size: [body - 1.6, 0.4, 1.3], at: [0, 4.35, 0], colour: roofColour },
      // An open platform with a rail at each end.
      ...[-1, 1].flatMap((end): Block[] => [
        { size: [0.1, 0.9, 2.2], at: [end * (length / 2 - 0.1), 1.8, 0], colour: BRASS },
      ]),
      ...wheels([-body / 2 + 1.2, -body / 2 + 2.6, body / 2 - 2.6, body / 2 - 1.2], 0.9, IRON),
    ],
    panes,
  };
}

/**
 * @param heightAt the height of the ground, so each car sits on its own stretch of track
 * @param roofColour snow in winter, dark otherwise
 */
export function buildTrain(
  cars: readonly Car[],
  heightAt: (x: number, z: number) => number,
  roofColour: number,
): { walls: THREE.BufferGeometry[]; panes: THREE.BufferGeometry[]; signs: SignSpec[]; flues: Flue[] } {
  const flues: Flue[] = [];
  const walls: THREE.BufferGeometry[] = [];
  const panes: THREE.BufferGeometry[] = [];
  const signs: SignSpec[] = [];
  const winter = roofColour === 0xf2f5fa;
  for (const car of cars) {
    const model = car.kind === 'engine' ? engine() : car.kind === 'tender' ? tender() : coach(car.length, winter ? roofColour : 0x3a3f47);
    const y = heightAt(car.x, car.z) + 0.05;
    walls.push(placed(blocks(model.list), car.x, y, car.z, car.turn));
    if (model.panes.length > 0) panes.push(placed(blocks(model.panes), car.x, y, car.z, car.turn));
    // The engine is in steam, whatever the season.
    if (car.kind === 'engine') flues.push({ ...fromLocal(car, 3.1, 0), y: y + 5, size: 1.5 });
    if (car.kind === 'coach') {
      // Its name along both sides, in gold on green.
      for (const side of [1, -1]) {
        const at = fromLocal(car, 0, side * 1.36);
        signs.push({ text: 'SNOW TRAIN', x: at.x, y: y + 1.95, z: at.z, turn: car.turn + (side === 1 ? 0 : Math.PI), height: 0.62, maxWidth: 5, board: '#2f5a44', ink: '#f1d58a' });
      }
    }
  }
  return { walls, panes, signs, flues };
}
