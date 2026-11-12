import type { Bump } from '../player/collide';

/** A building as something solid: a box on the ground, turned about the upright axis. */
export interface WallBox {
  x: number;
  z: number;
  /** Width along the box's own x axis and depth along its z, in metres. */
  w: number;
  d: number;
  /** Turn about the upright axis, as three.js turns a model: the box's x axis points along (cos, -sin). */
  turn: number;
  /** Height of the top of its roof, in the world's own heights. Needed only for keeping a camera above it. */
  top?: number;
}

/** True if a point is inside a box grown by `margin` on every side. */
export function insideBox(x: number, z: number, b: WallBox, margin = 0): boolean {
  const c = Math.cos(b.turn);
  const s = Math.sin(b.turn);
  const dx = x - b.x;
  const dz = z - b.z;
  return Math.abs(dx * c - dz * s) <= b.w / 2 + margin && Math.abs(dx * s + dz * c) <= b.d / 2 + margin;
}

/** If a circle at (x, z) overlaps the box, the nearest spot that does not, and which way that is. */
export function pushOutOfBox(x: number, z: number, radius: number, b: WallBox): Bump | null {
  const c = Math.cos(b.turn);
  const s = Math.sin(b.turn);
  const dx = x - b.x;
  const dz = z - b.z;
  // Into the box's own axes.
  const lx = dx * c - dz * s;
  const lz = dx * s + dz * c;
  const hw = b.w / 2;
  const hd = b.d / 2;
  const qx = Math.min(hw, Math.max(-hw, lx));
  const qz = Math.min(hd, Math.max(-hd, lz));
  const ex = lx - qx;
  const ez = lz - qz;
  const dist = Math.hypot(ex, ez);
  if (dist >= radius) return null;
  let nx: number;
  let nz: number;
  let px: number;
  let pz: number;
  if (dist > 1e-6) {
    // Outside, touching a wall or a corner: step straight back from it.
    nx = ex / dist;
    nz = ez / dist;
    px = qx + nx * radius;
    pz = qz + nz * radius;
  } else if (hw - Math.abs(lx) < hd - Math.abs(lz)) {
    // Inside: leave by the nearest wall.
    nx = lx < 0 ? -1 : 1;
    nz = 0;
    px = nx * (hw + radius);
    pz = lz;
  } else {
    nx = 0;
    nz = lz < 0 ? -1 : 1;
    px = lx;
    pz = nz * (hd + radius);
  }
  return { x: b.x + px * c + pz * s, z: b.z - px * s + pz * c, nx: nx * c + nz * s, nz: -nx * s + nz * c };
}

const CELL = 48;
/** A roof overhangs its walls a little; a camera keeps this far outside them, in metres. */
const ROOF_MARGIN = 2;

/** Every building's walls, looked up by place so a mover only tests the few nearby. */
export class Walls {
  private readonly cells = new Map<number, WallBox[]>();

  constructor(boxes: readonly WallBox[]) {
    for (const b of boxes) this.add(b);
  }

  /** The cells a box may be met from. */
  private keys(b: WallBox): number[] {
    const keys: number[] = [];
    const reach = Math.hypot(b.w, b.d) / 2 + ROOF_MARGIN;
    for (let cx = Math.floor((b.x - reach) / CELL); cx <= Math.floor((b.x + reach) / CELL); cx++) {
      for (let cz = Math.floor((b.z - reach) / CELL); cz <= Math.floor((b.z + reach) / CELL); cz++) keys.push(cx * 100003 + cz);
    }
    return keys;
  }

  /** Something new and solid: a thing the town has built since the game began. */
  add(b: WallBox): void {
    for (const key of this.keys(b)) {
      const list = this.cells.get(key);
      if (list) list.push(b);
      else this.cells.set(key, [b]);
    }
  }

  /** Take away a box that was added: the very same one. */
  remove(b: WallBox): void {
    for (const key of this.keys(b)) {
      const list = this.cells.get(key);
      const at = list ? list.indexOf(b) : -1;
      if (list && at >= 0) list.splice(at, 1);
    }
  }

  /** The height of the highest roof over a point, or -Infinity where there is open sky. */
  roofAt(x: number, z: number): number {
    const list = this.cells.get(Math.floor(x / CELL) * 100003 + Math.floor(z / CELL));
    let top = -Infinity;
    if (list) for (const b of list) if (b.top !== undefined && b.top > top && insideBox(x, z, b, ROOF_MARGIN)) top = b.top;
    return top;
  }

  /** Where a circle at (x, z) must move to in order to stand clear of the walls, if it touches any. */
  bumpAt(x: number, z: number, radius: number): Bump | null {
    const list = this.cells.get(Math.floor(x / CELL) * 100003 + Math.floor(z / CELL));
    if (!list) return null;
    for (const b of list) {
      const bump = pushOutOfBox(x, z, radius, b);
      if (bump) return bump;
    }
    return null;
  }
}
