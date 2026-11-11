import * as THREE from 'three/webgpu';
import type { Heightfield } from './heightfield';
import { lit } from '../look/material';

/** A new stretch of track is laid each time the skier has travelled this far, in metres. */
const STEP = 0.5;
/** Stretches kept before the oldest are overwritten: about 900 m of tracks. */
const MAX_STEPS = 1800;
/** Half the gap between the two skis, and how far above the snow the tracks sit, in metres. */
const SKI_GAP = 0.13;
const LIFT = 0.05;
/** Floats per stretch: two skis, each a quad of two triangles. */
const FLOATS = 2 * 6 * 3;

/**
 * Half the width of the mark one ski leaves, in metres, for the angle between the skis and the
 * direction of travel. Running straight, a ski leaves a line as wide as itself. Sliding sideways
 * in a skid or a hockey stop, it scrapes a band as wide as the ski is long.
 */
export function trackHalfWidth(slip: number): number {
  const SKI_HALF_WIDTH = 0.05;
  const SKI_HALF_LENGTH = 0.7;
  return SKI_HALF_WIDTH + (SKI_HALF_LENGTH - SKI_HALF_WIDTH) * Math.abs(Math.sin(slip));
}

/** The lines the skis leave in the snow. The most recent stretch of them stays on the mountain. */
export class SkiTracks {
  readonly mesh: THREE.Mesh;
  private readonly positions: Float32Array;
  private readonly attribute: THREE.BufferAttribute;
  private head = 0;
  /** Where the last stretch ended: for each ski, the left and right edge of its mark. */
  private last: Float32Array | null = null;
  private lastX = 0;
  private lastZ = 0;

  /**
   * @param colour a touch darker than groomed snow, so tracks read as shallow grooves
   * @param gap half the distance between the two marks, in metres: skis run side by side, a bike's wheels in one line
   */
  constructor(
    colour = 0xc3cfe3,
    private readonly gap = SKI_GAP,
  ) {
    this.positions = new Float32Array(MAX_STEPS * FLOATS);
    this.attribute = new THREE.BufferAttribute(this.positions, 3);
    this.attribute.setUsage(THREE.DynamicDrawUsage);
    const normals = new Float32Array(this.positions.length);
    for (let i = 1; i < normals.length; i += 3) normals[i] = 1;
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', this.attribute);
    geometry.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
    const material = lit({
      color: colour,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -4,
    });
    this.mesh = new THREE.Mesh(geometry, material);
    this.mesh.name = 'ski-tracks';
    this.mesh.frustumCulled = false;
    this.mesh.receiveShadow = true;
  }

  setColour(colour: number): void {
    (this.mesh.material as THREE.MeshLambertMaterial).color.setHex(colour);
  }

  /** Stop the current line, so the next mark does not join up with it: skis off, a lift ride, a teleport. */
  lift(): void {
    this.last = null;
  }

  /**
   * Extend the tracks to where the skier is now. Call every frame while skiing.
   * @param heading the way the skis point, as a yaw
   * @param travel the way the skier is moving, as a yaw
   */
  add(x: number, z: number, heading: number, travel: number, slip: number, hf: Heightfield): void {
    if (this.last && Math.hypot(x - this.lastX, z - this.lastZ) < STEP) return;
    // Each ski's mark runs across the direction of travel, centred on the ski.
    const half = trackHalfWidth(slip);
    const acrossX = Math.cos(travel) * half;
    const acrossZ = -Math.sin(travel) * half;
    const gapX = Math.cos(heading) * this.gap;
    const gapZ = -Math.sin(heading) * this.gap;
    const now = new Float32Array(12);
    for (let ski = 0; ski < 2; ski++) {
      const side = ski === 0 ? -1 : 1;
      const cx = x + gapX * side;
      const cz = z + gapZ * side;
      let ax = cx - acrossX;
      let az = cz - acrossZ;
      let bx = cx + acrossX;
      let bz = cz + acrossZ;
      // Keep each mark's left and right edges on the same sides as the last one, or the stretch
      // between them would twist into a bow tie when the direction of travel swings round.
      if (this.last) {
        const p = ski * 6;
        const was = ((this.last[p + 3] as number) - (this.last[p] as number)) * (bx - ax) + ((this.last[p + 5] as number) - (this.last[p + 2] as number)) * (bz - az);
        if (was < 0) [ax, az, bx, bz] = [bx, bz, ax, az];
      }
      now.set([ax, hf.heightAt(ax, az) + LIFT, az, bx, hf.heightAt(bx, bz) + LIFT, bz], ski * 6);
    }

    const prev = this.last;
    // A jump of more than a few steps means the skier was moved, not that they skied there.
    if (prev && Math.hypot(x - this.lastX, z - this.lastZ) < STEP * 8) {
      const out = this.positions;
      let o = (this.head % MAX_STEPS) * FLOATS;
      for (let ski = 0; ski < 2; ski++) {
        const p = ski * 6;
        // Two triangles covering the stretch between the last mark and this one. Which way round
        // they are listed depends on the direction of travel; always list them so they face up,
        // or the light would fall on their undersides and they would look dark.
        const ux = (prev[p + 3] as number) - (prev[p] as number);
        const uz = (prev[p + 5] as number) - (prev[p + 2] as number);
        const vx = (now[p] as number) - (prev[p] as number);
        const vz = (now[p + 2] as number) - (prev[p + 2] as number);
        const facesUp = uz * vx - ux * vz >= 0;
        const a = facesUp ? p : p + 3;
        const b = facesUp ? p + 3 : p;
        for (const [src, at] of [[prev, a], [prev, b], [now, a], [prev, b], [now, b], [now, a]] as const) {
          out[o++] = src[at] as number;
          out[o++] = src[at + 1] as number;
          out[o++] = src[at + 2] as number;
        }
      }
      this.head++;
      this.attribute.needsUpdate = true;
    }
    this.last = now;
    this.lastX = x;
    this.lastZ = z;
  }

  /** Stretches of track laid so far. */
  get count(): number {
    return this.head;
  }
}
