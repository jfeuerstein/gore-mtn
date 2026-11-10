import * as THREE from 'three/webgpu';
import type { Heightfield } from '../world/heightfield';
import { deflect, pushOut, type Obstacle } from './collide';
import { mixPose, SEATED, skiPose, STANDING, walkPose, type Pose } from './pose';
import { Skier } from './skier';
import { boardingDistance, riderAlong, type LiftPath } from '../world/lifts';
import {
  advanceSki,
  descentAlong,
  skierAt,
  slipAngle,
  speedOf,
  stickToSki,
  travelYaw,
  type SkiInput,
  type SkiState,
} from './skiPhysics';

/**
 * Brisk for a figure this size, on purpose: the mountain is big, the camera sits well back, and a
 * realistic walking pace would crawl across the screen.
 */
export const WALK_SPEED = 7.5;
/** Debug travel speed, for crossing the mountain quickly. */
export const FAST_SPEED = 110;

/** The figure is modelled 1.9 m tall and drawn at this scale: about 1.4 m in the game's world. */
export const PLAYER_SCALE = 0.75;

export type Mode = 'walk' | 'ski' | 'lift';
/** How wide the player is for bumping into things, in metres. */
const BODY_RADIUS = 0.35;

/**
 * The player. On foot they move at a fixed speed in the direction of the stick. On skis the stick
 * steers, tucks and brakes, and the slope does the rest (see skiPhysics.ts). The figure itself is
 * a Skier, posed here to suit what the player is doing.
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
  /** Velocity and lean while on skis. */
  private skiState: SkiState = skierAt(0, 0, 0);
  private lean = 0;
  private readonly skier: Skier;
  /** The pose the figure is in now, and how far through a stride on foot. */
  private shown: Pose = STANDING;
  private stride = 0;
  private walking = 0;
  /**
   * The lift being ridden, where on it and when (on the lift clock) the ride began, and what to go
   * back to at the top.
   */
  private ride: { path: LiftPath; from: number; since: number; resume: 'walk' | 'ski' } | null = null;
  private arrived: LiftPath | null = null;

  constructor(castShadow: boolean) {
    this.skier = new Skier(castShadow);
    // Small against the trails, as a person is on a real mountain.
    this.object.scale.setScalar(PLAYER_SCALE);
    // Yaw first, then pitch to the slope, then lean into the turn.
    this.object.rotation.order = 'YXZ';
    this.object.add(this.skier.root);
    this.skier.pose(this.shown, false);
  }

  /** Ease the figure toward a pose. */
  private show(target: Pose, dt: number, flatFeet: boolean, rate = 10): void {
    this.shown = mixPose(this.shown, target, Math.min(1, dt * rate));
    this.skier.pose(this.shown, flatFeet);
  }

  /** The way the skis point, as a yaw. */
  get skiHeading(): number {
    return this.heading;
  }

  /** Angle between the skis and the direction of travel: near 0 carving, near ±PI/2 in a hockey stop. */
  get slip(): number {
    return this.mode === 'ski' ? slipAngle(this.skiState) : 0;
  }

  /** Put the player on the ground at a position, standing still. */
  place(x: number, z: number, hf: Heightfield): void {
    this.position.set(x, hf.heightAt(x, z), z);
    this.stop();
  }

  private stop(): void {
    this.speed = 0;
    this.skiState = skierAt(this.position.x, this.position.z, this.heading);
  }

  /** Turn to face the same way as a camera with this yaw. */
  face(yaw: number): void {
    this.heading = yaw;
    this.travelHeading = yaw;
    this.object.rotation.y = yaw;
    this.stop();
  }

  /**
   * Get on a lift at its bottom station, onto the chair that is leaving it now.
   * @param clock the lift clock, in seconds: the same one the chairs move on
   */
  board(path: LiftPath, clock: number): void {
    if (this.mode === 'lift') return;
    this.ride = { path, from: boardingDistance(path, clock), since: clock, resume: this.mode };
    this.mode = 'lift';
    this.stop();
    this.lean = 0;
    // Inside a gondola cabin the rider is out of sight.
    this.skier.root.visible = !path.cabins;
  }

  /** The lift being ridden, if any. */
  get riding(): LiftPath | null {
    return this.ride?.path ?? null;
  }

  /**
   * The lift the player has just reached the top of, once. The caller sets them down on the snow;
   * the player is back on foot or on skis, as they boarded.
   */
  takeArrival(): LiftPath | null {
    const path = this.arrived;
    this.arrived = null;
    return path;
  }

  /** Clip into or out of skis. Either way the player starts from a standstill. On a lift, it takes effect at the top. */
  setMode(mode: 'walk' | 'ski'): void {
    this.skier.setSkis(mode === 'ski');
    if (this.ride) {
      this.ride.resume = mode;
      return;
    }
    this.mode = mode;
    this.stop();
    this.travelHeading = this.heading;
    if (mode === 'walk') {
      this.lean = 0;
      this.object.rotation.set(0, this.heading, 0);
    }
  }

  /**
   * @param moveX stick right (+) and left (-), 0..1
   * @param moveY stick up (+) and down (-), 0..1
   * @param camYaw camera yaw, so on foot "up" means away from the camera
   * @param groomedAt whether a position is on a groomed trail
   * @param obstacleAt the solid thing, such as a tree trunk, that a circle at a position overlaps
   * @param clock the lift clock, in seconds
   */
  update(
    dt: number,
    moveX: number,
    moveY: number,
    camYaw: number,
    fast: boolean,
    hf: Heightfield,
    groomedAt: (x: number, z: number) => boolean,
    obstacleAt: (x: number, z: number, radius: number) => Obstacle | null = () => null,
    clock = 0,
  ): void {
    if (this.mode === 'lift') this.rideLift(dt, clock);
    else if (this.mode === 'ski') this.ski(dt, stickToSki(moveX, moveY), hf, groomedAt, obstacleAt);
    else this.walk(dt, moveX, moveY, camYaw, fast, hf, obstacleAt);
  }

  private rideLift(dt: number, clock: number): void {
    const ride = this.ride;
    if (!ride) return;
    // Worked out from the clock, not added up frame by frame, so the rider stays on their chair.
    const distance = ride.from + (clock - ride.since) * ride.path.speed;
    this.speed = ride.path.speed;
    const at = riderAlong(ride.path, distance);
    this.position.set(at.x, at.y, at.z);
    this.heading = at.yaw;
    this.travelHeading = at.yaw;
    this.object.rotation.set(0, at.yaw, 0);
    // Sitting on a chair; standing on a lift that runs along the snow.
    this.show(ride.path.surface ? (ride.resume === 'ski' ? skiPose(0, 0) : STANDING) : SEATED, dt, true);
    if (distance >= ride.path.length) {
      this.ride = null;
      this.skier.root.visible = true;
      this.arrived = ride.path;
      this.setMode(ride.resume);
    }
  }

  private walk(
    dt: number,
    moveX: number,
    moveY: number,
    camYaw: number,
    fast: boolean,
    hf: Heightfield,
    obstacleAt: (x: number, z: number, radius: number) => Obstacle | null,
  ): void {
    const mag = Math.min(1, Math.hypot(moveX, moveY));
    const top = fast ? FAST_SPEED : WALK_SPEED;
    this.speed = mag * top;
    // The stride runs on with the ground covered, and fades in and out as the walker starts and stops.
    this.stride += Math.min(this.speed, WALK_SPEED * 1.6) * dt * 1.9;
    this.walking += (Math.min(1, this.speed / WALK_SPEED) - this.walking) * Math.min(1, dt * 10);
    this.show(walkPose(this.stride, this.walking), dt, false, 30);
    if (mag > 0.01) {
      const sin = Math.sin(camYaw);
      const cos = Math.cos(camYaw);
      // Camera forward is (-sin, -cos) and camera right is (cos, -sin) in the x-z plane.
      const dx = (cos * moveX - sin * moveY) / mag;
      const dz = (-sin * moveX - cos * moveY) / mag;
      let x = Math.min(Math.max(this.position.x + dx * this.speed * dt, hf.minX + 1), hf.maxX - 1);
      let z = Math.min(Math.max(this.position.z + dz * this.speed * dt, hf.minZ + 1), hf.maxZ - 1);
      // Walk round trees, not through them. (Fast travel is a debug aid and goes through.)
      const tree = fast ? null : obstacleAt(x, z, BODY_RADIUS);
      const bump = tree && pushOut(x, z, BODY_RADIUS, tree);
      if (bump) {
        x = bump.x;
        z = bump.z;
      }
      this.position.set(x, hf.heightAt(x, z), z);

      const want = Math.atan2(-dx, -dz);
      this.travelHeading = want;
      let diff = want - this.heading;
      diff = Math.atan2(Math.sin(diff), Math.cos(diff));
      this.heading += diff * Math.min(1, dt * 12);
      this.object.rotation.y = this.heading;
    }
  }

  private ski(
    dt: number,
    input: SkiInput,
    hf: Heightfield,
    groomedAt: (x: number, z: number) => boolean,
    obstacleAt: (x: number, z: number, radius: number) => Obstacle | null,
  ): void {
    const before = this.position.clone();
    let after = advanceSki({ ...this.skiState, x: before.x, z: before.z, heading: this.heading }, input, hf, groomedAt, dt);
    // A tree is a bump, not a crash: the skier is nudged clear and loses speed, more the squarer the hit.
    const tree = obstacleAt(after.x, after.z, BODY_RADIUS);
    const bump = tree && pushOut(after.x, after.z, BODY_RADIUS, tree);
    if (bump) after = { ...after, x: bump.x, z: bump.z, ...deflect(after.vx, after.vz, bump) };
    const x = Math.min(Math.max(after.x, hf.minX + 1), hf.maxX - 1);
    const z = Math.min(Math.max(after.z, hf.minZ + 1), hf.maxZ - 1);
    // Running into the edge of the map is a stop, not a slide along it.
    this.skiState = x === after.x && z === after.z ? after : skierAt(x, z, after.heading);
    this.heading = after.heading;
    this.position.set(x, hf.heightAt(x, z), z);
    // Speed down the slope, not just across the map.
    this.speed = dt > 0 ? this.position.distanceTo(before) / dt : 0;

    // The camera follows where the skier is going, which in a hockey stop is not where the skis
    // point. At a standstill it follows the skis, so stepping round shows the new view.
    const ground = speedOf(this.skiState);
    this.travelHeading = ground > 1.5 ? travelYaw(this.skiState) : ground < 0.1 ? this.heading : this.travelHeading;

    // The nose follows the slope, and the body tips into a carve and away from a skid.
    const ease = Math.min(1, dt * 8);
    const sideways = ground > 0.5 ? (this.skiState.vx * Math.cos(this.heading) - this.skiState.vz * Math.sin(this.heading)) / ground : 0;
    const want = -this.skiState.lean * 0.34 * Math.min(1, ground / 6) + sideways * 0.5 * Math.min(1, ground / 5);
    this.lean += (want - this.lean) * ease;
    this.object.rotation.set(-Math.asin(descentAlong(hf, x, z, this.heading)), this.heading, this.lean);
    // Standing tall at rest, a skier's stance once moving, folding into a tuck or sitting back to stop.
    const moving = Math.min(1, ground / 2.5);
    this.show(mixPose(STANDING, skiPose(input.tuck, ground > 0.5 ? input.brake : 0), Math.max(moving, input.tuck)), dt, true);
  }
}
