import { describe, expect, it } from 'vitest';
import { clearPalette, luminance, mixColour, paletteFor, type Palette } from './palette';

const CLEAR = { overcast: 0, snowing: 0 };
const SNOW = { overcast: 1, snowing: 1 };
const CLOUD = { overcast: 1, snowing: 0 };
/** Roughly how bright lit snow is: ambient plus direct light. */
const brightness = (p: Palette) => luminance(p.ambientSky) * p.ambientIntensity + luminance(p.lightColour) * p.lightIntensity;
const warmth = (c: number) => ((c >> 16) & 255) - (c & 255);

describe('mixColour', () => {
  it('blends each channel', () => {
    expect(mixColour(0x000000, 0xffffff, 0.5)).toBe(0x808080);
    expect(mixColour(0xff0000, 0x0000ff, 0)).toBe(0xff0000);
    expect(mixColour(0xff0000, 0x0000ff, 1)).toBe(0x0000ff);
  });
});

describe('clearPalette', () => {
  it('is brightest by day and darkest at night, without a dip in between', () => {
    const levels = [-30, -12, -5, -0.5, 6, 22, 60].map((el) => brightness(clearPalette(el)));
    expect(levels[0]).toBeCloseTo(levels[1] as number); // deep night is all the same
    expect(levels[6]).toBeCloseTo(levels[5] as number); // so is a high sun
    expect(levels[5]).toBeGreaterThan((levels[1] as number) * 2);
    // Golden hour and day are both properly lit.
    expect(levels[4]).toBeGreaterThan((levels[3] as number) * 1.3);
  });

  it('is warm when the sun is low and neutral when it is high', () => {
    expect(warmth(clearPalette(6).lightColour)).toBeGreaterThan(100);
    expect(warmth(clearPalette(40).lightColour)).toBeLessThan(60);
    expect(warmth(clearPalette(6).skyHorizon)).toBeGreaterThan(warmth(clearPalette(40).skyHorizon));
  });

  it('has next to no direct light a few degrees after sunset, where sun hands over to moon', () => {
    expect(clearPalette(-5).lightIntensity).toBeLessThan(0.15);
    expect(clearPalette(-20).lightIntensity).toBeGreaterThan(0.5);
  });

  it('keeps night light enough to ski by', () => {
    const night = clearPalette(-40);
    expect(brightness(night)).toBeGreaterThan(0.9);
    expect(luminance(night.snowTint)).toBeGreaterThan(0.85);
  });

  it('changes smoothly as the sun moves', () => {
    for (let el = -15; el < 30; el += 0.5) {
      const a = clearPalette(el);
      const b = clearPalette(el + 0.5);
      expect(Math.abs(brightness(a) - brightness(b)), `near ${el} degrees`).toBeLessThan(0.25);
      expect(Math.abs(luminance(a.skyHorizon) - luminance(b.skyHorizon)), `near ${el} degrees`).toBeLessThan(0.06);
    }
  });
});

describe('paletteFor', () => {
  it('leaves a clear sky alone', () => {
    expect(paletteFor(30, CLEAR)).toMatchObject({ ...clearPalette(30), snowfall: 0 });
  });

  it('closes the view in when it snows, by day and by night', () => {
    expect(paletteFor(30, SNOW).fogFar).toBeLessThan(1300);
    expect(paletteFor(-30, SNOW).fogFar).toBeLessThan(1300);
    expect(paletteFor(30, SNOW).snowfall).toBe(1);
    expect(paletteFor(30, SNOW).discShown).toBe(0);
  });

  it('flattens the light under cloud but leaves a long view when nothing is falling', () => {
    const cloudy = paletteFor(30, CLOUD);
    expect(cloudy.lightIntensity).toBeLessThan(clearPalette(30).lightIntensity * 0.5);
    expect(cloudy.fogFar).toBeGreaterThan(2000);
    expect(cloudy.snowfall).toBe(0);
  });

  it('is in between for in-between weather', () => {
    const half = paletteFor(30, { overcast: 0.5, snowing: 0.5 });
    expect(half.fogFar).toBeGreaterThan(paletteFor(30, SNOW).fogFar);
    expect(half.fogFar).toBeLessThan(paletteFor(30, CLEAR).fogFar);
    expect(half.snowfall).toBeCloseTo(0.5);
  });

  it('keeps a snowy night darker than a snowy day but still readable', () => {
    expect(brightness(paletteFor(-30, SNOW))).toBeLessThan(brightness(paletteFor(30, SNOW)));
    expect(brightness(paletteFor(-30, SNOW))).toBeGreaterThan(0.8);
  });

  it('lights the windows after dark and in falling snow, and not on a clear day', () => {
    expect(paletteFor(35, CLEAR).lamps).toBe(0);
    expect(paletteFor(-20, CLEAR).lamps).toBe(1);
    expect(paletteFor(-3, CLEAR).lamps).toBeGreaterThan(0.8);
    expect(paletteFor(35, SNOW).lamps).toBeGreaterThan(0.4);
    expect(paletteFor(35, SNOW).lamps).toBeLessThan(0.8);
  });

  it('always keeps the snow lighter than a ski track and haze that thickens with distance', () => {
    for (const el of [-40, -8, -2, 3, 10, 35]) {
      for (const w of [CLEAR, CLOUD, SNOW]) {
        const p = paletteFor(el, w);
        expect(luminance(p.track), `${el}`).toBeLessThan(luminance(p.snowTint));
        expect(p.fogFar).toBeGreaterThan(p.fogNear);
      }
    }
  });
});
