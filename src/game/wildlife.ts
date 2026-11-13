import type { Season } from '../look/season';

/**
 * The field guide: the animals, birds, plants and odd things to be seen on the mountain, where
 * and when each turns up, and how they are scattered. No DOM or three.js here.
 *
 * Like the stones, sightings are worked out from the date and the place, so they are the same on
 * every load. Unlike the stones they also follow the hour: the day is split into four watches
 * (dawn, day, dusk, night), and each watch brings out its own creatures.
 */

export type Watch = 'dawn' | 'day' | 'dusk' | 'night';
export const WATCHES: readonly Watch[] = ['dawn', 'day', 'dusk', 'night'];

/** Kinds of ground a sighting can be in. */
export type Haunt = 'trail' | 'edge' | 'woods' | 'rock' | 'water' | 'shore' | 'town';
export const HAUNTS: readonly Haunt[] = ['trail', 'edge', 'woods', 'rock', 'water', 'shore', 'town'];

export type Kin = 'animal' | 'bird' | 'plant' | 'curio';
export const KIN_NAME: Record<Kin, string> = { animal: 'Animals', bird: 'Birds', plant: 'Plants and fungi', curio: 'Curiosities' };

export interface Species {
  id: string;
  name: string;
  kin: Kin;
  /** Where it turns up, and how often there relative to the others. */
  haunts: Partial<Record<Haunt, number>>;
  /** The seasons and watches it is about in; all of them if not given. */
  seasons?: readonly Season[];
  watches?: readonly Watch[];
  /** 'low' keeps to the hardwoods of the lower slopes, 'high' to the spruce and fir above. */
  band?: 'low' | 'high';
  /** Shy creatures bolt if come upon at speed. They have to be approached gently. */
  shy?: boolean;
  /** Only within this many metres of a named trail, lift or place: its name, and how near. */
  near?: { name: string; within: number };
  /** A line about it for the guide, and where to look, shown before it has been seen. */
  about: string;
  hint: string;
}

const ALL_BUT_WINTER: readonly Season[] = ['spring', 'summer', 'fall'];

