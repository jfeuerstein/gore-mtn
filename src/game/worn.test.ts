import { describe, expect, it } from 'vitest';
import { emptySave, parseSave, serializeSave, WORN_FULL, WORN_MOST } from './save';
import { PATH_FOR_LEAF, tread, WORN_AT, WORN_CELL, wornCells, wornCentre, wornKey } from './worn';

describe('ground worn by walking', () => {
  it('shows once a square has been crossed a few times, and not before', () => {
    const save = emptySave();
    const key = wornKey(100, -40);
    for (let i = 1; i < WORN_AT; i++) expect(tread(save, key).shows).toBe(false);
    expect(wornCells(save)).toHaveLength(0);
    expect(tread(save, key).shows).toBe(true);
    expect(wornCells(save)).toHaveLength(1);
    // More wear is kept, up to a point, and the square is only said to show once.
    for (let i = 0; i < 20; i++) expect(tread(save, key).shows).toBe(false);
    expect(save.worn[key]).toBe(WORN_FULL);
  });

  it('puts a square where the player walked', () => {
    const c = wornCentre(wornKey(100, -40));
    expect(Math.abs(c.x - 100)).toBeLessThanOrEqual(WORN_CELL / 2);
    expect(Math.abs(c.z + 40)).toBeLessThanOrEqual(WORN_CELL / 2);
    expect(wornKey(-1, -1)).toBe('-1,-1');
  });

  it('is a path once there is enough of it, and the path earns its line', () => {
    const save = emptySave();
    const got: string[] = [];
    for (let i = 0; i < PATH_FOR_LEAF; i++) for (let n = 0; n < WORN_AT; n++) got.push(...tread(save, `${i},0`).gear);
    expect(got).toEqual(['trail-leaf']);
  });

  it('keeps only so much: what was never gone back to grows over, and a path does not', () => {
    const save = emptySave();
    for (let i = 0; i < 30; i++) for (let n = 0; n < WORN_AT; n++) tread(save, `${i},5`);
    for (let i = 0; i < WORN_MOST + 50; i++) tread(save, `${i},9`);
    expect(Object.keys(save.worn).length).toBeLessThanOrEqual(WORN_MOST);
    expect(wornCells(save)).toHaveLength(30);
  });

  it('comes back from a save as it went in, and a damaged one is dropped', () => {
    const save = emptySave();
    for (let n = 0; n < WORN_AT; n++) tread(save, '3,-7');
    expect(parseSave(serializeSave(save)).worn).toEqual({ '3,-7': WORN_AT });
    expect(parseSave(JSON.stringify({ worn: { 'a,b': 3, '1,2': -4, '5,5': 99 } })).worn).toEqual({ '5,5': WORN_FULL });
  });
});
