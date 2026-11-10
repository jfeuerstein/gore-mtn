import * as THREE from 'three/webgpu';
import { makeRng } from '../rng';
import type { Heightfield } from './heightfield';
import { blocksSightLine, type Point3 } from './occlusion';
import type { World } from './world';

/** Trees are grouped into square patches this many metres across so far patches can be skipped. */
const PATCH_SIZE = 128;
const MAX_TREE_SLOPE_DEG = 50;
/** Unscaled size of the tree model. */
const TREE_HEIGHT = 3.6;
const TREE_RADIUS = 1.05;
/** Trees are indexed on a grid this many metres across for sight-line lookups. */
const CELL = 8;
/** A tree in the way of the camera shrinks to this share of its size, like a sapling. */
const DUCKED = 0.16;
const DUCK_RATE = 9;

export interface TreePatch {
  mesh: THREE.InstancedMesh;
  centerX: number;
  centerZ: number;
  radius: number;
}

/** A snow-dusted fir: a square trunk and two stacked six-sided cones. 20 triangles. */
export function buildTreeGeometry(): THREE.BufferGeometry {
  const pos: number[] = [];
  const col: number[] = [];
  const trunk = new THREE.Color(0x4a3b33);
  const dark = new THREE.Color(0x24463a);
  const mid = new THREE.Color(0x2f5a48);
  const snow = new THREE.Color(0xb9d0c8);

  const tri = (a: number[], b: number[], c: number[], ca: THREE.Color, cb: THREE.Color, cc: THREE.Color) => {
    pos.push(...a, ...b, ...c);
    col.push(ca.r, ca.g, ca.b, cb.r, cb.g, cb.b, cc.r, cc.g, cc.b);
  };
  const ring = (n: number, radius: number, y: number, twist: number): number[][] =>
    Array.from({ length: n }, (_, i) => {
      const a = twist + (i / n) * Math.PI * 2;
      return [Math.cos(a) * radius, y, Math.sin(a) * radius];
    });
  const cone = (radius: number, y0: number, y1: number, twist: number, base: THREE.Color, tip: THREE.Color) => {
    const r = ring(6, radius, y0, twist);
    for (let i = 0; i < 6; i++) tri(r[i] as number[], [0, y1, 0], r[(i + 1) % 6] as number[], base, tip, base);
  };

  const lo = ring(4, 0.13, 0, 0);
  const hi = ring(4, 0.11, 0.9, 0);
  for (let i = 0; i < 4; i++) {
    const j = (i + 1) % 4;
    tri(lo[i] as number[], hi[i] as number[], lo[j] as number[], trunk, trunk, trunk);
    tri(lo[j] as number[], hi[i] as number[], hi[j] as number[], trunk, trunk, trunk);
  }
  cone(TREE_RADIUS, 0.7, 2.6, 0, dark, mid);
  cone(0.75, 1.9, TREE_HEIGHT, Math.PI / 6, mid, snow);

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  geo.computeVertexNormals();
  return geo;
}

interface Tree extends Point3 {
  patch: number;
  /** Index of this tree within its patch's instanced mesh. */
  slot: number;
  radius: number;
  height: number;
}

/**
 * The forest. Besides drawing the trees, it keeps the player in view: any tree standing between
 * the camera and the player shrinks to a sapling and grows back once it is out of the way.
 */
export class Forest {
  readonly group = new THREE.Group();
  readonly patches: TreePatch[] = [];
  count = 0;
  private readonly trees: Tree[] = [];
  /** Tree indices by grid cell. */
  private readonly cells = new Map<number, number[]>();
  /** Full-size instance matrices for each patch, to scale from. */
  private readonly base: Float32Array[] = [];
  /** Trees currently smaller than full size: tree index to its present scale. */
  private readonly ducked = new Map<number, number>();
  private readonly blocking = new Set<number>();

  private cellKey(x: number, z: number): number {
    return Math.floor(x / CELL) * 100003 + Math.floor(z / CELL);
  }

  /** Record a tree. Call finishPatch() once all the trees of a patch are added. */
  add(patch: number, slot: number, x: number, y: number, z: number, scale: number, scaleY: number): void {
    const index = this.trees.length;
    this.trees.push({ patch, slot, x, y, z, radius: TREE_RADIUS * scale, height: TREE_HEIGHT * scaleY });
    const key = this.cellKey(x, z);
    const cell = this.cells.get(key);
    if (cell) cell.push(index);
    else this.cells.set(key, [index]);
  }

  finishPatch(patch: TreePatch): void {
    this.patches.push(patch);
    this.base.push(Float32Array.from(patch.mesh.instanceMatrix.array));
    this.group.add(patch.mesh);
    this.count += patch.mesh.count;
  }

