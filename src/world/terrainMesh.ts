import * as THREE from 'three/webgpu';
import type { Heightfield } from './heightfield';
import type { World } from './world';

/** Terrain is drawn as square tiles this many cells across, so off-screen ground can be skipped. */
export const TILE_CELLS = 64;

export interface TileInfo {
  mesh: THREE.Mesh;
  centerX: number;
  centerZ: number;
  radius: number;
}

const SNOW_TRAIL = new THREE.Color(0xf7f9ff);
const SNOW_FOREST = new THREE.Color(0xc6d1e3);
const SNOW_VALLEY = new THREE.Color(0xbcc8dc);
const ROCK = new THREE.Color(0x7d8494);

/**
 * Build the ground as a grid of tile meshes with baked vertex colours: bright snow on groomed
 * trails, cooler snow under the forest, bare rock where it is too steep to hold snow.
 */
export function buildTerrain(hf: Heightfield, world: World): { group: THREE.Group; tiles: TileInfo[] } {
  const material = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });
  const group = new THREE.Group();
  group.name = 'terrain';
  const tiles: TileInfo[] = [];
  const maxH = hf.data.reduce((m, v) => (v > m ? v : m), 0);
  const tmp = new THREE.Color();

  for (let r0 = 0; r0 < hf.rows - 1; r0 += TILE_CELLS) {
    for (let c0 = 0; c0 < hf.cols - 1; c0 += TILE_CELLS) {
      const c1 = Math.min(c0 + TILE_CELLS, hf.cols - 1);
      const r1 = Math.min(r0 + TILE_CELLS, hf.rows - 1);
      const w = c1 - c0 + 1;
      const h = r1 - r0 + 1;
      const positions = new Float32Array(w * h * 3);
      const colors = new Float32Array(w * h * 3);
      let minY = Infinity;
      let maxY = -Infinity;

      for (let r = r0; r <= r1; r++) {
        for (let c = c0; c <= c1; c++) {
          const i = ((r - r0) * w + (c - c0)) * 3;
          const x = hf.originX + c * hf.cell;
          const z = hf.originZ + r * hf.cell;
          const y = hf.at(c, r);
          positions[i] = x;
          positions[i + 1] = y;
          positions[i + 2] = z;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;

          const slope = hf.slopeDegAt(x, z);
          if (world.onTrail(x, z)) tmp.copy(SNOW_TRAIL);
          else tmp.copy(SNOW_VALLEY).lerp(SNOW_FOREST, Math.min(1, y / (maxH * 0.6)));
          // Off the trails, snow gives way to rock between roughly 48 and 60 degrees.
          if (!world.onTrail(x, z)) tmp.lerp(ROCK, Math.min(1, Math.max(0, (slope - 48) / 12)));
          colors[i] = tmp.r;
          colors[i + 1] = tmp.g;
          colors[i + 2] = tmp.b;
        }
      }

      const index: number[] = [];
      for (let r = 0; r < h - 1; r++) {
        for (let c = 0; c < w - 1; c++) {
          const a = r * w + c;
          const b = a + 1;
          const cc = a + w;
          const d = cc + 1;
          // Split along b-c; Heightfield.heightAt() assumes the same diagonal.
          index.push(a, cc, b, b, cc, d);
        }
      }

      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
      geo.setIndex(index);
      geo.computeVertexNormals();
      geo.computeBoundingSphere();
      geo.computeBoundingBox();

      const mesh = new THREE.Mesh(geo, material);
      mesh.receiveShadow = true;
      mesh.matrixAutoUpdate = false;
      group.add(mesh);
      const sphere = geo.boundingSphere as THREE.Sphere;
      tiles.push({ mesh, centerX: sphere.center.x, centerZ: sphere.center.z, radius: sphere.radius });
    }
  }
  return { group, tiles };
}
