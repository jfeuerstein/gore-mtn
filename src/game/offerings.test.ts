import { describe, expect, it } from 'vitest';
import { loadTestWorld } from '../world/testWorld';
import { offeringFrom, OFFERINGS } from './offerings';
import { personById } from './people';

describe('what the town hands out', () => {
  it('has unique ids, a giver who exists, and something to say', () => {
    expect(new Set(OFFERINGS.map((o) => o.id)).size).toBe(OFFERINGS.length);
    for (const o of OFFERINGS) {
      expect(personById(o.from), o.id).toBeDefined();
      expect(o.hand.length, o.id).toBeGreaterThan(20);
      expect(o.hand.length, o.id).toBeLessThan(230);
      expect(o.note.length, o.id).toBeGreaterThan(10);
      expect(o.note.length, o.id).toBeLessThan(140);
    }
  });

  it('names every sandwich after a real trail', () => {
    const trails = new Set(loadTestWorld().trails.map((t) => t.name));
    const sandwiches = OFFERINGS.filter((o) => o.kind === 'sandwich');
    expect(sandwiches.length).toBeGreaterThanOrEqual(8);
    for (const s of sandwiches) expect(trails.has(s.trail ?? ''), s.name).toBe(true);
  });

  it('gives one new thing a day from each place, in order, until the book has them all', () => {
    const had: Record<string, string> = {};
    const first = offeringFrom('june', had, '2026-01-01');
    expect(first?.fresh).toBe(true);
    had[first?.offering.id ?? ''] = '2026-01-01';
    // Nothing more from June today, but Walt has not been asked.
    expect(offeringFrom('june', had, '2026-01-01')).toBeNull();
    expect(offeringFrom('walt', had, '2026-01-01')?.fresh).toBe(true);
    const second = offeringFrom('june', had, '2026-01-02');
    expect(second?.fresh).toBe(true);
    expect(second?.offering.id).not.toBe(first?.offering.id);
    for (const o of OFFERINGS) had[o.id] = '2026-01-03';
    const again = offeringFrom('june', had, '2026-01-09');
    expect(again?.fresh).toBe(false);
    expect(again?.offering.from).toBe('june');
  });

  it('has nothing from people who keep no counter', () => {
    expect(offeringFrom('hazel', {}, '2026-01-01')).toBeNull();
  });
});
