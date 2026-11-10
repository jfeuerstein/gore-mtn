import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { trailAt } from './trails';
import { buildWorld } from './world';

// These run against the real generated files in public/world, so a bad pipeline run fails here.
const read = (name: string) => readFileSync(new URL(`../../public/world/${name}`, import.meta.url));
const toArrayBuffer = (b: Buffer): ArrayBuffer => b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer;
const world = buildWorld(
  JSON.parse(read('world.json').toString()),
  toArrayBuffer(read('height.bin')),
  toArrayBuffer(read('trailmask.bin')),
);
const place = (id: string) => {
  const p = world.places.find((q) => q.id === id);
  if (!p) throw new Error(`missing place ${id}`);
  return p;
};

describe('generated world', () => {
  it('has the landmarks the game depends on', () => {
    for (const id of ['base-lodge', 'saddle-lodge', 'summit', 'ski-bowl-lodge', 'depot']) place(id);
  });

  it('puts the summit near its real elevation of about 3,600 ft', () => {
    const ft = world.realElevationM(place('summit').y) * 3.28084;
    expect(ft).toBeGreaterThan(3500);
    expect(ft).toBeLessThan(3650);
  });

  it('orders the landmarks by height the way the real mountain does', () => {
    const y = (id: string) => world.source.heightAt(place(id).x, place(id).z);
    expect(y('summit')).toBeGreaterThan(y('saddle-lodge'));
    expect(y('saddle-lodge')).toBeGreaterThan(y('base-lodge'));
    expect(y('base-lodge')).toBeGreaterThan(y('ski-bowl-lodge'));
    expect(y('ski-bowl-lodge')).toBeGreaterThan(y('depot'));
  });

  it('includes the well-known trails and lifts by name', () => {
    const trails = new Set(world.trails.map((t) => t.name));
    for (const name of ['Sunway', 'Ruby Run', 'Quicksilver', 'Otter Slide', 'Foxlair', 'Twister', 'Showcase', 'The Rumor', 'Lies']) {
      expect(trails, name).toContain(name);
    }
    const lifts = new Set(world.lifts.map((l) => l.name));
    for (const name of ['Northwoods Gondola', 'Adirondack Express']) expect(lifts, name).toContain(name);
  });

  it('runs every trail downhill and every lift uphill', () => {
    const h = (pts: number[], i: number) => world.source.heightAt(pts.at(i) as number, pts.at(i + 1) as number);
    for (const t of world.trails.filter((t) => !t.area)) expect(h(t.pts, 0), String(t.name)).toBeGreaterThanOrEqual(h(t.pts, -2));
    for (const l of world.lifts) expect(h(l.pts, 0), String(l.name)).toBeLessThanOrEqual(h(l.pts, -2));
  });

  it('finds groomed snow near each lodge on the mountain, and none in town', () => {
    for (const id of ['base-lodge', 'saddle-lodge', 'summit', 'ski-bowl-lodge']) {
      const p = place(id);
      const spot = world.nearestTrailSpot(p.x, p.z, 90);
      expect(spot, id).not.toBeNull();
      if (spot) {
        expect(world.onTrail(spot.x, spot.z)).toBe(true);
        expect(world.trailDistance(spot.x, spot.z)).toBe(0);
        expect(Math.hypot(spot.x - p.x, spot.z - p.z)).toBeLessThanOrEqual(90);
      }
    }
    expect(world.nearestTrailSpot(place('depot').x, place('depot').z, 90)).toBeNull();
  });

  it('measures distance to the nearest trail', () => {
    expect(world.trailDistance(world.source.minX + 5, world.source.minZ + 5)).toBeGreaterThan(100);
  });

  it('marks groomed trails in the mask and leaves forest unmarked', () => {
    const sunway = world.trails.find((t) => t.name === 'Sunway' && !t.area);
    if (!sunway) throw new Error('no Sunway centre line');
    const mid = Math.floor(sunway.pts.length / 4) * 2;
    const x = sunway.pts[mid] as number;
    const z = sunway.pts[mid + 1] as number;
    expect(world.onTrail(x, z)).toBe(true);
    expect(trailAt(world.trails, x, z)).not.toBeNull();
    expect(world.onTrail(world.source.minX + 5, world.source.minZ + 5)).toBe(false);
    const covered = world.trailMask.reduce((n, v) => n + (v > 0 ? 1 : 0), 0) / world.trailMask.length;
    expect(covered).toBeGreaterThan(0.02);
    expect(covered).toBeLessThan(0.25);
  });
});
