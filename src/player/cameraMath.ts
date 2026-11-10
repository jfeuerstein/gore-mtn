/** Camera maths that does not need three.js, so it can be unit tested. */

const DEG = Math.PI / 180;
const MIN_VERTICAL_FOV = 55;
const MAX_VERTICAL_FOV = 80;
const MIN_HORIZONTAL_FOV = 42;

/**
 * Vertical field of view, in degrees, for a screen of the given width / height.
 * A wide screen gets a modest vertical angle. An upright phone is so narrow that the same angle
 * would feel like looking through a letterbox turned on its side, so the angle widens until the
 * view is at least 42 degrees across, up to a limit that keeps the top and bottom from stretching.
 */
export function verticalFovDeg(aspect: number): number {
  const needed = (2 * Math.atan(Math.tan((MIN_HORIZONTAL_FOV / 2) * DEG) / aspect)) / DEG;
  return Math.min(MAX_VERTICAL_FOV, Math.max(MIN_VERTICAL_FOV, needed));
}

export interface Framing {
  fovDeg: number;
  /** Camera distance behind the player, in metres. */
  distance: number;
  /**
   * How far above the player the camera aims, as a fraction of `distance`. Aiming high pushes the
   * player down the screen. On an upright phone they sit just below the middle: low enough to
   * leave the top half for the mountain, high enough to stay clear of the thumb, which rests in
   * the bottom third.
   */
  aimLift: number;
  /** Starting camera pitch, in radians. */
  pitch: number;
}

/**
 * @param zoom multiplies the camera distance; above 1 pulls back.
 *
 * On an upright phone the camera sits well back and high, looking down at about 35 degrees. The
 * player is small (roughly 7% of the screen height), so a thumb on the stick hides little of what
 * matters, and the ground around them is laid out like a map with the horizon near the top.
 */
export function framingFor(aspect: number, zoom = 1): Framing {
  const fovDeg = verticalFovDeg(aspect);
  // 0 on a wide screen, 1 on an upright phone.
  const upright = (fovDeg - MIN_VERTICAL_FOV) / (MAX_VERTICAL_FOV - MIN_VERTICAL_FOV);
  return {
    fovDeg,
    distance: (9 + 8.5 * upright) * zoom,
    aimLift: 0.08 + 0.02 * upright,
    pitch: 0.32 + 0.28 * upright,
  };
}

/** Smallest signed difference between two angles, in -PI..PI. */
export function angleDiff(to: number, from: number): number {
  return Math.atan2(Math.sin(to - from), Math.cos(to - from));
}

/** Headings more than this far from the camera's count as walking toward the camera. */
const TOWARD_CAMERA = 2.3;
const FOLLOW_RATE = 1.5;

/**
 * Swing the camera round behind a moving player so one thumb is enough to steer.
 * @param yaw current camera yaw
 * @param heading direction the player is travelling, as a yaw
 * @param amount how hard the stick is pushed, 0..1
 * @returns the new camera yaw
 * Walking toward the camera leaves it where it is, so the player can come back the way they went.
 */
export function followYaw(yaw: number, heading: number, amount: number, dt: number): number {
  const diff = angleDiff(heading, yaw);
  if (Math.abs(diff) > TOWARD_CAMERA) return yaw;
  return yaw + diff * Math.min(1, FOLLOW_RATE * amount * dt);
}
