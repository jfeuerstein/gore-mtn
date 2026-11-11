import { describe, expect, it } from 'vitest';
import { pushOutOfBox, Walls, type WallBox } from './walls';

const house: WallBox = { x: 10, z: 20, w: 12, d: 6, turn: 0 };

describe('pushOutOfBox', () => {
  it('leaves a mover alone who is clear of the walls', () => {
    expect(pushOutOfBox(10, 30, 0.4, house)).toBeNull();
    expect(pushOutOfBox(17, 20, 0.4, house)).toBeNull();
  });

  it('steps a mover back from a wall they have walked into', () => {
    const bump = pushOutOfBox(10, 23.2, 0.4, house);
    expect(bump?.x).toBeCloseTo(10);
    expect(bump?.z).toBeCloseTo(23.4);
    expect(bump?.nz).toBeCloseTo(1);
  });

  it('puts a mover found inside out by the nearest wall', () => {
    const bump = pushOutOfBox(15, 20.5, 0.4, house);
    expect(bump?.x).toBeCloseTo(16.4);
    expect(bump?.z).toBeCloseTo(20.5);
    expect(bump?.nx).toBeCloseTo(1);
  });

  it('rounds a corner rather than snagging on it', () => {
    const bump = pushOutOfBox(16.2, 23.2, 0.4, house);
    expect(bump).not.toBeNull();
    expect(Math.hypot((bump?.x ?? 0) - 16, (bump?.z ?? 0) - 23)).toBeCloseTo(0.4);
  });

  it('works for a building turned on its plot', () => {
    // A quarter turn swaps the long and short sides.
    const turned: WallBox = { ...house, turn: Math.PI / 2 };
    expect(pushOutOfBox(10, 25.5, 0.4, turned)).not.toBeNull();
    expect(pushOutOfBox(15, 20, 0.4, turned)).toBeNull();
    const bump = pushOutOfBox(10, 25.9, 0.4, turned);
    expect(bump?.z).toBeCloseTo(26.4);
    expect(bump?.nz).toBeCloseTo(1);
  });
});

describe('Walls', () => {
  const walls = new Walls([house, { x: 300, z: -200, w: 40, d: 16, turn: 0.6 }]);

  it('finds the wall a mover is touching', () => {
    expect(walls.bumpAt(10, 23.2, 0.4)).not.toBeNull();
    expect(walls.bumpAt(300, -200, 0.4)).not.toBeNull();
  });

  it('finds nothing in open country', () => {
    expect(walls.bumpAt(150, 150, 0.4)).toBeNull();
    expect(walls.bumpAt(10, 40, 0.4)).toBeNull();
  });

  it('knows the height of the roof over a point, and open sky', () => {
    const roofed = new Walls([{ ...house, top: 31 }, { x: 12, z: 21, w: 4, d: 4, turn: 0, top: 44 }]);
    expect(roofed.roofAt(5, 20)).toBe(31);
    // Where two overlap, the higher one counts.
    expect(roofed.roofAt(12, 21)).toBe(44);
    // Just outside the walls is still under the eaves.
    expect(roofed.roofAt(5, 24.5)).toBe(31);
    expect(roofed.roofAt(10, 40)).toBe(-Infinity);
    expect(walls.roofAt(10, 20)).toBe(-Infinity);
  });

  it('always leaves a mover outside every wall', () => {
    for (let i = 0; i < 200; i++) {
      const x = 4 + (i % 14);
      const z = 16 + (i % 9);
      const bump = walls.bumpAt(x, z, 0.4);
      if (bump) expect(walls.bumpAt(bump.x + bump.nx * 0.001, bump.z + bump.nz * 0.001, 0.4)).toBeNull();
    }
  });
});
