/**
 * Garnets and minerals: what can be found on the mountain, where each turns up, and how finds are
 * scattered. No DOM or three.js here.
 *
 * Most lie on the groomed snow and along its edges, where skiing a trail brings a skier past
 * them; the uncommon and rare ones favour bare rock and deep woods, which take a detour.
 *
 * Finds refresh every day. Where they lie is worked out from the day and the place alone, so the
 * same spots hold the same stones for everyone all day, and a new set appears at midnight.
 *
 * There are not many. The common ones are met on any run; the uncommon ones want the right
 * kind of ground; and of each rare one there are a handful on the whole mountain on a day,
 * some of them only at a certain hour or season. Those are gone and looked for.
 */
import type { Season } from '../look/season';
import { showerOn } from './sky';
import type { Watch } from './wildlife';


export type Rarity = 'common' | 'uncommon' | 'rare';
/** Kinds of ground a find can lie in. */
export type Habitat = 'trail' | 'trailside' | 'rock' | 'forest' | 'mine' | 'shore' | 'summit';
export const HABITATS: readonly Habitat[] = ['trail', 'trailside', 'rock', 'forest', 'mine', 'shore', 'summit'];

/** A moment on the mountain, as far as stones care: some are only out at certain ones. */
export interface Moment {
  day: string;
  season: Season;
  watch: Watch;
}

export interface Mineral {
  id: string;
  name: string;
  rarity: Rarity;
  /** Its colour, for the collection. */
  colour: number;
  /** Where it turns up, and how often there, relative to the others. */
  habitats: Partial<Record<Habitat, number>>;
  /**
   * The moments it keeps to, if it is not there to be found whenever: seasons, watches of the
   * day, or the days of a meteor shower and the morning after.
   */
  when?: { seasons?: readonly Season[]; watches?: readonly Watch[]; shower?: true };
  /** Typical specimen size in centimetres, and the largest a lucky find can be. */
  size: number;
  largest: number;
  /** A line about it for the collection. */
  about: string;
  /** Where to look, shown before it has been found. */
  hint: string;
}

