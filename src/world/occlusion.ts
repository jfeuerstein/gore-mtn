/** Sight-line maths with no three.js in it, so it runs under Vitest. */

export interface Point3 {
  x: number;
  y: number;
  z: number;
}

/**
 * Whether an upright object (a tree) stands in the way of the camera's view of the player.
 *
 * The object is treated as a cylinder of the given `radius` and `height` standing at `base`. It
 * blocks the view when the line from the player to the camera passes within `radius` of its axis,
 * somewhere between the two, at a height below its top.
 */
export function blocksSightLine(player: Point3, camera: Point3, base: Point3, radius: number, height: number): boolean {
  const dx = camera.x - player.x;
  const dz = camera.z - player.z;
  const lenSq = dx * dx + dz * dz;
  if (lenSq < 1e-6) return false;
  // Closest approach of the sight line to the object's axis, seen from above.
  const t = ((base.x - player.x) * dx + (base.z - player.z) * dz) / lenSq;
  const reach = radius / Math.sqrt(lenSq);
  // Skip objects at the player's own feet and anything behind the player or the camera.
  if (t < reach * 0.5 || t > 1 + reach) return false;
  const tc = Math.min(1, t);
  const ox = player.x + dx * tc - base.x;
  const oz = player.z + dz * tc - base.z;
  if (ox * ox + oz * oz > radius * radius) return false;
  const lineY = player.y + (camera.y - player.y) * tc;
  return lineY < base.y + height;
}
