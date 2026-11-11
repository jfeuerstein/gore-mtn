import { existsSync, statSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { MINERALS } from './minerals';
import { PEOPLE } from './people';
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
