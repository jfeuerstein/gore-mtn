import type { Season } from '../look/season';
import { DIFFICULTY_MARK, type Difficulty } from '../world/trails';
import type { Species, Watch } from './wildlife';

/**
 * The snow report chalked up by the Base Lodge door: the real season, sky and hour at Gore, as
 * a ski area reports them, which is to say cheerfully. No DOM or three.js here.
 */
export interface Conditions {
  season: Season;
  /** How overcast it is and how much is falling, each 0..1, as the sky gives them. */
  overcast: number;
  falling: number;
  watch: Watch;
  /** The date, as YYYY-MM-DD: the report has a different closing line each day. */
  day: string;
}

const SURFACE: Record<Season, string> = {
  winter: 'packed powder',
  spring: 'corn snow, mashed potatoes, a little mud',
  summer: 'grass. Dirt on the bike trails',
  fall: 'leaves. Lots of leaves',
};

const BASE: Record<Season, string> = {
  winter: 'plenty',
  spring: 'hanging in there',
  summer: "none. It's summer",
  fall: 'soon, we hope',
};

/** Closing remarks, one a day, turn about. */
const NOTES: readonly string[] = [
  'Trees have the right of way. Thanks! - Patrol',
  "Bram groomed everything last night. He'd like that noted.",
  "Please don't feed the Mayor. He's had plenty.",
  'The lost and found is up to fourteen left mittens. Come get yours.',
  "No lift lines today. Go around again.",
  "Chili's on at the Saddle. (It's always on.)",
  "Forecast by Madame Flurry. She'll confirm it tomorrow.",
  'Tom at the Ski Bowl says hi. (Pip says Tom says hi.)',
  'Gerald, on Twister, is a bump. Go easy on him.',
  "The Snow Train leaves whenever you're ready.",
];

/** What the sky is doing, in a report's words. */
export function sky(c: Conditions): string {
  const snow = c.season === 'winter' || c.season === 'spring';
  if (c.falling > 0.6) return snow ? 'SNOWING. A lot' : 'RAIN, pretty steady';
  if (c.falling > 0.05) return snow ? 'flurries' : 'a passing shower';
  if (c.watch === 'night') return c.overcast > 0.5 ? 'dark and cloudy' : 'clear, with stars';
  if (c.overcast > 0.7) return 'overcast';
  if (c.overcast > 0.3) return 'some clouds';
  return c.watch === 'dawn' ? 'clear, a little pink' : c.watch === 'dusk' ? 'clear, going gold' : 'bluebird';
}

/** New snow in the last while, as optimistically as honesty allows. */
function fresh(c: Conditions): string {
  if (c.season === 'summer') return 'no';
  if (c.season === 'fall') return c.falling > 0.05 ? "no, that's rain" : 'not yet';
  if (c.falling > 0.6) return 'yes! Look outside';
  if (c.falling > 0.05) return 'a dusting so far';
  return c.season === 'winter' ? 'not since last time' : 'no, sorry';
}

/** The report, as lines to be chalked one under another. */
export function snowReport(c: Conditions, lifts: number, trails: number): string {
  let seed = 0;
  for (let i = 0; i < c.day.length; i++) seed = (seed * 31 + c.day.charCodeAt(i)) >>> 0;
  return [
    'SNOW REPORT',
    `Sky: ${sky(c)}.`,
    `New snow: ${fresh(c)}. Base: ${BASE[c.season]}.`,
    `Surface: ${SURFACE[c.season]}.`,
    `Lifts turning: ${lifts} of ${lifts}.`,
    `Trails open: ${trails} of ${trails}.`,
    NOTES[seed % NOTES.length] as string,
  ].join('\n');
}

/**
 * A repeatable number from a day, well stirred: one day's number says nothing about the
 * next's, so what is picked by it (a trail, a reason, a guest) does not walk down a list.
 */
export function dayNumber(day: string): number {
  let seed = 0;
  for (let i = 0; i < day.length; i++) seed = (seed * 31 + day.charCodeAt(i)) >>> 0;
  // A day and the day after differ by one before this; afterwards, by about half their bits.
  seed ^= seed >>> 16;
  seed = Math.imul(seed, 0x85ebca6b);
  seed ^= seed >>> 13;
  seed = Math.imul(seed, 0xc2b2ae35);
  seed ^= seed >>> 16;
  return seed >>> 0;
}

