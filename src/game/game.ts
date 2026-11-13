import { SEASON_NAME, type Season } from '../look/season';
import { DIFFICULTY_MARK, type Lift, type Path, type Place, type Trail } from '../world/trails';
import { artSlug } from './artNames';
import { daySeed, FIND_PATCH, findsInPatch, isOut, mineralById, MINERALS, specimenSize, type Find, type Ground } from './minerals';
import { fullness, give as giveToMuseum, MUSEUM_GIFTS, RELICS, toGive, type Piece } from './museum';
import {
  buildLandmarks,
  buildPathBook,
  buildPeaks,
  buildTrailBook,
  CONDITIONS,
  reached,
  TrailIndex,
  type Route,
  type Spot,
  type TrailEntry, trailLeft } from './passport';
import { LAST_LETTER, letterWaiting, LETTERS, type Letter } from './letters';
import { OFFERING_KIND, offeringFrom, OFFERINGS } from './offerings';
import { bookFull, KEEPSAKE, PATCHES, patchesEarned, type Tally } from './patches';
import { DEFAULT_GEAR, ERRANDS, errandById, GEAR_SLOTS, gearById, personById, SLOT_NAME, TOWN_ROUND, type Errand, type Gear, type GearSlot, type Mood, type Need, type Person, type Whereabouts } from './people';
import { parseSave, serializeSave, type SaveData } from './save';
import { GENTLE_SPEED, SHY_REACH, SIGHT_PATCH, sightingsInPatch, SPECIES, spotReach, watchSeed, type Country, type Sighting, type Watch } from './wildlife';
import { feederGuest, nextChoice } from './cabin';
import { sawSight, SIGHTS, type Sight } from './sky';
import { tread } from './worn';
import { HINTS_A_DAY, PIP_WATCHERS, pipHiding, pipHint, wandererTurn, wandererWaits } from './wanderers';
import { addStone, BELL_HEARD, bellRemark, discover, KEYS, ringBell, secretById, skiedRun, type Found, type SecretKind } from './secrets';

/** What an announcement says under the name of a secret, the first time it is found. */
const SECRET_SAID: Record<SecretKind, string> = {
  register: 'A register. You signed it.',
  plaque: 'A plaque by the trail',
  working: 'Not on any map',
  room: 'The key fit',
  cairn: 'A cairn',
  bell: 'It carries all the way to town',
  den: 'At the end of the tracks',
  nest: 'In the reeds',
  shack: 'At the end of the buckets',
  ribbon: 'Pencilled onto your map',
  light: 'Still lit',
};
import { projectInHand, PROJECTS, projectState, type ProjectState } from './projects';

/** Something the player has just earned, to announce. */
export interface GameEvent {
  kind: 'trail' | 'path' | 'lift' | 'peak' | 'landmark' | 'condition' | 'season' | 'mineral' | 'sighting' | 'errand' | 'gear' | 'item' | 'patch' | 'hint' | 'secret' | 'museum';
  title: string;
  detail: string;
  /** For a mineral, its colour. */
  colour?: number;
  /** The picture of what was earned, where there is one: its set and name under public/art, as "patches/first-tracks". */
  art?: string;
}

/** What a person has to say, and what comes of it. */
export interface Talk {
  person: Person;
  /** What they say, in order. */
  lines: string[];
  /** An errand they are asking, to take or leave. */
  offer?: Errand;
  /** Stamps, gear and the like that the talk earned. */
  events: GameEvent[];
  /** True when this person can put the player on the Snow Train. */
  train: boolean;
  /** A letter they have handed over, to be read. */
  letter?: Letter;
  /** A tune they play on the spot, by its voice. */
  tune?: string;
}

/** Today's rumour: a rare stone said to be lying at a named spot. */
export interface Rumour {
  place: string;
  find: Find;
}

/** Minerals worth a rumour. */
const RUMOURED = ['labradorite', 'tourmaline', 'wollastonite', 'gem-garnet', 'pyrite', 'calcite'];

/** How close the player must come to a find to pick it up, in metres. */
export const COLLECT_REACH = 3;
const NONE: readonly { find: Find; event: GameEvent }[] = [];
/** Finds keep this far from the middle of a building, in metres, so none ends up inside a wall. */
const BUILDING_CLEAR = 28;
const BASE_LODGE_CLEAR = 46;
const NOTHING_SEEN: { seen: { sighting: Sighting; event: GameEvent }[]; bolted: Sighting[] } = { seen: [], bolted: [] };

/** How much of the book is filled. */
export interface BookSummary {
  trails: number;
  trailsTotal: number;
  paths: number;
  pathsTotal: number;
  lifts: number;
  liftsTotal: number;
  peaks: number;
  peaksTotal: number;
  /** Summit patches counting each season separately: four peaks in four seasons. */
  seasonPeaks: number;
  seasonPeaksTotal: number;
  seasons: number;
  landmarks: number;
  landmarksTotal: number;
  conditions: number;
  conditionsTotal: number;
  minerals: number;
  mineralsTotal: number;
  /** Every stone picked up, counting repeats. */
  specimens: number;
  /** Entries in the field guide that have been seen. */
  species: number;
  speciesTotal: number;
  errands: number;
  errandsTotal: number;
  patches: number;
  patchesTotal: number;
  letters: number;
  lettersTotal: number;
  /** Benches sat on. */
  benches: number;
  benchesTotal: number;
  /** Bakes and sandwiches tried, and library books read. */
  tasted: number;
  tastedTotal: number;
  read: number;
  readTotal: number;
}

/** Where the save is kept. */
export interface SaveStore {
  read(): string | null;
  write(text: string): void;
}

/** The mountain as the game rules see it. */
export interface GameWorld extends Ground {
  trails: readonly Trail[];
  lifts: readonly Lift[];
  places: readonly Place[];
  /** Named paths through the woods. */
  paths?: readonly Path[];
  /** Lookouts, quarries and ponds by name, some of which are landmarks. */
  spots?: readonly { id: string; x: number; z: number }[];
  /** Nonzero where the ground is a road, a lot or water, and no stone lies. */
  openAt?(x: number, z: number): number;
  /** The benches that can be sat on, by id, with what the Book calls each. */
  benches?: readonly { id: string; name: string }[];
  /** Where each town project stands, by its id: once built, being there earns its postcard. */
  projects?: readonly { id: string; x: number; z: number }[];
  /** Named spots, each with ground to stand on, where the day's rumoured stone may lie. */
  rumourSpots?: readonly { name: string; x: number; z: number }[];
  /** The world as wildlife sees it. Without it there is nothing to spot. */
  country?: Country;
  /** West and north edges, where the first patch of finds starts. */
  minX: number;
  minZ: number;
}

/**
 * The collecting game: the passport and the minerals, the rules for earning them, and the save.
 * No DOM or three.js here; the caller says where the player is and what they are doing, and gets
 * back whatever that earned.
 */
/** How many different guests, seen at the cabin's feeder, before a chickadee comes along with the player. */
export const GUESTS_FOR_BIRD = 4;

