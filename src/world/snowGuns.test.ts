import { describe, expect, it } from 'vitest';
import { snowGuns } from './snowGuns';
import { loadTestWorld } from './testWorld';

const world = loadTestWorld();
const guns = snowGuns(world.trails, (x, z) => world.onTrail(x, z));

describe('snow guns', () => {
  it('stand along the wide groomed trails, a sensible number of them', () => {
    expect(guns.length).toBeGreaterThan(40);
    expect(guns.length).toBeLessThanOrEqual(320);
  });

  it('stand off the snow but beside it, leaning over it', () => {
    for (const g of guns) {
      expect(world.onTrail(g.x, g.z)).toBe(false);
      expect(world.trailDistance(g.x, g.z)).toBeLessThan(8);
      // A few metres the way it leans is on the trail.
      expect(world.onTrail(g.x + Math.sin(g.turn) * 5, g.z + Math.cos(g.turn) * 5)).toBe(true);
    }
  });

  it('are not bunched together', () => {
    for (const a of guns) for (const b of guns) if (a !== b) expect(Math.hypot(a.x - b.x, a.z - b.z)).toBeGreaterThanOrEqual(30);
  });
});
