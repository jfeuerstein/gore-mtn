import { describe, expect, it } from 'vitest';
import { loadTestWorld } from '../world/testWorld';
import { COLLECT_REACH, Game, type GameWorld, type SaveStore } from './game';
import { MINERALS } from './minerals';
import { parseSave } from './save';

const world = loadTestWorld();
const gameWorld: GameWorld = {
  trails: world.trails,
  lifts: world.lifts,
  places: world.places,
  minX: world.source.minX,
  minZ: world.source.minZ,
  trailDistance: (x, z) => world.trailDistance(x, z),
  slopeDegAt: (x, z) => world.source.slopeDegAt(x, z),
};
const memory = (initial: string | null = null): SaveStore & { text: string | null; writes: number } => {
  const store = {
    text: initial,
    writes: 0,
    read: () => store.text,
    write: (t: string) => {
      store.text = t;
      store.writes++;
    },
  };
  return store;
};
const DAY = '2026-11-10';
const place = (id: string) => {
  const p = world.places.find((q) => q.id === id);
  if (!p) throw new Error(id);
  return p;
};
/** Ski every piece of a trail, announcing whatever it earns. */
const skiTrail = (game: Game, name: string) => {
  const events = [];
  for (const t of world.trails.filter((q) => q.name === name && !q.area)) {
    for (let i = 0; i + 3 < t.pts.length; i += 2) {
      const [ax, az, bx, bz] = [t.pts[i], t.pts[i + 1], t.pts[i + 2], t.pts[i + 3]] as [number, number, number, number];
      const steps = Math.ceil(Math.hypot(bx - ax, bz - az) / 6);
      for (let s = 0; s <= steps; s++) events.push(...game.skiedAt(ax + ((bx - ax) * s) / steps, az + ((bz - az) * s) / steps, DAY));
    }
  }
  return events;
};

