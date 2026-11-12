import type { Lift } from './trails';

/** Lift maths with no three.js in it, so it runs under Vitest. */

/** Height of the cable above the ground at each tower, in metres. */
export const CABLE_HEIGHT = 12;
/** Distance between towers, in metres. */
export const TOWER_SPACING = 60;
/**
 * Chairs go up on the right of the towers and come down on the left, this far from the centre
 * line, so riders (and the camera behind them) pass beside each tower, not through it.
 */
export const LINE_OFFSET = 3.2;
/** How far below the cable a rider's feet hang. */
export const RIDER_DROP = 7;
/**
 * Ride speed in m/s. Far quicker than a real chairlift: the longest ride is about a minute, which
 * is long enough to rest and look around and short enough for a phone.
 */
export const LIFT_SPEED = 30;
/** Speed of a lift that pulls or carries riders along the snow: a magic carpet, a J-bar. */
export const SURFACE_SPEED = 7;
/** Distance between one chair or cabin and the next, in metres. */
export const CAR_SPACING = 48;

const SURFACE_KINDS = new Set(['magic_carpet', 'j-bar', 't-bar', 'platter', 'rope_tow', 'drag_lift']);
/** A lift can be boarded from within this distance of its bottom station. */
export const STATION_REACH = 30;

export interface LiftPath {
  lift: Lift;
  /** Points along the cable, one per tower, from the bottom station to the top: x, y, z triples. */
  points: number[];
  /** Distance along the cable to each point. */
  at: number[];
  length: number;
  /** True for a lift that keeps riders on the snow: no cable overhead, no towers, no chairs. */
  surface: boolean;
  /** True for a gondola, whose riders travel inside cabins. */
  cabins: boolean;
  /** How fast riders travel, in m/s. */
  speed: number;
}

/** Lay a lift's cable over the ground: a tower every TOWER_SPACING metres, the cable straight between them. */
export function buildLiftPath(lift: Lift, heightAt: (x: number, z: number) => number): LiftPath {
  const points: number[] = [];
  const at: number[] = [];
  let length = 0;
  const surface = SURFACE_KINDS.has(lift.kind);
  const add = (x: number, z: number): void => {
    const y = heightAt(x, z) + (surface ? 0 : CABLE_HEIGHT);
    const n = points.length;
    if (n > 0) length += Math.hypot(x - (points[n - 3] as number), y - (points[n - 2] as number), z - (points[n - 1] as number));
    points.push(x, y, z);
    at.push(length);
  };
  for (let i = 0; i + 3 < lift.pts.length; i += 2) {
    const ax = lift.pts[i] as number;
    const az = lift.pts[i + 1] as number;
    const bx = lift.pts[i + 2] as number;
    const bz = lift.pts[i + 3] as number;
    const steps = Math.max(1, Math.round(Math.hypot(bx - ax, bz - az) / TOWER_SPACING));
    for (let s = i === 0 ? 0 : 1; s <= steps; s++) add(ax + ((bx - ax) * s) / steps, az + ((bz - az) * s) / steps);
  }
  return { lift, points, at, length, surface, cabins: lift.kind === 'gondola', speed: surface ? SURFACE_SPEED : LIFT_SPEED };
}

/** Position on the cable a distance from the bottom station, and the yaw of travel there. */
export function pointAlong(path: LiftPath, distance: number): { x: number; y: number; z: number; yaw: number } {
  const d = Math.min(Math.max(distance, 0), path.length);
  let i = 0;
  while (i < path.at.length - 2 && (path.at[i + 1] as number) < d) i++;
  const a = i * 3;
  const b = a + 3;
  const span = (path.at[i + 1] as number) - (path.at[i] as number) || 1;
  const t = (d - (path.at[i] as number)) / span;
  const p = path.points;
  const ax = p[a] as number;
  const az = p[a + 2] as number;
  const bx = p[b] as number;
  const bz = p[b + 2] as number;
  return {
    x: ax + (bx - ax) * t,
    y: (p[a + 1] as number) + ((p[b + 1] as number) - (p[a + 1] as number)) * t,
    z: az + (bz - az) * t,
    yaw: Math.atan2(-(bx - ax), -(bz - az)),
  };
}

/** The yaw of the lift line at one of its towers, taken from the towers either side. */
export function towerYaw(path: LiftPath, tower: number): number {
  const n = path.points.length / 3;
  const a = Math.max(0, tower - 1) * 3;
  const b = Math.min(n - 1, tower + 1) * 3;
  const p = path.points;
  return Math.atan2(-((p[b] as number) - (p[a] as number)), -((p[b + 2] as number) - (p[a + 2] as number)));
}

/**
 * Where a rider going up is, a distance from the bottom station: their feet, and the way they face.
 * On a chair or in a cabin that is below the cable, to the right of the towers. On a surface lift
 * it is on the snow along the line.
 */
export function riderAlong(path: LiftPath, distance: number): { x: number; y: number; z: number; yaw: number } {
  const at = pointAlong(path, distance);
  if (path.surface) return at;
  // The skier's right for a yaw is (cos, -sin) in x and z.
  return { x: at.x + Math.cos(at.yaw) * LINE_OFFSET, y: at.y - RIDER_DROP, z: at.z - Math.sin(at.yaw) * LINE_OFFSET, yaw: at.yaw };
}