export const SPECIES: readonly Species[] = [
  // --- Animals ---
  {
    id: 'deer',
    name: 'White-tailed Deer',
    kin: 'animal',
    haunts: { edge: 4, woods: 3, town: 1 },
    watches: ['dawn', 'dusk', 'day'],
    band: 'low',
    shy: true,
    about: "Flips its tail up like a white flag, and then it's just gone.",
    hint: 'At the edge of the woods on the lower mountain. Go gently.',
  },
  {
    id: 'fox',
    name: 'Red Fox',
    kin: 'animal',
    haunts: { edge: 3, trail: 1.5, town: 1 },
    watches: ['dawn', 'dusk', 'night'],
    shy: true,
    about: 'Trots the trail edges early and late, listening for mice under the snow.',
    hint: 'Along the trails at dawn and dusk. Go gently.',
  },
  {
    id: 'hare',
    name: 'Snowshoe Hare',
    kin: 'animal',
    haunts: { woods: 3, edge: 2 },
    watches: ['dawn', 'day', 'dusk'],
    band: 'high',
    about: 'White in winter, brown in summer. Big snowshoe feet all year.',
    hint: 'Among the spruce and fir, high on the mountain.',
  },
  {
    id: 'bear',
    name: 'Black Bear',
    kin: 'animal',
    haunts: { woods: 2, edge: 1 },
    seasons: ALL_BUT_WINTER,
    watches: ['dawn', 'day', 'dusk'],
    about: 'After berries and beechnuts. Not interested in you at all. Sleeps the whole winter.',
    hint: 'In the woods, once the snow has gone.',
  },
  {
    id: 'moose',
    name: 'Moose',
    kin: 'animal',
    haunts: { shore: 0.8, woods: 0.1 },
    seasons: ['summer', 'fall'],
    watches: ['dawn', 'dusk'],
    shy: true,
    about: 'Taller at the shoulder than a skier in boots. A few have come back to the Adirondacks.',
    hint: 'By water at dawn or dusk, in summer and fall. Rare.',
  },
  {
    id: 'otter',
    name: 'River Otter',
    kin: 'animal',
    haunts: { shore: 3, water: 2 },
    watches: ['dawn', 'day', 'dusk'],
    about: 'Slides down snowbanks on its belly. As far as anyone can tell, just for fun.',
    hint: 'By the ponds and brooks.',
  },
  {
    id: 'beaver',
    name: 'Beaver',
    kin: 'animal',
    haunts: { water: 3, shore: 2 },
    seasons: ALL_BUT_WINTER,
    watches: ['dusk', 'night', 'dawn'],
    about: "Slaps its tail on the water so the whole pond knows you're here.",
    hint: 'On the ponds as the light goes.',
  },
  {
    id: 'porcupine',
    name: 'Porcupine',
    kin: 'animal',
    haunts: { woods: 2.5, rock: 1 },
    watches: ['dusk', 'night'],
    about: "Never in a hurry. With thirty thousand quills, it doesn't have to be.",
    hint: 'In the woods after dark.',
  },
  {
    id: 'squirrel',
    name: 'Red Squirrel',
    kin: 'animal',
    haunts: { edge: 4, woods: 3 },
    watches: ['dawn', 'day'],
    about: 'Yells at everybody who walks by, from a safe spot up a spruce.',
    hint: 'Anywhere there are trees, by day.',
  },
  {
    id: 'chipmunk',
    name: 'Chipmunk',
    kin: 'animal',
    haunts: { edge: 4, town: 2, rock: 1 },
    seasons: ALL_BUT_WINTER,
    watches: ['day'],
    band: 'low',
    about: 'Cheeks full, tail straight up. Always looks late for something.',
    hint: "Trail edges on the lower mountain, by day, when there's no snow.",
  },
  {
    id: 'marten',
    name: 'Pine Marten',
    kin: 'animal',
    haunts: { woods: 1.2 },
    seasons: ['winter', 'spring'],
    watches: ['dawn', 'day', 'dusk'],
    band: 'high',
    shy: true,
    about: 'A weasel about the size of a cat, up in the high spruce. Curious, and really quick.',
    hint: 'Deep in the upper woods, in the snow months. Rare.',
  },
  {
    id: 'bobcat',
    name: 'Bobcat',
    kin: 'animal',
    haunts: { rock: 0.45, woods: 0.08 },
    watches: ['dusk', 'night', 'dawn'],
    shy: true,
    about: 'Watches from the ledges. You only see one when it lets you.',
    hint: 'On steep rocky ground in poor light. Rare.',
  },
  {
    id: 'raccoon',
    name: 'Raccoon',
    kin: 'animal',
    haunts: { town: 4, shore: 1 },
    seasons: ALL_BUT_WINTER,
    watches: ['night', 'dusk'],
    about: 'Knows which night the trash goes out in North Creek.',
    hint: 'Around town after dark.',
  },
  {
    id: 'coyote',
    name: 'Eastern Coyote',
    kin: 'animal',
    haunts: { trail: 1.5, woods: 1 },
    seasons: ['winter', 'fall'],
    watches: ['night'],
    shy: true,
    about: "You'll hear them a lot more than you see them, singing across the valley.",
    hint: 'Out on the trails at night, in the cold months.',
  },

  // --- Birds ---
  {
    id: 'chickadee',
    name: 'Black-capped Chickadee',
    kin: 'bird',
    haunts: { edge: 5, woods: 2, town: 2 },
    watches: ['dawn', 'day'],
    about: 'Says its own name. Stand still long enough and one might land on your ski pole.',
    hint: 'In the trees beside any trail, by day.',
  },
  {
    id: 'raven',
    name: 'Common Raven',
    kin: 'bird',
    haunts: { rock: 3, trail: 1.5 },
    watches: ['dawn', 'day', 'dusk'],
    about: 'Rides the wind over the summit. Has opinions about your lunch.',
    hint: 'Around the ledges and the high trails.',
  },
  {
    id: 'turkey',
    name: 'Wild Turkey',
    kin: 'bird',
    haunts: { edge: 2, town: 2, trail: 1 },
    watches: ['dawn', 'day'],
    band: 'low',
    about: "They cross the road single file, and they don't hurry for anybody.",
    hint: 'Low on the mountain and around town, by day.',
  },
  {
    id: 'owl',
    name: 'Barred Owl',
    kin: 'bird',
    haunts: { woods: 3, edge: 1.5 },
    watches: ['dusk', 'night'],
    about: "Its call sounds like \"Who cooks for you?\" Once you hear it, that's all you hear.",
    hint: 'In the woods at dusk and after dark.',
  },
  {
    id: 'loon',
    name: 'Common Loon',
    kin: 'bird',
    haunts: { water: 4 },
    seasons: ['summer', 'fall'],
    watches: ['dawn', 'day', 'dusk'],
    about: "That call across a pond at dusk. If the Adirondacks have a sound, it's this.",
    hint: 'Out on the ponds, in summer and fall.',
  },
  {
    id: 'heron',
    name: 'Great Blue Heron',
    kin: 'bird',
    haunts: { shore: 3, water: 1.5 },
    seasons: ALL_BUT_WINTER,
    watches: ['dawn', 'day'],
    shy: true,
    about: 'Stands in the shallows like a lawn ornament until a fish swims by.',
    hint: 'At the water\'s edge. Go gently.',
  },
  {
    id: 'eagle',
    name: 'Bald Eagle',
    kin: 'bird',
    haunts: { shore: 1.2 },
    watches: ['dawn', 'day'],
    near: { name: 'Hudson River', within: 220 },
    about: 'Fishes the Hudson where the current keeps the water open.',
    hint: 'Along the Hudson at North Creek. Rare.',
  },
  {
    id: 'bluejay',
    name: 'Blue Jay',
    kin: 'bird',
    haunts: { edge: 3, town: 3 },
    watches: ['dawn', 'day'],
    band: 'low',
    about: "Loud and good-looking. Always the first to tell the woods there's an owl around.",
    hint: 'Low on the mountain and around town.',
  },
  {
    id: 'grouse',
    name: 'Ruffed Grouse',
    kin: 'bird',
    haunts: { woods: 3, edge: 1.5 },
    seasons: ['fall', 'winter'],
    watches: ['day', 'dusk'],
    about: 'Bursts out of the snow right at your feet. It gets me every single time.',
    hint: 'In the woods, in fall and winter.',
  },
  {
    id: 'grayjay',
    name: 'Canada Jay',
    kin: 'bird',
    haunts: { edge: 2, woods: 1 },
    seasons: ['winter', 'spring'],
    watches: ['day'],
    band: 'high',
    near: { name: 'summit', within: 900 },
    about: "The camp robber of the high spruce. It's already spotted your sandwich.",
    hint: 'Near the summit, in the snow months.',
  },
  {
    id: 'hummingbird',
    name: 'Ruby-throated Hummingbird',
    kin: 'bird',
    haunts: { trail: 2, town: 2, edge: 1 },
    seasons: ['summer'],
    watches: ['day'],
    band: 'low',
    about: 'Like a garnet with wings, working its way through the meadow flowers.',
    hint: 'Over the summer meadows, low on the mountain.',
  },

  // --- Plants and fungi ---
  {
    id: 'trillium',
    name: 'Red Trillium',
    kin: 'plant',
    haunts: { woods: 3, edge: 2 },
    seasons: ['spring'],
    band: 'low',
    about: "Three leaves, three petals. It smells pretty bad - it's trying to attract flies.",
    hint: 'On the floor of the lower woods in spring.',
  },
  {
    id: 'troutlily',
    name: 'Trout Lily',
    kin: 'plant',
    haunts: { edge: 3, shore: 2 },
    seasons: ['spring'],
    about: 'Comes up through the last of the snow. The leaves are speckled like a brook trout.',
    hint: 'Trail edges and stream banks in spring.',
  },
  {
    id: 'fiddlehead',
    name: 'Fiddlehead Ferns',
    kin: 'plant',
    haunts: { shore: 3, woods: 1.5 },
    seasons: ['spring'],
    about: 'Ferns before they unroll, curled up like the top of a fiddle.',
    hint: 'Damp ground in spring.',
  },
  {
    id: 'ladyslipper',
    name: 'Pink Lady\'s Slipper',
    kin: 'plant',
    haunts: { woods: 0.8 },
    seasons: ['spring', 'summer'],
    band: 'high',
    about: 'An orchid of the spruce woods. It can take ten years to flower, so look and leave it be.',
    hint: 'Deep in the upper woods, late spring into summer. Rare.',
  },
  {
    id: 'daisy',
    name: 'Oxeye Daisies',
    kin: 'plant',
    haunts: { trail: 4, town: 1 },
    seasons: ['summer'],
    about: "What a ski trail grows when nobody's looking.",
    hint: 'All over the summer trails.',
  },
  {
    id: 'blueberry',
    name: 'Wild Blueberries',
    kin: 'plant',
    haunts: { rock: 4, edge: 0.6 },
    seasons: ['summer'],
    about: 'Small and sweet, out on the sunny ledges. The bears know every patch.',
    hint: 'On rocky ground in summer.',
  },
  {
    id: 'cattail',
    name: 'Cattails',
    kin: 'plant',
    haunts: { shore: 4 },
    seasons: ['summer', 'fall'],
    about: 'Brown velvet on a stick, standing in the shallows.',
    hint: 'At the edge of a pond.',
  },
  {
    id: 'goldenrod',
    name: 'Goldenrod',
    kin: 'plant',
    haunts: { trail: 3, edge: 2, town: 1 },
    seasons: ['fall', 'summer'],
    about: 'Turns the meadows yellow right when the maples turn red.',
    hint: 'On the trails late in the year.',
  },
  {
    id: 'chanterelle',
    name: 'Chanterelles',
    kin: 'plant',
    haunts: { woods: 2.5 },
    seasons: ['summer', 'fall'],
    band: 'low',
    about: 'Egg-yolk yellow. They smell a little like apricots.',
    hint: 'Under the hardwoods after rain.',
  },
  {
    id: 'flyagaric',
    name: 'Fly Agaric',
    kin: 'plant',
    haunts: { woods: 2, edge: 1 },
    seasons: ['fall'],
    band: 'high',
    about: 'The red toadstool with white spots, from every storybook. Just for looking at.',
    hint: 'Under the spruce in fall.',
  },
  {
    id: 'mapleleaf',
    name: 'A Perfect Maple Leaf',
    kin: 'plant',
    haunts: { edge: 3, trail: 1, town: 1 },
    seasons: ['fall'],
    band: 'low',
    about: "Every fall there's one leaf with no spots and no holes. This is it.",
    hint: 'Under the maples in fall.',
  },
  {
    id: 'balsamcone',
    name: 'Balsam Cones',
    kin: 'plant',
    haunts: { edge: 3, woods: 2 },
    seasons: ['winter', 'fall'],
    band: 'high',
    about: 'They stand straight up on the branch like candles. They smell like Christmas.',
    hint: 'Under the firs of the upper mountain.',
  },
  {
    id: 'icicles',
    name: 'Blue Icicles',
    kin: 'plant',
    haunts: { rock: 4 },
    seasons: ['winter', 'spring'],
    about: 'Water seeping out of the ledge, frozen into a curtain of blue ice.',
    hint: "On the ledges while it's cold.",
  },
  {
    id: 'birchbark',
    name: 'Paper Birch Curl',
    kin: 'plant',
    haunts: { edge: 2.5, woods: 1.5 },
    seasons: ['winter'],
    band: 'low',
    about: "A curl of white bark the tree let go of. It'll light a fire even in the rain.",
    hint: 'Under the birches of the lower mountain in winter.',
  },

  // --- Curiosities ---
  {
    id: 'snowman',
    name: 'Somebody\'s Snowman',
    kin: 'curio',
    haunts: { edge: 0.6, town: 2.5, trail: 0.5 },
    seasons: ['winter'],
    watches: ['dawn', 'day', 'dusk'],
    about: "Carrot nose, stick arms, somebody's scarf. Nobody ever sees who builds them.",
    hint: 'Beside the trails and around town in winter.',
  },
  {
    id: 'cairn',
    name: 'A Hiker\'s Cairn',
    kin: 'curio',
    haunts: { rock: 2.5 },
    seasons: ALL_BUT_WINTER,
    about: 'Stones stacked by people walking past, one at a time, for years.',
    hint: 'On rocky ground when the snow has gone.',
  },
  {
    id: 'rumor',
    name: 'The Rumor',
    kin: 'curio',
    haunts: { woods: 1 },
    watches: ['dusk', 'night'],
    shy: true,
    near: { name: 'The Rumor', within: 420 },
    about: "Tall, shaggy, and gone before you're sure. Some people say it's all Lies.",
    hint: 'They say something walks the woods near The Rumor when the light goes. Go very gently.',
  },
];

