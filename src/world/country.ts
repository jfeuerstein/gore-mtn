import type { Country } from '../game/wildlife';
import { distToPolyline } from './trails';
import type { World } from './world';

const CELL = 90;

/**
 * The world as wildlife sees it: what the ground is like, how far the town is, and how far it is
 * to a place by name. No three.js here.
 */
export function countryOf(world: World): Country {
  // Buildings by grid square, so the distance to the nearest is a look at a few squares.
  const cells = new Map<number, { x: number; z: number }[]>();
  for (const b of world.buildings) {
    const key = Math.floor(b.x / CELL) * 100003 + Math.floor(b.z / CELL);
    const list = cells.get(key);
    if (list) list.push(b);
    else cells.set(key, [b]);
  }
  // Things with names: trails, lifts, paths and water as lines; places, ponds and spots as points.
  const lines = new Map<string, number[][]>();
  const points = new Map<string, { x: number; z: number }[]>();
  const addLine = (name: string | null | undefined, pts: number[]): void => {
    if (!name) return;
    const list = lines.get(name);
    if (list) list.push(pts);
    else lines.set(name, [pts]);
  };
  for (const t of world.trails) addLine(t.name, t.pts);
  for (const l of world.lifts) addLine(l.name, l.pts);
  for (const p of world.paths) addLine(p.name, p.pts);
  for (const w of world.water) addLine(w.name, w.pts);
  for (const p of [...world.places, ...world.ponds, ...world.spots]) {
    for (const name of [p.id, p.name]) {
      const list = points.get(name);
      if (list) list.push(p);
      else points.set(name, [p]);
    }
  }

  return {
    trailDistance: (x, z) => world.trailDistance(x, z),
    slopeDegAt: (x, z) => world.source.slopeDegAt(x, z),
    openAt: (x, z) => world.openAt(x, z),
    hardwoodAt: (x, z) => world.hardwoodAt(x, z),
    townDistance(x, z) {
      let best = Infinity;
      const cx = Math.floor(x / CELL);
      const cz = Math.floor(z / CELL);
      for (let dx = -1; dx <= 1; dx++) {
        for (let dz = -1; dz <= 1; dz++) {
          for (const b of cells.get((cx + dx) * 100003 + cz + dz) ?? []) best = Math.min(best, Math.hypot(b.x - x, b.z - z));
        }
      }
      return best;
    },
    distanceTo(name, x, z) {
      let best = Infinity;
      for (const pts of lines.get(name) ?? []) best = Math.min(best, distToPolyline(x, z, pts));
      for (const p of points.get(name) ?? []) best = Math.min(best, Math.hypot(p.x - x, p.z - z));
      return best;
    },
  };
}
