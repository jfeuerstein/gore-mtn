import * as THREE from 'three/webgpu';
import type { Heightfield } from './heightfield';
import { lit } from '../look/material';
import { soften, weigh, type Piece, type Weights } from '../look/worldLook';
import type { GroundLook, GroundTile } from './groundMaterial';

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
  /** What `cull` last decided for it: the level to show (-1 for none), and in which texture. */
  shownLevel: number;
  shownCanopy: boolean;
  /** A sharper picture of this tile's own ground, for when the camera is on it or beside it. */
  close: Close | null;
}

/** A tile's ground as it is drawn near the camera: from the weights of its inks, and not from a picture. */
interface Close {
  /** The tile's piece of the printed picture, with its inks weighed pixel by pixel. Let go once the weights are whole. */
  piece: Piece | null;
  /** The weights at the tile's own grid of points, as they are filled in. */
  weights: Weights | null;
  /** Rows of points weighed so far: it is done a few at a time. */
  done: number;
  /** What draws it, once the weights are whole. */
  drawn: GroundTile | null;
}

/** The printed picture of the ground, as bytes, for weighing parts of. */
export interface Print {
  data: Uint8ClampedArray;
  width: number;
  height: number;
  /** Every ink in it, the commonest first. */
  order: readonly number[];
}

/**
 * A tile is drawn from the weights of its inks while the camera is within this of it, and
 * until it is this far, in metres. The camera looks a long way down a trail, so this reaches
 * well ahead: the tile the camera is over and those round it, about nine at once, a little
 * over a megabyte each.
 */
const CLOSE_RANGE = 260;
const CLOSE_KEEP = 380;
/** Points weighed for every pixel of the printed picture, each way. */
const CLOSE_POINTS = 2;
/** How many points of the tiles' weights are filled in a frame. */
const CLOSE_BUDGET = 40000;
/** What weighing a tile's piece of the picture pixel by pixel counts for, against that. */
const SOFTEN_COST = 30000;

/**
 * A square of tiles that is drawn as one mesh while every tile in it is far enough off to be at
 * its coarsest. Most of the mountain is that far from wherever the camera is, so this is what
 * keeps a view of the whole of it from costing a draw call for every tile.
 */
interface Block {
  tiles: Tile[];
  /** All the tiles' coarsest geometry joined, made the first time it is wanted. */
  geometry: THREE.BufferGeometry | null;
  snow: THREE.Mesh | null;
  canopy: THREE.Mesh | null;
}

/** Tiles along each side of a block. */
const BLOCK_TILES = 3;

