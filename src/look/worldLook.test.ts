import { describe, expect, it } from 'vitest';
import { SEASONS } from './season';
import { INKS, nearestInk, restyle } from './worldLook';

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
