import { describe, expect, it } from 'vitest';
import { inkFor, INKS, OUTLINE, rim, rimmed } from './print';

/** A cube from -1 to 1, as twelve triangles facing outward. */
function cube(): number[] {
  const out: number[] = [];
  const quad = (a: number[], b: number[], c: number[], d: number[]): void => {
    out.push(...a, ...b, ...c, ...a, ...c, ...d);
  };
  for (const axis of [0, 1, 2]) {
    for (const side of [-1, 1]) {
      const u = (axis + 1) % 3;
      const v = (axis + 2) % 3;
      const corner = (su: number, sv: number): number[] => {
        const p = [0, 0, 0];
        p[axis] = side;
        p[u] = su;
        p[v] = sv;
        return p;
      };
      // Wound so that the face looks outward on either side.
      if (side > 0) quad(corner(-1, -1), corner(1, -1), corner(1, 1), corner(-1, 1));
      else quad(corner(-1, -1), corner(-1, 1), corner(1, 1), corner(1, -1));
    }
  }
  return out;
}

const facing = (tri: ArrayLike<number>, t: number): number[] => {
  const p = (k: number): number[] => [tri[(t + k) * 3] as number, tri[(t + k) * 3 + 1] as number, tri[(t + k) * 3 + 2] as number];
  const [a, b, c] = [p(0), p(1), p(2)] as [number[], number[], number[]];
  const u = [0, 1, 2].map((i) => (b[i] as number) - (a[i] as number));
  const v = [0, 1, 2].map((i) => (c[i] as number) - (a[i] as number));
  return [(u[1] as number) * (v[2] as number) - (u[2] as number) * (v[1] as number), (u[2] as number) * (v[0] as number) - (u[0] as number) * (v[2] as number), (u[0] as number) * (v[1] as number) - (u[1] as number) * (v[0] as number)];
};

describe('inks', () => {
  it('gives every colour one of the inks, and an ink itself', () => {
    for (const ink of INKS) expect(inkFor(ink)).toBe(ink);
    for (const colour of [0x123456, 0xffffff, 0x000000, 0x7f7f7f, 0xff00ff]) expect(INKS).toContain(inkFor(colour));
    expect(INKS).toContain(OUTLINE);
  });

  it('keeps a colour in its family: red stays red, green green, pale pale', () => {
    const channels = (c: number): [number, number, number] => [(c >> 16) & 255, (c >> 8) & 255, c & 255];
    const [r1, g1, b1] = channels(inkFor(0xd0352b));
    expect(r1).toBeGreaterThan(g1 + 60);
    expect(r1).toBeGreaterThan(b1 + 60);
    const [r2, g2, b2] = channels(inkFor(0x3a7a4a));
    expect(g2).toBeGreaterThan(r2);
    expect(g2).toBeGreaterThan(b2);
    const [r3, g3, b3] = channels(inkFor(0xf0ede4));
    expect(Math.min(r3, g3, b3)).toBeGreaterThan(200);
  });

  it('has no two inks so alike that they could be mistaken', () => {
    for (let i = 0; i < INKS.length; i++) {
      for (let j = i + 1; j < INKS.length; j++) {
        const a = INKS[i] as number;
        const b = INKS[j] as number;
        const d = Math.abs(((a >> 16) & 255) - ((b >> 16) & 255)) + Math.abs(((a >> 8) & 255) - ((b >> 8) & 255)) + Math.abs((a & 255) - (b & 255));
        expect(d, `${a.toString(16)} and ${b.toString(16)}`).toBeGreaterThan(18);
      }
    }
  });
});

describe('the rim round a shape', () => {
  it('is the same shape, every face a width further out, and inside out', () => {
    const shape = cube();
    const out = rim(shape, 0.1);
    expect(out.length).toBe(shape.length);
    // A cube from -1 to 1 becomes one from -1.1 to 1.1: square corners are mitred.
    for (let i = 0; i < out.length; i++) expect(Math.abs(out[i] as number)).toBeCloseTo(1.1, 5);
    // Every triangle of the rim faces the other way from the one it came from.
    for (let t = 0; t < shape.length / 3; t += 3) {
      const was = facing(shape, t);
      const now = facing(out, t);
      const dot = (was[0] as number) * (now[0] as number) + (was[1] as number) * (now[1] as number) + (was[2] as number) * (now[2] as number);
      expect(dot).toBeLessThan(0);
    }
  });

  it('stays in one piece: corners that met still meet', () => {
    const shape = cube();
    const out = rim(shape, 0.25);
    const places = new Set<string>();
    for (let i = 0; i < out.length; i += 3) places.add(`${(out[i] as number).toFixed(3)},${(out[i + 1] as number).toFixed(3)},${(out[i + 2] as number).toFixed(3)}`);
    expect(places.size).toBe(8);
  });

  it('is given to what makes an outline, not to posts, rails and panes', () => {
    expect(rimmed(10, 3, 0.3)).toBe(true);
    expect(rimmed(0.6, 1.5, 0.6)).toBe(true);
    expect(rimmed(0.15, 3, 0.15)).toBe(false);
    expect(rimmed(0.08, 0.1, 4)).toBe(false);
    expect(rimmed(1, 1, 0.05)).toBe(false);
  });
});
