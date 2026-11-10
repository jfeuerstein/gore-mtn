import * as THREE from 'three/webgpu';
import type { Look } from '../look/looks';
import type { Heightfield } from './heightfield';

/** Terrain is drawn as square tiles this many cells across. */
export const TILE_CELLS = 96;
/**
 * Detail levels: each tile can be drawn using every 1st, 2nd, 4th or 8th height sample. A level is
 * used out to the distance beside it. The mountain is far too big to hold at full detail, so the
 * finer levels are built for a tile when the camera comes near and dropped when it leaves.
 */
const LEVELS = [
  { step: 1, range: 420 },
  { step: 2, range: 1000 },
  { step: 4, range: 2400 },
  { step: 8, range: Infinity },
] as const;
const COARSEST = LEVELS.length - 1;
/** Depth of the curtain hung from every tile edge to hide gaps where detail levels meet. */
const SKIRT = 12;
/** Tiles built per frame at most, so travelling never causes a stutter. */
const BUILDS_PER_FRAME = 2;
/** A fine level is dropped once the camera is this many times further than its range. */
const KEEP = 1.6;

interface Tile {
  c0: number;
  c1: number;
  r0: number;
  r1: number;
  centerX: number;
  centerZ: number;
  radius: number;
  /** Snow-textured mesh per level, built on demand. */
  snow: (THREE.Mesh | null)[];
  /** Canopy-textured mesh per level, for tiles beyond where trees are drawn. */
  canopy: (THREE.Mesh | null)[];
}

/** Every `step`th index from `from` to `to`, always ending on `to`. */
function steps(from: number, to: number, step: number): number[] {
  const out: number[] = [];
  for (let i = from; i < to; i += step) out.push(i);
  out.push(to);
  return out;
}

