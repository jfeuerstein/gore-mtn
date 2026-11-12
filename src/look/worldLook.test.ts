import { describe, expect, it } from 'vitest';
import { SEASONS } from './season';
import { despeckle, freeze, ICE, inkAt, inkOrder, INKS, nearestInk, restyle, soften, weigh } from './worldLook';

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

describe('the ground drawn from the weights of its inks', () => {
  const RED = [200, 30, 30];
  const BLUE = [30, 30, 200];
  const GOLD = [220, 180, 40];
  const red = (200 << 16) | (30 << 8) | 30;
  const blue = (30 << 16) | (30 << 8) | 200;
  /** A square picture, each pixel in the ink asked for. */
  const picture = (size: number, ink: (x: number, y: number) => number[]): Uint8ClampedArray => {
    const p = new Uint8ClampedArray(size * size * 4);
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) p.set([...ink(x, y), 255], (y * size + x) * 4);
    return p;
  };
  /** A square part of a picture as the ground would draw it, `to` pixels a side: weighed, and the heaviest ink taken at each. */
  const grow = (p: Uint8ClampedArray, size: number, x0: number, y0: number, w: number, to: number): Uint8ClampedArray => {
    const order = inkOrder(p);
    const points = Math.round(w * 2) + 1;
    const weights = weigh(soften(p, size, size, x0, y0, w, w), x0, y0, w, w, points, points, order);
    const out = new Uint8ClampedArray(to * to * 4);
    for (let y = 0; y < to; y++) {
      for (let x = 0; x < to; x++) {
        const ink = order[inkAt(weights, (x + 0.5) / to, (y + 0.5) / to)] as number;
        out.set([(ink >> 16) & 255, (ink >> 8) & 255, ink & 255, 255], (y * to + x) * 4);
      }
    }
    return out;
  };
  const isRed = (out: Uint8ClampedArray, to: number, x: number, y: number): boolean => out[(y * to + x) * 4] === 200;
  /** How many pixels of a row are red. */
  const reds = (out: Uint8ClampedArray, to: number, row: number): number => Array.from({ length: to }, (_, x) => isRed(out, to, x, row)).filter(Boolean).length;
  // Two inks side by side: red on the left half, blue on the right.
  const two = (): Uint8ClampedArray => picture(4, (x) => (x < 2 ? RED : BLUE));

  it('uses only the inks that were there: nothing between red and blue', () => {
    expect(colours(grow(two(), 4, 0, 0, 4, 64))).toEqual(new Set([red, blue]));
  });

  it('keeps a straight edge where it was, and straight', () => {
    const out = grow(two(), 4, 0, 0, 4, 64);
    for (const row of [0, 17, 40, 63]) expect(reds(out, 64, row), `row ${row}`).toBe(32);
  });

  it('turns a staircase into a slope', () => {
    // A diagonal: each row's red runs one pixel further than the row above.
    const out = grow(picture(16, (x, y) => (x <= y ? RED : BLUE)), 16, 4, 4, 8, 80);
    // The edge moves a little with every row, never in jumps of a whole old pixel.
    for (let row = 10; row < 70; row++) {
      const step = reds(out, 80, row + 1) - reds(out, 80, row);
      expect(step).toBeGreaterThanOrEqual(0);
      expect(step).toBeLessThanOrEqual(2);
    }
    expect(reds(out, 80, 70) - reds(out, 80, 10)).toBeGreaterThan(50);
  });

  it('wears stairs two pixels deep down to a slope too', () => {
    // Red below a slanting edge drawn in steps four pixels long and two high, as a trail's side is.
    const out = grow(picture(48, (x, y) => (y >= 2 * Math.floor(x / 4) + 8 ? RED : BLUE)), 48, 8, 8, 32, 320);
    // How far down each column the red begins. Drawn, it stood still for forty columns and then dropped twenty rows.
    const edge = (x: number): number => Array.from({ length: 320 }, (_, y) => isRed(out, 320, x, y)).indexOf(true);
    let steepest = 0;
    for (let x = 40; x < 280; x++) {
      const step = edge(x + 1) - edge(x);
      expect(step).toBeGreaterThanOrEqual(-1);
      steepest = Math.max(steepest, step);
    }
    expect(steepest).toBeLessThanOrEqual(2);
    // And over any forty columns it comes down about twenty rows: a slope, not a flat and a drop.
    for (let x = 40; x < 240; x += 10) {
      const fall = edge(x + 40) - edge(x);
      expect(fall, `from column ${x}`).toBeGreaterThanOrEqual(16);
      expect(fall, `from column ${x}`).toBeLessThanOrEqual(24);
    }
  });

  it('rounds a square corner off, as scissors would', () => {
    // A red square in the top left quarter of a blue field.
    const out = grow(picture(16, (x, y) => (x < 8 && y < 8 ? RED : BLUE)), 16, 0, 0, 16, 160);
    const at = (x: number, y: number): boolean => isRed(out, 160, x, y);
    // Well inside it is red and well outside blue; the very corner, which a plain stretch would keep, is cut away.
    expect(at(40, 40)).toBe(true);
    expect(at(120, 120)).toBe(false);
    expect(at(78, 78)).toBe(false);
    // Away from the corner the edge is where it was.
    expect(at(78, 20)).toBe(true);
    expect(at(81, 20)).toBe(false);
    expect(at(20, 78)).toBe(true);
    // And the cut is a curve: going down the picture the edge draws in little by little.
    const widths = [40, 50, 60, 66, 70, 74, 77].map((y) => reds(out, 160, y));
    for (let i = 1; i < widths.length; i++) expect(widths[i] as number).toBeLessThanOrEqual(widths[i - 1] as number);
    expect(widths[0] as number).toBeGreaterThan((widths[widths.length - 1] as number) + 5);
  });

  it('takes a bump off a straight edge', () => {
    // Red above, blue below, and one red pixel standing out of the edge.
    const out = grow(picture(16, (x, y) => (y < 8 || (x === 8 && y === 8) ? RED : BLUE)), 16, 0, 0, 16, 160);
    expect(isRed(out, 160, 85, 85)).toBe(false);
    expect(isRed(out, 160, 85, 70)).toBe(true);
  });

  it('keeps a line one pixel wide, at its own width', () => {
    const out = grow(picture(16, (x) => (x === 8 ? RED : BLUE)), 16, 0, 0, 16, 160);
    for (const row of [30, 80, 130]) {
      expect(reds(out, 160, row)).toBeGreaterThanOrEqual(9);
      expect(reds(out, 160, row)).toBeLessThanOrEqual(13);
    }
  });

  it('keeps a track two pixels wide through the woods, and a slanting one unbroken', () => {
    const out = grow(picture(16, (x) => (x === 7 || x === 8 ? RED : BLUE)), 16, 0, 0, 16, 160);
    expect(reds(out, 160, 80)).toBeGreaterThanOrEqual(18);
    expect(reds(out, 160, 80)).toBeLessThanOrEqual(24);
    const slant = grow(picture(24, (x, y) => (x === y || x === y + 1 ? RED : BLUE)), 24, 4, 4, 16, 160);
    for (let row = 5; row < 155; row++) expect(reds(slant, 160, row), `row ${row}`).toBeGreaterThan(5);
  });

  it('lays a path over the edge it runs along', () => {
    // A gold path one pixel wide between red above it and blue below.
    const out = grow(picture(16, (_x, y) => (y === 8 ? GOLD : y < 8 ? RED : BLUE)), 16, 0, 0, 16, 160);
    expect(colours(out).size).toBe(3);
    expect(out[(85 * 160 + 80) * 4]).toBe(220);
    expect(isRed(out, 160, 80, 70)).toBe(true);
    expect(out[(100 * 160 + 80) * 4]).toBe(30);
  });

  it('gives two parts side by side the same answer where they meet', () => {
    // Blobs of two inks, and two parts of them that share an edge.
    const p = picture(64, (x, y) => (Math.sin(x * 0.7) + Math.cos(y * 0.5 + x * 0.2) + Math.sin((x + y) * 0.31) > 0.2 ? RED : BLUE));
    const order = inkOrder(p);
    const left = weigh(soften(p, 64, 64, 8, 8, 24, 24), 8, 8, 24, 24, 49, 49, order);
    const right = weigh(soften(p, 64, 64, 32, 8, 24, 24), 32, 8, 24, 24, 49, 49, order);
    let changes = 0;
    for (let i = 0; i <= 400; i++) {
      expect(inkAt(left, 1, i / 400), `at ${i}`).toBe(inkAt(right, 0, i / 400));
      if (i > 0 && inkAt(left, 1, i / 400) !== inkAt(left, 1, (i - 1) / 400)) changes++;
    }
    // (And the edge does cross from one ink to the other, or this would show nothing.)
    expect(changes).toBeGreaterThan(0);
  });

  it('can be weighed a few rows at a time, to the same end', () => {
    const p = picture(16, (x, y) => (x <= y ? RED : BLUE));
    const order = inkOrder(p);
    const piece = soften(p, 16, 16, 2.5, 2.5, 9, 9);
    const whole = weigh(piece, 2.5, 2.5, 9, 9, 19, 19, order);
    let parts = weigh(piece, 2.5, 2.5, 9, 9, 19, 19, order, null, 0, 0);
    for (let row = 0; row < 19; row += 5) parts = weigh(piece, 2.5, 2.5, 9, 9, 19, 19, order, parts, row, 5);
    expect([...parts.a]).toEqual([...whole.a]);
    expect([...parts.b]).toEqual([...whole.b]);
  });

  it('weighs as many inks as a season has, the commonest first', () => {
    // Nine inks in stripes of unequal width.
    const widths = [9, 8, 7, 6, 5, 4, 4, 3, 2];
    const stripe = (x: number): number => {
      let k = 0;
      for (let left = x; left >= (widths[k] as number); k++) left -= widths[k] as number;
      return k;
    };
    const p = picture(48, (x) => [20 + stripe(x) * 25, 100, 200 - stripe(x) * 20]);
    const order = inkOrder(p);
    expect(order).toHaveLength(9);
    expect(order[0]).toBe((20 << 16) | (100 << 8) | 200);
    const out = grow(p, 48, 0, 0, 48, 480);
    expect(colours(out)).toEqual(new Set(order));
    // Each stripe is still where it was.
    let x = 0;
    widths.forEach((width, k) => {
      const mid = Math.round((x + width / 2) * 10);
      expect(out[(240 * 480 + mid) * 4], `stripe ${k}`).toBe(20 + k * 25);
      x += width;
    });
  });

  it('leaves a plain field plain', () => {
    expect(colours(grow(picture(24, () => RED), 24, 4, 4, 16, 64))).toEqual(new Set([red]));
  });
});

