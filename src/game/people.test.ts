import { describe, expect, it } from 'vitest';
import { countryOf } from '../world/country';
import { loadTestWorld } from '../world/testWorld';
import { namedSpots } from '../world/whereabouts';
import { Game, type GameWorld, type SaveStore } from './game';
import { MINERALS } from './minerals';
import { buildLandmarks } from './passport';
import { DEFAULT_GEAR, ERRANDS, errandById, GEAR, gearById, PEOPLE, personById, TOWN_ROUND } from './people';
import { SPECIES } from './wildlife';

const world = loadTestWorld();
const gameWorld: GameWorld = {
  trails: world.trails,
  lifts: world.lifts,
  places: world.places,
  paths: world.paths,
  spots: namedSpots(world),
  country: countryOf(world),
  minX: world.source.minX,
  minZ: world.source.minZ,
  trailDistance: (x, z) => world.trailDistance(x, z),
  slopeDegAt: (x, z) => world.source.slopeDegAt(x, z),
};
const memory = (initial: string | null = null): SaveStore & { text: string | null } => {
  const store = { text: initial, read: () => store.text, write: (t: string) => void (store.text = t) };
  return store;
};
const DAY = '2026-11-11';

describe('the people', () => {
  it('each have a name, a place, something to say and distinct ids', () => {
    expect(new Set(PEOPLE.map((p) => p.id)).size).toBe(PEOPLE.length);
    expect(PEOPLE.length).toBeGreaterThanOrEqual(8);
    for (const p of PEOPLE) {
      expect(p.hello.length, p.id).toBeGreaterThan(20);
      expect(p.chat.length, p.id).toBeGreaterThanOrEqual(2);
      for (const line of [p.hello, ...p.chat, ...Object.values(p.seasonal ?? {}).flat()]) expect(line.length, `${p.id}: ${line}`).toBeLessThan(170);
    }
  });

  it('talk the way people talk: in contractions, a row or two at a time, as it is spelled in New York', () => {
    // Nobody says "do not" out loud. Tom is left out: his notes are in a nine-year-old's hand, and she writes it all out.
    const stiff = /\b(do not|does not|did not|is not|are not|was not|cannot|will not|would not|could not|have not|has not|I am not)\b/;
    const abroad = /\b(colour|favourite|neighbour|centre|plough|practise|metres|doughnut|labelled|car park|cosy)\b/i;
    const spoken = (p: (typeof PEOPLE)[number]): string[] => [p.hello, ...p.chat, ...Object.values(p.seasonal ?? {}).flat(), ...Object.values(p.moods ?? {}).flat(), ...Object.values(p.wearing ?? {})];
    for (const p of PEOPLE) {
      for (const line of spoken(p)) {
        if (p.kind !== 'snowman') expect(line, p.id).not.toMatch(stiff);
        expect(line, p.id).not.toMatch(abroad);
        // A line is at most a few short rows in one bubble; a notice may be a list.
        expect(line.split('\n').length, `${p.id}: ${line}`).toBeLessThanOrEqual(p.kind === 'board' ? 5 : 3);
      }
    }
    for (const e of ERRANDS) {
      for (const line of [e.ask, e.nudge, e.thanks, e.fetch?.handover ?? '']) {
        if (personById(e.from)?.kind !== 'snowman') expect(line, e.id).not.toMatch(stiff);
        expect(line, e.id).not.toMatch(abroad);
      }
    }
  });
});

