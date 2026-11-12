import type { Season } from './season';

/**
 * The small marks printed on the ground near the camera. The land is flat inks with clean
 * edges, as on a park poster; and as on a poster, a broad field is broken up with a scatter of
 * simple marks in a second ink: brush strokes across the snow, fallen leaves on the forest
 * floor, tufts and flower heads in a meadow. They are a centimetre or two to a pixel, where the
 * picture of the land is metres, so there is something sharp underfoot.
 *
 * The shapes are painted (the owner asked for that, in place of marks drawn in code): an
 * image model is asked for a sheet of separate black shapes of each kind, and
 * `tools/art/make-ground.mjs` cuts them out and scatters them over a sheet that repeats,
 * `public/art/ground/<kind>.png`. The colours are not painted: a mark is printed flat in one
 * of the season's own inks, which is what keeps it part of the print. `GROUND_SHEETS` says
 * which four kinds a season loads, and `GROUND_MARKS` which of them each ink of the ground
 * wears, and in which ink.
 */
export type MarkKind = 'strokes' | 'leaves' | 'tufts' | 'flowers' | 'ferns' | 'twigs' | 'pebbles';
export const MARK_KINDS: readonly MarkKind[] = ['strokes', 'leaves', 'tufts', 'flowers', 'ferns', 'twigs', 'pebbles'];

/** How much ground a sheet covers before it repeats, in metres a side (as `ground-sheet.py` lays it out), and its pixels a side. */
export const MARK_REPEAT = 16;
export const MARK_SIZE = 1024;

export interface Mark {
  kind: MarkKind;
  /** The ink it is printed in, as 0xRRGGBB. */
  ink: number;
}

/** The kinds of mark each season prints: four at most, one to each channel of the sheet the ground's shader reads. */
export const GROUND_SHEETS: Record<Season, readonly MarkKind[]> = {
  winter: ['strokes', 'pebbles', 'twigs'],
  spring: ['strokes', 'leaves', 'tufts', 'twigs'],
  summer: ['tufts', 'flowers', 'ferns', 'strokes'],
  fall: ['leaves', 'tufts', 'twigs', 'strokes'],
};

/** For each season, the marks each ink of the ground wears: two kinds at most. Inks not listed are left plain. */
export const GROUND_MARKS: Record<Season, Readonly<Record<number, readonly Mark[]>>> = {
  winter: {
    // Groomed snow: the groomer's lines. Snow under the trees: clumps fallen from the boughs, and twigs.
    0xfbf8ee: [{ kind: 'strokes', ink: 0xc3d3ea }],
    0xc3d3ea: [
      { kind: 'pebbles', ink: 0xfbf8ee },
      { kind: 'twigs', ink: 0x5d7396 },
    ],
    // Ice: the scratches of skates and the wind, and snow drifted on it.
    0x7fb4c8: [
      { kind: 'strokes', ink: 0xfbf8ee },
      { kind: 'pebbles', ink: 0xc3d3ea },
    ],
  },
  spring: {
    // Old snow; last year's leaves and this year's shoots; thawed grass with the winter's twigs on it.
    0xf4f1e6: [{ kind: 'strokes', ink: 0xcfdcea }],
    0x7a6650: [
      { kind: 'leaves', ink: 0xa8a077 },
      { kind: 'tufts', ink: 0xb9c47a },
    ],
    0xa8a077: [
      { kind: 'tufts', ink: 0x7d8a52 },
      { kind: 'twigs', ink: 0x7a6650 },
    ],
    0x7d8a52: [{ kind: 'tufts', ink: 0xb9c47a }],
    0x3d86a0: [{ kind: 'strokes', ink: 0xcfdcea }],
  },
  summer: {
    // Meadow grass with flowers in it; ferns under the hardwoods and the pines; ripples.
    0x6fa35c: [
      { kind: 'tufts', ink: 0x3f7d54 },
      { kind: 'flowers', ink: 0xf1e9cf },
    ],
    0x3f7d54: [
      { kind: 'ferns', ink: 0x2a5f4a },
      { kind: 'tufts', ink: 0x6fa35c },
    ],
    0x2a5f4a: [{ kind: 'ferns', ink: 0x3f7d54 }],
    0x3d86a0: [{ kind: 'strokes', ink: 0xf1e9cf }],
  },
  fall: {
    // Leaves down everywhere; the trails gone to straw; needles and cones under the pines.
    0x8c6a48: [
      { kind: 'leaves', ink: 0xe3b03f },
      { kind: 'leaves', ink: 0xb3472d },
    ],
    0xc9a36b: [
      { kind: 'tufts', ink: 0x8c6a48 },
      { kind: 'leaves', ink: 0xd9772b },
    ],
    0x2f5d4c: [
      { kind: 'twigs', ink: 0x8c6a48 },
      { kind: 'leaves', ink: 0xe3b03f },
    ],
    0x3d86a0: [{ kind: 'strokes', ink: 0xf1e9cf }],
  },
};

/**
 * The sheet the ground's shader reads, put together from a season's pictures: four bytes to a
 * pixel, one kind of mark to each byte, 255 where there is a mark and 0 where there is none.
 * @param pictures the pictures of the season's kinds, in the order of `GROUND_SHEETS`, each as the bytes a canvas gives (four to a pixel, of which the first is read)
 */
export function packSheets(pictures: readonly Uint8ClampedArray[], size = MARK_SIZE): Uint8Array {
  const data = new Uint8Array(size * size * 4);
  pictures.slice(0, 4).forEach((picture, channel) => {
    for (let p = 0; p < size * size; p++) data[p * 4 + channel] = picture[p * 4] as number;
  });
  return data;
}
