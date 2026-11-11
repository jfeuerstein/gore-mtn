import { buildRoute, routePoint } from './crowd';
import type { Road } from './trails';

/**
 * The streets that are drawn as streets: where people live and park, the road has a surface of
 * its own laid over the ground, and Main Street has a sidewalk down each side. Everywhere else
 * a road is only what the ground picture shows of it. No three.js here.
 */

/** A part of the map whose roads are surfaced: round a point, out to a distance. */
export interface Zone {
  x: number;
  z: number;
  reach: number;
  /** Whether this is the town, where the high street has sidewalks. */
  town?: boolean;
}

/** A length of road to be surfaced: points along its middle, close together, and how wide it is. */
export interface Strip {
  /** Flat list of x, z pairs, `STEP` apart. */
  pts: number[];
  /** Half the width of the roadway, in metres. */
  half: number;
  /** True for the high street in town: it has a sidewalk down each side. */
  sidewalks: boolean;
}

/** The street with the sidewalks. */
export const HIGH_STREET = 'Main Street';
/** Metres between one cross-section of a surface and the next: half a cell of the ground, so the surface lies close to it. */
export const STEP = 1.7;
/** Half the width of a roadway, by the kind of road the map says it is. Tracks through the woods are not surfaced. */
const HALF: Record<string, number> = { primary: 3.4, tertiary: 3.1, residential: 2.7, unclassified: 2.6, service: 2.3 };
/** The high street's roadway, and where its sidewalk begins and ends, from the middle of the street. */
export const HIGH_STREET_HALF = 3.3;
export const SIDEWALK = { from: 3.9, to: 5.6 };

/** Every length of road inside a zone, stepped along closely. */
export function streetStrips(roads: readonly Road[], zones: readonly Zone[]): Strip[] {
  const strips: Strip[] = [];
  for (const road of roads) {
    const high = road.name === HIGH_STREET;
    const half = high ? HIGH_STREET_HALF : HALF[road.kind];
    if (half === undefined || road.pts.length < 4) continue;
    const route = buildRoute(road.pts);
    let run: number[] = [];
    let inTown = false;
    const end = (): void => {
      if (run.length >= 6) strips.push({ pts: run, half, sidewalks: high && inTown });
      run = [];
    };
    const steps = Math.max(1, Math.ceil(route.length / STEP));
    for (let i = 0; i <= steps; i++) {
      const at = routePoint(route, (i / steps) * route.length);
      const zone = zones.find((zn) => Math.hypot(at.x - zn.x, at.z - zn.z) < zn.reach);
      if (!zone) {
        end();
        continue;
      }
      // A street does not change from having sidewalks to not having them in the middle of a strip.
      if (run.length > 0 && Boolean(zone.town) !== inTown) end();
      inTown = Boolean(zone.town);
      run.push(at.x, at.z);
    }
    end();
  }
  return strips;
}

/** Something that stands along a street: where, which way it is turned, and a number of its own for what it looks like. */
export interface Kerbside {
  x: number;
  z: number;
  turn: number;
  roll: number;
}

/** A repeatable number in 0..1 from two others. */
function roll(a: number, b: number): number {
  let h = (Math.imul(Math.round(a * 7) + 1, 374761393) ^ Math.imul(Math.round(b * 7) + 1, 668265263)) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177) >>> 0;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/**
 * Places along the sidewalked strips, every so often, a set distance from the middle of the
 * street: for poles, parked cars and hydrants.
 * @param every metres between one and the next
 * @param aside metres from the middle of the street; negative for the other side
 * @param keep the share of places kept, the rest left empty (for parked cars: a street is never full)
 * @param clear true where something may stand
 * @param which the strips it applies to: those with sidewalks, unless told otherwise
 */
export function alongStreet(strips: readonly Strip[], every: number, aside: number, keep: number, clear: (x: number, z: number) => boolean, offset = 0, which: (strip: Strip) => boolean = (strip) => strip.sidewalks): Kerbside[] {
  const out: Kerbside[] = [];
  for (const strip of strips) {
    if (!which(strip)) continue;
    const route = buildRoute(strip.pts);
    for (let d = every / 2 + offset; d < route.length - 4; d += every) {
      const a = routePoint(route, d - 1);
      const b = routePoint(route, d + 1);
      const len = Math.hypot(b.x - a.x, b.z - a.z) || 1;
      const fx = (b.x - a.x) / len;
      const fz = (b.z - a.z) / len;
      const at = routePoint(route, d);
      const x = at.x - fz * aside;
      const z = at.z + fx * aside;
      const r = roll(x, z);
      if (r > keep || !clear(x, z)) continue;
      // Turned to lie along the street: its own +z is the way the street runs.
      out.push({ x, z, turn: Math.atan2(fx, fz), roll: roll(z, x) });
    }
  }
  return out;
}
