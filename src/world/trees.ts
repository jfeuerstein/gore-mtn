import * as THREE from 'three/webgpu';
import { makeRng } from '../rng';
import type { Heightfield } from './heightfield';
import type { Obstacle } from '../player/collide';
import { blocksSightLine, type Point3 } from './occlusion';
import type { World } from './world';

/** Trees are grouped into square patches this many metres across. */
const PATCH_SIZE = 320;
/**
 * Trees are drawn one by one out to this distance. Beyond it the terrain's canopy texture stands
 * in for the forest. Patches are planted when the camera comes within range and cleared when it
 * leaves, so the whole mountain's forest never has to exist at once.
 */
export const TREE_RANGE = 2600;
/** Patches further than this from the camera are drawn with a five-triangle tree. */
const LOD_DISTANCE = 450;
/** Beyond these distances a patch draws only a share of its trees; they overlap too much to tell. */
const THIN_HALF = 1100;
const THIN_THIRD = 1800;
/** Patches planted per frame at most, so travelling never causes a stutter. */
const PLANTS_PER_FRAME = 2;
/** A patch is cleared once the camera is this many times further than TREE_RANGE. */
const KEEP = 1.2;
/** Trees are this many times the size of the model: about 8 to 15 m tall, as firs are. */
const TREE_SCALE = 2;
const MAX_TREE_SLOPE_DEG = 50;
/** Unscaled size of the tree model. */
const TREE_HEIGHT = 3.6;
const TREE_RADIUS = 1.05;
/** A tree in the way of the camera shrinks to this share of its size, like a sapling. */
const DUCKED = 0.16;
const DUCK_RATE = 9;

export interface TreePatch {
  /** Full tree, for patches near the camera. Its instance matrices are shared with `far`. */
  mesh: THREE.InstancedMesh;
  /** Simple tree, for distant patches. */
  far: THREE.InstancedMesh;
  /** Per tree: x, ground y, z, radius, height. */
  trees: Float32Array;
  /** Full-size instance matrices, to scale from when a tree ducks. */
  base: Float32Array;
  centerX: number;
  centerZ: number;
  radius: number;
}

/** One cone of a tree: a ring of `sides` points at height y0 and radius `radius`, rising to a point at y1. */
export interface TreeTier {
  radius: number;
  y0: number;
  y1: number;
  sides: number;
  /** Colour at the rim and at the tip. */
  base: number;
  tip: number;
}

export interface TreeStyle {
  trunk: number;
  /** Bottom tier first. The model is about 3.6 units tall and 1.05 wide; the game scales it up. */
  tiers: TreeTier[];
  /** The single cone used for distant trees. */
  farBase: number;
  farTip: number;
}

/**
 * The game's fir: three tiers, dark below and snow-laden above. Its colours are neutral so that it
 * takes on the colour of the light: warm at sunrise, blue at dusk, grey in falling snow.
 */
export const FIR: TreeStyle = {
  trunk: 0x3a3436,
  tiers: [
    { radius: 1.0, y0: 0.6, y1: 2.5, sides: 6, base: 0x22383a, tip: 0x5d7a78 },
    { radius: 0.74, y0: 1.7, y1: 3.1, sides: 6, base: 0x2b4646, tip: 0xdfe8ea },
    { radius: 0.46, y0: 2.6, y1: 3.6, sides: 5, base: 0x8fa6a6, tip: 0xf4f7fa },
  ],
  farBase: 0x30494a,
  farTip: 0xcfdadc,
};

/**
 * The same tree with no colour of its own, pale at the tips and darker in its depths. Out of
 * winter each tree is given a colour (a fir's green, a maple's red) that this shades.
 */
export const PLAIN_TREE: TreeStyle = {
  trunk: 0x5a4a40,
  tiers: [
    { radius: 1.0, y0: 0.6, y1: 2.5, sides: 6, base: 0x787878, tip: 0xd6d6d6 },
    { radius: 0.74, y0: 1.7, y1: 3.1, sides: 6, base: 0x8c8c8c, tip: 0xececec },
    { radius: 0.46, y0: 2.6, y1: 3.6, sides: 5, base: 0xa4a4a4, tip: 0xffffff },
  ],
  farBase: 0x8a8a8a,
  farTip: 0xf2f2f2,
};

