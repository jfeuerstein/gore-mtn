import { describe, expect, it } from 'vitest';
import { SPECIES } from '../game/wildlife';
import { critterGeometry, hasCritterModel } from './critterModels';

describe('critter models', () => {
  it('has a model for every entry in the field guide', () => {
    expect(SPECIES.filter((s) => !hasCritterModel(s.id)).map((s) => s.id)).toEqual([]);
  });

  it('stands each one on the ground, at a size that can be seen but does not dwarf the player', () => {
    for (const s of SPECIES) {
      const geo = critterGeometry(s.id, 'summer');
      geo.computeBoundingBox();
      const box = geo.boundingBox;
      if (!box) throw new Error(s.id);
      // A swimmer sits a little into the water.
      expect(box.min.y, s.id).toBeGreaterThan(-0.2);
      expect(box.min.y, s.id).toBeLessThan(0.2);
      expect(box.max.y, s.id).toBeGreaterThan(0.15);
      expect(box.max.y, s.id).toBeLessThan(4.2);
      expect(geo.getAttribute('position').count, s.id).toBeLessThan(1500);
    }
  });

  it('turns the hare white for winter', () => {
    expect(critterGeometry('hare', 'winter')).not.toBe(critterGeometry('hare', 'summer'));
    expect(critterGeometry('deer', 'winter')).toBe(critterGeometry('deer', 'summer'));
  });
});