export class Game {
  save: SaveData;
  readonly trails: TrailEntry[];
  readonly paths: Route[];
  readonly peaks: Spot[];
  readonly landmarks: Spot[];
  /** The benches that can be sat on. */
  get benches(): readonly { id: string; name: string }[] {
    return this.world.benches ?? [];
  }
  /** Every lift with a name, in alphabetical order. */
  readonly liftNames: string[];
  /** What kind of lift each is, by name: a chair, a gondola, a carpet. */
  private readonly liftKinds = new Map<string, string>();
  private readonly index: TrailIndex;
  private readonly pathIndex: TrailIndex;
  private readonly patches = new Map<string, Find[]>();
  private patchDay = '';
  /** The season and the watch of the day: some stones keep to particular ones. Set by whoever knows the hour. */
  private nowSeason: Season = 'winter';
  private nowWatch: Watch = 'day';
  /** The finds last handed out, and the day and patch they were worked out for. */
  private near: readonly Find[] = [];
  private nearKey = '';
  private dirty = false;
  private rumourOf: { day: string; rumour: Rumour } | null = null;
  /** How many times each person has made small talk, so they say something different each time. */
  private readonly chatted = new Map<string, number>();
  private readonly sightPatches = new Map<string, Sighting[]>();
  private sightKey = '';
  private about: readonly Sighting[] = [];
  private aboutKey = '';

  constructor(
    private readonly world: GameWorld,
    private readonly store: SaveStore,
  ) {
    this.save = parseSave(store.read());
    this.trails = buildTrailBook(world.trails);
    this.index = new TrailIndex(this.trails);
    this.paths = buildPathBook(world.paths ?? [], world.trails);
    this.pathIndex = new TrailIndex(this.paths);
    this.peaks = buildPeaks(world.places, world.lifts);
    // The summits are ground of their own for stones.
    if (!world.peakDistance) this.world = { ...world, peakDistance: (x, z) => Math.min(...this.peaks.map((peak) => Math.hypot(peak.x - x, peak.z - z))) };
    this.landmarks = [
      ...buildLandmarks(world.places, world.spots ?? []),
      // What the town builds is worth a postcard too, once it is built.
      ...(world.projects ?? []).flatMap((at) => {
        const project = PROJECTS.find((p) => p.id === at.id);
        return project ? [{ id: project.id, name: project.name, x: at.x, z: at.z, reach: 26 }] : [];
      }),
    ];
    // Start out in the plain red jacket and blue beanie, with plain everything else, and nobody along.
    this.mend();
    this.liftNames = [...new Set(world.lifts.map((l) => l.name).filter((n): n is string => Boolean(n)))].sort();
    for (const l of world.lifts) if (l.name) this.liftKinds.set(l.name, l.kind);
  }

  /** See that the book owns what everybody starts with, and has on only what it owns: a save may be older than a thing to wear. */
  private mend(): void {
    for (const slot of [...GEAR_SLOTS].reverse()) {
      const first = DEFAULT_GEAR[slot];
      if (first && !this.save.gear.owned.includes(first)) this.save.gear.owned.unshift(first);
      const on = gearById(this.save.gear[slot]);
      if (!on || on.slot !== slot || !this.save.gear.owned.includes(on.id)) this.save.gear[slot] = first;
    }
  }

  /**
   * The player has come off a trail. If most of it is skied and it is not stamped, say what is
   * left of it, once a day for each trail: a run begun part of the way down never gets its
   * stamp, and nothing else would say why.
   */
  leftTrail(name: string, day: string): GameEvent[] {
    const left = trailLeft(this.save.trails[name]);
    if (!left || this.said(day, `left:${name}`)) return [];
    this.say(day, `left:${name}`);
    const rest = left.part === 'top' ? "The top's still to ski." : left.part === 'bottom' ? "The bottom's still to ski." : "There's a stretch in the middle still to ski.";
    return [{ kind: 'hint', title: name, detail: `${left.seen} of ${left.of} checkpoints. ${rest}` }];
  }

  /** The player is skiing, or riding, down the mountain at a position. */
  skiedAt(x: number, z: number, day: string): GameEvent[] {
    const before = this.index.marked;
    const names = this.index.visit(this.save.trails, x, z, day);
    if (this.index.marked !== before) this.dirty = true;
    return names.map((name) => {
      const entry = this.trails.find((t) => t.name === name);
      return { kind: 'trail' as const, title: `${DIFFICULTY_MARK[entry?.difficulty ?? 'easy']} ${name}`, detail: 'Trail stamped' };
    });
  }

  /** The player is travelling under their own steam at a position, however they like: paths count on foot, on skis and on wheels. */
  travelledAt(x: number, z: number, day: string): GameEvent[] {
    const before = this.pathIndex.marked;
    const names = this.pathIndex.visit(this.save.paths, x, z, day);
    if (this.pathIndex.marked !== before) this.dirty = true;
    return names.map((name) => ({ kind: 'path' as const, title: name, detail: 'Path stamped' }));
  }

  /** The game has opened in a season. The first visit to each is worth a stamp. */
  arrivedIn(season: Season, day: string): GameEvent[] {
    if (season in this.save.seasons) return [];
    this.save.seasons[season] = day;
    this.dirty = true;
    return [{ kind: 'season', title: SEASON_NAME[season], detail: Object.keys(this.save.seasons).length === 1 ? 'Your first season on the mountain' : 'A new season on the mountain' }];
  }

  /** The player is standing or passing at a position: summits and landmarks. Each summit is worth a patch in every season. */
  reachedAt(x: number, z: number, day: string, season: Season = 'winter'): GameEvent[] {
    const events: GameEvent[] = [];
    for (const peak of this.peaks) {
      const key = `${peak.id}:${season}`;
      if (key in this.save.seasonPeaks || Math.hypot(peak.x - x, peak.z - z) > peak.reach) continue;
      this.save.seasonPeaks[key] = day;
      if (peak.id in this.save.peaks) {
        events.push({ kind: 'peak', title: peak.name, detail: `${SEASON_NAME[season]} summit patch`, art: `peaks/${artSlug(peak.id)}` });
      } else {
        this.save.peaks[peak.id] = day;
        events.push({ kind: 'peak', title: peak.name, detail: 'Summit patch', art: `peaks/${artSlug(peak.id)}` });
      }
    }
    for (const mark of reached(this.landmarks, this.save.landmarks, x, z)) {
      // Nobody gets a postcard of something that is not there yet.
      if (!this.landmarkOpen(mark.id, day)) continue;
      this.save.landmarks[mark.id] = day;
      events.push({ kind: 'landmark', title: mark.name, detail: 'A new postcard', art: `places/${mark.id}` });
    }
    if (events.length > 0) this.dirty = true;
    return events;
  }

  /** What kind of lift one is, by its name: for the pin it earns. */
  liftKind(name: string): string {
    return this.liftKinds.get(name) ?? 'chair_lift';
  }

  /** The player has ridden a lift to the top. */
  rode(liftName: string | null, day: string): GameEvent[] {
    if (!liftName || liftName in this.save.lifts) return [];
    this.save.lifts[liftName] = day;
    this.dirty = true;
    return [{ kind: 'lift', title: liftName, detail: 'Lift pin', art: `pins/${artSlug(this.liftKind(liftName))}` }];
  }

