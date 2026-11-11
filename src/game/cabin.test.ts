import { describe, expect, it } from 'vitest';
import { SEASONS } from '../look/season';
import { emptyCabin, FEEDER_GUESTS, feederGuest, nextChoice, SHELF_SLOTS, WALL_SLOTS } from './cabin';
import { SPECIES } from './wildlife';

describe('the cabin', () => {
  it('starts with a bare shelf, a bare board and an empty feeder', () => {
    const c = emptyCabin();
    expect(c.shelf).toEqual(Array(SHELF_SLOTS).fill(''));
    expect(c.wall).toEqual(Array(WALL_SLOTS).fill(''));
    expect(c.feeder).toBe('');
  });

  it('steps a place through what the player has, and back to bare', () => {
    const have = ['garnet', 'quartz', 'pyrite'];
    const shelf = ['', '', ''];
    const seen: string[] = [];
    for (let i = 0; i < 4; i++) {
      shelf[0] = nextChoice(have, shelf, 0);
      seen.push(shelf[0]);
    }
    expect(seen).toEqual(['garnet', 'quartz', 'pyrite', '']);
  });

  it('never sets the same thing out twice', () => {
    const have = ['garnet', 'quartz'];
    const shelf = ['garnet', '', ''];
    expect(nextChoice(have, shelf, 1)).toBe('quartz');
    shelf[1] = 'quartz';
    // Nothing is left for a third place.
    expect(nextChoice(have, shelf, 2)).toBe('');
    // And the first steps past what the second holds.
    expect(nextChoice(have, shelf, 0)).toBe('');
  });

  it('copes with something on the shelf that the player no longer has', () => {
    expect(nextChoice(['quartz'], ['gone', ''], 0)).toBe('quartz');
  });

  it('brings somebody to the feeder the day after it is filled, by day', () => {
    const c = { ...emptyCabin(), feeder: '2026-11-10' };
    expect(feederGuest(c, '2026-11-10', 'winter', 'day')).toBeNull();
    expect(feederGuest(c, '2026-11-11', 'winter', 'night')).toBeNull();
    const guest = feederGuest(c, '2026-11-11', 'winter', 'day');
    expect(FEEDER_GUESTS.winter).toContain(guest);
    // The same one all day, and somebody still there a week on.
    expect(feederGuest(c, '2026-11-11', 'winter', 'dusk')).toBe(guest);
    expect(feederGuest(c, '2026-11-18', 'winter', 'dawn')).not.toBeNull();
    expect(feederGuest(emptyCabin(), '2026-11-11', 'winter', 'day')).toBeNull();
  });

  it('only invites those who are in the field guide', () => {
    for (const season of SEASONS) {
      expect(FEEDER_GUESTS[season].length).toBeGreaterThan(2);
      for (const id of FEEDER_GUESTS[season]) expect(SPECIES.some((s) => s.id === id), `${season}: ${id}`).toBe(true);
    }
  });
});