export const speciesById = (id: string): Species | undefined => SPECIES.find((s) => s.id === id);

/** The watch of the day for a height of the sun, in degrees, and which side of noon it is. */
export function watchFor(sunElevationDeg: number, sunInEast: boolean): Watch {
  if (sunElevationDeg < -6) return 'night';
  if (sunElevationDeg < 10) return sunInEast ? 'dawn' : 'dusk';
  return 'day';
}

/** What a position on the mountain is like, as far as wildlife cares. */
export interface Country {
  /** Metres to the nearest groomed trail; zero on one. */
  trailDistance(x: number, z: number): number;
  slopeDegAt(x: number, z: number): number;
  /** 0 forest, 1 open land (roads, lots, paths), 2 water. */
  openAt(x: number, z: number): number;
  /** Share of hardwood in the forest, 0..1. */
  hardwoodAt(x: number, z: number): number;
  /** Metres to the nearest building of the town. */
  townDistance(x: number, z: number): number;
  /** Metres to a thing by name (a trail, a river, the summit), or Infinity if there is none. */
  distanceTo(name: string, x: number, z: number): number;
}

const SHORE_REACH = 14;

/** The kind of ground at a position, or null where nothing is to be seen (out on a road, say). */
export function hauntAt(country: Country, x: number, z: number): Haunt | null {
  const open = country.openAt(x, z);
  if (open === 2) return 'water';
  // Dry ground with water close by on any side.
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    if (country.openAt(x + Math.cos(a) * SHORE_REACH, z + Math.sin(a) * SHORE_REACH) === 2) return 'shore';
  }
  if (country.townDistance(x, z) < 45) return 'town';
  if (open === 1) return null;
  const d = country.trailDistance(x, z);
  if (d <= 0) return 'trail';
  if (country.slopeDegAt(x, z) >= 42) return 'rock';
  if (d <= 14) return 'edge';
  if (d >= 40) return 'woods';
  return null;
}