  /** The player is skiing in these conditions (ids from conditionsNow). */
  skiedIn(conditions: readonly string[], day: string): GameEvent[] {
    const events: GameEvent[] = [];
    for (const id of conditions) {
      const condition = CONDITIONS.find((c) => c.id === id);
      if (!condition || id in this.save.conditions) continue;
      this.save.conditions[id] = day;
      events.push({ kind: 'condition', title: condition.name, detail: 'Conditions stamp', art: `conditions/${artSlug(id)}` });
    }
    if (events.length > 0) this.dirty = true;
    return events;
  }

  /** Say what season and watch of the day it is: the stones that keep to an hour or a season come and go with them. */
  setMoment(season: Season, watch: Watch): void {
    this.nowSeason = season;
    this.nowWatch = watch;
  }

  /**
   * Finds lying within a patch or so of a position that have not been picked up today. The same
   * list is handed back until the player moves to another patch or picks something up.
   */
  findsNear(x: number, z: number, day: string): readonly Find[] {
    const when = `${day}:${this.nowSeason}:${this.nowWatch}`;
    if (when !== this.patchDay) {
      this.patches.clear();
      this.patchDay = when;
      this.nearKey = '';
    }
    if (this.save.found.day !== day) {
      this.save.found = { day, spots: [] };
      this.dirty = true;
    }
    const col = Math.floor((x - this.world.minX) / FIND_PATCH);
    const row = Math.floor((z - this.world.minZ) / FIND_PATCH);
    const nearKey = `${when}:${col}:${row}`;
    if (nearKey === this.nearKey) return this.near;
    const taken = new Set(this.save.found.spots);
    const out: Find[] = [];
    for (let r = row - 1; r <= row + 1; r++) {
      for (let c = col - 1; c <= col + 1; c++) {
        if (c < 0 || r < 0) continue;
        const key = `${c}:${r}`;
        let finds = this.patches.get(key);
        if (!finds) {
          finds = findsInPatch(this.world, c, r, daySeed(day), this.world.minX, this.world.minZ, { day, season: this.nowSeason, watch: this.nowWatch }).filter((f) => !this.inBuilding(f.x, f.z));
          this.patches.set(key, finds);
        }
        for (const f of finds) if (!taken.has(f.id)) out.push(f);
      }
    }
    // The stone the inn is talking about today, if the player is anywhere near it.
    const rumour = this.rumour(day);
    if (rumour && !taken.has(rumour.find.id) && Math.hypot(rumour.find.x - x, rumour.find.z - z) < FIND_PATCH * 1.5) out.push(rumour.find);
    this.nearKey = nearKey;
    this.near = out;
    return out;
  }

  private inBuilding(x: number, z: number): boolean {
    // Roads, lots and water hold no stones either.
    if (this.world.openAt && this.world.openAt(x, z) !== 0) return true;
    return this.world.places.some((p) => Math.hypot(p.x - x, p.z - z) < (p.id === 'base-lodge' ? BASE_LODGE_CLEAR : BUILDING_CLEAR));
  }

  /** Pick up every find within reach of a position. */
  pickUp(x: number, z: number, day: string): readonly { find: Find; event: GameEvent }[] {
    let got: { find: Find; event: GameEvent }[] | null = null;
    for (const find of this.findsNear(x, z, day)) {
      if (Math.hypot(find.x - x, find.z - z) > COLLECT_REACH) continue;
      (got ??= []).push({ find, event: this.collect(find, day) });
    }
    return got ?? NONE;
  }

  /** The player has picked up a find. */
  collect(find: Find, day: string): GameEvent {
    if (this.save.found.day !== day) this.save.found = { day, spots: [] };
    this.save.found.spots.push(find.id);
    this.nearKey = '';
    const had = this.save.minerals[find.mineral.id];
    const record = had ?? { count: 0, best: 0, first: day };
    record.count++;
    const isBest = find.size > record.best;
    if (isBest) record.best = find.size;
    this.save.minerals[find.mineral.id] = record;
    this.dirty = true;
    const note = !had ? 'New mineral' : isBest ? 'Your largest yet' : `${record.count} found`;
    return { kind: 'mineral', title: find.mineral.name, detail: `${find.size.toFixed(1)} cm · ${note}`, colour: find.mineral.colour, art: `minerals/${find.mineral.id}` };
  }

  /**
   * What there is to see within a patch or so of a position, in this watch of this day, leaving
   * out what has already been seen or startled away. The same list is handed back until the
   * player moves to another patch or something is seen.
   */
  sightingsNear(x: number, z: number, day: string, season: Season, watch: Watch): readonly Sighting[] {
    const country = this.world.country;
    if (!country) return this.about;
    const when = `${day}:${season}:${watch}`;
    if (when !== this.sightKey) {
      this.sightPatches.clear();
      this.sightKey = when;
      this.aboutKey = '';
    }
    if (this.save.seen.watch !== when) {
      this.save.seen = { watch: when, spots: [] };
      this.dirty = true;
    }
    const col = Math.floor((x - this.world.minX) / SIGHT_PATCH);
    const row = Math.floor((z - this.world.minZ) / SIGHT_PATCH);
    const key = `${col}:${row}`;
    if (key === this.aboutKey) return this.about;
    const gone = new Set(this.save.seen.spots);
    const out: Sighting[] = [];
    for (let r = row - 1; r <= row + 1; r++) {
      for (let c = col - 1; c <= col + 1; c++) {
        if (c < 0 || r < 0) continue;
        const patch = `${c}:${r}`;
        let list = this.sightPatches.get(patch);
        if (!list) {
          list = sightingsInPatch(country, c, r, watchSeed(day, watch), season, watch, this.world.minX, this.world.minZ).filter((s) => !this.inWall(s.x, s.z));
          this.sightPatches.set(patch, list);
        }
        for (const s of list) if (!gone.has(s.id)) out.push(s);
      }
    }
    this.aboutKey = key;
    this.about = out;
    return out;
  }

  /**
   * The player is at a position, moving at a speed. Anything close enough is seen and goes in the
   * field guide; a shy creature come upon too fast bolts unseen.
   */
  lookAbout(x: number, z: number, speed: number, day: string, season: Season, watch: Watch): { seen: { sighting: Sighting; event: GameEvent }[]; bolted: Sighting[] } {
    let seen: { sighting: Sighting; event: GameEvent }[] | null = null;
    let bolted: Sighting[] | null = null;
    for (const sighting of this.sightingsNear(x, z, day, season, watch)) {
      const d = Math.hypot(sighting.x - x, sighting.z - z);
      if (sighting.species.shy && speed > GENTLE_SPEED && d <= SHY_REACH) (bolted ??= []).push(sighting);
      else if (d <= spotReach(sighting.species)) (seen ??= []).push({ sighting, event: this.record(sighting, day) });
    }
    if (seen || bolted) {
      for (const s of bolted ?? []) this.save.seen.spots.push(s.id);
      for (const s of seen ?? []) this.save.seen.spots.push(s.sighting.id);
      this.aboutKey = '';
      this.dirty = true;
    }
    return seen || bolted ? { seen: seen ?? [], bolted: bolted ?? [] } : NOTHING_SEEN;
  }

  private record(sighting: Sighting, day: string): GameEvent {
    const had = this.save.sightings[sighting.species.id];
    const entry = had ?? { count: 0, first: day };
    entry.count++;
    this.save.sightings[sighting.species.id] = entry;
    return { kind: 'sighting', title: sighting.species.name, detail: had ? `Seen ${entry.count} times` : 'New in the field guide', art: `species/${sighting.species.id}` };
  }

