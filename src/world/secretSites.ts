import { buildPeaks } from '../game/passport';
import type { Whereabouts } from '../game/people';
import { SECRETS, type SecretWhere } from '../game/secrets';
import { unmarkedRuns, type Run } from './unmarked';
import { resolveTownPlaces, type TownPlace } from './townPlaces';
import { locate } from './whereabouts';
import { OPEN_WATER, type World } from './world';

/**
 * Where each of the mountain's secrets stands, worked out from its description, so that it
 * survives a regenerated world. No three.js here.
 */
export interface SecretSite {
  id: string;
  x: number;
  z: number;
  /** Turn about the upright axis: its front, at its own +z, is toward whoever comes to it. */
  turn: number;
}

/** Ground steeper than this is no place for a thing to stand, in degrees. */
const TOO_STEEP = 15;
/**
 * A place deep in the woods is at least this far from any trail, in metres, and best about
 * `WALK` from one: a walk into the trees, not an expedition to the corner of the map. The wild
 * places are this far from one another.
 */
const DEEP = 170;
const WALK = 300;
const APART = 500;

const dry = (world: World, x: number, z: number): boolean => {
  const hf = world.source;
  return x > hf.minX + 20 && x < hf.maxX - 20 && z > hf.minZ + 20 && z < hf.maxZ - 20 && world.openAt(x, z) !== OPEN_WATER && hf.slopeDegAt(x, z) < TOO_STEEP;
};

/**
 * Places deep in the woods: forest, dry, level enough to stand on, well away from every
 * trail, building and road, and from one another. The same ones every time.
 */
export function wildPlaces(world: World, count: number): { x: number; z: number }[] {
  const hf = world.source;
  const found: { x: number; z: number; far: number }[] = [];
  for (let z = hf.minZ + 120; z < hf.maxZ - 120; z += 55) {
    for (let x = hf.minX + 120; x < hf.maxX - 120; x += 55) {
      if (!dry(world, x, z) || world.openAt(x, z) !== 0) continue;
      const far = world.trailDistance(x, z);
      if (far < DEEP) continue;
      // Nothing built or cleared anywhere near: no road, no lot, no house.
      let clear = true;
      for (let a = 0; a < 8 && clear; a++) for (const r of [40, 90]) if (world.openAt(x + Math.cos((a / 8) * Math.PI * 2) * r, z + Math.sin((a / 8) * Math.PI * 2) * r) !== 0) clear = false;
      if (clear && !world.buildings.some((b) => Math.hypot(b.x - x, b.z - z) < 140)) found.push({ x, z, far });
    }
  }
  // Those a good walk in first, each well away from those already chosen.
  found.sort((a, b) => Math.abs(a.far - WALK) - Math.abs(b.far - WALK) || a.x - b.x || a.z - b.z);
  const out: { x: number; z: number }[] = [];
  for (const p of found) {
    if (out.length >= count) break;
    if (out.every((q) => Math.hypot(q.x - p.x, q.z - p.z) >= APART)) out.push({ x: p.x, z: p.z });
  }
  return out;
}

/** A point a share of the way along a line of x, z pairs. */
function along(pts: readonly number[], share: number): { x: number; z: number } {
  let total = 0;
  for (let i = 0; i + 3 < pts.length; i += 2) total += Math.hypot((pts[i + 2] as number) - (pts[i] as number), (pts[i + 3] as number) - (pts[i + 1] as number));
  let left = total * Math.min(1, Math.max(0, share));
  for (let i = 0; i + 3 < pts.length; i += 2) {
    const seg = Math.hypot((pts[i + 2] as number) - (pts[i] as number), (pts[i + 3] as number) - (pts[i + 1] as number));
    if (left <= seg && seg > 0) {
      const t = left / seg;
      return { x: (pts[i] as number) + ((pts[i + 2] as number) - (pts[i] as number)) * t, z: (pts[i + 1] as number) + ((pts[i + 3] as number) - (pts[i + 1] as number)) * t };
    }
    left -= seg;
  }
  return { x: pts.at(-2) as number, z: pts.at(-1) as number };
}

/** A number from a name, the same every time: for choosing which side of a place a thing stands on. */
const hash = (text: string): number => [...text].reduce((h, ch) => (Math.imul(h, 31) + ch.charCodeAt(0)) >>> 0, 7);