export const MINERALS: readonly Mineral[] = [
  {
    id: 'garnet',
    name: 'Almandine Garnet',
    rarity: 'common',
    colour: 0x8f1d2c,
    habitats: { trail: 5, trailside: 5, rock: 4, mine: 7 },
    size: 3,
    largest: 30,
    about: "New York's state gem. Gore's garnets are some of the biggest in the world.",
    hint: 'On the trails, beside them and in bare rock.',
  },
  {
    id: 'hornblende',
    name: 'Hornblende',
    rarity: 'common',
    colour: 0x23302c,
    habitats: { trail: 4, trailside: 4, rock: 3, forest: 2, mine: 2, summit: 2 },
    size: 4,
    largest: 20,
    about: "The dark rock that wraps around Gore's garnets.",
    hint: 'On the trails and beside them.',
  },
  {
    id: 'feldspar',
    name: 'Plagioclase Feldspar',
    rarity: 'common',
    colour: 0xd8d2c4,
    habitats: { trail: 4, trailside: 4, rock: 2, forest: 3, shore: 2, summit: 3 },
    size: 5,
    largest: 25,
    about: 'The pale mineral that a lot of the Adirondacks is made of.',
    hint: 'Almost anywhere.',
  },
  {
    id: 'quartz',
    name: 'Quartz',
    rarity: 'common',
    colour: 0xeef2f6,
    habitats: { trail: 3, trailside: 3, forest: 3, shore: 3 },
    size: 4,
    largest: 22,
    about: 'Clear to milky. Hard enough to scratch glass.',
    hint: 'On the trails and in the woods.',
  },
  {
    id: 'magnetite',
    name: 'Magnetite',
    rarity: 'uncommon',
    colour: 0x2b2b33,
    habitats: { trail: 0.5, trailside: 1.5, rock: 3, mine: 1, shore: 1 },
    size: 3,
    largest: 15,
    about: 'Iron ore. They mined it all over the Adirondacks in the 1800s. A magnet picks it up.',
    hint: 'In bare rock, and now and then on or beside a trail.',
  },
  {
    id: 'calcite',
    name: 'Calcite',
    rarity: 'uncommon',
    colour: 0xf3e3c3,
    habitats: { forest: 3, shore: 1 },
    size: 5,
    largest: 24,
    about: 'Soft, pale crystals from the marble that runs through these hills.',
    hint: 'Deep in the woods, away from the trails.',
  },
  {
    id: 'pyrite',
    name: 'Pyrite',
    rarity: 'uncommon',
    colour: 0xc9a43a,
    habitats: { rock: 3, trailside: 0.6 },
    size: 2,
    largest: 12,
    about: "Fool's gold. Brassy little cubes of iron and sulfur.",
    hint: 'In bare rock on steep ground.',
  },
  {
    id: 'graphite',
    name: 'Graphite',
    rarity: 'uncommon',
    colour: 0x55595f,
    habitats: { rock: 2.5, forest: 2 },
    size: 3,
    largest: 14,
    about: 'Soft and gray. Adirondack graphite went into the pencils made at Ticonderoga.',
    hint: 'In bare rock and in the woods.',
  },
  {
    id: 'labradorite',
    name: 'Labradorite',
    rarity: 'rare',
    colour: 0x3d6f9e,
    habitats: { rock: 0.9, summit: 0.6 },
    when: { watches: ['dawn', 'dusk'] },
    size: 4,
    largest: 18,
    about: 'A feldspar that flashes blue and green when the light hits it right.',
    hint: 'In bare rock and on the summits, at dawn and dusk, when the light comes in low. Rare.',
  },
  {
    id: 'tourmaline',
    name: 'Black Tourmaline',
    rarity: 'rare',
    colour: 0x16181d,
    habitats: { rock: 0.5, forest: 0.25 },
    size: 3,
    largest: 16,
    about: 'Long black crystals with grooves down the sides.',
    hint: 'In bare rock. Rare.',
  },
  {
    id: 'wollastonite',
    name: 'Wollastonite',
    rarity: 'rare',
    colour: 0xf6f3ea,
    habitats: { forest: 0.5 },
    size: 5,
    largest: 20,
    about: 'White and fibrous. They mine it at Willsboro, over in the eastern Adirondacks.',
    hint: 'Deep in the woods. Rare.',
  },
  {
    id: 'gem-garnet',
    name: 'Gem Garnet',
    rarity: 'rare',
    colour: 0xd0213a,
    habitats: { trail: 0.04, trailside: 0.08, rock: 0.15, mine: 0.5 },
    size: 1.5,
    largest: 6,
    about: 'Clear, deep red, and clean enough to cut.',
    hint: 'Wherever the regular garnets are, once in a long while. More often around the old workings.',
  },
  {
    id: 'biotite',
    name: 'Biotite Mica',
    rarity: 'common',
    colour: 0x2e2a26,
    habitats: { trail: 2, trailside: 3, rock: 1, forest: 2 },
    size: 3,
    largest: 14,
    about: 'Black mica. It peels into sheets thinner than paper.',
    hint: 'On the trails, beside them and in the woods.',
  },
  {
    id: 'diopside',
    name: 'Diopside',
    rarity: 'uncommon',
    colour: 0x5f8f4e,
    habitats: { forest: 1.5 },
    size: 3,
    largest: 12,
    about: 'A green crystal from the marble that runs through these hills. The good ones get cut as gems.',
    hint: 'Deep in the woods, away from the trails.',
  },
  {
    id: 'apatite',
    name: 'Apatite',
    rarity: 'uncommon',
    colour: 0x3f9f9a,
    habitats: { forest: 1, rock: 0.8 },
    size: 2.5,
    largest: 10,
    about: 'Blue-green and six-sided. Your teeth are made of nearly the same thing.',
    hint: 'In the woods and in bare rock.',
  },
  {
    id: 'serpentine',
    name: 'Serpentine',
    rarity: 'uncommon',
    colour: 0x6f8f5a,
    habitats: { shore: 1.5, forest: 0.8 },
    size: 5,
    largest: 22,
    about: 'Green, waxy and soft enough to carve. It turns up where there is marble.',
    hint: 'By the water, and deep in the woods.',
  },
  {
    id: 'ilmenite',
    name: 'Ilmenite',
    rarity: 'uncommon',
    colour: 0x3a3a44,
    habitats: { rock: 1.5, mine: 0.3 },
    size: 3,
    largest: 14,
    about: 'Black titanium ore. They dug a whole mine of it at Tahawus, north of here.',
    hint: 'In bare rock on steep ground.',
  },
  {
    id: 'river-garnet',
    name: 'River Garnet',
    rarity: 'uncommon',
    colour: 0xa8324a,
    habitats: { shore: 4 },
    when: { seasons: ['spring', 'summer', 'fall'] },
    size: 1.5,
    largest: 7,
    about: 'Garnets the water has rolled round and smooth.',
    hint: "By the ponds and the river, when they aren't frozen.",
  },
  {
    id: 'ice',
    name: 'Ice',
    rarity: 'uncommon',
    colour: 0xcfe6f2,
    habitats: { shore: 5 },
    when: { seasons: ['winter'] },
    size: 6,
    largest: 30,
    about: 'It counts. Ice is a mineral by every rule in the book, just one that melts.',
    hint: 'By the ponds and the river, in winter.',
  },
  {
    id: 'smoky-quartz',
    name: 'Smoky Quartz',
    rarity: 'rare',
    colour: 0x6b5a4e,
    habitats: { summit: 0.8, rock: 0.2 },
    size: 4,
    largest: 18,
    about: 'Quartz turned brown by the faint radiation in the rock around it, over a very long time.',
    hint: 'Near the summits, off the trails. Rare.',
  },
  {
    id: 'titanite',
    name: 'Titanite',
    rarity: 'rare',
    colour: 0x8a6a2e,
    habitats: { rock: 0.4, mine: 0.3 },
    size: 2,
    largest: 9,
    about: 'Brown crystals shaped like wedges. Older books call it sphene.',
    hint: 'In bare rock, and around the old workings. Rare.',
  },
  {
    id: 'zircon',
    name: 'Zircon',
    rarity: 'rare',
    colour: 0xb0623a,
    habitats: { summit: 0.8 },
    size: 0.8,
    largest: 3,
    about: 'Tiny and nearly indestructible. These mountains are dated by them: over a billion years.',
    hint: 'Near the summits, off the trails. Rare, and small.',
  },
  {
    id: 'fluorite',
    name: 'Fluorite',
    rarity: 'rare',
    colour: 0x8a6fc0,
    habitats: { forest: 0.3 },
    size: 3,
    largest: 12,
    about: "Glassy cubes, purple or green. It glows under ultraviolet light, which is where the word 'fluorescent' comes from.",
    hint: 'Deep in the woods. Rare.',
  },
  {
    id: 'rimmed-garnet',
    name: 'Rimmed Garnet',
    rarity: 'rare',
    colour: 0x7a1f30,
    habitats: { mine: 0.25 },
    size: 8,
    largest: 35,
    about: 'A garnet still sitting in its dark collar of hornblende, the way the miners found them.',
    hint: 'Only around the old workings. Rare.',
  },
  {
    id: 'meteorite',
    name: 'Meteorite',
    rarity: 'rare',
    colour: 0x4a4038,
    habitats: { summit: 1.2 },
    when: { shower: true },
    size: 2,
    largest: 9,
    about: "Not from around here. Hardly any shooting star makes it to the ground. This one did.",
    hint: 'Near the summits, on the days of a meteor shower and the morning after. Very rare.',
  },
];