/** Several tile geometries as one: the same triangles, in one buffer. */
function joinGeometries(parts: readonly THREE.BufferGeometry[]): THREE.BufferGeometry {
  let count = 0;
  let indices = 0;
  for (const part of parts) {
    count += part.getAttribute('position').count;
    indices += part.getIndex()?.count ?? 0;
  }
  const positions = new Float32Array(count * 3);
  const normals = new Float32Array(count * 3);
  const uvs = new Float32Array(count * 2);
  const index: number[] = new Array<number>(indices);
  let v = 0;
  let k = 0;
  for (const part of parts) {
    positions.set(part.getAttribute('position').array as Float32Array, v * 3);
    normals.set(part.getAttribute('normal').array as Float32Array, v * 3);
    uvs.set(part.getAttribute('uv').array as Float32Array, v * 2);
    const own = part.getIndex();
    if (own) for (let i = 0; i < own.count; i++) index[k++] = own.getX(i) + v;
    v += part.getAttribute('position').count;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  geo.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
  geo.setIndex(index);
  geo.computeBoundingSphere();
  return geo;
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
  private readonly blocks: Block[] = [];
  private readonly snowMaterial: THREE.MeshLambertMaterial;
  private readonly canopyMaterial: THREE.MeshLambertMaterial;

  /**
   * @param print the printed picture of the ground as bytes, and `look` how it is drawn from them, if the ground is to be kept sharp up close
   */
  constructor(
    private readonly hf: Heightfield,
    snowTexture: THREE.Texture,
    canopyTexture: THREE.Texture,
    private readonly print: Print | null = null,
    private readonly look: GroundLook | null = null,
  ) {
    this.group.name = 'terrain';
    for (const t of [snowTexture, canopyTexture]) {
      t.colorSpace = THREE.SRGBColorSpace;
      t.anisotropy = 4;
    }
    // Double-sided so the skirts show whichever way they face.
    this.snowMaterial = lit({ map: snowTexture, side: THREE.DoubleSide });
    this.canopyMaterial = lit({ map: canopyTexture, side: THREE.DoubleSide });

    for (let r0 = 0; r0 < hf.rows - 1; r0 += TILE_CELLS) {
      for (let c0 = 0; c0 < hf.cols - 1; c0 += TILE_CELLS) {
        const c1 = Math.min(c0 + TILE_CELLS, hf.cols - 1);
        const r1 = Math.min(r0 + TILE_CELLS, hf.rows - 1);
        const tile: Tile = { c0, c1, r0, r1, centerX: 0, centerZ: 0, radius: 0, snow: [], canopy: [], shownLevel: -1, shownCanopy: false, close: null };
        // Every tile always has its coarsest level, so there is something to draw at once.
        const mesh = this.mesh(tile, COARSEST, false);
        const sphere = mesh.geometry.boundingSphere as THREE.Sphere;
        tile.centerX = sphere.center.x;
        tile.centerZ = sphere.center.z;
        tile.radius = sphere.radius;
        this.tiles.push(tile);
        // Its block: the square of tiles it is joined with when all of them are far away.
        const across = Math.ceil(Math.ceil((hf.cols - 1) / TILE_CELLS) / BLOCK_TILES);
        const b = Math.floor(r0 / TILE_CELLS / BLOCK_TILES) * across + Math.floor(c0 / TILE_CELLS / BLOCK_TILES);
        (this.blocks[b] ??= { tiles: [], geometry: null, snow: null, canopy: null }).tiles.push(tile);
      }
    }
  }

  /** The mesh that draws a whole block in one texture, made the first time it is wanted. */
  private blockMesh(block: Block, canopy: boolean): THREE.Mesh {
    const existing = canopy ? block.canopy : block.snow;
    if (existing) return existing;
    // Every tile keeps its coarsest geometry for good, so there is always something to join.
    block.geometry ??= joinGeometries(block.tiles.map((t) => (t.snow[COARSEST] ?? t.canopy[COARSEST])?.geometry).filter((g): g is THREE.BufferGeometry => g !== undefined));
    const mesh = new THREE.Mesh(block.geometry, canopy ? this.canopyMaterial : this.snowMaterial);
    mesh.receiveShadow = true;
    mesh.matrixAutoUpdate = false;
    mesh.visible = false;
    this.group.add(mesh);
    if (canopy) block.canopy = mesh;
    else block.snow = mesh;
    return mesh;
  }

  /** Tint the snow and the distant forest, for the time of day and the weather. */
  setTints(snow: number, canopy: number): void {
    this.snowMaterial.color.setHex(snow);
    this.canopyMaterial.color.setHex(canopy);
    this.look?.setTint(snow);
  }

  /**
   * See to the ground near the camera: begin weighing the inks of a tile the camera has come
   * to, weigh a few more rows of one that is in hand, and let go of those left behind.
   * @param all finish whatever is wanted now, for the first frame and after a teleport
   */
  private sharpen(camX: number, camZ: number, all: boolean): void {
    const { print, look, hf } = this;
    if (!print || !look) return;
    let budget = all ? Infinity : CLOSE_BUDGET;
    for (const tile of this.tiles) {
      // How far the camera is from the tile's own square of ground.
      const x0 = hf.originX + tile.c0 * hf.cell;
      const x1 = hf.originX + tile.c1 * hf.cell;
      const z0 = hf.originZ + tile.r0 * hf.cell;
      const z1 = hf.originZ + tile.r1 * hf.cell;
      const away = Math.hypot(Math.max(x0 - camX, 0, camX - x1), Math.max(z0 - camZ, 0, camZ - z1));
      if (!tile.close) {
        if (away > CLOSE_RANGE) continue;
        tile.close = { piece: null, weights: null, done: 0, drawn: null };
      } else if (away > CLOSE_KEEP) {
        const mesh = tile.snow[0];
        if (mesh) mesh.material = this.snowMaterial;
        tile.close.drawn?.dispose();
        tile.close = null;
        continue;
      }
      const close = tile.close;
      if (close.drawn || budget <= 0) continue;
      // The part of the printed picture that lies over this tile: where its first and last points are, from 0 to 1.
      const u0 = (tile.c0 + 0.5) / hf.cols;
      const u1 = (tile.c1 + 0.5) / hf.cols;
      const v0 = (tile.r0 + 0.5) / hf.rows;
      const v1 = (tile.r1 + 0.5) / hf.rows;
      const left = u0 * print.width;
      const top = v0 * print.height;
      const wide = (u1 - u0) * print.width;
      const tall = (v1 - v0) * print.height;
      if (!close.piece) {
        close.piece = soften(print.data, print.width, print.height, left, top, wide, tall);
        budget -= SOFTEN_COST;
        if (budget <= 0) continue;
      }
      const across = Math.round(wide * CLOSE_POINTS) + 1;
      const down = Math.round(tall * CLOSE_POINTS) + 1;
      const rows = Math.min(Math.ceil(budget / across), down - close.done);
      close.weights = weigh(close.piece, left, top, wide, tall, across, down, print.order, close.weights, close.done, rows);
      close.done += rows;
      budget -= rows * across;
      if (close.done < down) continue;
      close.drawn = look.tile(close.weights, u0, v0, u1, v1);
      close.piece = null;
      close.weights = null;
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
    this.sharpen(camX, camZ, unlimited);
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

      tile.shownLevel = dist < viewDist ? level : -1;
      tile.shownCanopy = canopy;
      // Let go of fine levels the camera has left well behind.
      for (let l = 0; l < COARSEST; l++) {
        if ((tile.snow[l] || tile.canopy[l]) && dist > (LEVELS[l] as (typeof LEVELS)[number]).range * KEEP) this.drop(tile, l);
      }
    }

    // A block whose tiles are all at their coarsest, in the same texture, is drawn as one mesh.
    // Otherwise each of its tiles is drawn by itself, as it always was.
    for (const block of this.blocks) {
      const first = block.tiles[0] as Tile;
      const joined = block.tiles.length > 1 && block.tiles.every((t) => t.shownLevel === COARSEST && t.shownCanopy === first.shownCanopy);
      if (joined) this.blockMesh(block, first.shownCanopy);
      if (block.snow) block.snow.visible = joined && !first.shownCanopy;
      if (block.canopy) block.canopy.visible = joined && first.shownCanopy;
      for (const tile of block.tiles) {
        for (let l = 0; l < LEVELS.length; l++) {
          const snow = tile.snow[l];
          const far = tile.canopy[l];
          if (snow) {
            snow.visible = !joined && l === tile.shownLevel && !tile.shownCanopy;
            // At its finest, a tile is drawn from the weights of its inks once they are ready.
            if (l === 0) snow.material = tile.close?.drawn?.material ?? this.snowMaterial;
          }
          if (far) far.visible = !joined && l === tile.shownLevel && tile.shownCanopy;
        }
      }
    }
  }
}
