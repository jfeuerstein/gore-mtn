import { describe, expect, it } from 'vitest';
import { ERRANDS, PEOPLE } from '../game/people';
import { loadTestWorld } from './testWorld';
import { locate } from './whereabouts';
import { OPEN_WATER } from './world';

const world = loadTestWorld();

describe('locate', () => {
  it('finds a spot by a building\'s door, outside its walls', () => {
    const lodge = world.places.find((p) => p.id === 'base-lodge');
    const at = locate(world, { place: 'base-lodge' });
    if (!lodge || !at) throw new Error('missing');
    expect(at.z).toBeGreaterThan(lodge.z + 8);
    expect(Math.hypot(at.x - lodge.x, at.z - lodge.z)).toBeLessThan(30);
  });

  it('finds the foot of a lift, and a place under its line', () => {
    const lift = world.lifts.find((l) => l.name === 'Hudson Chair');
    const foot = locate(world, { lift: 'Hudson Chair' });
    const under = locate(world, { lift: 'Hudson Chair', along: 0.45 });
    if (!lift || !foot || !under) throw new Error('missing');
    expect(Math.hypot(foot.x - (lift.pts[0] as number), foot.z - (lift.pts[1] as number))).toBeLessThan(12);
    const length = Math.hypot((lift.pts.at(-2) as number) - (lift.pts[0] as number), (lift.pts.at(-1) as number) - (lift.pts[1] as number));
    const fromFoot = Math.hypot(under.x - (lift.pts[0] as number), under.z - (lift.pts[1] as number));
    expect(fromFoot).toBeGreaterThan(length * 0.35);
    expect(fromFoot).toBeLessThan(length * 0.55);
  });

  it('finds the edge of a trail part of the way down', () => {
    const at = locate(world, { trail: 'Moxham', along: 0.5 });
    if (!at) throw new Error('missing');
    expect(world.trailDistance(at.x, at.z)).toBeLessThan(12);
  });

  it('keeps out of the water at a pond', () => {
    const at = locate(world, { spot: 'rabbit-pond' });
    const pond = world.ponds.find((p) => p.id === 'rabbit-pond');
    if (!at || !pond) throw new Error('missing');
    expect(world.openAt(at.x, at.z)).not.toBe(OPEN_WATER);
    expect(Math.hypot(at.x - pond.x, at.z - pond.z)).toBeLessThan(260);
  });

  it('walks down Main Street from the depot', () => {
    const depot = world.places.find((p) => p.id === 'depot');
    const near = locate(world, { road: 'Main Street', from: 'depot', metres: 170 });
    const far = locate(world, { road: 'Main Street', from: 'depot', metres: 290 });
    if (!depot || !near || !far) throw new Error('missing');
    expect(Math.hypot(near.x - far.x, near.z - far.z)).toBeGreaterThan(60);
    expect(Math.hypot(near.x - depot.x, near.z - depot.z)).toBeLessThan(450);
    // The town lies south of the depot.
    expect(far.z).toBeGreaterThan(depot.z);
  });

  it('says so when the thing named is not on the map', () => {
    expect(locate(world, { place: 'nowhere' })).toBeNull();
    expect(locate(world, { lift: 'Chair to the Moon' })).toBeNull();
    expect(locate(world, { trail: 'Not A Trail', along: 0.5 })).toBeNull();
    expect(locate(world, { road: 'Abbey Road', from: 'depot', metres: 10 })).toBeNull();
  });

  it('can place every person and every piece of lost property, on the map and on dry land', () => {
    const hf = world.source;
    for (const at of [...PEOPLE.map((p) => ({ who: p.id, at: p.at })), ...ERRANDS.flatMap((e) => (e.lost ? [{ who: e.id, at: e.lost.at }] : []))]) {
      const where = locate(world, at.at);
      expect(where, at.who).not.toBeNull();
      if (!where) continue;
      expect(where.x, at.who).toBeGreaterThan(hf.minX + 5);
      expect(where.x, at.who).toBeLessThan(hf.maxX - 5);
      expect(where.z, at.who).toBeGreaterThan(hf.minZ + 5);
      expect(where.z, at.who).toBeLessThan(hf.maxZ - 5);
      expect(world.openAt(where.x, where.z), at.who).not.toBe(OPEN_WATER);
      // Nobody is left standing on a cliff or in a pit.
      if ('spot' in at.at) expect(world.source.slopeDegAt(where.x, where.z), at.who).toBeLessThan(16);
    }
  });
});