/** How many places deep in the woods are found: the secrets and the camper share them out by number. */
export const WILDS = 5;

/** What a place is worked out against: the map, the town's doors, the wild places and the unmarked runs. Made once. */
export interface Setting {
  world: World;
  town: readonly TownPlace[];
  wilds: readonly { x: number; z: number }[];
  runs: readonly Run[];
}

export function setting(world: World, town: readonly TownPlace[] = resolveTownPlaces(world)): Setting {
  return { world, town, wilds: wildPlaces(world, WILDS), runs: unmarkedRuns(world) };
}

/** The place something is described as being at, before it is stood off from it. */
function base({ world, town, wilds, runs }: Setting, where: SecretWhere): { x: number; z: number } | null {
  if ('peak' in where) return buildPeaks(world.places, world.lifts).find((p) => p.id === where.peak) ?? null;
  if ('path' in where) {
    const piece = world.paths.filter((p) => p.name === where.path).sort((a, b) => b.pts.length - a.pts.length)[0];
    return piece ? along(piece.pts, where.along) : null;
  }
  if ('wild' in where) return wilds[where.wild] ?? null;
  if ('door' in where) return town.find((p) => p.id === where.door)?.door ?? null;
  if ('shore' in where) {
    const pond = world.ponds.find((p) => p.id === where.shore);
    if (!pond) return null;
    // Out from the middle of the water, every way round, to the first dry ground: the best is the one with the least built near it.
    let best: { x: number; z: number } | null = null;
    let most = -Infinity;
    for (let i = 0; i < 32; i++) {
      const a = (i / 32) * Math.PI * 2;
      for (let r = 2; r < 120; r += 1.5) {
        const x = pond.x + Math.sin(a) * r;
        const z = pond.z + Math.cos(a) * r;
        if (world.openAt(x, z) === OPEN_WATER) continue;
        const px = pond.x + Math.sin(a) * (r + 1.2);
        const pz = pond.z + Math.cos(a) * (r + 1.2);
        const built = Math.min(60, ...world.buildings.map((b) => Math.hypot(b.x - px, b.z - pz)), ...town.map((t) => Math.hypot(t.x - px, t.z - pz)));
        const score = built + (world.openAt(px, pz) === 0 ? 25 : 0) - world.source.slopeDegAt(px, pz);
        if (r > 3 && score > most) {
          most = score;
          best = { x: px, z: pz };
        }
        break;
      }
    }
    return best;
  }
  if ('run' in where) {
    const run = runs[where.run];
    return run ? { x: run.pts[0] as number, z: run.pts[1] as number } : null;
  }
  return locate(world, where as Whereabouts);
}

/**
 * Where something described as being at a place, or a little way off from it, stands: on dry,
 * level ground, on its own side of the place, off the trails, and clear of whatever is
 * standing there already. Null if the place is not on the map.
 */
/** How far from open water something set into a hill keeps, in metres. */
const SHORE_CLEAR = 16;

/**
 * Somewhere for a thing that goes back into the hill, such as a tunnel's mouth: dry ground
 * that rises behind it, the steepest to be had within a couple of throws of where it is said
 * to be, well clear of the water, and turned so that it looks out down the slope.
 */
