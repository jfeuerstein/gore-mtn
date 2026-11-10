import { describe, expect, it } from 'vitest';
import { deflect, pushOut } from './collide';

const tree = { x: 0, z: 0, radius: 1 };

describe('pushOut', () => {
  it('leaves alone anything that is not touching', () => {
    expect(pushOut(3, 0, 0.4, tree)).toBeNull();
    expect(pushOut(1.4, 0, 0.4, tree)).toBeNull(); // just touching
  });

  it('moves an overlapping circle straight out to where it just touches', () => {
    const bump = pushOut(1, 0, 0.4, tree);
    expect(bump).toMatchObject({ x: 1.4, z: 0, nx: 1, nz: 0 });
    const diagonal = pushOut(0.5, 0.5, 0.4, tree);
    expect(Math.hypot(diagonal?.x ?? 0, diagonal?.z ?? 0)).toBeCloseTo(1.4);
    expect(diagonal?.nx).toBeCloseTo(Math.SQRT1_2);
  });

  it('still finds a way out from dead centre', () => {
    const bump = pushOut(0, 0, 0.4, tree);
    expect(Math.hypot(bump?.x ?? 0, bump?.z ?? 0)).toBeCloseTo(1.4);
  });
});

describe('deflect', () => {
  const fromEast = { x: 1.4, z: 0, nx: 1, nz: 0 }; // mover is east of the obstacle

  it('nearly stops a head-on hit, with no bounce', () => {
    const v = deflect(-20, 0, fromEast);
    expect(v.vx).toBeCloseTo(0);
    expect(v.vz).toBeCloseTo(0);
  });

  it('lets a glancing touch slide past with most of its speed', () => {
    const v = deflect(-2, 20, fromEast);
    expect(v.vx).toBeCloseTo(0);
    expect(v.vz).toBeGreaterThan(14);
    expect(v.vz).toBeLessThan(20);
  });

  it('never adds speed', () => {
    for (const [vx, vz] of [[-20, 0], [-10, 10], [-1, 25], [5, 5]] as const) {
      const v = deflect(vx, vz, fromEast);
      expect(Math.hypot(v.vx, v.vz)).toBeLessThanOrEqual(Math.hypot(vx, vz) + 1e-9);
    }
  });

  it('leaves alone a mover already heading away', () => {
    expect(deflect(5, 3, fromEast)).toEqual({ vx: 5, vz: 3 });
  });
});
