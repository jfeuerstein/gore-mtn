import { carCount, type LiftPath } from './lifts';
import { makeRng } from '../rng';
import type { Difficulty, Road, Trail } from './trails';

/**
 * The other people on the mountain: skiers (or, in the bike months, riders) coming down the
 * trails, people on the chairs going up, and a few of the town out walking Main Street. None of
 * them is anybody: they have no names and nothing to say. They are there so that the mountain
 * looks like a ski area and the town like a town.
 *
 * Nothing here is simulated. Where each one is at any moment is worked out from a clock, so the
 * whole crowd costs a little arithmetic and can be picked up anywhere. No three.js here.
 */

/** A line somebody travels: a trail's centre line, or the side of a street. */
export interface Route {
  /** Flat list of x, z pairs. */
  pts: readonly number[];
  /** Distance along the line to each point. */
  at: readonly number[];
  length: number;
}

export function buildRoute(pts: readonly number[]): Route {
  const at: number[] = [0];
  for (let i = 2; i + 1 < pts.length; i += 2) {
    at.push((at[at.length - 1] as number) + Math.hypot((pts[i] as number) - (pts[i - 2] as number), (pts[i + 1] as number) - (pts[i - 1] as number)));
  }
  return { pts, at, length: at[at.length - 1] as number };
}

/** The point a distance along a route. */
export function routePoint(route: Route, distance: number): { x: number; z: number } {
  const d = Math.min(Math.max(distance, 0), route.length);
  let i = 0;
  while (i < route.at.length - 2 && (route.at[i + 1] as number) < d) i++;
  const span = (route.at[i + 1] as number) - (route.at[i] as number) || 1;
  const t = (d - (route.at[i] as number)) / span;
  const p = route.pts;
  const a = i * 2;
  return { x: (p[a] as number) + ((p[a + 2] as number) - (p[a] as number)) * t, z: (p[a + 1] as number) + ((p[a + 3] as number) - (p[a + 1] as number)) * t };
}

/** A trail that people ski: its centre line, how far they swing to either side of it, and how fast they take it. */
export interface Run extends Route {
  name: string;
  /** Metres to either side of the centre line that a skier's turns reach. */
  swing: number;
  /** Metres a second. */
  speed: number;
}

/** A trail shorter than this is not worth a skier of its own. */
const SHORTEST_RUN = 220;
/** People do not ski flat out. Metres a second, by how hard the trail is. */
const PACE: Record<Difficulty, number> = { easy: 8, intermediate: 10.5, advanced: 12, expert: 12, freeride: 9 };

/** A trail that drops less than this for every metre along it is a traverse: people pole along it, they do not ski it. */
const FLATTEST_RUN = 0.06;

/**
 * The trails with skiers on them: named, groomed, long enough to be worth the trip, and steep
 * enough to slide down.
 */
export function buildRuns(trails: readonly Trail[], heightAt: (x: number, z: number) => number): Run[] {
  const runs: Run[] = [];
  for (const t of trails) {
    if (!t.name || t.area || t.glade || t.width <= 0) continue;
    const route = buildRoute(t.pts);
    if (route.length < SHORTEST_RUN) continue;
    const n = t.pts.length;
    const drop = heightAt(t.pts[0] as number, t.pts[1] as number) - heightAt(t.pts[n - 2] as number, t.pts[n - 1] as number);
    if (drop < route.length * FLATTEST_RUN) continue;
    // Turns keep well inside the groomed width, and are no wider than a person makes them.
    runs.push({ ...route, name: t.name, swing: Math.min(7, Math.max(1.5, t.width / 2 - 3)), speed: PACE[t.difficulty] });
  }
  return runs;
}

/** One of the crowd on a run. */
export interface Glider {
  /** Which run, by index. */
  run: number;
  /** Where in their round of the run they start, 0..1, so that they are spread down it. */
  phase: number;
  /** Their own pace against the run's, about 1. */
  pace: number;
  /** How wide and how long their turns are, in metres, and where in a turn they start. */
  swing: number;
  wave: number;
  lead: number;
  /** Seconds spent out of sight between runs, riding back up. */
  rest: number;
  /** 0..1. They are out only when the mountain is at least this busy, so it thins toward dusk. */
  keen: number;
  /** Which of the outfits they wear, 0..1. */
  wears: number;
}

/** At most this many on the whole mountain. */
export const MOST_GLIDERS = 72;

