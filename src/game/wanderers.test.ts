import { describe, expect, it } from 'vitest';
import { emptySave } from './save';
import {
  BAND,
  BAND_PLAYS,
  BAND_TEACH,
  CAMPER_GIFTS,
  CAMPER_HAUNTS,
  camperToday,
  concertOn,
  FINDS_FOR_CROWN,
  FINDS_FOR_RACERS,
  NELL_GIVES,
  PAINTER_HAUNTS,
  painterToday,
  paintingId,
  PAINTINGS_FOR_BERET,
  PAINTINGS_FOR_SATCHEL,
  PIP_FOUND,
  PIP_HAUNTS,
  pipHiding,
  pipHint,
  pipToday,
  RO_FOUND,
  wandererTurn,
  wandererWaits,
  weekday,
} from './wanderers';
import { GEAR, PEOPLE } from './people';

/** The days of a fortnight, from a Monday. */
const days = Array.from({ length: 14 }, (_, i) => `2026-11-${String(9 + i).padStart(2, '0')}`);
const SATURDAY = '2026-11-14';

describe('the people who roam', () => {
  it('are somewhere every day, the same place all day, and seldom the same place two days running', () => {
    for (const today of [painterToday, camperToday, pipToday]) {
      const where = days.map((d) => today(d).id);
      expect(where).toEqual(days.map((d) => today(d).id));
      expect(new Set(where).size).toBeGreaterThan(2);
      for (let i = 1; i < where.length; i++) expect(where[i], days[i]).not.toBe(where[i - 1]);
    }
  });

  it('have a person in the cast for each, and a thing in the wardrobe for everything they hand over', () => {
    for (const id of ['nell', 'ro', ...BAND.map((b) => b.who)]) expect(PEOPLE.find((p) => p.id === id)?.roams, id).toBeDefined();
    const gear = new Set(GEAR.map((g) => g.id));
    for (const id of ['hat-beret', 'pack-satchel', 'skis-racer', 'hat-crown', 'jacket-band', ...CAMPER_GIFTS, ...BAND.map((b) => b.tune)]) expect(gear.has(id), id).toBe(true);
    for (const b of BAND) {
      expect(BAND_TEACH[b.who], b.who).toBeDefined();
      expect(BAND_PLAYS[b.who], b.who).toBeDefined();
    }
  });

  it('talk as the town talks: short, with contractions, in American', () => {
    const lines = [...NELL_GIVES, ...RO_FOUND, ...PIP_FOUND, ...Object.values(BAND_TEACH), ...Object.values(BAND_PLAYS), ...PIP_HAUNTS.flatMap((h) => h.hints ?? [])];
    for (const line of lines) {
      expect(line.length, line).toBeLessThan(200);
      expect(line, line).not.toMatch(/\b(do not|does not|did not|is not|cannot|will not|have not|colour|grey|neighbour|practise)\b/i);
    }
    // Every place Pip hides has two things somebody might have seen.
    for (const h of PIP_HAUNTS) expect(h.hints?.length, h.id).toBe(2);
  });
});

describe('the painter', () => {
  it("hands over today's painting once, and each view in each season is a painting of its own", () => {
    const save = emptySave();
    const first = wandererTurn(save, 'nell', days[0] as string, 'winter', 'day', false);
    expect(first?.painting?.id).toBe(paintingId(painterToday(days[0] as string).id, 'winter'));
    expect(wandererWaits(save, 'nell', days[0] as string, 'winter', 'day')).toBe(false);
    expect(wandererTurn(save, 'nell', days[0] as string, 'winter', 'day', false)).toBeNull();
    // The same view in another season is another painting.
    expect(wandererTurn(save, 'nell', days[0] as string, 'fall', 'day', false)?.painting?.id).toBe(paintingId(painterToday(days[0] as string).id, 'fall'));
    expect(Object.keys(save.paintings)).toHaveLength(2);
  });

  it('gives her beret for three and her satchel for six', () => {
    const save = emptySave();
    const got: string[] = [];
    for (const day of days) {
      const turn = wandererTurn(save, 'nell', day, 'winter', 'day', false);
      for (const g of turn?.gear ?? []) {
        got.push(`${Object.keys(save.paintings).length}:${g}`);
        save.gear.owned.push(g);
      }
    }
    expect(Object.keys(save.paintings).length).toBe(PAINTER_HAUNTS.length);
    expect(got).toEqual([`${PAINTINGS_FOR_BERET}:hat-beret`, `${PAINTINGS_FOR_SATCHEL}:pack-satchel`]);
  });
});