/** Whether a species is about, in a season and a watch, at a position of a given kind. */
export function isAbout(s: Species, haunt: Haunt, season: Season, watch: Watch, hardwood: number): boolean {
  if (!(s.haunts[haunt] ?? 0)) return false;
  if (s.seasons && !s.seasons.includes(season)) return false;
  if (s.watches && !s.watches.includes(watch)) return false;
  if (s.band === 'low' && hardwood < 0.5) return false;
  if (s.band === 'high' && hardwood > 0.5) return false;
  return true;
}

/** Sightings are scattered patch by patch; a patch is this many metres across. */
export const SIGHT_PATCH = 320;
/** Places tried in each patch, and the chance each is kept, by kind of ground. */
const TRIES = 150;
const KEEP: Record<Haunt, number> = { trail: 0.014, edge: 0.12, woods: 0.008, rock: 0.04, water: 0.025, shore: 0.05, town: 0.045 };
/** No more than this many sightings in a patch. */
export const MOST_SIGHTINGS = 6;

export interface Sighting {
  /** Stable for the watch: patch column, row and the try that produced it. */
  id: string;
  x: number;
  z: number;
  species: Species;
  /** A number in 0..1 that stays with it: which way it faces, and when it moves. */
  roll: number;
}

function hash(a: number, b: number, c: number, d: number): number {
  let t = (Math.imul(a | 0, 0x9e3779b1) ^ Math.imul(b | 0, 0x85ebca6b) ^ Math.imul(c | 0, 0xc2b2ae35) ^ Math.imul(d | 0, 0x27d4eb2f)) >>> 0;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

/** A number for a day and a watch, so that each watch of each day scatters differently. */
export function watchSeed(day: string, watch: Watch): number {
  let h = 2166136261;
  for (let i = 0; i < day.length; i++) h = Math.imul(h ^ day.charCodeAt(i), 16777619);
  return (h ^ Math.imul(WATCHES.indexOf(watch) + 1, 0x632be5ab)) | 0;
}

/**
 * What there is to see in one patch of the mountain, in a season and a watch.
 * @param originX the west and north edges of the mountain, where patch 0, 0 starts
 */
export function sightingsInPatch(country: Country, col: number, row: number, seed: number, season: Season, watch: Watch, originX: number, originZ: number): Sighting[] {
  const out: Sighting[] = [];
  for (let i = 0; i < TRIES && out.length < MOST_SIGHTINGS; i++) {
    const x = originX + (col + hash(col, row, i, seed)) * SIGHT_PATCH;
    const z = originZ + (row + hash(col, row, i, seed ^ 0x51ed)) * SIGHT_PATCH;
    const haunt = hauntAt(country, x, z);
    if (!haunt || hash(col, row, i, seed ^ 0x2a2a) >= KEEP[haunt]) continue;
    const hardwood = country.hardwoodAt(x, z);
    let total = 0;
    const about: Species[] = [];
    for (const s of SPECIES) {
      if (!isAbout(s, haunt, season, watch, hardwood)) continue;
      if (s.near && country.distanceTo(s.near.name, x, z) > s.near.within) continue;
      about.push(s);
      total += s.haunts[haunt] ?? 0;
    }
    if (about.length === 0) continue;
    let at = hash(col, row, i, seed ^ 0x7777) * total;
    let chosen = about[about.length - 1] as Species;
    for (const s of about) {
      const w = s.haunts[haunt] ?? 0;
      if (at < w) {
        chosen = s;
        break;
      }
      at -= w;
    }
    out.push({ id: `${col}:${row}:${i}`, x, z, species: chosen, roll: hash(col, row, i, seed ^ 0x1234) });
  }
  return out;
}

/** How near the player must come for a sighting to count, in metres: animals keep their distance, plants do not. */
export function spotReach(s: Species): number {
  return s.kin === 'plant' || s.kin === 'curio' ? (s.id === 'rumor' ? 30 : 6) : 16;
}

/** A shy creature bolts when the player is this close and moving faster than a gentle pace. */
export const SHY_REACH = 34;
export const GENTLE_SPEED = 8.5;

/** The benches high on the mountain, where the camp robber keeps watch for sandwiches. */
const HIGH_BENCHES: readonly string[] = ['bench:summit', 'bench:saddle-lodge'];

/**
 * Who comes to sit by someone who has been sitting still on a bench: a chickadee by day, and at
 * the high benches in the snow months a Canada jay. Nobody comes at dusk or after dark.
 */
export function benchVisitor(benchId: string, season: Season, watch: Watch): Species | null {
  if (watch !== 'dawn' && watch !== 'day') return null;
  const id = HIGH_BENCHES.includes(benchId) && (season === 'winter' || season === 'spring') && watch === 'day' ? 'grayjay' : 'chickadee';
  return SPECIES.find((s) => s.id === id) ?? null;
}
