import { describe, expect, it } from 'vitest';
import { loadTestWorld } from '../world/testWorld';
import type { Trail } from '../world/trails';
import { buildLandmarks, buildPathBook, buildPeaks, buildTrailBook, CONDITIONS, conditionsNow, reached, STAMP_SHARE, TrailIndex, trailShare } from './passport';
import type { TrailProgress } from './save';

const trail = (name: string | null, pts: number[], extra: Partial<Trail> = {}): Trail => ({
  name,
  difficulty: 'intermediate',
  glade: false,
  area: false,
  width: 30,
  pts,
  ...extra,
});

describe('buildTrailBook', () => {
  it('drops a checkpoint every 40 m down a trail', () => {
    const [entry] = buildTrailBook([trail('Straight', [0, 0, 400, 0])]);
    expect(entry?.checkpoints.length).toBe(20);
    expect(entry?.checkpoints.slice(0, 4)).toEqual([20, 0, 60, 0]);
    expect(entry?.length).toBe(400);
  });

  it('joins pieces that share a name and ignores outlines and unnamed trails', () => {
    const book = buildTrailBook([
      trail('Sunway', [0, 0, 200, 0]),
      trail('Sunway', [200, 0, 200, 200]),
      trail('Sunway', [0, 0, 50, 0, 50, 50, 0, 0], { area: true }),
      trail(null, [0, 0, 500, 0]),
    ]);
    expect(book).toHaveLength(1);
    expect(book[0]?.length).toBe(400);
    expect(book[0]?.checkpoints.length).toBe(20);
  });

  it('still gives a very short trail one checkpoint, and an outline-only trail an entry', () => {
    expect(buildTrailBook([trail('Stub', [0, 0, 10, 0])])[0]?.checkpoints).toEqual([5, 0]);
    expect(buildTrailBook([trail('Bowl', [0, 0, 100, 0, 100, 100, 0, 0], { area: true })])).toHaveLength(1);
  });
});

describe('TrailIndex', () => {
  const book = buildTrailBook([trail('Straight', [0, 0, 400, 0]), trail('Far', [0, 2000, 400, 2000])]);
  const index = new TrailIndex(book);
  const ski = (progress: Record<string, TrailProgress>, fromX: number, toX: number, z = 0): string[] => {
    const stamped: string[] = [];
    for (let x = fromX; x <= toX; x += 5) stamped.push(...index.visit(progress, x, z, '2026-11-10'));
    return stamped;
  };

  it('stamps a trail skied from top to bottom, once', () => {
    const progress: Record<string, TrailProgress> = {};
    expect(ski(progress, 0, 400)).toEqual(['Straight']);
    expect(progress.Straight?.stamped).toBe('2026-11-10');
    expect(ski(progress, 0, 400)).toEqual([]);
    expect(progress.Far).toBeUndefined();
  });

  it('counts skiing anywhere on the trail, but not out in the trees', () => {
    const onEdge: Record<string, TrailProgress> = {};
    expect(ski(onEdge, 0, 400, 20)).toEqual(['Straight']);
    const inTrees: Record<string, TrailProgress> = {};
    expect(ski(inTrees, 0, 400, 60)).toEqual([]);
    expect(trailShare(inTrees.Straight)).toBe(0);
  });

  it('keeps progress on a trail left partway, to finish another day', () => {
    const progress: Record<string, TrailProgress> = {};
    expect(ski(progress, 0, 200)).toEqual([]);
    expect(trailShare(progress.Straight)).toBeGreaterThan(0.4);
    expect(trailShare(progress.Straight)).toBeLessThan(STAMP_SHARE);
    expect(ski(progress, 200, 400)).toEqual(['Straight']);
  });

  it('starts a trail afresh if its saved progress is from a different map', () => {
    const progress: Record<string, TrailProgress> = { Straight: { seen: '111' } };
    index.visit(progress, 20, 0, '2026-11-10');
    expect(progress.Straight?.seen.length).toBe(10);
    expect(trailShare(progress.Straight)).toBeCloseTo(0.1);
  });
});

