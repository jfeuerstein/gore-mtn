import { describe, expect, it } from 'vitest';
import { sayFresh } from './report';
import { freshFromForecast, inventedFresh, powderDepth } from './snowpack';

describe('how much loose snow is lying', () => {
  it('reads the new snow out of a forecast, and says nothing when the forecast does not', () => {
    expect(freshFromForecast({ daily: { snowfall_sum: [4.2, 7.7] } })).toBeCloseTo(11.9);
    expect(freshFromForecast({ daily: { snowfall_sum: [0, null, 'x'] } })).toBe(0);
    expect(freshFromForecast({ current: {} })).toBeNull();
    expect(freshFromForecast(null)).toBeNull();
    expect(freshFromForecast({ daily: { snowfall_sum: [500] } })).toBe(60);
  });

  it('makes a day up when it has to: the same every time, mostly little, now and then a lot', () => {
    const days = Array.from({ length: 200 }, (_, i) => `2026-${String(1 + Math.floor(i / 28)).padStart(2, '0')}-${String(1 + (i % 28)).padStart(2, '0')}`);
    const fresh = days.map(inventedFresh);
    expect(fresh).toEqual(days.map(inventedFresh));
    expect(Math.min(...fresh)).toBeGreaterThanOrEqual(0);
    expect(Math.max(...fresh)).toBeLessThanOrEqual(40);
    expect(fresh.filter((cm) => cm < 5).length).toBeGreaterThan(50);
    expect(fresh.filter((cm) => cm >= 16).length).toBeGreaterThan(15);
  });

  it('is deeper off the trails than on them, deeper after a snowfall, and only there in winter', () => {
    // A day with nothing new: the groomed trails are packed, the woods still have some.
    expect(powderDepth(0, 0, true, 'winter')).toBe(0);
    expect(powderDepth(0, 0, false, 'winter')).toBeGreaterThan(0.05);
    // A powder day.
    expect(powderDepth(25, 0, true, 'winter')).toBeGreaterThan(0.05);
    expect(powderDepth(25, 0, false, 'winter')).toBeGreaterThan(powderDepth(25, 0, true, 'winter') * 2);
    expect(powderDepth(25, 0, false, 'winter')).toBeGreaterThan(powderDepth(5, 0, false, 'winter'));
    // What is falling now lies on the trails too.
    expect(powderDepth(0, 1, true, 'winter')).toBeGreaterThan(0);
    // Never deeper than can be drawn, and never in the other seasons.
    expect(powderDepth(500, 1, false, 'winter')).toBeLessThanOrEqual(0.42);
    expect(powderDepth(500, 1, true, 'winter')).toBeLessThanOrEqual(0.18);
    for (const season of ['spring', 'summer', 'fall'] as const) expect(powderDepth(30, 1, false, season)).toBe(0);
  });

  it('says it in inches', () => {
    expect(sayFresh(20)).toBe('8 inches');
    expect(sayFresh(2.5)).toBe('1 inch');
  });
});

describe('the snow report', () => {
  it('says how much fell since yesterday, when it was enough to say', async () => {
    const { snowReport } = await import('./report');
    const day = { season: 'winter' as const, overcast: 0, falling: 0, watch: 'day' as const, day: '2026-12-02' };
    expect(snowReport({ ...day, fresh: 20 }, 14, 100)).toContain('New snow: 8 inches since yesterday.');
    expect(snowReport({ ...day, fresh: 1 }, 14, 100)).toContain('New snow: not since last time.');
    expect(snowReport(day, 14, 100)).toContain('New snow: not since last time.');
    // In summer there is none to report, whatever the sky's source says.
    expect(snowReport({ ...day, season: 'summer', fresh: 20 }, 14, 100)).toContain('New snow: no.');
  });
});