/** How one tree is dressed: a colour, and how wide and tall it stands against the plain tree. */
export interface TreeDress {
  colour: number;
  wide: number;
  tall: number;
}

/** A tree: a square trunk and a stack of cones, each shaded from rim to tip. */
export function buildTreeGeometry(style: TreeStyle): THREE.BufferGeometry {
  const pos: number[] = [];
  const col: number[] = [];
  const trunk = new THREE.Color(style.trunk);

  const tri = (a: number[], b: number[], c: number[], ca: THREE.Color, cb: THREE.Color, cc: THREE.Color) => {
    pos.push(...a, ...b, ...c);
    col.push(ca.r, ca.g, ca.b, cb.r, cb.g, cb.b, cc.r, cc.g, cc.b);
  };
  const ring = (n: number, radius: number, y: number, twist: number): number[][] =>
    Array.from({ length: n }, (_, i) => {
      const a = twist + (i / n) * Math.PI * 2;
      return [Math.cos(a) * radius, y, Math.sin(a) * radius];
    });

  const lo = ring(4, 0.13, 0, 0);
  const hi = ring(4, 0.11, 0.9, 0);
  for (let i = 0; i < 4; i++) {
    const j = (i + 1) % 4;
    tri(lo[i] as number[], hi[i] as number[], lo[j] as number[], trunk, trunk, trunk);
    tri(lo[j] as number[], hi[i] as number[], hi[j] as number[], trunk, trunk, trunk);
  }
  style.tiers.forEach((tier, t) => {
    const base = new THREE.Color(tier.base);
    const tip = new THREE.Color(tier.tip);
    // Each tier is turned a little from the one below, so their corners do not line up.
    const r = ring(tier.sides, tier.radius, tier.y0, (t * Math.PI) / tier.sides);
    for (let i = 0; i < tier.sides; i++) tri(r[i] as number[], [0, tier.y1, 0], r[(i + 1) % tier.sides] as number[], base, tip, base);
  });

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  geo.computeVertexNormals();
  return geo;
}

