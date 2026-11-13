import { describe, expect, it } from 'vitest';
import { SKI } from '../player/skiPhysics';
import { linesFor, LINES_FROM, LINES_FULL } from './speedLines';

describe('speed lines', () => {
  it('are not there at a walk or while poling, and are all out at full speed', () => {
    expect(linesFor(0)).toBe(0);
    // Poling along the flat is not fast: the lines are for the hill.
    expect(linesFor(SKI.poleMaxSpeed)).toBe(0);
    expect(linesFor(LINES_FROM)).toBe(0);
    expect(linesFor(LINES_FULL)).toBe(1);
    expect(linesFor(99)).toBe(1);
  });

  it('gather steadily in between', () => {
    let last = 0;
    for (let v = LINES_FROM; v <= LINES_FULL; v += 0.5) {
      expect(linesFor(v)).toBeGreaterThanOrEqual(last);
      last = linesFor(v);
    }
    expect(linesFor((LINES_FROM + LINES_FULL) / 2)).toBeCloseTo(0.5, 5);
  });
});
