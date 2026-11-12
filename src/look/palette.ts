/**
 * The colour of the mountain for a time of day and a kind of weather. No DOM or three.js here.
 *
 * One family of looks, chosen by the owner from four tried on the phone: warm, low-sun light with
 * violet shadows, and a quiet white whenever it is overcast or snowing. The palette is worked out
 * from two numbers, how high the sun is and how closed-in the weather is, by blending between a
 * handful of hand-tuned moments. Colours are 0xRRGGBB.
 */
export interface Palette {
  skyTop: number;
  skyMiddle: number;
  skyHorizon: number;
  /** The sun, or at night the moon: its colour as a light, and how strong. */
  lightColour: number;
  lightIntensity: number;
  /** Light from the sky above and bounced from below. The ground colour tints the shadows. */
  ambientSky: number;
  ambientGround: number;
  ambientIntensity: number;
  /** Haze: colour, and where it starts and becomes total, in metres. */
  fogColour: number;
  fogNear: number;
  fogFar: number;
  /** Tints multiplied into the pipeline's snow and distant-forest pictures. */
  snowTint: number;
  canopyTint: number;
  /** The line a ski leaves. */
  track: number;
  /** Land beyond the mapped mountain, and two rows of far hills. */
  plain: number;
  ridgeNear: number;
  ridgeFar: number;
  /** The disc of the sun or moon: colour, size as a share of the sky's radius, and 0..1 how visible. */
  discColour: number;
  discSize: number;
  discShown: number;
  /** How hard it is snowing, 0..1. */
  snowfall: number;
  /** How lit windows and lamps are, 0..1. */
  lamps: number;
}

/** A clear-sky moment, at a height of the sun in degrees. */
interface Key {
  elevation: number;
  palette: Palette;
}

const NIGHT: Palette = {
  skyTop: 0x0c1430,
  skyMiddle: 0x1b2a55,
  skyHorizon: 0x35477e,
  lightColour: 0xa9bcff,
  lightIntensity: 0.7,
  ambientSky: 0x6177ba,
  ambientGround: 0x2c3763,
  ambientIntensity: 1.25,
  fogColour: 0x2c3b69,
  fogNear: 500,
  fogFar: 6000,
  snowTint: 0xe6ecff,
  canopyTint: 0xb9c6ee,
  track: 0x9aa9d6,
  plain: 0x2a385f,
  ridgeNear: 0x222f58,
  ridgeFar: 0x2d3c6b,
  discColour: 0xe9eeff,
  discSize: 0.022,
  discShown: 1,
  snowfall: 0,
  lamps: 1,
};

/** The sun a few degrees down: no direct light to speak of. The hand-over between sun and moon happens here, unseen. */
const DARK_TWILIGHT: Palette = {
  skyTop: 0x1b2a5e,
  skyMiddle: 0x4a4a8c,
  skyHorizon: 0x9a6f9a,
  lightColour: 0xa9a0d8,
  lightIntensity: 0.1,
  ambientSky: 0x7f86c8,
  ambientGround: 0x3d3f78,
  ambientIntensity: 1.35,
  fogColour: 0x5b5a92,
  fogNear: 600,
  fogFar: 6000,
  snowTint: 0xeae8ff,
  canopyTint: 0xc3bfe6,
  track: 0xa3a3d2,
  plain: 0x3f4175,
  ridgeNear: 0x3a3c74,
  ridgeFar: 0x5c5590,
  discColour: 0xffd9b0,
  discSize: 0.04,
  discShown: 0,
  snowfall: 0,
  lamps: 1,
};

/** The sun on the horizon: afterglow or first light. */
const TWILIGHT: Palette = {
  skyTop: 0x3a4a94,
  skyMiddle: 0xb98bb0,
  skyHorizon: 0xffb48a,
  lightColour: 0xff9a78,
  lightIntensity: 0.9,
  ambientSky: 0xa9a8e6,
  ambientGround: 0x6a5c9c,
  ambientIntensity: 1.45,
  fogColour: 0xd3a3b0,
  fogNear: 800,
  fogFar: 6000,
  snowTint: 0xfff0ee,
  canopyTint: 0xdcc8d6,
  track: 0xb0a8d2,
  plain: 0x8f7fa6,
  ridgeNear: 0x7b6aa0,
  ridgeFar: 0xb98aa6,
  discColour: 0xffc08a,
  discSize: 0.05,
  discShown: 1,
  snowfall: 0,
  lamps: 0.85,
};

