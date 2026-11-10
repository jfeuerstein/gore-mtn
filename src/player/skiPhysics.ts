/**
 * Skiing, as a small simulation with no rendering in it so it can be tested and tuned in Node.
 *
 * The skier has a position, a velocity over the ground, and a heading: the way the skis point.
 * Those last two are separate, and that is where the feel comes from.
 *
 * - Along the skis, snow is slippery: gravity speeds the skier up, friction and air slow them down.
 * - Across the skis, the edges bite. In a turn they bend the skier's path round to follow the
 *   skis, up to a limit. Ask for more than that (a hard turn at speed) and the skis drift wide,
 *   scrubbing speed: momentum carries the skier on.
 * - Braking is a hockey stop: the skis swing sideways to the direction of travel and scrape the
 *   speed off.
 *
 * Speeds are tuned for the game's mountain, not for realism: roughly 13 m/s (29 mph) on a green,
 * 17 (38) on a blue and 21 (47) on a black, and a third more in a tuck.
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
  /** Velocity over the ground, m/s. */
  vx: number;
  vz: number;
  /** How far the skier is tipped into a turn, -1 (left) to 1 (right). Follows the thumb with a short lag. */
  lean: number;
}

export interface SkiInput {
  /** -1 turns hard left, 1 turns hard right. */
  steer: number;
  /** 0..1. Crouch to cut drag; from a standstill or on the flat, push with the poles. */
  tuck: number;
  /** 0..1. Hockey stop. */
  brake: number;
}

export interface SkiParams {
  /** Pull of gravity, m/s^2. A little under real, so speed builds over a few seconds. */
  gravity: number;
  /** Sliding friction along the skis on a groomed trail, and in ungroomed snow. */
  friction: number;
  powderFriction: number;
  /** Friction to overcome before the skis start to slide from rest. */
  staticFriction: number;
  /** Air drag, per metre. Sets the top speed on a given slope. */
  drag: number;
  /** Drag multiplier in ungroomed snow, and in a full tuck. */
  powderDrag: number;
  tuckDrag: number;

  /** Seconds for the skier's lean to catch up with the thumb. Gives turns their rhythm. */
  leanTime: number;
  /** Turn rate when stepping round at a standstill, rad/s, and the speed over which that fades out. */
  pivotRate: number;
  pivotFade: number;
  /** Tightest carved turn at full lean, metres. Turn rate rises with speed up to `maxTurnRate`. */
  carveRadius: number;
  maxTurnRate: number;

  /** How quickly the edges pull the skier's path into line with the skis, per second. */
  grip: number;
  /** Most sideways acceleration the edges can give while carving, m/s^2. Beyond it the skis drift. */
  edgeHold: number;
  /** Sideways deceleration when sliding broadside with no brake, and with full brake, m/s^2. */
  skidFriction: number;
  brakeFriction: number;
  /** Slip angles (radians between skis and travel) where carving gives way to skidding. */
  slipCarve: number;
  slipSkid: number;
  /** How fast the skis swing sideways into a hockey stop, rad/s. */
  brakeTurnRate: number;

  /** Pole push: acceleration from rest, and the speed at which it gives out. */
  poleAccel: number;
  poleMaxSpeed: number;
}

export const SKI: SkiParams = {
  gravity: 9,
  friction: 0.04,
  powderFriction: 0.11,
  staticFriction: 0.07,
  drag: 0.009,
  powderDrag: 1.6,
  tuckDrag: 0.55,

  leanTime: 0.16,
  pivotRate: 2.6,
  pivotFade: 4,
  carveRadius: 8,
  maxTurnRate: 2.3,

  grip: 12,
  edgeHold: 22,
  skidFriction: 3,
  brakeFriction: 10,
  slipCarve: 0.25,
  slipSkid: 0.8,
  brakeTurnRate: 7,

  poleAccel: 3.5,
  poleMaxSpeed: 5,
};

