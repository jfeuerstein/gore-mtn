import { describe, expect, it } from 'vitest';
import { flyerDate, LEADS, personLead, pickLeads, placeLead, rumourLead, trailLead, type Lead } from './today';

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
        expect(text).not.toMatch(/\b(do not|does not|is not|are not|cannot|will not|have not)\b/);
        expect(text).not.toMatch(/colour|neighbour|favourite|grey\b/);
      }
      expect(lead.why.length).toBeLessThan(60);
    }
  });
});