export const mineralById = (id: string): Mineral | undefined => MINERALS.find((m) => m.id === id);

/** A repeatable number in 0..1 from whole numbers. */
function hash(a: number, b: number, c: number, d: number): number {
  let t = (Math.imul(a | 0, 0x9e3779b1) ^ Math.imul(b | 0, 0x85ebca6b) ^ Math.imul(c | 0, 0xc2b2ae35) ^ Math.imul(d | 0, 0x27d4eb2f)) >>> 0;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

/** A number for a day, so that each day scatters its finds differently. */
export function daySeed(day: string): number {
  let h = 2166136261;
  for (let i = 0; i < day.length; i++) h = Math.imul(h ^ day.charCodeAt(i), 16777619);
  return h | 0;
}

/** The day before a day, both as YYYY-MM-DD. */
function dayBefore(day: string): string {
  const [y, m, d] = day.split('-').map(Number) as [number, number, number];
  return new Date(Date.UTC(y, m - 1, d - 1)).toISOString().slice(0, 10);
}

/** True if a mineral is there to be found at a moment. Most always are. */
export function isOut(mineral: Mineral, moment: Moment): boolean {
  const when = mineral.when;
  if (!when) return true;
  if (when.seasons && !when.seasons.includes(moment.season)) return false;
  if (when.watches && !when.watches.includes(moment.watch)) return false;
  // What came down in the night lies there the next day too.
  if (when.shower && !showerOn(moment.day) && !showerOn(dayBefore(moment.day))) return false;
  return true;
}

/** What a position on the mountain is like, as far as minerals care. */
export interface Ground {
  /** Metres to the nearest groomed trail; zero on one. */
  trailDistance(x: number, z: number): number;
  slopeDegAt(x: number, z: number): number;
  /** Metres to the nearest of the old garnet workings, if the ground knows of any. */
  mineDistance?(x: number, z: number): number;
  /** Metres to the nearest summit, if the ground knows of any. */
  peakDistance?(x: number, z: number): number;
  /** Nonzero where the ground is a road, a path or a lot (1) or water (2), and no stone lies. */
  openAt?(x: number, z: number): number;
}

/** Ground within this distance of an old garnet working is strewn with what the miners left. */
export const MINE_REACH = 170;
/** Ground within this distance of a summit is the top of the mountain, where the oldest rock is bare. */
export const SUMMIT_REACH = 120;
/** Dry ground with water within this distance is shore. */
const SHORE_REACH = 12;

/** The kind of ground at a position, or null where nothing is found. */
export function habitatAt(ground: Ground, x: number, z: number): Habitat | null {
  if (ground.openAt && ground.openAt(x, z) !== 0) return null;
  const d = ground.trailDistance(x, z);
  // On the groomed snow, where a skier comes across them without leaving the trail.
  if (d <= 0) return 'trail';
  if (ground.mineDistance && ground.mineDistance(x, z) <= MINE_REACH) return 'mine';
  if (d < 1.5) return null;
  if (ground.peakDistance && ground.peakDistance(x, z) <= SUMMIT_REACH) return 'summit';
  if (ground.openAt) {
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      if (ground.openAt(x + Math.cos(a) * SHORE_REACH, z + Math.sin(a) * SHORE_REACH) === 2) return 'shore';
    }
  }
  // Steep enough to be bare rock: the same slopes the ground texture paints grey.
  if (ground.slopeDegAt(x, z) >= 42) return 'rock';
  // The open strip between a trail's edge and the trees.
  if (d <= 6) return 'trailside';
  if (d >= 70) return 'forest';
  return null;
}

