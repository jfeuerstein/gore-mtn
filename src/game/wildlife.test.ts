import { describe, expect, it } from 'vitest';
import { SEASONS, type Season } from '../look/season';
import { countryOf } from '../world/country';
import { loadTestWorld } from '../world/testWorld';
import {
  HAUNTS,
  hauntAt,
  isAbout,
  MOST_SIGHTINGS,
  SIGHT_PATCH,
  sightingsInPatch,
  SPECIES,
  speciesById,
  spotReach,
  WATCHES,
  watchFor,
  watchSeed,
  type Country,
  type Sighting,
  type Watch,
} from './wildlife';

describe('the field guide', () => {
  it('has around forty entries with distinct ids and names', () => {
    expect(SPECIES.length).toBeGreaterThanOrEqual(38);
    expect(new Set(SPECIES.map((s) => s.id)).size).toBe(SPECIES.length);
    expect(new Set(SPECIES.map((s) => s.name)).size).toBe(SPECIES.length);
  });

  it('gives every entry somewhere to be, a line about it and a hint', () => {
    for (const s of SPECIES) {
      expect(Object.values(s.haunts).some((w) => (w ?? 0) > 0), s.id).toBe(true);
      expect(s.about.length, s.id).toBeGreaterThan(20);
      expect(s.hint.length, s.id).toBeGreaterThan(10);
      for (const haunt of Object.keys(s.haunts)) expect(HAUNTS, s.id).toContain(haunt);
    }
  });

  it('keeps to the real mountain: bears sleep through winter, loons leave, trillium is for spring', () => {
    expect(speciesById('bear')?.seasons).not.toContain('winter');
    expect(speciesById('loon')?.seasons).not.toContain('winter');
    expect(speciesById('trillium')?.seasons).toEqual(['spring']);
    expect(speciesById('snowman')?.seasons).toEqual(['winter']);
    expect(speciesById('owl')?.watches).not.toContain('day');
  });

  it('has something of every kind to find in every season', () => {
    for (const season of SEASONS) {
      for (const kin of ['animal', 'bird', 'plant'] as const) {
        expect(SPECIES.filter((s) => s.kin === kin && (!s.seasons || s.seasons.includes(season))).length, `${kin} in ${season}`).toBeGreaterThanOrEqual(3);
      }
    }
  });
});

describe('watchFor', () => {
  it('splits the day by the height of the sun', () => {
    expect(watchFor(-20, true)).toBe('night');
    expect(watchFor(2, true)).toBe('dawn');
    expect(watchFor(2, false)).toBe('dusk');
    expect(watchFor(-3, false)).toBe('dusk');
    expect(watchFor(40, true)).toBe('day');
  });
});

describe('hauntAt', () => {
  const land = (over: Partial<Country>): Country => ({
    trailDistance: () => 100,
    slopeDegAt: () => 10,
    openAt: () => 0,
    hardwoodAt: () => 1,
    townDistance: () => 1000,
    distanceTo: () => Infinity,
    ...over,
  });
  it('tells the kinds of ground apart', () => {
    expect(hauntAt(land({}), 0, 0)).toBe('woods');
    expect(hauntAt(land({ trailDistance: () => 0 }), 0, 0)).toBe('trail');
    expect(hauntAt(land({ trailDistance: () => 8 }), 0, 0)).toBe('edge');
    expect(hauntAt(land({ trailDistance: () => 25 }), 0, 0)).toBeNull();
    expect(hauntAt(land({ slopeDegAt: () => 50 }), 0, 0)).toBe('rock');
    expect(hauntAt(land({ openAt: () => 2 }), 0, 0)).toBe('water');
    expect(hauntAt(land({ openAt: (x) => (x > 5 ? 2 : 0) }), 0, 0)).toBe('shore');
    expect(hauntAt(land({ townDistance: () => 20, openAt: () => 1 }), 0, 0)).toBe('town');
    expect(hauntAt(land({ openAt: () => 1 }), 0, 0)).toBeNull();
  });
});

describe('isAbout', () => {
  const deer = speciesById('deer');
  const hare = speciesById('hare');
  if (!deer || !hare) throw new Error('missing');
  it('checks the ground, the season, the hour and the height on the mountain', () => {
    expect(isAbout(deer, 'edge', 'winter', 'dawn', 0.9)).toBe(true);
    expect(isAbout(deer, 'water', 'winter', 'dawn', 0.9)).toBe(false);
    expect(isAbout(deer, 'edge', 'winter', 'night', 0.9)).toBe(false);
    expect(isAbout(deer, 'edge', 'winter', 'dawn', 0.1)).toBe(false);
    expect(isAbout(hare, 'woods', 'summer', 'day', 0.1)).toBe(true);
    expect(isAbout(hare, 'woods', 'summer', 'day', 0.9)).toBe(false);
  });
});

