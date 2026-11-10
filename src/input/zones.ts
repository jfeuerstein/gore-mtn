export type TouchRole = 'stick' | 'look';

/** The share of an upright screen, measured from the top, that turns the camera. */
export const LOOK_ZONE_PORTRAIT = 0.66;

/**
 * Decide what a new touch does.
 *
 * Upright phone (the way the game is meant to be played): the bottom third of the screen is the
 * movement stick, where the thumb rests; everything above it drags the camera. Wide screens split left
 * and right instead. While the stick is already held, any other finger turns the camera.
 */
export function touchRole(x: number, y: number, width: number, height: number, stickHeld: boolean): TouchRole {
  if (stickHeld) return 'look';
  if (height >= width) return y >= height * LOOK_ZONE_PORTRAIT ? 'stick' : 'look';
  return x < width / 2 ? 'stick' : 'look';
}
