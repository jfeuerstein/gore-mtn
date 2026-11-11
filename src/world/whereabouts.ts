import type { Whereabouts } from '../game/people';
import { PLACE_FOOTPRINT } from './placeSizes';
import { OPEN_WATER, type World } from './world';

/** A point a distance along a line of x, z pairs, clamped to its ends. */
function pointAlongLine(pts: readonly number[], distance: number): { x: number; z: number; dx: number; dz: number } {
  let left = Math.max(0, distance);
  for (let i = 0; i + 3 < pts.length; i += 2) {
    const ax = pts[i] as number;
    const az = pts[i + 1] as number;
    const bx = pts[i + 2] as number;
    const bz = pts[i + 3] as number;
    const seg = Math.hypot(bx - ax, bz - az);
    if (left <= seg || i + 5 >= pts.length) {
      const t = seg > 0 ? Math.min(1, left / seg) : 0;
      return { x: ax + (bx - ax) * t, z: az + (bz - az) * t, dx: seg > 0 ? (bx - ax) / seg : 1, dz: seg > 0 ? (bz - az) / seg : 0 };
    }
    left -= seg;
  }
  return { x: pts[0] as number, z: pts[1] as number, dx: 1, dz: 0 };
}

function lineLength(pts: readonly number[]): number {
  let total = 0;
  for (let i = 0; i + 3 < pts.length; i += 2) total += Math.hypot((pts[i + 2] as number) - (pts[i] as number), (pts[i + 3] as number) - (pts[i + 1] as number));
  return total;
}

/** The nearest dry ground to a point: the point itself unless it is in water, then the closest shore. */
function dryLand(world: World, x: number, z: number): { x: number; z: number } {
  if (world.openAt(x, z) !== OPEN_WATER) return { x, z };
  for (let r = 6; r <= 240; r += 6) {
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2;
      const px = x + Math.cos(a) * r;
      const pz = z + Math.sin(a) * r;
      if (world.openAt(px, pz) !== OPEN_WATER) return { x: px + Math.cos(a) * 4, z: pz + Math.sin(a) * 4 };
    }
  }
  return { x, z };
}

/**
 * Where something is in the world, from a description of it: by a building's door, at a named
 * spot, at the foot of a lift or under its line, at the edge of a trail, or along a road. Null if
 * the thing named is not on the map. No three.js here.
 */
export function locate(world: World, at: Whereabouts): { x: number; z: number } | null {
  if ('place' in at) {
    const place = world.places.find((p) => p.id === at.place);
    if (!place) return null;
    const [w, d] = PLACE_FOOTPRINT[place.id] ?? [8, 6];
    // By the door, which is on the south wall a little west of the middle; a tower has none, so
    // just south of it. The depot's platform and its roof posts run along that side, so stand beyond them.
    return { x: place.x - w * 0.12 + 3, z: place.z + d / 2 + (place.id === 'depot' ? 10.5 : 4.5) };
  }
  if ('spot' in at) {
    const spot = [...world.spots, ...world.ponds].find((s) => s.id === at.spot);
    return spot ? dryLand(world, spot.x + 5, spot.z + 3) : null;
  }
  if ('lift' in at) {
    const lift = world.lifts.find((l) => l.name === at.lift);
    if (!lift) return null;
    const along = at.along ?? 0;
    const p = pointAlongLine(lift.pts, lineLength(lift.pts) * along);
    // At the foot, stand beside the loading gate; up the line, lie under the cable.
    const side = along === 0 ? 7 : 2;
    return { x: p.x - p.dz * side - p.dx * (along === 0 ? 3 : 0), z: p.z + p.dx * side - p.dz * (along === 0 ? 3 : 0) };
  }
  if ('trail' in at) {
    const pieces = world.trails.filter((t) => t.name === at.trail && !t.area).sort((a, b) => b.pts.length - a.pts.length);
    const trail = pieces[0];
    if (!trail) return null;
    const p = pointAlongLine(trail.pts, lineLength(trail.pts) * at.along);
    // At the trail's edge, where a dropped thing would be swept to.
    const side = Math.max(3, trail.width / 2 - 3);
    return { x: p.x - p.dz * side, z: p.z + p.dx * side };
  }
  const from = world.places.find((p) => p.id === at.from);
  const roads = world.roads.filter((r) => r.name === at.road);
  if (!from || roads.length === 0) return null;
  // The piece of the road that passes closest to the starting place, and where along it that is.
  let best: { pts: number[]; index: number; d: number } | null = null;
  for (const road of roads) {
    for (let i = 0; i + 1 < road.pts.length; i += 2) {
      const d = Math.hypot((road.pts[i] as number) - from.x, (road.pts[i + 1] as number) - from.z);
      if (!best || d < best.d) best = { pts: road.pts, index: i, d };
    }
  }
  if (!best) return null;
  // Walk along it toward the south, where the town lies, as far as asked or to the end of the piece.
  const { pts, index } = best;
  const southward = (pts.at(-1) as number) >= (pts[1] as number);
  const ahead = southward ? pts.slice(index) : pts.slice(0, index + 2).reduce<number[]>((acc, _, i, all) => (i % 2 === 0 ? [all[i] as number, all[i + 1] as number, ...acc] : acc), []);
  const p = pointAlongLine(ahead, at.metres);
  // On the pavement, not in the road.
  return { x: p.x - p.dz * 7, z: p.z + p.dx * 7 };
}
