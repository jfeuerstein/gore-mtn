import { describe, expect, it } from 'vitest';
import { tidyName } from './names';
import { loadTestWorld } from './testWorld';

describe('names from the map', () => {
  it('are tidied where they were typed in a hurry, and otherwise left alone', () => {
    expect(tidyName('Double Barrel(Left Barrell)')).toBe('Double Barrel (Left Barrel)');
    expect(tidyName('Double Barrell(Right Barrel)')).toBe('Double Barrel (Right Barrel)');
    expect(tidyName('The Oak  Ridge Trail')).toBe('The Oak Ridge Trail');
    expect(tidyName('Schaefer/ Windy Hill')).toBe('Schaefer / Windy Hill');
    expect(tidyName('Lower Sleighride(Park)')).toBe('Lower Sleighride (Park)');
    // A slash inside brackets is part of a note, and stays as it is.
    expect(tidyName('Sidewinder (yellow/blue)')).toBe('Sidewinder (yellow/blue)');
    for (const name of ['Sunway', 'The Rumor', 'Lies', '1A', "Pete Gay's Glades"]) expect(tidyName(name)).toBe(name);
  });

  it('leave every trail and path on the real mountain with a tidy name, and no two the same that were not before', () => {
    const world = loadTestWorld();
    const names = [...world.trails, ...world.paths].flatMap((t) => (t.name ? [t.name] : []));
    for (const name of names) {
      expect(tidyName(name), name).toBe(name);
      expect(name).not.toMatch(/ {2}|\S\(|Barrell/);
    }
  });
});
