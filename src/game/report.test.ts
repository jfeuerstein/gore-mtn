import { describe, expect, it } from 'vitest';
import { dayNumber, GENTLE_UNTIL, snowReport, trailOfTheDay, trailPick, trailReason, wildlifeLog, type Conditions } from './report';
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

  it('sends someone new down something gentle and open, and anyone else anywhere', () => {
    const hill = [
      ...['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'].map((n) => ({ name: `Glade ${n}`, difficulty: 'expert' as const, glade: true })),
      { name: 'Sunway', difficulty: 'easy' as const, glade: false },
      { name: 'Twister', difficulty: 'intermediate' as const, glade: false },
    ];
    const days = Array.from({ length: 20 }, (_, i) => `2026-11-${String(i + 1).padStart(2, '0')}`);
    for (const day of days) expect(['Sunway', 'Twister']).toContain(trailPick(hill, () => false, day)?.name);
    // With half a dozen trails in the passport, the board picks from everything that is left.
    const done = new Set(hill.slice(0, GENTLE_UNTIL).map((t) => t.name));
    expect(new Set(days.map((day) => trailPick(hill, (name) => done.has(name), day)?.name)).size).toBeGreaterThan(2);
  });

  it('never gives the reason it gave yesterday', () => {
    for (let d = 1; d < 60; d++) {
      const day = (n: number): string => new Date(Date.UTC(2026, 10, n, 12)).toISOString().slice(0, 10);
      expect(trailReason(day(d + 1)), day(d + 1)).not.toBe(trailReason(day(d)));
    }
  });

  it('does not walk down the list from one day to the next', () => {
    const numbers = ['11', '12', '13', '14', '15', '16'].map((d) => dayNumber(`2026-11-${d}`));
    const steps = numbers.slice(1).map((n, i) => Math.abs(n - (numbers[i] as number)));
    expect(steps.every((step) => step > 1000)).toBe(true);
    expect(new Set(numbers.map((n) => n % 6)).size).toBeGreaterThan(2);
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

describe('the reasons, out of the snow months', () => {
  it('say nothing of snow or grooming when the way down is a bike', () => {
    const days = Array.from({ length: 40 }, (_, i) => `2026-07-${String((i % 28) + 1).padStart(2, '0')}`);
    for (const day of days) {
      expect(trailReason(day, true), day).not.toMatch(/snow|groom|Bram/i);
      // On snow it is as it was.
      expect(trailReason(day).length).toBeGreaterThan(5);
    }
    expect(days.some((day) => trailReason(day) !== trailReason(day, true))).toBe(true);
    const c: Conditions = { season: 'summer', overcast: 0, falling: 0, watch: 'day', day: '2026-07-04', fresh: 0 };
    for (let d = 1; d <= 28; d++) expect(snowReport({ ...c, day: `2026-07-${String(d).padStart(2, '0')}` }, 14, 100)).not.toMatch(/groomed/);
    expect(trailOfTheDay([{ name: 'Sunway', difficulty: 'easy', glade: false }], () => false, '2026-07-04', true)).not.toMatch(/snow is good|Bram/);
  });
});

describe('a morning of fog', () => {
  it('is not called overcast: the report says the cloud is low, and that it may be clear up top', () => {
    const c: Conditions = { season: 'winter', overcast: 1, falling: 0, watch: 'dawn', day: '2026-12-01', fresh: 0, low: true };
    expect(snowReport(c, 14, 100)).toContain('Sky: fog in the valley, maybe clear up top.');
    expect(snowReport({ ...c, low: false }, 14, 100)).toContain('Sky: overcast.');
    // What is falling, and the night, are said before it.
    expect(snowReport({ ...c, falling: 0.8 }, 14, 100)).toContain('SNOWING');
    expect(snowReport({ ...c, watch: 'night' }, 14, 100)).toContain('dark and cloudy');
  });
});

