import { describe, expect, it } from 'vitest';
import { countryOf } from '../world/country';
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

  it('puts the flyer out once a day, with the same leads on it all day', () => {
    const store = memory();
    const game = new Game(gameWorld, store);
    expect(game.flyerDue(DAY)).toBe(true);
    expect(game.flyerDue(DAY)).toBe(false);
    expect(new Game(gameWorld, store).flyerDue(DAY)).toBe(false);
    expect(game.flyerDue('2099-01-01')).toBe(true);
    expect(game.leadsFor(DAY, () => ['trail:Sunway', 'rumour'])).toEqual(['trail:Sunway', 'rumour']);
    // Asked again, the choice is not made again.
    expect(game.leadsFor(DAY, () => ['trail:Twister'])).toEqual(['trail:Sunway', 'rumour']);
    expect(new Game(gameWorld, store).leadsFor(DAY, () => [])).toEqual(['trail:Sunway', 'rumour']);
    expect(game.leadsFor('2099-01-01', () => ['place:quarry'])).toEqual(['place:quarry']);
  });

  it('keeps a flag where it is planted, and takes it up when the player comes to it', () => {
    const store = memory();
    const game = new Game(gameWorld, store);
    game.plant({ x: 100, z: -50, label: 'A spot you marked' });
    expect(new Game(gameWorld, store).save.flag).toEqual({ x: 100, z: -50, label: 'A spot you marked' });
    expect(game.reachedFlag(160, -50)).toBe(false);
    expect(game.save.flag).not.toBeNull();
    expect(game.reachedFlag(108, -45)).toBe(true);
    expect(game.save.flag).toBeNull();
    // Once only: there is no flag left to come to.
    expect(game.reachedFlag(108, -45)).toBe(false);
    expect(new Game(gameWorld, store).save.flag).toBeNull();
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
    expect(game.rode('Adirondack Express', DAY)).toEqual([{ kind: 'lift', title: 'Adirondack Express', detail: 'Lift pin', art: 'pins/chair-lift' }]);
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

  it('gives each summit a patch in every season', () => {
    const game = new Game(gameWorld, memory());
    const top = place('summit');
    expect(game.reachedAt(top.x + 10, top.z + 10, DAY, 'winter').map((e) => e.detail).sort()).toEqual(['Landmark stamped', 'Summit patch']);
    expect(game.reachedAt(top.x, top.z, DAY, 'winter')).toEqual([]);
    expect(game.reachedAt(top.x, top.z, '2027-07-04', 'summer')).toEqual([{ kind: 'peak', title: 'Gore Mountain', detail: 'Summer summit patch', art: 'peaks/gore' }]);
    expect(game.reachedAt(top.x, top.z, '2027-07-05', 'summer')).toEqual([]);
    expect(game.summary()).toMatchObject({ peaks: 1, peaksTotal: 4, seasonPeaks: 2, seasonPeaksTotal: 16 });
    // The first patch keeps the day it was first earned.
    expect(game.save.peaks.gore).toBe(DAY);
  });

  it('stamps each season the first time the game is opened in it', () => {
    const game = new Game(gameWorld, memory());
    expect(game.arrivedIn('winter', DAY)).toEqual([{ kind: 'season', title: 'Winter', detail: 'Your first season on the mountain' }]);
    expect(game.arrivedIn('winter', '2026-12-01')).toEqual([]);
    expect(game.arrivedIn('summer', '2027-07-04')).toEqual([{ kind: 'season', title: 'Summer', detail: 'A new season on the mountain' }]);
    expect(game.summary().seasons).toBe(2);
  });

  it('stamps a path walked from end to end, however it is travelled', () => {
    const game = new Game({ ...gameWorld, paths: world.paths }, memory());
    expect(game.summary().pathsTotal).toBeGreaterThan(15);
    const events = [];
    for (const piece of world.paths.filter((p) => p.name === 'Hoot (bike)')) {
      for (let i = 0; i + 3 < piece.pts.length; i += 2) {
        const [ax, az, bx, bz] = piece.pts.slice(i, i + 4) as [number, number, number, number];
        const steps = Math.ceil(Math.hypot(bx - ax, bz - az) / 5);
        for (let k = 0; k <= steps; k++) events.push(...game.travelledAt(ax + ((bx - ax) * k) / steps, az + ((bz - az) * k) / steps, DAY));
      }
    }
    expect(events).toContainEqual({ kind: 'path', title: 'Hoot (bike)', detail: 'Path stamped' });
    expect(game.summary().paths).toBeGreaterThanOrEqual(1);
  });

  it('lays no stone on a road, a lot or water', () => {
    const game = new Game({ ...gameWorld, openAt: (x, z) => world.openAt(x, z) }, memory());
    const depot = place('depot');
    for (const p of [depot, place('ski-bowl-lodge'), place('base-lodge')]) {
      for (const f of game.findsNear(p.x, p.z, DAY)) expect(world.openAt(f.x, f.z), f.id).toBe(0);
    }
  });

  it('reads a book from before the seasons as one filled in winter', () => {
    const game = new Game(gameWorld, memory(JSON.stringify({ peaks: { gore: DAY } })));
    const top = place('summit');
    expect(game.reachedAt(top.x, top.z, '2026-12-01', 'winter').map((e) => e.kind)).toEqual(['landmark']);
    expect(game.summary().seasonPeaks).toBe(1);
  });

  describe('the field guide', () => {
    const wild: GameWorld = { ...gameWorld, country: countryOf(world) };
    const base = place('base-lodge');

    it('shows what is about near the player, the same list until something changes', () => {
      const game = new Game(wild, memory());
      const list = game.sightingsNear(base.x, base.z, DAY, 'winter', 'day');
      expect(list.length).toBeGreaterThan(3);
      expect(game.sightingsNear(base.x + 2, base.z, DAY, 'winter', 'day')).toBe(list);
      expect(game.sightingsNear(base.x, base.z, DAY, 'winter', 'night')).not.toBe(list);
      for (const s of list) expect(Math.hypot(s.x - base.x, s.z - base.z)).toBeLessThan(700);
    });

    it('records a sighting come up to gently, once, and counts it in the guide', () => {
      const game = new Game(wild, memory());
      const list = game.sightingsNear(base.x, base.z, DAY, 'winter', 'day');
      const target = list[0];
      if (!target) throw new Error('nothing about');
      const first = game.lookAbout(target.x + 2, target.z, 1, DAY, 'winter', 'day');
      expect(first.seen.map((s) => s.sighting.id)).toContain(target.id);
      expect(first.seen.find((s) => s.sighting.id === target.id)?.event).toEqual({ kind: 'sighting', title: target.species.name, detail: 'New in the field guide', art: `species/${target.species.id}` });
      expect(game.lookAbout(target.x + 2, target.z, 1, DAY, 'winter', 'day').seen.some((s) => s.sighting.id === target.id)).toBe(false);
      expect(game.sightingsNear(base.x, base.z, DAY, 'winter', 'day').some((s) => s.id === target.id)).toBe(false);
      expect(game.summary().species).toBeGreaterThanOrEqual(1);
      expect(game.summary().speciesTotal).toBeGreaterThanOrEqual(38);
    });

    it('lets a shy creature bolt unseen from someone who comes in fast', () => {
      const game = new Game(wild, memory());
      // Find a shy creature somewhere on the mountain.
      let shy = null;
      for (const p of world.places) {
        shy = game.sightingsNear(p.x, p.z, DAY, 'winter', 'dawn').find((s) => s.species.shy) ?? null;
        if (shy) break;
      }
      if (!shy) throw new Error('no shy creature about');
      const fast = game.lookAbout(shy.x + 25, shy.z, 20, DAY, 'winter', 'dawn');
      expect(fast.bolted.map((s) => s.id)).toContain(shy.id);
      expect(fast.seen.some((s) => s.sighting.id === shy.id)).toBe(false);
      expect(game.save.sightings[shy.species.id]).toBeUndefined();
      // It is gone for this watch.
      expect(game.lookAbout(shy.x + 1, shy.z, 1, DAY, 'winter', 'dawn').seen.some((s) => s.sighting.id === shy.id)).toBe(false);
    });

    it('brings everything back with the next watch, and keeps the guide across a reload', () => {
      const store = memory();
      const game = new Game(wild, store);
      const target = game.sightingsNear(base.x, base.z, DAY, 'winter', 'day')[0];
      if (!target) throw new Error('nothing about');
      game.lookAbout(target.x, target.z, 1, DAY, 'winter', 'day');
      game.persist();
      const again = new Game(wild, store);
      expect(again.save.sightings[target.species.id]).toEqual({ count: 1, first: DAY });
      expect(again.sightingsNear(base.x, base.z, DAY, 'winter', 'day').some((s) => s.id === target.id)).toBe(false);
      expect(again.sightingsNear(base.x, base.z, DAY, 'winter', 'dusk').length).toBeGreaterThan(0);
      expect(again.save.seen.spots).toEqual([]);
    });

    it('has nothing to show without a country to look at', () => {
      expect(new Game(gameWorld, memory()).sightingsNear(base.x, base.z, DAY, 'winter', 'day')).toEqual([]);
    });
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