/** Finds are scattered patch by patch; a patch is this many metres across. */
export const FIND_PATCH = 320;
/** Places tried in each patch, and the chance each is kept, by habitat. */
const TRIES = 420;
const KEEP: Record<Habitat, number> = { trail: 0.025, trailside: 0.14, rock: 0.028, forest: 0.0025, mine: 0.1, shore: 0.03, summit: 0.035 };
/** No more than this many finds in a patch, however promising the ground. */
export const MOST_PER_PATCH = 12;

export interface Find {
  /** Stable for the day: patch column, row and the try that produced it. */
  id: string;
  x: number;
  z: number;
  mineral: Mineral;
  /** Specimen size in centimetres. */
  size: number;
}

/**
 * The finds lying in one patch of the mountain on a given day.
 * @param originX the west and north edges of the mountain, where patch 0, 0 starts
 * @param moment the season, the watch and the day; left out, every stone is counted as out
 */
export function findsInPatch(ground: Ground, col: number, row: number, seed: number, originX: number, originZ: number, moment?: Moment): Find[] {
  const finds: Find[] = [];
  for (let i = 0; i < TRIES && finds.length < MOST_PER_PATCH; i++) {
    const x = originX + (col + hash(col, row, i, seed)) * FIND_PATCH;
    const z = originZ + (row + hash(col, row, i, seed ^ 0x51ed)) * FIND_PATCH;
    const habitat = habitatAt(ground, x, z);
    if (!habitat || hash(col, row, i, seed ^ 0x2a2a) >= KEEP[habitat]) continue;
    const mineral = pick(habitat, hash(col, row, i, seed ^ 0x7777));
    // One that keeps to another hour or season is simply not there now: nothing else lies in its place.
    if (!mineral || (moment && !isOut(mineral, moment))) continue;
    // Round the old workings the big ones were left where they lay: the roll leans high.
    const roll = hash(col, row, i, seed ^ 0x1234);
    finds.push({ id: `${col}:${row}:${i}`, x, z, mineral, size: specimenSize(mineral, habitat === 'mine' ? 1 - (1 - roll) * (1 - roll) : roll) });
  }
  return finds;
}

/** Choose a mineral for a habitat from a roll in 0..1, by the weights in the table. */
export function pick(habitat: Habitat, roll: number): Mineral | null {
  let total = 0;
  for (const m of MINERALS) total += m.habitats[habitat] ?? 0;
  let at = roll * total;
  for (const m of MINERALS) {
    const w = m.habitats[habitat] ?? 0;
    if (w <= 0) continue;
    if (at < w) return m;
    at -= w;
  }
  return null;
}

/**
 * A specimen's size from a roll in 0..1. Most are near the typical size; a few are much larger,
 * and the very largest are once-in-a-season finds.
 */
export function specimenSize(mineral: Mineral, roll: number): number {
  // A high power of the roll keeps most finds near the typical size and leaves a long, thin tail
  // toward the largest: about one find in fifteen is more than half the record size.
  const size = mineral.size * (0.6 + 0.8 * roll) + (mineral.largest - mineral.size * 1.4) * Math.pow(roll, 12);
  return Math.round(size * 10) / 10;
}
