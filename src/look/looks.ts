/**
 * Looks: complete visual treatments of the same mountain, for the owner to compare on the phone.
 * A look is only data. Everything that draws reads its colours, light and shapes from here, so a
 * new look is a new entry in LOOKS and nothing else.
 *
 * Colours are 0xRRGGBB. Directions are toward the sun: x east, y up, z south.
 */

/** One cone of a tree: a ring of `sides` points at height y0 and radius `radius`, rising to a point at y1. */
export interface TreeTier {
  radius: number;
  y0: number;
  y1: number;
  sides: number;
  /** Colour at the rim and at the tip. */
  base: number;
  tip: number;
}

export interface TreeStyle {
  trunk: number;
  /** Bottom tier first. The model is about 3.6 units tall and 1.05 wide; the game scales it up. */
  tiers: TreeTier[];
  /** The single cone used for distant trees. */
  farBase: number;
  farTip: number;
}

export interface Look {
  id: string;
  name: string;
  /** One line for the settings menu. */
  blurb: string;

  sky: { top: number; middle: number; horizon: number };
  /** The sun as a disc in the sky: colour and angular size, or null for none (overcast). */
  sunDisc: { colour: number; size: number } | null;
  sun: { colour: number; intensity: number; direction: [number, number, number] };
  /** Light from the sky above and bounced from the ground below. The ground colour tints shadows. */
  ambient: { sky: number; ground: number; intensity: number };
  /** Haze: its colour, and where it starts and becomes total, in metres. */
  fog: { colour: number; near: number; far: number };
  /** Whether the sun casts shadows (still subject to the Shadows setting). */
  shadows: boolean;

  /** Tints multiplied into the pipeline's snow and distant-forest pictures. */
  snowTint: number;
  canopyTint: number;
  /** Faceted ground (each triangle one shade) or smooth. */
  facetedGround: boolean;
  /** The line a ski leaves. */
  track: number;
  /** Land beyond the edge of the mapped mountain, and two rows of far hills. */
  plain: number;
  ridges: [number, number];

  trees: TreeStyle;
  /** Falling snow. */
  snowfall: boolean;
}

const FIR: TreeTier[] = [
  { radius: 1.05, y0: 0.7, y1: 2.6, sides: 6, base: 0x24463a, tip: 0x2f5a48 },
  { radius: 0.75, y0: 1.9, y1: 3.6, sides: 6, base: 0x2f5a48, tip: 0xb9d0c8 },
];

