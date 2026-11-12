import { existsSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { GROUND_MARKS, GROUND_SHEETS, MARK_KINDS, packSheets } from './groundMarks';
import { SEASONS } from './season';
import { INKS } from './worldLook';

describe('the marks printed on the ground', () => {
  it('prints every mark in one of the season’s own inks, on one of them', () => {
    for (const season of SEASONS) {
      for (const [ink, marks] of Object.entries(GROUND_MARKS[season])) {
        expect(INKS[season], `${season} ${Number(ink).toString(16)}`).toContain(Number(ink));
        expect(marks.length).toBeGreaterThan(0);
        expect(marks.length).toBeLessThanOrEqual(2);
        for (const mark of marks) {
          expect(INKS[season], `${season} mark ${mark.ink.toString(16)}`).toContain(mark.ink);
          expect(mark.ink).not.toBe(Number(ink));
        }
      }
    }
  });

  it('loads, for each season, the kinds its marks are of: four at most', () => {
    for (const season of SEASONS) {
      const sheets = GROUND_SHEETS[season];
      expect(sheets.length).toBeLessThanOrEqual(4);
      expect(new Set(sheets).size).toBe(sheets.length);
      for (const marks of Object.values(GROUND_MARKS[season])) for (const mark of marks) expect(sheets, `${season} ${mark.kind}`).toContain(mark.kind);
      // And nothing is loaded that is not printed.
      const used = new Set(Object.values(GROUND_MARKS[season]).flatMap((marks) => marks.map((m) => m.kind)));
      for (const kind of sheets) expect(used.has(kind), `${season} ${kind}`).toBe(true);
    }
  });

  it('has a picture for every kind (tools/art/make-ground.mjs makes them)', () => {
    for (const kind of MARK_KINDS) expect(existsSync(new URL(`../../public/art/ground/${kind}.png`, import.meta.url)), kind).toBe(true);
  });

  it('gives every season something on the ground there is most of', () => {
    // Snow under the trees, the forest floor in spring, summer and fall.
    expect(GROUND_MARKS.winter[0xc3d3ea]).toBeDefined();
    expect(GROUND_MARKS.spring[0x7a6650]).toBeDefined();
    expect(GROUND_MARKS.summer[0x3f7d54]).toBeDefined();
    expect(GROUND_MARKS.fall[0x8c6a48]).toBeDefined();
  });

  it('packs a season’s pictures into one sheet, a kind to a channel', () => {
    const picture = (value: number): Uint8ClampedArray => new Uint8ClampedArray(2 * 2 * 4).fill(value);
    const sheet = packSheets([picture(10), picture(20), picture(30)], 2);
    expect([...sheet.slice(0, 4)]).toEqual([10, 20, 30, 0]);
    expect([...sheet.slice(12, 16)]).toEqual([10, 20, 30, 0]);
  });
});
