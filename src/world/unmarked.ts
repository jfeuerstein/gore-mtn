import { OPEN_WATER, type World } from './world';

/**
 * Ways through the woods that are on no map: the unmarked runs, which somebody skis and
 * nobody talks about, and the lines of small things (prints in the snow, sap buckets) that
 * lead off a trail to something in the trees. All of it is worked out from the ground, so
 * it survives a regenerated world. No three.js here.
 */

/** A way down through the trees, from beside one trail to another. */
export interface Run {
  id: string;
  /** x, z pairs from the top to the bottom, a step apart. */
  pts: number[];
  /** Metres from top to bottom, along it. */
  length: number;
}

/** A step along a run, in metres. */
export const RUN_STEP = 8;
/** A run keeps this far from every trail until it comes out onto one, and is at least this long. */
const KEEP_OFF = 16;
const LEAST = 380;
const MOST = 1100;
/** Their tops are this far apart, so that each is a find of its own. */
const APART = 650;
/** How far to each side of a run trees are kept back, in metres. */
export const RUN_HALF_WIDTH = 5;

const inside = (world: World, x: number, z: number, margin = 30): boolean => {
  const hf = world.source;
  return x > hf.minX + margin && x < hf.maxX - margin && z > hf.minZ + margin && z < hf.maxZ - margin;
};

/** Follow the fall of the ground from a point until it comes out on a trail. Null if it never does, or goes where a run cannot. */
function descend(world: World, x0: number, z0: number): number[] | null {
  const hf = world.source;
  const pts = [x0, z0];
  let x = x0;
  let z = z0;
  let heading: number | null = null;
  let flat = 0;
  for (let step = 0; step < MOST / RUN_STEP; step++) {
    const here = hf.heightAt(x, z);
    // The way that loses the most height, among those that do not turn back on the way come.
    let best = -Infinity;
    let turn = 0;
    for (let i = 0; i < 24; i++) {
      const a = (i / 24) * Math.PI * 2;
      if (heading !== null && Math.cos(a - heading) < 0.35) continue;
      const drop = here - hf.heightAt(x + Math.sin(a) * RUN_STEP, z + Math.cos(a) * RUN_STEP);
      // Keeping straight is worth a little: a run that zigzags is no run.
      const score = drop + (heading !== null ? Math.cos(a - heading) * 0.5 : 0);
      if (score > best) {
        best = score;
        turn = a;
      }
    }
    const nx = x + Math.sin(turn) * RUN_STEP;
    const nz = z + Math.cos(turn) * RUN_STEP;
    if (!inside(world, nx, nz)) return null;
    const drop = here - hf.heightAt(nx, nz);
    flat = drop < 0.5 ? flat + 1 : 0;
    if (flat > 3) return null;
    const open = world.openAt(nx, nz);
    if (open === OPEN_WATER) return null;
    x = nx;
    z = nz;
    heading = turn;
    pts.push(x, z);
    // Out onto a trail: that is the bottom.
    if (world.trailDistance(x, z) < 4) return pts;
    // Across a road or a lot, or back within sight of a trail before it has gone anywhere: not a run.
    if (open !== 0) return null;
    if (world.trailDistance(x, z) < KEEP_OFF && (pts.length / 2) * RUN_STEP < LEAST) return null;
  }
  return null;
}

/**
 * The mountain's unmarked runs: the longest ways down through forest that set off from just
 * beside one trail and come out on another, well apart from one another. The same ones
 * every time.
 */
export function unmarkedRuns(world: World, count = 3): Run[] {
  const hf = world.source;
  const found: { pts: number[]; length: number }[] = [];
  for (let z = hf.minZ + 60; z < hf.maxZ - 60; z += 45) {
    for (let x = hf.minX + 60; x < hf.maxX - 60; x += 45) {
      // The top: in the trees, a little way off a trail, on ground that falls away.
      const off = world.trailDistance(x, z);
      if (off < 22 || off > 55 || world.openAt(x, z) !== 0 || hf.slopeDegAt(x, z) < 9) continue;
      const pts = descend(world, x, z);
      if (!pts) continue;
      const length = (pts.length / 2 - 1) * RUN_STEP;
      if (length < LEAST) continue;
      // Nothing built anywhere along it.
      let clear = true;
      for (let i = 0; i < pts.length && clear; i += 8) if (world.buildings.some((b) => Math.hypot(b.x - (pts[i] as number), b.z - (pts[i + 1] as number)) < 40)) clear = false;
      if (clear) found.push({ pts, length });
    }
  }
  found.sort((a, b) => b.length - a.length || (a.pts[0] as number) - (b.pts[0] as number));
  const out: Run[] = [];
  for (const run of found) {
    if (out.length >= count) break;
    // Apart at the top, and not sharing a way down with one already chosen.
    const apart = out.every((o) => Math.hypot((o.pts[0] as number) - (run.pts[0] as number), (o.pts[1] as number) - (run.pts[1] as number)) >= APART && Math.hypot((o.pts.at(-2) as number) - (run.pts.at(-2) as number), (o.pts.at(-1) as number) - (run.pts.at(-1) as number)) >= 200);
    if (apart) out.push({ id: `run-${out.length + 1}`, pts: run.pts, length: run.length });
  }
  return out;
}

