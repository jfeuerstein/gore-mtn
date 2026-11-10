import * as THREE from 'three/webgpu';
import type { Heightfield } from './heightfield';
import type { World } from './world';

/** Terrain is drawn as square tiles this many cells across, so off-screen ground can be skipped. */
export const TILE_CELLS = 64;
/** Tiles further than this from the camera are drawn at half detail. */
const LOD_DISTANCE = 450;
/** Depth of the curtain hung from every tile edge to hide gaps where detail levels meet. */
const SKIRT = 8;

export interface TerrainTile {
  near: THREE.Mesh;
  far: THREE.Mesh;
  centerX: number;
  centerZ: number;
  radius: number;
}

const ROCK_TINT = new THREE.Color(0x8b8f9c);
const WHITE = new THREE.Color(0xffffff);

/** Every `step`th index from `from` to `to`, always ending on `to`. */
function steps(from: number, to: number, step: number): number[] {
  const out: number[] = [];
  for (let i = from; i < to; i += step) out.push(i);
  out.push(to);
  return out;
}

function buildTileGeometry(hf: Heightfield, world: World, c0: number, c1: number, r0: number, r1: number, step: number): THREE.BufferGeometry {
  const cs = steps(c0, c1, step);
  const rs = steps(r0, r1, step);
  const w = cs.length;
  const h = rs.length;
  const src = world.source;
  const positions: number[] = [];
  const colors: number[] = [];
  const uvs: number[] = [];
  const tmp = new THREE.Color();

  const push = (c: number, r: number, drop: number): void => {
    const x = hf.originX + c * hf.cell;
    const z = hf.originZ + r * hf.cell;
    positions.push(x, hf.at(c, r) - drop, z);
    // Vertex colour multiplies the ground texture: white leaves it alone, grey shows bare rock
    // where it is too steep to hold snow (between roughly 48 and 60 degrees, off the trails).
    const rock = world.onTrail(x, z) ? 0 : Math.min(1, Math.max(0, (hf.slopeDegAt(x, z) - 48) / 12));
    tmp.copy(WHITE).lerp(ROCK_TINT, rock);
    colors.push(tmp.r, tmp.g, tmp.b);
    // The ground texture has one block of texels per source sample, centred on the sample.
    uvs.push(((x - src.originX) / src.cell + 0.5) / src.cols, 1 - ((z - src.originZ) / src.cell + 0.5) / src.rows);
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
  const rim: number[] = [];
  for (let i = 0; i < w; i++) rim.push(i);
  for (let j = 1; j < h; j++) rim.push(j * w + (w - 1));
  for (let i = w - 2; i >= 0; i--) rim.push((h - 1) * w + i);
  for (let j = h - 2; j >= 1; j--) rim.push(j * w);
  const base = w * h;
  rim.forEach((v) => push(cs[v % w] as number, rs[Math.floor(v / w)] as number, SKIRT));
  for (let k = 0; k < rim.length; k++) {
    const next = (k + 1) % rim.length;
    const top0 = rim[k] as number;
    const top1 = rim[next] as number;
    index.push(top0, top1, base + k, top1, base + next, base + k);
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(index);
  geo.computeVertexNormals();
  geo.computeBoundingSphere();
  return geo;
}

/**
 * The ground. Colour comes from the pipeline's ground texture (bright groomed trails, cooler
 * snow under the trees); shape comes from the heightfield, cut into tiles that each exist at full
 * and half detail.
 */
export class Terrain {
  readonly group = new THREE.Group();
  readonly tiles: TerrainTile[] = [];

  constructor(hf: Heightfield, world: World, groundTexture: THREE.Texture) {
    this.group.name = 'terrain';
    groundTexture.colorSpace = THREE.SRGBColorSpace;
    groundTexture.anisotropy = 4;
    // Double-sided so the skirts show whichever way they face.
    const material = new THREE.MeshLambertMaterial({
      map: groundTexture,
      vertexColors: true,
      flatShading: true,
      side: THREE.DoubleSide,
    });

    for (let r0 = 0; r0 < hf.rows - 1; r0 += TILE_CELLS) {
      for (let c0 = 0; c0 < hf.cols - 1; c0 += TILE_CELLS) {
        const c1 = Math.min(c0 + TILE_CELLS, hf.cols - 1);
        const r1 = Math.min(r0 + TILE_CELLS, hf.rows - 1);
        const make = (step: number): THREE.Mesh => {
          const mesh = new THREE.Mesh(buildTileGeometry(hf, world, c0, c1, r0, r1, step), material);
          mesh.receiveShadow = true;
          mesh.matrixAutoUpdate = false;
          this.group.add(mesh);
          return mesh;
        };
        const near = make(1);
        const far = make(2);
        const sphere = near.geometry.boundingSphere as THREE.Sphere;
        this.tiles.push({ near, far, centerX: sphere.center.x, centerZ: sphere.center.z, radius: sphere.radius });
      }
    }
  }

  /** Show each tile at the right detail for its distance, or not at all beyond `viewDist`. */
  cull(camX: number, camZ: number, viewDist: number): void {
    for (const t of this.tiles) {
      const dist = Math.hypot(t.centerX - camX, t.centerZ - camZ) - t.radius;
      const shown = dist < viewDist;
      t.near.visible = shown && dist < LOD_DISTANCE;
      t.far.visible = shown && !t.near.visible;
    }
  }
}