  /** True inside a building's footprint, where nothing is to be seen. */
  private inWall(x: number, z: number): boolean {
    return this.world.places.some((p) => Math.hypot(p.x - x, p.z - z) < (p.id === 'base-lodge' ? BASE_LODGE_CLEAR : BUILDING_CLEAR));
  }

  /** What the patches are judged on. */
  tally(): Tally {
    const trails = { easy: { done: 0, total: 0 }, intermediate: { done: 0, total: 0 }, advanced: { done: 0, total: 0 }, expert: { done: 0, total: 0 }, freeride: { done: 0, total: 0 }, glade: { done: 0, total: 0 } };
    for (const t of this.trails) {
      const kind = trails[t.glade ? 'glade' : t.difficulty];
      kind.total++;
      if (this.save.trails[t.name]?.stamped) kind.done++;
    }
    return { summary: this.summary(), save: this.save, trails, biggest: Math.max(0, ...Object.values(this.save.minerals).map((m) => m.best)) };
  }

  /** Award any patches that have newly been earned. Cheap enough to call once a second. */
  checkPatches(day: string): GameEvent[] {
    const events: GameEvent[] = [];
    const was = bookFull(this.save.patches);
    for (const id of patchesEarned(this.tally())) {
      if (id in this.save.patches) continue;
      this.save.patches[id] = day;
      const patch = PATCHES.find((p) => p.id === id);
      events.push({ kind: 'patch', title: patch?.name ?? id, detail: 'A patch for your passport', art: `patches/${artSlug(id)}` });
    }
    if (events.length > 0) {
      this.dirty = true;
      // The patch that fills the Book: say so, and say where to go. The Book is full without the
      // patch that waits on the sky; if that one is still to come, it is owned up to.
      if (!was && bookFull(this.save.patches)) {
        const whole = Object.keys(this.save.patches).length >= PATCHES.length;
        events.push({ kind: 'patch', title: 'Your Book is full', detail: whole ? 'Every patch is sewn on. Dot has something for you.' : 'The sky still owes you one patch. Dot has something for you.' });
      }
    }
    return events;
  }

  /** True the first time a hint is asked for, and never again: so each is given once. */
  hint(id: string): boolean {
    if (this.save.hints.includes(id)) return false;
    this.save.hints.push(id);
    this.dirty = true;
    return true;
  }

  /**
   * The day's rumour: one rare stone, larger than most, lying at one of the named spots. It is
   * worked out from the date, so the inn tells everyone the same tale all day. Null if the world
   * has no spots for it to lie at.
   */
  rumour(day: string): Rumour | null {
    const spots = this.world.rumourSpots;
    if (!spots || spots.length === 0) return null;
    if (this.rumourOf?.day === day) return this.rumourOf.rumour;
    const seed = daySeed(day) >>> 0;
    const spot = spots[seed % spots.length] as { name: string; x: number; z: number };
    // The talk is of a rare stone the museum had no example of this morning, while there is one; and of the old favourites after that.
    const lacking = MINERALS.filter((m) => m.rarity === 'rare' && (this.save.museum[`mineral:${m.id}`] ?? day) >= day && (!m.when?.shower || isOut(m, { day, season: this.nowSeason, watch: 'day' })));
    const mineral = lacking.length > 0 ? (lacking[(seed >>> 8) % lacking.length] as (typeof MINERALS)[number]) : (mineralById(RUMOURED[(seed >>> 8) % RUMOURED.length] as string) ?? (MINERALS[0] as (typeof MINERALS)[number]));
    // A little way off the spot itself, so it is found by looking, not tripped over.
    const a = ((seed >>> 16) % 360) * (Math.PI / 180);
    const find: Find = { id: `rumour:${day}`, x: spot.x + Math.cos(a) * 9, z: spot.z + Math.sin(a) * 9, mineral, size: specimenSize(mineral, 0.9 + ((seed >>> 4) % 10) / 100) };
    const rumour = { place: spot.name, find };
    this.rumourOf = { day, rumour };
    return rumour;
  }

  /** Pet the dog. Once a day counts toward being his friend. */
  pet(day: string): boolean {
    if (this.save.pets.includes(day)) return false;
    this.save.pets.push(day);
    this.dirty = true;
    return true;
  }

  /** Every stamp, pin and patch in the passport, of any kind. */
  stamps(): number {
    const s = this.summary();
    return s.trails + s.paths + s.lifts + s.landmarks + s.seasonPeaks + s.conditions + s.seasons;
  }

  /** Whether what an errand asks for has been done. */
  needMet(need: Need): boolean {
    const save = this.save;
    switch (need.kind) {
      case 'mineral':
        return (save.minerals[need.id]?.count ?? 0) >= need.count;
      case 'mineralSize':
        return (save.minerals[need.id]?.best ?? 0) >= need.cm;
      case 'minerals':
        return Object.keys(save.minerals).length >= need.count;
      case 'species':
        return need.id in save.sightings;
      case 'speciesCount':
        return Object.keys(save.sightings).length >= need.count;
      case 'trail':
        return Boolean(save.trails[need.name]?.stamped);
      case 'trails':
        return this.summary().trails >= need.count;
      case 'lifts':
        return this.summary().lifts >= need.count;
      case 'landmark':
        return need.id in save.landmarks;
      case 'peak':
        return need.id in save.peaks;
      case 'stamps':
        return this.stamps() >= need.count;
      case 'seasons':
        return Object.keys(save.seasons).length >= need.count;
      case 'item':
        return save.items.includes(need.id);
    }
  }

  /** How far along an errand that counts things is: so many of so many. Null for one that is simply done or not. */
  needProgress(need: Need): { have: number; of: number } | null {
    const save = this.save;
    const count = (have: number, of: number): { have: number; of: number } | null => (of > 1 ? { have: Math.min(have, of), of } : null);
    switch (need.kind) {
      case 'mineral':
        return count(save.minerals[need.id]?.count ?? 0, need.count);
      case 'minerals':
        return count(Object.keys(save.minerals).length, need.count);
      case 'speciesCount':
        return count(Object.keys(save.sightings).length, need.count);
      case 'trails':
        return count(this.summary().trails, need.count);
      case 'lifts':
        return count(this.summary().lifts, need.count);
      case 'stamps':
        return count(this.stamps(), need.count);
      case 'seasons':
        return count(Object.keys(save.seasons).length, need.count);
      default:
        return null;
    }
  }

  /** Errands taken and not yet done. */
  activeErrands(): Errand[] {
    return ERRANDS.filter((e) => this.save.errands[e.id] && !this.save.errands[e.id]?.done);
  }

  /** The next errand a person has to ask, if any: one not yet taken, whose turn has come, in its season. */
  private nextErrand(personId: string, season: Season): Errand | undefined {
    return ERRANDS.find(
      (e) => e.from === personId && !this.save.errands[e.id] && (!e.after || Boolean(this.save.errands[e.after]?.done)) && (!e.seasons || e.seasons.includes(season)),
    );
  }

  /** People who have something for the player: an errand to ask, one to finish, or a thing to hand over. */
  hasBusiness(personId: string, season: Season): boolean {
    for (const e of this.activeErrands()) {
      if ((e.to ?? e.from) === personId && this.needMet(e.need)) return true;
      if (e.fetch?.from === personId && e.need.kind === 'item' && !this.save.items.includes(e.need.id)) return true;
    }
    return this.nextErrand(personId, season) !== undefined;
  }

