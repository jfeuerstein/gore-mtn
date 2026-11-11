import { describe, expect, it } from 'vitest';
import { trailAt } from './trails';
import { loadTestWorld } from './testWorld';
import { OPEN_LAND, OPEN_WATER } from './world';

// These run against the real generated files in public/world, so a bad pipeline run fails here.
const world = loadTestWorld();
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
      const spot = world.nearestTrailSpot(p.x, p.z, 225);
      expect(spot, id).not.toBeNull();
      if (spot) {
        expect(world.onTrail(spot.x, spot.z)).toBe(true);
        expect(world.trailDistance(spot.x, spot.z)).toBe(0);
        expect(Math.hypot(spot.x - p.x, spot.z - p.z)).toBeLessThanOrEqual(225);
      }
    }
    expect(world.nearestTrailSpot(place('depot').x, place('depot').z, 225)).toBeNull();
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

  it('knows the town: roads, houses, ponds and lookouts, all inside the map', () => {
    expect(world.roads.length).toBeGreaterThan(100);
    expect(world.roads.some((r) => r.name === 'Main Street')).toBe(true);
    expect(world.buildings.length).toBeGreaterThan(300);
    const hf = world.source;
    for (const b of world.buildings) {
      expect(b.x).toBeGreaterThanOrEqual(hf.minX);
      expect(b.x).toBeLessThanOrEqual(hf.maxX);
      expect(b.z).toBeGreaterThanOrEqual(hf.minZ);
      expect(b.z).toBeLessThanOrEqual(hf.maxZ);
      expect(b.w).toBeGreaterThanOrEqual(3);
      expect(b.d).toBeGreaterThanOrEqual(3);
      expect(Math.abs(b.y - hf.heightAt(b.x, b.z))).toBeLessThan(3);
    }
    expect(world.ponds.map((p) => p.id)).toContain('rabbit-pond');
    expect(world.spots.filter((s) => s.kind === 'viewpoint').map((s) => s.id).sort()).toEqual(['scenic-view', 'twister-cliffs', 'vermont-overlook', 'windy-hill-lookout']);
    expect(world.spots.filter((s) => s.kind === 'quarry').map((s) => s.id).sort()).toEqual(['barton-mine', 'garnet-quarry']);
  });

  it('keeps forest off roads, lots and water, and marks the Hudson as water', () => {
    const depot = world.places.find((p) => p.id === 'depot');
    if (!depot) throw new Error('no depot');
    // The depot stands on its own lot.
    expect(world.openAt(depot.x, depot.z)).toBe(OPEN_LAND);
    for (const b of world.buildings.slice(0, 80)) expect(world.openAt(b.x, b.z), `${b.x},${b.z}`).not.toBe(0);
    const pond = world.ponds.find((p) => p.id === 'rabbit-pond');
    if (!pond) throw new Error('no pond');
    expect(world.openAt(pond.x, pond.z)).toBe(OPEN_WATER);
    const hudson = world.water.find((w) => w.kind === 'river');
    if (!hudson) throw new Error('no river');
    let wet = 0;
    let inside = 0;
    for (let i = 0; i + 1 < hudson.pts.length; i += 2) {
      const [x, z] = [hudson.pts[i] as number, hudson.pts[i + 1] as number];
      if (x < world.source.minX || x > world.source.maxX || z < world.source.minZ || z > world.source.maxZ) continue;
      inside++;
      if (world.openAt(x, z) === OPEN_WATER) wet++;
    }
    expect(inside).toBeGreaterThan(2);
    expect(wet).toBe(inside);
    // Deep woods are neither.
    const summit = world.places.find((p) => p.id === 'summit');
    expect(world.openAt((summit?.x ?? 0) - 300, (summit?.z ?? 0) - 300)).toBe(0);
  });

  it('puts hardwoods on the lower slopes and spruce and fir at the top', () => {
    const at = (id: string) => {
      const p = world.places.find((q) => q.id === id);
      if (!p) throw new Error(id);
      return world.hardwoodAt(p.x, p.z);
    };
    expect(at('summit')).toBeLessThan(0.1);
    expect(at('depot')).toBeGreaterThan(0.6);
    expect(at('ski-bowl-lodge')).toBeGreaterThan(0.6);
    expect(at('base-lodge')).toBeGreaterThan(at('saddle-lodge'));
    for (let i = 0; i < 200; i++) {
      const share = world.hardwoodAt(world.source.minX + (i * 277) % world.source.width, world.source.minZ + (i * 191) % world.source.depth);
      expect(share).toBeGreaterThanOrEqual(0);
      expect(share).toBeLessThanOrEqual(1);
    }
  });
});
