import type { Season } from './season';

/**
 * Looks for the land that are being tried: the pipeline's pictures of the ground and of the
 * far-off forest, repainted when the game loads. `plain` is the pictures as they come.
 *
 * - `poster`: a screen print. Every pixel becomes the nearest of a handful of inks, so the land
 *   is flat shapes with hard edges, as on a park poster.
 * - `topo`: a map. The same inks thinned toward the paper, with a contour line wherever the
 *   ground crosses a round height, a heavier one every fifth.
 *
 * Pure: it works on bytes, so it runs under Vitest, and the same bytes go to WebGPU and WebGL.
 */
export type WorldLook = 'plain' | 'poster' | 'topo';
export const WORLD_LOOKS: readonly WorldLook[] = ['plain', 'poster', 'topo'];

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

/** The paper a map is printed on, and how far its tints are thinned toward it. */
const PAPER = 0xf7f1e3;
const THIN = 0.5;
/** A contour's ink: blue over snow, as on a map of a glacier, and brown over bare ground. */
const LINE: Record<Season, number> = { winter: 0x6b83a6, spring: 0x8a6a48, summer: 0x8a6a48, fall: 0x7a5236 };

export interface Heights {
  cols: number;
  rows: number;
  data: Float32Array;
}

/** The height under a point of a picture laid over the whole heightfield, `u` across and `v` down in 0..1. */
export function heightUnder(h: Heights, u: number, v: number): number {
  const x = Math.min(h.cols - 1, Math.max(0, u * h.cols - 0.5));
  const y = Math.min(h.rows - 1, Math.max(0, v * h.rows - 0.5));
  const c = Math.min(h.cols - 2, Math.floor(x));
  const r = Math.min(h.rows - 2, Math.floor(y));
  const fx = x - c;
  const fy = y - r;
  const at = (cc: number, rr: number): number => h.data[rr * h.cols + cc] as number;
  return (at(c, r) * (1 - fx) + at(c + 1, r) * fx) * (1 - fy) + (at(c, r + 1) * (1 - fx) + at(c + 1, r + 1) * fx) * fy;
}

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

const mix = (a: number, b: number, t: number): number => {
  const ch = (shift: number): number => Math.round(((a >> shift) & 255) + (((b >> shift) & 255) - ((a >> shift) & 255)) * t);
  return (ch(16) << 16) | (ch(8) << 8) | ch(0);
};

/**
 * Repaint a picture of the land in place.
 * @param rgba the picture's bytes, four to a pixel, top row first
 * @param every how far apart the contour lines are, in metres of height (for `topo`)
 */
export function restyle(rgba: Uint8ClampedArray, width: number, height: number, look: WorldLook, season: Season, heights: Heights, every: number): void {
  if (look === 'plain') return;
  const inks = INKS[season];
  const topo = look === 'topo';
  const line = LINE[season];
  const heavy = mix(line, 0x22304a, 0.35);
  // Colours repeat: the answer for each is worked out once.
  const known = new Map<number, number>();
  // The level of the row above, and of the pixel to the left, to see where a contour is crossed.
  const above = new Int32Array(width).fill(-1);
  for (let y = 0; y < height; y++) {
    let left = -1;
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      const key = ((rgba[i] as number) << 16) | ((rgba[i + 1] as number) << 8) | (rgba[i + 2] as number);
      let ink = known.get(key);
      if (ink === undefined) {
        ink = nearestInk(inks, rgba[i] as number, rgba[i + 1] as number, rgba[i + 2] as number);
        if (topo) ink = mix(ink, PAPER, THIN);
        known.set(key, ink);
      }
      if (topo) {
        const level = Math.floor(heightUnder(heights, (x + 0.5) / width, (y + 0.5) / height) / every);
        const up = above[x] as number;
        if ((left >= 0 && left !== level) || (up >= 0 && up !== level)) {
          // The line is drawn on the higher side; every fifth is the heavier one.
          const crossed = Math.max(level, left, up);
          ink = crossed % 5 === 0 ? heavy : mix(ink, line, 0.7);
        }
        left = level;
        above[x] = level;
      }
      rgba[i] = (ink >> 16) & 255;
      rgba[i + 1] = (ink >> 8) & 255;
      rgba[i + 2] = ink & 255;
    }
  }
}
