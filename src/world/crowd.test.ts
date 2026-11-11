import { describe, expect, it } from 'vitest';
import { buildGliders, buildRoute, buildRuns, buildSeats, buildWalkers, busyness, gliderAt, MOST_GLIDERS, routePoint, streetSide, walkerAt, WALK_ASIDE } from './crowd';
import { buildLiftPath, carCount } from './lifts';
import { loadTestWorld } from './testWorld';
import { distToPolyline } from './trails';

const world = loadTestWorld();
const heightAt = (x: number, z: number): number => world.source.heightAt(x, z);
const runs = buildRuns(world.trails, heightAt);
const gliders = buildGliders(runs);

describe('the skiers on the trails', () => {
  it('are on real, named, groomed trails, and there are enough of them to notice but not to count', () => {
    expect(runs.length).toBeGreaterThan(20);
    for (const run of runs) expect(world.trails.some((t) => t.name === run.name && !t.glade && !t.area)).toBe(true);
    expect(gliders.length).toBeGreaterThan(30);
    expect(gliders.length).toBeLessThanOrEqual(MOST_GLIDERS);
    // The same ones on every load.
    expect(buildGliders(runs)).toEqual(gliders);
    if (process.env.CROWD_REPORT) console.log(`${runs.length} runs, ${gliders.length} skiers, ${buildSeats(world.lifts.map((l) => buildLiftPath(l, () => 0))).length} on the chairs`);
  });

  it('keep to the groomed width of their trail all the way down', () => {
    for (const g of gliders) {
      const run = runs[g.run];
      if (!run) throw new Error('no run');
      const trail = world.trails.find((t) => t.name === run.name && t.pts === run.pts);
      if (!trail) throw new Error('no trail');
      for (let clock = 0; clock < 400; clock += 7) {
        const now = gliderAt(run, g, clock);
        if (!now) continue;
        expect(distToPolyline(now.x, now.z, run.pts), run.name).toBeLessThanOrEqual(trail.width / 2 + 0.5);
        expect(now.size).toBeGreaterThanOrEqual(0);
        expect(now.size).toBeLessThanOrEqual(1);
        expect(Math.abs(now.lean)).toBeLessThan(0.4);
      }
    }
  });

  it('go down the hill, at a pace a person skis, and face the way they are going', () => {
    for (const g of gliders.slice(0, 20)) {
      const run = runs[g.run];
      if (!run) throw new Error('no run');
      // Find a moment in the middle of a run.
      let clock = 0;
      while (!gliderAt(run, g, clock) || !gliderAt(run, g, clock + 1) || (gliderAt(run, g, clock)?.size ?? 0) < 1) clock += 1;
      const a = gliderAt(run, g, clock);
      const b = gliderAt(run, g, clock + 1);
      if (!a || !b) throw new Error('not on the run');
      const speed = Math.hypot(b.x - a.x, b.z - a.z);
      expect(speed, run.name).toBeGreaterThan(4);
      expect(speed, run.name).toBeLessThan(20);
      // Downhill, taken over the whole run: a trail may have a flat or a rise in it.
      const top = routePoint(run, 0);
      const foot = routePoint(run, run.length);
      expect(heightAt(foot.x, foot.z), run.name).toBeLessThan(heightAt(top.x, top.z) - run.length * 0.05);
      // Facing within a quarter turn of the way they moved.
      const moved = Math.atan2(-(b.x - a.x), -(b.z - a.z));
      expect(Math.abs(Math.atan2(Math.sin(moved - a.yaw), Math.cos(moved - a.yaw)))).toBeLessThan(Math.PI / 2);
    }
  });

  it('are out of sight between runs, and all home by dark', () => {
    const g = gliders[0];
    const run = g && runs[g.run];
    if (!g || !run) throw new Error('nobody');
    let away = 0;
    for (let clock = 0; clock < 2000; clock += 1) if (!gliderAt(run, g, clock)) away++;
    expect(away).toBeGreaterThan(20);
    expect(busyness('night')).toBe(0);
    expect(busyness('day')).toBe(1);
    expect(busyness('dusk')).toBeLessThan(1);
  });
});

describe('the people on the chairs', () => {
  const paths = world.lifts.map((l) => buildLiftPath(l, (x, z) => world.source.heightAt(x, z)));
  const seats = buildSeats(paths);

  it('sit on chairs that exist, to either side of the middle, and never in a gondola or on a carpet', () => {
    expect(seats.length).toBeGreaterThan(10);
    for (const s of seats) {
      const path = paths[s.lift];
      if (!path) throw new Error('no lift');
      expect(path.surface || path.cabins).toBe(false);
      expect(s.slot).toBeLessThan(carCount(path));
      expect(Math.abs(s.aside)).toBeGreaterThan(0.5);
    }
    // No two in one seat.
    expect(new Set(seats.map((s) => `${s.lift}/${s.slot}/${s.aside}`)).size).toBe(seats.length);
    // Most chairs go up empty.
    const chairs = paths.filter((p) => !p.surface && !p.cabins).reduce((n, p) => n + carCount(p), 0);
    expect(seats.length).toBeLessThan(chairs * 0.6);
  });
});

describe('the people out walking', () => {
  const side = streetSide(world.roads, 'Main Street');

  it('have the side of Main Street to walk along, off the roadway', () => {
    if (!side) throw new Error('no Main Street');
    expect(side.length).toBeGreaterThan(200);
    const pieces = world.roads.filter((r) => r.name === 'Main Street');
    for (let d = 10; d < side.length - 10; d += 25) {
      const at = routePoint(side, d);
      const off = Math.min(...pieces.map((r) => distToPolyline(at.x, at.z, r.pts)));
      expect(off).toBeGreaterThan(WALK_ASIDE - 1.5);
      expect(off).toBeLessThan(WALK_ASIDE + 1.5);
    }
  });

  it('walk their own stretch there and back, stopping at each end', () => {
    const walkers = buildWalkers(4, 20, 420);
    expect(walkers.length).toBe(4);
    for (const w of walkers) {
      expect(w.from).toBeGreaterThanOrEqual(20);
      expect(w.to).toBeLessThanOrEqual(420 + 12);
      let stood = 0;
      let forward = 0;
      let back = 0;
      for (let clock = 0; clock < 900; clock += 0.5) {
        const now = walkerAt(w, clock);
        expect(now.distance).toBeGreaterThanOrEqual(w.from - 0.01);
        expect(now.distance).toBeLessThanOrEqual(w.to + 0.01);
        if (now.heading === 0) stood++;
        else if (now.heading === 1) forward++;
        else back++;
      }
      expect(stood).toBeGreaterThan(0);
      expect(forward).toBeGreaterThan(0);
      expect(back).toBeGreaterThan(0);
      // Never faster than a walk.
      const a = walkerAt(w, 100);
      const b = walkerAt(w, 100.5);
      expect(Math.abs(b.distance - a.distance)).toBeLessThan(1);
    }
  });

  it('measures a route by its length', () => {
    const r = buildRoute([0, 0, 3, 4, 3, 14]);
    expect(r.length).toBe(15);
    expect(routePoint(r, 5)).toEqual({ x: 3, z: 4 });
    expect(routePoint(r, 10)).toEqual({ x: 3, z: 9 });
    expect(routePoint(r, -5)).toEqual({ x: 0, z: 0 });
  });
});
