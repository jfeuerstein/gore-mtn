import { describe, expect, it } from 'vitest';
import { nearestOnLines } from './footprints';
import { BUILDING_LINE, planHeight, planHouses, SHOP_SIGNS, type HouseKind } from './houseKinds';
import { loadTestWorld } from './testWorld';
import { resolveTownPlaces } from './townPlaces';

const world = loadTestWorld();
const named = new Set(resolveTownPlaces(world).map((p) => p.building));
const plans = planHouses(world.buildings, world.roads, world.places, (x, z) => world.source.heightAt(x, z), named);
const count = (kinds: readonly HouseKind[]): number => plans.filter((p) => kinds.includes(p.kind)).length;

describe('what the buildings on the map are', () => {
  it('gives every building without a name of its own a plan, on its own plot', () => {
    expect(plans.length).toBe(world.buildings.filter((_, i) => !named.has(i)).length);
    for (const p of plans) {
      const b = world.buildings[p.index];
      if (!b) throw new Error('no such building');
      // On its own plot, perhaps turned a quarter to face its road, and never bigger than the map has it.
      expect(Math.hypot(p.x - b.x, p.z - b.z)).toBeLessThan(Math.max(b.w, b.d) / 2);
      expect(p.w * p.d).toBeLessThanOrEqual(b.w * b.d + 1e-6);
      expect(Number.isFinite(p.y)).toBe(true);
      expect(planHeight(p)).toBeGreaterThan(2.5);
      expect(planHeight(p)).toBeLessThan(17);
    }
    // The same on every load.
    expect(planHouses(world.buildings, world.roads, world.places, (x, z) => world.source.heightAt(x, z), named)).toEqual(plans);
    if (process.env.TOWN_REPORT) {
      const tally: Record<string, number> = {};
      for (const p of plans) tally[p.kind] = (tally[p.kind] ?? 0) + 1;
      console.log(tally, plans.filter((p) => p.sign).map((p) => p.sign).join(', '));
    }
  });

  it('is a town of many kinds of house, not one', () => {
    const homes: HouseKind[] = ['cape', 'farmhouse', 'gablefront', 'foursquare', 'camp', 'ranch'];
    for (const kind of homes) expect(count([kind]), kind).toBeGreaterThan(8);
    // No one kind is most of the town.
    for (const kind of homes) expect(count([kind]), kind).toBeLessThan(count(homes) * 0.45);
    expect(count(['shed', 'garage'])).toBeGreaterThan(20);
  });

  it('has a Main Street of shops, each with a trade of its own, facing the street', () => {
    const shops = plans.filter((p) => p.sign && SHOP_SIGNS.includes(p.sign));
    expect(shops.length).toBeGreaterThanOrEqual(14);
    // No trade twice until every trade has been used.
    expect(new Set(shops.map((p) => p.sign)).size).toBe(Math.min(shops.length, SHOP_SIGNS.length));
    const street = world.roads.filter((r) => r.name === 'Main Street');
    for (const p of shops) {
      expect(['falsefront', 'brickblock', 'porchshop', 'storefront']).toContain(p.kind);
      // Its front, a little way out from the wall, is nearer the street than its back is.
      const out = (by: number): number => Math.min(...street.map((r) => {
        let best = Infinity;
        for (let i = 0; i + 1 < r.pts.length; i += 2) best = Math.min(best, Math.hypot((r.pts[i] as number) - (p.x + Math.sin(p.turn) * by), (r.pts[i + 1] as number) - (p.z + Math.cos(p.turn) * by)));
        return best;
      }));
      expect(out(p.d / 2 + 4), p.sign ?? '').toBeLessThan(out(-p.d / 2 - 4));
    }
    expect(count(['falsefront', 'brickblock', 'porchshop', 'storefront'])).toBe(shops.length);
  });

  it('keeps every front wall in town back from the middle of Main Street, so there is room for a sidewalk', () => {
    const street = world.roads.filter((r) => r.name === 'Main Street');
    const depot = world.places.find((p) => p.id === 'depot');
    if (!depot) throw new Error('no depot');
    for (const p of [...plans, ...resolveTownPlaces(world)]) {
      if (Math.hypot(p.x - depot.x, p.z - depot.z) > 700) continue;
      // Only those that face the street: one that stands side-on to it faces some other road.
      const to = nearestOnLines(street, p.x, p.z);
      if (!to) continue;
      const ahead = (to.x - p.x) * Math.sin(p.turn) + (to.z - p.z) * Math.cos(p.turn);
      const aside = (to.x - p.x) * Math.cos(p.turn) - (to.z - p.z) * Math.sin(p.turn);
      if (ahead < Math.abs(aside)) continue;
      for (const along of [-0.5, 0, 0.5]) {
        const x = p.x + along * p.w * Math.cos(p.turn) + (p.d / 2) * Math.sin(p.turn);
        const z = p.z - along * p.w * Math.sin(p.turn) + (p.d / 2) * Math.cos(p.turn);
        // A plot too shallow to give any more ground is let off.
        if (p.d > 5.01) expect(nearestOnLines(street, x, z)?.dist ?? Infinity, `${Math.round(p.x)},${Math.round(p.z)}`).toBeGreaterThanOrEqual(BUILDING_LINE - 0.01);
      }
    }
  });

  it('gives the foot of the mountain its own buildings, the biggest of them named', () => {
    expect(count(['lodgewing', 'workshop', 'liftshack'])).toBeGreaterThanOrEqual(6);
    const base = world.places.find((p) => p.id === 'base-lodge');
    if (!base) throw new Error('no base lodge');
    for (const p of plans.filter((q) => ['lodgewing', 'workshop', 'liftshack'].includes(q.kind))) {
      const bowl = world.places.find((q) => q.id === 'ski-bowl-lodge');
      expect(Math.min(Math.hypot(p.x - base.x, p.z - base.z), bowl ? Math.hypot(p.x - bowl.x, p.z - bowl.z) + 150 : Infinity)).toBeLessThan(271);
    }
    expect(plans.some((p) => p.sign?.startsWith('NORTHWOODS LODGE'))).toBe(true);
  });
});
