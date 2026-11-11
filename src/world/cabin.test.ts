import { describe, expect, it } from 'vitest';
import { CABIN, cabinSite, cabinSpots } from './cabin';
import { loadTestWorld } from './testWorld';
import { distToPolyline } from './trails';

describe("the cabin's plot", () => {
  const world = loadTestWorld();
  const site = cabinSite(world.buildings, world.places, world.trails);

  it('is a small building by itself, a short way from the Base Lodge', () => {
    expect(site).not.toBeNull();
    if (!site) return;
    const base = world.places.find((p) => p.id === 'base-lodge');
    const far = Math.hypot(site.x - (base?.x ?? 0), site.z - (base?.z ?? 0));
    expect(far).toBeGreaterThan(150);
    expect(far).toBeLessThan(600);
    expect(world.buildings.filter((b, i) => i !== site.building && Math.hypot(b.x - site.x, b.z - site.z) < 100)).toHaveLength(0);
  });

  it('is beside a trail and faces it, so the way home is on skis', () => {
    if (!site) return;
    const nearest = Math.min(...world.trails.filter((t) => !t.area).map((t) => distToPolyline(site.x, site.z, t.pts)));
    expect(nearest).toBeLessThan(40);
    // A step out of the front door is nearer the trail than a step out of the back.
    const { yard } = cabinSpots(site);
    const fromYard = Math.min(...world.trails.filter((t) => !t.area).map((t) => distToPolyline(yard.x, yard.z, t.pts)));
    expect(fromYard).toBeLessThan(nearest);
  });

  it('stands on ground level enough to build on, clear of water', () => {
    if (!site) return;
    const hf = world.source;
    const heights = [-1, 1].flatMap((sx) => [-1, 1].map((sz) => hf.heightAt(site.x + (sx * CABIN.w) / 2, site.z + (sz * CABIN.d) / 2)));
    expect(Math.max(...heights) - Math.min(...heights)).toBeLessThan(3);
  });

  it('has its door, its yard and its feeder in front of it, in that order outward or to the side', () => {
    if (!site) return;
    const spots = cabinSpots(site);
    const out = (p: { x: number; z: number }): number => (p.x - site.x) * Math.sin(site.turn) + (p.z - site.z) * Math.cos(site.turn);
    expect(out(spots.door)).toBeGreaterThan(CABIN.d / 2 + CABIN.porch);
    expect(out(spots.yard)).toBeGreaterThan(out(spots.door));
    expect(out(spots.feeder)).toBeGreaterThan(CABIN.d / 2);
  });
});