function buildTileGeometry(hf: Heightfield, c0: number, c1: number, r0: number, r1: number, step: number): THREE.BufferGeometry {
  const cs = steps(c0, c1, step);
  const rs = steps(r0, r1, step);
  const w = cs.length;
  const h = rs.length;
  const rim = 2 * (w + h) - 4;
  const positions = new Float32Array((w * h + rim) * 3);
  const normals = new Float32Array((w * h + rim) * 3);
  const uvs = new Float32Array((w * h + rim) * 2);
  let v = 0;

  const push = (c: number, r: number, drop: number): void => {
    positions[v * 3] = hf.originX + c * hf.cell;
    positions[v * 3 + 1] = hf.at(c, r) - drop;
    positions[v * 3 + 2] = hf.originZ + r * hf.cell;
    // The normal comes from the heights either side, at this level's spacing, so shading is
    // continuous across tile edges and matches between neighbouring detail levels.
    const run = 2 * step * hf.cell;
    const dx = (hf.at(c + step, r) - hf.at(c - step, r)) / run;
    const dz = (hf.at(c, r + step) - hf.at(c, r - step)) / run;
    const len = Math.hypot(dx, 1, dz);
    normals[v * 3] = -dx / len;
    normals[v * 3 + 1] = 1 / len;
    normals[v * 3 + 2] = -dz / len;
    // The ground textures have one block of texels per height sample, centred on the sample.
    uvs[v * 2] = (c + 0.5) / hf.cols;
    uvs[v * 2 + 1] = 1 - (r + 0.5) / hf.rows;
    v++;
  };

  for (const r of rs) for (const c of cs) push(c, r, 0);

  const index: number[] = [];
  for (let j = 0; j < h - 1; j++) {
    for (let i = 0; i < w - 1; i++) {
      const a = j * w + i;
      const b = a + 1;
      const cc = a + w;
      const d = cc + 1;
      // Split along b-c; Heightfield.heightAt() assumes the same diagonal.
      index.push(a, cc, b, b, cc, d);
    }
  }

  // Skirt: walk the rim, hanging a strip straight down from it.
  const ring: number[] = [];
  for (let i = 0; i < w; i++) ring.push(i);
  for (let j = 1; j < h; j++) ring.push(j * w + (w - 1));
  for (let i = w - 2; i >= 0; i--) ring.push((h - 1) * w + i);
  for (let j = h - 2; j >= 1; j--) ring.push(j * w);
  const base = w * h;
  for (const top of ring) push(cs[top % w] as number, rs[Math.floor(top / w)] as number, SKIRT);
  for (let k = 0; k < ring.length; k++) {
    const next = (k + 1) % ring.length;
    index.push(ring[k] as number, ring[next] as number, base + k, ring[next] as number, base + next, base + k);
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  geo.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
  geo.setIndex(index);
  geo.computeBoundingSphere();
  return geo;
}

/**
 * The ground. Shape comes from the heightfield; colour from two pipeline textures. Up close it is
 * snow: bright on the groomed trails, cooler under the trees. Beyond the distance at which trees
 * are drawn one by one, tiles switch to the canopy texture, which paints the forest as a dark mass
 * with the trails cut through it.
 */
export class Terrain {
  readonly group = new THREE.Group();
  private readonly tiles: Tile[] = [];
  private readonly snowMaterial: THREE.Material;
  private readonly canopyMaterial: THREE.Material;

  constructor(
    private readonly hf: Heightfield,
    snowTexture: THREE.Texture,
    canopyTexture: THREE.Texture,
    look: Look,
  ) {
    this.group.name = 'terrain';
    for (const t of [snowTexture, canopyTexture]) {
      t.colorSpace = THREE.SRGBColorSpace;
      t.anisotropy = 4;
    }
    // Double-sided so the skirts show whichever way they face.
    this.snowMaterial = new THREE.MeshLambertMaterial({
      map: snowTexture,
      color: look.snowTint,
      flatShading: look.facetedGround,
      side: THREE.DoubleSide,
    });
    this.canopyMaterial = new THREE.MeshLambertMaterial({
      map: canopyTexture,
      color: look.canopyTint,
      flatShading: look.facetedGround,
      side: THREE.DoubleSide,
    });

    for (let r0 = 0; r0 < hf.rows - 1; r0 += TILE_CELLS) {
      for (let c0 = 0; c0 < hf.cols - 1; c0 += TILE_CELLS) {
        const c1 = Math.min(c0 + TILE_CELLS, hf.cols - 1);
        const r1 = Math.min(r0 + TILE_CELLS, hf.rows - 1);
        const tile: Tile = { c0, c1, r0, r1, centerX: 0, centerZ: 0, radius: 0, snow: [], canopy: [] };
        // Every tile always has its coarsest level, so there is something to draw at once.
        const mesh = this.mesh(tile, COARSEST, false);
        const sphere = mesh.geometry.boundingSphere as THREE.Sphere;
        tile.centerX = sphere.center.x;
        tile.centerZ = sphere.center.z;
        tile.radius = sphere.radius;
        this.tiles.push(tile);
      }
    }
  }

  /** The mesh for a tile at a level, building it if need be. */
  private mesh(tile: Tile, level: number, canopy: boolean): THREE.Mesh {
    const own = canopy ? tile.canopy : tile.snow;
    const existing = own[level];
    if (existing) return existing;
    // The two textures share one geometry per level.
    const other = (canopy ? tile.snow : tile.canopy)[level];
    const step = (LEVELS[level] as (typeof LEVELS)[number]).step;
    const geometry = other?.geometry ?? buildTileGeometry(this.hf, tile.c0, tile.c1, tile.r0, tile.r1, step);
    const mesh = new THREE.Mesh(geometry, canopy ? this.canopyMaterial : this.snowMaterial);
    mesh.receiveShadow = true;
    mesh.matrixAutoUpdate = false;
    mesh.visible = false;
    this.group.add(mesh);
    own[level] = mesh;
    return mesh;
  }

  private drop(tile: Tile, level: number): void {
    const meshes = [tile.snow[level], tile.canopy[level]];
    for (const mesh of meshes) {
      if (!mesh) continue;
      this.group.remove(mesh);
    }
    (meshes[0] ?? meshes[1])?.geometry.dispose();
    tile.snow[level] = null;
    tile.canopy[level] = null;
  }

  /**
   * Show each tile at the right detail for its distance, or not at all beyond `viewDist`.
   * @param treeRange distance within which the forest is drawn as trees; beyond it, as canopy
   * @param unlimited build everything needed now, for the first frame and after a teleport
   */
  cull(camX: number, camZ: number, viewDist: number, treeRange: number, unlimited = false): void {
    let builds = unlimited ? Infinity : BUILDS_PER_FRAME;
    for (const tile of this.tiles) {
      const dist = Math.max(0, Math.hypot(tile.centerX - camX, tile.centerZ - camZ) - tile.radius);
      let want = 0;
      while (dist >= (LEVELS[want] as (typeof LEVELS)[number]).range) want++;
      const canopy = dist > treeRange;

      // Use the wanted level if it exists or can be built now; otherwise the next coarser one that exists.
      let level = want;
      const own = canopy ? tile.canopy : tile.snow;
      if (!own[level]) {
        if (builds > 0) {
          builds--;
          this.mesh(tile, level, canopy);
        } else {
          while (level < COARSEST && !own[level]) level++;
          if (!own[level]) this.mesh(tile, COARSEST, canopy); // shares the coarsest geometry: cheap
          level = own[level] ? level : COARSEST;
        }
      }

      for (let l = 0; l < LEVELS.length; l++) {
        const snow = tile.snow[l];
        const far = tile.canopy[l];
        if (snow) snow.visible = dist < viewDist && l === level && !canopy;
        if (far) far.visible = dist < viewDist && l === level && canopy;
        // Let go of fine levels the camera has left well behind.
        if (l < COARSEST && (snow || far) && dist > (LEVELS[l] as (typeof LEVELS)[number]).range * KEEP) this.drop(tile, l);
      }
    }
  }
}