/** The crowd on the trails: one or more to a run, by its length, the same ones on every load. */
export function buildGliders(runs: readonly Run[], seed = 7): Glider[] {
  const random = makeRng(seed);
  const out: Glider[] = [];
  runs.forEach((run, index) => {
    const n = Math.min(3, 1 + Math.floor(run.length / 700));
    for (let i = 0; i < n; i++) {
      out.push({
        run: index,
        phase: random(),
        pace: 0.82 + random() * 0.36,
        swing: run.swing * (0.55 + random() * 0.45),
        wave: 26 + random() * 22,
        lead: random() * Math.PI * 2,
        rest: 20 + random() * 40,
        keen: random(),
        wears: random(),
      });
    }
  });
  // Too many, and the keenest stay: every run keeps somebody before any run has three.
  return out.length > MOST_GLIDERS ? out.sort((a, b) => a.keen - b.keen).slice(0, MOST_GLIDERS) : out;
}

export interface GliderNow {
  x: number;
  z: number;
  /** The way they are travelling, as a yaw: 0 is north, positive turns left. */
  yaw: number;
  /** How far they are tipped into the turn, in radians; positive is to their own right. */
  lean: number;
  /** 0..1: they grow from nothing at the top and shrink away at the bottom, so nobody pops in or out. */
  size: number;
  /** The pole they are touching to the snow as one turn ends and the next begins: -1 their left, 1 their right, 0 neither. */
  plant: number;
}

/** A pole is planted while a skier is within this much of the middle of their line, as a share of how far they swing. */
const PLANT_NEAR = 0.38;

/** Seconds over which someone arrives at the top of a run, or leaves the bottom. */
const ARRIVE = 1.4;

/** Where one of the crowd is at a moment on the clock, or null while they are riding back up. */
export function gliderAt(run: Run, g: Glider, clock: number): GliderNow | null {
  const speed = run.speed * g.pace;
  const down = run.length / speed;
  const round = down + g.rest;
  const t = (((clock + g.phase * round) % round) + round) % round;
  if (t >= down) return null;
  const s = t * speed;
  // The line of the trail here, taken over a few metres so that a corner in the map is a curve.
  const a = routePoint(run, s - 4);
  const b = routePoint(run, s + 4);
  const len = Math.hypot(b.x - a.x, b.z - a.z) || 1;
  const fx = (b.x - a.x) / len;
  const fz = (b.z - a.z) / len;
  // To the right of that line, for someone facing down it.
  const rx = -fz;
  const rz = fx;
  const k = (Math.PI * 2) / g.wave;
  const turn = k * s + g.lead;
  const aside = g.swing * Math.sin(turn);
  // How fast they are crossing the hill, against how fast they are going down it.
  const across = g.swing * k * Math.cos(turn);
  const at = routePoint(run, s);
  const dx = fx + rx * across;
  const dz = fz + rz * across;
  return {
    x: at.x + rx * aside,
    z: at.z + rz * aside,
    yaw: Math.atan2(-dx, -dz),
    // At the far right of a turn they are coming back left, and lean that way.
    lean: -0.34 * Math.sin(turn) * Math.min(1, g.swing / 4),
    size: Math.min(1, t / ARRIVE, (down - t) / ARRIVE),
    // Crossing the middle of their line they are between turns. Going over to the right, the
    // turn to come is back to the left, and it is the left pole that marks it.
    plant: Math.abs(Math.sin(turn)) < PLANT_NEAR && g.swing > 1.5 ? (Math.cos(turn) > 0 ? -1 : 1) : 0,
  };
}

/** How busy the mountain is, 0..1, by the watch of the day. Nobody skis in the dark. */
export function busyness(watch: 'dawn' | 'day' | 'dusk' | 'night'): number {
  return watch === 'day' ? 1 : watch === 'dawn' ? 0.35 : watch === 'dusk' ? 0.5 : 0;
}

/** A small repeatable number, 0..1, from two whole numbers. */
function roll(a: number, b: number): number {
  let h = (Math.imul(a + 1, 374761393) ^ Math.imul(b + 1, 668265263)) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177) >>> 0;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/** A seat taken on a chair going up. */
export interface Seat {
  /** Which lift, by index, and which of its chairs. */
  lift: number;
  slot: number;
  /** Metres to the right of the middle of the chair. */
  aside: number;
  keen: number;
  wears: number;
}

/** The middle of a chair is left for the player. */
const SEAT_ASIDE = 0.78;

/**
 * Who is riding up: about one chair in three carries somebody, and some of those carry two.
 * Gondola cabins hide their riders, and nobody sits on a carpet.
 */
export function buildSeats(paths: readonly LiftPath[]): Seat[] {
  const seats: Seat[] = [];
  paths.forEach((path, lift) => {
    if (path.surface || path.cabins) return;
    for (let slot = 0; slot < carCount(path); slot++) {
      const taken = roll(lift, slot);
      if (taken > 0.36) continue;
      seats.push({ lift, slot, aside: taken < 0.18 ? SEAT_ASIDE : -SEAT_ASIDE, keen: roll(slot, lift + 31), wears: roll(lift + 7, slot) });
      if (taken < 0.1) seats.push({ lift, slot, aside: -SEAT_ASIDE, keen: roll(slot + 3, lift + 31), wears: roll(lift + 11, slot) });
    }
  });
  return seats;
}

