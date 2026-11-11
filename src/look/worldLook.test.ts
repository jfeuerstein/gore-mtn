import { describe, expect, it } from 'vitest';
import { SEASONS } from './season';
import { enlarge, INKS, nearestInk, restyle } from './worldLook';

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
    restyle(p, 'plain', 'summer');
    expect([...colours(p)]).toEqual([(90 << 16) | (120 << 8) | 80]);
  });

  it('prints with the inks of the season and nothing else', () => {
    for (const season of SEASONS) {
      const p = new Uint8ClampedArray(16 * 16 * 4);
      for (let i = 0; i < p.length; i++) p[i] = (i * 37) % 256;
      restyle(p, 'poster', season);
      for (const c of colours(p)) expect(INKS[season], season).toContain(c);
    }
  });

  it('gives snow the palest ink and summer woods a green one', () => {
    expect(nearestInk(INKS.winter, 252, 252, 254)).toBe(INKS.winter[0]);
    const woods = nearestInk(INKS.summer, 0x4e, 0x6b, 0x43);
    expect((woods >> 8) & 255).toBeGreaterThan((woods >> 16) & 255);
    expect((woods >> 8) & 255).toBeGreaterThan(woods & 255);
  });
});

describe('enlarging a print', () => {
  // Two inks side by side: red on the left two columns, blue on the right two.
  const RED = [200, 30, 30];
  const BLUE = [30, 30, 200];
  const two = (): Uint8ClampedArray => {
    const p = new Uint8ClampedArray(4 * 4 * 4);
    for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) p.set([...(x < 2 ? RED : BLUE), 255], (y * 4 + x) * 4);
    return p;
  };

  it('uses only the inks that were there: nothing between red and blue', () => {
    const out = new Uint8ClampedArray(64 * 64 * 4);
    enlarge(two(), 4, 4, 0, 0, 4, 4, out, 64, 64);
    expect(colours(out)).toEqual(new Set([(200 << 16) | (30 << 8) | 30, (30 << 16) | (30 << 8) | 200]));
  });

  it('keeps the edge where it was, and straight', () => {
    const out = new Uint8ClampedArray(64 * 64 * 4);
    enlarge(two(), 4, 4, 0, 0, 4, 4, out, 64, 64);
    for (const row of [0, 17, 40, 63]) {
      const reds = Array.from({ length: 64 }, (_, x) => out[(row * 64 + x) * 4] === 200).filter(Boolean).length;
      expect(reds, `row ${row}`).toBe(32);
    }
  });

  it('turns a staircase into a slope', () => {
    // A diagonal: each row's red runs one pixel further than the row above.
    const p = new Uint8ClampedArray(8 * 8 * 4);
    for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) p.set([...(x <= y ? RED : BLUE), 255], (y * 8 + x) * 4);
    const out = new Uint8ClampedArray(80 * 80 * 4);
    enlarge(p, 8, 8, 0, 0, 8, 8, out, 80, 80);
    const reds = (row: number): number => Array.from({ length: 80 }, (_, x) => out[(row * 80 + x) * 4] === 200).filter(Boolean).length;
    // Down the middle of the picture the edge moves a little with every row, never in jumps of a whole old pixel.
    for (let row = 20; row < 60; row++) {
      const step = reds(row + 1) - reds(row);
      expect(step).toBeGreaterThanOrEqual(0);
      expect(step).toBeLessThanOrEqual(3);
    }
    expect(reds(60) - reds(20)).toBeGreaterThan(30);
  });

  it('can be done a few rows at a time, to the same end', () => {
    const whole = new Uint8ClampedArray(32 * 32 * 4);
    const parts = new Uint8ClampedArray(32 * 32 * 4);
    enlarge(two(), 4, 4, 0.5, 0.5, 3, 3, whole, 32, 32);
    for (let row = 0; row < 32; row += 5) enlarge(two(), 4, 4, 0.5, 0.5, 3, 3, parts, 32, 32, row, 5);
    expect([...parts]).toEqual([...whole]);
  });
});