describe('taking the specks out of a print', () => {
  const RED = [200, 30, 30];
  const BLUE = [30, 30, 200];
  const field = (set: (x: number, y: number) => boolean): Uint8ClampedArray => {
    const p = new Uint8ClampedArray(8 * 8 * 4);
    for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) p.set([...(set(x, y) ? RED : BLUE), 255], (y * 8 + x) * 4);
    return p;
  };
  const red = (p: Uint8ClampedArray, x: number, y: number): boolean => p[(y * 8 + x) * 4] === 200;

  it('removes a pixel that stands alone, and a pair is a speck too', () => {
    const one = field((x, y) => x === 3 && y === 3);
    despeckle(one, 8, 8);
    expect(red(one, 3, 3)).toBe(false);
    const pair = field((x, y) => y === 3 && (x === 3 || x === 4));
    despeckle(pair, 8, 8);
    expect(red(pair, 3, 3)).toBe(false);
    expect(red(pair, 4, 3)).toBe(false);
  });

  it('leaves a line one pixel wide, and a field, as they were', () => {
    const line = field((x) => x === 4);
    const before = [...line];
    despeckle(line, 8, 8);
    expect([...line]).toEqual(before);
    const half = field((x) => x < 4);
    const was = [...half];
    despeckle(half, 8, 8);
    expect([...half]).toEqual(was);
  });
});

