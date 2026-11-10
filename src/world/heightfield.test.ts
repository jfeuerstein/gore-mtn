import { describe, expect, it } from 'vitest';
import { Heightfield } from './heightfield';

// A 3 x 3 grid, 10 m cells, origin at (-10, -10):
//   0  10  20
//   0  10  20
//   5  15  40
const hf = () => new Heightfield(3, 3, 10, -10, -10, new Float32Array([0, 10, 20, 0, 10, 20, 5, 15, 40]));

describe('Heightfield', () => {
  it('returns sample heights exactly at grid points', () => {
    expect(hf().heightAt(-10, -10)).toBe(0);
    expect(hf().heightAt(0, 0)).toBe(10);
    expect(hf().heightAt(10, 10)).toBe(40);
  });

  it('interpolates along edges', () => {
    expect(hf().heightAt(-5, -10)).toBeCloseTo(5);
    expect(hf().heightAt(-10, 5)).toBeCloseTo(2.5);
  });

  it('follows the two triangles the mesh draws, not a bilinear patch', () => {
    // Bottom-right cell has corners a=10, b=20, c=15, d=40 and is split along b-c.
    // Its centre lies on that diagonal, so the height is the b-c midpoint, not the corner average.
    expect(hf().heightAt(5, 5)).toBeCloseTo(17.5);
    // Just inside the triangle that holds d.
    expect(hf().heightAt(9, 9)).toBeCloseTo(40 + (15 - 40) * 0.1 + (20 - 40) * 0.1);
  });

  it('clamps positions outside the grid to the nearest edge', () => {
    expect(hf().heightAt(-500, -500)).toBe(0);
    expect(hf().heightAt(500, 500)).toBe(40);
  });

  it('reports a flat normal on flat ground and a tilted one on a slope', () => {
    const flat = new Heightfield(2, 2, 10, 0, 0, new Float32Array([3, 3, 3, 3]));
    expect(flat.normalAt(5, 5)).toEqual([-0, 1, -0]);
    expect(flat.slopeDegAt(5, 5)).toBeCloseTo(0);
    // Rises 10 m per 10 m toward +x: a 45 degree slope whose normal leans toward -x.
    const ramp = new Heightfield(2, 2, 10, 0, 0, new Float32Array([0, 10, 0, 10]));
    expect(ramp.slopeDegAt(5, 5)).toBeCloseTo(45);
    expect(ramp.normalAt(5, 5)[0]).toBeLessThan(0);
  });

  it('decimates to a coarser grid that agrees at the kept samples', () => {
    const data = new Float32Array(5 * 5).map((_, i) => i);
    const full = new Heightfield(5, 5, 2, -4, -4, data);
    const half = full.decimate(2);
    expect([half.cols, half.rows, half.cell]).toEqual([3, 3, 4]);
    expect(half.heightAt(4, 4)).toBe(full.heightAt(4, 4));
    expect(half.heightAt(-4, 0)).toBe(full.heightAt(-4, 0));
    expect(full.decimate(1)).toBe(full);
  });

  it('rejects data of the wrong size', () => {
    expect(() => new Heightfield(2, 2, 1, 0, 0, new Float32Array(3))).toThrow();
  });
});
