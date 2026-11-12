import { describe, expect, it } from 'vitest';
import { GEAR } from './people';
import { emptySave } from './save';
import { auroraOn, cloudSea, METEORS_FOR_SKIS, sawSight, showerOn, SHOWERS, SIGHTS } from './sky';

describe('what is in the sky now and then', () => {
  it('has shooting stars on the nights of the real showers, and on no others', () => {
    expect(showerOn('2026-08-12')?.name).toBe('the Perseids');
    expect(showerOn('2026-11-17')?.name).toBe('the Leonids');
    expect(showerOn('2026-12-14')?.name).toBe('the Geminids');
    expect(showerOn('2026-11-12')).toBeNull();
    expect(showerOn('2026-07-04')).toBeNull();
    for (const s of SHOWERS) expect(s.to - s.from, s.name).toBeLessThan(6);
  });

  it('has the northern lights now and then in the dark half of the year, and never in summer', () => {
    let nights = 0;
    let dark = 0;
    for (let m = 1; m <= 12; m++) {
      for (let d = 1; d <= 28; d++) {
        const day = `2026-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        if (m > 3 && m < 9) expect(auroraOn(day), day).toBe(false);
        else {
          dark++;
          if (auroraOn(day)) nights++;
        }
        // The same night for everybody.
        expect(auroraOn(day)).toBe(auroraOn(day));
      }
    }
    expect(nights / dark).toBeGreaterThan(0.08);
    expect(nights / dark).toBeLessThan(0.3);
  });

  it('has a sea of cloud on a morning of low cloud with nothing falling', () => {
    expect(cloudSea(1, 0, 7)).toBe(true);
    expect(cloudSea(1, 0, 14)).toBe(false);
    expect(cloudSea(0, 0, 7)).toBe(false);
    expect(cloudSea(1, 0.8, 7)).toBe(false);
  });

  it('keeps each the first time, with something to wear that the wardrobe has', () => {
    const gear = new Set(GEAR.map((g) => g.id));
    const save = emptySave();
    const cloud = sawSight(save, 'sky-cloud', '2026-11-12');
    expect(cloud).toEqual({ first: true, gear: ['goggles-snow'] });
    save.gear.owned.push(...cloud.gear);
    expect(sawSight(save, 'sky-cloud', '2026-11-13')).toEqual({ first: false, gear: [] });
    // A few shooting stars are not yet enough for the skis; enough of them are.
    save.meteors = METEORS_FOR_SKIS - 1;
    expect(sawSight(save, 'sky-meteors', '2026-11-17').gear).toEqual([]);
    save.meteors = METEORS_FOR_SKIS;
    expect(sawSight(save, 'sky-meteors', '2026-11-17').gear).toEqual(['skis-night']);
    // The northern lights earn the same skis, for whoever has not had them.
    expect(sawSight(emptySave(), 'sky-aurora', '2026-11-12').gear).toEqual(['skis-night']);
    for (const id of ['goggles-snow', 'skis-night']) expect(gear.has(id), id).toBe(true);
    expect(new Set(SIGHTS.map((s) => s.id)).size).toBe(3);
  });
});