/** The owner's "Golden hour". */
const GOLDEN: Palette = {
  skyTop: 0x5c78c4,
  skyMiddle: 0xe9a9a0,
  skyHorizon: 0xffd7a8,
  lightColour: 0xffb277,
  lightIntensity: 2.7,
  ambientSky: 0xc3c9ff,
  ambientGround: 0x8778b8,
  ambientIntensity: 1.5,
  fogColour: 0xf4cdb6,
  fogNear: 900,
  fogFar: 6000,
  snowTint: 0xfff4ea,
  canopyTint: 0xe8d2cf,
  track: 0xb4b2d6,
  plain: 0xb9a6bd,
  ridgeNear: 0x9a86b4,
  ridgeFar: 0xcf9fae,
  discColour: 0xfff0c2,
  discSize: 0.045,
  discShown: 1,
  snowfall: 0,
  lamps: 0.1,
};

/** A clear day in the same family: soft light, a warm horizon, violet-blue shadows. */
const DAY: Palette = {
  skyTop: 0x5f93de,
  skyMiddle: 0xb3d0f3,
  skyHorizon: 0xf3e6dc,
  lightColour: 0xfff0da,
  lightIntensity: 2.3,
  ambientSky: 0xd9e4ff,
  ambientGround: 0x9198cc,
  ambientIntensity: 1.4,
  fogColour: 0xeae4e6,
  fogNear: 1900,
  fogFar: 6500,
  snowTint: 0xffffff,
  canopyTint: 0xf2eef2,
  track: 0xc0c8e4,
  plain: 0xa9b3c6,
  ridgeNear: 0x95a6cc,
  ridgeFar: 0xbfc8e0,
  discColour: 0xfffbe8,
  discSize: 0.03,
  discShown: 1,
  snowfall: 0,
  lamps: 0,
};

const CLEAR: readonly Key[] = [
  { elevation: -12, palette: NIGHT },
  { elevation: -5, palette: DARK_TWILIGHT },
  { elevation: -0.5, palette: TWILIGHT },
  { elevation: 6, palette: GOLDEN },
  { elevation: 22, palette: DAY },
];

/** The owner's "Quiet snowfall": overcast and still, by day. */
const SNOW_DAY: Palette = {
  skyTop: 0xd3dae5,
  skyMiddle: 0xe3e8ef,
  skyHorizon: 0xedf0f5,
  lightColour: 0xffffff,
  lightIntensity: 0.55,
  ambientSky: 0xf4f7fb,
  ambientGround: 0xb9c4d6,
  ambientIntensity: 2.2,
  fogColour: 0xe9edf3,
  fogNear: 40,
  fogFar: 1100,
  snowTint: 0xf6f8fb,
  canopyTint: 0xdfe5ec,
  track: 0xcbd4e2,
  plain: 0xb9c4cf,
  ridgeNear: 0xe9edf3,
  ridgeFar: 0xe9edf3,
  discColour: 0xffffff,
  discSize: 0.03,
  discShown: 0,
  snowfall: 1,
  lamps: 0.55,
};

/** The same weather after dark: the snow keeps a little of the sky's glow. */
const SNOW_NIGHT: Palette = {
  skyTop: 0x242c44,
  skyMiddle: 0x2e3852,
  skyHorizon: 0x394560,
  lightColour: 0xc6d0ee,
  lightIntensity: 0.25,
  ambientSky: 0x8793b6,
  ambientGround: 0x4a5372,
  ambientIntensity: 1.35,
  fogColour: 0x364058,
  fogNear: 30,
  fogFar: 900,
  snowTint: 0xe9edf8,
  canopyTint: 0xc3cade,
  track: 0xa9b3cc,
  plain: 0x3a445c,
  ridgeNear: 0x364058,
  ridgeFar: 0x364058,
  discColour: 0xffffff,
  discSize: 0.02,
  discShown: 0,
  snowfall: 1,
  lamps: 1,
};

