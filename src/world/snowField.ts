import * as THREE from 'three/webgpu';
import { lit } from '../look/material';

/** Points along a side of the field, and how far apart they are, in metres: a field about 63 m across. */
const SIDE = 192;
const CELL = 0.33;
/** The field is moved to keep the player near its middle whenever they have gone this many cells from it. */
const SHIFT = 8;
/**
 * The snow thins to nothing over this many cells at the field's edge, so that it meets the ground there. Only where
 * it is drawn: it is shaded as if it did not, so the thinning is not seen, and can be short.
 */
const EDGE = 6;
/**
 * How far below the ground a part of the field with no snow on it is kept, so that the ground is what is seen, in
 * metres; and the depth of snow at which it is level with its own top. Well under, and not a finger's width with the
 * depth test leaned on: at a shallow angle a sheet two centimetres down showed through the ground in slivers.
 */
const BURY = 0.3;
const SHOWN_FROM = 0.05;
/** The least snow left on the floor of a trough, in metres: it is packed, not swept to the ground. */
const FLOOR = 0.035;
/** How wide the heights are taken apart to tell which way the ground itself faces, in cells: about what the terrain uses. */
const WIDE = 5;
/** How far the depth of the snow is smoothed, in cells each way: it comes up gently from a trail's edge and is not a step there. */
const SOFT = 2;

/** What the field needs to know of the world. All of it is asked a strip at a time as the field moves, never a frame at a time. */
export interface SnowGround {
  /** The height of the ground. */
  heightAt(x: number, z: number): number;
  /** How deep the loose snow lies at a place before anybody has been through it, in metres. */
  depthAt(x: number, z: number): number;
  /** The colour of the ground at a place, as it is printed: the snow takes it, so that a trail is still a trail. */
  colourAt(x: number, z: number, into: THREE.Color): void;
}

/** Something lying on the ground that the snow has not buried: the snow is hollowed round it. */
export interface Hollow {
  x: number;
  z: number;
  /** How far out the hollow reaches, in metres. */
  r: number;
}

const smooth = (t: number): number => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));
/** How much of the snow's depth is drawn at a point, by how far in from the field's edge it is. */
const TAPER = Float32Array.from({ length: SIDE * SIDE }, (_, i) => smooth(Math.min(i % SIDE, Math.floor(i / SIDE), SIDE - 1 - (i % SIDE), SIDE - 1 - Math.floor(i / SIDE)) / EDGE));

/**
 * Loose snow as a layer of its own: a soft sheet lying over the ground round the player, as
 * thick as the day's snow, which is pushed aside by whoever goes through it. A skier cuts a
 * trough down into it with the snow heaped in a soft lip either side; someone on foot treads
 * a narrower one. It is a real surface, so what stands in it stands in it: a post is shorter
 * by the depth of the snow, a tree's trunk goes down into it.
 *
 * It is a grid of points, a third of a metre apart, that keeps the player near its middle.
 * For each point it remembers the ground's height, how deep the snow lay, and how far it has
 * been pushed down or heaped up since. Where there is no snow (a groomed trail on a day
 * without any, a ploughed road) the sheet is tucked under the ground and the ground is seen.
 * It is lit as the ground is, with the ground's own colours, and its shading is smooth, so a
 * trough is a soft shape and not a cut. One draw call; what was trodden is forgotten once it
 * is some thirty metres behind.
 *
 * Moving it is the costly part, so it is moved a few metres at a time and only the strip
 * that has come into it is asked of the world; everything else slides over as it was.
 */
export class SnowField {
  readonly mesh: THREE.Mesh;
  private readonly material: THREE.Material & { color: THREE.Color };
  private readonly positions = new Float32Array(SIDE * SIDE * 3);
  private readonly normals = new Float32Array(SIDE * SIDE * 3);
  private readonly colours = new Float32Array(SIDE * SIDE * 3);
  /** The colour of the ground at each point, before the shade of a trough is put on it. */
  private readonly inks = new Float32Array(SIDE * SIDE * 3);
  private readonly position: THREE.BufferAttribute;
  private readonly normal: THREE.BufferAttribute;
  private readonly colour: THREE.BufferAttribute;
  /** For each point: the ground's height; how deep the snow lay; that, smoothed; and how far it has been moved. */
  private readonly base = new Float32Array(SIDE * SIDE);
  private readonly lay = new Float32Array(SIDE * SIDE);
  private readonly deep = new Float32Array(SIDE * SIDE);
  private readonly moved = new Float32Array(SIDE * SIDE);
  /** Where the field's first point is, in cells from the world's middle; null until it has been laid. */
  private at: { cx: number; cz: number } | null = null;
  private readonly tint = new THREE.Color();
  /** The part that has changed since it was last drawn (columns from and to, rows from and to), to draw and send only that. */
  private dirty: [number, number, number, number] | null = null;
  private last: { x: number; z: number } | null = null;

