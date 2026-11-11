/**
 * Garnets and minerals: what can be found on the mountain, where each turns up, and how finds are
 * scattered. No DOM or three.js here.
 *
 * Most lie on the groomed snow and along its edges, where skiing a trail brings a skier past
 * them; the uncommon and rare ones favour bare rock and deep woods, which take a detour.
 *
 * Finds refresh every day. Where they lie is worked out from the day and the place alone, so the
 * same spots hold the same stones for everyone all day, and a new set appears at midnight.
 */

export type Rarity = 'common' | 'uncommon' | 'rare';
/** Kinds of ground a find can lie in. */
export type Habitat = 'trail' | 'trailside' | 'rock' | 'forest' | 'mine';
export const HABITATS: readonly Habitat[] = ['trail', 'trailside', 'rock', 'forest', 'mine'];

export interface Mineral {
  id: string;
  name: string;
  rarity: Rarity;
  /** Its colour, for the collection. */
  colour: number;
  /** Where it turns up, and how often there, relative to the others. */
  habitats: Partial<Record<Habitat, number>>;
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
    about: "New York's state gem. Gore's garnets are among the largest in the world.",
    hint: 'On the trails, beside them and in bare rock.',
  },
  {
    id: 'hornblende',
    name: 'Hornblende',
    rarity: 'common',
    colour: 0x23302c,
    habitats: { trail: 4, trailside: 4, rock: 3, forest: 2, mine: 2 },
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
    habitats: { trail: 4, trailside: 4, rock: 2, forest: 3 },
    size: 5,
    largest: 25,
    about: 'The pale mineral that makes up much of the Adirondacks.',
    hint: 'Almost anywhere.',
  },
  {
    id: 'quartz',
    name: 'Quartz',
    rarity: 'common',
    colour: 0xeef2f6,
    habitats: { trail: 3, trailside: 3, forest: 3 },
    size: 4,
    largest: 22,
    about: 'Clear to milky, and hard enough to scratch glass.',
    hint: 'On the trails and in the woods.',
  },
  {
    id: 'magnetite',
    name: 'Magnetite',
    rarity: 'uncommon',
    colour: 0x2b2b33,
    habitats: { trail: 0.8, trailside: 2, rock: 3, mine: 1 },
    size: 3,
    largest: 15,
    about: 'Iron ore, mined across the Adirondacks in the 1800s. A magnet picks it up.',
    hint: 'In bare rock, and now and then on or beside a trail.',
  },
  {
    id: 'calcite',
    name: 'Calcite',
    rarity: 'uncommon',
    colour: 0xf3e3c3,
    habitats: { forest: 4 },
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
    habitats: { rock: 4, trailside: 1 },
    size: 2,
    largest: 12,
    about: "Fool's gold: brassy cubes that are iron and sulphur, not gold.",
    hint: 'In bare rock on steep ground.',
  },
  {
    id: 'graphite',
    name: 'Graphite',
    rarity: 'uncommon',
    colour: 0x55595f,
    habitats: { rock: 3, forest: 2 },
    size: 3,
    largest: 14,
    about: 'Soft and grey. Adirondack graphite went into pencils made at Ticonderoga.',
    hint: 'In bare rock and in the woods.',
  },
  {
    id: 'labradorite',
    name: 'Labradorite',
    rarity: 'rare',
    colour: 0x3d6f9e,
    habitats: { rock: 2 },
    size: 4,
    largest: 18,
    about: 'A feldspar that flashes blue and green when it catches the light.',
    hint: 'In bare rock on steep ground. Rare.',
  },
  {
    id: 'tourmaline',
    name: 'Black Tourmaline',
    rarity: 'rare',
    colour: 0x16181d,
    habitats: { rock: 1.5, forest: 0.6 },
    size: 3,
    largest: 16,
    about: 'Long black crystals with grooves down their sides.',
    hint: 'In bare rock. Rare.',
  },
  {
    id: 'wollastonite',
    name: 'Wollastonite',
    rarity: 'rare',
    colour: 0xf6f3ea,
    habitats: { forest: 1.2 },
    size: 5,
    largest: 20,
    about: 'White and fibrous. It is mined at Willsboro, in the eastern Adirondacks.',
    hint: 'Deep in the woods. Rare.',
  },
  {
    id: 'gem-garnet',
    name: 'Gem Garnet',
    rarity: 'rare',
    colour: 0xd0213a,
    habitats: { trail: 0.15, trailside: 0.35, rock: 0.5, mine: 1 },
    size: 1.5,
    largest: 6,
    about: 'Clear, deep red, and flawless enough to cut.',
    hint: 'Where the ordinary garnets are, once in a long while. Oftener round the old workings.',
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

/** What a position on the mountain is like, as far as minerals care. */
export interface Ground {
  /** Metres to the nearest groomed trail; zero on one. */
  trailDistance(x: number, z: number): number;
  slopeDegAt(x: number, z: number): number;
  /** Metres to the nearest of the old garnet workings, if the ground knows of any. */
  mineDistance?(x: number, z: number): number;
}

/** Ground within this distance of an old garnet working is strewn with what the miners left. */
export const MINE_REACH = 170;

/** The kind of ground at a position, or null where nothing is found. */
export function habitatAt(ground: Ground, x: number, z: number): Habitat | null {
  const d = ground.trailDistance(x, z);
  // On the groomed snow, where a skier comes across them without leaving the trail.
  if (d <= 0) return 'trail';
  if (ground.mineDistance && ground.mineDistance(x, z) <= MINE_REACH) return 'mine';
  if (d < 1.5) return null;
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
const KEEP: Record<Habitat, number> = { trail: 0.08, trailside: 0.5, rock: 0.14, forest: 0.006, mine: 0.22 };
/** No more than this many finds in a patch, however promising the ground. */
export const MOST_PER_PATCH = 24;

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
 */
export function findsInPatch(ground: Ground, col: number, row: number, seed: number, originX: number, originZ: number): Find[] {
  const finds: Find[] = [];
  for (let i = 0; i < TRIES && finds.length < MOST_PER_PATCH; i++) {
    const x = originX + (col + hash(col, row, i, seed)) * FIND_PATCH;
    const z = originZ + (row + hash(col, row, i, seed ^ 0x51ed)) * FIND_PATCH;
    const habitat = habitatAt(ground, x, z);
    if (!habitat || hash(col, row, i, seed ^ 0x2a2a) >= KEEP[habitat]) continue;
    const mineral = pick(habitat, hash(col, row, i, seed ^ 0x7777));
    if (!mineral) continue;
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
