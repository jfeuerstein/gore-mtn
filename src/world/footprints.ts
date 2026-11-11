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

/**
 * A footprint moved back from a street it stands too close to: made shallower from the front,
 * so that its front wall is at least `gap` from the middle of the street and its back wall stays
 * where it was. The map's plots are true, but the game's streets need room for a sidewalk.
 * @param b a footprint already turned so that its own +z faces the street
 */
export function setBack<T extends { x: number; z: number; w: number; d: number; turn: number }>(b: T, street: readonly { pts: number[] }[], gap: number): T {
  const sin = Math.sin(b.turn);
  const cos = Math.cos(b.turn);
  let out = b;
  // A plot that stands askew to the street gains less than it gives up, so it is asked more than once.
  for (let pass = 0; pass < 5; pass++) {
    // How near the street the front wall comes, taken at a few points along it.
    let nearest = Infinity;
    for (const along of [-0.5, -0.25, 0, 0.25, 0.5]) {
      const at = nearestOnLines(street, out.x + along * out.w * cos + (out.d / 2) * sin, out.z - along * out.w * sin + (out.d / 2) * cos);
      if (at) nearest = Math.min(nearest, at.dist);
    }
    if (nearest >= gap || out.d <= 5) break;
    const d = Math.max(Math.min(out.d, 5), out.d - (gap - nearest) - 0.05);
    const back = (out.d - d) / 2;
    out = { ...out, d, x: out.x - sin * back, z: out.z - cos * back };
  }
  return out;
}
