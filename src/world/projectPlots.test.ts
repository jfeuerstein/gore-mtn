import { describe, expect, it } from 'vitest';
import { PROJECTS } from '../game/projects';
import { projectPlots } from './projectPlots';
import { loadTestWorld } from './testWorld';
import { distToPolyline } from './trails';
import { OPEN_WATER } from './world';

describe('the plots of the town projects', () => {
  const world = loadTestWorld();
  const plots = projectPlots(world);

  it('finds a plot for every project on the real mountain', () => {
    expect(plots.map((p) => p.id)).toEqual(PROJECTS.map((p) => p.id));
  });

  it('puts each on dry ground that can be stood on', () => {
    for (const p of plots) {
      expect(world.openAt(p.x, p.z), p.id).not.toBe(OPEN_WATER);
      expect(world.source.slopeDegAt(p.x, p.z), p.id).toBeLessThan(16);
      expect(Number.isFinite(p.turn), p.id).toBe(true);
    }
  });

  it('keeps them apart from one another and clear of the houses', () => {
    for (const a of plots) {
      for (const b of plots) if (a !== b) expect(Math.hypot(a.x - b.x, a.z - b.z), `${a.id} and ${b.id}`).toBeGreaterThan(200);
      expect(world.buildings.every((h) => Math.hypot(h.x - a.x, h.z - a.z) > 8), a.id).toBe(true);
    }
  });

  it('builds the first within a short walk of the Base Lodge, and the hut off the ski trails', () => {
    const base = world.places.find((p) => p.id === 'base-lodge');
    const first = plots.find((p) => p.id === 'lean-to');
    expect(Math.hypot((first?.x ?? 0) - (base?.x ?? 0), (first?.z ?? 0) - (base?.z ?? 0))).toBeLessThan(700);
    const hut = plots.find((p) => p.id === 'burnt-ridge-hut');
    expect(Math.min(...world.trails.filter((t) => !t.area).map((t) => distToPolyline(hut?.x ?? 0, hut?.z ?? 0, t.pts)))).toBeGreaterThan(10);
  });

  it('faces a dock toward its pond', () => {
    const dock = plots.find((p) => p.id === 'rabbit-dock');
    const pond = world.ponds.find((p) => p.id === 'rabbit-pond');
    if (!dock || !pond) throw new Error('no dock');
    const ahead = { x: dock.x + Math.sin(dock.turn) * 10, z: dock.z + Math.cos(dock.turn) * 10 };
    expect(Math.hypot(ahead.x - pond.x, ahead.z - pond.z)).toBeLessThan(Math.hypot(dock.x - pond.x, dock.z - pond.z));
  });
});
