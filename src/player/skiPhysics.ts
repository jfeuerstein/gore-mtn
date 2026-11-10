/**
 * Skiing, as a small simulation with no rendering in it so it can be tested and tuned in Node.
 *
 * The skier is a point on the ground with a heading (the way the skis point) and a speed along
 * the skis. Skis go where they point: gravity pulls along the slope in that direction, edges hold
 * against sliding sideways, and snow friction, air drag, turning and braking slow things down.
 *
 * Speeds are tuned for the game's compressed mountain, not for realism: about 8 m/s on a green,
 * 12 on a blue and 15 on a black, more in a tuck. A run takes most of a minute.
 */

export interface SkiGround {
  /** Upward unit normal of the ground as [x, y, z]. */
  normalAt(x: number, z: number): [number, number, number];
}

export interface SkiState {
  x: number;
  z: number;
  /** Direction the skis point, as a yaw: 0 is north (-z), positive turns left. */
  heading: number;
  /** Speed along the skis in m/s. Never negative: skis do not slide backwards. */
  speed: number;
}

export interface SkiInput {
  /** -1 turns hard left, 1 turns hard right. */
  steer: number;
  /** 0..1. Crouch to cut drag; from a standstill or on the flat, push with the poles. */
  tuck: number;
  /** 0..1. Snowplough. */
  brake: number;
}

export interface SkiParams {
  /** Pull of gravity, m/s^2. Lower than real, for an unhurried build-up of speed. */
  gravity: number;
  /** Sliding friction on a groomed trail. */
  friction: number;
  /** Sliding friction in ungroomed snow off the trails. */
  powderFriction: number;
  /** Friction to overcome before the skis start to slide from rest. */
  staticFriction: number;
  /** Air drag, per metre. Sets the top speed on a given slope. */
  drag: number;
  /** Drag multiplier in ungroomed snow. */
  powderDrag: number;
  /** Drag multiplier in a full tuck. */
  tuckDrag: number;
  /** Turn rate at a standstill, rad/s. */
  turnRate: number;
  /** Speed at which the turn rate has halved, m/s. Faster means wider turns. */
  turnSpeedRef: number;
  /** Speed lost to a full-lock turn, per second, as a fraction of speed. */
  turnScrub: number;
  /** Braking deceleration at low speed, m/s^2, and the extra per m/s of speed. */
  brakeBase: number;
  brakeGain: number;
  /** Pole push: acceleration from rest, and the speed at which it gives out. */
  poleAccel: number;
  poleMaxSpeed: number;
}

export const SKI: SkiParams = {
  gravity: 6,
  friction: 0.05,
  powderFriction: 0.12,
  staticFriction: 0.08,
  drag: 0.0158,
  powderDrag: 1.5,
  tuckDrag: 0.5,
  turnRate: 2.6,
  turnSpeedRef: 15,
  turnScrub: 0.18,
  brakeBase: 4.5,
  brakeGain: 0.5,
  poleAccel: 3,
  poleMaxSpeed: 4,
};

const clamp01 = (v: number): number => (v < 0 ? 0 : v > 1 ? 1 : v);

/** Vertical travel of the thumb before it counts as a tuck or a brake, so steering alone does neither. */
const VERTICAL_DEAD_ZONE = 0.3;

/**
 * One thumb skis: left and right steer, up tucks, down brakes.
 * @param x stick right (+) and left (-)
 * @param y stick up (+) and down (-)
 */
export function stickToSki(x: number, y: number): SkiInput {
  const beyond = (v: number): number => clamp01((v - VERTICAL_DEAD_ZONE) / (1 - VERTICAL_DEAD_ZONE));
  return { steer: Math.max(-1, Math.min(1, x)), tuck: beyond(y), brake: beyond(-y) };
}

/**
 * How steeply the ground falls in the direction of `heading`: the sine of the slope angle,
 * positive downhill and negative uphill.
 */
export function descentAlong(ground: SkiGround, x: number, z: number, heading: number): number {
  const [nx, ny, nz] = ground.normalAt(x, z);
  const fx = -Math.sin(heading);
  const fz = -Math.cos(heading);
  // Project the level forward direction onto the slope.
  const dot = fx * nx + fz * nz;
  const tx = fx - nx * dot;
  const ty = -ny * dot;
  const tz = fz - nz * dot;
  const len = Math.hypot(tx, ty, tz) || 1;
  return -ty / len;
}

/** The yaw that points straight down the slope at a position. */
export function fallLineYaw(ground: SkiGround, x: number, z: number): number {
  const [nx, , nz] = ground.normalAt(x, z);
  return Math.atan2(-nx, -nz);
}

/** Advance the skier by `dt` seconds. Keep `dt` small (see SKI_STEP). */
export function stepSki(
  s: SkiState,
  input: SkiInput,
  ground: SkiGround,
  groomed: boolean,
  dt: number,
  p: SkiParams = SKI,
): SkiState {
  const sinA = descentAlong(ground, s.x, s.z, s.heading);
  const cosA = Math.sqrt(Math.max(0, 1 - sinA * sinA));
  const steer = Math.max(-1, Math.min(1, input.steer));

  let push = p.gravity * sinA;
  if (input.tuck > 0 && s.speed < p.poleMaxSpeed) {
    push += p.poleAccel * input.tuck * (1 - s.speed / p.poleMaxSpeed);
  }

  let speed: number;
  if (s.speed <= 0) {
    // At rest the skis stay put until something beats static friction and the snowplough.
    const hold = p.gravity * p.staticFriction * cosA + input.brake * p.brakeBase;
    speed = push > hold ? (push - hold) * dt : 0;
  } else {
    const mu = groomed ? p.friction : p.powderFriction;
    const k = p.drag * (groomed ? 1 : p.powderDrag) * (1 - (1 - p.tuckDrag) * input.tuck);
    const resist =
      p.gravity * mu * cosA +
      k * s.speed * s.speed +
      p.turnScrub * Math.abs(steer) * s.speed +
      input.brake * (p.brakeBase + p.brakeGain * s.speed);
    speed = Math.max(0, s.speed + (push - resist) * dt);
  }

  // Positive steer turns right, which is a falling yaw.
  const heading = s.heading - (steer * p.turnRate * dt) / (1 + s.speed / p.turnSpeedRef);
  // Speed is measured along the slope; over the ground it is foreshortened by the pitch.
  const flat = speed * cosA * dt;
  return { x: s.x - Math.sin(heading) * flat, z: s.z - Math.cos(heading) * flat, heading, speed };
}

/** Longest step the simulation should take at once, in seconds. */
export const SKI_STEP = 1 / 120;

/** Advance by a whole frame, in equal steps no longer than SKI_STEP. */
export function advanceSki(
  s: SkiState,
  input: SkiInput,
  ground: SkiGround,
  groomedAt: (x: number, z: number) => boolean,
  dt: number,
  p: SkiParams = SKI,
): SkiState {
  const steps = Math.max(1, Math.ceil(dt / SKI_STEP));
  let state = s;
  for (let i = 0; i < steps; i++) state = stepSki(state, input, ground, groomedAt(state.x, state.z), dt / steps, p);
  return state;
}
