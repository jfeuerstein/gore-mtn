import { describe, expect, it } from 'vitest';
import { PEOPLE } from './people';
import { projectInHand, PROJECTS, projectState } from './projects';

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
    expect(projectState('rabbit-dock', begun, '2026-11-12')).toBe('proposed');
    // And is still up, and the next still waiting, however long the player is away.
    expect(projectState('lean-to', begun, '2027-03-01')).toBe('built');
    expect(projectInHand(begun, '2027-03-01')?.project.id).toBe('rabbit-dock');
  });

  it('runs out: with everything built, the town has nothing in hand', () => {
    const begun = Object.fromEntries(PROJECTS.map((p, i) => [p.id, `2026-11-${10 + i}`]));
    expect(PROJECTS.every((p) => projectState(p.id, begun, '2026-12-01') === 'built')).toBe(true);
    expect(projectInHand(begun, '2026-12-01')).toBeNull();
    expect(projectState('no-such-thing', begun, '2026-12-01')).toBe('later');
  });

  it('is run by people who exist, and says so the way people here talk', () => {
    expect(new Set(PROJECTS.map((p) => p.id)).size).toBe(PROJECTS.length);
    for (const p of PROJECTS) {
      expect(PEOPLE.some((who) => who.id === p.who), p.who).toBe(true);
      for (const text of [p.ask, p.done]) {
        expect(text.length).toBeLessThan(64);
        expect(text).not.toMatch(/\b(do not|does not|is not|are not|cannot|will not|have not)\b/);
        expect(text).not.toMatch(/colour|neighbour|favourite/);
      }
    }
  });
});