describe('the errands', () => {
  it('are asked by and finished with people who exist, and reward gear that exists', () => {
    expect(new Set(ERRANDS.map((e) => e.id)).size).toBe(ERRANDS.length);
    for (const e of ERRANDS) {
      expect(personById(e.from), e.id).toBeDefined();
      if (e.to) expect(personById(e.to), e.id).toBeDefined();
      if (e.after) expect(errandById(e.after), e.id).toBeDefined();
      if (e.reward?.gear) expect(gearById(e.reward.gear), e.id).toBeDefined();
      if (e.fetch) expect(personById(e.fetch.from), e.id).toBeDefined();
      for (const line of [e.ask, e.nudge, e.thanks]) expect(line.length, `${e.id}: ${line}`).toBeLessThan(230);
    }
  });

  it('ask only for things the mountain has', () => {
    const landmarks = buildLandmarks(world.places, namedSpots(world)).map((l) => l.id);
    const lifts = new Set(world.lifts.map((l) => l.name).filter(Boolean)).size;
    for (const e of ERRANDS) {
      const n = e.need;
      if (n.kind === 'mineral' || n.kind === 'mineralSize') {
        const mineral = MINERALS.find((m) => m.id === n.id);
        expect(mineral, e.id).toBeDefined();
        if (n.kind === 'mineralSize') expect(n.cm, e.id).toBeLessThan(mineral?.largest ?? 0);
      }
      if (n.kind === 'minerals') expect(n.count).toBeLessThanOrEqual(MINERALS.length);
      if (n.kind === 'species') expect(SPECIES.some((s) => s.id === n.id), e.id).toBe(true);
      if (n.kind === 'speciesCount') expect(n.count).toBeLessThanOrEqual(SPECIES.length);
      if (n.kind === 'trail') expect(world.trails.some((t) => t.name === n.name), e.id).toBe(true);
      if (n.kind === 'lifts') expect(n.count, e.id).toBeLessThanOrEqual(lifts);
      if (n.kind === 'landmark') expect(landmarks, e.id).toContain(n.id);
      if (n.kind === 'item') expect(Boolean(e.lost) !== Boolean(e.fetch), `${e.id} needs exactly one way to come by its item`).toBe(true);
      // A seasonal thing is asked for in a season it can be found in.
      if (n.kind === 'species' && e.seasons) {
        const species = SPECIES.find((s) => s.id === n.id);
        for (const season of e.seasons) expect(!species?.seasons || species.seasons.includes(season), `${e.id} in ${season}`).toBe(true);
      }
    }
  });

  it('only has people remark on things that can be worn, and remark once a day', () => {
    for (const person of PEOPLE) for (const id of Object.keys(person.wearing ?? {})) expect(gearById(id), `${person.id}: ${id}`).toBeDefined();
    const game = new Game(gameWorld, memory());
    game.save.gear = { owned: ['hat-antlers'], hat: 'hat-antlers', jacket: '' };
    game.talk('biscuit', DAY, 'winter');
    const remark = game.talk('biscuit', DAY, 'winter');
    expect(remark?.lines[0]).toBe(personById('biscuit')?.wearing?.['hat-antlers']);
    expect(game.talk('biscuit', DAY, 'winter')?.lines[0]).not.toBe(remark?.lines[0]);
  });

  it('asks an errand once a day, and has other things to say if it is turned down', () => {
    const game = new Game(gameWorld, memory());
    expect(game.talk('fenn', DAY, 'winter')?.offer?.id).toBe('overdue');
    // Not taken. The next time, the day's book instead; the day after, the errand again.
    const second = game.talk('fenn', DAY, 'winter');
    expect(second?.offer).toBeUndefined();
    expect(second?.events.some((e) => e.kind === 'item')).toBe(true);
    expect(game.talk('fenn', '2026-11-12', 'winter')?.offer?.id).toBe('overdue');
  });

  it('keeps each bench the first time it is sat on', () => {
    const benches = [
      { id: 'bench:a', name: 'Outside the Inn' },
      { id: 'bench:b', name: 'At Vermont Overlook' },
    ];
    const game = new Game({ ...gameWorld, benches }, memory());
    const first = game.sat('bench:a', DAY);
    expect(first).toHaveLength(1);
    expect(first[0]?.detail).toContain('bench 1 of 2');
    expect(game.sat('bench:a', DAY)).toHaveLength(0);
    expect(game.sat('bench:nowhere', DAY)).toHaveLength(0);
    game.sat('bench:b', DAY);
    expect(game.summary().benches).toBe(2);
    expect(game.summary().benchesTotal).toBe(2);
  });

  it('counts a round of the town when every door has been called at in one day', () => {
    for (const r of TOWN_ROUND) expect(personById(r.who), r.who).toBeDefined();
    const game = new Game(gameWorld, memory());
    const events = TOWN_ROUND.flatMap((r) => game.talk(r.who, DAY, 'winter')?.events ?? []);
    expect(events.filter((e) => e.title === 'The town round')).toHaveLength(1);
    expect(game.save.rounds).toEqual([DAY]);
    // Calling again the same day does not count twice; the next day starts a fresh card.
    for (const r of TOWN_ROUND) game.talk(r.who, DAY, 'winter');
    expect(game.save.rounds).toEqual([DAY]);
    game.talk('dot', '2026-11-12', 'winter');
    expect(game.save.round).toEqual({ day: '2026-11-12', who: ['dot'] });
    expect(game.save.rounds).toEqual([DAY]);
  });

  it('can each earn every piece of gear but the two the player starts in', () => {
    const earned = new Set(ERRANDS.map((e) => e.reward?.gear).filter(Boolean));
    for (const g of GEAR) {
      if (g.id === DEFAULT_GEAR.hat || g.id === DEFAULT_GEAR.jacket) continue;
      expect(earned.has(g.id), g.id).toBe(true);
    }
  });
});

