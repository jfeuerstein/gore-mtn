import { buildPeaks } from '../game/passport';
import type { Whereabouts } from '../game/people';
import { SECRETS, type Secret } from '../game/secrets';
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

/** The place a secret is described as being at, before it is stood off from it. */
function base(world: World, secret: Secret, wilds: readonly { x: number; z: number }[], town: readonly TownPlace[]): { x: number; z: number } | null {
  const where = secret.where;
  if ('peak' in where) return buildPeaks(world.places, world.lifts).find((p) => p.id === where.peak) ?? null;
  if ('path' in where) {
    const piece = world.paths.filter((p) => p.name === where.path).sort((a, b) => b.pts.length - a.pts.length)[0];
    return piece ? along(piece.pts, where.along) : null;
  }
  if ('wild' in where) return wilds[where.wild] ?? null;
  if ('door' in where) return town.find((p) => p.id === where.door)?.door ?? null;
  return locate(world, where as Whereabouts);
}

/** Every secret's place in the world. One that cannot be placed (the thing it is by is not on the map) is left out. */
export function secretSites(world: World, town: readonly TownPlace[] = resolveTownPlaces(world)): SecretSite[] {
  const wilds = wildPlaces(world, 4);
  const out: SecretSite[] = [];
  for (const secret of SECRETS) {
    const at = base(world, secret, wilds, town);
    if (!at) continue;
    let { x, z } = at;
    const off = secret.off ?? 0;
    if (off > 0) {
      // Stood off from the place: on dry, level ground, toward its own side of it, and away from the trails rather than on them.
      const side = ((hash(secret.id) % 360) / 180) * Math.PI;
      let best = -Infinity;
      for (let i = 0; i < 16; i++) {
        const a = side + (i / 16) * Math.PI * 2;
        for (const r of [off, off * 0.75, off * 1.25]) {
          const px = at.x + Math.sin(a) * r;
          const pz = at.z + Math.cos(a) * r;
          if (!dry(world, px, pz) || out.some((o) => Math.hypot(o.x - px, o.z - pz) < 7)) continue;
          // Nearer its own side is better; so is being off the trail; so is level ground.
          const turned = Math.min(i, 16 - i) / 8;
          const score = Math.min(40, world.trailDistance(px, pz)) * 0.05 - turned - world.source.slopeDegAt(px, pz) * 0.06 - Math.abs(r - off) * 0.02;
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
      if ('door' in secret.where) turn = town.find((p) => 'door' in secret.where && p.id === secret.where.door)?.turn ?? 0;
    }
    out.push({ id: secret.id, x, z, turn });
  }
  return out;
}