describe('freezing the water in a winter picture', () => {
  it('prints ice where the map says there is water, and nowhere else', () => {
    // A picture eight pixels square over a map four squares across: each square is two pixels by two.
    const p = new Uint8ClampedArray(8 * 8 * 4).fill(200);
    freeze(p, 8, 8, 4, 4, (i, j) => i === 1 && j === 2);
    const ice = (x: number, y: number): boolean => ((p[(y * 8 + x) * 4] as number) << 16 | (p[(y * 8 + x) * 4 + 1] as number) << 8 | (p[(y * 8 + x) * 4 + 2] as number)) === ICE;
    let frozen = 0;
    for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) if (ice(x, y)) frozen++;
    expect(frozen).toBe(4);
    expect(ice(2, 4) && ice(3, 4) && ice(2, 5) && ice(3, 5)).toBe(true);
  });

  it('uses an ink that is winter\'s own, and that nothing in the pictures is mistaken for', () => {
    expect(INKS.winter).toContain(ICE);
    // Snow in every shade the pipeline paints it is nearer some other ink.
    for (const [r, g, b] of [[255, 255, 255], [232, 238, 246], [200, 214, 235], [150, 170, 205], [90, 110, 150]] as const) expect(nearestInk(INKS.winter, r, g, b)).not.toBe(ICE);
  });
});