describe('sightings on the real mountain', () => {
  const world = loadTestWorld();
  const country = countryOf(world);
  const hf = world.source;
  const cols = Math.ceil(hf.width / SIGHT_PATCH);
  const rows = Math.ceil(hf.depth / SIGHT_PATCH);
  const all = (day: string, season: Season, watch: Watch): Sighting[] => {
    const out: Sighting[] = [];
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) out.push(...sightingsInPatch(country, c, r, watchSeed(day, watch), season, watch, hf.minX, hf.minZ));
    return out;
  };
  const DAY = '2026-11-11';

  it('are the same on every load, and change with the watch and the day', () => {
    const a = all(DAY, 'winter', 'day');
    expect(all(DAY, 'winter', 'day').map((s) => s.id + s.species.id)).toEqual(a.map((s) => s.id + s.species.id));
    const dusk = all(DAY, 'winter', 'dusk');
    const tomorrow = all('2026-11-12', 'winter', 'day');
    const same = (b: Sighting[]) => b.filter((s, i) => a[i] && Math.hypot(s.x - (a[i] as Sighting).x, s.z - (a[i] as Sighting).z) < 1).length;
    expect(same(dusk)).toBeLessThan(a.length * 0.05);
    expect(same(tomorrow)).toBeLessThan(a.length * 0.05);
  });

  it('are plentiful but not crowded, in every season and watch', () => {
    for (const season of SEASONS) {
      for (const watch of WATCHES) {
        const list = all(DAY, season, watch);
        expect(list.length, `${season} ${watch}`).toBeGreaterThan(250);
        expect(list.length, `${season} ${watch}`).toBeLessThan(2600);
        const perPatch = new Map<string, number>();
        for (const s of list) {
          const key = s.id.split(':').slice(0, 2).join(':');
          perPatch.set(key, (perPatch.get(key) ?? 0) + 1);
          expect(isAbout(s.species, hauntAt(country, s.x, s.z) ?? 'trail', season, watch, world.hardwoodAt(s.x, s.z)), `${s.species.id} ${season} ${watch}`).toBe(true);
        }
        expect(Math.max(...perPatch.values())).toBeLessThanOrEqual(MOST_SIGHTINGS);
      }
    }
  }, 60000);

  it('lets every entry in the guide be found somewhere, at some time of some season', () => {
    const found = new Set<string>();
    // A few days, since the rare ones do not turn up every day.
    for (const day of ['2026-11-11', '2026-11-12', '2026-11-13', '2026-11-14', '2026-11-15', '2026-11-16']) {
      for (const season of SEASONS) for (const watch of WATCHES) for (const s of all(day, season, watch)) found.add(s.species.id);
    }
    expect(SPECIES.filter((s) => !found.has(s.id)).map((s) => s.id)).toEqual([]);
  }, 60000);

  it('keeps The Rumor to the woods by its trail, in poor light', () => {
    let seen = 0;
    for (const day of ['2026-11-11', '2026-11-12', '2026-11-13', '2026-11-14', '2026-11-15', '2026-11-16', '2026-11-17', '2026-11-18']) {
      for (const watch of WATCHES) {
        for (const s of all(day, 'winter', watch)) {
          if (s.species.id !== 'rumor') continue;
          seen++;
          expect(['dusk', 'night']).toContain(watch);
          expect(country.distanceTo('The Rumor', s.x, s.z)).toBeLessThanOrEqual(420);
        }
      }
    }
    expect(seen).toBeGreaterThan(0);
    // Rare: not something to stumble on every evening.
    expect(seen).toBeLessThan(40);
  }, 60000);

  it('puts water birds on water and the eagle by the Hudson', () => {
    for (const s of all(DAY, 'summer', 'day')) {
      if (s.species.id === 'loon') expect(world.openAt(s.x, s.z)).toBe(2);
      if (s.species.id === 'eagle') expect(country.distanceTo('Hudson River', s.x, s.z)).toBeLessThanOrEqual(220);
    }
  });

  it.runIf(process.env.FIND_REPORT)('reports how many of each (for tuning)', () => {
    for (const season of SEASONS) {
      for (const watch of WATCHES) {
        const by = new Map<string, number>();
        const list = all(DAY, season, watch);
        for (const s of list) by.set(s.species.id, (by.get(s.species.id) ?? 0) + 1);
        process.stderr.write(`${season} ${watch}: ${list.length} ${JSON.stringify([...by].sort((a, b) => b[1] - a[1]))}\n`);
      }
    }
  });
});

describe('spotReach', () => {
  it('lets plants be walked right up to and keeps animals at a distance', () => {
    expect(spotReach(speciesById('trillium') as never)).toBeLessThan(spotReach(speciesById('deer') as never));
    expect(spotReach(speciesById('rumor') as never)).toBeGreaterThan(spotReach(speciesById('deer') as never));
  });
});
