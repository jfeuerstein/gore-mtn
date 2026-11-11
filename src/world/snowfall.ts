import * as THREE from 'three/webgpu';
import { makeRng } from '../rng';

const FLAKES = 1400;
/** Flakes fill a box this size around the camera and wrap round as it moves, in metres. */
const BOX_X = 70;
const BOX_Y = 44;
const BOX_Z = 70;

const wrap = (v: number, size: number): number => ((v % size) + size) % size;

/** What is in the air. Each kind is the same handful of specks, shaped, coloured and moved differently. */
export type AirKind = 'snow' | 'rain' | 'leaves' | 'fireflies';

interface AirStyle {
  colour: number;
  /** Size of a speck across and in height, against a snowflake. */
  wide: number;
  tall: number;
  /** How fast it falls and how far it sways, against snow. */
  fall: number;
  sway: number;
  /** The height of the box the specks fill, in metres, and how far below the camera its middle sits. */
  boxY: number;
  below: number;
  /** True for specks that swell and fade, like fireflies. */
  blink: boolean;
}

const AIR: Record<AirKind, AirStyle> = {
  snow: { colour: 0xffffff, wide: 1, tall: 1, fall: 1, sway: 1, boxY: BOX_Y, below: 0, blink: false },
  rain: { colour: 0xa9b8cc, wide: 0.35, tall: 7, fall: 6.5, sway: 0.1, boxY: BOX_Y, below: 0, blink: false },
  leaves: { colour: 0xdf8a34, wide: 1.7, tall: 0.9, fall: 0.5, sway: 2.6, boxY: BOX_Y, below: 0, blink: false },
  // Low over the ground, drifting more than falling.
  fireflies: { colour: 0xe9ff8c, wide: 1.5, tall: 1.5, fall: 0.06, sway: 2.2, boxY: 12, below: 7, blink: true },
};

/**
 * Whatever is in the air around the camera: falling snow or rain, drifting leaves, or fireflies.
 * A fixed number of small specks that move and recycle.
 */
export class Snowfall {
  readonly mesh: THREE.InstancedMesh;
  private readonly seeds: Float32Array;
  private readonly material = new THREE.MeshBasicMaterial({ color: 0xffffff });
  private style = AIR.snow;
  private time = 0;

  constructor() {
    // A flat little diamond is enough at this size, and cheap.
    const geometry = new THREE.OctahedronGeometry(0.07, 0);
    this.mesh = new THREE.InstancedMesh(geometry, this.material, FLAKES);
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

  /** What the specks are. */
  setKind(kind: AirKind): void {
    if (this.style === AIR[kind]) return;
    this.style = AIR[kind];
    this.material.color.setHex(this.style.colour);
  }

  /** How much of it there is, 0..1: the share of the specks that are drawn. */
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
    const style = this.style;
    const boxY = style.boxY;
    const count = this.mesh.count;
    for (let i = 0; i < count; i++) {
      const o = i * 5;
      const phase = s[o + 4] as number;
      const sway = Math.sin(t * 0.9 + phase) * 0.8 * style.sway;
      // Each speck keeps its place in the world and wraps into the box that surrounds the camera.
      const x = wrap((s[o] as number) + sway - camera.x, BOX_X) - BOX_X / 2;
      const y = wrap((s[o + 1] as number) - (s[o + 3] as number) * style.fall * t - camera.y, boxY) - boxY / 2 - style.below;
      const z = wrap((s[o + 2] as number) + Math.cos(t * 0.7 + phase) * 0.5 * style.sway - camera.z, BOX_Z) - BOX_Z / 2;
      const glow = style.blink ? Math.max(0, Math.sin(t * 1.3 + phase * 5)) : 1;
      m[i * 16] = style.wide * glow;
      m[i * 16 + 5] = style.tall * glow;
      m[i * 16 + 10] = style.wide * glow;
      m[i * 16 + 12] = camera.x + x;
      m[i * 16 + 13] = camera.y + y;
      m[i * 16 + 14] = camera.z + z;
    }
    this.mesh.instanceMatrix.needsUpdate = true;
  }
}
