import { distSqToSegment } from './trails';

/** Small geometry for buildings and the lines they stand beside. No three.js here. */

/** The point nearest to a position on any of a set of lines, and the direction of the line there. */
export function nearestOnLines(lines: readonly { pts: number[] }[], x: number, z: number): { x: number; z: number; dx: number; dz: number; dist: number } | null {
  let best: { x: number; z: number; dx: number; dz: number; dist: number } | null = null;
  let bestSq = Infinity;
  for (const line of lines) {
    const p = line.pts;
    for (let i = 0; i + 3 < p.length; i += 2) {
      const ax = p[i] as number;
      const az = p[i + 1] as number;
      const bx = p[i + 2] as number;
      const bz = p[i + 3] as number;
      const sq = distSqToSegment(x, z, ax, az, bx, bz);
      if (sq >= bestSq) continue;
      const len = Math.hypot(bx - ax, bz - az);
      if (len === 0) continue;
      bestSq = sq;
      const t = Math.min(1, Math.max(0, ((x - ax) * (bx - ax) + (z - az) * (bz - az)) / (len * len)));
      best = { x: ax + (bx - ax) * t, z: az + (bz - az) * t, dx: (bx - ax) / len, dz: (bz - az) / len, dist: Math.sqrt(sq) };
    }
  }
  return best;
}

/**
 * A footprint turned so that its own +z side is the one that faces a point (its road). The
 * width and depth swap when a short side is the front.
 */
export function faceToward(b: { x: number; z: number; w: number; d: number; turn: number }, tx: number, tz: number): { w: number; d: number; turn: number } {
  const dx = tx - b.x;
  const dz = tz - b.z;
  // The footprint's own axes, as three.js turns a model: x along (cos, -sin), z along (sin, cos).
  const alongX = dx * Math.cos(b.turn) - dz * Math.sin(b.turn);
  const alongZ = dx * Math.sin(b.turn) + dz * Math.cos(b.turn);
  if (Math.abs(alongZ) >= Math.abs(alongX)) return alongZ >= 0 ? { w: b.w, d: b.d, turn: b.turn } : { w: b.w, d: b.d, turn: b.turn + Math.PI };
  return alongX >= 0 ? { w: b.d, d: b.w, turn: b.turn + Math.PI / 2 } : { w: b.d, d: b.w, turn: b.turn - Math.PI / 2 };
}

/** A point given in a building's own frame (x along its front, z out from it), in the world. */
export function fromLocal(at: { x: number; z: number; turn: number }, lx: number, lz: number): { x: number; z: number } {
  const cos = Math.cos(at.turn);
  const sin = Math.sin(at.turn);
  return { x: at.x + lx * cos + lz * sin, z: at.z - lx * sin + lz * cos };
}
