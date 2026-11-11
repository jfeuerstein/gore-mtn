import { describe, expect, it } from 'vitest';
import { jingleFor, levelsFor, type Scene } from './soundscape';

const still: Scene = { mode: 'walk', glide: 'skis', speed: 0, slip: 0, height: 0, falling: 0, rain: false };

describe('levelsFor', () => {
  it('is nearly silent standing at the base on a still day', () => {
    const l = levelsFor(still);
    expect(l.wind).toBeLessThan(0.1);
    expect(l.glide).toBe(0);
    expect(l.lift).toBe(0);
    expect(l.rain).toBe(0);
  });

  it('brings up the wind with speed and with height', () => {
    expect(levelsFor({ ...still, mode: 'ski', speed: 24 }).wind).toBeGreaterThan(levelsFor({ ...still, mode: 'ski', speed: 8 }).wind);
    expect(levelsFor({ ...still, height: 1 }).wind).toBeGreaterThan(levelsFor(still).wind);
  });

  it('hisses in a carve and scrapes, lower and louder, in a skid', () => {
    const carve = levelsFor({ ...still, mode: 'ski', speed: 15, slip: 0.05 });
    const skid = levelsFor({ ...still, mode: 'ski', speed: 15, slip: 1.4 });
    expect(carve.glide).toBeGreaterThan(0.1);
    expect(skid.glide).toBeGreaterThan(carve.glide);
    expect(skid.glideTone).toBeLessThan(carve.glideTone);
  });

  it('makes no ski sound on foot or standing on skis', () => {
    expect(levelsFor({ ...still, speed: 6 }).glide).toBe(0);
    expect(levelsFor({ ...still, mode: 'ski', speed: 0 }).glide).toBe(0);
  });

  it('rumbles lower on a bike than skis hiss', () => {
    const skis = levelsFor({ ...still, mode: 'ski', speed: 12 });
    const bike = levelsFor({ ...still, mode: 'ski', glide: 'bike', speed: 12 });
    expect(bike.glideTone).toBeLessThan(skis.glideTone);
    expect(bike.glide).toBeGreaterThan(0);
  });

  it('hums on a lift and patters in rain, but snow falls silently', () => {
    expect(levelsFor({ ...still, mode: 'lift', speed: 30 }).lift).toBeGreaterThan(0);
    expect(levelsFor({ ...still, falling: 1, rain: true }).rain).toBeGreaterThan(0.3);
    expect(levelsFor({ ...still, falling: 1, rain: false }).rain).toBe(0);
  });

  it('keeps every level between nought and one whatever it is given', () => {
    for (const speed of [0, 5, 40, 500]) {
      for (const slip of [0, 1.57, 9]) {
        const l = levelsFor({ mode: 'ski', glide: 'skis', speed, slip, height: 3, falling: 7, rain: true });
        for (const v of [l.wind, l.glide, l.lift, l.rain]) {
          expect(v).toBeGreaterThanOrEqual(0);
          expect(v).toBeLessThanOrEqual(1);
        }
        expect(l.glideTone).toBeGreaterThan(200);
      }
    }
  });
});

describe('jingleFor', () => {
  it('has a tune for everything that can be earned', () => {
    for (const kind of ['mineral', 'trail', 'path', 'lift', 'peak', 'landmark', 'condition', 'season', 'sighting', 'errand', 'gear', 'item', 'patch', 'train']) {
      const j = jingleFor(kind);
      expect(j, kind).not.toBeNull();
      expect(j?.notes.length).toBeGreaterThan(0);
      for (const note of j?.notes ?? []) expect(note).toBeGreaterThan(100);
    }
    expect(jingleFor('hint')).toBeNull();
  });

  it('makes more of a first find than of one more of the same', () => {
    expect(jingleFor('mineral', '3.0 cm · New mineral')?.notes.length).toBeGreaterThan(jingleFor('mineral', '3.0 cm · 4 found')?.notes.length ?? 0);
    expect(jingleFor('sighting', 'New in the field guide')?.notes.length).toBeGreaterThan(jingleFor('sighting', 'Seen 3 times')?.notes.length ?? 0);
    expect(jingleFor('patch')?.notes.length).toBeGreaterThan(jingleFor('trail')?.notes.length ?? 0);
  });
});