/** How many chairs or cabins travel up a lift (as many again come down). None on a surface lift. */
export function carCount(path: LiftPath): number {
  return path.surface ? 0 : Math.max(1, Math.ceil(path.length / CAR_SPACING));
}

/**
 * How far up the cable a car is at a moment on the lift clock (seconds). Cars are evenly spaced
 * and move at the lift's speed; one that passes the top station comes round again at the bottom.
 * A distance beyond the lift's length means the car is between the stations' ends, out of sight.
 */
export function carDistance(path: LiftPath, slot: number, clock: number): number {
  const loop = carCount(path) * CAR_SPACING;
  return (((slot * CAR_SPACING + clock * path.speed) % loop) + loop) % loop;
}

/**
 * Where a rider who boards now starts from: the position of the car just leaving the bottom
 * station, so that they ride on a chair that is really there.
 */
export function boardingDistance(path: LiftPath, clock: number): number {
  if (path.surface) return 0;
  return (((clock * path.speed) % CAR_SPACING) + CAR_SPACING) % CAR_SPACING;
}

/** The lift whose bottom station is nearest the position, if any is within STATION_REACH. */
export function stationNear(paths: readonly LiftPath[], x: number, z: number, reach = STATION_REACH): LiftPath | null {
  let best: LiftPath | null = null;
  let bestDist = reach;
  for (const path of paths) {
    const d = Math.hypot((path.points[0] as number) - x, (path.points[2] as number) - z);
    if (d <= bestDist) {
      bestDist = d;
      best = path;
    }
  }
  return best;
}

/** Trees are kept this far back from a lift line, and further back from its stations. */
export const LINE_CLEARING = 10;
export const STATION_CLEARING = 24;

/**
 * Whether a position lies in the corridor cut through the forest for a lift: near its line, or
 * nearer still to one of its stations.
 */
export function inLiftClearing(paths: readonly LiftPath[], x: number, z: number): boolean {
  for (const path of paths) {
    // A surface lift runs along the snow and needs no corridor of its own beyond the trail it is on.
    if (path.surface) continue;
    const p = path.points;
    const last = p.length - 3;
    if (Math.hypot((p[0] as number) - x, (p[2] as number) - z) < STATION_CLEARING) return true;
    if (Math.hypot((p[last] as number) - x, (p[last + 2] as number) - z) < STATION_CLEARING) return true;
    for (let i = 0; i < last; i += 3) {
      const ax = p[i] as number;
      const az = p[i + 2] as number;
      const bx = p[i + 3] as number;
      const bz = p[i + 5] as number;
      // Cheap rejection first: most trees are nowhere near this span.
      if (x < Math.min(ax, bx) - LINE_CLEARING || x > Math.max(ax, bx) + LINE_CLEARING) continue;
      if (z < Math.min(az, bz) - LINE_CLEARING || z > Math.max(az, bz) + LINE_CLEARING) continue;
      const abx = bx - ax;
      const abz = bz - az;
      const t = Math.min(1, Math.max(0, ((x - ax) * abx + (z - az) * abz) / (abx * abx + abz * abz || 1)));
      if (Math.hypot(x - (ax + abx * t), z - (az + abz * t)) < LINE_CLEARING) return true;
    }
  }
  return false;
}

/** The beam over a lift's gate: where it is, and how high, in the world's own heights. */
export interface GateBeam {
  x: number;
  z: number;
  /** Half its length, across the line. */
  half: number;
  /** The way across the line, as a unit vector. */
  ax: number;
  az: number;
  bottom: number;
  top: number;
}

/**
 * The beam over each lift's gate: two posts and a beam 7 m up, square to the line, at the
 * bottom station. It is walked under, so it is no wall, but a camera following someone
 * about the foot of a lift sits at just that height, and must be kept from sitting on it.
 */
export function gateBeams(paths: readonly LiftPath[]): GateBeam[] {
  return paths.flatMap((path) => {
    const p = path.points;
    if (p.length < 6) return [];
    const run = Math.hypot((p[3] as number) - (p[0] as number), (p[5] as number) - (p[2] as number)) || 1;
    const dx = ((p[3] as number) - (p[0] as number)) / run;
    const dz = ((p[5] as number) - (p[2] as number)) / run;
    const ground = (p[1] as number) - (path.surface ? 0 : CABLE_HEIGHT);
    return [{ x: p[0] as number, z: p[2] as number, half: 4.8, ax: dz, az: -dx, bottom: ground + 6.6, top: ground + 7.4 }];
  });
}

/**
 * How far a camera at (x, y, z) must be lifted to clear a gate's beam: nothing away from one,
 * and rising smoothly to the whole way over as it comes within `reach` metres of the beam.
 */
export function overBeam(beams: readonly GateBeam[], x: number, y: number, z: number, reach = 2.5): number {
  let lift = 0;
  for (const b of beams) {
    // Only a camera near the beam's own height is in its way.
    if (y < b.bottom - 1.2 || y > b.top + 1) continue;
    const along = (x - b.x) * b.ax + (z - b.z) * b.az;
    const across = (x - b.x) * -b.az + (z - b.z) * b.ax;
    const off = Math.hypot(Math.max(0, Math.abs(along) - b.half), across);
    if (off >= reach) continue;
    const near = 1 - off / reach;
    lift = Math.max(lift, (b.top + 1 - y) * near * near * (3 - 2 * near));
  }
  return lift;
}
