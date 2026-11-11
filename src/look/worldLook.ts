import type { Season } from './season';

/**
 * The land as a screen print. The pipeline paints two pictures of it (the ground up close and
 * the forest from afar); when the game loads, every pixel of each becomes the nearest of a
 * handful of inks for the season, so the land is flat shapes with hard edges, as on a park
 * poster. `plain` leaves the pictures as they came, to set beside it.
 *
 * Pure: it works on bytes, so it runs under Vitest, and the same bytes go to WebGPU and WebGL.
 */
export type WorldLook = 'plain' | 'poster';
export const WORLD_LOOKS: readonly WorldLook[] = ['plain', 'poster'];

/** The inks of each season's print. */
export const INKS: Record<Season, readonly number[]> = {
  // Cream snow, three blues of shade, spruce and navy.
  winter: [0xfbf8ee, 0xc3d3ea, 0x8fa5cc, 0x5d7396, 0x4d6b78, 0x2c4a52, 0x22304a, 0xb59a78],
  // Old snow, thaw, khaki, olive, umber, pine, bud green.
  spring: [0xf4f1e6, 0xcfdcea, 0xa8a077, 0x7d8a52, 0x7a6650, 0x365543, 0xb9c47a, 0x9aa0a0, 0x3d86a0],
  // Cream, sage, meadow, forest, pine, deep pine, water, path.
  summer: [0xf1e9cf, 0xa9c98a, 0x6fa35c, 0x3f7d54, 0x2a5f4a, 0x1f4a44, 0x3d86a0, 0xc9a36b, 0xa08a66],
  // Cream, gold, orange, rust, maroon, pine, path, water.
  fall: [0xf1e9cf, 0xe3b03f, 0xd9772b, 0xb3472d, 0x7a3340, 0x2f5d4c, 0xc9a36b, 0x3d86a0, 0x8c6a48],
};

/** The nearest of some inks to a colour. */
export function nearestInk(inks: readonly number[], r: number, g: number, b: number): number {
  let best = inks[0] as number;
  let least = Infinity;
  for (const ink of inks) {
    const dr = ((ink >> 16) & 255) - r;
    const dg = ((ink >> 8) & 255) - g;
    const db = (ink & 255) - b;
    // Green counts for most, as it does to the eye.
    const d = dr * dr * 3 + dg * dg * 4 + db * db * 2;
    if (d < least) {
      least = d;
      best = ink;
    }
  }
  return best;
}

/**
 * Repaint a picture of the land in place.
 * @param rgba the picture's bytes, four to a pixel
 */
export function restyle(rgba: Uint8ClampedArray, look: WorldLook, season: Season): void {
  if (look === 'plain') return;
  const inks = INKS[season];
  // Colours repeat: the answer for each is worked out once.
  const known = new Map<number, number>();
  for (let i = 0; i < rgba.length; i += 4) {
    const key = ((rgba[i] as number) << 16) | ((rgba[i + 1] as number) << 8) | (rgba[i + 2] as number);
    let ink = known.get(key);
    if (ink === undefined) {
      ink = nearestInk(inks, rgba[i] as number, rgba[i + 1] as number, rgba[i + 2] as number);
      known.set(key, ink);
    }
    rgba[i] = (ink >> 16) & 255;
    rgba[i + 1] = (ink >> 8) & 255;
    rgba[i + 2] = ink & 255;
  }
}
