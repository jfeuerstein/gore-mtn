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

/** Where the map is looking: how far in, and the spot in the world at the middle of it. */
export interface MapCamera {
  /** 1 shows the whole mountain. */
  zoom: number;
  x: number;
  z: number;
}

/** As far in as the map goes: about a city block across the screen. */
export const MAX_ZOOM = 12;

/** The whole of the bounds, as seen from the middle. */
export function wholeMap(bounds: Bounds): MapCamera {
  return { zoom: 1, x: (bounds.minX + bounds.maxX) / 2, z: (bounds.minZ + bounds.maxZ) / 2 };
}

/**
 * The map as a window of a set size, looking where the camera says. At zoom 1 the bounds and
 * their margin just fit; further in, the window shows part of them.
 */
export function lookAt(bounds: Bounds, width: number, height: number, camera: MapCamera, margin = 0): MapView {
  const across = bounds.maxZ - bounds.minZ + margin * 2;
  const down = bounds.maxX - bounds.minX + margin * 2;
  const scale = Math.min(width / across, height / down) * camera.zoom;
  return {
    width,
    height,
    scale,
    // West is up and north is to the right, as in fitMap.
    toMap: (x, z) => ({ u: width / 2 + (camera.z - z) * scale, v: height / 2 + (x - camera.x) * scale }),
    toWorld: (u, v) => ({ x: camera.x + (v - height / 2) / scale, z: camera.z - (u - width / 2) / scale }),
    toMapAngle: (yaw) => Math.PI / 2 - yaw,
  };
}

/**
 * The camera kept to sensible limits: no nearer or further than allowed, and never looking off the map.
 * @param reach how far the window may be slid, where that is further than the bounds the map is fitted to:
 *   the map is fitted to the trails, but the town lies beyond them
 */
export function clampCamera(bounds: Bounds, width: number, height: number, camera: MapCamera, margin = 0, reach: Bounds = bounds): MapCamera {
  const zoom = Math.min(MAX_ZOOM, Math.max(1, camera.zoom));
  const scale = lookAt(bounds, width, height, { ...camera, zoom }, margin).scale;
  const keep = (at: number, min: number, max: number, half: number): number => {
    // If the window shows the whole span, it is centred on it; otherwise its edge stops at the map's.
    if (half * 2 >= max - min) return (min + max) / 2;
    return Math.min(max - half, Math.max(min + half, at));
  };
  return {
    zoom,
    x: keep(camera.x, Math.min(reach.minX, bounds.minX - margin), Math.max(reach.maxX, bounds.maxX + margin), height / 2 / scale),
    z: keep(camera.z, Math.min(reach.minZ, bounds.minZ - margin), Math.max(reach.maxZ, bounds.maxZ + margin), width / 2 / scale),
  };
}

/** Zoom by a factor, keeping whatever is under a point of the window where it is. */
export function zoomAbout(bounds: Bounds, width: number, height: number, camera: MapCamera, u: number, v: number, factor: number, margin = 0, reach: Bounds = bounds): MapCamera {
  const before = lookAt(bounds, width, height, camera, margin);
  const held = before.toWorld(u, v);
  const zoom = Math.min(MAX_ZOOM, Math.max(1, camera.zoom * factor));
  const after = lookAt(bounds, width, height, { ...camera, zoom }, margin);
  const now = after.toWorld(u, v);
  return clampCamera(bounds, width, height, { zoom, x: camera.x + held.x - now.x, z: camera.z + held.z - now.z }, margin, reach);
}

/** Slide the map under a finger that has moved by (du, dv) on the window. */
export function panBy(bounds: Bounds, width: number, height: number, camera: MapCamera, du: number, dv: number, margin = 0, reach: Bounds = bounds): MapCamera {
  const scale = lookAt(bounds, width, height, camera, margin).scale;
  return clampCamera(bounds, width, height, { zoom: camera.zoom, x: camera.x - dv / scale, z: camera.z + du / scale }, margin, reach);
}

/**
 * How far off something is, and which way to turn to face it.
 * @returns metres, and the turn in radians from the way `yaw` faces: positive is to the left
 */
export function wayTo(from: { x: number; z: number; yaw: number }, to: { x: number; z: number }): { metres: number; turn: number } {
  const dx = to.x - from.x;
  const dz = to.z - from.z;
  // Yaw 0 faces north (-z); positive yaw turns left, toward the west (-x).
  let turn = Math.atan2(-dx, -dz) - from.yaw;
  turn = Math.atan2(Math.sin(turn), Math.cos(turn));
  return { metres: Math.hypot(dx, dz), turn };
}

/** A distance as it is said in upstate New York: feet when it is near, miles when it is not. */
export function sayDistance(metres: number): string {
  const feet = metres * 3.28084;
  if (feet < 1000) return `${Math.max(10, Math.round(feet / 10) * 10)} ft`;
  return `${(feet / 5280).toFixed(1)} mi`;
}
