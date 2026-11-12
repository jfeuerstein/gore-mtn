import { existsSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { TUNE_VOICES } from '../audio/soundscape';
import { emptySave } from './save';
import { addStone, BELL_HEARD, bellRemark, dayAfter, discover, foundOf, monthDay, PLAQUES_FOR_LINE, ringBell, RUN_IDS, secretById, SECRETS, skiedRun, STONES_FOR_GOLD, thereNow } from './secrets';
import { GEAR, PEOPLE } from './people';

const DAY = '2026-11-12';

describe('the secrets', () => {
  it('have ids of their own, something to do at each, and something to read at all but the cairns', () => {
    expect(new Set(SECRETS.map((s) => s.id)).size).toBe(SECRETS.length);
    for (const s of SECRETS) {
      expect(s.action.length, s.id).toBeGreaterThan(2);
      if (s.kind !== 'cairn') expect(s.pages.length, s.id).toBeGreaterThan(0);
      for (const page of s.pages) {
        // Short enough to read in a breath or two, and in the game's own English.
        expect(page.text.length, s.id).toBeLessThan(260);
        expect(page.text, s.id).not.toMatch(/\b(do not|cannot|did not|is not|colour|grey)\b/i);
      }
    }
  });

  it('are found once, and hand over what was lying there once', () => {
    const save = emptySave();
    const first = discover(save, 'register-vermont', DAY);
    expect(first?.first).toBe(true);
    expect(first?.gear).toEqual(['goggles-rose']);
    // The register has a line for whoever opens it.
    expect(first?.pages.at(-1)?.signed).toBe('-you, Nov. 12');
    save.gear.owned.push('goggles-rose');
    const again = discover(save, 'register-vermont', '2026-12-01');
    expect(again?.first).toBe(false);
    expect(again?.gear).toEqual([]);
    // Signed the day it was first opened, however often it is read.
    expect(again?.pages.at(-1)?.signed).toBe('-you, Nov. 12');
    expect(foundOf(save, 'register')).toBe(1);
  });

  it('keep a room locked until its key has been picked up somewhere else', () => {
    const save = emptySave();
    const shut = discover(save, 'room-mid-station', DAY);
    expect(shut?.open).toBe(false);
    expect('room-mid-station' in save.secrets).toBe(false);
    expect(discover(save, 'working-cellar', DAY)?.key).toBe('key-brass');
    const open = discover(save, 'room-mid-station', DAY);
    expect(open?.open).toBe(true);
    expect(open?.gear).toEqual(['jacket-1967']);
    // The key is picked up once.
    expect(discover(save, 'working-cellar', DAY)?.key).toBeNull();
  });

  it('thank whoever has signed every register, and read a good many plaques, with a line to leave in the snow', () => {
    const save = emptySave();
    const registers = SECRETS.filter((s) => s.kind === 'register');
    const given = registers.flatMap((s) => discover(save, s.id, DAY)?.gear ?? []);
    expect(given).toContain('trail-sky');
    const plaques = SECRETS.filter((s) => s.kind === 'plaque');
    expect(plaques.length).toBeGreaterThan(PLAQUES_FOR_LINE + 8);
    const read = plaques.slice(0, PLAQUES_FOR_LINE).flatMap((s) => discover(save, s.id, DAY)?.gear ?? []);
    expect(read).toEqual(['trail-garnet']);
  });
});

describe('what the secrets show and give', () => {
  it('has a picture of the inside of every room (tools/art/make-art.mjs rooms makes them)', () => {
    for (const s of SECRETS.filter((q) => q.kind === 'room')) expect(existsSync(new URL(`../../public/art/${s.art}.webp`, import.meta.url)), s.id).toBe(true);
  });

  it('plays every tune there is to learn in a voice of its own', () => {
    for (const g of GEAR.filter((q) => q.slot === 'tune')) expect(TUNE_VOICES[g.style ?? ''], g.id).toBeDefined();
  });
});

describe('the cairns and the bell', () => {
  it('take one stone a day each, and gold dust for a dozen', () => {
    const save = emptySave();
    expect(addStone(save, 'cairn-gore', DAY)?.stones).toBe(1);
    expect(addStone(save, 'cairn-gore', DAY)).toBeNull();
    expect(addStone(save, 'cairn-bear', DAY)?.stones).toBe(1);
    let day = DAY;
    let gold: string[] = [];
    for (let i = 0; i < STONES_FOR_GOLD; i++) {
      day = dayAfter(day);
      const given = addStone(save, 'cairn-gore', day)?.gear ?? [];
      // (The game puts what is given in the wardrobe; here it is done by hand.)
      save.gear.owned.push(...given);
      gold = [...gold, ...given];
    }
    expect(gold).toEqual(['trail-gold']);
    expect(addStone(save, 'register-vermont', day)).toBeNull();
  });

  it('is heard in town, and spoken of the next day by each who heard it, once', () => {
    const save = emptySave();
    for (const who of Object.keys(BELL_HEARD)) expect(PEOPLE.some((p) => p.id === who), who).toBe(true);
    expect(bellRemark(save, 'hazel', DAY)).toBeNull();
    expect(ringBell(save, DAY)).toBe(true);
    expect(ringBell(save, DAY)).toBe(false);
    // Not the same day: tomorrow.
    expect(bellRemark(save, 'hazel', DAY)).toBeNull();
    const next = dayAfter(DAY);
    expect(bellRemark(save, 'hazel', next)).toBe(BELL_HEARD.hazel);
    expect(bellRemark(save, 'hazel', next)).toBeNull();
    expect(bellRemark(save, 'otto', next)).toBe(BELL_HEARD.otto);
    expect(bellRemark(save, 'marge', dayAfter(next))).toBeNull();
  });

  it('writes a day as a register would', () => {
    expect(monthDay('2026-03-04')).toBe('March 4');
    expect(dayAfter('2026-12-31')).toBe('2027-01-01');
  });
});

describe('things to follow, and things that are only there sometimes', () => {
  it('finds the den asleep in winter, and brings a kit away from it once the snow has gone', () => {
    const save = emptySave();
    const winter = discover(save, 'den', DAY, 'winter');
    expect(winter?.first).toBe(true);
    expect(winter?.gear).toEqual([]);
    const spring = discover(save, 'den', '2027-04-20', 'spring');
    expect(spring?.first).toBe(false);
    expect(spring?.gear).toEqual(['pet-kit']);
    expect(spring?.pages).not.toEqual(winter?.pages);
    expect(discover(save, 'den', '2027-10-01', 'fall')?.gear).toEqual([]);
  });

  it('has the sugarmaker\'s cap in the shack only while the sap is running', () => {
    const save = emptySave();
    expect(discover(save, 'shack', DAY, 'winter')?.gear).toEqual([]);
    expect(discover(save, 'shack', '2027-03-20', 'spring')?.gear).toEqual(['hat-sugar']);
  });

  it('has a nest only in spring and summer, and a lantern only after dark', () => {
    const nest = secretById('nest');
    const light = secretById('light');
    expect(nest && light).toBeTruthy();
    if (!nest || !light) return;
    expect(thereNow(nest, 'spring', false)).toBe(true);
    expect(thereNow(nest, 'winter', false)).toBe(false);
    expect(thereNow(light, 'winter', false)).toBe(false);
    expect(thereNow(light, 'winter', true)).toBe(true);
    // Both are shy: they are walked up to.
    expect(nest.shy && light.shy).toBe(true);
    // The lantern has the key to the last locked door.
    expect(SECRETS.some((s) => s.needs === light.key)).toBe(true);
  });

  it('counts an unmarked run once it has been found and come down: amber lenses for the first, birch skis for them all', () => {
    const save = emptySave();
    expect(RUN_IDS.length).toBe(3);
    expect(skiedRun(save, RUN_IDS[0] as string, DAY)).toBeNull();
    const got: string[] = [];
    for (const id of RUN_IDS) {
      discover(save, id, DAY);
      const ran = skiedRun(save, id, DAY);
      got.push(...(ran?.gear ?? []));
      save.gear.owned.push(...(ran?.gear ?? []));
      expect(skiedRun(save, id, DAY)).toBeNull();
    }
    expect(got).toEqual(['goggles-amber', 'skis-birch']);
  });
});