  /** Shrink trees that hide the player from the camera, and regrow the ones that no longer do. */
  update(player: Point3, camera: Point3, dt: number): void {
    const blocking = this.blocking;
    blocking.clear();
    // Look at the player's chest, and a little wider than the tree so there is clear air around them.
    const chest = { x: player.x, y: player.y + 1, z: player.z };
    const pad = 4;
    const x0 = Math.floor((Math.min(player.x, camera.x) - pad) / CELL);
    const x1 = Math.floor((Math.max(player.x, camera.x) + pad) / CELL);
    const z0 = Math.floor((Math.min(player.z, camera.z) - pad) / CELL);
    const z1 = Math.floor((Math.max(player.z, camera.z) + pad) / CELL);
    for (let cx = x0; cx <= x1; cx++) {
      for (let cz = z0; cz <= z1; cz++) {
        const cell = this.cells.get(cx * 100003 + cz);
        if (!cell) continue;
        for (const i of cell) {
          const t = this.trees[i] as Tree;
          if (blocksSightLine(chest, camera, t, t.radius + 0.9, t.height)) blocking.add(i);
        }
      }
    }
    for (const i of blocking) if (!this.ducked.has(i)) this.ducked.set(i, 1);

    const ease = Math.min(1, DUCK_RATE * dt);
    for (const [i, scale] of this.ducked) {
      const target = blocking.has(i) ? DUCKED : 1;
      let next = scale + (target - scale) * ease;
      if (target === 1 && next > 0.995) next = 1;
      this.setScale(this.trees[i] as Tree, next);
      if (next === 1) this.ducked.delete(i);
      else this.ducked.set(i, next);
    }
  }

  private setScale(tree: Tree, scale: number): void {
    const mesh = (this.patches[tree.patch] as TreePatch).mesh;
    const base = this.base[tree.patch] as Float32Array;
    const out = mesh.instanceMatrix.array;
    const o = tree.slot * 16;
    // The first three columns hold rotation and scale; the fourth, the position, stays put.
    for (let k = 0; k < 12; k++) out[o + k] = (base[o + k] as number) * scale;
    mesh.instanceMatrix.needsUpdate = true;
  }
}

/**
 * Scatter about `target` trees over every part of the mountain that is not a groomed trail and
 * not too steep. Placement is seeded, so the forest is identical on every load.
 */
export function buildTrees(hf: Heightfield, world: World, target: number, castShadow: boolean): Forest {
  const forest = new Forest();
  forest.group.name = 'trees';
  if (target <= 0) return forest;

  const growsAt = (x: number, z: number) => !world.onTrail(x, z) && hf.slopeDegAt(x, z) < MAX_TREE_SLOPE_DEG;

  // Estimate how much of the map can hold trees, then pick the spacing that lands near the target.
  const probe = makeRng(7);
  let ok = 0;
  const PROBES = 4000;
  for (let i = 0; i < PROBES; i++) {
    if (growsAt(hf.minX + probe() * hf.width, hf.minZ + probe() * hf.depth)) ok++;
  }
  const growable = Math.max(0.05, ok / PROBES);
  const spacing = Math.sqrt((hf.width * hf.depth * growable) / target);

  const geometry = buildTreeGeometry();
  const material = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });
  const rng = makeRng(1934);
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const up = new THREE.Vector3(0, 1, 0);
  const p = new THREE.Vector3();
  const s = new THREE.Vector3();

  for (let z0 = hf.minZ; z0 < hf.maxZ; z0 += PATCH_SIZE) {
    for (let x0 = hf.minX; x0 < hf.maxX; x0 += PATCH_SIZE) {
      const x1 = Math.min(x0 + PATCH_SIZE, hf.maxX);
      const z1 = Math.min(z0 + PATCH_SIZE, hf.maxZ);
      const placed: { matrix: THREE.Matrix4; x: number; y: number; z: number; scale: number; scaleY: number }[] = [];
      for (let z = z0; z < z1; z += spacing) {
        for (let x = x0; x < x1; x += spacing) {
          const tx = x + rng() * spacing;
          const tz = z + rng() * spacing;
          const scale = 1.1 + rng() * 0.9;
          const turn = rng() * Math.PI * 2;
          if (tx >= x1 || tz >= z1 || !growsAt(tx, tz)) continue;
          const scaleY = scale * (0.9 + rng() * 0.3);
          p.set(tx, hf.heightAt(tx, tz) - 0.1, tz);
          q.setFromAxisAngle(up, turn);
          s.set(scale, scaleY, scale);
          placed.push({ matrix: m.compose(p, q, s).clone(), x: tx, y: p.y, z: tz, scale, scaleY });
        }
      }
      if (placed.length === 0) continue;
      const mesh = new THREE.InstancedMesh(geometry, material, placed.length);
      const patchIndex = forest.patches.length;
      placed.forEach((t, i) => {
        mesh.setMatrixAt(i, t.matrix);
        forest.add(patchIndex, i, t.x, t.y, t.z, t.scale, t.scaleY);
      });
      mesh.instanceMatrix.needsUpdate = true;
      mesh.computeBoundingSphere();
      mesh.castShadow = castShadow;
      mesh.matrixAutoUpdate = false;
      const sphere = mesh.boundingSphere as THREE.Sphere;
      forest.finishPatch({ mesh, centerX: sphere.center.x, centerZ: sphere.center.z, radius: sphere.radius });
    }
  }
  return forest;
}
