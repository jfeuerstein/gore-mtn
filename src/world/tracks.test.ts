import { describe, expect, it } from 'vitest';
import { trackHalfWidth } from './tracks';

describe('trackHalfWidth', () => {
  it('is as narrow as a ski when running straight', () => {
    expect(trackHalfWidth(0)).toBeCloseTo(0.05);
  });

  it('is as wide as a ski is long when sliding broadside, either way', () => {
    expect(trackHalfWidth(Math.PI / 2)).toBeCloseTo(0.7);
    expect(trackHalfWidth(-Math.PI / 2)).toBeCloseTo(0.7);
  });

  it('widens steadily in between', () => {
    expect(trackHalfWidth(0.3)).toBeGreaterThan(trackHalfWidth(0.1));
    expect(trackHalfWidth(0.3)).toBeLessThan(trackHalfWidth(0.9));
  });
});
