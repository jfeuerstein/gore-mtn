import { slips } from './voice';
import { describe, expect, it } from 'vitest';
import { dayBefore, flyerDate, LEADS, patchLead, trailAgainLead, personLead, pickLeads, placeLead, projectLead, rumourLead, trailLead, type Lead, postscript, WAITING_FOR_ASIDE, type Aside } from './today';

const trail = (name: string): Lead => trailLead({ name, difficulty: 'intermediate', glade: false }, 0, 0, '2026-11-11', false);
const place = (id: string): Lead => placeLead({ id, name: id, x: 0, z: 0 }, '2026-11-11');
const person = (id: string): Lead => personLead({ id, name: id, role: 'Lift attendant' }, 0, 0);
const everything: Lead[] = [trail('Sunway'), trail('Twister'), trail('Showcase'), place('fire-tower'), place('quarry'), person('hazel'), person('otto'), rumourLead('Marge', 0, 0)];

describe("today's flyer", () => {
  it('offers three leads of three different kinds when all are to be had', () => {
    for (const day of ['2026-11-11', '2026-11-12', '2026-11-13', '2027-01-02', '2027-07-04']) {
      const ids = pickLeads(everything, day);
      expect(ids).toHaveLength(LEADS);
      expect(new Set(ids).size).toBe(LEADS);
      const kinds = ids.map((id) => (everything.find((l) => l.id === id) as Lead).kind);
      expect(kinds.filter((k) => k === 'trail')).toHaveLength(1);
      expect(kinds.filter((k) => k === 'place')).toHaveLength(1);
      expect(kinds.filter((k) => k === 'person' || k === 'rumour')).toHaveLength(1);
    }
  });

  it('is the same all day, and not the same every day', () => {
    expect(pickLeads(everything, '2026-11-11')).toEqual(pickLeads(everything, '2026-11-11'));
    const week = ['11', '12', '13', '14', '15', '16', '17'].map((d) => pickLeads(everything, `2026-11-${d}`).join());
    expect(new Set(week).size).toBeGreaterThan(3);
  });

  it('agrees with the trail board when told its pick', () => {
    expect(pickLeads(everything, '2026-11-11', 'trail:Showcase')).toContain('trail:Showcase');
    // A pick that is no longer open is not offered.
    expect(pickLeads(everything.filter((l) => l.id !== 'trail:Showcase'), '2026-11-11', 'trail:Showcase')).not.toContain('trail:Showcase');
  });

  it('takes the rumour and the neighbours turn about', () => {
    const asked = ['11', '12', '13', '14'].map((d) => {
      const ids = pickLeads(everything, `2026-11-${d}`);
      return ids.includes('rumour') ? 'rumour' : 'person';
    });
    expect(new Set(asked).size).toBe(2);
  });

  it('puts what the town is building where a place would go', () => {
    const project = projectLead({ id: 'lean-to', name: 'The Hardwood Lean-to', ask: 'Otto wants a lean-to.', done: 'It is up.' }, 'proposed', 0, 0);
    const ids = pickLeads([...everything, project], '2026-11-11');
    expect(ids).toHaveLength(LEADS);
    expect(ids).toContain('project:lean-to');
    expect(ids.some((id) => id.startsWith('place:'))).toBe(false);
    expect(ids.some((id) => id.startsWith('trail:'))).toBe(true);
    expect(project.why).toMatch(/stake out the spot/);
    expect(projectLead({ id: 'lean-to', name: 'x', ask: 'a', done: 'It is up.' }, 'new', 0, 0).head).toBe('Finished overnight');
  });

  it('shows what was finished overnight before what wants staking out, and what was never seen as a place worth the trip', () => {
    const p = { id: 'x', name: 'x', ask: 'a', done: 'It is up.' };
    const fresh = projectLead({ ...p, id: 'dock' }, 'new', 0, 0);
    const wanted = projectLead({ ...p, id: 'bandstand' }, 'proposed', 0, 0);
    // The game lists them in the order they are to be shown.
    expect(pickLeads([fresh, wanted, ...everything], '2026-11-11')).toContain('project:dock');
    expect(pickLeads([fresh, wanted, ...everything], '2026-11-11')).not.toContain('project:bandstand');
    expect(projectLead(p, 'standing', 0, 0).head).toBe('Worth the trip');
    expect(projectLead(p, 'standing', 0, 0).why).toBe('It is up.');
  });

  it('sends someone new next door before anywhere else', () => {
    for (const d of ['11', '12', '13', '14']) expect(pickLeads(everything, `2026-11-${d}`, null, 'person:hazel')).toContain('person:hazel');
    // Somebody who is not about is not offered.
    expect(pickLeads(everything, '2026-11-11', null, 'person:nobody')).toHaveLength(LEADS);
  });

  it('still has something to say to a full or nearly full book', () => {
    // Every trail stamped: a trail to go down again, with no "you haven't been" about it.
    const again = trailAgainLead({ name: 'Sunway', difficulty: 'easy', glade: false }, 0, 0, '2026-11-11', false);
    expect(again.id).toBe('again:Sunway');
    expect(again.why).not.toMatch(/haven't/);
    // A patch still to earn is quoted, has nowhere for a flag, and only makes up the number.
    const patch = patchLead({ id: 'whopper', name: 'The Whopper', how: 'Find a stone over twenty centimeters.' });
    expect(patch.nowhere).toBe(true);
    expect(pickLeads([again, rumourLead('Marge', 0, 0, '2026-11-11'), patch], '2026-11-11')).toEqual(['again:Sunway', 'rumour', 'patch:whopper']);
    expect(pickLeads([...everything, patch], '2026-11-11')).not.toContain('patch:whopper');
    // The rumour is not worded the same every day.
    expect(new Set(['11', '12', '13', '14', '15', '16', '17', '18'].map((d) => rumourLead('Marge', 0, 0, `2026-11-${d}`).why)).size).toBeGreaterThan(1);
  });

  it('knows the day before a day, across a month and a year', () => {
    expect(dayBefore('2026-11-12')).toBe('2026-11-11');
    expect(dayBefore('2026-12-01')).toBe('2026-11-30');
    expect(dayBefore('2027-01-01')).toBe('2026-12-31');
  });

  it('makes up the number from what is left, and offers nothing when nothing is', () => {
    const late = [trail('Sunway'), trail('Twister'), trail('Showcase'), trail('Echo')];
    expect(pickLeads(late, '2026-11-11')).toHaveLength(3);
    expect(pickLeads([place('quarry')], '2026-11-11')).toEqual(['place:quarry']);
    expect(pickLeads([], '2026-11-11')).toEqual([]);
  });

  it('writes the date as a paper would', () => {
    expect(flyerDate('2026-11-11')).toBe('Wednesday · Nov 11');
    expect(flyerDate('2027-01-01')).toBe('Friday · Jan 1');
  });

  it('says things the way people here say them', () => {
    for (const lead of everything) {
      for (const text of [lead.head, lead.title, lead.why]) {
        expect(slips(text), text).toEqual([]);
      }
      expect(lead.why.length).toBeLessThan(60);
    }
  });
});

describe("the flyer's P.S.", () => {
  const nothing: Aside = { lastLetter: false, shower: null, fog: false, aurora: false, concert: false, guest: false, waiting: 0, building: null, resting: false, letter: false, pip: false };

  it('says nothing on a day with nothing to say', () => {
    expect(postscript(nothing)).toBeNull();
  });

  it('says one thing, and the one that matters most: the last letter, then tonight, then home and town, then tomorrow, then what will keep', () => {
    const everything: Aside = { lastLetter: true, shower: 'the Leonids', fog: true, aurora: true, concert: true, guest: true, waiting: 9, building: 'The dock', resting: true, letter: true, pip: true };
    const order: [keyof Aside, RegExp][] = [
      ['lastLetter', /from everybody/],
      ['shower', /the Leonids/],
      ['fog', /Fog in the valley/],
      ['aurora', /Look north tonight/],
      ['concert', /bandstand tonight/],
      ['guest', /feeder/],
      ['waiting', /9 things Silas/],
      ['building', /The dock will be up by tomorrow/],
      ['resting', /thinking about what to build/],
      ['letter', /a letter for you/],
      ['pip', /Pip's hiding/],
    ];
    const state: Aside = { ...everything };
    for (const [key, says] of order) {
      const line = postscript(state) ?? '';
      expect(line, key).toMatch(says);
      expect(line.startsWith('P.S. '), key).toBe(true);
      expect(slips(line), line).toEqual([]);
      // With that out of the way, the next one is said.
      (state as unknown as Record<string, unknown>)[key] = nothing[key];
    }
    expect(postscript(state)).toBeNull();
  });

  it('only mentions the museum once a few things are waiting', () => {
    expect(postscript({ ...nothing, waiting: WAITING_FOR_ASIDE - 1 })).toBeNull();
    expect(postscript({ ...nothing, waiting: WAITING_FOR_ASIDE })).toContain(`${WAITING_FOR_ASIDE} things`);
  });
});