/** Why today's trail is today's trail. */
const REASONS: readonly string[] = [
  "you haven't been down it yet",
  'Bram did a really nice job on it',
  'Otto gives it an eight',
  'somebody should',
  "there's a good view about halfway down",
  "no reason. It's just a nice one",
  'Hazel says the snow is good on it',
  "it's quiet over there today",
  'Biscuit likes to watch people come down it',
  'the sun gets to it early',
];

/**
 * The trail board outside the Saddle Lodge: each day it picks one trail not yet stamped in the
 * passport, so there is always somewhere new to go.
 * @param stamped whether a trail is already in the passport
 * @param riding true in the bike months, when it is the ride of the day
 */
export function trailOfTheDay(trails: readonly { name: string; difficulty: Difficulty; glade: boolean }[], stamped: (name: string) => boolean, day: string, riding = false): string {
  const title = riding ? 'RIDE OF THE DAY' : 'TRAIL OF THE DAY';
  const todo = trails.filter((t) => !stamped(t.name));
  const pick = trailPick(trails, stamped, day);
  if (!pick) return `${title}: whichever you like!\nYou've done every single one. We checked the book twice.`;
  return `${title}: ${DIFFICULTY_MARK[pick.difficulty]} ${pick.name.toUpperCase()}${pick.glade ? ' (in the trees)' : ''}.\nWhy: ${trailReason(day)}.\n${todo.length} still to stamp.`;
}

/** How many trails must be in the passport before the board will send anyone down something hard. */
export const GENTLE_UNTIL = 6;
const GENTLE: readonly string[] = ['easy', 'intermediate'];

/**
 * The day's trail: one not yet stamped, the same one all day, for the board and for the flyer.
 * Null when every trail is stamped. To someone new to the mountain it names an easy or a
 * middling trail out in the open, not a glade or a black diamond.
 */
export function trailPick<T extends { name: string; difficulty?: string; glade?: boolean }>(trails: readonly T[], stamped: (name: string) => boolean, day: string): T | null {
  const todo = trails.filter((t) => !stamped(t.name));
  if (todo.length === 0) return null;
  const gentle = trails.length - todo.length < GENTLE_UNTIL ? todo.filter((t) => !t.glade && t.difficulty !== undefined && GENTLE.includes(t.difficulty)) : [];
  const from = gentle.length > 0 ? gentle : todo;
  return from[dayNumber(day) % from.length] as T;
}

/** Why today's trail is today's trail. */
export function trailReason(day: string): string {
  // Stepped through three at a time, so that no reason comes round again for ten days, with
  // each month starting somewhere of its own. It can never be the reason given yesterday.
  const [y, m, d] = day.split('-').map(Number) as [number, number, number];
  const count = Math.round(Date.UTC(y, m - 1, d) / 86400000);
  return REASONS[(count * 3 + (dayNumber(day.slice(0, 7)) % 3)) % REASONS.length] as string;
}

const WATCH_NAME: Record<Watch, string> = { dawn: 'first light', day: 'daytime', dusk: 'last light', night: 'after dark' };

/**
 * The observer's log at the fire tower: what is about on the mountain this season at this hour,
 * with whatever is not yet in the field guide first, and where to look for it.
 * @param seen whether a species is already in the guide
 */
export function wildlifeLog(species: readonly Species[], seen: (id: string) => boolean, season: Season, watch: Watch, day: string): string {
  // What keeps to one named spot is not for a general log, and nor is a cairn.
  const about = species.filter((s) => s.kin !== 'curio' && !s.near && (!s.seasons || s.seasons.includes(season)) && (!s.watches || s.watches.includes(watch)));
  if (about.length === 0) return `LOG, ${WATCH_NAME[watch]}.\nNothing's moving. Even the ravens went in.`;
  const seed = dayNumber(day + watch);
  // Turn the list by the day, then put the unseen first.
  const turned = about.map((_, i) => about[(i + seed) % about.length] as Species);
  const fresh = turned.filter((s) => !seen(s.id));
  const picks = [...fresh, ...turned.filter((s) => seen(s.id))].slice(0, 3);
  const names = picks.map((s) => s.name.toLowerCase()).join(', ');
  const lead = fresh[0];
  return `LOG, ${WATCH_NAME[watch]}.\nOut and about: ${names}.\n${lead ? `Not yet in your guide: ${lead.name.toLowerCase()}. ${lead.hint}` : 'All old friends of yours.'}`;
}
