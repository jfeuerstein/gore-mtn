import { describe, expect, it } from 'vitest';
import { SEASONS } from '../look/season';
import { loadTestWorld } from '../world/testWorld';
import { MUSEUM_AT, TOWN_LISTINGS } from '../world/townPlaces';
import { locate } from '../world/whereabouts';
import { MINERALS } from './minerals';
import { fullness, give, given, had, HALLS, keeperSays, MUSEUM_GIFTS, nextGift, PIECES, RELICS, toGive, wanted } from './museum';
import { PATCHES } from './patches';
import { ERRANDS, GEAR, PEOPLE } from './people';
import { emptySave, parseSave, serializeSave } from './save';
import { SPECIES } from './wildlife';

const day = '2026-12-01';

describe('the museum', () => {
  it('has a place for every stone, everything in the field guide, every old thing and every painting', () => {
    expect(PIECES.filter((p) => p.hall === 'stones')).toHaveLength(MINERALS.length);
    expect(PIECES.filter((p) => p.hall === 'nature')).toHaveLength(SPECIES.length);
    expect(PIECES.filter((p) => p.hall === 'old')).toHaveLength(RELICS.length);
    expect(PIECES.filter((p) => p.hall === 'gallery')).toHaveLength(6 * SEASONS.length);
    expect(new Set(PIECES.map((p) => p.key)).size).toBe(PIECES.length);
    for (const hall of HALLS) expect(PIECES.some((p) => p.hall === hall.id), hall.id).toBe(true);
  });

  it('starts empty, with nothing to show', () => {
    const save = emptySave();
    expect(fullness(save).given).toBe(0);
    expect(toGive(save)).toEqual([]);
    expect(give(save, day)).toEqual([]);
    expect(keeperSays(save, day, 'winter')).toContain('empty');
  });

  it('takes what the player has found, once, and takes nothing from the Book', () => {
    const save = emptySave();
    save.minerals.garnet = { count: 2, best: 4, first: day };
    save.sightings.fox = { count: 1, first: day };
    save.paintings['cliffs-winter'] = day;
    expect(toGive(save).map((p) => p.key).sort()).toEqual(['mineral:garnet', 'painting:cliffs-winter', 'species:fox']);
    expect(keeperSays(save, day, 'winter')).toContain('May I');
    const before = JSON.stringify([save.minerals, save.sightings, save.paintings]);
    expect(give(save, day)).toHaveLength(3);
    expect(JSON.stringify([save.minerals, save.sightings, save.paintings])).toBe(before);
    expect(fullness(save).given).toBe(3);
    expect(fullness(save).halls.stones.given).toBe(1);
    expect(toGive(save)).toEqual([]);
    expect(give(save, '2026-12-02')).toEqual([]);
    // A second garnet is not a second piece.
    save.minerals.garnet.count = 9;
    expect(toGive(save)).toEqual([]);
  });

  it('counts an old thing the moment it is brought back, and not before', () => {
    const save = emptySave();
    const lamp = PIECES.find((p) => p.key === 'relic:relic-lamp');
    if (!lamp) throw new Error('no lamp');
    save.errands['relic-lamp'] = { taken: day };
    save.items.push('relic-lamp');
    expect(had(save, lamp)).toBe(false);
    expect(given(save, lamp)).toBe(false);
    save.errands['relic-lamp'] = { taken: day, done: day };
    expect(given(save, lamp)).toBe(true);
    expect(fullness(save).halls.old.given).toBe(1);
    // It is never something to hand over from the sheet.
    expect(toGive(save)).toEqual([]);
  });

  it('keeps what was given through a save and a load, and reads an older save as an empty museum', () => {
    const save = emptySave();
    save.minerals.quartz = { count: 1, best: 3, first: day };
    give(save, day);
    expect(parseSave(serializeSave(save)).museum).toEqual({ 'mineral:quartz': day });
    const old = JSON.parse(serializeSave(emptySave())) as Record<string, unknown>;
    delete old.museum;
    expect(parseSave(JSON.stringify(old)).museum).toEqual({});
  });

  it('asks after something it lacks that is about this season, the same thing all day', () => {
    const save = emptySave();
    for (const season of SEASONS) {
      const want = wanted(save, day, season);
      expect(want, season).not.toBeNull();
      expect(want?.hint.length).toBeGreaterThan(8);
      expect(wanted(save, day, season)?.piece.key).toBe(want?.piece.key);
      const mineral = MINERALS.find((m) => `mineral:${m.id}` === want?.piece.key);
      if (mineral?.when?.seasons) expect(mineral.when.seasons).toContain(season);
      const species = SPECIES.find((s) => `species:${s.id}` === want?.piece.key);
      if (species?.seasons) expect(species.seasons).toContain(season);
    }
    // Over a month it asks after many different things, stones and creatures both.
    const asked = new Set<string>();
    for (let d = 1; d <= 30; d++) asked.add(wanted(save, `2026-06-${String(d).padStart(2, '0')}`, 'summer')?.piece.hall ?? '');
    expect(asked).toEqual(new Set(['stones', 'nature']));
    // A meteorite is only asked after when one could be lying about.
    const keys = new Set<string>();
    for (let d = 1; d <= 9; d++) keys.add(wanted(save, `2026-06-${String(d).padStart(2, '0')}`, 'summer')?.piece.key ?? '');
    expect(keys.has('mineral:meteorite')).toBe(false);
    // With every case full there is nothing to ask for.
    for (const piece of PIECES) save.museum[piece.key] = day;
    expect(wanted(save, day, 'winter')).toBeNull();
  });

  it('hands over things to wear as it fills, each of which exists and is listed as coming from it', () => {
    const save = emptySave();
    expect(nextGift(save)?.gear).toBe('hat-museum');
    let last = 0;
    for (const gift of MUSEUM_GIFTS) {
      expect(GEAR.some((g) => g.id === gift.gear), gift.gear).toBe(true);
      expect(gift.at).toBeGreaterThan(last);
      expect(gift.at).toBeLessThan(PIECES.length);
      last = gift.at;
    }
    save.gear.owned.push(...MUSEUM_GIFTS.map((g) => g.gear));
    expect(nextGift(save)).toBeNull();
  });

  it('has an errand for every old thing, asked by its keeper one after another, each lost somewhere on the real mountain', () => {
    const world = loadTestWorld();
    const errands = ERRANDS.filter((e) => e.from === 'silas');
    expect(errands.map((e) => e.id)).toEqual(RELICS.map((r) => r.id));
    errands.forEach((e, i) => {
      expect(e.need, e.id).toEqual({ kind: 'item', id: e.id });
      expect(e.after, e.id).toBe(i === 0 ? undefined : (errands[i - 1] as (typeof errands)[number]).id);
      expect(e.lost, e.id).toBeDefined();
      expect(locate(world, (e.lost as NonNullable<typeof e.lost>).at), e.id).not.toBeNull();
    });
    // No two lie in the same place.
    const at = errands.map((e) => locate(world, (e.lost as NonNullable<typeof e.lost>).at) as { x: number; z: number });
    for (let i = 0; i < at.length; i++) for (let j = 0; j < i; j++) expect(Math.hypot((at[i] as { x: number }).x - (at[j] as { x: number }).x, (at[i] as { z: number }).z - (at[j] as { z: number }).z)).toBeGreaterThan(60);
  });

  it('has a building in town, with its keeper at the door', () => {
    const silas = PEOPLE.find((p) => p.id === 'silas');
    expect(silas?.at).toEqual(MUSEUM_AT);
    expect(TOWN_LISTINGS.find((l) => l.id === 'museum')?.near).toEqual(MUSEUM_AT);
  });

  it('has patches for its halls', () => {
    for (const id of ['museum-friend', 'stone-hall', 'natural-history', 'old-things']) expect(PATCHES.some((p) => p.id === id), id).toBe(true);
  });
});
