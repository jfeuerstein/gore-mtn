import { makeRng } from '../rng';
import type { Season } from './season';

/**
 * The small marks printed on the ground near the camera. The land is flat inks with clean
 * edges, as on a park poster; and as on a poster, a broad field is broken up with a scatter of
 * simple marks in a second ink: short strokes across the snow, fallen leaves on the forest
 * floor, tufts in a meadow. They are a few centimetres to a pixel, where the picture of the
 * land is metres, so there is something sharp underfoot.
 *
 * There is one sheet of marks, drawn here in plain numbers, which repeats over the ground:
 * four kinds, one to each channel of the sheet. `GROUND_MARKS` says which kinds each ink of
 * each season wears, and in which ink. A mark is always one of the season's own inks.
 */
export type MarkKind = 'dashes' | 'leaves' | 'tufts' | 'dots';
/** The kinds, in the order of the sheet's channels: red, green, blue, alpha. */
export const MARK_KINDS: readonly MarkKind[] = ['dashes', 'leaves', 'tufts', 'dots'];

/** How much ground the sheet covers before it repeats, in metres a side, and its pixels a side. */
export const MARK_REPEAT = 24;
export const MARK_SIZE = 1024;

export interface Mark {
  kind: MarkKind;
  /** The ink it is printed in, as 0xRRGGBB. */
  ink: number;
}

/** For each season, the marks each ink of the ground wears: two kinds at most. Inks not listed are left plain. */
export const GROUND_MARKS: Record<Season, Readonly<Record<number, readonly Mark[]>>> = {
  winter: {
    // Groomed snow: the groomer's lines. Snow under the trees: clumps fallen from the boughs, and twigs.
    0xfbf8ee: [{ kind: 'dashes', ink: 0xc3d3ea }],
    0xc3d3ea: [
      { kind: 'dots', ink: 0xfbf8ee },
      { kind: 'tufts', ink: 0x8fa5cc },
    ],
  },
  spring: {
    // Old snow; last year's leaves and this year's shoots; thawed grass.
    0xf4f1e6: [{ kind: 'dashes', ink: 0xcfdcea }],
    0x7a6650: [
      { kind: 'leaves', ink: 0xa8a077 },
      { kind: 'tufts', ink: 0xb9c47a },
    ],
    0xa8a077: [{ kind: 'tufts', ink: 0x7d8a52 }],
    0x7d8a52: [{ kind: 'tufts', ink: 0xb9c47a }],
    0x3d86a0: [{ kind: 'dashes', ink: 0xcfdcea }],
  },
  summer: {
    // Meadow grass with flowers in it; ferns and dapples under the hardwoods; needles under the pines.
    0x6fa35c: [
      { kind: 'tufts', ink: 0x3f7d54 },
      { kind: 'dots', ink: 0xf1e9cf },
    ],
    0x3f7d54: [
      { kind: 'tufts', ink: 0x2a5f4a },
      { kind: 'leaves', ink: 0x6fa35c },
    ],
    0x2a5f4a: [
      { kind: 'dashes', ink: 0x1f4a44 },
      { kind: 'dots', ink: 0x3f7d54 },
    ],
    0x3d86a0: [{ kind: 'dashes', ink: 0xf1e9cf }],
    0xa08a66: [{ kind: 'dots', ink: 0xc9a36b }],
  },
  fall: {
    // Leaves down everywhere; the trails gone to straw.
    0x8c6a48: [
      { kind: 'leaves', ink: 0xe3b03f },
      { kind: 'leaves', ink: 0xb3472d },
    ],
    0xc9a36b: [
      { kind: 'tufts', ink: 0x8c6a48 },
      { kind: 'leaves', ink: 0xd9772b },
    ],
    0x2f5d4c: [
      { kind: 'dashes', ink: 0x8c6a48 },
      { kind: 'leaves', ink: 0xe3b03f },
    ],
    0x3d86a0: [{ kind: 'dashes', ink: 0xf1e9cf }],
  },
};

/**
 * The sheet of marks: four bytes to a pixel, one kind of mark to each byte, 255 where there is
 * a mark and 0 where there is none, with a pixel's worth of soft edge. It joins up with itself
 * at every side, and is the same every time it is made.
 *
 * Across the sheet is east and down it is south, so a stroke drawn level lies east and west
 * on the ground.
 */