function intoHill(set: Setting, at: { x: number; z: number }, off: number, taken: readonly { x: number; z: number }[]): { x: number; z: number; turn: number } | null {
  const { world, town } = set;
  const hf = world.source;
  let best: { x: number; z: number; turn: number } | null = null;
  let most = -Infinity;
  for (let i = 0; i < 24; i++) {
    const a = (i / 24) * Math.PI * 2;
    for (const r of [off * 0.6, off, off * 1.5, off * 2.1, off * 2.8]) {
      const px = at.x + Math.sin(a) * r;
      const pz = at.z + Math.cos(a) * r;
      if (!dry(world, px, pz) || world.openAt(px, pz) !== 0 || world.trailDistance(px, pz) < 6 || taken.some((o) => Math.hypot(o.x - px, o.z - pz) < 7)) continue;
      if (world.buildings.some((b) => Math.hypot(b.x - px, b.z - pz) < 12) || town.some((t) => Math.hypot(t.x - px, t.z - pz) < Math.max(t.w, t.d) / 2 + 5)) continue;
      let wet = false;
      for (let k = 0; k < 8 && !wet; k++) wet = world.openAt(px + Math.sin((k / 8) * Math.PI * 2) * SHORE_CLEAR, pz + Math.cos((k / 8) * Math.PI * 2) * SHORE_CLEAR) === OPEN_WATER;
      if (wet) continue;
      // Which way the ground falls, and how fast, taken over the width of the thing itself.
      const gx = (hf.heightAt(px + 3, pz) - hf.heightAt(px - 3, pz)) / 6;
      const gz = (hf.heightAt(px, pz + 3) - hf.heightAt(px, pz - 3)) / 6;
      const rise = Math.hypot(gx, gz);
      if (rise < 0.08) continue;
      // How far the ground climbs in the five metres behind it, and how far it drops in the five in front: it wants a
      // bank at its back and somewhere to stand before it, not the brink of a drop.
      const here = hf.heightAt(px, pz);
      const behind = hf.heightAt(px + (gx / rise) * 5, pz + (gz / rise) * 5) - here;
      const before = here - hf.heightAt(px - (gx / rise) * 5, pz - (gz / rise) * 5);
      const score = Math.min(behind, 3.5) - Math.max(0, before - 2) * 0.6 - Math.abs(r - off) * 0.03;
      if (behind > 1 && score > most) {
        most = score;
        best = { x: px, z: pz, turn: Math.atan2(-gx, -gz) };
      }
    }
  }
  return best;
}

export function placeAt(set: Setting, id: string, where: SecretWhere, off: number, taken: readonly { x: number; z: number }[] = [], into?: 'hill'): SecretSite | null {
  const { world, town } = set;
  const at = base(set, where);
  if (!at) return null;
  let { x, z } = at;
  const bank = into === 'hill' ? intoHill(set, at, Math.max(off, 12), taken) : null;
  if (bank) return { id, ...bank };
  if (off > 0) {
    const side = ((hash(id) % 360) / 180) * Math.PI;
    let best = -Infinity;
    for (let i = 0; i < 16; i++) {
      const a = side + (i / 16) * Math.PI * 2;
      for (const r of [off, off * 0.75, off * 1.25]) {
        const px = at.x + Math.sin(a) * r;
        const pz = at.z + Math.cos(a) * r;
        if (!dry(world, px, pz) || taken.some((o) => Math.hypot(o.x - px, o.z - pz) < 7)) continue;
        // Not up against a wall: nothing stands within a few steps of a building.
        if (world.buildings.some((b) => Math.hypot(b.x - px, b.z - pz) < 12) || town.some((t) => Math.hypot(t.x - px, t.z - pz) < Math.max(t.w, t.d) / 2 + 5)) continue;
        // Nearer its own side is better; so is being off the trail; so is level ground.
        const turned = Math.min(i, 16 - i) / 8;
        const score = Math.min(40, world.trailDistance(px, pz)) * 0.05 - (world.trailDistance(px, pz) < 1 ? 3 : 0) - turned - world.source.slopeDegAt(px, pz) * 0.06 - Math.abs(r - off) * 0.02;
        if (score > best) {
          best = score;
          x = px;
          z = pz;
        }
      }
    }
  }
  // It faces the way it was come to: back toward the place it is by, or else toward the nearest trail.
  let turn = 0;
  if (off > 0) turn = Math.atan2(at.x - x, at.z - z);
  else {
    let near = Infinity;
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2;
      const d = world.trailDistance(x + Math.sin(a) * 6, z + Math.cos(a) * 6);
      if (d < near) {
        near = d;
        turn = a;
      }
    }
    // At a door, it is the door; it has no model of its own to turn.
    if ('door' in where) turn = town.find((p) => p.id === where.door)?.turn ?? 0;
  }
  return { id, x, z, turn };
}

/** Every secret's place in the world. One that cannot be placed (the thing it is by is not on the map) is left out. */
export function secretSites(world: World, town: readonly TownPlace[] = resolveTownPlaces(world), set: Setting = setting(world, town)): SecretSite[] {
  const out: SecretSite[] = [];
  for (const secret of SECRETS) {
    const site = placeAt(set, secret.id, secret.where, secret.off ?? 0, out, secret.into);
    if (site) out.push(site);
  }
  return out;
}