export const LOOKS: readonly Look[] = [
  {
    id: 'bluebird',
    name: 'Bluebird',
    blurb: 'Clear midday. Crisp facets, cool shadows.',
    sky: { top: 0x6f9fe0, middle: 0xb4cdf0, horizon: 0xe6edf7 },
    sunDisc: { colour: 0xfffbe8, size: 0.03 },
    sun: { colour: 0xfff1dc, intensity: 2.4, direction: [-0.55, 0.62, 0.56] },
    ambient: { sky: 0xdfeaff, ground: 0x8d97ad, intensity: 1.5 },
    fog: { colour: 0xe6edf7, near: 1900, far: 6500 },
    shadows: true,
    snowTint: 0xffffff,
    canopyTint: 0xffffff,
    facetedGround: true,
    track: 0xc3cfe3,
    plain: 0x9fb0bd,
    ridges: [0x8ea6c6, 0xb4c6de],
    trees: { trunk: 0x4a3b33, tiers: FIR, farBase: 0x24463a, farTip: 0x86a79c },
    snowfall: false,
  },
  {
    id: 'golden',
    name: 'Golden hour',
    blurb: 'Early sun on the east face. Peach light, long violet shadows.',
    sky: { top: 0x5c78c4, middle: 0xe9a9a0, horizon: 0xffd7a8 },
    sunDisc: { colour: 0xfff0c2, size: 0.045 },
    sun: { colour: 0xffb277, intensity: 2.7, direction: [0.8, 0.27, 0.54] },
    ambient: { sky: 0xc3c9ff, ground: 0x8778b8, intensity: 1.5 },
    fog: { colour: 0xf4cdb6, near: 900, far: 6000 },
    shadows: true,
    snowTint: 0xfff4ea,
    canopyTint: 0xe8d2cf,
    facetedGround: false,
    track: 0xb4b2d6,
    plain: 0xb9a6bd,
    ridges: [0x9a86b4, 0xcf9fae],
    trees: {
      trunk: 0x3d2c2a,
      tiers: [
        { radius: 1.05, y0: 0.7, y1: 2.6, sides: 6, base: 0x1c3a3a, tip: 0x2c5148 },
        { radius: 0.75, y0: 1.9, y1: 3.6, sides: 6, base: 0x2c5148, tip: 0xe9c9a8 },
      ],
      farBase: 0x1f3d3d,
      farTip: 0x9a9a92,
    },
    snowfall: false,
  },
  {
    id: 'snowfall',
    name: 'Quiet snowfall',
    blurb: 'Overcast and still. Soft white, falling snow.',
    sky: { top: 0xd3dae5, middle: 0xe3e8ef, horizon: 0xedf0f5 },
    sunDisc: null,
    sun: { colour: 0xffffff, intensity: 0.55, direction: [-0.3, 0.9, 0.3] },
    ambient: { sky: 0xf4f7fb, ground: 0xb9c4d6, intensity: 2.2 },
    fog: { colour: 0xe9edf3, near: 40, far: 1100 },
    shadows: false,
    snowTint: 0xf6f8fb,
    canopyTint: 0xdfe5ec,
    facetedGround: false,
    track: 0xcbd4e2,
    plain: 0xb9c4cf,
    ridges: [0xe9edf3, 0xe9edf3],
    trees: {
      trunk: 0x3a3436,
      tiers: [
        { radius: 1.0, y0: 0.6, y1: 2.5, sides: 6, base: 0x22383a, tip: 0x5d7a78 },
        { radius: 0.74, y0: 1.7, y1: 3.1, sides: 6, base: 0x2b4646, tip: 0xdfe8ea },
        { radius: 0.46, y0: 2.6, y1: 3.6, sides: 5, base: 0x8fa6a6, tip: 0xf4f7fa },
      ],
      farBase: 0x30494a,
      farTip: 0xcfdadc,
    },
    snowfall: true,
  },
  {
    id: 'storybook',
    name: 'Storybook',
    blurb: 'Bright and toy-like. Deep sky, snow-capped trees.',
    sky: { top: 0x2f7fe0, middle: 0x8cc4f5, horizon: 0xd9f0ff },
    sunDisc: { colour: 0xfffdf0, size: 0.035 },
    sun: { colour: 0xfff6e0, intensity: 2.0, direction: [-0.5, 0.62, 0.6] },
    ambient: { sky: 0xd4ecff, ground: 0x5fa9c4, intensity: 1.15 },
    fog: { colour: 0xd9f0ff, near: 2600, far: 6500 },
    shadows: true,
    snowTint: 0xf2f8ff,
    canopyTint: 0xd8fff0,
    facetedGround: false,
    track: 0xb5d6ea,
    plain: 0xa9d2e3,
    ridges: [0x6fa9d6, 0xa6cfee],
    trees: {
      trunk: 0x7a4a2e,
      tiers: [
        { radius: 1.05, y0: 0.6, y1: 1.9, sides: 7, base: 0x1f7a55, tip: 0xffffff },
        { radius: 0.82, y0: 1.45, y1: 2.75, sides: 7, base: 0x248a60, tip: 0xffffff },
        { radius: 0.56, y0: 2.3, y1: 3.6, sides: 7, base: 0x2a9a6b, tip: 0xffffff },
      ],
      farBase: 0x1f7a55,
      farTip: 0xeaf7f2,
    },
    snowfall: false,
  },
];

export const DEFAULT_LOOK = 'bluebird';

/** The look with this id, or the default if there is none. */
export function lookById(id: string | null | undefined): Look {
  return LOOKS.find((l) => l.id === id) ?? (LOOKS.find((l) => l.id === DEFAULT_LOOK) as Look);
}
