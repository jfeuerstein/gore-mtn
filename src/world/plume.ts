import * as THREE from 'three/webgpu';
import { lit } from '../look/material';

/** Puffs in the column at once. */
const PUFFS = 18;
/** Seconds for a puff to rise from the fire to where it thins away. */
const LIFE = 46;
/** How high the column stands over the fire, and how far the air leans it, in metres. */
const RISE = 85;
const LEAN = 26;

/**
 * A column of smoke from a fire in the woods, to be seen from across the valley: that is the
 * point of it. The camper's fire is somewhere different every day and nothing says where; the
 * smoke does. A handful of pale puffs that rise slowly, grow and thin away: one instanced
 * mesh, faceted and lit in the print's steps as the chimneys' smoke is.
 */
export class Plume {
  readonly mesh: THREE.InstancedMesh;
  // (Faceted and lit in the print's steps, as the chimneys' smoke is.)
  private readonly material = lit({ color: 0xeef0f3, emissive: 0xaab0ba, emissiveIntensity: 0.6 });
  private readonly m = new THREE.Matrix4();
  private readonly q = new THREE.Quaternion();
  private readonly p = new THREE.Vector3();
  private readonly s = new THREE.Vector3();
  private at: { x: number; y: number; z: number } | null = null;

  /** @param onSnow true in the months the mountain is white: pale smoke is not seen against it, so it is wood smoke's grey then */
  constructor(onSnow = false) {
    if (onSnow) {
      this.material.color.setHex(0x8e96a3);
      this.material.emissive.setHex(0x59616d);
    }
    this.mesh = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(0.5, 0), this.material, PUFFS);
    this.mesh.name = 'plume';
    this.mesh.count = 0;
    this.mesh.frustumCulled = false;
  }

  /** Where the fire is, or null for no fire. */
  set(at: { x: number; y: number; z: number } | null): void {
    this.at = at;
    if (!at) this.mesh.count = 0;
  }

  /** How much daylight there is, 0..1: pale by day, only a shape against the sky after dark. */
  setDaylight(amount: number): void {
    this.material.emissiveIntensity = 0.12 + 0.5 * Math.min(1, Math.max(0, amount));
  }

  /** @param time seconds, on any steady clock */
  update(time: number): void {
    const at = this.at;
    if (!at) return;
    for (let i = 0; i < PUFFS; i++) {
      const age = (time / LIFE + i / PUFFS) % 1;
      const sway = Math.sin(time * 0.2 + i * 2.1) * 2.2 * age;
      this.p.set(at.x + LEAN * age * age + sway, at.y + 0.8 + RISE * age, at.z + LEAN * 0.35 * age * age - sway * 0.5);
      // Small over the fire, wide aloft, and drawn in to nothing at the top, so that none of them pops out.
      const size = (1.2 + age * 15) * Math.min(1, (1 - age) * 3.2) * Math.min(1, age * 14 + 0.25);
      this.s.set(size, size * 0.8, size);
      this.mesh.setMatrixAt(i, this.m.compose(this.p, this.q, this.s));
    }
    this.mesh.count = PUFFS;
    this.mesh.instanceMatrix.needsUpdate = true;
  }
}
