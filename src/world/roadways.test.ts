import { describe, expect, it } from 'vitest';
import { nearestOnLines } from './footprints';
import { alongStreet, HIGH_STREET, HIGH_STREET_HALF, SIDEWALK, STEP, streetStrips, type Zone } from './roadways';
import { loadTestWorld } from './testWorld';

const world = loadTestWorld();
const depot = world.places.find((p) => p.id === 'depot');
const base = world.places.find((p) => p.id === 'base-lodge');
if (!depot || !base) throw new Error('no depot or base lodge');
const zones: Zone[] = [{ x: depot.x, z: depot.z, reach: 800, town: true }, { x: base.x, z: base.z, reach: 430 }];
const strips = streetStrips(world.roads, zones);
const street = world.roads.filter((r) => r.name === HIGH_STREET);

describe('the streets that have a surface', () => {
  it('are the roads in town and at the foot of the mountain, stepped along closely, and nowhere else', () => {
    expect(strips.length).toBeGreaterThan(20);
    for (const strip of strips) {
      expect(strip.pts.length).toBeGreaterThanOrEqual(6);
      for (let i = 0; i + 3 < strip.pts.length; i += 2) {
        const step = Math.hypot((strip.pts[i + 2] as number) - (strip.pts[i] as number), (strip.pts[i + 3] as number) - (strip.pts[i + 1] as number));
        expect(step).toBeLessThanOrEqual(STEP + 0.01);
        expect(zones.some((zn) => Math.hypot((strip.pts[i] as number) - zn.x, (strip.pts[i + 1] as number) - zn.z) < zn.reach)).toBe(true);
      }
    }
    // No track through the woods is surfaced.
    const tracks = world.roads.filter((r) => r.kind === 'track');
    expect(tracks.length).toBeGreaterThan(0);
    expect(streetStrips(tracks, zones)).toEqual([]);
  });

  it('gives Main Street a sidewalk through town, and no other road one', () => {
    const walked = strips.filter((s) => s.sidewalks);
    expect(walked.length).toBeGreaterThan(0);
    const length = walked.reduce((n, s) => n + (s.pts.length / 2 - 1) * STEP, 0);
    expect(length).toBeGreaterThan(700);
    for (const s of walked) {
      expect(s.half).toBe(HIGH_STREET_HALF);
      for (let i = 0; i + 1 < s.pts.length; i += 10) expect(nearestOnLines(street, s.pts[i] as number, s.pts[i + 1] as number)?.dist ?? 9).toBeLessThan(0.01);
    }
    expect(SIDEWALK.from).toBeGreaterThan(HIGH_STREET_HALF);
  });

  it('stands things along the kerb at a set distance from the middle of the street, the same on every load', () => {
    const poles = alongStreet(strips, 36, -(SIDEWALK.to + 0.5), 1, () => true);
    expect(poles.length).toBeGreaterThan(15);
    for (const p of poles) expect(Math.abs((nearestOnLines(street, p.x, p.z)?.dist ?? 0) - (SIDEWALK.to + 0.5))).toBeLessThan(0.8);
    expect(alongStreet(strips, 36, -(SIDEWALK.to + 0.5), 1, () => true)).toEqual(poles);
    // A street is never parked full, and nothing stands where it may not.
    const cars = alongStreet(strips, 7.5, 2.3, 0.2, () => true);
    const spaces = alongStreet(strips, 7.5, 2.3, 1, () => true);
    expect(cars.length).toBeGreaterThan(8);
    expect(cars.length).toBeLessThan(spaces.length * 0.4);
    expect(alongStreet(strips, 7.5, 2.3, 1, () => false)).toEqual([]);
  });
});
