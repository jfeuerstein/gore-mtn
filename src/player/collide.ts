/** Bumping into round things, such as tree trunks. No three.js here, so it runs under Vitest. */

export interface Obstacle {
  x: number;
  z: number;
  radius: number;
}

export interface Bump {
  /** Where the mover ends up: just clear of the obstacle. */
  x: number;
  z: number;
  /** Unit direction from the obstacle to the mover. */
  nx: number;
  nz: number;
}

/** If a circle at (x, z) overlaps the obstacle, the nearest spot that does not, and which way that is. */
export function pushOut(x: number, z: number, radius: number, o: Obstacle): Bump | null {
  const dx = x - o.x;
  const dz = z - o.z;
  const reach = radius + o.radius;
  const distSq = dx * dx + dz * dz;
  if (distSq >= reach * reach) return null;
  const dist = Math.sqrt(distSq);
  // Dead centre has no direction to leave by; pick one.
  const nx = dist > 1e-6 ? dx / dist : 1;
  const nz = dist > 1e-6 ? dz / dist : 0;
  return { x: o.x + nx * reach, z: o.z + nz * reach, nx, nz };
}

/** Share of sideways speed kept when brushing past something. */
const GLANCE = 0.75;

/**
 * Velocity after a bump. The part heading into the obstacle is lost, and the rest is trimmed: a
 * glancing touch costs a little speed, a head-on one nearly all of it. Nothing bounces, and the
 * mover is never thrown or stopped dead unless they hit square on.
 */
export function deflect(vx: number, vz: number, bump: Bump): { vx: number; vz: number } {
  const into = vx * bump.nx + vz * bump.nz;
  // Already moving away: leave it alone.
  if (into >= 0) return { vx, vz };
  return { vx: (vx - into * bump.nx) * GLANCE, vz: (vz - into * bump.nz) * GLANCE };
}
