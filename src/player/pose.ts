/**
 * How the skier holds their body: joint angles for walking, skiing and sitting on a lift.
 * The figure is rigid parts moved by these numbers, with no skeleton or keyframes. No three.js
 * here, so it runs under Vitest. Angles are in radians.
 */
export interface Pose {
  /** Each thigh swung forward from the hip (negative is back). */
  hipL: number;
  hipR: number;
  /** Each knee bent. Never negative. */
  kneeL: number;
  kneeR: number;
  /** The body tipped forward from the hips. */
  torso: number;
  /** Each arm swung forward from the shoulder. */
  shoulderL: number;
  shoulderR: number;
  /** Both arms held out from the sides. */
  armsOut: number;
  /** Both elbows bent. */
  elbow: number;
  /** Which way the ski poles point: 0 straight down, negative trailing behind. */
  poles: number;
  /** Extra height, for the bounce in a step. In model units. */
  bob: number;
}

/** Lengths of the leg, in model units. The figure stands about 2 units tall. */
export const BODY = { boot: 0.16, shin: 0.44, thigh: 0.44 };

const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
const clamp01 = (v: number): number => (v < 0 ? 0 : v > 1 ? 1 : v);

export const STANDING: Pose = {
  hipL: 0,
  hipR: 0,
  kneeL: 0.05,
  kneeR: 0.05,
  torso: 0.03,
  shoulderL: 0.05,
  shoulderR: 0.05,
  armsOut: 0.08,
  elbow: 0.25,
  poles: -0.2,
  bob: 0,
};

/**
 * A stride. `phase` runs on as the walker covers ground; `amount` is 0 standing still and 1 at a
 * full walk, so the walk fades in and out with speed.
 */
export function walkPose(phase: number, amount: number): Pose {
  const a = clamp01(amount);
  const swing = Math.sin(phase);
  // A knee bends as its leg comes through from behind.
  const kneeL = Math.max(0, Math.sin(phase + 1.9));
  const kneeR = Math.max(0, Math.sin(phase + 1.9 + Math.PI));
  return {
    hipL: swing * 0.62 * a,
    hipR: -swing * 0.62 * a,
    kneeL: lerp(STANDING.kneeL, 0.15 + kneeL * 0.95, a),
    kneeR: lerp(STANDING.kneeR, 0.15 + kneeR * 0.95, a),
    torso: lerp(STANDING.torso, 0.12, a),
    // Arms swing against the legs.
    shoulderL: lerp(STANDING.shoulderL, -swing * 0.55, a),
    shoulderR: lerp(STANDING.shoulderR, swing * 0.55, a),
    armsOut: STANDING.armsOut,
    elbow: lerp(STANDING.elbow, 0.5, a),
    poles: STANDING.poles,
    bob: Math.abs(Math.cos(phase)) * 0.05 * a,
  };
}

/**
 * A skier's stance: knees and hips flexed with the feet under the body, hands forward and wide.
 * A tuck folds everything down and brings the hands in front of the chin; a hockey stop sits back
 * a little with the arms wide for balance.
 * @param tuck 0..1
 * @param brake 0..1
 */
export function skiPose(tuck: number, brake: number): Pose {
  const t = clamp01(tuck);
  const b = clamp01(brake) * (1 - t);
  const knee = 0.6 + 1.25 * t + 0.35 * b;
  return {
    // Half the knee's bend at the hip keeps each foot directly under it.
    hipL: knee / 2,
    hipR: knee / 2,
    kneeL: knee,
    kneeR: knee,
    torso: 0.3 + 0.75 * t - 0.1 * b,
    shoulderL: lerp(0.45, 1.25, t),
    shoulderR: lerp(0.45, 1.25, t),
    armsOut: lerp(0.38, 0.06, t) + 0.4 * b,
    elbow: lerp(0.7, 1.5, t),
    poles: lerp(-0.45, -1.35, t),
    bob: 0,
  };
}

/** Sitting on a chairlift: thighs level, shins hanging, hands in the lap. */
export const SEATED: Pose = {
  hipL: 1.45,
  hipR: 1.45,
  kneeL: 1.5,
  kneeR: 1.5,
  torso: -0.08,
  shoulderL: 0.55,
  shoulderR: 0.55,
  armsOut: 0.05,
  elbow: 0.95,
  poles: -1.2,
  bob: 0,
};

/** How high the bike's pedals sit above the ground at the bottom of their turn, in model units. */
export const PEDAL_LOW = 0.12;

/**
 * Riding a bike: sat on the saddle, leaning to the bars, feet on the pedals. The legs go round
 * with `phase` when pedalling; coasting, they hold level. A tuck drops the chest to the bars and
 * braking sits the rider back.
 * @param pedalling 0 coasting, 1 pedalling
 */
export function ridePose(phase: number, pedalling: number, tuck: number, brake: number): Pose {
  const t = clamp01(tuck);
  const b = clamp01(brake) * (1 - t);
  const turn = Math.sin(phase) * clamp01(pedalling);
  // One knee comes up as the other goes down; level pedals when coasting.
  const hip = (s: number): number => 1.0 + s * 0.28;
  const knee = (s: number): number => 1.36 + s * 0.42;
  return {
    hipL: hip(turn),
    hipR: hip(-turn),
    kneeL: knee(turn),
    kneeR: knee(-turn),
    torso: 0.62 + 0.4 * t - 0.2 * b,
    shoulderL: 1.25 + 0.15 * t - 0.15 * b,
    shoulderR: 1.25 + 0.15 * t - 0.15 * b,
    armsOut: 0.16,
    elbow: 0.3 + 0.55 * t,
    poles: -1.2,
    // The legs do not reach the ground: this lifts the rider to where the saddle is.
    bob: PEDAL_LOW + 0.1,
  };
}

export function mixPose(a: Pose, b: Pose, t: number): Pose {
  const k = clamp01(t);
  const out = { ...a };
  for (const key of Object.keys(a) as (keyof Pose)[]) out[key] = lerp(a[key], b[key], k);
  return out;
}

/**
 * How high the hips are above the soles for a pose, in model units: the height of whichever leg
 * reaches lower, since that is the one standing on the ground (or hanging lowest from a chair).
 */
export function hipHeight(pose: Pose): number {
  const leg = (hip: number, knee: number): number => BODY.thigh * Math.cos(hip) + BODY.shin * Math.cos(hip - knee) + BODY.boot;
  return Math.max(leg(pose.hipL, pose.kneeL), leg(pose.hipR, pose.kneeR)) + pose.bob;
}
