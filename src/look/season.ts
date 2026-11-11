import type { Palette } from './palette';

/**
 * The four seasons, and what each changes. No DOM or three.js here.
 *
 * The mountain follows the calendar: snow from November, white ribbons of trail through brown
 * woods in spring, green in summer, colour in fall. Skiing belongs to the snow; in summer and
 * fall the way down is a mountain bike, as on the real Gore.
 */
export const SEASONS = ['winter', 'spring', 'summer', 'fall'] as const;
export type Season = (typeof SEASONS)[number];

export const SEASON_NAME: Record<Season, string> = { winter: 'Winter', spring: 'Spring', summer: 'Summer', fall: 'Fall' };

/**
 * The season on a date, by the player's own calendar. Winter comes with the snow guns in
 * November and stays through March; spring skiing runs to the end of May; fall begins in
 * mid-September, when the first maples turn.
 */
export function seasonFor(when: Date): Season {
  const day = (when.getMonth() + 1) * 100 + when.getDate();
  if (day >= 1110 || day <= 331) return 'winter';
  if (day <= 531) return 'spring';
  if (day <= 914) return 'summer';
  return 'fall';
}

/** One tree's dress for the season: a colour, and how wide and tall it stands against a fir. */
export interface TreeLook {
  colour: number;
  wide: number;
  tall: number;
}

export interface SeasonLook {
  /** True when the trails carry snow. */
  snow: boolean;
  /** What the player glides down on. */
  ride: 'skis' | 'bike';
  /** What a wet sky drops. */
  falling: 'snow' | 'rain';
  /** What drifts in the air in fair weather: leaves by day, fireflies after dark, or nothing. */
  adrift: 'none' | 'leaves' | 'fireflies';
  /** Roofs: snow-covered, or shingle. */
  roof: number;
  /** The ground beyond the mapped mountain and the far hills, as tints on the winter palette. */
  plainTint: number;
  ridgeTint: number;
  /** The mark a ski or a tyre leaves, before the light tints it. */
  track: number;
  /** Colours for the spruce and fir, and for the hardwoods, to pick among. Null in winter: the snowy fir stands as it is. */
  conifers: readonly TreeLook[] | null;
  hardwoods: readonly TreeLook[] | null;
}

const FIRS: readonly TreeLook[] = [
  { colour: 0x4a7a62, wide: 1, tall: 1 },
  { colour: 0x3f6c58, wide: 0.95, tall: 1.08 },
  { colour: 0x55846a, wide: 1.05, tall: 0.94 },
];

export const SEASON_LOOK: Record<Season, SeasonLook> = {
  winter: {
    snow: true,
    ride: 'skis',
    falling: 'snow',
    adrift: 'none',
    roof: 0xf2f5fa,
    plainTint: 0xffffff,
    ridgeTint: 0xffffff,
    track: 0xffffff,
    conifers: null,
    hardwoods: null,
  },
  spring: {
    snow: true,
    ride: 'skis',
    falling: 'rain',
    adrift: 'none',
    roof: 0x5c6672,
    plainTint: 0xa3a08a,
    ridgeTint: 0xc9cdc4,
    track: 0xffffff,
    conifers: FIRS,
    // Mostly bare, thin and grey-brown; some in bud.
    hardwoods: [
      { colour: 0x9a8a78, wide: 0.5, tall: 0.95 },
      { colour: 0x8c7c6c, wide: 0.45, tall: 1.05 },
      { colour: 0xa7967f, wide: 0.55, tall: 0.9 },
      { colour: 0xb9c47a, wide: 0.9, tall: 0.85 },
      { colour: 0xa5b56c, wide: 0.8, tall: 0.9 },
    ],
  },
  summer: {
    snow: false,
    ride: 'bike',
    falling: 'rain',
    adrift: 'fireflies',
    roof: 0x5c6672,
    plainTint: 0x6f9a62,
    ridgeTint: 0xa9c4b4,
    track: 0x8a7350,
    conifers: FIRS,
    hardwoods: [
      { colour: 0x6fae52, wide: 1.3, tall: 0.8 },
      { colour: 0x5f9c4a, wide: 1.2, tall: 0.86 },
      { colour: 0x7dbb5c, wide: 1.35, tall: 0.76 },
      { colour: 0x67a650, wide: 1.25, tall: 0.82 },
    ],
  },
  fall: {
    snow: false,
    ride: 'bike',
    falling: 'rain',
    adrift: 'leaves',
    roof: 0x5c6672,
    plainTint: 0xb98a55,
    ridgeTint: 0xd4b9a0,
    track: 0x7a6042,
    conifers: FIRS,
    hardwoods: [
      { colour: 0xe2842f, wide: 1.3, tall: 0.8 },
      { colour: 0xcc4f30, wide: 1.2, tall: 0.86 },
      { colour: 0xedbd42, wide: 1.35, tall: 0.76 },
      { colour: 0xd9682c, wide: 1.25, tall: 0.82 },
      { colour: 0xb9413a, wide: 1.2, tall: 0.84 },
      { colour: 0x9aa64e, wide: 1.25, tall: 0.8 },
    ],
  },
};

/**
 * The dress of one tree.
 * @param hardwoodShare how much of the forest here is hardwood, 0..1
 * @param kindRoll decides hardwood or conifer; `pickRoll` chooses among that kind's looks. Both 0..1
 * @returns null in winter, when every tree is the snowy fir
 */
export function treeLook(season: Season, hardwoodShare: number, kindRoll: number, pickRoll: number): TreeLook | null {
  const look = SEASON_LOOK[season];
  if (!look.conifers || !look.hardwoods) return null;
  const list = kindRoll < hardwoodShare ? look.hardwoods : look.conifers;
  return list[Math.min(list.length - 1, Math.floor(pickRoll * list.length))] as TreeLook;
}

/** Multiply two colours channel by channel. */
export function tintColour(a: number, b: number): number {
  const ch = (shift: number): number => Math.round((((a >> shift) & 255) * ((b >> shift) & 255)) / 255);
  return (ch(16) << 16) | (ch(8) << 8) | ch(0);
}

/**
 * A palette as the season wears it. The palettes are tuned for snow, which is the game's first
 * look; the other seasons keep their light and sky, and recolour the land the light falls on.
 */
export function seasonPalette(p: Palette, season: Season): Palette {
  if (season === 'winter') return p;
  const look = SEASON_LOOK[season];
  const out = { ...p };
  out.plain = tintColour(p.plain, look.plainTint);
  out.ridgeNear = tintColour(p.ridgeNear, look.ridgeTint);
  out.ridgeFar = tintColour(p.ridgeFar, look.ridgeTint);
  if (!look.snow) {
    // A tyre's line in the grass, lit like the ground around it.
    out.track = tintColour(p.snowTint, look.track);
    // Bare ground throws back less light than snow; lift the fill a little so shade and night stay readable.
    out.ambientIntensity = p.ambientIntensity * 1.18;
  }
  return out;
}

/** What is in the air, and how much of it, 0..1. */
export function airFor(season: Season, falling: number, sunElevationDeg: number): { kind: 'snow' | 'rain' | 'leaves' | 'fireflies'; amount: number } {
  const look = SEASON_LOOK[season];
  if (falling > 0.02) return { kind: look.falling, amount: falling };
  if (look.adrift === 'leaves' && sunElevationDeg > 2) return { kind: 'leaves', amount: 0.06 };
  if (look.adrift === 'fireflies' && sunElevationDeg < -1) return { kind: 'fireflies', amount: 0.1 };
  return { kind: look.falling, amount: 0 };
}
