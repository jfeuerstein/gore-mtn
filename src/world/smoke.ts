import * as THREE from 'three/webgpu';
import { lit } from '../look/material';

/** Somewhere smoke rises from: the top of a chimney, or the stack of a steam engine. */
export interface Flue {
  x: number;
  y: number;
  z: number;
  /** How big its puffs are: 1 for a house chimney. */
  size: number;
}

/** Puffs in the air above each flue at once: enough to run together into a plume. */
const PUFFS = 8;
/** Seconds for a puff to rise, spread and thin away. */
const LIFE = 7;
/** How high a puff climbs in that time, and how far the air carries it, in metres. */
const RISE = 7.5;
const DRIFT = 3.2;
/** Smoke is drawn only this near the player. */
const RANGE = 420;

/**
 * Smoke from the town's chimneys and steam from the train: a few pale puffs over each flue,
 * rising, spreading and thinning away. One instanced mesh for all of them, lit like everything
 * else, in the print's steps, so it takes the colour of the hour. Only the flues near the player are drawn.
 */
export class Smoke {
  readonly mesh: THREE.InstancedMesh;
  private readonly m = new THREE.Matrix4();
  private readonly q = new THREE.Quaternion();
  private readonly p = new THREE.Vector3();
  private readonly s = new THREE.Vector3();
  private readonly material: THREE.MeshLambertMaterial;

  constructor(private readonly flues: readonly Flue[]) {
    // Pale, and a little bright of its own, so the underside of a puff is not a dark stone in the sky.
    // It is printed like everything else: a puff is a faceted lump, each face one flat tone. (It was lit smoothly, and
    // was the one soft thing in a flat picture: a string of pearls over the chimneys.)
    this.material = lit({ color: 0xf2f4f7, emissive: 0xaab0ba, emissiveIntensity: 0.6 });
    this.mesh = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(0.5, 0), this.material, Math.max(1, flues.length * PUFFS));
    this.mesh.name = 'smoke';
    this.mesh.count = 0;
    // Puffs move every frame, so the mesh is never left out for being off screen by its old bounds.
    this.mesh.frustumCulled = false;
  }

  /** How much daylight there is, 0..1: smoke is pale by day and only a shape against the sky after dark. */
  setDaylight(amount: number): void {
    this.material.emissiveIntensity = 0.12 + 0.5 * Math.min(1, Math.max(0, amount));
  }

  /** @param time seconds, on any steady clock */
  update(time: number, x: number, z: number): void {
    let n = 0;
    this.flues.forEach((flue, f) => {
      if (Math.hypot(flue.x - x, flue.z - z) > RANGE) return;
      for (let i = 0; i < PUFFS; i++) {
        // Each flue keeps its own time, so the town's chimneys do not puff in step.
        const age = (time / LIFE + i / PUFFS + f * 0.37) % 1;
        const sway = Math.sin(time * 0.7 + f * 1.7 + i * 2.1) * 0.35 * age;
        this.p.set(flue.x + DRIFT * age * age + sway, flue.y + RISE * age, flue.z + DRIFT * 0.4 * age * age - sway * 0.5);
        // Small as it leaves, wide as it rises, gone by the top.
        const size = flue.size * (0.7 + age * 2.3) * (age > 0.7 ? (1 - age) / 0.3 : 1);
        this.q.setFromAxisAngle(this.s.set(0.3, 1, 0.2).normalize(), age * 2.4 + i);
        this.m.compose(this.p, this.q, this.s.set(size, size * 0.8, size));
        this.mesh.setMatrixAt(n++, this.m);
      }
    });
    this.mesh.count = n;
    if (n > 0) this.mesh.instanceMatrix.needsUpdate = true;
  }
}