  /** True while Pip is out hiding somewhere on the mountain: met, wanting nothing of the player, and not found yet today. */
  pipHides(day: string, season: Season): boolean {
    const busy = this.activeErrands().some((e) => e.from === 'pip' || e.to === 'pip') || this.nextErrand('pip', season) !== undefined;
    return pipHiding(this.save, day, busy);
  }

  /**
   * Things that are said once a day (the inn's rumour, an errand asked and turned down, a word
   * about a hat) are kept in the book, so that closing the game and opening it again does not
   * have them said twice.
   */
  private said(day: string, id: string): boolean {
    return this.save.said.day === day && this.save.said.ids.includes(id);
  }

  private say(day: string, id: string): void {
    if (this.save.said.day !== day) this.save.said = { day, ids: [] };
    this.save.said.ids.push(id);
    this.dirty = true;
  }

  /** How many people have said, today, which way Pip went. */
  private pipHinters(day: string): number {
    return this.save.said.day === day ? this.save.said.ids.filter((id) => id.startsWith('pip:')).length : 0;
  }

  /** True if this is somebody who will say, just now, which way Pip went. */
  private hintsAt(personId: string, day: string, season: Season): boolean {
    if (!PIP_WATCHERS.includes(personId) || !this.pipHides(day, season)) return false;
    return this.pipHinters(day) < HINTS_A_DAY && !this.said(day, `pip:${personId}`);
  }

  /** True when one of the people who roam has something for the player. */
  roamerWaits(personId: string, day: string, season: Season, watch: Watch): boolean {
    return wandererWaits(this.save, personId, day, season, watch);
  }

  /**
   * Talk to someone. They greet, thank, hand over, remind or ask, as the case may be.
   * @param mood something about the moment they might remark on
   */
  talk(personId: string, day: string, season: Season, mood: Mood | null = null, watch: Watch = 'day'): Talk | null {
    const person = personById(personId);
    if (!person) return null;
    const save = this.save;
    const talk: Talk = { person, lines: [], events: [], train: false };
    // Pip, come upon where she is hiding, is found before anything else is said.
    const hiding = personId === 'pip' && this.pipHides(day, season);
    if (!(personId in save.met)) {
      save.met[personId] = day;
      talk.lines.push(person.hello);
    }
    // The people who are somewhere different every day: a painting, a gift, a tune, a find.
    const turn = wandererTurn(save, personId, day, season, watch, hiding);
    if (turn) {
      talk.lines.push(...turn.lines);
      if (turn.painting) talk.events.push({ kind: 'item', title: turn.painting.name, detail: 'A painting · kept in the Book', art: `paintings/${turn.painting.id}` });
      if (hiding) talk.events.push({ kind: 'secret', title: 'Found Pip', detail: save.hide.finds === 1 ? "She'll hide somewhere else tomorrow" : `${save.hide.finds} times now` });
      for (const gear of turn.gear) talk.events.push(...this.give(gear));
      if (turn.tune) talk.tune = turn.tune;
    }
    // Errands this person is waiting on.
    for (const e of this.activeErrands()) {
      if ((e.to ?? e.from) !== personId || !this.needMet(e.need)) continue;
      (save.errands[e.id] as { taken: string; done?: string }).done = day;
      if (e.need.kind === 'item') save.items = save.items.filter((i) => i !== (e.need as { id: string }).id);
      const gear = e.reward?.gear ? gearById(e.reward.gear) : undefined;
      talk.lines.push(gear && save.gear.owned.includes(gear.id) && e.thanksOwned ? e.thanksOwned : e.thanks);
      const relic = RELICS.find((r) => r.id === e.id);
      talk.events.push(relic ? { kind: 'museum', title: relic.name, detail: 'In its case at the museum', art: `relics/${e.id.replace(/^relic-/, '')}` } : { kind: 'errand', title: e.title, detail: 'Errand done' });
      // What the keeper hands over as the cases fill counts an old thing brought back, too.
      if (relic) talk.events.push(...this.museumGifts());
      if (gear && !save.gear.owned.includes(gear.id)) {
        talk.events.push(...this.give(gear.id));
      }
      if (e.reward?.pass && !save.pass) {
        save.pass = true;
        talk.events.push({ kind: 'gear', title: 'Snow Train pass', detail: 'Ride to any season from the depot', colour: 0x1f2a3a });
      }
    }
    // Things this person hands over for someone else.
    for (const e of this.activeErrands()) {
      if (e.fetch?.from !== personId || e.need.kind !== 'item' || save.items.includes(e.need.id)) continue;
      save.items.push(e.need.id);
      talk.lines.push(e.fetch.handover);
      talk.events.push({ kind: 'item', title: e.fetch.name, detail: 'In your pack' });
    }
    // The postmaster hands over the day's letter.
    if (personId === 'dot') {
      const letter = letterWaiting(save, save.letters, day);
      if (letter) {
        save.letters[letter.id] = day;
        talk.letter = letter;
        const last = letter.id === LAST_LETTER;
        talk.lines.push(
          last
            ? "Oh! This one's from everybody. We all signed it.\nI'm not supposed to say what's in it. It's good."
            : letter.from === 'dot'
              ? 'Here - the first piece of mail in your box!\nI wrote it myself, just to make sure the box works.'
              : "One for you today!\nI didn't read it. I did read the envelope.",
        );
        talk.events.push({ kind: 'item', title: last ? 'A letter from everybody' : `A letter from ${letter.from ? (personById(letter.from)?.name ?? 'someone') : 'somebody'}`, detail: 'Kept in your pack' });
        // The last letter comes with one more patch, for the cabin's board.
        if (last) talk.events.push({ kind: 'patch', title: KEEPSAKE.name, detail: 'One more patch, for the board by your door', art: `patches/${KEEPSAKE.id}` });
      }
    }
    // The innkeeper passes on the day's rumour, once.
    if (personId === 'marge' && !this.said(day, 'rumour') && !(talk.lines.length === 1 && talk.lines[0] === person.hello && this.nextErrand(personId, season))) {
      const rumour = this.rumour(day);
      if (rumour && !save.found.spots.includes(rumour.find.id)) {
        this.say(day, 'rumour');
        talk.lines.push(`Okay, so. I heard somebody saw ${rumour.find.mineral.name.toLowerCase()} lying out by ${rumour.place}.\nA nice one, supposedly. I'd go look myself, but - forty beds.`);
      }
    }
    const saidBy = (): number => talk.lines.length - (talk.lines[0] === person.hello ? 1 : 0);
    // What they have for the player today comes before any errand: the day's bake, sandwich
    // or book is handed over the first time they are spoken to, whatever else is in hand.
    // (On first meeting, the hello and whatever they want to ask come first.)
    if (talk.lines.length === 0 && !this.said(day, `treat:${personId}`)) {
      const treat = offeringFrom(personId, save.tried, day);
      if (treat) {
        this.say(day, `treat:${personId}`);
        talk.lines.push(treat.offering.hand);
        if (treat.fresh) {
          save.tried[treat.offering.id] = day;
          talk.events.push({ kind: 'item', title: treat.offering.name, detail: `${OFFERING_KIND[treat.offering.kind]} · noted in the Book`, art: `offerings/${artSlug(treat.offering.id)}` });
        }
      }
    }
    // Whoever wanted a thing built has something to say once it stands. Once.
    if (saidBy() === 0) {
      const theirs = PROJECTS.find((p) => p.who === personId && this.projectState(p.id, day) === 'built' && !save.hints.includes(`built:${p.id}`));
      if (theirs) {
        save.hints.push(`built:${theirs.id}`);
        talk.lines.push(theirs.said);
      }
    }
    // An empty box at the post office is said to be empty, once a day.
    if (personId === 'dot' && saidBy() === 0 && talk.lines.length === 0 && !this.said(day, 'empty-box') && !Object.values(save.letters).includes(day)) {
      this.say(day, 'empty-box');
      talk.lines.push(
        Object.keys(save.letters).length >= LETTERS.length
          ? "That's all of them. Every letter anybody's written you!\nI'll keep the box open. You never know."
          : "Nothing in your box today. It happens!\nPeople write when there's news. Go make some.",
      );
    }
    const said = saidBy();
    if (said === 0) {
      const waiting = this.activeErrands().find((e) => e.from === personId);
      const offer = this.nextErrand(personId, season);
      if (waiting) {
        talk.lines.push(waiting.nudge);
      } else if (offer && !this.said(day, `ask:${offer.id}`)) {
        // Each errand is asked once a day. Turned down, they talk of other things until tomorrow.
        this.say(day, `ask:${offer.id}`);
        talk.lines.push(offer.ask);
        talk.offer = offer;
      } else if (talk.lines.length === 0 && !this.said(day, `wear:${personId}`) && (person.wearing?.[save.gear.hat] ?? person.wearing?.[save.gear.jacket])) {
        // They have something to say about what the player has on. Once a day is enough.
        this.say(day, `wear:${personId}`);
        talk.lines.push((person.wearing?.[save.gear.hat] ?? person.wearing?.[save.gear.jacket]) as string);
      } else if (talk.lines.length === 0 && this.hintsAt(personId, day, season)) {
        // Pip is out hiding, and this is somebody who saw which way she went.
        talk.lines.push(pipHint(day, this.pipHinters(day)));
        this.say(day, `pip:${personId}`);
      } else if (talk.lines.length === 0 && (bellRemark(save, personId, day) ?? '') !== '') {
        // The day after the summit bell was rung, whoever heard it says so, once.
        talk.lines.push(BELL_HEARD[personId] as string);
      } else if (talk.lines.length === 0) {
        const n = this.chatted.get(personId) ?? 0;
        this.chatted.set(personId, n + 1);
        // The weather or the hour comes up first, if they have something to say about it.
        const remark = mood ? person.moods?.[mood] : undefined;
        const lines = [...(n === 0 && remark ? remark : []), ...(person.seasonal?.[season] ?? []), ...person.chat, ...(n > 0 && remark ? remark : [])];
        talk.lines.push(lines[n % lines.length] as string);
      }
    }
    // The town round: a call at every door in one day is counted.
    if (TOWN_ROUND.some((r) => r.who === personId)) {
      if (save.round.day !== day) save.round = { day, who: [] };
      if (!save.round.who.includes(personId)) save.round.who.push(personId);
      if (TOWN_ROUND.every((r) => save.round.who.includes(r.who)) && !save.rounds.includes(day)) {
        save.rounds.push(day);
        talk.events.push({ kind: 'landmark', title: 'The town round', detail: save.rounds.length === 1 ? 'Every door in North Creek, in one day' : `Every door in one day · ${save.rounds.length} times now` });
      }
    }
    talk.train = personId === 'bea' && save.pass;
    this.dirty = true;
    return talk;
  }

