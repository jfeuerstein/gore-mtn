import { slips } from './voice';
import { describe, expect, it } from 'vitest';
import { PEOPLE } from './people';
import { daysBetween, projectInHand, PROJECTS, projectState, REST, townResting } from './projects';

describe('town projects', () => {
  it('proposes the first from the start, and nothing after it', () => {
    expect(projectState('lean-to', {}, '2026-11-11')).toBe('proposed');
    expect(projectState('rabbit-dock', {}, '2026-11-11')).toBe('later');
    expect(projectInHand({}, '2026-11-11')?.project.id).toBe('lean-to');
  });

  it('builds one overnight once its spot is staked out', () => {
    const begun = { 'lean-to': '2026-11-11' };
    expect(projectState('lean-to', begun, '2026-11-11')).toBe('building');
    expect(projectInHand(begun, '2026-11-11')).toMatchObject({ state: 'building' });
    // The next waits until this one is up.
    expect(projectState('rabbit-dock', begun, '2026-11-11')).toBe('later');
    expect(projectState('lean-to', begun, '2026-11-12')).toBe('built');
    // The town takes its time over the next: a few days for the new thing to be the new thing.
    expect(projectState('rabbit-dock', begun, '2026-11-12')).toBe('later');
    expect(projectInHand(begun, '2026-11-12')).toBeNull();
    expect(townResting(begun, '2026-11-12')).toBe(true);
    expect(projectState('rabbit-dock', begun, `2026-11-${11 + REST}`)).toBe('later');
    expect(projectState('rabbit-dock', begun, `2026-11-${12 + REST}`)).toBe('proposed');
    expect(townResting(begun, `2026-11-${12 + REST}`)).toBe(false);
    // And is still up, and the next still waiting, however long the player is away.
    expect(projectState('lean-to', begun, '2027-03-01')).toBe('built');
    expect(projectInHand(begun, '2027-03-01')?.project.id).toBe('rabbit-dock');
  });

  it('runs out: with everything built, the town has nothing in hand', () => {
    const begun = Object.fromEntries(PROJECTS.map((p, i) => [p.id, `2026-11-${10 + i}`]));
    expect(PROJECTS.every((p) => projectState(p.id, begun, '2026-12-01') === 'built')).toBe(true);
    expect(projectInHand(begun, '2026-12-01')).toBeNull();
    // Nothing more is coming, so the town is not said to be thinking about it.
    expect(townResting(begun, '2026-12-01')).toBe(false);
    expect(projectState('no-such-thing', begun, '2026-12-01')).toBe('later');
  });

  it('lasts for weeks, however keen the player is', () => {
    // Someone who stakes out every project the day it is proposed.
    const begun: Record<string, string> = {};
    let days = 0;
    for (let d = 0; d < 60 && Object.keys(begun).length < PROJECTS.length; d++) {
      const day = new Date(Date.UTC(2026, 10, 11 + d, 12)).toISOString().slice(0, 10);
      const now = projectInHand(begun, day);
      if (now?.state === 'proposed') begun[now.project.id] = day;
      days = d;
    }
    expect(Object.keys(begun)).toHaveLength(PROJECTS.length);
    expect(days).toBeGreaterThanOrEqual(14);
    expect(daysBetween('2026-12-30', '2027-01-02')).toBe(3);
  });

  it('is run by people who exist, and says so the way people here talk', () => {
    expect(new Set(PROJECTS.map((p) => p.id)).size).toBe(PROJECTS.length);
    for (const p of PROJECTS) {
      expect(PEOPLE.some((who) => who.id === p.who), p.who).toBe(true);
      for (const text of [p.ask, p.done]) {
        expect(text.length).toBeLessThan(64);
        expect(slips(text), text).toEqual([]);
      }
    }
  });
});
