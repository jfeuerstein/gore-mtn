import { describe, expect, it } from 'vitest';
import { PROJECTS } from '../game/projects';
import { projectPlots, projectWalls } from './projectPlots';
import { insideBox } from './walls';
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

describe('what of a project is solid', () => {
  // A plot turned a quarter of the way round: its front (+z in its own frame) faces +x in the world.
  const plot = { id: 'burnt-ridge-hut', x: 100, z: -50, turn: Math.PI / 2 };

  it('the hut is a box where it stands, turned as its model is', () => {
    const [box] = projectWalls('hut', plot, 800);
    expect(box).toBeDefined();
    if (!box) return;
    expect(insideBox(100, -50, box)).toBe(true);
    // Its depth is 3.8: a step out of the door is outside, a step along the wall is not.
    expect(insideBox(100 + 2.6, -50, box)).toBe(false);
    expect(insideBox(100, -50 + 2.3, box)).toBe(true);
    expect(box.top).toBeGreaterThan(803);
  });

  it('the lean-to is open at the front and walled behind', () => {
    const boxes = projectWalls('leanto', plot, 0);
    const solid = (x: number, z: number): boolean => boxes.some((b) => insideBox(x, z, b));
    expect(solid(100, -50)).toBe(false);
    expect(solid(100 + 1.5, -50)).toBe(false);
    expect(solid(100 - 1.65, -50)).toBe(true);
  });

  it('the dock and the lookout are left to be walked out along', () => {
    expect(projectWalls('dock', plot, 0)).toEqual([]);
    expect(projectWalls('deck', plot, 0)).toEqual([]);
  });
});
