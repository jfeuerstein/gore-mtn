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
  spring: 'corn, mashed potato, and some honest mud',
  summer: 'grass, mostly. Dirt on the bike trails',
  fall: 'leaves, to a depth of several leaves',
};

const BASE: Record<Season, string> = {
  winter: 'deep enough',
  spring: 'going, but not gone',
  summer: 'none. It is summer. Please stop asking',
  fall: 'any day now',
};

/** Closing remarks, one a day, turn about. */
const NOTES: readonly string[] = [
  'Patrol says: know the code. The trees have right of way.',
  'Groomed overnight: all of it. Bram would like that noted.',
  'Wildlife on the hill: yes. Please do not feed the Mayor.',
  'Lost and found: one left mitten. As of this morning, fourteen left mittens.',
  'Lift lines: none. There is nobody here but you. Enjoy it.',
  'Chili at the Saddle: on. It is always on.',
  'Today\'s forecast courtesy of Madame Flurry, who will confirm it tomorrow.',
  'Tom at the Ski Bowl reports no change. Tom always reports no change.',
  'Reminder: Gerald, on Twister, is a bump and not a feature. He disagrees.',
  'The Snow Train leaves when ready. It is ready.',
];

/** What the sky is doing, in a report's words. */
function sky(c: Conditions): string {
  const snow = c.season === 'winter' || c.season === 'spring';
  if (c.falling > 0.6) return snow ? 'SNOWING, and meaning it' : 'RAIN, steady';
  if (c.falling > 0.05) return snow ? 'flurries' : 'a shower passing';
  if (c.watch === 'night') return c.overcast > 0.5 ? 'dark, and cloudy with it' : 'clear, with stars';
  if (c.overcast > 0.7) return 'overcast';
  if (c.overcast > 0.3) return 'some cloud';
  return c.watch === 'dawn' ? 'clear, and pink at the edges' : c.watch === 'dusk' ? 'clear, and going gold' : 'bluebird';
}

/** New snow in the last while, as optimistically as honesty allows. */
function fresh(c: Conditions): string {
  if (c.season === 'summer') return 'no';
  if (c.season === 'fall') return c.falling > 0.05 ? 'no, that is rain' : 'not yet';
  if (c.falling > 0.6) return 'yes, as you can see';
  if (c.falling > 0.05) return 'a dusting, and counting';
  return c.season === 'winter' ? 'not since the last time' : 'no, and do not get your hopes up';
}

/** The report, as lines to be chalked one under another. */
export function snowReport(c: Conditions, lifts: number, trails: number): string {
  let seed = 0;
  for (let i = 0; i < c.day.length; i++) seed = (seed * 31 + c.day.charCodeAt(i)) >>> 0;
  return [
    `SNOW REPORT. Sky: ${sky(c)}.`,
    `New snow: ${fresh(c)}. Base: ${BASE[c.season]}. Surface: ${SURFACE[c.season]}.`,
    `Lifts turning: ${lifts} of ${lifts}. Trails open: ${trails} of ${trails}. Closed: none, ever.`,
    NOTES[seed % NOTES.length] as string,
  ].join(' ');
}

/** A small repeatable number from a day. */
function dayNumber(day: string): number {
  let seed = 0;
  for (let i = 0; i < day.length; i++) seed = (seed * 31 + day.charCodeAt(i)) >>> 0;
  return seed;
}

/** Why today's trail is today's trail. */
const REASONS: readonly string[] = [
  'you have not skied it. That is the whole reason',
  'Bram combed it specially',
  'Otto gives it an eight',
  'somebody has to',
  'the view, about halfway down',
  'it has been asking after you',
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
  if (todo.length === 0) return `${title}: whichever you like. You have done every one of them. We checked the book. Twice.`;
  const seed = dayNumber(day);
  const pick = todo[seed % todo.length] as (typeof todo)[number];
  return `${title}: ${DIFFICULTY_MARK[pick.difficulty]} ${pick.name.toUpperCase()}${pick.glade ? ' (in the trees)' : ''}. Why: ${REASONS[(seed >>> 3) % REASONS.length]}. ${todo.length} still to stamp.`;
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
  if (about.length === 0) return `LOG, ${WATCH_NAME[watch]}. Nothing stirring. Even the ravens have gone in.`;
  const seed = dayNumber(day + watch);
  // Turn the list by the day, then put the unseen first.
  const turned = about.map((_, i) => about[(i + seed) % about.length] as Species);
  const fresh = turned.filter((s) => !seen(s.id));
  const picks = [...fresh, ...turned.filter((s) => seen(s.id))].slice(0, 3);
  const names = picks.map((s) => s.name.toLowerCase()).join(', ');
  const lead = fresh[0];
  return `LOG, ${WATCH_NAME[watch]}. About on the mountain: ${names}.${lead ? ` Not yet in your guide: ${lead.name.toLowerCase()}. ${lead.hint}` : ' All of them old friends of yours.'}`;
}