/** A distant tree: one five-sided cone. 5 triangles. */
export function buildFarTreeGeometry(style: TreeStyle): THREE.BufferGeometry {
  const base = new THREE.Color(style.farBase);
  const tip = new THREE.Color(style.farTip);
  const pos: number[] = [];
  const col: number[] = [];
  for (let i = 0; i < 5; i++) {
    const a0 = (i / 5) * Math.PI * 2;
    const a1 = ((i + 1) / 5) * Math.PI * 2;
    pos.push(Math.cos(a0) * TREE_RADIUS, 0.4, Math.sin(a0) * TREE_RADIUS, 0, TREE_HEIGHT, 0, Math.cos(a1) * TREE_RADIUS, 0.4, Math.sin(a1) * TREE_RADIUS);
    col.push(base.r, base.g, base.b, tip.r, tip.g, tip.b, base.r, base.g, base.b);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  geo.computeVertexNormals();
  return geo;
}

/**
 * How readily trees grow at a distance from the nearest groomed trail, 0..1.
 * Nothing grows on a trail or within a few metres of its edge. Just beyond that the forest
 * is at its thickest, so each trail reads as a corridor cut through the trees. Deeper in, it thins
 * to an open wood.
 */
export function treeDensity(distanceToTrail: number): number {
  const CLEAR = 5;
  const WALL_END = 30;
  const DEEP = 65;
  const DEEP_DENSITY = 0.42;
  if (distanceToTrail < CLEAR) return 0;
  if (distanceToTrail <= WALL_END) return 1;
  if (distanceToTrail >= DEEP) return DEEP_DENSITY;
  return 1 - ((distanceToTrail - WALL_END) / (DEEP - WALL_END)) * (1 - DEEP_DENSITY);
}

/**
 * The forest. It plants itself around the camera a patch at a time, and keeps the player in view:
 * any tree standing between the camera and the player shrinks to a sapling and grows back once it
 * is out of the way.
 */
export class Forest {
  readonly group = new THREE.Group();
  /** Trees currently planted. */
  count = 0;
  private readonly patches = new Map<number, TreePatch>();
  private readonly cols: number;
  private readonly rows: number;
  private readonly spacing: number;
  private readonly geometry: THREE.BufferGeometry;
  private readonly farGeometry: THREE.BufferGeometry;
  private readonly material = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });
  /** Ducked trees: patch key * 65536 + slot, to present scale. */
  private readonly ducked = new Map<number, number>();
  private readonly blocking = new Set<number>();

  /**
   * @param target roughly how many trees the whole mountain would hold if all of it were planted
   */
  constructor(
    private readonly hf: Heightfield,
    private readonly world: World,
    target: number,
    private readonly castShadow: boolean,
    /** Places kept clear of trees besides the trails, such as lift lines. */
    private readonly keepClear: (x: number, z: number) => boolean = () => false,
    /**
     * How to dress the tree at a place, from two rolls in 0..1; or null to leave every tree the
     * snowy fir. Trees stand in the same places whichever is used.
     */
    private readonly dress: ((x: number, z: number, kindRoll: number, pickRoll: number) => TreeDress | null) | null = null,
    style: TreeStyle = dress ? PLAIN_TREE : FIR,
  ) {
    this.group.name = 'trees';
    this.geometry = buildTreeGeometry(style);
    this.farGeometry = buildFarTreeGeometry(style);
    this.cols = Math.ceil(hf.width / PATCH_SIZE);
    this.rows = Math.ceil(hf.depth / PATCH_SIZE);
    if (target <= 0) {
      this.spacing = 0;
      return;
    }
    // Candidate spots are laid on a jittered grid and each is kept with a chance equal to the local
    // density. Estimate the average density, then pick the grid spacing that lands near the target.
    const probe = makeRng(7);
    let sum = 0;
    const PROBES = 8000;
    for (let i = 0; i < PROBES; i++) sum += this.densityAt(hf.minX + probe() * hf.width, hf.minZ + probe() * hf.depth);
    this.spacing = Math.sqrt((hf.width * hf.depth * Math.max(0.02, sum / PROBES)) / target);
  }

  private densityAt(x: number, z: number): number {
    return this.hf.slopeDegAt(x, z) < MAX_TREE_SLOPE_DEG ? treeDensity(this.world.trailDistance(x, z)) : 0;
  }

  /** Plant one patch. Seeded by its position, so a patch is the same every time it is planted. */
  private plant(col: number, row: number): TreePatch | null {
    const hf = this.hf;
    const x0 = hf.minX + col * PATCH_SIZE;
    const z0 = hf.minZ + row * PATCH_SIZE;
    const x1 = Math.min(x0 + PATCH_SIZE, hf.maxX);
    const z1 = Math.min(z0 + PATCH_SIZE, hf.maxZ);
    const rng = makeRng(1934 + col * 7919 + row * 104729);
    // Rolls for a tree's dress come from their own sequence, so dressing trees does not move them.
    const dressRng = makeRng(2026 + col * 104729 + row * 7919);
    const spots: { x: number; y: number; z: number; scale: number; scaleY: number; turn: number; colour: number }[] = [];
    for (let z = z0; z < z1; z += this.spacing) {
      for (let x = x0; x < x1; x += this.spacing) {
        const tx = x + rng() * this.spacing;
        const tz = z + rng() * this.spacing;
        const scale = (1.1 + rng() * 0.9) * TREE_SCALE;
        const scaleY = scale * (0.9 + rng() * 0.3);
        const turn = rng() * Math.PI * 2;
        const chance = rng();
        if (tx >= x1 || tz >= z1 || chance >= this.densityAt(tx, tz) || this.keepClear(tx, tz)) continue;
        const dress = this.dress?.(tx, tz, dressRng(), dressRng()) ?? null;
        spots.push({
          x: tx,
          y: hf.heightAt(tx, tz) - 0.2,
          z: tz,
          scale: scale * (dress?.wide ?? 1),
          scaleY: scaleY * (dress?.tall ?? 1),
          turn,
          colour: dress?.colour ?? 0xffffff,
        });
      }
    }
    if (spots.length === 0) return null;
    // Shuffle, so that drawing only the first part of a patch thins it evenly.
    for (let i = spots.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      const t = spots[i] as (typeof spots)[number];
      spots[i] = spots[j] as (typeof spots)[number];
      spots[j] = t;
    }

    const mesh = new THREE.InstancedMesh(this.geometry, this.material, spots.length);
    const trees = new Float32Array(spots.length * 5);
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const up = new THREE.Vector3(0, 1, 0);
    const p = new THREE.Vector3();
    const s = new THREE.Vector3();
    const tint = new THREE.Color();
    spots.forEach((t, i) => {
      mesh.setMatrixAt(i, m.compose(p.set(t.x, t.y, t.z), q.setFromAxisAngle(up, t.turn), s.set(t.scale, t.scaleY, t.scale)));
      trees.set([t.x, t.y, t.z, TREE_RADIUS * t.scale, TREE_HEIGHT * t.scaleY], i * 5);
      if (this.dress) mesh.setColorAt(i, tint.setHex(t.colour));
    });
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingSphere();
    mesh.castShadow = this.castShadow;
    mesh.matrixAutoUpdate = false;
    // The distant version draws the same trees from the same matrices, and casts no shadow.
    const far = new THREE.InstancedMesh(this.farGeometry, this.material, spots.length);
    far.instanceMatrix = mesh.instanceMatrix;
    far.instanceColor = mesh.instanceColor;
    far.boundingSphere = mesh.boundingSphere;
    far.matrixAutoUpdate = false;
    const sphere = mesh.boundingSphere as THREE.Sphere;
    this.group.add(mesh, far);
    this.count += spots.length;
    return {
      mesh,
      far,
      trees,
      base: Float32Array.from(mesh.instanceMatrix.array),
      centerX: sphere.center.x,
      centerZ: sphere.center.z,
      radius: sphere.radius,
    };
  }

  private clear(key: number, patch: TreePatch): void {
    this.group.remove(patch.mesh, patch.far);
    patch.mesh.dispose();
    patch.far.dispose();
    this.count -= patch.mesh.count;
    this.patches.delete(key);
    for (const id of this.ducked.keys()) if (Math.floor(id / 65536) === key) this.ducked.delete(id);
  }

  /**
   * Plant patches that have come into range, clear ones left behind, and show each at the right
   * detail for its distance.
   * @param unlimited plant everything in range now, for the first frame and after a teleport
   */
  cull(camX: number, camZ: number, viewDist: number, unlimited = false): void {
    if (this.spacing === 0) return;
    const range = Math.min(viewDist, TREE_RANGE);
    const hf = this.hf;

    // Plant: nearest missing patches first.
    const c0 = Math.max(0, Math.floor((camX - range - hf.minX) / PATCH_SIZE));
    const c1 = Math.min(this.cols - 1, Math.floor((camX + range - hf.minX) / PATCH_SIZE));
    const r0 = Math.max(0, Math.floor((camZ - range - hf.minZ) / PATCH_SIZE));
    const r1 = Math.min(this.rows - 1, Math.floor((camZ + range - hf.minZ) / PATCH_SIZE));
    const missing: { col: number; row: number; dist: number }[] = [];
    for (let row = r0; row <= r1; row++) {
      for (let col = c0; col <= c1; col++) {
        if (this.patches.has(row * this.cols + col)) continue;
        const dist = Math.hypot(hf.minX + (col + 0.5) * PATCH_SIZE - camX, hf.minZ + (row + 0.5) * PATCH_SIZE - camZ);
        if (dist < range + PATCH_SIZE * 0.7) missing.push({ col, row, dist });
      }
    }
    if (missing.length > 0) {
      missing.sort((a, b) => a.dist - b.dist);
      let planted = 0;
      for (const { col, row } of missing) {
        if (!unlimited && planted >= PLANTS_PER_FRAME) break;
        const patch = this.plant(col, row);
        // An empty patch (all trail, or all cliff) is remembered too, so it is not tried again.
        this.patches.set(row * this.cols + col, patch ?? EMPTY);
        planted++;
      }
    }

    for (const [key, p] of this.patches) {
      if (p === EMPTY) continue;
      const dist = Math.hypot(p.centerX - camX, p.centerZ - camZ) - p.radius;
      if (dist > range * KEEP) {
        this.clear(key, p);
        continue;
      }
      const shown = dist < range;
      p.mesh.visible = shown && dist < LOD_DISTANCE;
      p.far.visible = shown && !p.mesh.visible;
      // Trees within a patch are in shuffled order, so the first n are an even sample of it.
      const share = dist < THIN_HALF ? 1 : dist < THIN_THIRD ? 0.5 : 1 / 3;
      p.far.count = Math.max(1, Math.round(p.mesh.count * share));
    }
  }

  /**
   * The tree whose trunk a circle at (x, z) overlaps most deeply, if any. Only the trunk and the
   * thick of the lower branches count: the skier can brush under the outer boughs.
   */
  trunkAt(x: number, z: number, radius: number): Obstacle | null {
    let best: Obstacle | null = null;
    let bestGap = 0;
    const reach = radius + MAX_TRUNK;
    for (const p of this.patches.values()) {
      if (p === EMPTY) continue;
      if (Math.hypot(p.centerX - x, p.centerZ - z) > p.radius + reach) continue;
      const t = p.trees;
      for (let i = 0; i < p.mesh.count; i++) {
        const o = i * 5;
        const dx = (t[o] as number) - x;
        if (dx > reach || dx < -reach) continue;
        const dz = (t[o + 2] as number) - z;
        if (dz > reach || dz < -reach) continue;
        const trunk = trunkRadius(t[o + 3] as number);
        const gap = Math.hypot(dx, dz) - trunk - radius;
        if (gap < bestGap) {
          bestGap = gap;
          best = { x: t[o] as number, z: t[o + 2] as number, radius: trunk };
        }
      }
    }
    return best;
  }

  /** Shrink trees that hide the player from the camera, and regrow the ones that no longer do. */
  update(player: Point3, camera: Point3, dt: number): void {
    const blocking = this.blocking;
    blocking.clear();
    // Look at the player's chest, and a little wider than the tree so there is clear air around them.
    const chest = { x: player.x, y: player.y + 1, z: player.z };
    const tree = { x: 0, y: 0, z: 0 };
    const reach = 12;
    const minX = Math.min(player.x, camera.x) - reach;
    const maxX = Math.max(player.x, camera.x) + reach;
    const minZ = Math.min(player.z, camera.z) - reach;
    const maxZ = Math.max(player.z, camera.z) + reach;
    for (const [key, p] of this.patches) {
      if (p === EMPTY) continue;
      // Only patches that overlap the stretch between the camera and the player can matter.
      if (p.centerX + p.radius < minX || p.centerX - p.radius > maxX || p.centerZ + p.radius < minZ || p.centerZ - p.radius > maxZ) continue;
      const t = p.trees;
      for (let i = 0; i < p.mesh.count; i++) {
        const o = i * 5;
        tree.x = t[o] as number;
        tree.z = t[o + 2] as number;
        if (tree.x < minX || tree.x > maxX || tree.z < minZ || tree.z > maxZ) continue;
        tree.y = t[o + 1] as number;
        if (blocksSightLine(chest, camera, tree, (t[o + 3] as number) + 0.9, t[o + 4] as number)) blocking.add(key * 65536 + i);
      }
    }
    for (const id of blocking) if (!this.ducked.has(id)) this.ducked.set(id, 1);

    const ease = Math.min(1, DUCK_RATE * dt);
    for (const [id, scale] of this.ducked) {
      const patch = this.patches.get(Math.floor(id / 65536));
      if (!patch || patch === EMPTY) {
        this.ducked.delete(id);
        continue;
      }
      const target = blocking.has(id) ? DUCKED : 1;
      let next = scale + (target - scale) * ease;
      if (target === 1 && next > 0.995) next = 1;
      const o = (id % 65536) * 16;
      const out = patch.mesh.instanceMatrix.array;
      // The first three columns hold rotation and scale; the fourth, the position, stays put.
      for (let k = 0; k < 12; k++) out[o + k] = (patch.base[o + k] as number) * next;
      patch.mesh.instanceMatrix.needsUpdate = true;
      if (next === 1) this.ducked.delete(id);
      else this.ducked.set(id, next);
    }
  }
}

const MAX_TRUNK = 1.2;
/** The part of a tree that stops a skier, from the radius of its lowest boughs. */
export function trunkRadius(treeRadius: number): number {
  return Math.min(MAX_TRUNK, Math.max(0.5, treeRadius * 0.28));
}

/** Stands for a patch that was planted and found to hold no trees. */
const EMPTY = {} as TreePatch;
