import { describe, expect, it } from 'vitest';
import { loadTestWorld } from '../world/testWorld';
import { boundsOf, fitMap } from './mapView';

// A mountain 4 km east to west and 2 km north to south, summit at the west end.
const bounds = { minX: -2000, maxX: 2000, minZ: -1000, maxZ: 1000 };

describe('fitMap', () => {
  const map = fitMap(bounds, 400, 1000);

  it('is taller than it is wide, as the mountain is longer east to west', () => {
    expect(map.width).toBeCloseTo(400);
    expect(map.height).toBeCloseTo(800);
    expect(map.scale).toBeCloseTo(0.2);
  });

  it('puts west at the top and north on the right', () => {
    expect(map.toMap(-2000, 0).v).toBeCloseTo(0); // west edge at the top
    expect(map.toMap(2000, 0).v).toBeCloseTo(800); // east edge at the bottom
    expect(map.toMap(0, -1000).u).toBeCloseTo(400); // north edge on the right
    expect(map.toMap(0, 1000).u).toBeCloseTo(0); // south edge on the left
  });

  it('turns map points back into world positions', () => {
    const p = map.toMap(350, -620);
    expect(map.toWorld(p.u, p.v).x).toBeCloseTo(350);
    expect(map.toWorld(p.u, p.v).z).toBeCloseTo(-620);
  });

  it('points an arrow the right way for a heading', () => {
    expect(map.toMapAngle(Math.PI / 2)).toBeCloseTo(0); // facing west: up
    expect(map.toMapAngle(0)).toBeCloseTo(Math.PI / 2); // facing north: right
    expect(map.toMapAngle(-Math.PI / 2)).toBeCloseTo(Math.PI); // facing east: down
  });

  it('is limited by height when the box is short, and leaves room for a margin', () => {
    const short = fitMap(bounds, 400, 400, 0);
    expect(short.height).toBeCloseTo(400);
    expect(short.width).toBeCloseTo(200);
    const padded = fitMap(bounds, 400, 1000, 100);
    expect(padded.toMap(-2000, 1000)).toEqual({ u: padded.scale * 100, v: padded.scale * 100 });
  });
});

describe('boundsOf', () => {
  it('finds the box around flat x, z lists', () => {
    expect(boundsOf([[0, 0, 10, -5], [-3, 8]])).toEqual({ minX: -3, maxX: 10, minZ: -5, maxZ: 8 });
  });
});

describe('the real mountain on the map', () => {
  const world = loadTestWorld();
  const map = fitMap(boundsOf([...world.trails.map((t) => t.pts), ...world.lifts.map((l) => l.pts)]), 374, 600, 150);
  const at = (id: string) => {
    const p = world.places.find((q) => q.id === id);
    if (!p) throw new Error(id);
    return map.toMap(p.x, p.z);
  };

  it('fits an upright phone', () => {
    expect(map.width).toBeLessThanOrEqual(374.01);
    expect(map.height).toBeLessThanOrEqual(600.01);
    expect(map.height).toBeGreaterThan(map.width);
  });

  it('shows the summit above the Saddle Lodge above the Base Lodge', () => {
    expect(at('summit').v).toBeLessThan(at('saddle-lodge').v);
    expect(at('saddle-lodge').v).toBeLessThan(at('base-lodge').v);
  });
});
