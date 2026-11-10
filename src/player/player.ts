import * as THREE from 'three/webgpu';
import type { Heightfield } from '../world/heightfield';

/**
 * Brisk for a figure this size, on purpose: the mountain is big, the camera sits well back, and a
 * realistic walking pace would crawl across the screen.
 */
export const WALK_SPEED = 7.5;
/** Debug travel speed, for crossing the mountain quickly while there are no skis yet. */
export const FAST_SPEED = 40;

/** Greybox walker: slides over the ground at a fixed speed in the direction of the stick. */
export class Player {
  readonly object = new THREE.Group();
  readonly position = this.object.position;
  speed = 0;
  /** Direction of travel as a yaw, in the same convention as the camera. */
  travelHeading = 0;
  private heading = 0;

  constructor(castShadow: boolean) {
    const jacket = new THREE.MeshLambertMaterial({ color: 0xe2452f, flatShading: true });
    const skin = new THREE.MeshLambertMaterial({ color: 0xf0c9a4, flatShading: true });
    const hat = new THREE.MeshLambertMaterial({ color: 0x2a4d8f, flatShading: true });
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.32, 0.7, 2, 8), jacket);
    body.position.y = 0.67;
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.26, 8, 6), skin);
    head.position.y = 1.5;
    const cap = new THREE.Mesh(new THREE.ConeGeometry(0.27, 0.3, 8), hat);
    cap.position.y = 1.78;
    const pack = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.5, 0.22), hat);
    pack.position.set(0, 0.85, 0.34); // on the back; the player faces -z
    for (const part of [body, head, cap, pack]) {
      part.castShadow = castShadow;
      this.object.add(part);
    }
  }

  /** Put the player on the ground at a position. */
  place(x: number, z: number, hf: Heightfield): void {
    this.position.set(x, hf.heightAt(x, z), z);
  }

  /** Turn to face the same way as a camera with this yaw. */
  face(yaw: number): void {
    this.heading = yaw;
    this.travelHeading = yaw;
    this.object.rotation.y = yaw;
  }

  /**
   * @param moveX stick right (+) and left (-), 0..1
   * @param moveY stick forward (+) and back (-), 0..1
   * @param camYaw camera yaw, so "forward" means away from the camera
   */
  update(dt: number, moveX: number, moveY: number, camYaw: number, fast: boolean, hf: Heightfield): void {
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
}
