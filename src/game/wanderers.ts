import type { Season } from '../look/season';
import { projectState } from './projects';
import type { SaveData } from './save';
import type { SecretWhere } from './secrets';

/**
 * The people who are somewhere different every day: a painter, a camper, the four players of
 * the town's band, and Pip, who hides. Nothing says where any of them is. The painter is at
 * a view; the camper's smoke can be seen from a long way off; the band can be heard; and
 * the town will say, vaguely, which way Pip went. No DOM or three.js here.
 *
 * Each has a list of haunts, and is at one of them on any day (or at none: the band is not
 * about until there is a bandstand). Where a haunt is in the world is worked out as a
 * secret's place is (`placeAt` in `src/world/secretSites.ts`).
 */
export interface Haunt {
  id: string;
  /** What the place is called, where something needs to say so: "Twister Cliffs". */
  name: string;
  where: SecretWhere;
  off?: number;
  /** For Pip: what somebody in town says, who saw which way she went. Vague, and true. */
  hints?: readonly string[];
  /** For the painter: what she is painting there, for whoever paints the pictures. */
  scene?: string;
}

/** The painter's views: a painting of each, in each season. */
export const PAINTER_HAUNTS: readonly Haunt[] = [
  { id: 'cliffs', name: 'Twister Cliffs', where: { spot: 'twister-cliffs' }, off: 9, scene: 'a rocky cliff edge looking out over a wide forested valley' },
  { id: 'vermont', name: 'the Vermont Overlook', where: { spot: 'vermont-overlook' }, off: 9, scene: 'a mountain overlook with range after range of far blue hills' },
  { id: 'windy-hill', name: 'Windy Hill', where: { spot: 'windy-hill-lookout' }, off: 20, scene: 'a windy hilltop with one bent pine and a wooden bench' },
  { id: 'reservoir', name: 'the reservoir', where: { spot: 'north-creek-reservoir' }, off: 14, scene: 'a still mountain reservoir ringed with fir trees' },
  { id: 'rabbit-pond', name: 'Rabbit Pond', where: { spot: 'rabbit-pond' }, off: 12, scene: 'a small round pond deep in the woods' },
  { id: 'tower', name: 'the fire tower', where: { peak: 'gore' }, off: 24, scene: 'a steel fire tower standing on a bare mountain summit' },
];

/** Where the camper pitches: out of the way, every one. */
export const CAMPER_HAUNTS: readonly Haunt[] = [
  { id: 'deep-woods', name: 'the deep woods', where: { wild: 1 } },
  { id: 'far-woods', name: 'the far woods', where: { wild: 2 } },
  { id: 'back-woods', name: 'the back of beyond', where: { wild: 3 } },
  { id: 'upper-dam', name: 'the upper dam pond', where: { spot: 'upper-dam-pond' }, off: 18 },
  { id: 'botheration', name: 'Botheration Pond', where: { path: 'Botheration Pond Trail', along: 0.9 }, off: 14 },
  { id: 'ridge-dam', name: 'the ridge dam', where: { spot: 'ridge-dam' }, off: 18 },
];

/** Where each of the band practises, alone, until there are four of them. */
export const BAND: readonly { who: string; tune: string; haunt: Haunt }[] = [
  { who: 'fitch', tune: 'tune-fiddle', haunt: { id: 'band-fiddle', name: 'Rabbit Pond', where: { spot: 'rabbit-pond' }, off: 20 } },
  { who: 'hattie', tune: 'tune-horn', haunt: { id: 'band-horn', name: 'Burnt Ridge', where: { lift: 'Burnt Ridge Quad', along: 1 }, off: 30 } },
  { who: 'bo', tune: 'tune-banjo', haunt: { id: 'band-banjo', name: 'the scenic view', where: { spot: 'scenic-view' }, off: 10 } },
  { who: 'sal', tune: 'tune-squeezebox', haunt: { id: 'band-squeezebox', name: 'the Ski Bowl', where: { place: 'ski-bowl-lodge' }, off: 34 } },
];

/** The town project the band plays on, once it is built. */
export const BANDSTAND = 'bandstand';