  constructor(private readonly ground: SnowGround) {
    this.position = new THREE.BufferAttribute(this.positions, 3);
    this.normal = new THREE.BufferAttribute(this.normals, 3);
    this.colour = new THREE.BufferAttribute(this.colours, 3);
    for (const attribute of [this.position, this.normal, this.colour]) attribute.setUsage(THREE.DynamicDrawUsage);
    const index = new Uint32Array((SIDE - 1) * (SIDE - 1) * 6);
    let o = 0;
    for (let r = 0; r < SIDE - 1; r++) {
      for (let c = 0; c < SIDE - 1; c++) {
        const i = r * SIDE + c;
        // The same way round as the ground's own triangles, facing up.
        index.set([i, i + SIDE, i + 1, i + 1, i + SIDE, i + SIDE + 1], o);
        o += 6;
      }
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', this.position);
    geometry.setAttribute('normal', this.normal);
    geometry.setAttribute('color', this.colour);
    geometry.setIndex(new THREE.BufferAttribute(index, 1));
    // Lit as the ground is.
    this.material = lit({ color: 0xffffff, vertexColors: true }) as THREE.Material & { color: THREE.Color };
    this.mesh = new THREE.Mesh(geometry, this.material);
    this.mesh.name = 'snow';
    this.mesh.frustumCulled = false;
    this.mesh.receiveShadow = true;
    this.mesh.visible = false;
  }

  /** The colour of snow in this light, as the ground wears it. */
  setTint(colour: number): void {
    this.material.color.setHex(colour);
  }

  /** Take the snow away: it is not winter, or it is not wanted. */
  clear(): void {
    this.mesh.visible = false;
    this.at = null;
    this.last = null;
  }

  /**
   * Keep the field round a place, laying it afresh if it is not there or the place has moved
   * right away from it. Call every frame with where the player is.
   * @param hollows what is lying on the ground hereabouts, to leave uncovered
   * @returns true if the field was moved or laid: the hollows have been put in again
   */
  follow(x: number, z: number, hollows: () => readonly Hollow[]): boolean {
    const wantX = Math.round(x / CELL) - SIDE / 2;
    const wantZ = Math.round(z / CELL) - SIDE / 2;
    const at = this.at;
    this.mesh.visible = true;
    if (at && Math.abs(wantX - at.cx) < SHIFT && Math.abs(wantZ - at.cz) < SHIFT) return false;
    // Moved in whole steps, so that a point of the field is always at the same place in the world.
    const cx = Math.round(wantX / SHIFT) * SHIFT;
    const cz = Math.round(wantZ / SHIFT) * SHIFT;
    const dx = at ? cx - at.cx : SIDE;
    const dz = at ? cz - at.cz : SIDE;
    this.at = { cx, cz };
    // How wide a band is drawn again along the edge the field has moved toward: what is new, with what looks to it for
    // its lie and what is no longer thinned as the edge is. Along the edge it moved away from, only what now is.
    const band = (by: number): number => Math.abs(by) + Math.max(EDGE, WIDE + 2);
    if (!at || band(dx) * 2 >= SIDE || band(dz) * 2 >= SIDE) {
      if (!at || Math.abs(dx) >= SIDE || Math.abs(dz) >= SIDE) {
        this.moved.fill(0);
        this.fill(0, SIDE, 0, SIDE);
      } else {
        this.shift(dx, dz);
      }
      this.settle(0, SIDE, 0, SIDE);
      for (const hollow of hollows()) this.hollow(hollow);
      this.draw(0, SIDE, 0, SIDE);
    } else {
      for (const grid of [this.positions, this.normals, this.colours]) slide(grid, dx, dz, 3);
      for (const [c0, c1, r0, r1] of this.shift(dx, dz)) this.settle(c0 - SOFT, c1 + SOFT, r0 - SOFT, r1 + SOFT);
      for (const hollow of hollows()) this.hollow(hollow);
      if (dx !== 0) {
        this.draw(0, dx < 0 ? band(dx) : EDGE + 1, 0, SIDE);
        this.draw(SIDE - (dx > 0 ? band(dx) : EDGE + 1), SIDE, 0, SIDE);
      }
      if (dz !== 0) {
        this.draw(0, SIDE, 0, dz < 0 ? band(dz) : EDGE + 1);
        this.draw(0, SIDE, SIDE - (dz > 0 ? band(dz) : EDGE + 1), SIDE);
      }
    }
    this.dirty = null;
    for (const attribute of [this.position, this.normal, this.colour]) {
      // The whole of it is to be sent, and that is said as a part that happens to be all of it. Said as "no part
      // named", it was lost the same frame: whoever is in the snow treads it before the frame is drawn, which names
      // the few rows round them, and then only those were sent. The rest of the sheet stayed on the graphics card
      // where it had been when the run began: no snow under the skier, and the rows that were sent joined to it by
      // triangles a hillside long.
      attribute.clearUpdateRanges();
      attribute.addUpdateRange(0, attribute.array.length);
      attribute.needsUpdate = true;
    }
    return true;
  }

  /**
   * Slide over what is still in the field, and ask the world only about the strips that have come into it.
   * @returns those strips, as columns from and to and rows from and to
   */
  private shift(dx: number, dz: number): [number, number, number, number][] {
    for (const grid of [this.base, this.lay, this.deep, this.moved]) slide(grid, dx, dz, 1);
    slide(this.inks, dx, dz, 3);
    const strips: [number, number, number, number][] = [];
    if (dx > 0) strips.push([SIDE - dx, SIDE, 0, SIDE]);
    if (dx < 0) strips.push([0, -dx, 0, SIDE]);
    if (dz > 0) strips.push([0, SIDE, SIDE - dz, SIDE]);
    if (dz < 0) strips.push([0, SIDE, 0, -dz]);
    for (const [c0, c1, r0, r1] of strips) this.fill(c0, c1, r0, r1, true);
    return strips;
  }

  /** Ask the world about a part of the field: the ground's height, the snow's depth, and the colour, point by point. */
  private fill(c0: number, c1: number, r0: number, r1: number, fresh = false): void {
    const at = this.at;
    if (!at) return;
    for (let r = r0; r < r1; r++) {
      const z = (at.cz + r) * CELL;
      for (let c = c0; c < c1; c++) {
        const x = (at.cx + c) * CELL;
        const i = r * SIDE + c;
        this.base[i] = this.ground.heightAt(x, z);
        this.lay[i] = this.ground.depthAt(x, z);
        if (fresh) this.moved[i] = 0;
        this.ground.colourAt(x, z, this.tint);
        this.inks[i * 3] = this.tint.r;
        this.inks[i * 3 + 1] = this.tint.g;
        this.inks[i * 3 + 2] = this.tint.b;
      }
    }
  }

  /**
   * How deep the snow lies at each point of a part of the field, for drawing: the depth it
   * lay at, smoothed over a metre and a half. It is no deeper than it lay at the point itself
   * by much: snow does not creep out onto a ploughed road.
   */
  private settle(c0: number, c1: number, r0: number, r1: number): void {
    const last = SIDE - 1;
    for (let r = Math.max(0, r0); r < Math.min(SIDE, r1); r++) {
      for (let c = Math.max(0, c0); c < Math.min(SIDE, c1); c++) {
        let sum = 0;
        for (let dr = -SOFT; dr <= SOFT; dr++) {
          const row = Math.min(last, Math.max(0, r + dr)) * SIDE;
          for (let dc = -SOFT; dc <= SOFT; dc++) sum += this.lay[row + Math.min(last, Math.max(0, c + dc))] as number;
        }
        const i = r * SIDE + c;
        this.deep[i] = Math.min(sum / ((SOFT * 2 + 1) * (SOFT * 2 + 1)), (this.lay[i] as number) + 0.05);
      }
    }
  }

  /** How far above the ground the top of the snow is at a point. */
  private top(i: number): number {
    const deep = this.deep[i] as number;
    const moved = this.moved[i] as number;
    // Swept right away, to leave something lying on the ground uncovered: there is none.
    if (moved <= -deep * 0.99) return 0;
    // Pushed down no further than its packed floor, and heaped up only where there is snow to heap.
    return Math.max(Math.min(deep, FLOOR), deep + Math.max(-deep, moved) * Math.min(1, deep / 0.04));
  }

  /** Work out where each point of a part of the field is, which way the snow faces there and what colour it is. */
  private draw(c0: number, c1: number, r0: number, r1: number): void {
    const at = this.at;
    if (!at) return;
    const last = SIDE - 1;
    for (let r = Math.max(0, r0); r < Math.min(SIDE, r1); r++) {
      // (Two points either side for the snow's own lie, not one: the edge of a tone then runs in a curve and not in the steps of the grid.)
      const ru = Math.max(0, r - 2);
      const rd = Math.min(last, r + 2);
      const wu = Math.max(0, r - WIDE);
      const wd = Math.min(last, r + WIDE);
      for (let c = Math.max(0, c0); c < Math.min(SIDE, c1); c++) {
        const i = r * SIDE + c;
        const k = i * 3;
        this.positions[k] = (at.cx + c) * CELL;
        // Where little or no snow lies (and at the field's edge, where it thins away) the sheet goes down under the ground.
        // And where it has been swept to the ground it goes a little under that too, and does not lie in the ground's own plane.
        const taper = TAPER[i] as number;
        const up = this.top(i) * taper;
        this.positions[k + 1] = (this.base[i] as number) + up - (up < 0.02 ? (0.02 - up) * 4 : 0) - BURY * (1 - smooth(((this.deep[i] as number) * taper) / SHOWN_FROM));
        this.positions[k + 2] = (at.cz + r) * CELL;
        // Which way it faces: the lie of the ground, taken wide as the ground's own shading is, and the lie of the snow on it, taken close.
        const cl = Math.max(0, c - 2);
        const cr = Math.min(last, c + 2);
        const wl = Math.max(0, c - WIDE);
        const wr = Math.min(last, c + WIDE);
        const gx = ((this.base[r * SIDE + wr] as number) - (this.base[r * SIDE + wl] as number)) / ((wr - wl) * CELL) + (this.top(r * SIDE + cr) - this.top(r * SIDE + cl)) / ((cr - cl) * CELL);
        const gz = ((this.base[wd * SIDE + c] as number) - (this.base[wu * SIDE + c] as number)) / ((wd - wu) * CELL) + (this.top(rd * SIDE + c) - this.top(ru * SIDE + c)) / ((rd - ru) * CELL);
        const len = Math.hypot(gx, 1, gz);
        this.normals[k] = -gx / len;
        this.normals[k + 1] = 1 / len;
        this.normals[k + 2] = -gz / len;
        // Down in a trough the snow is in its own shade, bluer and darker the deeper; heaped up, it is a touch brighter.
        const deep = this.deep[i] as number;
        const moved = deep > 0.02 ? Math.max(-deep, this.moved[i] as number) : 0;
        // (Fully in shade at a hand's depth: a trough in the few inches on a groomed trail is to be seen too.)
        const sunk = moved < 0 ? Math.min(1, -moved / 0.16) : 0;
        const heaped = moved > 0 ? 1 + 0.05 * Math.min(1, moved / 0.12) : 1;
        this.colours[k] = (this.inks[k] as number) * (1 - 0.3 * sunk) * heaped;
        this.colours[k + 1] = (this.inks[k + 1] as number) * (1 - 0.22 * sunk) * heaped;
        this.colours[k + 2] = (this.inks[k + 2] as number) * (1 - 0.08 * sunk) * heaped;
      }
    }
  }

  /** Leave something lying on the ground uncovered: the snow dips to it and comes up again all round. */
  private hollow(h: Hollow, mark = false): void {
    this.press(h.x, h.z, h.r * 0.45, h.r, 1, 0, mark);
  }

  /** Things have come to lie on the ground since the field was last moved (a new day's stones, something set down): uncover them. */
  uncover(hollows: readonly Hollow[]): void {
    for (const hollow of hollows) this.hollow(hollow, true);
  }

  /**
   * Push the snow down round a place and heap what was pushed out in a lip round that.
   * @param floor how far out the bottom of the trough reaches, in metres
   * @param wall how far out its sides have come back up to the top of the snow
   * @param down how much of the snow's depth is pushed down, 0..1
   * @param lip how high the lip stands, as a share of how far down the snow was pushed
   * @param mark whether what changed is to be drawn again this frame
   */
  private press(x: number, z: number, floor: number, wall: number, down: number, lip: number, mark = true): void {
    const at = this.at;
    if (!at) return;
    const out = wall + (lip > 0 ? 0.75 : 0);
    const c0 = Math.max(0, Math.floor((x - out) / CELL) - at.cx);
    const c1 = Math.min(SIDE - 1, Math.ceil((x + out) / CELL) - at.cx);
    const r0 = Math.max(0, Math.floor((z - out) / CELL) - at.cz);
    const r1 = Math.min(SIDE - 1, Math.ceil((z + out) / CELL) - at.cz);
    if (c0 > c1 || r0 > r1) return;
    for (let r = r0; r <= r1; r++) {
      for (let c = c0; c <= c1; c++) {
        const i = r * SIDE + c;
        const deep = this.deep[i] as number;
        if (deep <= 0.005 && mark) continue;
        const d = Math.hypot((at.cx + c) * CELL - x, (at.cz + r) * CELL - z);
        if (d < wall) {
          // The trough: flat-bottomed, with sides that come up in a soft curve.
          const want = -deep * down * (1 - smooth((d - floor) / (wall - floor)));
          if (want < (this.moved[i] as number)) this.moved[i] = want;
        } else if (lip > 0 && d < out && (this.moved[i] as number) >= 0) {
          // The lip: what came out of the trough, highest just outside it and falling away. It is never heaped onto a trough already cut.
          const t = (d - wall) / (out - wall);
          const want = deep * down * lip * Math.sin(Math.PI * Math.min(1, t * 1.15)) * (1 - t * 0.35);
          if (want > (this.moved[i] as number)) this.moved[i] = want;
        }
      }
    }
    // (With what looks to it for its lie.)
    if (mark) this.dirty = this.dirty ? [Math.min(this.dirty[0], c0 - 2), Math.max(this.dirty[1], c1 + 3), Math.min(this.dirty[2], r0 - 2), Math.max(this.dirty[3], r1 + 3)] : [c0 - 2, c1 + 3, r0 - 2, r1 + 3];
  }

  /**
   * Somebody is going through the snow. Call every frame with where they are; the trough is
   * cut from where they were last to where they are now.
   * @param half half the width of what is going through, in metres: a pair of skis, wider in a skid; a pair of boots
   * @param lip how much of what is pushed out is heaped at the sides, 0..1
   */
  tread(x: number, z: number, half: number, lip: number): void {
    const from = this.last && Math.hypot(x - this.last.x, z - this.last.z) < 3 ? this.last : { x, z };
    const far = Math.hypot(x - from.x, z - from.z);
    // Often enough along the way that the trough has no beads in it, however fast it is cut.
    const steps = Math.max(1, Math.ceil(far / (CELL * 0.6)));
    for (let s = 1; s <= steps; s++) {
      const t = s / steps;
      this.press(from.x + (x - from.x) * t, from.z + (z - from.z) * t, half, half + 0.42, 0.88, lip);
    }
    this.last = { x, z };
  }

  /** Nobody is in the snow: the next trough does not join up with the last. */
  lift(): void {
    this.last = null;
  }

  /** Send what has changed to be drawn. Call once a frame, after any treading. */
  update(): void {
    const dirty = this.dirty;
    if (!dirty) return;
    this.dirty = null;
    const r0 = Math.max(0, dirty[2]);
    const r1 = Math.min(SIDE, dirty[3]);
    if (r1 <= r0) return;
    this.draw(dirty[0], dirty[1], r0, r1);
    for (const attribute of [this.position, this.normal, this.colour]) {
      attribute.addUpdateRange(r0 * SIDE * 3, (r1 - r0) * SIDE * 3);
      attribute.needsUpdate = true;
    }
  }

  /** The point of the field nearest a place, or -1 if the place is outside it or there is no field. */
  private pointAt(x: number, z: number): number {
    const at = this.at;
    if (!at || !this.mesh.visible) return -1;
    const c = Math.round(x / CELL) - at.cx;
    const r = Math.round(z / CELL) - at.cz;
    return c < 0 || r < 0 || c >= SIDE || r >= SIDE ? -1 : r * SIDE + c;
  }

  /**
   * How far above the ground the top of the snow is at a place, as it is drawn now: for
   * standing things on it. Nothing outside the field, or where there is no snow.
   */
  topAt(x: number, z: number): number {
    const i = this.pointAt(x, z);
    return i < 0 ? 0 : Math.max(0, this.top(i) * (TAPER[i] as number));
  }

  /** How deep the snow lay at a place before anybody went through it, as it is drawn: nothing outside the field. */
  depthAt(x: number, z: number): number {
    const i = this.pointAt(x, z);
    return i < 0 ? 0 : (this.deep[i] as number) * (TAPER[i] as number);
  }
}

/**
 * Slide a square grid's contents by so many cells, so that what was at (c + dx, r + dz) is at
 * (c, r). What slides in from outside is left as it was. `stride` is how many numbers a cell has.
 */
function slide(grid: Float32Array, dx: number, dz: number, stride: number): void {
  const row = SIDE * stride;
  const rows = SIDE - Math.abs(dz);
  for (let n = 0; n < rows; n++) {
    // Downward when the rows move up, upward when they move down, so that none is written over before it is read.
    const r = dz >= 0 ? n : SIDE - 1 - n;
    const from = (r + dz) * row;
    const to = r * row;
    if (dx >= 0) grid.copyWithin(to, from + dx * stride, from + row);
    else grid.copyWithin(to - dx * stride, from, from + row + dx * stride);
  }
}