export function markSheet(size = MARK_SIZE, repeat = MARK_REPEAT): Uint8Array {
  const data = new Uint8Array(size * size * 4);
  const px = size / repeat;
  const rng = makeRng(0x6a7d);
  const between = (lo: number, hi: number): number => lo + (hi - lo) * rng();
  /** Ink a pixel of one kind at least this much, wrapping round the sheet's edges. */
  const put = (x: number, y: number, channel: number, cover: number): void => {
    if (cover <= 0) return;
    const at = ((((y % size) + size) % size) * size + (((x % size) + size) % size)) * 4 + channel;
    const value = Math.round(Math.min(1, cover) * 255);
    if (value > (data[at] as number)) data[at] = value;
  };
  /** A stroke with round ends, from one point to another, in pixels. */
  const stroke = (channel: number, ax: number, ay: number, bx: number, by: number, r: number): void => {
    const dx = bx - ax;
    const dy = by - ay;
    const len2 = dx * dx + dy * dy || 1;
    for (let y = Math.floor(Math.min(ay, by) - r - 1); y <= Math.ceil(Math.max(ay, by) + r + 1); y++) {
      for (let x = Math.floor(Math.min(ax, bx) - r - 1); x <= Math.ceil(Math.max(ax, bx) + r + 1); x++) {
        const t = Math.min(1, Math.max(0, ((x - ax) * dx + (y - ay) * dy) / len2));
        put(x, y, channel, r + 0.5 - Math.hypot(x - ax - t * dx, y - ay - t * dy));
      }
    }
  };
  /** A leaf: pointed at both ends, lying at an angle. */
  const leaf = (channel: number, cx: number, cy: number, half: number, wide: number, angle: number): void => {
    const c = Math.cos(angle);
    const s = Math.sin(angle);
    for (let y = Math.floor(cy - half - 1); y <= Math.ceil(cy + half + 1); y++) {
      for (let x = Math.floor(cx - half - 1); x <= Math.ceil(cx + half + 1); x++) {
        const along = ((x - cx) * c + (y - cy) * s) / half;
        const off = Math.abs(-(x - cx) * s + (y - cy) * c);
        if (Math.abs(along) > 1.1) continue;
        put(x, y, channel, wide * (1 - along * along) + 0.5 - off);
      }
    }
  };
  /** Somewhere in each square of a grid laid over the sheet, leaving some squares empty: evenly spread, and never crowded. */
  const scatter = (squares: number, keep: number, place: (x: number, y: number) => void): void => {
    const cell = size / squares;
    for (let j = 0; j < squares; j++) {
      for (let i = 0; i < squares; i++) {
        const x = (i + between(0.15, 0.85)) * cell;
        const y = (j + between(0.15, 0.85)) * cell;
        if (rng() < keep) place(x, y);
      }
    }
  };

  // Dashes: short strokes lying east and west, some of them in pairs, as a groomer or the wind leaves.
  scatter(13, 0.7, (x, y) => {
    const half = between(0.28, 0.7) * px;
    const tilt = between(-0.12, 0.12);
    const r = between(0.022, 0.034) * px;
    stroke(0, x - half, y - half * tilt, x + half, y + half * tilt, r);
    if (rng() < 0.55) {
      const gap = between(0.16, 0.24) * px;
      const shift = between(-0.3, 0.3) * px;
      stroke(0, x - half * 0.7 + shift, y + gap - half * 0.7 * tilt, x + half * 0.7 + shift, y + gap + half * 0.7 * tilt, r);
    }
  });
  // Leaves, lying every way.
  scatter(19, 0.65, (x, y) => leaf(1, x, y, between(0.12, 0.22) * px, between(0.045, 0.08) * px, between(0, Math.PI)));
  // Tufts: a tussock seen from above, five blades out from one root.
  scatter(12, 0.65, (x, y) => {
    const turn = between(0, Math.PI * 2);
    for (let blade = 0; blade < 5; blade++) {
      const angle = turn + (blade / 5) * Math.PI * 2 + between(-0.25, 0.25);
      const long = between(0.12, 0.22) * px;
      stroke(2, x, y, x + Math.sin(angle) * long, y - Math.cos(angle) * long, 0.026 * px);
    }
  });
  // Dots, in twos and threes.
  scatter(11, 0.6, (x, y) => {
    const many = 2 + Math.floor(rng() * 3);
    for (let n = 0; n < many; n++) {
      const dx = between(-0.22, 0.22) * px;
      const dy = between(-0.22, 0.22) * px;
      stroke(3, x + dx, y + dy, x + dx, y + dy, between(0.045, 0.085) * px);
    }
  });
  return data;
}
