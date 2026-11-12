import * as THREE from 'three/webgpu';
import { WORN_MOST } from '../game/save';
import { WORN_AT, WORN_CELL } from '../game/worn';
import { lit } from '../look/material';
import type { Season } from '../look/season';

/** What worn ground looks like: packed snow in winter, bare earth otherwise. */
const WORN_INK: Record<Season, number> = { winter: 0xa9b8d2, spring: 0x8a6f52, summer: 0x9a7f5c, fall: 0x8a6a4a };

/**
 * The ground the player has worn by walking it: a patch to each worn square, laid on the
 * slope, overlapping its neighbours into a path. One instanced mesh for all of it.
 */
export class WornGround {
  readonly mesh: THREE.InstancedMesh;

  constructor(season: Season) {
    // An uneven patch, not a disc: seven corners, some further out than others.
    const shape = new THREE.CircleGeometry(1, 7);
    const at = shape.getAttribute('position');
    for (let i = 1; i < at.count; i++) {
      const k = 0.78 + ((i * 37) % 10) / 22;
      at.setXY(i, at.getX(i) * k, at.getY(i) * k);
    }
    shape.rotateX(-Math.PI / 2);
    this.mesh = new THREE.InstancedMesh(shape, lit({ color: WORN_INK[season], polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4 }), WORN_MOST);
    this.mesh.name = 'worn';
    this.mesh.count = 0;
    this.mesh.frustumCulled = false;
    this.mesh.receiveShadow = true;
  }

  /** Lay the patches where the ground is worn: bigger where it is more worn. */
  set(cells: readonly { x: number; z: number; wear: number }[], heightAt: (x: number, z: number) => number): void {
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const p = new THREE.Vector3();
    const s = new THREE.Vector3();
    const up = new THREE.Vector3(0, 1, 0);
    const normal = new THREE.Vector3();
    const spin = new THREE.Quaternion();
    let n = 0;
    for (const cell of cells) {
      if (n >= WORN_MOST) break;
      // A little off the middle of its square, by where it is, so that a path is not a row of tiles.
      const jx = Math.sin(cell.x * 1.7 + cell.z * 0.3) * 1.1;
      const jz = Math.sin(cell.z * 1.3 + cell.x * 0.7) * 1.1;
      const x = cell.x + jx;
      const z = cell.z + jz;
      const y = heightAt(x, z);
      normal.set(heightAt(x - 1, z) - heightAt(x + 1, z), 2, heightAt(x, z - 1) - heightAt(x, z + 1)).normalize();
      q.setFromUnitVectors(up, normal).multiply(spin.setFromAxisAngle(up, cell.x * 0.9 + cell.z * 0.4));
      const size = WORN_CELL * (0.62 + Math.min(4, cell.wear - WORN_AT) * 0.045);
      this.mesh.setMatrixAt(n++, m.compose(p.set(x, y + 0.05 + (n % 3) * 0.012, z), q, s.set(size, 1, size)));
    }
    this.mesh.count = n;
    this.mesh.instanceMatrix.needsUpdate = true;
  }
}
