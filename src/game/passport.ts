import type { Season } from '../look/season';
import type { Difficulty, Lift, Path, Place, Trail } from '../world/trails';
import type { TrailProgress } from './save';

/**
 * The trail passport: what there is to earn on the mountain and the rules for earning it.
 * No DOM or three.js here.
 *
 * - A trail is stamped once nearly all of it has been skied (or, when the snow has gone, ridden).
 *   It need not be in one run: progress down each trail is kept, so a trail left halfway can be
 *   finished another day. A path through the woods is stamped the same way, on foot or on wheels.
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

/** Something stamped by travelling its length: a ski trail, or a path. */
export interface Route {
  name: string;
  /** Points along it, flat x, z pairs, with how far either side counts as being on it. */
  checkpoints: number[];
  reach: number;
  /** Length along the centre line, in metres. */
  length: number;
}

export interface TrailEntry extends Route {
  difficulty: Difficulty;
  glade: boolean;
}

/** Points every CHECKPOINT_SPACING metres along each of some lines, and the lines' length in all. */
function checkpointsAlong(lines: readonly (readonly number[])[]): { checkpoints: number[]; length: number } {
  const checkpoints: number[] = [];
  let length = 0;
  for (const pts of lines) {
    const before = checkpoints.length;
    let carried = CHECKPOINT_SPACING / 2;
    for (let i = 0; i + 3 < pts.length; i += 2) {
      const ax = pts[i] as number;
      const az = pts[i + 1] as number;
      const bx = pts[i + 2] as number;
      const bz = pts[i + 3] as number;
      const seg = Math.hypot(bx - ax, bz - az);
      length += seg;
      while (carried <= seg) {
        checkpoints.push(ax + ((bx - ax) * carried) / seg, az + ((bz - az) * carried) / seg);
        carried += CHECKPOINT_SPACING;
      }
      carried -= seg;
    }
    // A line too short to hold a checkpoint still counts, at its middle.
    if (checkpoints.length === before && checkpoints.length === 0 && pts.length >= 4) {
      checkpoints.push(((pts[0] as number) + (pts.at(-2) as number)) / 2, ((pts[1] as number) + (pts.at(-1) as number)) / 2);
    }
  }
  return { checkpoints, length };
}

/** How close to a path counts as walking it, in metres. Paths are narrow and wind through trees. */
const PATH_REACH = 14;

/**
 * Every named path as one entry: the hiking, biking and cross-country trails through the woods.
 * Pieces sharing a name are joined. A path that only repeats a ski trail's name is left out; the
 * trail has its own stamp.
 */