describe('peaks and landmarks', () => {
  const world = loadTestWorld();
  const peaks = buildPeaks(world.places, world.lifts);
  const landmarks = buildLandmarks(world.places);

  it('finds all four of Gore\'s peaks, each higher than the base', () => {
    expect(peaks.map((p) => p.id)).toEqual(['gore', 'bear', 'burnt-ridge', 'little-gore']);
    const base = world.places.find((p) => p.id === 'base-lodge');
    const ski = world.places.find((p) => p.id === 'ski-bowl-lodge');
    for (const p of peaks) {
      const low = p.id === 'little-gore' ? ski : base;
      expect(world.source.heightAt(p.x, p.z), p.name).toBeGreaterThan(world.source.heightAt(low?.x ?? 0, low?.z ?? 0) + 100);
    }
  });

  it('gives each summit patch to a skier stepping off the lift that serves it', () => {
    for (const p of peaks) {
      const nearest = Math.min(...world.lifts.map((l) => Math.hypot((l.pts.at(-2) as number) - p.x, (l.pts.at(-1) as number) - p.z)));
      // Riders are set down some 30 m beyond the top station.
      expect(nearest, p.name).toBeLessThan(p.reach - 35);
    }
  });

  it('asks for a visit to the fire tower itself, a short way from the lift', () => {
    const tower = landmarks.find((l) => l.id === 'fire-tower');
    const quad = world.lifts.find((l) => l.name === 'Straight Brook Quad');
    if (!tower || !quad) throw new Error('missing');
    expect(reached(landmarks, {}, quad.pts.at(-2) as number, quad.pts.at(-1) as number)).toEqual([]);
    expect(reached(landmarks, {}, tower.x + 20, tower.z - 20).map((l) => l.id)).toEqual(['fire-tower']);
  });

  it('lists the landmarks, with the summit as the fire tower', () => {
    expect(landmarks.map((l) => l.id).sort()).toEqual(['base-lodge', 'depot', 'fire-tower', 'saddle-lodge', 'ski-bowl-lodge']);
  });

  it('counts a spot as reached from nearby, once', () => {
    const gore = peaks[0];
    if (!gore) throw new Error('no summit');
    expect(reached(peaks, {}, gore.x + 30, gore.z).map((p) => p.id)).toEqual(['gore']);
    expect(reached(peaks, {}, gore.x + 500, gore.z)).toEqual([]);
    expect(reached(peaks, { gore: '2026-11-10' }, gore.x, gore.z)).toEqual([]);
  });
});

describe('the real trails', () => {
  const world = loadTestWorld();
  const book = buildTrailBook(world.trails);

  it('has an entry for each well-known trail, with a sensible length', () => {
    const names = new Set(book.map((b) => b.name));
    for (const name of ['Sunway', 'Ruby Run', 'Quicksilver', 'Twister', 'Showcase', 'The Rumor', 'Lies', 'Foxlair']) expect(names, name).toContain(name);
    expect(book.length).toBeGreaterThan(90);
    for (const b of book) expect(b.checkpoints.length, b.name).toBeGreaterThan(0);
  });

  it('stamps Sunway for a skier who follows it down', () => {
    const index = new TrailIndex(book);
    const progress: Record<string, TrailProgress> = {};
    const stamped = new Set<string>();
    for (const t of world.trails.filter((q) => q.name === 'Sunway' && !q.area)) {
      for (let i = 0; i + 3 < t.pts.length; i += 2) {
        const [ax, az, bx, bz] = [t.pts[i], t.pts[i + 1], t.pts[i + 2], t.pts[i + 3]] as [number, number, number, number];
        const steps = Math.ceil(Math.hypot(bx - ax, bz - az) / 6);
        for (let s = 0; s <= steps; s++) {
          for (const name of index.visit(progress, ax + ((bx - ax) * s) / steps, az + ((bz - az) * s) / steps, '2026-11-10')) stamped.add(name);
        }
      }
    }
    expect(stamped).toContain('Sunway');
    expect(trailShare(progress.Sunway)).toBe(1);
  });
});

