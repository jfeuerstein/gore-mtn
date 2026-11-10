import { describe, expect, it } from 'vitest';
import { distanceToMask } from './distance';

describe('distanceToMask', () => {
  // 7 x 5 grid with one marked sample at column 2, row 2; cells are 10 units.
  const cols = 7;
  const rows = 5;
  const mask = new Uint8Array(cols * rows);
  mask[2 * cols + 2] = 255;
  const d = distanceToMask(mask, cols, rows, 10);
  const at = (c: number, r: number) => d[r * cols + c] as number;

  it('is zero on the mask', () => {
    expect(at(2, 2)).toBe(0);
  });

  it('counts straight steps exactly', () => {
    expect(at(5, 2)).toBeCloseTo(30);
    expect(at(2, 0)).toBeCloseTo(20);
    expect(at(0, 2)).toBeCloseTo(20);
  });

  it('counts diagonal steps at root two', () => {
    expect(at(4, 4)).toBeCloseTo(20 * Math.SQRT2);
    expect(at(0, 0)).toBeCloseTo(20 * Math.SQRT2);
  });

  it('stays within a few percent of the true distance off the axes', () => {
    const truth = Math.hypot(4, 2) * 10;
    expect(Math.abs(at(6, 4) - truth) / truth).toBeLessThan(0.09);
  });

  it('reports a huge distance everywhere when nothing is marked', () => {
    expect(distanceToMask(new Uint8Array(4), 2, 2, 1)[0]).toBeGreaterThan(1e6);
  });
});
