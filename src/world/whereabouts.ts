import type { Whereabouts } from '../game/people';
import { fromLocal } from './footprints';
import { PLACE_FOOTPRINT } from './placeSizes';
import { depotSetting } from './railway';
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

/** A name as an id: lower case, words joined by hyphens. The same rule the terrain pipeline uses. */
export function slug(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .split(' ')
    .join('-');
}

/** Ground steeper than this is no place to stand about, in degrees. */
const TOO_STEEP = 16;

/**
 * The nearest ground to a point where someone could stand: dry, and not on a steep face. The
 * point itself if it will do; otherwise the closest that will. A pond's middle becomes its
 * shore, and the bottom of a quarry becomes its rim.
 */
function standable(world: World, x: number, z: number): { x: number; z: number } {
  const good = (px: number, pz: number): boolean => world.openAt(px, pz) !== OPEN_WATER && world.source.slopeDegAt(px, pz) < TOO_STEEP;
  if (good(x, z)) return { x, z };
  for (let r = 6; r <= 300; r += 6) {
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2;
      // A step past the edge, so as not to stand on the brink.
      const px = x + Math.cos(a) * (r + 4);
      const pz = z + Math.sin(a) * (r + 4);
      if (good(x + Math.cos(a) * r, z + Math.sin(a) * r) && good(px, pz)) return { x: px, z: pz };
    }
  }
  return { x, z };
}

/**
 * Everything on the map with a name and a single position: lookouts and shops, ponds, and the
 * buildings that have names. Buildings go by the name written as an id (`slug`).
 */
export function namedSpots(world: World): { id: string; name: string; x: number; z: number }[] {
  return [
    ...world.spots,
    ...world.ponds,
    ...world.buildings.flatMap((b) => (b.name === undefined ? [] : [{ id: slug(b.name), name: b.name, x: b.x, z: b.z }])),
  ].map((s) => ({ id: s.id, name: s.name, x: s.x, z: s.z }));
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
    // The depot lies along the rails. Its conductor waits off the end of the platform, by the engine.
    const depot = place.id === 'depot' ? depotSetting(world) : null;
    if (depot?.rails) return fromLocal(depot, 15.6 + (at.aside ?? 0), 5.2);
    const [w, d] = PLACE_FOOTPRINT[place.id] ?? [8, 6];
    // By the door, which is on the south wall a little west of the middle; a tower has none, so
    // just south of it. The depot's platform and its roof posts run along that side, so stand beyond them.
    return { x: place.x - w * 0.12 + 3 + (at.aside ?? 0), z: place.z + d / 2 + (place.id === 'depot' ? 10.5 : 4.5) };
  }
  if ('spot' in at) {
    const spot = [...world.spots, ...world.ponds].find((s) => s.id === at.spot);
    if (spot) return standable(world, spot.x + 5, spot.z + 3);
    // A building with a name: by its front, on the side its longer wall faces the nearest road... or simply south of it.
    const building = world.buildings.find((b) => b.name !== undefined && slug(b.name) === at.spot);
    return building ? standable(world, building.x, building.z + Math.max(building.w, building.d) / 2 + 5) : null;
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
