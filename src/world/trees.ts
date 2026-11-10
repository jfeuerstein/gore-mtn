import * as THREE from 'three/webgpu';
import { makeRng } from '../rng';
import type { Heightfield } from './heightfield';
import type { World } from './world';

/** Trees are grouped into square patches this many metres across so far patches can be skipped. */
const PATCH_SIZE = 128;
const MAX_TREE_SLOPE_DEG = 50;

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
  cone(1.05, 0.7, 2.6, 0, dark, mid);
  cone(0.75, 1.9, 3.6, Math.PI / 6, mid, snow);

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  geo.computeVertexNormals();
  return geo;
}

/**
 * Scatter about `target` trees over every part of the mountain that is not a groomed trail and
 * not too steep. Placement is seeded, so the forest is identical on every load.
 */
export function buildTrees(
  hf: Heightfield,
  world: World,
  target: number,
  castShadow: boolean,
): { group: THREE.Group; patches: TreePatch[]; count: number } {
  const group = new THREE.Group();
  group.name = 'trees';
  if (target <= 0) return { group, patches: [], count: 0 };

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
  const patches: TreePatch[] = [];
  const rng = makeRng(1934);
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const up = new THREE.Vector3(0, 1, 0);
  const p = new THREE.Vector3();
  const s = new THREE.Vector3();
  let count = 0;

  for (let z0 = hf.minZ; z0 < hf.maxZ; z0 += PATCH_SIZE) {
    for (let x0 = hf.minX; x0 < hf.maxX; x0 += PATCH_SIZE) {
      const x1 = Math.min(x0 + PATCH_SIZE, hf.maxX);
      const z1 = Math.min(z0 + PATCH_SIZE, hf.maxZ);
      const matrices: THREE.Matrix4[] = [];
      for (let z = z0; z < z1; z += spacing) {
        for (let x = x0; x < x1; x += spacing) {
          const tx = x + rng() * spacing;
          const tz = z + rng() * spacing;
          const scale = 1.1 + rng() * 0.9;
          const turn = rng() * Math.PI * 2;
          if (tx >= x1 || tz >= z1 || !growsAt(tx, tz)) continue;
          p.set(tx, hf.heightAt(tx, tz) - 0.1, tz);
          q.setFromAxisAngle(up, turn);
          s.set(scale, scale * (0.9 + rng() * 0.3), scale);
          matrices.push(m.compose(p, q, s).clone());
        }
      }
      if (matrices.length === 0) continue;
      const mesh = new THREE.InstancedMesh(geometry, material, matrices.length);
      matrices.forEach((mat, i) => mesh.setMatrixAt(i, mat));
      mesh.instanceMatrix.needsUpdate = true;
      mesh.computeBoundingSphere();
      mesh.castShadow = castShadow;
      mesh.matrixAutoUpdate = false;
      group.add(mesh);
      const sphere = mesh.boundingSphere as THREE.Sphere;
      patches.push({ mesh, centerX: sphere.center.x, centerZ: sphere.center.z, radius: sphere.radius });
      count += matrices.length;
    }
  }
  return { group, patches, count };
}
