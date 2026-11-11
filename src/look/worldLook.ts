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

/**
 * Part of a printed picture, enlarged, with its inks kept apart. Stretched in the ordinary way,
 * a print goes soft: where two inks meet, the stretch blends them. Here each new pixel takes
 * one of the inks of the four old pixels round it, whichever has the most weight there, so the
 * edge between two inks stays an edge, and runs smoothly where the old pixels made a staircase.
 * This is what keeps the ground a print when it is seen from a few metres up.
 *
 * @param src the printed picture, four bytes to a pixel
 * @param x0 the left and top of the part wanted, and its size, in the picture's pixels (fractions allowed)
 * @param out where the enlargement goes, four bytes to a pixel, `outW` by `rows` of it
 * @param fromRow the first row of the enlargement to fill, for doing a few rows at a time
 */
export function enlarge(
  src: Uint8ClampedArray,
  srcW: number,
  srcH: number,
  x0: number,
  y0: number,
  w: number,
  h: number,
  out: Uint8ClampedArray,
  outW: number,
  outH: number,
  fromRow = 0,
  rows = outH,
): void {
  const end = Math.min(outH, fromRow + rows);
  for (let j = fromRow; j < end; j++) {
    // Where the middle of this pixel falls among the middles of the old ones.
    const sy = y0 + ((j + 0.5) / outH) * h - 0.5;
    const ya = Math.min(srcH - 1, Math.max(0, Math.floor(sy)));
    const yb = Math.min(srcH - 1, ya + 1);
    const fy = Math.min(1, Math.max(0, sy - ya));
    for (let i = 0; i < outW; i++) {
      const sx = x0 + ((i + 0.5) / outW) * w - 0.5;
      const xa = Math.min(srcW - 1, Math.max(0, Math.floor(sx)));
      const xb = Math.min(srcW - 1, xa + 1);
      const fx = Math.min(1, Math.max(0, sx - xa));
      const p00 = (ya * srcW + xa) * 4;
      const p10 = (ya * srcW + xb) * 4;
      const p01 = (yb * srcW + xa) * 4;
      const p11 = (yb * srcW + xb) * 4;
      const k00 = ((src[p00] as number) << 16) | ((src[p00 + 1] as number) << 8) | (src[p00 + 2] as number);
      const k10 = ((src[p10] as number) << 16) | ((src[p10 + 1] as number) << 8) | (src[p10 + 2] as number);
      const k01 = ((src[p01] as number) << 16) | ((src[p01 + 1] as number) << 8) | (src[p01 + 2] as number);
      const k11 = ((src[p11] as number) << 16) | ((src[p11 + 1] as number) << 8) | (src[p11 + 2] as number);
      let from = p00;
      // Most of the ground is one ink for a long way: nothing to weigh.
      if (k00 !== k10 || k00 !== k01 || k00 !== k11) {
        const w00 = (1 - fx) * (1 - fy);
        const w10 = fx * (1 - fy);
        const w01 = (1 - fx) * fy;
        const w11 = fx * fy;
        // Each corner's ink weighs what all the corners of that ink weigh together.
        const s00 = w00 + (k10 === k00 ? w10 : 0) + (k01 === k00 ? w01 : 0) + (k11 === k00 ? w11 : 0);
        const s10 = w10 + (k00 === k10 ? w00 : 0) + (k01 === k10 ? w01 : 0) + (k11 === k10 ? w11 : 0);
        const s01 = w01 + (k00 === k01 ? w00 : 0) + (k10 === k01 ? w10 : 0) + (k11 === k01 ? w11 : 0);
        const s11 = w11 + (k00 === k11 ? w00 : 0) + (k10 === k11 ? w10 : 0) + (k01 === k11 ? w01 : 0);
        let best = s00;
        if (s10 > best) {
          best = s10;
          from = p10;
        }
        if (s01 > best) {
          best = s01;
          from = p01;
        }
        if (s11 > best) from = p11;
      }
      const o = (j * outW + i) * 4;
      out[o] = src[from] as number;
      out[o + 1] = src[from + 1] as number;
      out[o + 2] = src[from + 2] as number;
      out[o + 3] = 255;
    }
  }
}
