import { fromLocal } from './footprints';
import type { TownPlace, TownStyle } from './townPlaces';
import { insideBox } from './walls';
import { OPEN_WATER, type World } from './world';

/**
 * Street furniture for North Creek: lamps down Main Street, a bench by the doors people wait
 * at, and a welcome sign at each end of town. Where each stands is worked out from the map,
 * so it survives a regenerated world. No three.js here.
 */
export interface Fixture {
  x: number;
  z: number;
  /** Turn about the upright axis. A lamp's arm, a bench's seat and a sign's face are toward its own +z. */
  turn: number;
}

/** The street the lamps run down. */
const HIGH_STREET = 'Main Street';
/** Metres between lamps, and how far each stands from the middle of the road. */
const LAMP_SPACING = 44;
const LAMP_ASIDE = 5.2;

/** True where something could stand: on the map, dry, and not inside a building. */
function clear(world: World, x: number, z: number): boolean {
  const hf = world.source;
  if (x < hf.minX + 10 || x > hf.maxX - 10 || z < hf.minZ + 10 || z > hf.maxZ - 10) return false;
  if (world.openAt(x, z) === OPEN_WATER) return false;
  return !world.buildings.some((b) => insideBox(x, z, b, 1.5));
}

/** Lamps down both sides of the high street, turn about, each leaning over the road. */
export function streetLamps(world: World): Fixture[] {
  const lamps: Fixture[] = [];
  let side = 1;
  for (const road of world.roads) {
    if (road.name !== HIGH_STREET) continue;
    const p = road.pts;
    let next = LAMP_SPACING / 2;
    for (let i = 0; i + 3 < p.length; i += 2) {
      const ax = p[i] as number;
      const az = p[i + 1] as number;
      const len = Math.hypot((p[i + 2] as number) - ax, (p[i + 3] as number) - az);
      if (len === 0) continue;
      const dx = ((p[i + 2] as number) - ax) / len;
      const dz = ((p[i + 3] as number) - az) / len;
      for (; next <= len; next += LAMP_SPACING) {
        // To one side of the road, and facing back across it.
        const x = ax + dx * next - dz * side * LAMP_ASIDE;
        const z = az + dz * next + dx * side * LAMP_ASIDE;
        const turn = Math.atan2(dz * side, -dx * side);
        side = -side;
        // The map draws a street in several pieces, which can overlap: no two lamps in one spot.
        if (!clear(world, x, z) || lamps.some((l) => Math.hypot(l.x - x, l.z - z) < LAMP_SPACING * 0.6)) continue;
        lamps.push({ x, z, turn });
      }
      next -= len;
    }
  }
  return lamps;
}

/** A welcome at each end of the high street, a little in from where the map's street stops, facing whoever arrives. */
export function welcomeSigns(world: World): Fixture[] {
  const ends: { x: number; z: number; dx: number; dz: number }[] = [];
  for (const road of world.roads) {
    if (road.name !== HIGH_STREET || road.pts.length < 4) continue;
    const p = road.pts;
    const n = p.length;
    // Each end of each piece, with the direction that leads out of the piece there.
    ends.push({ x: p[0] as number, z: p[1] as number, dx: (p[0] as number) - (p[2] as number), dz: (p[1] as number) - (p[3] as number) });
    ends.push({ x: p[n - 2] as number, z: p[n - 1] as number, dx: (p[n - 2] as number) - (p[n - 4] as number), dz: (p[n - 1] as number) - (p[n - 3] as number) });
  }
  // The two ends of the whole street are the pair of piece-ends farthest apart.
  let best: [typeof ends[number], typeof ends[number]] | null = null;
  let bestDist = 0;
  for (const a of ends) {
    for (const b of ends) {
      const d = Math.hypot(a.x - b.x, a.z - b.z);
      if (d > bestDist) {
        bestDist = d;
        best = [a, b];
      }
    }
  }
  if (!best) return [];
  return best.flatMap((end): Fixture[] => {
    const len = Math.hypot(end.dx, end.dz) || 1;
    const ox = end.dx / len;
    const oz = end.dz / len;
    // Thirty metres back into town from the end, on the right of someone driving in.
    const x = end.x - ox * 30 + oz * 7;
    const z = end.z - oz * 30 - ox * 7;
    return clear(world, x, z) ? [{ x, z, turn: Math.atan2(ox, oz) }] : [];
  });
}

/** A stretch of road with water on both sides: a bridge, or for a short one a culvert with railings. */
export interface Bridge {
  /** The middle of the span, and the turn that lays its own x along the road. */
  x: number;
  z: number;
  turn: number;
  /** Length of the span in metres. */
  length: number;
}

/** How far to either side of the road is looked at for water, and the shortest span worth railings. */
const BANK = 7;
const SHORTEST_SPAN = 6;

