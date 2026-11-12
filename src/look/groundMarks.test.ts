import { describe, expect, it } from 'vitest';
import { GROUND_MARKS, MARK_KINDS, markSheet } from './groundMarks';
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
          expect(MARK_KINDS).toContain(mark.kind);
        }
      }
    }
  });

  it('gives every season something on the ground there is most of', () => {
    // Snow under the trees, the forest floor in spring, summer and fall.
    expect(GROUND_MARKS.winter[0xc3d3ea]).toBeDefined();
    expect(GROUND_MARKS.spring[0x7a6650]).toBeDefined();
    expect(GROUND_MARKS.summer[0x3f7d54]).toBeDefined();
    expect(GROUND_MARKS.fall[0x8c6a48]).toBeDefined();
  });

  const size = 256;
  const sheet = markSheet(size);

  it('leaves most of the ground plain: a scatter, not a pattern all over', () => {
    for (let channel = 0; channel < 4; channel++) {
      let inked = 0;
      for (let p = channel; p < sheet.length; p += 4) if ((sheet[p] as number) > 127) inked++;
      const share = inked / (size * size);
      expect(share, MARK_KINDS[channel]).toBeGreaterThan(0.003);
      expect(share, MARK_KINDS[channel]).toBeLessThan(0.12);
    }
  });

  it('joins up with itself: a mark that runs off one side comes back on the other', () => {
    // Where a mark touches the last column or row, the first carries on with it.
    let carried = 0;
    for (let channel = 0; channel < 4; channel++) {
      for (let i = 0; i < size; i++) {
        if ((sheet[(i * size + size - 1) * 4 + channel] as number) > 60 && (sheet[i * size * 4 + channel] as number) > 0) carried++;
        if ((sheet[((size - 1) * size + i) * 4 + channel] as number) > 60 && (sheet[i * 4 + channel] as number) > 0) carried++;
      }
    }
    expect(carried).toBeGreaterThan(0);
  });

  it('is the same every time', () => {
    expect([...markSheet(64)]).toEqual([...markSheet(64)]);
  });
});
