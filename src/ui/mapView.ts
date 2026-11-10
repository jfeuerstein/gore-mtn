/**
 * How the trail map lays the mountain on the screen. No DOM here, so it runs under Vitest.
 *
 * The map is drawn the way ski maps are: looking at the mountain from its foot, with the summit at
 * the top. For Gore that means west is up and north is to the right. It also suits an upright
 * phone, because the mountain is longer east to west than north to south.
 */
export interface Bounds {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

export interface MapView {
  /** Size of the drawing, in the same units as the width and height it was fitted to. */
  width: number;
  height: number;
  /** Drawing units per metre. */
  scale: number;
  /** World position to a point on the drawing: u across, v down. */
  toMap(x: number, z: number): { u: number; v: number };
  /** A point on the drawing back to a world position. */
  toWorld(u: number, v: number): { x: number; z: number };
  /** Angle on the drawing, clockwise from up, for a yaw in the world. */
  toMapAngle(yaw: number): number;
}

/** Fit the bounds, plus a margin in metres, inside a box, keeping proportions. */
export function fitMap(bounds: Bounds, maxWidth: number, maxHeight: number, margin = 0): MapView {
  const minX = bounds.minX - margin;
  const maxZ = bounds.maxZ + margin;
  // West is up, so the drawing is as tall as the mountain is long east to west.
  const across = bounds.maxZ - bounds.minZ + margin * 2;
  const down = bounds.maxX - bounds.minX + margin * 2;
  const scale = Math.min(maxWidth / across, maxHeight / down);
  return {
    width: across * scale,
    height: down * scale,
    scale,
    toMap: (x, z) => ({ u: (maxZ - z) * scale, v: (x - minX) * scale }),
    toWorld: (u, v) => ({ x: minX + v / scale, z: maxZ - u / scale }),
    // Yaw 0 faces north (right on the map); yaw PI/2 faces west (up on the map).
    toMapAngle: (yaw) => Math.PI / 2 - yaw,
  };
}

/** The smallest box around a set of flat x, z lists. */
export function boundsOf(lists: readonly (readonly number[])[]): Bounds {
  const b = { minX: Infinity, maxX: -Infinity, minZ: Infinity, maxZ: -Infinity };
  for (const pts of lists) {
    for (let i = 0; i + 1 < pts.length; i += 2) {
      const x = pts[i] as number;
      const z = pts[i + 1] as number;
      if (x < b.minX) b.minX = x;
      if (x > b.maxX) b.maxX = x;
      if (z < b.minZ) b.minZ = z;
      if (z > b.maxZ) b.maxZ = z;
    }
  }
  return b;
}
