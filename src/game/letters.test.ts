import { describe, expect, it } from 'vitest';
import { loadTestWorld } from '../world/testWorld';
import { Game, type GameWorld, type SaveStore } from './game';
import { EVERY_PATCH, letterWaiting, LETTERS } from './letters';
import { PATCHES } from './patches';
import { PROJECTS } from './projects';
import { MINERALS } from './minerals';
import { OFFERINGS } from './offerings';
import { ERRANDS, personById } from './people';
import { emptySave } from './save';

const world = loadTestWorld();
const gameWorld: GameWorld = {
  trails: world.trails,
  lifts: world.lifts,
  places: world.places,
  minX: world.source.minX,
  minZ: world.source.minZ,
  trailDistance: (x, z) => world.trailDistance(x, z),
  slopeDegAt: (x, z) => world.source.slopeDegAt(x, z),
  rumourSpots: world.spots.filter((s) => s.kind === 'viewpoint').map((s) => ({ name: s.name, x: s.x, z: s.z })),
};
const memory = (): SaveStore & { text: string | null } => {
  const store = { text: null as string | null, read: () => store.text, write: (t: string) => void (store.text = t) };
  return store;
};

describe('the letters', () => {
  it('have distinct ids, are short, and come from people who exist', () => {
    expect(new Set(LETTERS.map((l) => l.id)).size).toBe(LETTERS.length);
    expect(LETTERS.length).toBeGreaterThanOrEqual(14);
    for (const l of LETTERS) {
      expect(l.text.length, l.id).toBeLessThan(230);
      expect(l.signed.length, l.id).toBeGreaterThan(0);
      if (l.from) expect(personById(l.from), l.id).toBeDefined();
    }
  });

  it('saves the last letter for a full book, and sends it ahead of the queue', () => {
    expect(EVERY_PATCH).toBe(PATCHES.length);
    const save = emptySave();
    expect(letterWaiting(save, {}, '2026-11-11')?.id).not.toBe('the-whole-town');
    for (const p of PATCHES) save.patches[p.id] = '2026-11-01';
    expect(letterWaiting(save, { test: '2026-11-02' }, '2026-11-11')?.id).toBe('the-whole-town');
  });

  it('always has something for a brand-new player', () => {
    expect(letterWaiting(emptySave(), {}, '2026-11-11')?.id).toBe('test');
  });

  it('delivers one a day, each once, and only when its time has come', () => {
    const save = emptySave();
    const had: Record<string, string> = {};
    const first = letterWaiting(save, had, '2026-11-11');
    had[first?.id ?? ''] = '2026-11-11';
    expect(letterWaiting(save, had, '2026-11-11')).toBeNull();
    const second = letterWaiting(save, had, '2026-11-12');
    expect(second).not.toBeNull();
    expect(second?.id).not.toBe(first?.id);
    // Nobody has been met, so nothing from them yet.
    expect(second?.from).toBeNull();
    save.met.pip = '2026-11-12';
    had[second?.id ?? ''] = '2026-11-12';
    expect(letterWaiting(save, had, '2026-11-13')?.from).toBe('pip');
  });

  it('can all be had in the end by someone who has done everything', () => {
    const save = emptySave();
    for (const l of LETTERS) if (l.from) save.met[l.from] = '2026-11-01';
    for (const e of ERRANDS) save.errands[e.id] = { taken: '2026-11-01', done: '2026-11-01' };
    for (const o of OFFERINGS) save.tried[o.id] = '2026-11-01';
    for (const id of ['snowman', 'rumor']) save.sightings[id] = { count: 1, first: '2026-11-01' };
    for (const p of PROJECTS) save.projects[p.id] = '2026-11-01';
    for (const p of PATCHES) save.patches[p.id] = '2026-11-01';
    save.cabin.feeder = '2026-11-01';
    const had: Record<string, string> = {};
    for (let day = 1; day <= LETTERS.length; day++) {
      // A letter a day, on into January.
      const key = day <= 31 ? `2026-12-${String(day).padStart(2, '0')}` : `2027-01-${String(day - 31).padStart(2, '0')}`;
      const letter = letterWaiting(save, had, key);
      expect(letter, key).not.toBeNull();
      had[letter?.id ?? ''] = key;
    }
    expect(Object.keys(had)).toHaveLength(LETTERS.length);
    expect(letterWaiting(save, had, '2027-03-01')).toBeNull();
  });
});

