import { describe, expect, it } from 'vitest';
import { SEASONS } from './season';
import { heightUnder, INKS, nearestInk, restyle, type Heights } from './worldLook';

/** A slope that climbs a metre for every column, the same in every row. */
const slope: Heights = { cols: 64, rows: 4, data: Float32Array.from({ length: 64 * 4 }, (_, i) => i % 64) };
const picture = (w: number, h: number, colour: [number, number, number]): Uint8ClampedArray => {
  const out = new Uint8ClampedArray(w * h * 4);
  for (let i = 0; i < w * h; i++) out.set([...colour, 255], i * 4);
  return out;
};
const colours = (rgba: Uint8ClampedArray): Set<number> => {
  const out = new Set<number>();
  for (let i = 0; i < rgba.length; i += 4) out.add(((rgba[i] as number) << 16) | ((rgba[i + 1] as number) << 8) | (rgba[i + 2] as number));
  return out;
};

describe('world looks', () => {
  it('leaves the plain look alone', () => {
    const p = picture(8, 4, [90, 120, 80]);
    restyle(p, 8, 4, 'plain', 'summer', slope, 10);
    expect([...colours(p)]).toEqual([(90 << 16) | (120 << 8) | 80]);
  });

  it('prints with the inks of the season and nothing else', () => {
    for (const season of SEASONS) {
      const p = new Uint8ClampedArray(16 * 16 * 4);
      for (let i = 0; i < p.length; i++) p[i] = (i * 37) % 256;
      restyle(p, 16, 16, 'poster', season, slope, 10);
      for (const c of colours(p)) expect(INKS[season], season).toContain(c);
    }
  });

  it('gives snow the palest ink and summer woods a green one', () => {
    expect(nearestInk(INKS.winter, 252, 252, 254)).toBe(INKS.winter[0]);
    const woods = nearestInk(INKS.summer, 0x4e, 0x6b, 0x43);
    expect((woods >> 8) & 255).toBeGreaterThan((woods >> 16) & 255);
    expect((woods >> 8) & 255).toBeGreaterThan(woods & 255);
  });

  it('reads the height under any point of the picture', () => {
    expect(heightUnder(slope, 0, 0.5)).toBe(0);
    expect(heightUnder(slope, 1, 0.5)).toBe(63);
    expect(heightUnder(slope, 0.5, 0.5)).toBeCloseTo(31.5);
  });

  it('draws a contour across a slope at every round height, every fifth one heavier', () => {
    const w = 640;
    const p = picture(w, 4, [0x4e, 0x6b, 0x43]);
    restyle(p, w, 4, 'topo', 'summer', slope, 10);
    const row = Array.from({ length: w }, (_, x) => ((p[x * 4] as number) << 16) | ((p[x * 4 + 1] as number) << 8) | (p[x * 4 + 2] as number));
    const ground = row[20] as number;
    const lines = row.map((c, x) => (c === ground ? -1 : x)).filter((x) => x >= 0);
    // 63 m of climb crosses 10, 20 ... 60 m: six lines, each one pixel wide.
    expect(lines).toHaveLength(6);
    const inks = new Set(lines.map((x) => row[x]));
    // 50 m is the heavy one.
    expect(inks.size).toBe(2);
    // The same in every row of a slope that does not change down the picture.
    expect(colours(p).size).toBe(3);
  });
});
