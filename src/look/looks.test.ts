import { describe, expect, it } from 'vitest';
import { DEFAULT_LOOK, lookById, LOOKS } from './looks';

const luminance = (c: number): number => (0.2126 * ((c >> 16) & 255) + 0.7152 * ((c >> 8) & 255) + 0.0722 * (c & 255)) / 255;

describe('looks', () => {
  it('offers several, each with its own id and name', () => {
    expect(LOOKS.length).toBeGreaterThanOrEqual(4);
    expect(new Set(LOOKS.map((l) => l.id)).size).toBe(LOOKS.length);
    expect(new Set(LOOKS.map((l) => l.name)).size).toBe(LOOKS.length);
  });

  it('finds a look by id and falls back to the default', () => {
    expect(lookById('golden').name).toBe('Golden hour');
    expect(lookById('no-such-look').id).toBe(DEFAULT_LOOK);
    expect(lookById(null).id).toBe(DEFAULT_LOOK);
  });

  it.each(LOOKS.map((l) => [l.id, l] as const))('%s is well formed', (_id, look) => {
    // The sun is above the horizon and its direction is roughly a unit vector.
    const [x, y, z] = look.sun.direction;
    expect(y).toBeGreaterThan(0.1);
    expect(Math.hypot(x, y, z)).toBeGreaterThan(0.9);
    expect(Math.hypot(x, y, z)).toBeLessThan(1.1);
    // Haze thickens with distance.
    expect(look.fog.far).toBeGreaterThan(look.fog.near);
    // Trees are built bottom tier first, each tier a real cone, the top one reaching full height.
    const tiers = look.trees.tiers;
    expect(tiers.length).toBeGreaterThanOrEqual(2);
    for (const t of tiers) {
      expect(t.y1).toBeGreaterThan(t.y0);
      expect(t.sides).toBeGreaterThanOrEqual(4);
    }
    for (let i = 1; i < tiers.length; i++) expect((tiers[i] as (typeof tiers)[number]).y0).toBeGreaterThan((tiers[i - 1] as (typeof tiers)[number]).y0);
    expect(tiers.at(-1)?.y1).toBeCloseTo(3.6);
    expect(tiers[0]?.radius).toBeLessThanOrEqual(1.05);
    // Snow stays light, trees stay darker than snow: the trail must read against the forest.
    expect(luminance(look.snowTint)).toBeGreaterThan(0.9);
    expect(luminance(look.trees.tiers[0]?.base ?? 0)).toBeLessThan(0.45);
    // A ski track is a little darker than the snow, never darker than the trees.
    expect(luminance(look.track)).toBeLessThan(luminance(look.snowTint));
    expect(luminance(look.track)).toBeGreaterThan(0.55);
  });

  it('keeps the looks visibly different in sky and light', () => {
    for (let i = 0; i < LOOKS.length; i++) {
      for (let j = i + 1; j < LOOKS.length; j++) {
        const a = LOOKS[i] as (typeof LOOKS)[number];
        const b = LOOKS[j] as (typeof LOOKS)[number];
        expect(a.sky.top === b.sky.top && a.sun.colour === b.sun.colour, `${a.id} and ${b.id}`).toBe(false);
      }
    }
  });
});