  /**
   * Come upon one of the mountain's secrets and do what is done there: read it, look inside,
   * try the door. Says what there is to read and what came of it.
   */
  secret(id: string, day: string, season?: Season): { found: Found; events: GameEvent[] } | null {
    const found = discover(this.save, id, day, season);
    if (!found) return null;
    const events: GameEvent[] = [];
    if (found.first && found.open) events.push({ kind: 'secret', title: found.secret.kind === 'plaque' ? `Why it's called ${found.secret.name}` : found.secret.name, detail: SECRET_SAID[found.secret.kind] });
    if (found.key) events.push({ kind: 'item', title: KEYS[found.key] ?? 'A key', detail: 'It must open something' });
    for (const gear of found.gear) events.push(...this.give(gear));
    if (found.open) this.dirty = true;
    return { found, events };
  }

  /** An unmarked run has been taken from its ribbon to the trail it comes out on. */
  ranRun(id: string, day: string): GameEvent[] {
    const ran = skiedRun(this.save, id, day);
    if (!ran) return [];
    this.dirty = true;
    return [{ kind: 'secret', title: secretById(id)?.name ?? 'An unmarked run', detail: ran.done >= ran.of ? "Top to bottom · that's all of them" : 'Top to bottom, and on no map but yours' }, ...ran.gear.flatMap((g) => this.give(g))];
  }

  /**
   * Something in the sky has been seen, under the real sky: a sea of cloud from above it,
   * shooting stars, the northern lights. Kept the first time.
   * @param meteors how many shooting stars have just been watched
   */
  saw(id: Sight['id'], day: string, meteors = 0): GameEvent[] {
    const had = this.save.meteors;
    this.save.meteors += meteors;
    const seen = sawSight(this.save, id, day);
    if (!seen.first && seen.gear.length === 0 && this.save.meteors === had) return [];
    this.dirty = true;
    const sight = SIGHTS.find((s) => s.id === id);
    return [...(seen.first && sight ? [{ kind: 'secret', title: sight.name, detail: sight.note } satisfies GameEvent] : []), ...seen.gear.flatMap((g) => this.give(g))];
  }

  /** The player has walked into a square of open ground. True if it has just become worn enough to show. */
  trod(key: string): { shows: boolean; events: GameEvent[] } {
    const stepped = tread(this.save, key);
    this.dirty = true;
    return { shows: stepped.shows, events: stepped.gear.flatMap((g) => [{ kind: 'secret', title: 'A path of your own', detail: "Worn by walking it. It's on your map now." } satisfies GameEvent, ...this.give(g)]) };
  }

  /** Put a stone on a cairn: one a day, to each. */
  cairn(id: string, day: string): GameEvent[] {
    const added = addStone(this.save, id, day);
    if (!added) return [];
    this.dirty = true;
    return [{ kind: 'secret', title: added.stones === 1 ? 'You start a cairn' : 'A stone on the cairn', detail: added.stones === 1 ? 'One stone. Add one each day you come up.' : `${added.stones} of yours on it now` }, ...added.gear.flatMap((g) => this.give(g))];
  }

  /** Ring the summit bell. True the first time in a day: the town will have heard it. */
  ring(day: string): boolean {
    this.dirty = true;
    return ringBell(this.save, day);
  }

  /** How many stones the player has put on a cairn. */
  stones(id: string): number {
    return this.save.cairns[id]?.stones ?? 0;
  }