const COLOUR_KEYS = [
  'skyTop',
  'skyMiddle',
  'skyHorizon',
  'lightColour',
  'ambientSky',
  'ambientGround',
  'fogColour',
  'snowTint',
  'canopyTint',
  'track',
  'plain',
  'ridgeNear',
  'ridgeFar',
  'discColour',
] as const;
const NUMBER_KEYS = ['lightIntensity', 'ambientIntensity', 'fogNear', 'fogFar', 'discSize', 'discShown', 'snowfall', 'lamps'] as const;

const clamp01 = (v: number): number => (v < 0 ? 0 : v > 1 ? 1 : v);
const smooth = (t: number): number => t * t * (3 - 2 * t);

/** Blend two colours channel by channel. */
export function mixColour(a: number, b: number, t: number): number {
  const ch = (shift: number): number => {
    const x = (a >> shift) & 255;
    const y = (b >> shift) & 255;
    return Math.round(x + (y - x) * t);
  };
  return (ch(16) << 16) | (ch(8) << 8) | ch(0);
}

export function mixPalette(a: Palette, b: Palette, t: number): Palette {
  const k = clamp01(t);
  const out = { ...a };
  for (const key of COLOUR_KEYS) out[key] = mixColour(a[key], b[key], k);
  for (const key of NUMBER_KEYS) out[key] = a[key] + (b[key] - a[key]) * k;
  return out;
}

/** The clear-sky palette for a height of the sun, in degrees above the horizon. */
export function clearPalette(elevationDeg: number): Palette {
  const first = CLEAR[0] as Key;
  const last = CLEAR[CLEAR.length - 1] as Key;
  if (elevationDeg <= first.elevation) return first.palette;
  if (elevationDeg >= last.elevation) return last.palette;
  for (let i = 0; i + 1 < CLEAR.length; i++) {
    const a = CLEAR[i] as Key;
    const b = CLEAR[i + 1] as Key;
    if (elevationDeg <= b.elevation) return mixPalette(a.palette, b.palette, smooth((elevationDeg - a.elevation) / (b.elevation - a.elevation)));
  }
  return last.palette;
}

/** How closed-in the weather is, and how hard it is snowing, both 0..1. */
export interface Weather {
  overcast: number;
  snowing: number;
  /** How much cloud is lying low, in the valleys, 0..1: fog, or cloud under a clear sky. None if not given. */
  low?: number;
}

/**
 * The palette for a height of the sun and a state of the weather.
 * Cloud flattens the light and mutes the colour; snow closes the view in and fills the air.
 */
export function paletteFor(elevationDeg: number, weather: Weather): Palette {
  const clear = clearPalette(elevationDeg);
  const daylight = smooth(clamp01((elevationDeg + 8) / 16));
  const closed = mixPalette(SNOW_NIGHT, SNOW_DAY, daylight);
  const overcast = clamp01(weather.overcast);
  const snowing = clamp01(weather.snowing);
  // Snow brings its own cloud with it.
  const cover = Math.max(overcast, snowing);
  const out = mixPalette(clear, closed, cover);
  // Cloud alone dims and greys the day but leaves the long view; only falling snow closes it in.
  const openFar = clear.fogFar + (2600 - clear.fogFar) * cover;
  const openNear = clear.fogNear + (300 - clear.fogNear) * cover;
  out.fogFar = openFar + (closed.fogFar - openFar) * snowing;
  out.fogNear = openNear + (closed.fogNear - openNear) * snowing;
  out.snowfall = snowing;
  out.discShown = clear.discShown * (1 - cover);
  return out;
}

/** Perceived brightness of a colour, 0..1. */
export function luminance(c: number): number {
  return (0.2126 * ((c >> 16) & 255) + 0.7152 * ((c >> 8) & 255) + 0.0722 * (c & 255)) / 255;
}
