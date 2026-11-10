import { describe, expect, it } from 'vitest';
import { touchRole } from './zones';

describe('touchRole', () => {
  const W = 402;
  const H = 874;

  it('uses the lower half of an upright phone for the stick, anywhere across its width', () => {
    expect(touchRole(40, 700, W, H, false)).toBe('stick');
    expect(touchRole(360, 700, W, H, false)).toBe('stick');
    expect(touchRole(200, 450, W, H, false)).toBe('stick');
  });

  it('uses the upper half of an upright phone for the camera', () => {
    expect(touchRole(200, 150, W, H, false)).toBe('look');
    expect(touchRole(200, 420, W, H, false)).toBe('look');
  });

  it('gives a second finger the camera while the stick is held', () => {
    expect(touchRole(200, 700, W, H, true)).toBe('look');
  });

  it('splits a wide screen left and right', () => {
    expect(touchRole(100, 200, H, W, false)).toBe('stick');
    expect(touchRole(700, 200, H, W, false)).toBe('look');
  });
});