const clamp = (v: number, lo: number, hi: number): number => (v < lo ? lo : v > hi ? hi : v);
const wrap = (a: number): number => Math.atan2(Math.sin(a), Math.cos(a));
const smoothstep = (a: number, b: number, v: number): number => {
  const t = clamp((v - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};

/** Below this the skier counts as standing still. */
const REST_SPEED = 0.08;
/** Vertical travel of the thumb before it counts as a tuck or a brake, so steering alone does neither. */
const VERTICAL_DEAD_ZONE = 0.3;

/** A skier standing still at a position, facing `heading`. */
export function skierAt(x: number, z: number, heading: number): SkiState {
  return { x, z, heading, vx: 0, vz: 0, lean: 0 };
}

export function speedOf(s: SkiState): number {
  return Math.hypot(s.vx, s.vz);
}

/** The yaw the skier is travelling along. Only meaningful when moving. */
export function travelYaw(s: SkiState): number {
  return Math.atan2(-s.vx, -s.vz);
}

/** Signed angle from the direction of travel to the skis: 0 when carving cleanly, about ±PI/2 in a hockey stop. */
export function slipAngle(s: SkiState): number {
  return speedOf(s) < REST_SPEED ? 0 : wrap(s.heading - travelYaw(s));
}

/**
 * One thumb skis: left and right steer, up tucks, down brakes.
 * @param x stick right (+) and left (-)
 * @param y stick up (+) and down (-)
 */
export function stickToSki(x: number, y: number): SkiInput {
  const beyond = (v: number): number => clamp((v - VERTICAL_DEAD_ZONE) / (1 - VERTICAL_DEAD_ZONE), 0, 1);
  return { steer: clamp(x, -1, 1), tuck: beyond(y), brake: beyond(-y) };
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
  const [nx, ny, nz] = ground.normalAt(s.x, s.z);
  // Gravity's pull along the slope, as seen from above: it points downhill.
  const gx = p.gravity * ny * nx;
  const gz = p.gravity * ny * nz;
  const steer = clamp(input.steer, -1, 1);
  const lean = s.lean + (steer - s.lean) * Math.min(1, dt / p.leanTime);
  const speed = speedOf(s);

  if (speed < REST_SPEED) {
    // Standing still. Step the skis round with the thumb; set off only if gravity or the poles
    // beat static friction along the skis. Edges hold against any pull across them.
    const heading = s.heading - lean * p.pivotRate * dt;
    const fx = -Math.sin(heading);
    const fz = -Math.cos(heading);
    const drive = gx * fx + gz * fz + p.poleAccel * input.tuck;
    const hold = p.gravity * p.staticFriction * ny + input.brake * p.brakeFriction;
    // Setting off starts just clear of the resting threshold, so the next step carries on from it.
    const go = drive > hold ? REST_SPEED * 1.5 + (drive - hold) * dt : 0;
    return { x: s.x + fx * go * dt, z: s.z + fz * go * dt, heading, vx: fx * go, vz: fz * go, lean };
  }

  let heading: number;
  if (input.brake > 0.05 && speed > 0.5) {
    // Hockey stop: swing the skis across the direction of travel. Go the way they are already
    // turned, or the way the thumb says.
    const travel = travelYaw(s);
    const offset = wrap(s.heading - travel);
    const side = Math.abs(steer) > 0.3 ? -Math.sign(steer) : offset >= 0 ? 1 : -1;
    const target = travel + side * (Math.PI / 2) * Math.min(1, input.brake * 1.25);
    const turn = p.brakeTurnRate * dt;
    heading = s.heading + clamp(wrap(target - s.heading), -turn, turn);
  } else {
    // Positive lean turns right, which is a falling yaw. Stepping round fades out with speed and
    // carving takes over: turn rate grows with speed, as on a fixed radius, up to a limit.
    const rate = Math.min(p.maxTurnRate, p.pivotRate * Math.exp(-speed / p.pivotFade) + speed / p.carveRadius);
    heading = s.heading - lean * rate * dt;
  }

  const fx = -Math.sin(heading);
  const fz = -Math.cos(heading);
  const rx = Math.cos(heading);
  const rz = -Math.sin(heading);
  let u = s.vx * fx + s.vz * fz; // along the skis
  let w = s.vx * rx + s.vz * rz; // across them, positive to the skier's right

  // Along the skis: gravity, sliding friction, air, and the poles at low speed.
  const mu = groomed ? p.friction : p.powderFriction;
  const k = p.drag * (groomed ? 1 : p.powderDrag) * (1 - (1 - p.tuckDrag) * input.tuck);
  let along = gx * fx + gz * fz - Math.sign(u) * p.gravity * mu * ny - k * speed * u;
  if (input.tuck > 0 && u < p.poleMaxSpeed) along += p.poleAccel * input.tuck * (1 - Math.max(0, u) / p.poleMaxSpeed);

  // Across the skis: the edges try to cancel gravity's sideways pull and any sideways slip.
  // Nearly in line with the direction of travel they hold hard (carving). Broadside they can
  // only scrape (skidding), harder with the brake on.
  const slip = Math.atan2(Math.abs(w), Math.abs(u));
  const skid = smoothstep(p.slipCarve, p.slipSkid, slip);
  const scrape = p.skidFriction + (p.brakeFriction - p.skidFriction) * input.brake;
  const limit = p.edgeHold + (scrape - p.edgeHold) * skid;
  const pull = gx * rx + gz * rz;
  const across = clamp(-p.grip * w - pull, -limit, limit) + pull;

  u += along * dt;
  w += across * dt;
  // Skis do not run backwards: if momentum is spent going uphill, stop there.
  if (u < 0 && Math.abs(w) < 1) u = 0;

  let vx = fx * u + rx * w;
  let vz = fz * u + rz * w;
  if (Math.hypot(vx, vz) < REST_SPEED) {
    vx = 0;
    vz = 0;
  }
  return { x: s.x + vx * dt, z: s.z + vz * dt, heading, vx, vz, lean };
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