/** Someone out for a walk: up and down a stretch of a street, with a stop at each end. */
export interface Walker {
  /** The stretch they walk, in metres along the route. */
  from: number;
  to: number;
  /** Metres a second. */
  pace: number;
  /** Seconds stood at each end. */
  pause: number;
  phase: number;
  wears: number;
}

/** How far from the middle of the road people walk: down the middle of the sidewalk. */
export const WALK_ASIDE = 4.7;

/**
 * The side of a street as a route: the road's own line moved over, with whatever the map broke
 * into pieces joined up where the pieces meet.
 */
export function streetSide(roads: readonly Road[], name: string, aside = WALK_ASIDE): Route | null {
  const pieces = roads.filter((r) => r.name === name && r.pts.length >= 4).map((r) => [...r.pts]);
  if (pieces.length === 0) return null;
  // Start from the longest piece and add on any other that begins or ends where it does.
  pieces.sort((a, b) => buildRoute(b).length - buildRoute(a).length);
  let line = pieces.shift() as number[];
  const near = (ax: number, az: number, bx: number, bz: number): boolean => Math.hypot(ax - bx, az - bz) < 12;
  for (let joined = true; joined; ) {
    joined = false;
    for (let i = 0; i < pieces.length; i++) {
      const p = pieces[i] as number[];
      const n = line.length;
      const m = p.length;
      const flipped = (): number[] => {
        const out: number[] = [];
        for (let j = m - 2; j >= 0; j -= 2) out.push(p[j] as number, p[j + 1] as number);
        return out;
      };
      if (near(line[n - 2] as number, line[n - 1] as number, p[0] as number, p[1] as number)) line = [...line, ...p.slice(2)];
      else if (near(line[n - 2] as number, line[n - 1] as number, p[m - 2] as number, p[m - 1] as number)) line = [...line, ...flipped().slice(2)];
      else if (near(line[0] as number, line[1] as number, p[m - 2] as number, p[m - 1] as number)) line = [...p.slice(0, m - 2), ...line];
      else if (near(line[0] as number, line[1] as number, p[0] as number, p[1] as number)) line = [...flipped().slice(0, m - 2), ...line];
      else continue;
      pieces.splice(i, 1);
      joined = true;
      break;
    }
  }
  // Step along it every few metres, a little to one side.
  const centre = buildRoute(line);
  const side: number[] = [];
  for (let d = 0; d <= centre.length; d += 3) {
    const a = routePoint(centre, d - 2);
    const b = routePoint(centre, d + 2);
    const len = Math.hypot(b.x - a.x, b.z - a.z) || 1;
    const at = routePoint(centre, d);
    side.push(at.x - ((b.z - a.z) / len) * aside, at.z + ((b.x - a.x) / len) * aside);
  }
  return side.length >= 4 ? buildRoute(side) : null;
}

/**
 * The walkers on a street: each has a stretch of their own, spread along it.
 * @param from, to the part of the route they keep to, in metres along it
 */
export function buildWalkers(count: number, from: number, to: number, seed = 11): Walker[] {
  const random = makeRng(seed);
  const out: Walker[] = [];
  const span = (to - from) / count;
  for (let i = 0; i < count; i++) {
    const a = from + span * i + random() * span * 0.2;
    const length = Math.min(span * (0.75 + random() * 0.6), to - a);
    out.push({ from: a, to: a + Math.max(12, length), pace: 1.05 + random() * 0.35, pause: 5 + random() * 7, phase: random(), wears: random() });
  }
  return out;
}

export interface WalkerNow {
  /** Metres along the route. */
  distance: number;
  /** +1 walking up the route, -1 walking back, 0 stood at one end. */
  heading: -1 | 0 | 1;
  /** Which end they are stood at, when they are: 0 the near one, 1 the far one. */
  end: 0 | 1;
  /** Metres walked on this leg so far, for the stride. */
  walked: number;
}

/** Where a walker is at a moment on the clock. */
export function walkerAt(w: Walker, clock: number): WalkerNow {
  const length = w.to - w.from;
  const leg = length / w.pace;
  const round = 2 * (leg + w.pause);
  const t = (((clock + w.phase * round) % round) + round) % round;
  if (t < leg) return { distance: w.from + t * w.pace, heading: 1, end: 0, walked: t * w.pace };
  if (t < leg + w.pause) return { distance: w.to, heading: 0, end: 1, walked: 0 };
  if (t < 2 * leg + w.pause) return { distance: w.to - (t - leg - w.pause) * w.pace, heading: -1, end: 1, walked: (t - leg - w.pause) * w.pace };
  return { distance: w.from, heading: 0, end: 0, walked: 0 };
}
