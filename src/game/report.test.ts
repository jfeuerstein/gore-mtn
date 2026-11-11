import { describe, expect, it } from 'vitest';
import { snowReport, type Conditions } from './report';

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
