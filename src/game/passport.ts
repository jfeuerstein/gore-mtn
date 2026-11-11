import type { Difficulty, Lift, Place, Trail } from '../world/trails';
import type { TrailProgress } from './save';

/**
 * The trail passport: what there is to earn on the mountain and the rules for earning it.
 * No DOM or three.js here.
 *
 * - A trail is stamped once nearly all of it has been skied. It need not be in one run: progress
 *   down each trail is kept, so a trail left halfway can be finished another day.
 * - A lift is pinned by riding it to the top.
 * - A summit is patched by standing on it, a landmark stamped by visiting it.
 * - A condition is stamped by skiing in it: first light, a powder day, after dark.
 */

/** Distance between checkpoints down a trail, in metres. */
const CHECKPOINT_SPACING = 40;
/** Share of a trail's checkpoints that must be skied past to earn its stamp. */
export const STAMP_SHARE = 0.9;
/** Checkpoints are looked up on a grid this size, in metres. */
const CELL = 96;

export interface TrailEntry {
  name: string;
  difficulty: Difficulty;
  glade: boolean;
  /** Points down the trail, flat x, z pairs, with how far either side counts as skiing it. */
  checkpoints: number[];
  reach: number;
  /** Length down the centre line, in metres. */
  length: number;
}

/**
 * Every named trail as one passport entry. The map data splits some trails into several pieces
 * and marks some open slopes as outlines; pieces sharing a name are joined, and outlines skipped
 * unless a trail has nothing else.
 */
export function buildTrailBook(trails: readonly Trail[]): TrailEntry[] {
  const byName = new Map<string, Trail[]>();
  for (const t of trails) {
    if (!t.name) continue;
    const list = byName.get(t.name);
    if (list) list.push(t);
    else byName.set(t.name, [t]);
  }
  const book: TrailEntry[] = [];
  for (const [name, pieces] of byName) {
    const lines = pieces.filter((p) => !p.area);
    const use = lines.length > 0 ? lines : pieces;
    const checkpoints: number[] = [];
    let length = 0;
    for (const piece of use) {
      const pts = piece.pts;
      let carried = CHECKPOINT_SPACING / 2;
      for (let i = 0; i + 3 < pts.length; i += 2) {
        const ax = pts[i] as number;
        const az = pts[i + 1] as number;
        const bx = pts[i + 2] as number;
        const bz = pts[i + 3] as number;
        const seg = Math.hypot(bx - ax, bz - az);
        length += seg;
        // Walk down the piece dropping a checkpoint every CHECKPOINT_SPACING metres.
        while (carried <= seg) {
          checkpoints.push(ax + ((bx - ax) * carried) / seg, az + ((bz - az) * carried) / seg);
          carried += CHECKPOINT_SPACING;
        }
        carried -= seg;
      }
      // A piece too short to hold a checkpoint still counts, at its middle.
      if (checkpoints.length === 0 && pts.length >= 4) {
        checkpoints.push(((pts[0] as number) + (pts.at(-2) as number)) / 2, ((pts[1] as number) + (pts.at(-1) as number)) / 2);
      }
    }
    if (checkpoints.length === 0) continue;
    const widest = Math.max(...use.map((p) => p.width));
    const first = use[0] as Trail;
    book.push({
      name,
      difficulty: first.difficulty,
      glade: use.every((p) => p.glade),
      checkpoints,
      // Anywhere on the groomed width counts, with a margin; glades have no width of their own.
      reach: Math.max(widest / 2 + 10, 22),
      length,
    });
  }
  return book.sort((a, b) => a.name.localeCompare(b.name));
}

/** Looks up which trail checkpoints are near a position. */
export class TrailIndex {
  private readonly cells = new Map<number, { entry: number; checkpoint: number }[]>();

  constructor(readonly book: readonly TrailEntry[]) {
    book.forEach((entry, e) => {
      for (let c = 0; c < entry.checkpoints.length / 2; c++) {
        const key = this.key(entry.checkpoints[c * 2] as number, entry.checkpoints[c * 2 + 1] as number);
        const cell = this.cells.get(key);
        if (cell) cell.push({ entry: e, checkpoint: c });
        else this.cells.set(key, [{ entry: e, checkpoint: c }]);
      }
    });
  }

  private key(x: number, z: number): number {
    return Math.floor(x / CELL) * 100003 + Math.floor(z / CELL);
  }

