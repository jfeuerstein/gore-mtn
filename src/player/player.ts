import * as THREE from 'three/webgpu';
import type { Heightfield } from '../world/heightfield';
import { advanceSki, descentAlong, stickToSki, type SkiInput, type SkiState } from './skiPhysics';

/**
 * Brisk for a figure this size, on purpose: the mountain is big, the camera sits well back, and a
 * realistic walking pace would crawl across the screen.
 */
export const WALK_SPEED = 7.5;
/** Debug travel speed, for crossing the mountain quickly. */
export const FAST_SPEED = 40;

export type Mode = 'walk' | 'ski';

/**
 * Greybox player. On foot they move at a fixed speed in the direction of the stick. On skis the
 * stick steers, tucks and brakes, and the slope does the rest (see skiPhysics.ts).
 */
export class Player {
  readonly object = new THREE.Group();
  readonly position = this.object.position;
  mode: Mode = 'walk';
  /** Speed over the snow in m/s. */
  speed = 0;
  /** Direction of travel as a yaw, in the same convention as the camera. */
  travelHeading = 0;
  private heading = 0;
  private lean = 0;
  private crouch = 0;
  private readonly body = new THREE.Group();
  private readonly skis = new THREE.Group();

  constructor(castShadow: boolean) {
    const jacket = new THREE.MeshLambertMaterial({ color: 0xe2452f, flatShading: true });
    const skin = new THREE.MeshLambertMaterial({ color: 0xf0c9a4, flatShading: true });
    const hat = new THREE.MeshLambertMaterial({ color: 0x2a4d8f, flatShading: true });
    const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.32, 0.7, 2, 8), jacket);
    torso.position.y = 0.67;
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.26, 8, 6), skin);
    head.position.y = 1.5;
    const cap = new THREE.Mesh(new THREE.ConeGeometry(0.27, 0.3, 8), hat);
    cap.position.y = 1.78;
    const pack = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.5, 0.22), hat);
    pack.position.set(0, 0.85, 0.34); // on the back; the player faces -z
    this.body.add(torso, head, cap, pack);

    const skiMat = new THREE.MeshLambertMaterial({ color: 0x23324f, flatShading: true });
    for (const side of [-1, 1]) {
      const ski = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.05, 1.9), skiMat);
      ski.position.set(side * 0.17, 0.03, -0.1);
      this.skis.add(ski);
    }
    this.skis.visible = false;

    // Yaw first, then pitch to the slope, then lean into the turn.
    this.object.rotation.order = 'YXZ';
    this.object.add(this.body, this.skis);
    this.object.traverse((o) => {
      if (o instanceof THREE.Mesh) o.castShadow = castShadow;
    });
  }

  /** Put the player on the ground at a position, standing still. */
  place(x: number, z: number, hf: Heightfield): void {
    this.position.set(x, hf.heightAt(x, z), z);
    this.speed = 0;
  }

  /** Turn to face the same way as a camera with this yaw. */
  face(yaw: number): void {
    this.heading = yaw;
    this.travelHeading = yaw;
    this.object.rotation.y = yaw;
  }

  /** Clip into or out of skis. Either way the player starts from a standstill. */
  setMode(mode: Mode): void {
    this.mode = mode;
    this.speed = 0;
    this.skis.visible = mode === 'ski';
    if (mode === 'walk') {
      this.lean = 0;
      this.crouch = 0;
      this.object.rotation.set(0, this.heading, 0);
      this.body.scale.y = 1;
    }
  }

  /**
   * @param moveX stick right (+) and left (-), 0..1
   * @param moveY stick up (+) and down (-), 0..1
   * @param camYaw camera yaw, so on foot "up" means away from the camera
   * @param groomedAt whether a position is on a groomed trail
   */
  update(
    dt: number,
    moveX: number,
    moveY: number,
    camYaw: number,
    fast: boolean,
    hf: Heightfield,
    groomedAt: (x: number, z: number) => boolean,
  ): void {
    if (this.mode === 'ski') this.ski(dt, stickToSki(moveX, moveY), hf, groomedAt);
    else this.walk(dt, moveX, moveY, camYaw, fast, hf);
  }

  private walk(dt: number, moveX: number, moveY: number, camYaw: number, fast: boolean, hf: Heightfield): void {
    const mag = Math.min(1, Math.hypot(moveX, moveY));
    const top = fast ? FAST_SPEED : WALK_SPEED;
    this.speed = mag * top;
    if (mag > 0.01) {
      const sin = Math.sin(camYaw);
      const cos = Math.cos(camYaw);
      // Camera forward is (-sin, -cos) and camera right is (cos, -sin) in the x-z plane.
      const dx = (cos * moveX - sin * moveY) / mag;
      const dz = (-sin * moveX - cos * moveY) / mag;
      const x = Math.min(Math.max(this.position.x + dx * this.speed * dt, hf.minX + 1), hf.maxX - 1);
      const z = Math.min(Math.max(this.position.z + dz * this.speed * dt, hf.minZ + 1), hf.maxZ - 1);
      this.position.set(x, hf.heightAt(x, z), z);

      const want = Math.atan2(-dx, -dz);
      this.travelHeading = want;
      let diff = want - this.heading;
      diff = Math.atan2(Math.sin(diff), Math.cos(diff));
      this.heading += diff * Math.min(1, dt * 12);
      this.object.rotation.y = this.heading;
    }
  }

  private ski(dt: number, input: SkiInput, hf: Heightfield, groomedAt: (x: number, z: number) => boolean): void {
    const before: SkiState = { x: this.position.x, z: this.position.z, heading: this.heading, speed: this.speed };
    const after = advanceSki(before, input, hf, groomedAt, dt);
    const x = Math.min(Math.max(after.x, hf.minX + 1), hf.maxX - 1);
    const z = Math.min(Math.max(after.z, hf.minZ + 1), hf.maxZ - 1);
    // Running into the edge of the map is a stop, not a slide along it.
    this.speed = x === after.x && z === after.z ? after.speed : 0;
    this.heading = after.heading;
    this.travelHeading = after.heading;
    this.position.set(x, hf.heightAt(x, z), z);

    // Pose: nose follows the slope, body leans into the turn and sinks into a tuck.
    const ease = Math.min(1, dt * 8);
    const carving = Math.min(1, this.speed / 6);
    this.lean += (-input.steer * 0.38 * carving - this.lean) * ease;
    this.crouch += (Math.max(input.tuck, input.brake * 0.4) - this.crouch) * ease;
    this.object.rotation.set(-Math.asin(descentAlong(hf, x, z, this.heading)), this.heading, this.lean);
    this.body.scale.y = 1 - 0.22 * this.crouch;
  }
}
