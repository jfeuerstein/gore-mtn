import * as THREE from 'three/webgpu';

/** Streaks in the air at once, at full speed. */
const STREAKS = 64;
/** The speed at which the first streak shows, and the speed at which they are all out, in metres a second. */
export const LINES_FROM = 11.5;
export const LINES_FULL = 23;
/** How far ahead of the camera a streak is set down, and how far to the side and above the line of travel, in metres. */
const AHEAD = [5, 38] as const;
const ASIDE = [1.7, 7] as const;

/** How much of the speed lines to show at a speed, 0..1. */
export function linesFor(speed: number): number {
  const t = (speed - LINES_FROM) / (LINES_FULL - LINES_FROM);
  return t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t);
}

/**
 * The air going by at speed: thin pale streaks that hang in the air along the line of
 * travel, and are passed. They are not painted on the screen: each is a sliver set down
 * ahead in the world, so those near the skier whip by and those far off drift, as things do.
 * Faster, there are more of them and they are longer. Nothing is see-through: a streak is
 * thin, and is either pale or dark, so that some show whatever is behind them. One instanced mesh.
 */
export class SpeedLines {
  readonly mesh: THREE.InstancedMesh;
  private readonly material = new THREE.MeshBasicMaterial({ color: 0xffffff });
  private readonly at: THREE.Vector3[] = Array.from({ length: STREAKS }, () => new THREE.Vector3(0, -1000, 0));
  private readonly m = new THREE.Matrix4();
  private readonly q = new THREE.Quaternion();
  private readonly s = new THREE.Vector3();
  private readonly along = new THREE.Vector3();
  private readonly across = new THREE.Vector3();
  private readonly lift = new THREE.Vector3();
  private readonly forward = new THREE.Vector3(0, 0, 1);
  private shown = 0;

  constructor() {
    this.mesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), this.material, STREAKS);
    this.mesh.name = 'speed-lines';
    this.mesh.frustumCulled = false;
    this.mesh.count = 0;
  }

  /**
   * The colours of the streaks: every other one snow's, in this light, lightened, to be seen
   * against the trees and the shade; and the rest the colour of a track in the snow, darkened,
   * to be seen against the snow in the sun. A white line on white snow is no line.
   */
  setTint(snow: number, track: number): void {
    const pale = new THREE.Color(snow).lerp(new THREE.Color(0xffffff), 0.5);
    const dark = new THREE.Color(track).lerp(new THREE.Color(0x22304a), 0.28);
    for (let i = 0; i < STREAKS; i++) this.mesh.setColorAt(i, i % 2 ? dark : pale);
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
  }

  /**
   * @param camera where the camera is
   * @param velocity which way the skier is going and how fast, in metres a second
   */
  update(dt: number, camera: THREE.Vector3, velocity: THREE.Vector3): void {
    const speed = velocity.length();
    // Eased, so that the streaks gather and thin and do not blink on at a number.
    const want = linesFor(speed);
    this.shown += (want - this.shown) * Math.min(1, dt * 3);
    const count = Math.round(this.shown * STREAKS);
    if (count === 0 || speed < 1) {
      this.mesh.count = 0;
      return;
    }
    this.along.copy(velocity).divideScalar(speed);
    this.across.set(-this.along.z, 0, this.along.x).normalize();
    this.lift.crossVectors(this.along, this.across);
    if (this.lift.y < 0) this.lift.negate();
    this.q.setFromUnitVectors(this.forward, this.along);
    // Longer the faster: about a third of a second of travel. The camera looks along the way the skier is going,
    // so a streak is seen nearly end on: it has to be long, and near, to be a line and not a dot.
    const length = 2 + speed * 0.34 * this.shown;
    for (let i = 0; i < count; i++) {
      const p = this.at[i] as THREE.Vector3;
      let ahead = (p.x - camera.x) * this.along.x + (p.y - camera.y) * this.along.y + (p.z - camera.z) * this.along.z;
      // Passed, or left behind by a turn: set down again ahead, somewhere round the line of travel but not on it.
      const off = Math.hypot((p.x - camera.x) - this.along.x * ahead, (p.y - camera.y) - this.along.y * ahead, (p.z - camera.z) - this.along.z * ahead);
      if (ahead < -length || ahead > AHEAD[1] + 10 || off > ASIDE[1] + 6) {
        const a = Math.random() * Math.PI * 2;
        const r = ASIDE[0] + Math.random() * (ASIDE[1] - ASIDE[0]);
        // A new one starts anywhere along the way ahead, so that they do not come in waves.
        const d = AHEAD[0] + Math.random() * (AHEAD[1] - AHEAD[0]);
        p.copy(camera).addScaledVector(this.along, d).addScaledVector(this.across, Math.cos(a) * r).addScaledVector(this.lift, Math.sin(a) * r * 0.7 - 0.6);
        // (How far ahead it is now: a streak sized by where it was, far off or not yet anywhere, was a slab across the screen for a frame.)
        ahead = d;
      }
      // As thin on the screen wherever it is: a line of about a point and a half, not a plank up close and nothing far off.
      const thick = 0.0021 * Math.min(AHEAD[1] + 10, Math.max(4, ahead));
      this.mesh.setMatrixAt(i, this.m.compose(p, this.q, this.s.set(thick, thick, length)));
    }
    this.mesh.count = count;
    this.mesh.instanceMatrix.needsUpdate = true;
  }
}
