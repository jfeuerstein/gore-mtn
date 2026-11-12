import { existsSync, statSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { loadTestWorld } from '../world/testWorld';
import { namedSpots } from '../world/whereabouts';
import { SEASONS } from '../look/season';
import { SHOP_SIGNS } from '../world/houseKinds';
import { SHOP_SIGN_ART } from '../world/shopSignArt';
import { TOWN_LISTINGS } from '../world/townPlaces';
import { artSlug } from './artNames';
import { MINERALS } from './minerals';
import { OFFERINGS } from './offerings';
import { buildLandmarks, buildPeaks, CONDITIONS } from './passport';
import { KEEPSAKE, PATCHES } from './patches';
import { PROJECTS } from './projects';
import { GEAR, PEOPLE } from './people';
import { SPECIES } from './wildlife';

const art = (set: string, id: string): URL => new URL(`../../public/art/${set}/${id}.webp`, import.meta.url);

// The pictures are made by tools/art/make-art.mjs. These fail if someone or something is added
// to the game without a picture being made for it.
describe('generated art', () => {
  it('has a portrait for everyone who can be talked to', () => {
    // A noticeboard has no face.
    expect(PEOPLE.filter((p) => p.kind !== 'board' && !existsSync(art('people', p.id))).map((p) => p.id)).toEqual([]);
  });

  it('has a plate for every mineral and every entry in the field guide', () => {
    expect(MINERALS.filter((m) => !existsSync(art('minerals', m.id))).map((m) => m.id)).toEqual([]);
    expect(SPECIES.filter((s) => !existsSync(art('species', s.id))).map((s) => s.id)).toEqual([]);
  });

  it('has a postcard for every landmark in the passport', () => {
    const world = loadTestWorld();
    const landmarks = buildLandmarks(world.places, namedSpots(world));
    expect(landmarks.length).toBeGreaterThanOrEqual(20);
    expect(landmarks.filter((l) => !existsSync(art('places', l.id))).map((l) => l.id)).toEqual([]);
    for (const l of landmarks) expect(statSync(art('places', l.id)).size, l.id).toBeLessThan(60000);
  });

  it('has a postcard for everything the town builds', () => {
    expect(PROJECTS.filter((p) => !existsSync(art('places', p.id))).map((p) => p.id)).toEqual([]);
    for (const p of PROJECTS) expect(statSync(art('places', p.id)).size, p.id).toBeLessThan(60000);
  });

  it('has a picture for everything that can be had: patches, hats and jackets, bakes, sandwiches and books, conditions, summits and lift pins', () => {
    const world = loadTestWorld();
    const sets: [string, string[]][] = [
      ['patches', [...PATCHES.map((p) => p.id), KEEPSAKE.id]],
      ['gear', GEAR.map((g) => g.id)],
      ['offerings', OFFERINGS.map((o) => o.id)],
      ['conditions', CONDITIONS.map((c) => c.id)],
      ['peaks', buildPeaks(world.places, world.lifts).map((p) => p.id)],
      ['pins', [...new Set(world.lifts.map((l) => l.kind))]],
      ['title', [...SEASONS]],
    ];
    for (const [set, ids] of sets) {
      expect(ids.filter((id) => !existsSync(art(set, artSlug(id)))), set).toEqual([]);
      for (const id of ids) expect(statSync(art(set, artSlug(id))).size, `${set}/${id}`).toBeLessThan(set === 'title' ? 140000 : 30000);
    }
  });

  it('has a picture on the sheet for every shop sign in town', () => {
    expect(existsSync(new URL('../../public/art/shop-signs.webp', import.meta.url))).toBe(true);
    expect(SHOP_SIGNS.filter((s) => !SHOP_SIGN_ART.includes(s))).toEqual([]);
    // And for the named places that are shops.
    for (const sign of ["JUNE'S BAKERY", "WALT'S DELI", 'POST OFFICE']) {
      expect(TOWN_LISTINGS.some((l) => l.sign === sign), sign).toBe(true);
      expect(SHOP_SIGN_ART, sign).toContain(sign);
    }
  });

  it('keeps each picture small enough for a phone on a chairlift', () => {
    for (const [set, ids] of [
      ['people', PEOPLE.filter((p) => p.kind !== 'board').map((p) => p.id)],
      ['minerals', MINERALS.map((m) => m.id)],
      ['species', SPECIES.map((s) => s.id)],
    ] as const) {
      for (const id of ids) expect(statSync(art(set, id)).size, `${set}/${id}`).toBeLessThan(60000);
    }
  });
});
