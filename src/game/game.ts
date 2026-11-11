import { SEASON_NAME, type Season } from '../look/season';
import { DIFFICULTY_MARK, type Lift, type Path, type Place, type Trail } from '../world/trails';
import { daySeed, FIND_PATCH, findsInPatch, MINERALS, type Find, type Ground } from './minerals';
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
  type TrailEntry,
} from './passport';
import { parseSave, serializeSave, type SaveData } from './save';
import { GENTLE_SPEED, SHY_REACH, SIGHT_PATCH, sightingsInPatch, SPECIES, spotReach, watchSeed, type Country, type Sighting, type Watch } from './wildlife';

/** Something the player has just earned, to announce. */
export interface GameEvent {
  kind: 'trail' | 'path' | 'lift' | 'peak' | 'landmark' | 'condition' | 'season' | 'mineral' | 'sighting';
  title: string;
  detail: string;
  /** For a mineral, its colour. */
  colour?: number;
}

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
  /** Nonzero where the ground is a road, a lot or water, and no stone lies. */
  openAt?(x: number, z: number): number;
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
export class Game {
  save: SaveData;
  readonly trails: TrailEntry[];
  readonly paths: Route[];
  readonly peaks: Spot[];
  readonly landmarks: Spot[];
  /** Every lift with a name, in alphabetical order. */
  readonly liftNames: string[];
  private readonly index: TrailIndex;
  private readonly pathIndex: TrailIndex;
  private readonly patches = new Map<string, Find[]>();
  private patchDay = '';
  /** The finds last handed out, and the day and patch they were worked out for. */
  private near: readonly Find[] = [];
  private nearKey = '';
  private dirty = false;
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
    this.landmarks = buildLandmarks(world.places);
    this.liftNames = [...new Set(world.lifts.map((l) => l.name).filter((n): n is string => Boolean(n)))].sort();
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
        events.push({ kind: 'peak', title: peak.name, detail: `${SEASON_NAME[season]} summit patch` });
      } else {
        this.save.peaks[peak.id] = day;
        events.push({ kind: 'peak', title: peak.name, detail: 'Summit patch' });
      }
    }
    for (const mark of reached(this.landmarks, this.save.landmarks, x, z)) {
      this.save.landmarks[mark.id] = day;
      events.push({ kind: 'landmark', title: mark.name, detail: 'Landmark stamped' });
    }
    if (events.length > 0) this.dirty = true;
    return events;
  }

  /** The player has ridden a lift to the top. */
  rode(liftName: string | null, day: string): GameEvent[] {
    if (!liftName || liftName in this.save.lifts) return [];
    this.save.lifts[liftName] = day;
    this.dirty = true;
    return [{ kind: 'lift', title: liftName, detail: 'Lift pin' }];
  }

  /** The player is skiing in these conditions (ids from conditionsNow). */
  skiedIn(conditions: readonly string[], day: string): GameEvent[] {
    const events: GameEvent[] = [];
    for (const id of conditions) {
      const condition = CONDITIONS.find((c) => c.id === id);
      if (!condition || id in this.save.conditions) continue;
      this.save.conditions[id] = day;
      events.push({ kind: 'condition', title: condition.name, detail: 'Conditions stamp' });
    }
    if (events.length > 0) this.dirty = true;
    return events;
  }

  /**
   * Finds lying within a patch or so of a position that have not been picked up today. The same
   * list is handed back until the player moves to another patch or picks something up.
   */
  findsNear(x: number, z: number, day: string): readonly Find[] {
    if (day !== this.patchDay) {
      this.patches.clear();
      this.patchDay = day;
    }
    if (this.save.found.day !== day) {
      this.save.found = { day, spots: [] };
      this.dirty = true;
    }
    const col = Math.floor((x - this.world.minX) / FIND_PATCH);
    const row = Math.floor((z - this.world.minZ) / FIND_PATCH);
    const nearKey = `${day}:${col}:${row}`;
    if (nearKey === this.nearKey) return this.near;
    const taken = new Set(this.save.found.spots);
    const out: Find[] = [];
    for (let r = row - 1; r <= row + 1; r++) {
      for (let c = col - 1; c <= col + 1; c++) {
        if (c < 0 || r < 0) continue;
        const key = `${c}:${r}`;
        let finds = this.patches.get(key);
        if (!finds) {
          finds = findsInPatch(this.world, c, r, daySeed(day), this.world.minX, this.world.minZ).filter((f) => !this.inBuilding(f.x, f.z));
          this.patches.set(key, finds);
        }
        for (const f of finds) if (!taken.has(f.id)) out.push(f);
      }
    }
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
    return { kind: 'mineral', title: find.mineral.name, detail: `${find.size.toFixed(1)} cm · ${note}`, colour: find.mineral.colour };
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
    return { kind: 'sighting', title: sighting.species.name, detail: had ? `Seen ${entry.count} times` : 'New in the field guide' };
  }

  /** True inside a building's footprint, where nothing is to be seen. */
  private inWall(x: number, z: number): boolean {
    return this.world.places.some((p) => Math.hypot(p.x - x, p.z - z) < (p.id === 'base-lodge' ? BASE_LODGE_CLEAR : BUILDING_CLEAR));
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
    };
  }
}