/** Where Pip hides, and what the town says about which way she went. */
export const PIP_HAUNTS: readonly Haunt[] = [
  { id: 'tower', name: 'the fire tower', where: { peak: 'gore' }, off: 13, hints: ["Pip? She got on the Straight Brook chair. That's all I saw.", 'Pip went up. All the way up, I think.'] },
  { id: 'quarry', name: 'the old quarry', where: { spot: 'garnet-quarry' }, off: 14, hints: ['Pip took the shuttle out toward the mine. She had a flashlight.', 'She said something about garnets. And giggled.'] },
  { id: 'saddle', name: 'the Saddle Lodge', where: { place: 'saddle-lodge' }, off: 26, hints: ["Pip? Up at the Saddle somewhere. Behind something, I'd guess.", 'She went up the Express with a sandwich. That means a long hide.'] },
  { id: 'duck-pond', name: 'the Duck Pond', where: { spot: 'duck-pond' }, off: 16, hints: ['I saw a yellow hat go by toward the Duck Pond.', "She's by some water. She told me not to say which."] },
  { id: 'scenic', name: 'the scenic view', where: { spot: 'scenic-view' }, off: 22, hints: ['Pip went up the road with the view. On foot! Good for her.', 'Somewhere with a view. She likes to watch you looking.'] },
  { id: 'reservoir', name: 'the reservoir', where: { spot: 'north-creek-reservoir' }, off: 26, hints: ['Reservoir way, I think. She asked me how deep it is.', "Out past the reservoir. That's a walk, for a nine-year-old."] },
  { id: 'burnt-ridge', name: 'Burnt Ridge', where: { lift: 'Burnt Ridge Quad', along: 1 }, off: 44, hints: ['She rode the Burnt Ridge chair. I waved. She ducked.', 'Top of Burnt Ridge, last I saw. In the trees, probably.'] },
  { id: 'cliffs', name: 'Twister Cliffs', where: { spot: 'twister-cliffs' }, off: 24, hints: ['Pip? Twister, I think. Not ON Twister. Near it.', "She said she found a spot where nobody ever looks. So, somewhere you've never looked."] },
];

/** A day as a count of days, so that tomorrow is one more than today. */
function ordinal(day: string): number {
  const [y, m, d] = day.split('-').map(Number) as [number, number, number];
  return Math.round(Date.UTC(y, m - 1, d) / 86400000);
}

/**
 * A haunt for a day: the same all day, never the same two days running, and every one of
 * them in turn before any comes round again, so that somebody who looks every day has seen
 * them all in a week or so. The turn is taken in strides, so that it is not down the list.
 */
function pick<T>(from: readonly T[], day: string, salt: number): T {
  const n = from.length;
  // A stride that shares no factor with the number of haunts visits every one of them.
  const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));
  let stride = Math.max(1, Math.floor(n / 2) + 1);
  while (gcd(stride, n) !== 1) stride++;
  return from[(((ordinal(day) * stride + salt) % n) + n) % n] as T;
}

/** Where the painter has set up her easel today. */
export const painterToday = (day: string): Haunt => pick(PAINTER_HAUNTS, day, 3);
/** Where the camper's fire is today. */
export const camperToday = (day: string): Haunt => pick(CAMPER_HAUNTS, day, 5);
/** Where Pip is hiding today. */
export const pipToday = (day: string): Haunt => pick(PIP_HAUNTS, day, 1);

/** What a painting is filed under: the view and the season. */
export const paintingId = (haunt: string, season: Season): string => `${haunt}-${season}`;

/** How many paintings earn the beret, and the satchel. */
export const PAINTINGS_FOR_BERET = 3;
export const PAINTINGS_FOR_SATCHEL = 6;
/** What the camper hands over, by how many different days he has been found. */
export const CAMPER_GIFTS = ['jacket-moss', 'pack-basket', 'hat-straw'] as const;
/** How many times Pip has to be found for the racers, and for her crown. */
export const FINDS_FOR_RACERS = 3;
export const FINDS_FOR_CROWN = 5;

/** True once the town has a bandstand to play on. */
export const bandAbout = (save: SaveData, day: string): boolean => projectState(BANDSTAND, save.projects, day) === 'built';

/** True once every player's tune has been heard: there is a band. */
export const bandWhole = (save: SaveData): boolean => BAND.every((b) => save.gear.owned.includes(b.tune));

