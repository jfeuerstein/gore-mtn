export type Difficulty = 'easy' | 'intermediate' | 'advanced' | 'expert' | 'freeride';

export interface Trail {
  name: string | null;
  difficulty: Difficulty;
  glade: boolean;
  /** True when `pts` outlines an open slope rather than tracing a centre line. */
  area: boolean;
  /** Groomed width in game metres. Zero for glades. */
  width: number;
  /** Flat list of x, z pairs, running from the top of the trail to the bottom. */
  pts: number[];
}

export interface Lift {
  name: string | null;
  kind: string;
  /** Flat list of x, z pairs, running from the bottom station to the top. */
  pts: number[];
}

export interface Place {
  id: string;
  name: string;
  x: number;
  y: number;
  z: number;
}

/** A hiking, biking or cross-country path through the woods. */
export interface Path {
  name: string;
  /** Flat list of x, z pairs. */
  pts: number[];
}

export interface Road {
  name: string | null;
  kind: string;
  pts: number[];
}

/** A building's footprint, as a box. */
export interface Footprint {
  x: number;
  y: number;
  z: number;
  /** Width along its longest wall and depth across, in metres. */
  w: number;
  d: number;
  /** Turn about the upright axis that lays the width along that wall. */
  turn: number;
  kind: string | null;
  name?: string;
}

/** Somewhere with a name: a lookout, a pond, a quarry, a shop. */
export interface NamedSpot {
  id: string;
  name: string;
  kind?: string;
  x: number;
  y: number;
  z: number;
}

export const DIFFICULTY_MARK: Record<Difficulty, string> = {
  easy: '●',
  intermediate: '■',
  advanced: '◆',
  expert: '◆◆',
  freeride: '▲',
};

/** Squared distance from a point to a line segment, in the horizontal plane. */
export function distSqToSegment(px: number, pz: number, ax: number, az: number, bx: number, bz: number): number {
  const abx = bx - ax;
  const abz = bz - az;
  const lenSq = abx * abx + abz * abz;
  let t = lenSq === 0 ? 0 : ((px - ax) * abx + (pz - az) * abz) / lenSq;
  t = t < 0 ? 0 : t > 1 ? 1 : t;
  const dx = px - (ax + abx * t);
  const dz = pz - (az + abz * t);
  return dx * dx + dz * dz;
}

export function distToPolyline(px: number, pz: number, pts: readonly number[]): number {
  let best = Infinity;
  for (let i = 0; i + 3 < pts.length; i += 2) {
    const d = distSqToSegment(px, pz, pts[i] as number, pts[i + 1] as number, pts[i + 2] as number, pts[i + 3] as number);
    if (d < best) best = d;
  }
  return Math.sqrt(best);
}

/**
 * The named trail the point is standing on, if any. A point counts as on a trail when it is
 * within half the groomed width of the centre line, plus `slack` metres. Glades have no groomed
 * width, so only `slack` applies to them.
 */
export function trailAt(trails: readonly Trail[], px: number, pz: number, slack = 3): Trail | null {
  let best: Trail | null = null;
  let bestScore = Infinity;
  for (const t of trails) {
    if (!t.name) continue;
    const d = distToPolyline(px, pz, t.pts);
    const reach = t.width / 2 + slack;
    if (d > reach) continue;
    const score = d / reach;
    if (score < bestScore) {
      bestScore = score;
      best = t;
    }
  }
  return best;
}
