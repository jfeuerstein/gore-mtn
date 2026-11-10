import { describe, expect, it } from 'vitest';
import { distToPolyline, trailAt, type Trail } from './trails';

const trail = (name: string | null, width: number, pts: number[]): Trail => ({
  name,
  difficulty: 'intermediate',
  glade: width === 0,
  area: false,
  width,
  pts,
});

describe('distToPolyline', () => {
  it('measures to the nearest point on any segment', () => {
    const line = [0, 0, 10, 0, 10, 10];
    expect(distToPolyline(5, 3, line)).toBeCloseTo(3);
    expect(distToPolyline(13, 5, line)).toBeCloseTo(3);
    expect(distToPolyline(-4, 0, line)).toBeCloseTo(4); // beyond the end
  });
});

describe('trailAt', () => {
  const trails = [trail('Sunway', 10, [0, 0, 100, 0]), trail('Twister', 10, [0, 12, 100, 12]), trail(null, 50, [0, 6, 100, 6])];

  it('finds the trail under the point', () => {
    expect(trailAt(trails, 50, 1)?.name).toBe('Sunway');
    expect(trailAt(trails, 50, 11)?.name).toBe('Twister');
  });

  it('prefers the closer centre line where two trails overlap', () => {
    expect(trailAt(trails, 50, 5)?.name).toBe('Sunway');
    expect(trailAt(trails, 50, 7)?.name).toBe('Twister');
  });

  it('returns nothing away from any trail and ignores unnamed trails', () => {
    expect(trailAt(trails, 50, 40)).toBeNull();
    expect(trailAt([trail(null, 50, [0, 0, 100, 0])], 50, 0)).toBeNull();
  });

  it('only matches a glade right on its line', () => {
    const glade = [trail('Cave Glades', 0, [0, 0, 100, 0])];
    expect(trailAt(glade, 50, 2)?.name).toBe('Cave Glades');
    expect(trailAt(glade, 50, 6)).toBeNull();
  });
});
