import * as THREE from 'three/webgpu';
import type { Heightfield } from '../world/heightfield';

const MIN_PITCH = -0.25;
const MAX_PITCH = 1.3;

/** Third-person orbit camera. Yaw 0 looks north (-z); positive pitch looks down from above. */
export class FollowCamera {
  yaw = 0;
  pitch = 0.32;
  distance = 9;
  private readonly target = new THREE.Vector3();

  constructor(readonly camera: THREE.PerspectiveCamera) {}

  /** Turn by a drag measured in CSS pixels. */
  look(dxPx: number, dyPx: number): void {
    this.yaw -= dxPx * 0.006;
    this.pitch = Math.min(MAX_PITCH, Math.max(MIN_PITCH, this.pitch + dyPx * 0.005));
  }

  /** Point the camera from the player toward a world position. */
  faceToward(fromX: number, fromZ: number, toX: number, toZ: number): void {
    this.yaw = Math.atan2(-(toX - fromX), -(toZ - fromZ));
  }

  update(follow: THREE.Vector3, hf: Heightfield): void {
    this.target.set(follow.x, follow.y + 1.5, follow.z);
    const flat = Math.cos(this.pitch) * this.distance;
    const cam = this.camera.position;
    cam.set(
      this.target.x + Math.sin(this.yaw) * flat,
      this.target.y + Math.sin(this.pitch) * this.distance,
      this.target.z + Math.cos(this.yaw) * flat,
    );
    // Never let the ground come between the camera and the player.
    const floor = hf.heightAt(cam.x, cam.z) + 0.6;
    if (cam.y < floor) cam.y = floor;
    this.camera.lookAt(this.target);
  }
}
