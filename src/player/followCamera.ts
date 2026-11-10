import * as THREE from 'three/webgpu';
import type { Heightfield } from '../world/heightfield';
import { followYaw, framingFor } from './cameraMath';

const MIN_PITCH = -0.25;
const MAX_PITCH = 1.3;
/** After the player turns the camera by hand, it stays put this long before following again. */
const MANUAL_HOLD_S = 1.5;

/** Third-person orbit camera. Yaw 0 looks north (-z); positive pitch looks down from above. */
export class FollowCamera {
  yaw = 0;
  pitch = 0.32;
  /** Starting pitch for the current screen shape. */
  defaultPitch = 0.32;
  private distance = 9;
  private aimLift = 0.08;
  private manualHold = 0;
  /** 0 at rest, 1 at full speed; eased. Pulls the camera back and widens the lens a touch. */
  private rush = 0;
  private baseFov = 55;
  private readonly target = new THREE.Vector3();
  private readonly aim = new THREE.Vector3();

  /**
   * @param zoom multiplies the camera distance; above 1 pulls back.
   */
  constructor(
    readonly camera: THREE.PerspectiveCamera,
    private readonly zoom = 1,
  ) {}

  /** Fit the lens and framing to the screen shape. Call whenever the canvas is resized. */
  setAspect(aspect: number): void {
    const framing = framingFor(aspect, this.zoom);
    this.camera.aspect = aspect;
    this.baseFov = framing.fovDeg;
    this.camera.fov = framing.fovDeg;
    this.camera.updateProjectionMatrix();
    this.distance = framing.distance;
    this.aimLift = framing.aimLift;
    this.defaultPitch = framing.pitch;
  }

  /** Turn by a drag measured in CSS pixels. */
  look(dxPx: number, dyPx: number): void {
    if (dxPx === 0 && dyPx === 0) return;
    this.yaw -= dxPx * 0.006;
    this.pitch = Math.min(MAX_PITCH, Math.max(MIN_PITCH, this.pitch + dyPx * 0.005));
    this.manualHold = MANUAL_HOLD_S;
  }

  /** Ease round behind the player as they travel, unless the camera was just turned by hand. */
  follow(heading: number, amount: number, dt: number, always = false): void {
    if (this.manualHold > 0) {
      this.manualHold -= dt;
      return;
    }
    this.yaw = followYaw(this.yaw, heading, amount, dt, always);
  }

  /**
   * Ease the pitch toward a value, unless the camera was just tilted by hand.
   * @returns true once it has arrived
   */
  settlePitch(target: number, dt: number): boolean {
    if (this.manualHold > 0) return false;
    this.pitch += (target - this.pitch) * Math.min(1, dt * 1.6);
    return Math.abs(target - this.pitch) < 0.01;
  }

  /** Point the camera from the player toward a world position. */
  faceToward(fromX: number, fromZ: number, toX: number, toZ: number): void {
    this.yaw = Math.atan2(-(toX - fromX), -(toZ - fromZ));
  }

  /**
   * @param speed the player's speed in m/s, for the sense of rush at pace
   */
  update(follow: THREE.Vector3, hf: Heightfield, speed = 0, dt = 0): void {
    const rushTarget = Math.min(1, Math.max(0, (speed - 10) / 24));
    this.rush += (rushTarget - this.rush) * Math.min(1, dt * 1.5);
    const distance = this.distance * (1 + 0.22 * this.rush);
    const fov = this.baseFov + 5 * this.rush;
    if (Math.abs(fov - this.camera.fov) > 0.01) {
      this.camera.fov = fov;
      this.camera.updateProjectionMatrix();
    }
    this.target.set(follow.x, follow.y + 1.1, follow.z);
    const flat = Math.cos(this.pitch) * distance;
    const cam = this.camera.position;
    cam.set(
      this.target.x + Math.sin(this.yaw) * flat,
      this.target.y + Math.sin(this.pitch) * distance,
      this.target.z + Math.cos(this.yaw) * flat,
    );
    // Never let the ground come between the camera and the player: lift the camera until the
    // line of sight to the player's feet clears the terrain at the camera and along the way.
    // This matters most looking downhill over a roll, where the slope falls away from the lens.
    const feetY = follow.y + 0.2;
    let minY = hf.heightAt(cam.x, cam.z) + 0.6;
    for (const t of [0.2, 0.4, 0.6, 0.8]) {
      const x = follow.x + (cam.x - follow.x) * t;
      const z = follow.z + (cam.z - follow.z) * t;
      const needed = feetY + (hf.heightAt(x, z) + 0.3 - feetY) / t;
      if (needed > minY) minY = needed;
    }
    if (cam.y < minY) cam.y = minY;
    this.aim.copy(this.target);
    this.aim.y += distance * this.aimLift;
    this.camera.lookAt(this.aim);
  }
}