describe('the post office, the inn and the dog', () => {
  const DAY = '2026-11-11';

  it('hands over the day\'s letter at the post office, once', () => {
    const game = new Game(gameWorld, memory());
    const first = game.talk('dot', DAY, 'winter');
    expect(first?.letter?.id).toBe('test');
    expect(first?.events.map((e) => e.kind)).toContain('item');
    expect(game.summary().letters).toBe(1);
    expect(game.talk('dot', DAY, 'winter')?.letter).toBeUndefined();
    expect(game.talk('dot', '2026-11-12', 'winter')?.letter?.id).toBe('town-snowman');
  });

  it('tells the same rumour all day, of a real mineral at a real spot, and a new one tomorrow', () => {
    const game = new Game(gameWorld, memory());
    const today = game.rumour(DAY);
    expect(today).not.toBeNull();
    expect(game.rumour(DAY)).toBe(today);
    expect(MINERALS).toContain(today?.find.mineral);
    expect(gameWorld.rumourSpots?.map((s) => s.name)).toContain(today?.place);
    const days = new Set<string>();
    for (let d = 10; d < 30; d++) days.add(`${game.rumour(`2026-11-${d}`)?.place}/${game.rumour(`2026-11-${d}`)?.find.mineral.id}`);
    expect(days.size).toBeGreaterThan(5);
  });

  it('puts the rumoured stone where the innkeeper says, to be picked up once', () => {
    const game = new Game(gameWorld, memory());
    const rumour = game.rumour(DAY);
    if (!rumour) throw new Error('no rumour');
    // She says hello and asks her errand; the next time, she passes on the day's talk.
    expect(game.talk('marge', DAY, 'winter')?.offer?.id).toBe('the-bet');
    const said = game.talk('marge', DAY, 'winter')?.lines.join(' ') ?? '';
    expect(said).toContain(rumour.place);
    expect(game.talk('marge', DAY, 'winter')?.lines.join(' ')).not.toContain(rumour.place);
    expect(game.findsNear(rumour.find.x, rumour.find.z, DAY).some((f) => f.id === rumour.find.id)).toBe(true);
    expect(game.pickUp(rumour.find.x, rumour.find.z, DAY).map((g) => g.find.id)).toContain(rumour.find.id);
    expect(game.findsNear(rumour.find.x, rumour.find.z, DAY).some((f) => f.id === rumour.find.id)).toBe(false);
    expect(game.save.minerals[rumour.find.mineral.id]?.count).toBeGreaterThanOrEqual(1);
  });

  it('has no rumour without spots for one to lie at', () => {
    expect(new Game({ ...gameWorld, rumourSpots: [] }, memory()).rumour(DAY)).toBeNull();
  });

  it('lets people remark on the weather and the hour before their usual talk', () => {
    const game = new Game(gameWorld, memory());
    game.talk('pickles', DAY, 'winter');
    expect(personById('pickles')?.moods?.snowing).toContain(game.talk('pickles', DAY, 'winter', 'snowing')?.lines[0]);
    const quiet = new Game(gameWorld, memory());
    quiet.talk('pickles', DAY, 'winter');
    expect(personById('pickles')?.moods?.snowing).not.toContain(quiet.talk('pickles', DAY, 'winter')?.lines[0]);
  });

  it('counts a pat of the dog once a day', () => {
    const game = new Game(gameWorld, memory());
    expect(game.pet(DAY)).toBe(true);
    expect(game.pet(DAY)).toBe(false);
    expect(game.pet('2026-11-12')).toBe(true);
    expect(game.save.pets).toEqual([DAY, '2026-11-12']);
  });
});
