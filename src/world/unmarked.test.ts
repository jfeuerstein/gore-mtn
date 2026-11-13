import { describe, expect, it } from 'vitest';
import { RUN_IDS } from '../game/secrets';
import { loadTestWorld } from './testWorld';
import { alongRun, leadLine, runCorridor, unmarkedRuns, downRun, RUN_REACH, RUN_TENTHS } from './unmarked';
import { OPEN_WATER } from './world';

const world = loadTestWorld();
const runs = unmarkedRuns(world);

describe('the unmarked runs', () => {
  it('finds one on the real mountain for every ribbon there is', () => {
    expect(runs.map((r) => r.id)).toEqual([...RUN_IDS]);
  });

  it('sets each off from the trees beside a trail, takes it downhill a good way through forest, and brings it out on a trail', () => {
    for (const run of runs) {
      const hf = world.source;
      const top = { x: run.pts[0] as number, z: run.pts[1] as number };
      const bottom = { x: run.pts.at(-2) as number, z: run.pts.at(-1) as number };
      expect(run.length, run.id).toBeGreaterThan(370);
      expect(world.trailDistance(top.x, top.z), run.id).toBeGreaterThan(20);
      expect(world.trailDistance(top.x, top.z), run.id).toBeLessThan(60);
      expect(world.trailDistance(bottom.x, bottom.z), run.id).toBeLessThan(6);
      expect(hf.heightAt(top.x, top.z) - hf.heightAt(bottom.x, bottom.z), run.id).toBeGreaterThan(60);
      let woods = 0;
      for (let i = 0; i < run.pts.length; i += 2) {
        expect(world.openAt(run.pts[i] as number, run.pts[i + 1] as number), run.id).not.toBe(OPEN_WATER);
        if (world.trailDistance(run.pts[i] as number, run.pts[i + 1] as number) > 12) woods++;
      }
      // Nearly all of it is off the trails: it is a way through the trees, not along a trail's edge.
      expect(woods / (run.pts.length / 2), run.id).toBeGreaterThan(0.8);
    }
  });

  it('keeps them apart, so that each is a find of its own', () => {
    for (const a of runs) for (const b of runs) if (a !== b) expect(Math.hypot((a.pts[0] as number) - (b.pts[0] as number), (a.pts[1] as number) - (b.pts[1] as number))).toBeGreaterThan(600);
  });

  it('knows how far down one somebody is, and keeps the trees back along it', () => {
    const run = runs[0];
    if (!run) return;
    const clear = runCorridor(runs);
    const mid = Math.floor(run.pts.length / 4) * 2;
    expect(alongRun(run, run.pts[0] as number, run.pts[1] as number).share).toBe(0);
    expect(alongRun(run, run.pts.at(-2) as number, run.pts.at(-1) as number).share).toBe(1);
    expect(alongRun(run, run.pts[mid] as number, run.pts[mid + 1] as number).share).toBeCloseTo(0.5, 1);
    expect(clear(run.pts[mid] as number, run.pts[mid + 1] as number)).toBe(true);
    expect(clear((run.pts[mid] as number) + 60, (run.pts[mid + 1] as number) + 60)).toBe(false);
  });
});

describe('what leads to something in the trees', () => {
  it('begins at a trail, ends at the thing, and keeps out of the water on the way', () => {
    const hf = world.source;
    let tried = 0;
    for (let z = hf.minZ + 300; z < hf.maxZ - 300 && tried < 12; z += 370) {
      for (let x = hf.minX + 300; x < hf.maxX - 300 && tried < 12; x += 410) {
        const far = world.trailDistance(x, z);
        if (far < 80 || far > 320 || world.openAt(x, z) !== 0) continue;
        const line = leadLine(world, x, z);
        if (line.length === 0) continue;
        tried++;
        expect(world.trailDistance(line[0] as number, line[1] as number)).toBeLessThan(8);
        expect(line.at(-2)).toBe(x);
        expect(line.at(-1)).toBe(z);
        for (let i = 0; i < line.length; i += 2) expect(world.openAt(line[i] as number, line[i + 1] as number)).not.toBe(OPEN_WATER);
        // Not much longer than it has to be.
        expect((line.length / 2) * 5).toBeLessThan(far * 2.2 + 60);
      }
    }
    expect(tried).toBeGreaterThan(4);
  });
});

describe('coming down a run', () => {
  const run = { id: 'run-x', pts: Array.from({ length: 51 }, (_, i) => [0, i * 8]).flat(), length: 400 };

  it('counts once the bottom is reached with most of it passed on the way', () => {
    const tenths = new Set<number>();
    let done = false;
    for (let z = 0; z <= 400 && !done; z += 4) done = downRun(run, 2, z, tenths);
    expect(done).toBe(true);
    expect(tenths.size).toBeGreaterThanOrEqual(RUN_TENTHS);
  });

  it('does not count for somebody who joins it near the bottom, or who is only beside it', () => {
    const late = new Set<number>();
    let done = false;
    for (let z = 300; z <= 400; z += 4) done = downRun(run, 0, z, late) || done;
    expect(done).toBe(false);
    const wide = new Set<number>();
    for (let z = 0; z <= 400; z += 4) done = downRun(run, RUN_REACH + 6, z, wide) || done;
    expect(done).toBe(false);
    expect(wide.size).toBe(0);
  });

  it('remembers what was passed, so a run left and come back to still counts', () => {
    const tenths = new Set<number>();
    for (let z = 0; z <= 360; z += 4) downRun(run, 0, z, tenths);
    // Off into the trees and back for the last of it.
    expect(downRun(run, 60, 370, tenths)).toBe(false);
    expect(downRun(run, 0, 398, tenths)).toBe(true);
  });
});

