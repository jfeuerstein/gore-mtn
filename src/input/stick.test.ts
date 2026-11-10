import { describe, expect, it } from 'vitest';
import { stickVector } from './stick';

describe('stickVector', () => {
  it('is zero at rest and inside the dead zone', () => {
    expect(stickVector(0, 0, 50)).toEqual({ x: 0, y: 0 });
    expect(stickVector(3, -3, 50)).toEqual({ x: 0, y: 0 });
  });

  it('maps thumb up to forward and thumb right to right', () => {
    const up = stickVector(0, -50, 50);
    expect(up.x).toBeCloseTo(0);
    expect(up.y).toBeCloseTo(1);
    const right = stickVector(50, 0, 50);
    expect(right.x).toBeCloseTo(1);
    expect(right.y).toBeCloseTo(0);
  });

  it('never exceeds full tilt however far the thumb travels', () => {
    const v = stickVector(300, -400, 50);
    expect(Math.hypot(v.x, v.y)).toBeCloseTo(1);
  });

  it('ramps smoothly from the edge of the dead zone', () => {
    const half = stickVector(0, -28, 50, 0.12); // 56% of the radius
    expect(half.y).toBeCloseTo((0.56 - 0.12) / 0.88);
  });
});