  /** Something has come to the player, rather than the other way about: a bird to a bench. It goes in the guide. */
  visitedBy(speciesId: string, day: string): GameEvent[] {
    const species = SPECIES.find((s) => s.id === speciesId);
    if (!species) return [];
    this.dirty = true;
    return [this.record({ id: `visitor:${speciesId}`, x: 0, z: 0, species, roll: 0 }, day)];
  }

  /** Sit on a bench. The first time on each is kept in the book. */
  sat(benchId: string, day: string): GameEvent[] {
    const bench = this.world.benches?.find((b) => b.id === benchId);
    if (!bench || benchId in this.save.benches) return [];
    this.save.benches[benchId] = day;
    this.dirty = true;
    const count = Object.keys(this.save.benches).length;
    return [{ kind: 'landmark', title: 'A good sit', detail: `${bench.name} · bench ${count} of ${this.world.benches?.length ?? count}` }];
  }

  /** Take on an errand that was offered. */
  accept(errandId: string, day: string): GameEvent[] {
    const e = errandById(errandId);
    if (!e || this.save.errands[errandId]) return [];
    this.save.errands[errandId] = { taken: day };
    this.dirty = true;
    const events: GameEvent[] = [{ kind: 'errand', title: e.title, detail: 'New errand · in the Book, under Pack' }];
    // A delivery taken on from the person who has the goods is handed over on the spot.
    if (e.fetch && e.fetch.from === e.from && e.need.kind === 'item' && !this.save.items.includes(e.need.id)) {
      this.save.items.push(e.need.id);
      events.push({ kind: 'item', title: e.fetch.name, detail: 'In your pack' });
    }
    return events;
  }

  /** Lost property lying on the mountain for errands in hand: what it is and where. */
  lostItems(): { id: string; name: string; at: Whereabouts }[] {
    const out: { id: string; name: string; at: Whereabouts }[] = [];
    for (const e of this.activeErrands()) {
      if (e.lost && e.need.kind === 'item' && !this.save.items.includes(e.need.id)) out.push({ id: e.need.id, name: e.lost.name, at: e.lost.at });
    }
    return out;
  }

  /** The player has picked up a piece of lost property. */
  takeItem(id: string): GameEvent[] {
    const lost = this.lostItems().find((i) => i.id === id);
    if (!lost) return [];
    this.save.items.push(id);
    this.dirty = true;
    // An old thing the museum is waiting for has a picture of its own.
    const relic = RELICS.find((r) => r.id === id);
    return [{ kind: 'item', title: lost.name, detail: relic ? 'Found! Silas will want to see this' : 'Found! In your pack', ...(relic ? { art: `relics/${id.replace(/^relic-/, '')}` } : {}) }];
  }

  /** Put on something that is owned, or take up with a pet. A pet that is already along is sent home. */
  wear(gearId: string): boolean {
    const gear = gearById(gearId);
    if (!gear || !this.save.gear.owned.includes(gearId)) return false;
    this.save.gear[gear.slot] = gear.slot === 'pet' && this.save.gear.pet === gearId ? '' : gearId;
    this.dirty = true;
    return true;
  }

  /** Come by something to wear, carry or bring along. Says so, the first time. */
  give(gearId: string): GameEvent[] {
    const gear = gearById(gearId);
    if (!gear || this.save.gear.owned.includes(gearId)) return [];
    this.save.gear.owned.push(gearId);
    this.dirty = true;
    return [{ kind: 'gear', title: gear.name, detail: `${SLOT_NAME[gear.slot].found} · in the Book, under Pack`, colour: gear.colour, art: `gear/${artSlug(gear.id)}` }];
  }

  /** What the keeper hands over, for as many pieces as the museum now has. */
  private museumGifts(): GameEvent[] {
    const count = fullness(this.save).given;
    return MUSEUM_GIFTS.filter((gift) => count >= gift.at).flatMap((gift) => this.give(gift.gear));
  }

  /** What the player has that the museum has not: for the sheet, and for anyone who wants to say so. */
  museumWaiting(): Piece[] {
    return toGive(this.save);
  }

  /**
   * Show the keeper everything new. Each thing goes into its case, and he may have something to
   * give back. Nothing leaves the Book.
   */
  museumGive(day: string): { pieces: Piece[]; events: GameEvent[] } {
    const pieces = giveToMuseum(this.save, day);
    if (pieces.length === 0) return { pieces, events: [] };
    this.dirty = true;
    const first = pieces[0] as Piece;
    const events: GameEvent[] = [{ kind: 'museum', title: pieces.length === 1 ? first.name : `${pieces.length} pieces for the museum`, detail: pieces.length === 1 ? 'In its case at the museum' : `${first.name} and ${pieces.length - 1} more, in their cases`, art: first.art }];
    events.push(...this.museumGifts());
    return { pieces, events };
  }

  /** What is on in a slot, or what the player started with. */
  private worn(slot: GearSlot): Gear | undefined {
    return gearById(this.save.gear[slot]) ?? gearById(DEFAULT_GEAR[slot]);
  }

  /** What the player is wearing and carrying, as the figure needs it. */
  outfit(): { jacket: number; hat: number; style: string; goggles: number; skis: number; skiTips: number; pack: number; packStyle: string } {
    const skis = this.worn('skis');
    const pack = this.worn('pack');
    return {
      jacket: this.worn('jacket')?.colour ?? 0xe2452f,
      hat: this.worn('hat')?.colour ?? 0x2f6f8f,
      style: this.worn('hat')?.style ?? 'beanie',
      goggles: this.worn('goggles')?.colour ?? 0x1f242e,
      skis: skis?.colour ?? 0xd9a441,
      skiTips: skis?.colour2 ?? skis?.colour ?? 0xd9a441,
      pack: pack?.colour ?? 0x6b4a33,
      packStyle: pack?.style ?? 'box',
    };
  }

  /** The mark the player's skis leave (0 for the season's own), the voice their tunes are in, and who is along. */
  flourish(): { track: number; tune: string; pet: string } {
    return { track: this.worn('trail')?.colour ?? 0, tune: this.worn('tune')?.style ?? 'bells', pet: gearById(this.save.gear.pet)?.style ?? '' };
  }

  /** Ride the Snow Train to a season, or home (null). Needs the pass. */
  ride(season: Season | null): boolean {
    if (!this.save.pass) return false;
    this.save.away = season;
    this.dirty = true;
    this.persist();
    return true;
  }

  /** Where a town project stands today: not yet proposed, wanting its spot staked out, being built, or built. */
  projectState(id: string, day: string): ProjectState {
    return projectState(id, this.save.projects, day);
  }

  /** The project the town has in hand today, if any. */
  projectInHand(day: string): ReturnType<typeof projectInHand> {
    return projectInHand(this.save.projects, day);
  }

  /** The player has staked out the spot for a project that wanted one: the crew builds it overnight. */
  stakeOut(id: string, day: string): GameEvent[] {
    if (this.projectState(id, day) !== 'proposed') return [];
    this.save.projects[id] = day;
    this.dirty = true;
    this.persist();
    const project = PROJECTS.find((p) => p.id === id);
    return [{ kind: 'hint', title: 'Staked out', detail: `${project?.name ?? 'It'} goes up overnight.` }];
  }

  /** Whether a landmark is there to be visited: all are, but what the town has not yet built. */
  landmarkOpen(id: string, day: string): boolean {
    return !PROJECTS.some((p) => p.id === id) || this.projectState(id, day) === 'built';
  }

