import { describe, expect, it } from 'vitest';
import { paletteFor } from './palette';
import { airFor, SEASON_LOOK, seasonFor, seasonPalette, SEASONS, tintColour, treeLook } from './season';

const on = (month: number, day: number) => new Date(2026, month - 1, day, 12);

describe('seasonFor', () => {
  it('follows the calendar', () => {
    expect(seasonFor(on(1, 15))).toBe('winter');
    expect(seasonFor(on(3, 31))).toBe('winter');
    expect(seasonFor(on(4, 1))).toBe('spring');
    expect(seasonFor(on(5, 31))).toBe('spring');
    expect(seasonFor(on(6, 1))).toBe('summer');
    expect(seasonFor(on(9, 14))).toBe('summer');
    expect(seasonFor(on(9, 15))).toBe('fall');
    expect(seasonFor(on(11, 9))).toBe('fall');
    expect(seasonFor(on(11, 10))).toBe('winter');
    expect(seasonFor(on(12, 31))).toBe('winter');
  });

  it('gives every day of the year a season', () => {
    const seen = new Set<string>();
    for (let d = 0; d < 366; d++) seen.add(seasonFor(new Date(2028, 0, 1 + d)));
    expect([...seen].sort()).toEqual([...SEASONS].sort());
  });
});

describe('the seasons', () => {
  it('ski on snow and bike on grass', () => {
    for (const s of SEASONS) expect(SEASON_LOOK[s].ride, s).toBe(SEASON_LOOK[s].snow ? 'skis' : 'bike');
    expect(SEASON_LOOK.winter.falling).toBe('snow');
    expect(SEASON_LOOK.summer.falling).toBe('rain');
  });

  it('leave the winter palette exactly as the owner chose it', () => {
    const p = paletteFor(30, { overcast: 0, snowing: 0 });
    expect(seasonPalette(p, 'winter')).toBe(p);
  });

  it('recolour the land in the other seasons but keep the sky and the light', () => {
    const p = paletteFor(30, { overcast: 0, snowing: 0 });
    for (const s of ['spring', 'summer', 'fall'] as const) {
      const q = seasonPalette(p, s);
      expect(q.plain, s).not.toBe(p.plain);
      expect(q.skyTop).toBe(p.skyTop);
      expect(q.lightColour).toBe(p.lightColour);
      expect(q.snowTint).toBe(p.snowTint);
    }
    expect(seasonPalette(p, 'summer').track).not.toBe(p.track);
    expect(seasonPalette(p, 'spring').track).toBe(p.track);
  });
});

describe('treeLook', () => {
  it('leaves winter to the snowy fir', () => {
    expect(treeLook('winter', 1, 0.2, 0.5)).toBeNull();
  });

  it('dresses hardwoods low down and conifers high up', () => {
    const maple = treeLook('fall', 1, 0.5, 0.1);
    const fir = treeLook('fall', 0, 0.5, 0.1);
    expect(SEASON_LOOK.fall.hardwoods).toContain(maple);
    expect(SEASON_LOOK.fall.conifers).toContain(fir);
    // A hardwood stands wider and lower than a fir, except bare in spring.
    expect(maple?.wide).toBeGreaterThan(fir?.wide ?? 0);
    expect(treeLook('spring', 1, 0.5, 0)?.wide).toBeLessThan(0.7);
  });

  it('can pick every look, and never runs off the end of the list', () => {
    const seen = new Set<number>();
    for (let roll = 0; roll <= 1; roll += 0.01) seen.add(treeLook('fall', 1, 0, roll)?.colour ?? 0);
    expect(seen.size).toBe(SEASON_LOOK.fall.hardwoods?.length);
    expect(treeLook('fall', 1, 0, 1)).not.toBeUndefined();
  });
});

describe('airFor', () => {
  it('snows in winter and rains in summer', () => {
    expect(airFor('winter', 0.8, 20)).toEqual({ kind: 'snow', amount: 0.8 });
    expect(airFor('summer', 0.8, 20)).toEqual({ kind: 'rain', amount: 0.8 });
  });

  it('drifts leaves on a fair fall day and fireflies on a summer night', () => {
    expect(airFor('fall', 0, 20).kind).toBe('leaves');
    expect(airFor('fall', 0, -10).amount).toBe(0);
    expect(airFor('summer', 0, -10).kind).toBe('fireflies');
    expect(airFor('summer', 0, 20).amount).toBe(0);
    expect(airFor('winter', 0, -10).amount).toBe(0);
  });
});

describe('tintColour', () => {
  it('multiplies channel by channel', () => {
    expect(tintColour(0xffffff, 0x123456)).toBe(0x123456);
    expect(tintColour(0x808080, 0xff0000)).toBe(0x800000);
  });
});