describe('talking and errands', () => {
  it('greets on first meeting, then offers an errand, which can be taken', () => {
    const game = new Game(gameWorld, memory());
    const first = game.talk('hazel', DAY, 'winter');
    expect(first?.lines[0]).toBe(personById('hazel')?.hello);
    expect(first?.offer?.id).toBe('first-chair');
    expect(game.accept('first-chair', DAY)).toEqual([{ kind: 'errand', title: 'First chair', detail: 'New errand, in your pack' }]);
    expect(game.accept('first-chair', DAY)).toEqual([]);
    // Coming back empty-handed gets a reminder, not a second greeting.
    const again = game.talk('hazel', DAY, 'winter');
    expect(again?.lines).toEqual([errandById('first-chair')?.nudge]);
    expect(again?.offer).toBeUndefined();
  });

  it('finishes an errand when what it asks has been done, and rewards it once', () => {
    const game = new Game(gameWorld, memory());
    game.talk('hazel', DAY, 'winter');
    game.accept('first-chair', DAY);
    game.rode('Adirondack Express', DAY);
    const done = game.talk('hazel', DAY, 'winter');
    expect(done?.lines).toContain(errandById('first-chair')?.thanks);
    expect(done?.events.map((e) => e.kind)).toEqual(['errand', 'gear']);
    expect(game.save.gear.owned).toContain('jacket-patrol');
    expect(game.summary().errands).toBe(1);
    // And she moves on to the next thing.
    expect(game.talk('hazel', DAY, 'winter')?.offer?.id).toBe('stamp-collector');
  });

  it('makes small talk when there is nothing else to say, different each time', () => {
    const game = new Game(gameWorld, memory());
    // Otto asks nothing until his coffee has arrived.
    expect(game.talk('otto', DAY, 'winter')?.lines).toEqual([personById('otto')?.hello]);
    const one = game.talk('otto', DAY, 'winter');
    const two = game.talk('otto', DAY, 'winter');
    expect(one?.offer).toBeUndefined();
    expect(one?.lines).toHaveLength(1);
    expect(one?.lines[0]).not.toBe(two?.lines[0]);
    // In winter he starts with something about winter.
    expect(personById('otto')?.seasonal?.winter).toContain(one?.lines[0]);
  });

  it('hands a delivery over where it is taken on, and finishes it with the person it is for', () => {
    const game = new Game(gameWorld, memory());
    expect(game.talk('june', DAY, 'winter')?.offer?.id).toBe('ottos-coffee');
    expect(game.accept('ottos-coffee', DAY).map((e) => e.kind)).toEqual(['errand', 'item']);
    expect(game.save.items).toEqual(['coffee']);
    const otto = game.talk('otto', DAY, 'winter');
    expect(otto?.lines).toContain(errandById('ottos-coffee')?.thanks);
    expect(game.save.items).toEqual([]);
    expect(game.save.gear.owned).toContain('hat-trapper');
    // Which opens Otto's own errand.
    expect(game.talk('otto', DAY, 'winter')?.offer?.id).toBe('every-lift');
  });

  it('lays lost property out only while its errand is in hand, and takes it once', () => {
    const game = new Game(gameWorld, memory());
    expect(game.lostItems()).toEqual([]);
    expect(game.talk('pip', DAY, 'winter')?.offer?.id).toBe('lost-mitten');
    game.accept('lost-mitten', DAY);
    expect(game.lostItems().map((i) => i.id)).toEqual(['mitten']);
    expect(game.takeItem('mitten')).toEqual([{ kind: 'item', title: 'A small yellow mitten', detail: 'Found! In your pack' }]);
    expect(game.takeItem('mitten')).toEqual([]);
    expect(game.lostItems()).toEqual([]);
    expect(game.talk('pip', DAY, 'winter')?.events.map((e) => e.kind)).toEqual(['errand']);
    expect(game.save.items).toEqual([]);
  });

  it('asks seasonal errands only in their season', () => {
    const game = new Game(gameWorld, memory());
    expect(game.talk('gus', DAY, 'winter')?.offer?.id).toBe('warm-up');
    const summer = new Game(gameWorld, memory());
    expect(summer.talk('gus', DAY, 'summer')?.offer?.id).toBe('blueberries');
    const pip = new Game(gameWorld, memory());
    expect(pip.talk('pip', DAY, 'summer')?.offer?.id).toBe('lost-kite');
  });

  it('gives the Snow Train pass for five stamps, and only then lets the train run', () => {
    const game = new Game(gameWorld, memory());
    expect(game.ride('summer')).toBe(false);
    expect(game.talk('bea', DAY, 'winter')?.train).toBe(false);
    game.accept('season-pass', DAY);
    for (const lift of ['Adirondack Express', 'Sunway', 'Bear Cub', 'North Quad', 'Village Chair']) game.rode(lift, DAY);
    expect(game.stamps()).toBe(5);
    const bea = game.talk('bea', DAY, 'winter');
    expect(bea?.events.map((e) => e.title)).toContain('Snow Train pass');
    expect(bea?.train).toBe(true);
    expect(game.ride('summer')).toBe(true);
    expect(game.save.away).toBe('summer');
    expect(game.ride(null)).toBe(true);
    expect(game.save.away).toBeNull();
  });

  it('lets the player wear what they own and nothing else', () => {
    const game = new Game(gameWorld, memory());
    expect(game.outfit()).toEqual({ jacket: 0xe2452f, hat: 0x2f6f8f, style: 'beanie' });
    expect(game.wear('hat-trapper')).toBe(false);
    game.save.gear.owned.push('hat-trapper');
    expect(game.wear('hat-trapper')).toBe(true);
    expect(game.outfit().style).toBe('trapper');
    expect(game.wear('nonsense')).toBe(false);
  });

  it('keeps errands, gear and the pass across a reload, and shrugs off a damaged save', () => {
    const store = memory();
    const game = new Game(gameWorld, store);
    game.talk('hazel', DAY, 'winter');
    game.accept('first-chair', DAY);
    game.rode('Adirondack Express', DAY);
    game.talk('hazel', DAY, 'winter');
    game.wear('jacket-patrol');
    game.persist();
    const again = new Game(gameWorld, store);
    expect(again.save.errands['first-chair']?.done).toBe(DAY);
    expect(again.outfit().jacket).toBe(0xc8281e);
    expect(again.talk('hazel', DAY, 'winter')?.lines[0]).not.toBe(personById('hazel')?.hello);
    const broken = new Game(gameWorld, memory('{"errands": 5, "gear": {"owned": [1, "hat-cap"], "hat": 7}, "items": "x", "pass": "yes", "away": "monsoon"}'));
    expect(broken.save.errands).toEqual({});
    expect([...broken.save.gear.owned].sort()).toEqual(['hat-blue', 'hat-cap', 'jacket-red']);
    expect(broken.outfit().style).toBe('beanie');
    expect(broken.save.pass).toBe(false);
    expect(broken.save.away).toBeNull();
  });

  it('knows who has business with the player', () => {
    const game = new Game(gameWorld, memory());
    expect(game.hasBusiness('hazel', 'winter')).toBe(true);
    game.accept('first-chair', DAY);
    expect(game.hasBusiness('hazel', 'winter')).toBe(false);
    game.rode('Adirondack Express', DAY);
    expect(game.hasBusiness('hazel', 'winter')).toBe(true);
  });
});