describe('the seasons\' conditions', () => {
  const clear = { overcast: 0, snowing: 0 };
  const wet = { overcast: 1, snowing: 0.8 };
  it('keeps powder for winter and gives the other seasons their own weather', () => {
    expect(conditionsNow(30, true, wet, 'winter')).toEqual(['powder-day']);
    expect(conditionsNow(30, true, wet, 'spring')).toEqual(['mud-season']);
    expect(conditionsNow(30, true, wet, 'summer')).toEqual(['soaker']);
    expect(conditionsNow(30, true, wet, 'fall')).toEqual(['soaker']);
  });

  it('knows a spring afternoon, a summer noon and night, and a fall day and night', () => {
    expect(conditionsNow(40, false, clear, 'spring')).toContain('corn-snow');
    expect(conditionsNow(60, true, clear, 'summer')).toContain('dog-days');
    expect(conditionsNow(-20, true, clear, 'summer')).toContain('firefly-night');
    expect(conditionsNow(25, true, clear, 'fall')).toContain('peak-foliage');
    expect(conditionsNow(-20, true, clear, 'fall')).toContain('harvest-moon');
    expect(conditionsNow(-20, true, clear, 'winter')).toEqual(['night-owl']);
  });

  it('only ever names conditions that are in the book, in a season they belong to', () => {
    for (const season of ['winter', 'spring', 'summer', 'fall'] as const) {
      for (const sun of [-30, -3, 4, 15, 35, 65]) {
        for (const weather of [clear, wet, { overcast: 0.8, snowing: 0 }]) {
          for (const id of conditionsNow(sun, true, weather, season)) {
            const c = CONDITIONS.find((q) => q.id === id);
            expect(c, id).toBeDefined();
            expect(!c?.seasons || c.seasons.includes(season), `${id} in ${season}`).toBe(true);
          }
        }
      }
    }
    // And every condition can come up at some moment.
    const reachable = new Set<string>();
    for (const season of ['winter', 'spring', 'summer', 'fall'] as const) {
      for (const sun of [-30, 4, 35, 65]) for (const east of [true, false]) for (const weather of [clear, wet]) for (const id of conditionsNow(sun, east, weather, season)) reachable.add(id);
    }
    expect([...reachable].sort()).toEqual(CONDITIONS.map((c) => c.id).sort());
  });
});

describe('buildPathBook', () => {
  const world = loadTestWorld();
  const book = buildPathBook(world.paths, world.trails);
  it('lists the paths through the woods by name, each once, leaving out those that repeat a ski trail', () => {
    const names = book.map((p) => p.name);
    expect(new Set(names).size).toBe(names.length);
    expect(names).toContain('Schaefer Foot Trail');
    expect(names).toContain('Rabbit Pond Ski Trail');
    expect(names).not.toContain('Sunway');
    expect(names).not.toContain('Ruby Run');
    expect(book.length).toBeGreaterThan(15);
    for (const p of book) expect(p.checkpoints.length, p.name).toBeGreaterThan(0);
  });

  it('stamps a path walked from end to end', () => {
    const path = book.find((p) => p.name === 'Schaefer Foot Trail');
    if (!path) throw new Error('no path');
    const index = new TrailIndex(book);
    const progress = {};
    const stamped: string[] = [];
    for (const piece of world.paths.filter((p) => p.name === path.name)) {
      for (let i = 0; i + 3 < piece.pts.length; i += 2) {
        const [ax, az, bx, bz] = piece.pts.slice(i, i + 4) as [number, number, number, number];
        const steps = Math.ceil(Math.hypot(bx - ax, bz - az) / 5);
        for (let k = 0; k <= steps; k++) stamped.push(...index.visit(progress, ax + ((bx - ax) * k) / steps, az + ((bz - az) * k) / steps, '2026-07-04'));
      }
    }
    expect(stamped).toContain('Schaefer Foot Trail');
    expect(index.marked).toBeGreaterThan(10);
  });
});

describe('conditionsNow', () => {
  const clear = { overcast: 0, snowing: 0 };
  it('names the moment', () => {
    expect(conditionsNow(4, true, clear)).toEqual(['first-light']);
    expect(conditionsNow(4, false, clear)).toEqual(['alpenglow']);
    expect(conditionsNow(30, true, clear)).toEqual(['bluebird']);
    expect(conditionsNow(-20, false, clear)).toEqual(['night-owl']);
    expect(conditionsNow(14, true, clear)).toEqual([]);
  });

  it('gives a powder day whenever it snows, and no bluebird under cloud', () => {
    expect(conditionsNow(30, true, { overcast: 1, snowing: 1 })).toEqual(['powder-day']);
    expect(conditionsNow(-20, false, { overcast: 1, snowing: 0.6 }).sort()).toEqual(['night-owl', 'powder-day']);
    expect(conditionsNow(30, true, { overcast: 0.8, snowing: 0 })).toEqual([]);
  });
});