/** The day of the week, 0 for Sunday. */
export function weekday(day: string): number {
  const [y, m, d] = day.split('-').map(Number) as [number, number, number];
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

/**
 * True when the band is playing at the bandstand: Saturday, from dusk on, once there is a
 * whole band and somewhere for it to play.
 */
export function concertOn(save: SaveData, day: string, watch: string): boolean {
  return bandAbout(save, day) && bandWhole(save) && weekday(day) === 6 && (watch === 'dusk' || watch === 'night');
}

/**
 * True while Pip is out hiding: she has been met, she is not waiting on the player for
 * anything (`busy`: an errand of hers in hand, or one she has yet to ask), and she has not been
 * found yet today.
 */
export function pipHiding(save: SaveData, day: string, busy: boolean): boolean {
  return 'pip' in save.met && !busy && save.hide.day !== day;
}

/** What somebody says about which way Pip went: the day's first line, then its second. */
export function pipHint(day: string, nth: number): string {
  const hints = pipToday(day).hints ?? [];
  return hints[nth % Math.max(1, hints.length)] ?? '';
}

/** Who might have seen which way she went. Not Pip, and nobody who is out in the woods. */
export const PIP_WATCHERS = ['hazel', 'otto', 'marge', 'dot', 'june', 'walt', 'fenn', 'gus', 'bram', 'bea'];
/** How many people will say so in a day: after that, they talk of other things. */
export const HINTS_A_DAY = 2;

/** What the painter says as she hands one over, in turn. */
export const NELL_GIVES: readonly string[] = [
  "Here. Take it before I fix it and ruin it.\nIt's this view, more or less. I sort of left out a tree.",
  "This one's for you. It's sort of still wet.\nHold it by the edges. Not that edge.",
  "Done! I think. It's hard to know when to stop.\nSomebody walking up usually decides it for me.",
  "Here you go. I'm sort of proud of the sky.\nThe rest is... well. There's a sky.",
];
const NELL_BERET = "That's three of mine you've walked out for. Here - my spare beret.\nYou're sort of a collector now. Collectors wear hats.";
const NELL_SATCHEL = "Six! You'll need something to carry them in.\nTake my old satchel. I sort of have two. I sort of have five.";

/** What the camper says each new day he is found, and what he hands over with it. */
export const RO_FOUND: readonly string[] = [
  "You walked all the way out here? Huh.\nTake this jacket. I figure anybody who comes this far ought to be warm.",
  "You again! Followed the smoke, I figure.\nHere - a pack basket. I wove it. It only leans a little.",
  "Three camps you've found me at. That's a habit.\nMy other hat's yours. I figure I've only got the one head.",
  "Hey, you. Pull up a log.\nI've got nothing left to give you but coffee. It's chewy.",
  "Found me again. I figure you know these woods about as well as I do now.\nThat's a nice thing to know.",
];

/** What each of the band says as they teach their tune, and what they say on the bandstand. */
export const BAND_TEACH: Readonly<Record<string, string>> = {
  fitch: "You want to hear it? Um. Okay.\n...That's it. That's maybe the whole tune. You can have it.",
  hattie: "You want the tune? STAND BACK.\n...There. Now it's yours. It's everybody's within a mile, honestly.",
  bo: "I'll play you the one I know. More or less.\n...There. Take it with you. It's lighter than the banjo.",
  sal: "Well, sit. I'll play you my mother's waltz.\n...There. It's yours now, too. That's how she'd want it.",
};
export const BAND_WHOLE = "That's all four of us you've heard now.\nSaturday, at the bandstand, when it gets dark. Come listen.";
export const BAND_PLAYS: Readonly<Record<string, string>> = {
  fitch: "We're all here. In one place! I'm maybe going to faint.\nNo. I'm going to play.",
  hattie: "A BANDSTAND! With a ROOF! I can be loud on purpose!",
  bo: "Four of us, more or less in time. First time for everything.",
  sal: "Well, listen to that. A band. Marge is going to cry. I might.",
};
export const BAND_JACKET = "You found every one of us out there, before there was an us.\nHere. Band jacket. You're with the band.";

/** What Pip says when she is found, by how many times that makes. */
export const PIP_FOUND: readonly string[] = [
  "AAH! You found me!\nOkay. That's one. I'm going to hide better tomorrow.",
  "How?! I was SO quiet. I didn't even breathe.\n...I breathed a little. That's two.",
  "Three times! Okay. You win these. They're racing skis.\nI was going to grow into them. You have them.",
  "Did somebody TELL you? Somebody told you.\nI'm going to find out who. That's four.",
  "FIVE. Fine. You're the champion.\nI made you a crown. I had it ready since Tuesday. I knew.",
  "Found me again! I'm running out of mountain.\nThat's okay. I'll hide in the same places, but sneakier.",
];

/** What a turn at one of the wanderers comes to: what they say, and what they hand over. */
export interface Turn {
  lines: string[];
  gear: string[];
  /** A painting handed over: what it is filed under and what it is called. */
  painting?: { id: string; name: string };
  /** A tune played on the spot, by its voice. */
  tune?: string;
}

const owns = (save: SaveData, gear: string): boolean => save.gear.owned.includes(gear);

/**
 * What a wanderer has for the player just now, if anything: a painting, a gift, a tune, or
 * being found. Null when they only have small talk. The save is marked; the things to wear
 * are for the game to give.
 * @param hiding whether Pip is out hiding (`pipHiding`)
 */
export function wandererTurn(save: SaveData, personId: string, day: string, season: Season, watch: string, hiding: boolean): Turn | null {
  if (personId === 'nell') {
    const haunt = painterToday(day);
    const id = paintingId(haunt.id, season);
    if (id in save.paintings) return null;
    const turn: Turn = { lines: [NELL_GIVES[Object.keys(save.paintings).length % NELL_GIVES.length] as string], gear: [], painting: { id, name: `${haunt.name.charAt(0).toUpperCase()}${haunt.name.slice(1)}, ${season}` } };
    save.paintings[id] = day;
    const have = Object.keys(save.paintings).length;
    if (have >= PAINTINGS_FOR_BERET && !owns(save, 'hat-beret')) {
      turn.lines.push(NELL_BERET);
      turn.gear.push('hat-beret');
    } else if (have >= PAINTINGS_FOR_SATCHEL && !owns(save, 'pack-satchel')) {
      turn.lines.push(NELL_SATCHEL);
      turn.gear.push('pack-satchel');
    }
    return turn;
  }
  if (personId === 'ro') {
    if (save.camper.day === day) return null;
    save.camper = { days: save.camper.days + 1, day };
    const gift = CAMPER_GIFTS[save.camper.days - 1];
    // A gift already had some other way is passed over: the next visit brings the next.
    return { lines: [RO_FOUND[Math.min(save.camper.days, RO_FOUND.length) - 1] as string], gear: gift && !owns(save, gift) ? [gift] : [] };
  }
  const player = BAND.find((b) => b.who === personId);
  if (player) {
    const voice = player.tune.replace(/^tune-/, '');
    if (concertOn(save, day, watch)) {
      const first = !owns(save, 'jacket-band');
      return { lines: first ? [BAND_PLAYS[personId] as string, BAND_JACKET] : [BAND_PLAYS[personId] as string], gear: first ? ['jacket-band'] : [], tune: voice };
    }
    if (owns(save, player.tune)) return null;
    const turn: Turn = { lines: [BAND_TEACH[personId] as string], gear: [player.tune], tune: voice };
    if (BAND.every((b) => b.who === personId || owns(save, b.tune))) turn.lines.push(BAND_WHOLE);
    return turn;
  }
  if (personId === 'pip' && hiding) {
    save.hide = { day, finds: save.hide.finds + 1 };
    const n = save.hide.finds;
    const gear: string[] = [];
    if (n >= FINDS_FOR_RACERS && !owns(save, 'skis-racer')) gear.push('skis-racer');
    else if (n >= FINDS_FOR_CROWN && !owns(save, 'hat-crown')) gear.push('hat-crown');
    // The lines that hand something over are said when it is handed over, whenever that is.
    const line = gear[0] === 'skis-racer' ? PIP_FOUND[2] : gear[0] === 'hat-crown' ? PIP_FOUND[4] : n === 3 || n === 5 ? PIP_FOUND[5] : PIP_FOUND[Math.min(n, PIP_FOUND.length) - 1];
    return { lines: [line as string], gear };
  }
  return null;
}

/** True when a wanderer has something for the player: a mark hangs over them, as over anyone. Never over Pip, who is hiding. */
export function wandererWaits(save: SaveData, personId: string, day: string, season: Season, watch: string): boolean {
  if (personId === 'nell') return !(paintingId(painterToday(day).id, season) in save.paintings);
  if (personId === 'ro') return save.camper.day !== day;
  const player = BAND.find((b) => b.who === personId);
  if (player) return !owns(save, player.tune) || (concertOn(save, day, watch) && !owns(save, 'jacket-band'));
  return false;
}
