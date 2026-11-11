import { describe, expect, it } from 'vitest';
import { nearestOnLines } from './footprints';
import { benches, streetLamps, viewBenches, welcomeSigns } from './streets';
import { loadTestWorld } from './testWorld';
import { resolveTownPlaces } from './townPlaces';
import { insideBox } from './walls';

const world = loadTestWorld();
const mainStreet = world.roads.filter((r) => r.name === 'Main Street');

describe('street furniture', () => {
  const lamps = streetLamps(world);
  it('lines the high street with lamps, beside the road and clear of the houses', () => {
    expect(lamps.length).toBeGreaterThan(15);
    expect(lamps.length).toBeLessThan(90);
    for (const lamp of lamps) {
      const road = nearestOnLines(mainStreet, lamp.x, lamp.z);
      expect(road?.dist).toBeGreaterThan(3);
      expect(road?.dist).toBeLessThan(8);
      expect(world.buildings.some((b) => insideBox(lamp.x, lamp.z, b))).toBe(false);
      // Its arm reaches toward the road, not away from it.
      const toward = Math.sin(lamp.turn) * ((road?.x ?? 0) - lamp.x) + Math.cos(lamp.turn) * ((road?.z ?? 0) - lamp.z);
      expect(toward).toBeGreaterThan(0);
    }
  });

  it('keeps lamps apart', () => {
    for (const a of lamps) for (const b of lamps) if (a !== b) expect(Math.hypot(a.x - b.x, a.z - b.z)).toBeGreaterThan(20);
  });

  it('welcomes people at the ends of the street, facing out of town', () => {
    const signs = welcomeSigns(world);
    expect(signs.length).toBeGreaterThanOrEqual(1);
    expect(signs.length).toBeLessThanOrEqual(2);
    for (const s of signs) expect(nearestOnLines(mainStreet, s.x, s.z)?.dist).toBeLessThan(12);
  });

  it('puts a bench outside the doors people wait at, against the front wall', () => {
    const places = resolveTownPlaces(world);
    const seats = benches(places);
    expect(seats.length).toBeGreaterThan(5);
    for (const seat of seats) {
      const place = places.find((p) => Math.hypot(p.x - seat.x, p.z - seat.z) < Math.max(p.w, p.d));
      expect(place).toBeDefined();
      if (place) expect(insideBox(seat.x, seat.z, { x: place.x, z: place.z, w: place.w, d: place.d, turn: place.turn })).toBe(false);
    }
  });

  it('sets a bench at every lookout, on ground fit to sit on, facing the way the ground falls', () => {
    const seats = viewBenches(world);
    const lookouts = world.spots.filter((sp) => sp.kind === 'viewpoint');
    expect(lookouts.length).toBeGreaterThanOrEqual(4);
    expect(seats.length).toBe(lookouts.length + 2);
    expect(new Set(seats.map((b) => b.id)).size).toBe(seats.length);
    const hf = world.source;
    for (const seat of seats) {
      expect(hf.slopeDegAt(seat.x, seat.z), seat.id).toBeLessThanOrEqual(14);
      // A few steps the way it faces is no higher than where it stands.
      const ahead = hf.heightAt(seat.x + Math.sin(seat.turn) * 8, seat.z + Math.cos(seat.turn) * 8);
      expect(ahead, seat.id).toBeLessThanOrEqual(hf.heightAt(seat.x, seat.z) + 0.3);
      expect(seat.name.length).toBeGreaterThan(5);
    }
  });

  it('names every bench in town after the door it stands by', () => {
    const seats = benches(resolveTownPlaces(world));
    expect(new Set(seats.map((b) => b.id)).size).toBe(seats.length);
    expect(seats.some((b) => b.name === 'Outside Post Office')).toBe(true);
    for (const seat of seats) expect(seat.name).toMatch(/^(Outside|By) /);
  });
});