describe('the camper', () => {
  it('has something for whoever finds him, once a day, three days running; after that, coffee', () => {
    const save = emptySave();
    const got: string[] = [];
    for (const day of days.slice(0, 5)) {
      const turn = wandererTurn(save, 'ro', day, 'winter', 'day', false);
      expect(turn, day).not.toBeNull();
      expect(wandererTurn(save, 'ro', day, 'winter', 'day', false), day).toBeNull();
      got.push(...(turn?.gear ?? []));
      save.gear.owned.push(...(turn?.gear ?? []));
    }
    expect(got).toEqual([...CAMPER_GIFTS]);
    expect(save.camper.days).toBe(5);
    expect(new Set(days.map((d) => camperToday(d).id)).size).toBeGreaterThanOrEqual(Math.min(4, CAMPER_HAUNTS.length));
  });
});

describe('the band', () => {
  it('teaches a tune each, says so when that makes four, and plays on a Saturday night once there is a bandstand', () => {
    expect(weekday(SATURDAY)).toBe(6);
    const save = emptySave();
    save.projects.bandstand = '2026-11-01';
    expect(concertOn(save, SATURDAY, 'night')).toBe(false);
    BAND.forEach((b, i) => {
      const turn = wandererTurn(save, b.who, days[0] as string, 'winter', 'day', false);
      expect(turn?.gear).toEqual([b.tune]);
      expect(turn?.tune).toBe(b.tune.replace('tune-', ''));
      expect(turn?.lines.length).toBe(i === BAND.length - 1 ? 2 : 1);
      save.gear.owned.push(b.tune);
      expect(wandererTurn(save, b.who, days[0] as string, 'winter', 'day', false)).toBeNull();
    });
    expect(concertOn(save, SATURDAY, 'day')).toBe(false);
    expect(concertOn(save, SATURDAY, 'dusk')).toBe(true);
    expect(concertOn(save, '2026-11-13', 'night')).toBe(false);
    // The first concert comes with the band's jacket, from whoever is spoken to first.
    expect(wandererWaits(save, 'fitch', SATURDAY, 'winter', 'night')).toBe(true);
    const played = wandererTurn(save, 'fitch', SATURDAY, 'winter', 'night', false);
    expect(played?.gear).toEqual(['jacket-band']);
    save.gear.owned.push('jacket-band');
    expect(wandererTurn(save, 'sal', SATURDAY, 'winter', 'night', false)?.gear).toEqual([]);
  });

  it('is not about until the bandstand stands', () => {
    const save = emptySave();
    for (const b of BAND) save.gear.owned.push(b.tune);
    expect(concertOn(save, SATURDAY, 'night')).toBe(false);
  });
});

describe('hide-and-seek', () => {
  it('begins once Pip has been met and wants nothing, and is over for the day when she is found', () => {
    const save = emptySave();
    expect(pipHiding(save, days[0] as string, false)).toBe(false);
    save.met.pip = days[0] as string;
    expect(pipHiding(save, days[0] as string, true)).toBe(false);
    expect(pipHiding(save, days[0] as string, false)).toBe(true);
    expect(wandererTurn(save, 'pip', days[0] as string, 'winter', 'day', true)?.lines).toEqual([PIP_FOUND[0]]);
    expect(pipHiding(save, days[0] as string, false)).toBe(false);
    expect(pipHiding(save, days[1] as string, false)).toBe(true);
  });

  it('earns her racing skis the third time and her crown the fifth', () => {
    const save = emptySave();
    save.met.pip = days[0] as string;
    const got: string[] = [];
    for (const day of days.slice(0, 7)) {
      const turn = wandererTurn(save, 'pip', day, 'winter', 'day', true);
      for (const g of turn?.gear ?? []) {
        got.push(`${save.hide.finds}:${g}`);
        save.gear.owned.push(g);
      }
    }
    expect(got).toEqual([`${FINDS_FOR_RACERS}:skis-racer`, `${FINDS_FOR_CROWN}:hat-crown`]);
    expect(save.hide.finds).toBe(7);
  });

  it("has the town say which way she went: the day's own two lines, about where she is", () => {
    for (const day of days) {
      const hints = pipToday(day).hints ?? [];
      expect(pipHint(day, 0)).toBe(hints[0]);
      expect(pipHint(day, 1)).toBe(hints[1]);
    }
  });
});
