/**
 * How loud each continuous sound should be for what the player is doing. No Web Audio here, so
 * it runs under Vitest; `sound.ts` plays what this works out.
 *
 * The game is quiet on purpose: wind, the hiss of skis, the hum of a lift. Sounds are there to
 * make movement feel like movement, and never to demand attention.
 */
export interface Scene {
  mode: 'walk' | 'ski' | 'lift';
  glide: 'skis' | 'bike';
  /** Speed over the ground, m/s. */
  speed: number;
  /** Angle between the skis or wheels and the direction of travel, radians. */
  slip: number;
  /** Height above the base of the mountain as a share of its whole height, 0..1. */
  height: number;
  /** Whatever is falling, 0..1, and whether it is rain. */
  falling: number;
  rain: boolean;
}

export interface Levels {
  /** The air: always there a little, more with height and speed. Loudness 0..1 and the brightness of its tone in Hz. */
  wind: number;
  windTone: number;
  /** Skis or tyres on the ground. Loudness 0..1 and tone in Hz: a carve hisses, a skid roars. */
  glide: number;
  glideTone: number;
  /** The hum of a lift, 0..1. */
  lift: number;
  /** Rain on a jacket, 0..1. */
  rain: number;
}

const clamp01 = (v: number): number => (v < 0 ? 0 : v > 1 ? 1 : v);

export function levelsFor(s: Scene): Levels {
  const pace = clamp01(s.speed / 26);
  // Wind is the sound of going fast and of being high up. On a lift it is mostly the height.
  const rush = s.mode === 'lift' ? 0.25 : pace;
  const wind = clamp01(0.06 + s.height * 0.14 + rush * rush * 0.7);
  const windTone = 320 + rush * 900 + s.height * 160;
  let glide = 0;
  let glideTone = 2600;
  if (s.mode === 'ski' && s.speed > 0.4) {
    const skid = clamp01(Math.abs(Math.sin(s.slip)) * 1.4);
    if (s.glide === 'skis') {
      // A carve is a thin hiss that rises with speed; a skid is a loud, low scrape.
      glide = clamp01(0.1 + pace * 0.35 + skid * 0.5) * clamp01(s.speed / 2);
      glideTone = 3400 - skid * 1900 + pace * 600;
    } else {
      // Tyres on grass rumble lower and quieter, and scrabble in a slide.
      glide = clamp01(0.06 + pace * 0.25 + skid * 0.45) * clamp01(s.speed / 2);
      glideTone = 900 - skid * 300 + pace * 500;
    }
  }
  return { wind, windTone, glide, glideTone, lift: s.mode === 'lift' ? 0.5 : 0, rain: s.rain ? clamp01(s.falling) * 0.6 : 0 };
}

/** A short tune for something earned: notes in Hz, seconds between them, and how loud. */
export interface Jingle {
  notes: number[];
  gap: number;
  gain: number;
  /**
   * 'bell' rings on; 'pluck' is short and dry; 'thud' is a rubber stamp coming down before the
   * notes; 'whistle' sounds its notes together, twice: a short toot and a long one; 'tick' has
   * no notes at all, only the small dry sound of a pole going into snow.
   */
  voice: 'bell' | 'pluck' | 'thud' | 'whistle' | 'tick';
}

// A pentatonic scale on D, so any run of notes sounds settled.
const D = [293.66, 329.63, 369.99, 440, 493.88, 587.33, 659.25, 739.99, 880, 987.77, 1174.66, 1318.51, 1479.98, 1760];

/** The jingle for a kind of event, or null for ones that pass in silence. */
export function jingleFor(kind: string, detail = ''): Jingle | null {
  switch (kind) {
    case 'mineral':
      // A new mineral, or a record, gets a longer run than one more of the same.
      return /New mineral|largest/.test(detail) ? { notes: [D[8], D[10], D[11], D[13]] as number[], gap: 0.07, gain: 0.5, voice: 'bell' } : { notes: [D[8], D[11]] as number[], gap: 0.06, gain: 0.4, voice: 'bell' };
    case 'trail':
    case 'path':
    case 'lift':
    case 'landmark':
    case 'condition':
      return { notes: [D[5], D[7], D[8]] as number[], gap: 0.09, gain: 0.45, voice: 'thud' };
    case 'peak':
    case 'season':
      return { notes: [D[3], D[5], D[7], D[8], D[10]] as number[], gap: 0.1, gain: 0.5, voice: 'thud' };
    case 'patch':
      return { notes: [D[3], D[5], D[7], D[10], D[8], D[10], D[12]] as number[], gap: 0.11, gain: 0.55, voice: 'bell' };
    case 'sighting':
      return /New/.test(detail) ? { notes: [D[9], D[11], D[10]] as number[], gap: 0.1, gain: 0.35, voice: 'pluck' } : { notes: [D[9], D[10]] as number[], gap: 0.09, gain: 0.25, voice: 'pluck' };
    case 'errand':
      return { notes: [D[4], D[5], D[7]] as number[], gap: 0.12, gain: 0.4, voice: 'pluck' };
    case 'gear':
      return { notes: [D[5], D[7], D[8], D[10]] as number[], gap: 0.09, gain: 0.45, voice: 'bell' };
    case 'toll': {
      // The church clock: one low stroke for each hour, by the twelve-hour clock.
      const strokes = Math.min(12, Math.max(1, Math.round(Number(detail)) || 1));
      return { notes: Array.from({ length: strokes }, () => 196), gap: 1.4, gain: 0.5, voice: 'bell' };
    }
    case 'train':
      // A steam whistle: three notes at once, a little sour, as they are.
      return { notes: [392, 466.16, 587.33], gap: 0, gain: 0.4, voice: 'whistle' };
    case 'pole':
      // A pole touched to the snow for a turn, or both pushed in to pole along: barely there.
      return { notes: [], gap: 0, gain: detail === 'push' ? 0.22 : 0.14, voice: 'tick' };
    case 'item':
      return { notes: [D[7], D[5]] as number[], gap: 0.1, gain: 0.35, voice: 'pluck' };
    default:
      return null;
  }
}