  /** The minerals the player has found, by id: what could go on the cabin's shelf. */
  shelfChoices(): string[] {
    return MINERALS.filter((m) => m.id in this.save.minerals).map((m) => m.id);
  }

  /** The patches the player has earned, by id: what could go on the cabin's board. */
  wallChoices(): string[] {
    // What came with the last letter hangs with the rest.
    return [...PATCHES.filter((p) => p.id in this.save.patches).map((p) => p.id), ...(LAST_LETTER in this.save.letters ? [KEEPSAKE.id] : [])];
  }

  /** A place on the cabin's shelf (or its board) has been tapped: it takes the next thing the player has, or goes bare. */
  arrange(where: 'shelf' | 'wall', slot: number): void {
    const placed = this.save.cabin[where];
    if (slot < 0 || slot >= placed.length) return;
    placed[slot] = nextChoice(where === 'shelf' ? this.shelfChoices() : this.wallChoices(), placed, slot);
    this.dirty = true;
    this.persist();
  }

  /**
   * Set one thing out in a place, or leave the place bare with ''. Something set out elsewhere
   * is moved here: a stone is in one place at a time. Anything not the player's to set out is refused.
   */
  place(where: 'shelf' | 'wall', slot: number, id: string): void {
    const placed = this.save.cabin[where];
    if (slot < 0 || slot >= placed.length) return;
    if (id !== '' && !(where === 'shelf' ? this.shelfChoices() : this.wallChoices()).includes(id)) return;
    if (id !== '') placed.forEach((other, i) => other === id && (placed[i] = ''));
    placed[slot] = id;
    this.dirty = true;
    this.persist();
  }

  /** Fill the cabin's feeder. False if it is full already. */
  fillFeeder(day: string): boolean {
    if (this.save.cabin.feeder !== '') return false;
    this.save.cabin.feeder = day;
    this.dirty = true;
    this.persist();
    return true;
  }

  /** Who is at the cabin's feeder now, by species id, if anyone. */
  feederGuest(day: string, season: Season, watch: Watch): string | null {
    return feederGuest(this.save.cabin, day, season, watch);
  }

  /** The player has come home to find somebody at the feeder: they go in the guide, and the feeder is empty again. */
  metGuest(day: string, season: Season, watch: Watch): GameEvent[] {
    const guest = this.feederGuest(day, season, watch);
    if (!guest) return [];
    this.save.cabin.feeder = '';
    const events = this.visitedBy(guest, day);
    // Four different guests seen at the feeder, and one of the chickadees has decided to come along.
    if (!this.save.guests.includes(guest)) this.save.guests.push(guest);
    if (this.save.guests.length >= GUESTS_FOR_BIRD && !this.save.gear.owned.includes('pet-chickadee')) events.push(...this.give('pet-chickadee'));
    this.persist();
    return events;
  }

  /** True once a day, the first time it is asked: the flyer is due. */
  flyerDue(day: string): boolean {
    if (this.save.flyer === day) return false;
    this.save.flyer = day;
    this.dirty = true;
    this.persist();
    return true;
  }

  /**
   * The leads on today's flyer, by id. They are chosen the first time they are asked for on a
   * day and kept, so that the flyer reads the same in the evening as it did in the morning.
   * @param choose picks from what is open now
   */
  leadsFor(day: string, choose: () => string[]): string[] {
    if (this.save.leads.day !== day) {
      this.save.leads = { day, ids: choose() };
      this.dirty = true;
      this.persist();
    }
    return this.save.leads.ids;
  }

  /** True if the stone the inn is talking about today has been picked up. */
  rumourFound(day: string): boolean {
    return this.save.found.day === day && this.save.found.spots.includes(`rumour:${day}`);
  }

  /** Plant the player's flag somewhere, or take it up (null). It is only a mark to steer by: it earns nothing. */
  plant(flag: SaveData['flag']): void {
    this.save.flag = flag;
    this.dirty = true;
    this.persist();
  }

  /** How close to the flag counts as having reached it, in metres. */
  static readonly FLAG_REACH = 14;

  /** True, once, when the player comes to their flag: the flag is taken up. */
  reachedFlag(x: number, z: number): boolean {
    const flag = this.save.flag;
    if (!flag || Math.hypot(flag.x - x, flag.z - z) > Game.FLAG_REACH) return false;
    this.plant(null);
    return true;
  }

  /** Write the save if anything has changed since the last time. */
  persist(): void {
    if (!this.dirty) return;
    this.dirty = false;
    this.store.write(serializeSave(this.save));
  }

  /** Replace the save, as when restoring from a code. */
  restore(save: SaveData): void {
    this.save = save;
    this.mend();
    this.nearKey = '';
    this.aboutKey = '';
    this.dirty = true;
    this.persist();
  }

  /** How much of the book is filled. */
  summary(): BookSummary {
    const named = new Set(this.liftNames);
    return {
      trails: this.trails.filter((t) => this.save.trails[t.name]?.stamped).length,
      trailsTotal: this.trails.length,
      paths: this.paths.filter((t) => this.save.paths[t.name]?.stamped).length,
      pathsTotal: this.paths.length,
      lifts: Object.keys(this.save.lifts).filter((n) => named.has(n)).length,
      liftsTotal: named.size,
      peaks: this.peaks.filter((p) => p.id in this.save.peaks).length,
      peaksTotal: this.peaks.length,
      seasonPeaks: this.peaks.reduce((n, p) => n + (['winter', 'spring', 'summer', 'fall'] as const).filter((s) => `${p.id}:${s}` in this.save.seasonPeaks).length, 0),
      seasonPeaksTotal: this.peaks.length * 4,
      seasons: (['winter', 'spring', 'summer', 'fall'] as const).filter((s) => s in this.save.seasons).length,
      landmarks: this.landmarks.filter((p) => p.id in this.save.landmarks).length,
      landmarksTotal: this.landmarks.length,
      conditions: CONDITIONS.filter((c) => c.id in this.save.conditions).length,
      conditionsTotal: CONDITIONS.length,
      minerals: MINERALS.filter((m) => this.save.minerals[m.id]).length,
      mineralsTotal: MINERALS.length,
      specimens: Object.values(this.save.minerals).reduce((n, m) => n + m.count, 0),
      species: SPECIES.filter((sp) => this.save.sightings[sp.id]).length,
      speciesTotal: SPECIES.length,
      errands: ERRANDS.filter((e) => this.save.errands[e.id]?.done).length,
      errandsTotal: ERRANDS.length,
      patches: PATCHES.filter((p) => p.id in this.save.patches).length,
      patchesTotal: PATCHES.length,
      letters: LETTERS.filter((l) => l.id in this.save.letters).length,
      lettersTotal: LETTERS.length,
      benches: (this.world.benches ?? []).filter((b) => b.id in this.save.benches).length,
      benchesTotal: this.world.benches?.length ?? 0,
      tasted: OFFERINGS.filter((o) => o.kind !== 'book' && o.id in this.save.tried).length,
      tastedTotal: OFFERINGS.filter((o) => o.kind !== 'book').length,
      read: OFFERINGS.filter((o) => o.kind === 'book' && o.id in this.save.tried).length,
      readTotal: OFFERINGS.filter((o) => o.kind === 'book').length,
    };
  }
}