export function buildPathBook(paths: readonly Path[], trails: readonly Trail[]): Route[] {
  const skiNames = new Set(trails.map((t) => t.name));
  const byName = new Map<string, number[][]>();
  for (const p of paths) {
    if (!p.name || skiNames.has(p.name)) continue;
    const list = byName.get(p.name);
    if (list) list.push(p.pts);
    else byName.set(p.name, [p.pts]);
  }
  const book: Route[] = [];
  for (const [name, lines] of byName) {
    const { checkpoints, length } = checkpointsAlong(lines);
    if (checkpoints.length > 0) book.push({ name, checkpoints, reach: PATH_REACH, length });
  }
  return book.sort((a, b) => a.name.localeCompare(b.name));
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
    const { checkpoints, length } = checkpointsAlong(use.map((piece) => piece.pts));
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

/** Looks up which checkpoints of some trails or paths are near a position. */
export class TrailIndex {
  private readonly cells = new Map<number, { entry: number; checkpoint: number }[]>();
  /** Checkpoints newly passed since this was made, so a caller can tell whether a visit changed anything. */
  marked = 0;

  constructor(readonly book: readonly Route[]) {
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
          const trail = this.book[entry] as Route;
          const cx = trail.checkpoints[checkpoint * 2] as number;
          const cz = trail.checkpoints[checkpoint * 2 + 1] as number;
          if (Math.hypot(cx - x, cz - z) > trail.reach) continue;
          const count = trail.checkpoints.length / 2;
          const p = (progress[trail.name] ??= { seen: '0'.repeat(count) });
          // A save from an older map may have a different number of checkpoints; start it afresh.
          if (p.seen.length !== count) p.seen = '0'.repeat(count);
          if (p.seen[checkpoint] === '1') continue;
          p.seen = `${p.seen.slice(0, checkpoint)}1${p.seen.slice(checkpoint + 1)}`;
          this.marked++;
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

/** Named spots worth a stamp: the lookouts, the old garnet workings, and a pond. */
const SPOT_LANDMARKS: Record<string, string> = {
  'vermont-overlook': 'Vermont Overlook',
  'twister-cliffs': 'Twister Cliffs',
  'windy-hill-lookout': 'Windy Hill Lookout',
  'scenic-view': 'Scenic View',
  'barton-mine': 'Barton Mine',
  'garnet-quarry': 'Garnet Quarry',
  'rabbit-pond': 'Rabbit Pond',
};

/** Places worth a stamp for visiting. */
export function buildLandmarks(places: readonly Place[], spots: readonly { id: string; x: number; z: number }[] = []): Spot[] {
  const named = spots.filter((s) => s.id in SPOT_LANDMARKS).map((s) => ({ id: s.id, name: SPOT_LANDMARKS[s.id] as string, x: s.x, z: s.z, reach: 60 }));
  return [...places
    .filter((p) => p.id in LANDMARK_NAMES)
    // The Base Lodge is a big building with a wide apron of snow; standing in front of it counts.
    .map((p) => ({ id: p.id === 'summit' ? 'fire-tower' : p.id, name: LANDMARK_NAMES[p.id] as string, x: p.x, z: p.z, reach: p.id === 'base-lodge' ? 120 : 70 })), ...named];
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
  /** The seasons it can be earned in; all of them if not given. */
  seasons?: readonly Season[];
}

export const CONDITIONS: readonly Condition[] = [
  { id: 'first-light', name: 'First Light', how: 'Be on the move in the first hour after sunrise.' },
  { id: 'bluebird', name: 'Bluebird Day', how: 'Ski or ride under a clear midday sky.' },
  { id: 'alpenglow', name: 'Alpenglow', how: 'Be on the move in the last hour before sunset.' },
  { id: 'night-owl', name: 'Night Owl', how: 'Ski or ride after dark.' },
  { id: 'powder-day', name: 'Powder Day', how: 'Ski while it is snowing.', seasons: ['winter'] },
  { id: 'corn-snow', name: 'Corn Snow', how: 'Ski soft spring snow under a high sun.', seasons: ['spring'] },
  { id: 'mud-season', name: 'Mud Season', how: 'Ski the ribbons in spring rain.', seasons: ['spring'] },
  { id: 'dog-days', name: 'Dog Days', how: 'Ride under a high summer sun.', seasons: ['summer'] },
  { id: 'firefly-night', name: 'Firefly Night', how: 'Ride among the fireflies on a summer night.', seasons: ['summer'] },
  { id: 'soaker', name: 'Soaker', how: 'Ride in the rain.', seasons: ['summer', 'fall'] },
  { id: 'peak-foliage', name: 'Peak Foliage', how: 'Ride through the colours on a clear fall day.', seasons: ['fall'] },
  { id: 'harvest-moon', name: 'Harvest Moon', how: 'Ride after dark in fall.', seasons: ['fall'] },
];

/**
 * The conditions that hold right now, by id.
 * @param sunElevationDeg height of the sun above the horizon
 * @param sunInEast true before solar noon
 * @param weather `snowing` is whatever is falling: snow in winter, rain otherwise
 */
export function conditionsNow(sunElevationDeg: number, sunInEast: boolean, weather: { overcast: number; snowing: number }, season: Season = 'winter'): string[] {
  const out: string[] = [];
  const falling = weather.snowing >= 0.5;
  const night = sunElevationDeg < -6;
  const clear = weather.overcast < 0.35 && weather.snowing < 0.1;
  if (night) out.push('night-owl');
  if (clear && sunElevationDeg > 20) out.push('bluebird');
  if (clear && sunElevationDeg > 0 && sunElevationDeg < 9) out.push(sunInEast ? 'first-light' : 'alpenglow');
  if (season === 'winter' && falling) out.push('powder-day');
  if (season === 'spring') {
    if (clear && sunElevationDeg > 30) out.push('corn-snow');
    if (falling) out.push('mud-season');
  }
  if (season === 'summer') {
    if (clear && sunElevationDeg > 50) out.push('dog-days');
    if (night && !falling) out.push('firefly-night');
  }
  if ((season === 'summer' || season === 'fall') && falling) out.push('soaker');
  if (season === 'fall') {
    if (clear && sunElevationDeg > 10) out.push('peak-foliage');
    if (night) out.push('harvest-moon');
  }
  return out;
}