/** Where the roads cross water: found from the map, wherever a road has water on both sides of it. */
export function bridges(world: World): Bridge[] {
  const out: Bridge[] = [];
  for (const road of world.roads) {
    // Tracks through the woods ford their brooks.
    if (road.kind === 'track') continue;
    const p = road.pts;
    let from: { x: number; z: number } | null = null;
    let last = { x: 0, z: 0 };
    const close = (): void => {
      if (!from) return;
      const length = Math.hypot(last.x - from.x, last.z - from.z) + 3;
      const mid = { x: (from.x + last.x) / 2, z: (from.z + last.z) / 2 };
      // The map draws a road both ways, or in pieces that meet: one bridge for each crossing.
      if (length >= SHORTEST_SPAN && !out.some((b) => Math.hypot(b.x - mid.x, b.z - mid.z) < Math.max(20, b.length))) {
        out.push({ ...mid, turn: Math.atan2(-(last.z - from.z), last.x - from.x), length });
      }
      from = null;
    };
    for (let i = 0; i + 3 < p.length; i += 2) {
      const ax = p[i] as number;
      const az = p[i + 1] as number;
      const len = Math.hypot((p[i + 2] as number) - ax, (p[i + 3] as number) - az);
      if (len === 0) continue;
      const dx = ((p[i + 2] as number) - ax) / len;
      const dz = ((p[i + 3] as number) - az) / len;
      for (let d = 0; d < len; d += 3) {
        const x = ax + dx * d;
        const z = az + dz * d;
        const wet = world.openAt(x - dz * BANK, z + dx * BANK) === OPEN_WATER && world.openAt(x + dz * BANK, z - dx * BANK) === OPEN_WATER;
        if (wet) {
          from ??= { x, z };
          last = { x, z };
        } else close();
      }
    }
    close();
  }
  return out;
}

/** A bench that can be sat on: where it is, which way it faces, and what the Book calls it. */
export interface Bench extends Fixture {
  id: string;
  name: string;
  /** True for a bench put where it is for what can be seen from it, rather than against a wall. */
  view?: boolean;
}

/** The kinds of place with a bench outside. */
const WITH_BENCH: readonly TownStyle[] = ['inn', 'postoffice', 'hall', 'church', 'cafe', 'deli', 'tavern', 'store', 'cabin'];

/** A sign's capitals as a name: "TOWN HALL & LIBRARY" to "Town Hall & Library". */
export const signName = (text: string): string =>
  text
    .toLowerCase()
    .replace(/(^|[\s·(])([a-z])/g, (_, before: string, letter: string) => before + letter.toUpperCase())
    // The little words in the middle of a name keep their small letters.
    .replace(/ (On|Of|The|And|In|At) /g, (word) => word.toLowerCase());

/** A name as it reads after "outside": "the Post Office", "the Inn on Gore", but "June's Bakery" as it is. */
const withThe = (name: string): string => (/'s /.test(name) ? name : `the ${name.replace(/^The /, '')}`);

/** A bench against the front wall of each place people wait at, to one side of the door, facing the street. */
export function benches(places: readonly TownPlace[]): Bench[] {
  return places
    .filter((p) => WITH_BENCH.includes(p.style))
    .map((p) => ({
      id: `bench:${p.id}`,
      name: p.sign ? `Outside ${withThe(signName(p.sign))}` : p.style === 'church' ? 'By the church door' : 'By the door',
      ...fromLocal(p, -Math.min(p.w / 2 - 1.2, 3.6), p.d / 2 + (p.style === 'inn' || p.style === 'cabin' || p.style === 'tavern' ? 1.2 : 0.9)),
      turn: p.turn,
    }));
}

/** Places on the mountain with a view worth sitting down for, besides the lookouts the map names. */
const VIEW_PLACES: Record<string, string> = { summit: 'At the fire tower', 'saddle-lodge': 'At the Saddle' };

/**
 * A bench at each lookout and at the high places, turned to face the way the ground falls away,
 * which is where the view is.
 */
export function viewBenches(world: World): Bench[] {
  const hf = world.source;
  const spots = [
    ...world.spots.filter((s) => s.kind === 'viewpoint').map((s) => ({ id: s.id, name: `At ${s.name}`, x: s.x, z: s.z })),
    ...world.places.filter((p) => p.id in VIEW_PLACES).map((p) => ({ id: p.id, name: VIEW_PLACES[p.id] as string, x: p.x - 9, z: p.z + 12 })),
  ];
  return spots.flatMap((spot): Bench[] => {
    // The nearest ground that is dry, clear of walls and not too steep to set a bench on.
    for (let ring = 0; ring < 6; ring++) {
      for (let k = 0; k < (ring === 0 ? 1 : 8); k++) {
        const a = (k / 8) * Math.PI * 2;
        const x = spot.x + Math.cos(a) * ring * 4;
        const z = spot.z + Math.sin(a) * ring * 4;
        if (!clear(world, x, z) || hf.slopeDegAt(x, z) > 14) continue;
        // Downhill is the way the height drops fastest.
        const gx = hf.heightAt(x + 6, z) - hf.heightAt(x - 6, z);
        const gz = hf.heightAt(x, z + 6) - hf.heightAt(x, z - 6);
        const turn = Math.hypot(gx, gz) > 0.05 ? Math.atan2(-gx, -gz) : 0;
        return [{ id: `bench:${spot.id}`, name: spot.name, x, z, turn, view: true }];
      }
    }
    return [];
  });
}