/** True within a run's width of it: where trees are kept back so that there is a way through. */
export function runCorridor(runs: readonly Run[]): (x: number, z: number) => boolean {
  const CELL = 4;
  const cells = new Set<number>();
  const key = (cx: number, cz: number): number => (cx + 4096) * 8192 + (cz + 4096);
  const reach = Math.ceil(RUN_HALF_WIDTH / CELL);
  for (const run of runs) {
    for (let i = 0; i + 3 < run.pts.length; i += 2) {
      for (let t = 0; t < 1; t += 0.25) {
        const x = (run.pts[i] as number) + ((run.pts[i + 2] as number) - (run.pts[i] as number)) * t;
        const z = (run.pts[i + 1] as number) + ((run.pts[i + 3] as number) - (run.pts[i + 1] as number)) * t;
        const cx = Math.floor(x / CELL);
        const cz = Math.floor(z / CELL);
        for (let dz = -reach; dz <= reach; dz++) for (let dx = -reach; dx <= reach; dx++) if (Math.hypot(dx, dz) * CELL <= RUN_HALF_WIDTH + CELL * 0.5) cells.add(key(cx + dx, cz + dz));
      }
    }
  }
  return (x, z) => cells.has(key(Math.floor(x / CELL), Math.floor(z / CELL)));
}

/** How far along a run the nearest of its points to a position is, 0..1, and how far off that is in metres. */
export function alongRun(run: Run, x: number, z: number): { share: number; off: number } {
  let best = Infinity;
  let at = 0;
  for (let i = 0; i < run.pts.length; i += 2) {
    const d = Math.hypot((run.pts[i] as number) - x, (run.pts[i + 1] as number) - z);
    if (d < best) {
      best = d;
      at = i / 2;
    }
  }
  return { share: at / Math.max(1, run.pts.length / 2 - 1), off: best };
}

/** How near a run's line counts as being on it, in metres. */
export const RUN_REACH = 14;
/** A run counts once its bottom is reached with this many tenths of it passed on the way. */
export const RUN_TENTHS = 8;

/**
 * Note that somebody is at a place: if that is on a run, mark the tenth of it they are in.
 * @param tenths the tenths of this run passed so far, which is added to
 * @returns true when that is the run come down: at its bottom, with most of it behind them
 */
export function downRun(run: Run, x: number, z: number, tenths: Set<number>): boolean {
  const { share, off } = alongRun(run, x, z);
  if (off > RUN_REACH) return false;
  tenths.add(Math.min(9, Math.floor(share * 10)));
  return share >= 0.97 && tenths.size >= RUN_TENTHS;
}

/** A step along a lead, in metres. */
const LEAD_STEP = 5;

/**
 * The way from a trail to something in the trees, as whatever leads there would lay it: from
 * the thing, toward the nearest trail, by the shortest way that keeps out of the water, and
 * then turned about so that it begins at the trail. x, z pairs a step apart. Empty if the
 * trail cannot be reached.
 */
export function leadLine(world: World, x0: number, z0: number): number[] {
  const back: number[] = [x0, z0];
  let x = x0;
  let z = z0;
  let heading: number | null = null;
  for (let step = 0; step < 160; step++) {
    const here = world.trailDistance(x, z);
    if (here < 3) break;
    let best = Infinity;
    let turn = 0;
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2;
      if (heading !== null && Math.cos(a - heading) < 0) continue;
      const px = x + Math.sin(a) * LEAD_STEP;
      const pz = z + Math.cos(a) * LEAD_STEP;
      if (!inside(world, px, pz, 10) || world.openAt(px, pz) === OPEN_WATER) continue;
      // Looking a little ahead, so that the way does not wobble with every bump in the distance.
      const d = world.trailDistance(x + Math.sin(a) * LEAD_STEP * 3, z + Math.cos(a) * LEAD_STEP * 3);
      if (d < best) {
        best = d;
        turn = a;
      }
    }
    if (best === Infinity) return [];
    x += Math.sin(turn) * LEAD_STEP;
    z += Math.cos(turn) * LEAD_STEP;
    heading = turn;
    back.push(x, z);
  }
  if (world.trailDistance(x, z) >= 8) return [];
  const out: number[] = [];
  for (let i = back.length - 2; i >= 0; i -= 2) out.push(back[i] as number, back[i + 1] as number);
  return out;
}