  /**
   * Record a skier at a position. Marks every checkpoint within reach, and returns the names of
   * trails that this completes.
   */
  visit(progress: Record<string, TrailProgress>, x: number, z: number, day: string): string[] {
    const stamped: string[] = [];
    for (let dx = -1; dx <= 1; dx++) {
      for (let dz = -1; dz <= 1; dz++) {
        const cell = this.cells.get(this.key(x + dx * CELL, z + dz * CELL));
        if (!cell) continue;
        for (const { entry, checkpoint } of cell) {
          const trail = this.book[entry] as TrailEntry;
          const cx = trail.checkpoints[checkpoint * 2] as number;
          const cz = trail.checkpoints[checkpoint * 2 + 1] as number;
          if (Math.hypot(cx - x, cz - z) > trail.reach) continue;
          const count = trail.checkpoints.length / 2;
          const p = (progress[trail.name] ??= { seen: '0'.repeat(count) });
          // A save from an older map may have a different number of checkpoints; start it afresh.
          if (p.seen.length !== count) p.seen = '0'.repeat(count);
          if (p.seen[checkpoint] === '1') continue;
          p.seen = `${p.seen.slice(0, checkpoint)}1${p.seen.slice(checkpoint + 1)}`;
          if (!p.stamped && trailShare(p) >= STAMP_SHARE) {
            p.stamped = day;
            stamped.push(trail.name);
          }
        }
      }
    }
    return stamped;
  }
}

/** How much of a trail has been skied, 0..1. */
export function trailShare(p: TrailProgress | undefined): number {
  if (!p || p.seen.length === 0) return 0;
  let n = 0;
  for (const ch of p.seen) if (ch === '1') n++;
  return n / p.seen.length;
}

/** Somewhere that earns a patch or stamp by being reached. */
export interface Spot {
  id: string;
  name: string;
  x: number;
  z: number;
  /** How close counts, in metres. */
  reach: number;
}

/**
 * Gore's four peaks. The summit comes from the map; the other three are where their lifts top
 * out, which is where a skier stands on them.
 */
export function buildPeaks(places: readonly Place[], lifts: readonly Lift[]): Spot[] {
  const peaks: Spot[] = [];
  const summit = places.find((p) => p.id === 'summit');
  // The top of Gore is broad, and its highest lift stops a little short of the fire tower. The
  // patch is for being on top of the mountain; the tower itself is a landmark of its own.
  if (summit) peaks.push({ id: 'gore', name: 'Gore Mountain', x: summit.x, z: summit.z, reach: 180 });
  for (const [id, name, lift] of [
    ['bear', 'Bear Mountain', 'Northwoods Gondola'],
    ['burnt-ridge', 'Burnt Ridge', 'Burnt Ridge Quad'],
    ['little-gore', 'Little Gore', 'Hudson Chair'],
  ] as const) {
    const l = lifts.find((q) => q.name === lift);
    if (l) peaks.push({ id, name, x: l.pts.at(-2) as number, z: l.pts.at(-1) as number, reach: 90 });
  }
  return peaks;
}

const LANDMARK_NAMES: Record<string, string> = {
  summit: 'Fire Tower',
  'saddle-lodge': 'Saddle Lodge',
  'base-lodge': 'Base Lodge',
  'ski-bowl-lodge': 'Ski Bowl',
  depot: 'North Creek Depot',
};

/** Places worth a stamp for visiting. */
export function buildLandmarks(places: readonly Place[]): Spot[] {
  return places
    .filter((p) => p.id in LANDMARK_NAMES)
    // The Base Lodge is a big building with a wide apron of snow; standing in front of it counts.
    .map((p) => ({ id: p.id === 'summit' ? 'fire-tower' : p.id, name: LANDMARK_NAMES[p.id] as string, x: p.x, z: p.z, reach: p.id === 'base-lodge' ? 120 : 70 }));
}

/** The spots within reach of a position that have not been earned yet. */
export function reached(spots: readonly Spot[], earned: Record<string, string>, x: number, z: number): Spot[] {
  return spots.filter((s) => !(s.id in earned) && Math.hypot(s.x - x, s.z - z) <= s.reach);
}

export interface Condition {
  id: string;
  name: string;
  /** What to do to earn it, for the passport. */
  how: string;
}

export const CONDITIONS: readonly Condition[] = [
  { id: 'first-light', name: 'First Light', how: 'Ski in the first hour after sunrise.' },
  { id: 'bluebird', name: 'Bluebird Day', how: 'Ski under a clear midday sky.' },
  { id: 'powder-day', name: 'Powder Day', how: 'Ski while it is snowing.' },
  { id: 'alpenglow', name: 'Alpenglow', how: 'Ski in the last hour before sunset.' },
  { id: 'night-owl', name: 'Night Owl', how: 'Ski after dark.' },
];

/**
 * The conditions that hold right now, by id.
 * @param sunElevationDeg height of the sun above the horizon
 * @param sunInEast true before solar noon
 */
export function conditionsNow(sunElevationDeg: number, sunInEast: boolean, weather: { overcast: number; snowing: number }): string[] {
  const out: string[] = [];
  if (weather.snowing >= 0.5) out.push('powder-day');
  if (sunElevationDeg < -6) out.push('night-owl');
  const clear = weather.overcast < 0.35 && weather.snowing < 0.1;
  if (clear && sunElevationDeg > 20) out.push('bluebird');
  if (clear && sunElevationDeg > 0 && sunElevationDeg < 9) out.push(sunInEast ? 'first-light' : 'alpenglow');
  return out;
}
