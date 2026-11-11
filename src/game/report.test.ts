import { describe, expect, it } from 'vitest';
import { snowReport, trailOfTheDay, wildlifeLog, type Conditions } from './report';
import { SPECIES } from './wildlife';

const fair: Conditions = { season: 'winter', overcast: 0, falling: 0, watch: 'day', day: '2026-11-11' };

describe('the snow report', () => {
  it('reports the sky it is given', () => {
    expect(snowReport(fair, 14, 112)).toContain('bluebird');
    expect(snowReport({ ...fair, falling: 1, overcast: 1 }, 14, 112)).toContain('SNOWING');
    expect(snowReport({ ...fair, season: 'summer', falling: 1, overcast: 1 }, 14, 112)).toContain('RAIN');
    expect(snowReport({ ...fair, watch: 'night' }, 14, 112)).toContain('stars');
    expect(snowReport({ ...fair, overcast: 1 }, 14, 112)).toContain('overcast');
  });

  it('never claims snow in summer, and never closes a trail', () => {
    for (const falling of [0, 0.3, 1]) {
      const report = snowReport({ ...fair, season: 'summer', falling }, 14, 112);
      expect(report).toContain('New snow: no.');
      expect(report).toContain('Trails open: 112 of 112');
      expect(report).toContain('Lifts turning: 14 of 14');
    }
  });

  it('closes with a different remark from one day to the next, and the same one all day', () => {
    const a = snowReport(fair, 14, 112);
    expect(snowReport(fair, 14, 112)).toBe(a);
    const others = ['2026-11-12', '2026-11-13', '2026-11-14'].map((day) => snowReport({ ...fair, day }, 14, 112));
    expect(new Set([a, ...others]).size).toBeGreaterThan(1);
  });

  it('is short enough to read on a board', () => {
    for (const season of ['winter', 'spring', 'summer', 'fall'] as const) {
      for (const falling of [0, 0.3, 1]) expect(snowReport({ ...fair, season, falling }, 14, 112).length).toBeLessThan(330);
    }
  });
});

describe('the trail of the day', () => {
  const trails = [
    { name: 'Sunway', difficulty: 'easy' as const, glade: false },
    { name: 'Twister', difficulty: 'intermediate' as const, glade: false },
    { name: 'Chatiemac', difficulty: 'advanced' as const, glade: false },
  ];

  it('picks a trail not yet in the passport, the same one all day', () => {
    const board = trailOfTheDay(trails, (name) => name === 'Sunway', '2026-11-11');
    expect(board).not.toContain('SUNWAY');
    expect(board).toMatch(/TWISTER|CHATIEMAC/);
    expect(board).toContain('2 still to stamp');
    expect(trailOfTheDay(trails, (name) => name === 'Sunway', '2026-11-11')).toBe(board);
  });

  it('says so when there is nothing left to stamp, and calls it a ride in the bike months', () => {
    expect(trailOfTheDay(trails, () => true, '2026-11-11')).toContain('whichever you like');
    expect(trailOfTheDay(trails, () => false, '2026-07-04', true)).toContain('RIDE OF THE DAY');
  });
});

describe('the observer\'s log', () => {
  it('lists what is about this season and hour, with something not yet seen first', () => {
    for (const season of ['winter', 'spring', 'summer', 'fall'] as const) {
      for (const watch of ['dawn', 'day', 'dusk', 'night'] as const) {
        const log = wildlifeLog(SPECIES, () => false, season, watch, '2026-11-11');
        expect(log, `${season} ${watch}`).toContain('Not yet in your guide');
        expect(log.length, `${season} ${watch}`).toBeLessThan(330);
        // Whatever it names is truly about then.
        const named = SPECIES.filter((s) => log.includes(s.name.toLowerCase()));
        expect(named.length).toBeGreaterThan(0);
        for (const s of named) {
          expect(!s.seasons || s.seasons.includes(season), `${s.id} in ${season}`).toBe(true);
          expect(!s.watches || s.watches.includes(watch), `${s.id} at ${watch}`).toBe(true);
        }
      }
    }
  });

  it('greets old friends when everything about has been seen', () => {
    expect(wildlifeLog(SPECIES, () => true, 'winter', 'day', '2026-11-11')).toContain('old friends');
  });
});
