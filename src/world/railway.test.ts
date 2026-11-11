import { describe, expect, it } from 'vitest';
import { nearestOnLines } from './footprints';
import { depotSetting, TRACK_OUT, TRAIN, TRAIN_LENGTH, trainCars } from './railway';
import { loadTestWorld } from './testWorld';
import { locate } from './whereabouts';

const world = loadTestWorld();
const depot = depotSetting(world);
const cars = trainCars(world);

describe('the depot and the Snow Train', () => {
  it('stands the depot on the real station plot, along the rails', () => {
    expect(depot?.rails).toBe(true);
    if (!depot) return;
    expect(depot.building).toBeGreaterThanOrEqual(0);
    const rail = nearestOnLines(world.rails, depot.x, depot.z);
    expect(rail?.dist).toBeCloseTo(TRACK_OUT, 0);
    // Its length lies along the track: its own x axis is the direction of the rails, one way or the other.
    const along = Math.cos(depot.turn) * (rail?.dx ?? 0) - Math.sin(depot.turn) * (rail?.dz ?? 0);
    expect(Math.abs(along)).toBeGreaterThan(0.99);
    // And it is still at the depot the map names.
    const place = world.places.find((p) => p.id === 'depot');
    expect(Math.hypot((place?.x ?? 0) - depot.x, (place?.z ?? 0) - depot.z)).toBeLessThan(60);
  });

  it('stands every car of the train on the rails, in a line, without overlapping', () => {
    expect(cars.map((c) => c.kind)).toEqual(TRAIN.map((c) => c.kind));
    for (const car of cars) expect(nearestOnLines(world.rails, car.x, car.z)?.dist, car.kind).toBeLessThan(2.5);
    for (let i = 1; i < cars.length; i++) {
      const a = cars[i - 1];
      const b = cars[i];
      if (!a || !b) continue;
      expect(Math.hypot(a.x - b.x, a.z - b.z)).toBeGreaterThan((a.length + b.length) / 2);
    }
    const first = cars[0];
    const last = cars[cars.length - 1];
    if (first && last) expect(Math.hypot(first.x - last.x, first.z - last.z)).toBeLessThan(TRAIN_LENGTH);
  });

  it('keeps the conductor clear of the station and the train, on dry land', () => {
    const bea = locate(world, { place: 'depot' });
    expect(bea).not.toBeNull();
    if (!bea || !depot) return;
    // In the depot's own frame: off the end of the building, short of the track.
    const dx = bea.x - depot.x;
    const dz = bea.z - depot.z;
    const lx = dx * Math.cos(depot.turn) - dz * Math.sin(depot.turn);
    const lz = dx * Math.sin(depot.turn) + dz * Math.cos(depot.turn);
    expect(Math.abs(lx)).toBeGreaterThan(13.5);
    expect(lz).toBeLessThan(TRACK_OUT - 2.2);
    expect(world.openAt(bea.x, bea.z)).not.toBe(2);
  });
});