describe('Game', () => {
  it('starts with an empty book', () => {
    const s = new Game(gameWorld, memory()).summary();
    expect(s).toMatchObject({ trails: 0, lifts: 0, peaks: 0, landmarks: 0, conditions: 0, minerals: 0, specimens: 0 });
    expect(s.trailsTotal).toBeGreaterThan(90);
    expect(s.liftsTotal).toBe(14);
    expect(s.mineralsTotal).toBe(12);
  });

  it('stamps a trail skied top to bottom, announces it once, and counts it', () => {
    const game = new Game(gameWorld, memory());
    const events = skiTrail(game, 'Sunway').filter((e) => e.title.endsWith('Sunway'));
    expect(events).toEqual([{ kind: 'trail', title: '● Sunway', detail: 'Trail stamped' }]);
    expect(skiTrail(game, 'Sunway').filter((e) => e.title.endsWith('Sunway'))).toEqual([]);
    expect(game.summary().trails).toBeGreaterThanOrEqual(1);
  });

  it('pins a lift once, and ignores one with no name', () => {
    const game = new Game(gameWorld, memory());
    expect(game.rode('Adirondack Express', DAY)).toEqual([{ kind: 'lift', title: 'Adirondack Express', detail: 'Lift pin' }]);
    expect(game.rode('Adirondack Express', DAY)).toEqual([]);
    expect(game.rode(null, DAY)).toEqual([]);
    expect(game.summary().lifts).toBe(1);
  });

  it('gives the summit patch and the fire tower stamp at the top of Gore', () => {
    const game = new Game(gameWorld, memory());
    const top = place('summit');
    const events = game.reachedAt(top.x + 10, top.z + 10, DAY);
    expect(events.map((e) => e.title).sort()).toEqual(['Fire Tower', 'Gore Mountain']);
    expect(game.reachedAt(top.x, top.z, DAY)).toEqual([]);
    expect(game.reachedAt(place('base-lodge').x, place('base-lodge').z, DAY).map((e) => e.title)).toEqual(['Base Lodge']);
  });

  it('stamps each condition once', () => {
    const game = new Game(gameWorld, memory());
    expect(game.skiedIn(['powder-day', 'night-owl'], DAY).map((e) => e.title)).toEqual(['Powder Day', 'Night Owl']);
    expect(game.skiedIn(['powder-day', 'unknown'], DAY)).toEqual([]);
    expect(game.summary().conditions).toBe(2);
  });

  it('offers finds near the player, and takes each away once collected, until tomorrow', () => {
    const game = new Game(gameWorld, memory());
    const base = place('base-lodge');
    const finds = game.findsNear(base.x, base.z, DAY);
    expect(finds.length).toBeGreaterThan(5);
    for (const f of finds) expect(Math.hypot(f.x - base.x, f.z - base.z)).toBeLessThan(700);
    const first = finds[0];
    if (!first) throw new Error('no finds');
    const event = game.collect(first, DAY);
    expect(event).toMatchObject({ kind: 'mineral', title: first.mineral.name, colour: first.mineral.colour });
    expect(event.detail).toContain('New mineral');
    expect(game.findsNear(base.x, base.z, DAY).some((f) => f.id === first.id)).toBe(false);
    expect(game.findsNear(base.x, base.z, DAY)).toHaveLength(finds.length - 1);
    // A new day lays out a fresh set and forgets what was picked up yesterday.
    expect(game.findsNear(base.x, base.z, '2026-11-11').length).toBeGreaterThan(5);
    expect(game.save.found).toEqual({ day: '2026-11-11', spots: [] });
    expect(game.summary()).toMatchObject({ minerals: 1, specimens: 1 });
  });

  it('leaves no find inside a building', () => {
    const game = new Game(gameWorld, memory());
    for (const p of world.places) {
      for (const f of game.findsNear(p.x, p.z, DAY)) expect(Math.hypot(f.x - p.x, f.z - p.z), `${f.id} at ${p.name}`).toBeGreaterThanOrEqual(28);
    }
  });

  it('picks up what is within reach and nothing else', () => {
    const game = new Game(gameWorld, memory());
    const base = place('base-lodge');
    const finds = game.findsNear(base.x, base.z, DAY);
    expect(game.findsNear(base.x + 1, base.z, DAY)).toBe(finds);
    const target = finds[0];
    if (!target) throw new Error('no finds');
    const others = finds.filter((f) => f !== target && Math.hypot(f.x - target.x, f.z - target.z) <= COLLECT_REACH + 1);
    const got = game.pickUp(target.x + COLLECT_REACH - 1, target.z, DAY);
    expect(got.map((g) => g.find.id)).toContain(target.id);
    expect(got.length).toBeLessThanOrEqual(1 + others.length);
    expect(game.pickUp(target.x, target.z, DAY).some((g) => g.find.id === target.id)).toBe(false);
    expect(game.pickUp(target.x + COLLECT_REACH + 40, target.z + 500, DAY).every((g) => g.find.id !== target.id)).toBe(true);
  });

  it('keeps the largest specimen of each mineral', () => {
    const game = new Game(gameWorld, memory());
    const garnet = MINERALS[0];
    if (!garnet) throw new Error('no garnet');
    game.collect({ id: 'a', x: 0, z: 0, mineral: garnet, size: 3 }, DAY);
    expect(game.collect({ id: 'b', x: 0, z: 0, mineral: garnet, size: 7.5 }, DAY).detail).toBe('7.5 cm · Your largest yet');
    expect(game.collect({ id: 'c', x: 0, z: 0, mineral: garnet, size: 2 }, DAY).detail).toBe('2.0 cm · 3 found');
    expect(game.save.minerals.garnet).toEqual({ count: 3, best: 7.5, first: DAY });
  });

  it('saves only when something has changed, and picks up where it left off', () => {
    const store = memory();
    const game = new Game(gameWorld, store);
    game.persist();
    expect(store.writes).toBe(0);
    game.rode('Sunway', DAY);
    skiTrail(game, 'Sunway');
    game.persist();
    game.persist();
    expect(store.writes).toBe(1);

    const again = new Game(gameWorld, store);
    expect(again.summary().lifts).toBe(1);
    expect(again.save.trails.Sunway?.stamped).toBe(DAY);
    expect(again.rode('Sunway', DAY)).toEqual([]);
  });

  it('survives a damaged save', () => {
    const game = new Game(gameWorld, memory('{"trails": 12, "lifts": {"Sunway": "2026-11-10"}'));
    expect(game.summary()).toMatchObject({ trails: 0, lifts: 0 });
  });

  it('can be restored from another save', () => {
    const store = memory();
    const game = new Game(gameWorld, store);
    const other = parseSave(JSON.stringify({ lifts: { 'Northwoods Gondola': DAY }, peaks: { bear: DAY } }));
    game.restore(other);
    expect(game.summary()).toMatchObject({ lifts: 1, peaks: 1 });
    expect(parseSave(store.text).lifts).toEqual({ 'Northwoods Gondola': DAY });
  });
});
