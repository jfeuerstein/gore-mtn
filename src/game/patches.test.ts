import { describe, expect, it } from 'vitest';
import { loadTestWorld } from '../world/testWorld';
import { Game, type GameWorld, type SaveStore } from './game';
import { PATCHES, patchesEarned } from './patches';

const world = loadTestWorld();
const gameWorld: GameWorld = {
  trails: world.trails,
  lifts: world.lifts,
  places: world.places,
  paths: world.paths,
  minX: world.source.minX,
  minZ: world.source.minZ,
  trailDistance: (x, z) => world.trailDistance(x, z),
  slopeDegAt: (x, z) => world.source.slopeDegAt(x, z),
};
const memory = (): SaveStore => {
  let text: string | null = null;
  return { read: () => text, write: (t) => void (text = t) };
};
const DAY = '2026-11-11';

describe('patches', () => {
  it('have distinct ids and names, and say what each is for', () => {
    expect(new Set(PATCHES.map((p) => p.id)).size).toBe(PATCHES.length);
    expect(new Set(PATCHES.map((p) => p.name)).size).toBe(PATCHES.length);
    for (const p of PATCHES) expect(p.how.length, p.id).toBeGreaterThan(10);
  });

  it('are none of them earned by an empty book', () => {
    const game = new Game(gameWorld, memory());
    expect(patchesEarned(game.tally())).toEqual([]);
    expect(game.checkPatches(DAY)).toEqual([]);
  });

  it('counts trails by kind, glades apart', () => {
    const tally = new Game(gameWorld, memory()).tally();
    const total = Object.values(tally.trails).reduce((n, t) => n + t.total, 0);
    expect(total).toBe(tally.summary.trailsTotal);
    expect(tally.trails.easy.total).toBeGreaterThan(5);
    expect(tally.trails.glade.total).toBeGreaterThan(10);
  });

  it('are awarded once, when earned', () => {
    const game = new Game(gameWorld, memory());
    game.save.trails.Sunway = { seen: '1', stamped: DAY };
    expect(game.checkPatches(DAY)).toEqual([{ kind: 'patch', title: 'First Tracks', detail: 'A patch for your passport' }]);
    expect(game.checkPatches(DAY)).toEqual([]);
    expect(game.summary().patches).toBe(1);
    // Every easier trail earns the green circle.
    for (const t of game.trails) if (!t.glade && t.difficulty === 'easy') game.save.trails[t.name] = { seen: '1', stamped: DAY };
    expect(game.checkPatches(DAY).map((e) => e.title)).toEqual(['Green Circle']);
  });

  it('can every one be earned by a book with everything in it', () => {
    const game = new Game(gameWorld, memory());
    const tally = game.tally();
    const s = tally.summary;
    const full = {
      ...tally,
      summary: { ...s, benches: 10, tasted: s.tastedTotal, read: s.readTotal, trails: s.trailsTotal, paths: s.pathsTotal, lifts: s.liftsTotal, peaks: s.peaksTotal, seasonPeaks: s.seasonPeaksTotal, landmarks: s.landmarksTotal, seasons: 4, conditions: s.conditionsTotal, minerals: s.mineralsTotal, species: s.speciesTotal, errands: s.errandsTotal, letters: s.lettersTotal },
      save: { ...tally.save, rounds: ['2026-11-01', '2026-11-02', '2026-11-03', '2026-11-04', '2026-11-05'], minerals: { garnet: { count: 50, best: 22, first: DAY } }, sightings: { rumor: { count: 1, first: DAY } }, pets: ['2026-11-01', '2026-11-02', '2026-11-03', '2026-11-04', '2026-11-05', '2026-11-06', '2026-11-07'] },
      trails: Object.fromEntries(Object.entries(tally.trails).map(([k, t]) => [k, { done: t.total, total: t.total }])) as typeof tally.trails,
      biggest: 22,
    };
    expect(patchesEarned(full).sort()).toEqual(PATCHES.map((p) => p.id).sort());
  });

  it('gives each hint once', () => {
    const game = new Game(gameWorld, memory());
    expect(game.hint('skis')).toBe(true);
    expect(game.hint('skis')).toBe(false);
    expect(game.hint('lift')).toBe(true);
  });
});
