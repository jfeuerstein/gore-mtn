import * as THREE from 'three/webgpu';
import { makeRng } from '../rng';

const FLAKES = 1400;
/** Flakes fill a box this size around the camera and wrap round as it moves, in metres. */
const BOX_X = 70;
const BOX_Y = 44;
const BOX_Z = 70;

const wrap = (v: number, size: number): number => ((v % size) + size) % size;

/** Snow falling around the camera: a fixed number of small flakes that drift down and recycle. */
export class Snowfall {
  readonly mesh: THREE.InstancedMesh;
  private readonly seeds: Float32Array;
  private time = 0;

  constructor() {
    // A flat little diamond is enough at this size, and cheap.
    const geometry = new THREE.OctahedronGeometry(0.07, 0);
    const material = new THREE.MeshBasicMaterial({ color: 0xffffff });
    this.mesh = new THREE.InstancedMesh(geometry, material, FLAKES);
    this.mesh.name = 'snowfall';
    this.mesh.frustumCulled = false;
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    const rng = makeRng(1878);
    // Per flake: a place in the box, a fall speed, and a sway phase.
    this.seeds = new Float32Array(FLAKES * 5);
    for (let i = 0; i < FLAKES; i++) {
      this.seeds.set([rng() * BOX_X, rng() * BOX_Y, rng() * BOX_Z, 1.6 + rng() * 1.6, rng() * Math.PI * 2], i * 5);
    }
    // Identity matrices to start with; update() fills in the positions.
    const m = this.mesh.instanceMatrix.array;
    for (let i = 0; i < FLAKES; i++) {
      m[i * 16] = 1;
      m[i * 16 + 5] = 1;
      m[i * 16 + 10] = 1;
      m[i * 16 + 15] = 1;
    }
  }

  /** How hard it is snowing, 0..1: the share of the flakes that are drawn. */
  setAmount(amount: number): void {
    const count = Math.round(Math.min(1, Math.max(0, amount)) * FLAKES);
    this.mesh.count = count;
    this.mesh.visible = count > 0;
  }

  update(camera: THREE.Vector3, dt: number): void {
    if (!this.mesh.visible) return;
    this.time += dt;
    const m = this.mesh.instanceMatrix.array;
    const s = this.seeds;
    const t = this.time;
    for (let i = 0; i < FLAKES; i++) {
      const o = i * 5;
      const sway = Math.sin(t * 0.9 + (s[o + 4] as number)) * 0.8;
      // Each flake keeps its place in the world and wraps into the box that surrounds the camera.
      const x = wrap((s[o] as number) + sway - camera.x, BOX_X) - BOX_X / 2;
      const y = wrap((s[o + 1] as number) - (s[o + 3] as number) * t - camera.y, BOX_Y) - BOX_Y / 2;
      const z = wrap((s[o + 2] as number) + sway * 0.6 - camera.z, BOX_Z) - BOX_Z / 2;
      m[i * 16 + 12] = camera.x + x;
      m[i * 16 + 13] = camera.y + y;
      m[i * 16 + 14] = camera.z + z;
    }
    this.mesh.instanceMatrix.needsUpdate = true;
  }
}
