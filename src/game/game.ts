import { DIFFICULTY_MARK, type Lift, type Place, type Trail } from '../world/trails';
import { daySeed, FIND_PATCH, findsInPatch, MINERALS, type Find, type Ground } from './minerals';
import {
  buildLandmarks,
  buildPeaks,
  buildTrailBook,
  CONDITIONS,
  reached,
  TrailIndex,
  type Spot,
  type TrailEntry,
} from './passport';
import { parseSave, serializeSave, type SaveData } from './save';

/** Something the player has just earned, to announce. */
export interface GameEvent {
  kind: 'trail' | 'lift' | 'peak' | 'landmark' | 'condition' | 'mineral';
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

/** How much of the book is filled. */
export interface BookSummary {
  trails: number;
  trailsTotal: number;
  lifts: number;
  liftsTotal: number;
  peaks: number;
  peaksTotal: number;
  landmarks: number;
  landmarksTotal: number;
  conditions: number;
  conditionsTotal: number;
  minerals: number;
  mineralsTotal: number;
  /** Every stone picked up, counting repeats. */
  specimens: number;
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
  readonly peaks: Spot[];
  readonly landmarks: Spot[];
  /** Every lift with a name, in alphabetical order. */
  readonly liftNames: string[];
  private readonly index: TrailIndex;
  private readonly patches = new Map<string, Find[]>();
  private patchDay = '';
  /** The finds last handed out, and the day and patch they were worked out for. */
  private near: readonly Find[] = [];
  private nearKey = '';
  private dirty = false;

  constructor(
    private readonly world: GameWorld,
    private readonly store: SaveStore,
  ) {
    this.save = parseSave(store.read());
    this.trails = buildTrailBook(world.trails);
    this.index = new TrailIndex(this.trails);
    this.peaks = buildPeaks(world.places, world.lifts);
    this.landmarks = buildLandmarks(world.places);
    this.liftNames = [...new Set(world.lifts.map((l) => l.name).filter((n): n is string => Boolean(n)))].sort();
  }

  /** The skier is travelling down the mountain at a position. */
  skiedAt(x: number, z: number, day: string): GameEvent[] {
    const names = this.index.visit(this.save.trails, x, z, day);
    this.dirty = true;
    return names.map((name) => {
      const entry = this.trails.find((t) => t.name === name);
      return { kind: 'trail' as const, title: `${DIFFICULTY_MARK[entry?.difficulty ?? 'easy']} ${name}`, detail: 'Trail stamped' };
    });
  }

  /** The player is standing or passing at a position: summits and landmarks. */
  reachedAt(x: number, z: number, day: string): GameEvent[] {
    const events: GameEvent[] = [];
    for (const peak of reached(this.peaks, this.save.peaks, x, z)) {
      this.save.peaks[peak.id] = day;
      events.push({ kind: 'peak', title: peak.name, detail: 'Summit patch' });
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
    this.dirty = true;
    this.persist();
  }

  /** How much of the book is filled. */
  summary(): BookSummary {
    const named = new Set(this.liftNames);
    return {
      trails: this.trails.filter((t) => this.save.trails[t.name]?.stamped).length,
      trailsTotal: this.trails.length,
      lifts: Object.keys(this.save.lifts).filter((n) => named.has(n)).length,
      liftsTotal: named.size,
      peaks: this.peaks.filter((p) => p.id in this.save.peaks).length,
      peaksTotal: this.peaks.length,
      landmarks: this.landmarks.filter((p) => p.id in this.save.landmarks).length,
      landmarksTotal: this.landmarks.length,
      conditions: CONDITIONS.filter((c) => c.id in this.save.conditions).length,
      conditionsTotal: CONDITIONS.length,
      minerals: MINERALS.filter((m) => this.save.minerals[m.id]).length,
      mineralsTotal: MINERALS.length,
      specimens: Object.values(this.save.minerals).reduce((n, m) => n + m.count, 0),
    };
  }
}
