import { DIFFICULTY_MARK, type Difficulty } from '../world/trails';
import { dayNumber, trailReason } from './report';

/**
 * The flyer: what is worth doing on the mountain today. It is shown once, the first time the
 * game is opened on a calendar day, and can be looked at again from the map. It names three
 * leads, each somewhere different, and each can have the player's flag planted on it. No DOM
 * or three.js here.
 *
 * A lead is never a chore: nothing is lost by ignoring it, and tomorrow there are three more.
 */
export type LeadKind = 'trail' | 'place' | 'person' | 'rumour' | 'project' | 'patch';

export interface Lead {
  /** Which lead this is, kept in the save for the day: "trail:Sunway", "place:fire-tower". */
  id: string;
  kind: LeadKind;
  /** The small line over it: what kind of lead it is. */
  head: string;
  /** What or who it is. */
  title: string;
  /** A line on why today. */
  why: string;
  /** Where the flag goes, and what it is called. */
  x: number;
  z: number;
  flag: string;
  /** True for a lead that is not a place: there is nowhere to plant a flag. */
  nowhere?: boolean;
}

/** A trail not yet stamped, flagged at its top. */
export function trailLead(trail: { name: string; difficulty: Difficulty; glade: boolean }, x: number, z: number, day: string, riding: boolean): Lead {
  const why = trailReason(day, riding);
  return {
    id: `trail:${trail.name}`,
    kind: 'trail',
    head: riding ? 'Ride of the day' : 'Trail of the day',
    title: `${DIFFICULTY_MARK[trail.difficulty]} ${trail.name}${trail.glade ? ' (in the trees)' : ''}`,
    why: `${why.charAt(0).toUpperCase()}${why.slice(1)}.`,
    x,
    z,
    flag: `Top of ${trail.name}`,
  };
}

/** Why a trail already in the passport is worth another run. */
const AGAIN_WHYS: readonly string[] = ['For the pleasure of it.', "You know every turn. That's the nice part.", "There's no stamp in it. Just a good run.", "It's different every time. A little."];

/** With every trail stamped there is still a trail of the day: one to go down again. */
export function trailAgainLead(trail: { name: string; difficulty: Difficulty; glade: boolean }, x: number, z: number, day: string, riding: boolean): Lead {
  return { ...trailLead(trail, x, z, day, riding), id: `again:${trail.name}`, why: AGAIN_WHYS[(dayNumber(day) >>> 7) % AGAIN_WHYS.length] as string };
}

/** A patch not yet earned, with how it is earned: for a book so nearly full that nothing else is left to point at. */
export function patchLead(patch: { id: string; name: string; how: string }): Lead {
  return { id: `patch:${patch.id}`, kind: 'patch', head: 'Still to earn', title: patch.name, why: patch.how, x: 0, z: 0, flag: patch.name, nowhere: true };
}

/** Why a place is worth the trip, one a day, turn about. */
const PLACE_WHYS: readonly string[] = ["You don't have the postcard yet.", "You haven't been. It's worth a look.", "There's a postcard in it for you.", 'Bring back a postcard.'];

/** Somewhere worth a postcard that has not been visited. */
export function placeLead(spot: { id: string; name: string; x: number; z: number }, day: string): Lead {
  return { id: `place:${spot.id}`, kind: 'place', head: 'Worth the trip', title: spot.name, why: PLACE_WHYS[(dayNumber(day) >>> 5) % PLACE_WHYS.length] as string, x: spot.x, z: spot.z, flag: spot.name };
}

/** Someone with something for the player. */
export function personLead(person: { id: string; name: string; role: string }, x: number, z: number): Lead {
  return { id: `person:${person.id}`, kind: 'person', head: "Somebody's looking for you", title: person.name, why: `${person.role}. Go say hi.`, x, z, flag: person.name };
}

/** The inn's rumour of a stone: the flyer only says to ask. Where it lies is the innkeeper's to tell. */
const RUMOUR_WHYS: readonly string[] = ['knows where. Ask her.', 'heard it from somebody. Ask her.', 'has the details. Supposedly.', "will tell you where. She can't help it."];
export function rumourLead(innkeeper: string, x: number, z: number, day = ''): Lead {
  return { id: 'rumour', kind: 'rumour', head: 'Heard at the inn', title: 'A stone, supposedly', why: `${innkeeper} ${RUMOUR_WHYS[day ? (dayNumber(day) >>> 11) % RUMOUR_WHYS.length : 0]}`, x, z, flag: `${innkeeper}, at the inn` };
}

/**
 * What the town is building: a spot to go and stake out; or, the day after, something new to
 * go and see; or, if nobody went to look, a place still worth the trip.
 * @param state `proposed` while it wants its spot, `new` on the day after it was staked out, `standing` from then on
 */
export function projectLead(project: { id: string; name: string; ask: string; done: string }, state: 'proposed' | 'new' | 'standing', x: number, z: number): Lead {
  const head = state === 'proposed' ? 'The town is building' : state === 'new' ? 'Finished overnight' : 'Worth the trip';
  return { id: `project:${project.id}`, kind: 'project', head, title: project.name, why: state === 'proposed' ? `${project.ask} Go stake out the spot.` : project.done, x, z, flag: project.name };
}

/** How many leads a flyer carries. */
export const LEADS = 3;

/**
 * Today's leads, chosen from what is still open: a trail, a place, and either someone with
 * something for the player or the inn's rumour, so that the three lie in different parts of
 * the mountain. The same three all day, whatever is done in the meantime.
 * @param open every lead that could be offered today, in a settled order; of the town's projects, the one to show first comes first
 * @param trailOfDay the id of the trail the Saddle Lodge board has picked, so the two agree
 * @param neighbour someone to send a newcomer to before anyone else: the nearest person with something for them
 */
export function pickLeads(open: readonly Lead[], day: string, trailOfDay: string | null = null, neighbour: string | null = null): string[] {
  const seed = dayNumber(day);
  const of = (kind: LeadKind): Lead[] => open.filter((l) => l.kind === kind);
  const one = (list: readonly Lead[], shift: number): Lead | undefined => (list.length === 0 ? undefined : list[(seed >>> shift) % list.length]);
  const trails = of('trail');
  const picked: Lead[] = [];
  const add = (lead: Lead | undefined): void => {
    if (lead && picked.length < LEADS && !picked.includes(lead)) picked.push(lead);
  };
  add(trails.find((l) => l.id === trailOfDay) ?? one(trails, 0));
  // What the town is building is a place to go, and comes before any other: what was finished
  // overnight first, then what wants staking out.
  add(of('project')[0] ?? one(of('place'), 5));
  // The rumour and the neighbours take turns, day about, when both are to be had. Someone new
  // is sent next door first.
  const people = of('person');
  const rumour = of('rumour');
  const nextDoor = people.find((l) => l.id === neighbour);
  const askFirst = seed % 2 === 0 ? rumour : people;
  add(nextDoor ?? one(askFirst, 9) ?? one(askFirst === rumour ? people : rumour, 9));
  // Short of three, whatever else is open makes up the number.
  for (const lead of [...of('project'), ...of('place'), ...trails, ...people, ...rumour, ...of('patch')]) add(lead);
  return picked.map((l) => l.id);
}

/** The day before a day, as a day: "2026-11-12" to "2026-11-11". */
export function dayBefore(day: string): string {
  const [y, m, d] = day.split('-').map(Number) as [number, number, number];
  return new Date(Date.UTC(y, m - 1, d - 1, 12)).toISOString().slice(0, 10);
}

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** The date at the top of the flyer: "Wednesday · Nov 11". */
export function flyerDate(day: string): string {
  const [y, m, d] = day.split('-').map(Number) as [number, number, number];
  // Noon, so that no time zone can tip it into the day before.
  const weekday = new Date(Date.UTC(y, m - 1, d, 12)).getUTCDay();
  return `${WEEKDAYS[weekday]} · ${MONTHS[m - 1]} ${d}`;
}

/** What the day has that might be worth a line in pencil at the foot of the flyer. */
export interface Aside {
  /** The letter from everybody is waiting at the post office. */
  lastLetter: boolean;
  /** The meteor shower that is on tonight, by name, if there is one in the season the player is really in. */
  shower: string | null;
  /** The band plays on the bandstand tonight. */
  concert: boolean;
  /** Somebody is at the cabin's feeder. */
  guest: boolean;
  /** How many things the player has that the museum's keeper has not seen, once he has been met. */
  waiting: number;
  /** What the town is building, to be up by tomorrow, by name. */
  building: string | null;
  /** The town has nothing in hand and is thinking about what to build next. */
  resting: boolean;
  /** A letter is waiting at the post office. */
  letter: boolean;
  /** Pip is hiding. */
  pip: boolean;
}

/** How many things must be waiting for the museum before the flyer says so. */
export const WAITING_FOR_ASIDE = 5;

/**
 * The flyer's P.S.: one line, of the first of these that is so. The letter that ends the game
 * before anything; then what is only tonight; then what is waiting at home and in town; then
 * what tomorrow brings; and last the things that will keep. Null on a day with none of them.
 */
export function postscript(a: Aside): string | null {
  if (a.lastLetter) return "P.S. There's a letter at the post office. It's from everybody.";
  if (a.shower) return `P.S. Shooting stars tonight, if it's clear. It's ${a.shower}.`;
  if (a.concert) return "P.S. The band's on the bandstand tonight, once it's dark.";
  if (a.guest) return "P.S. Somebody's at your feeder.";
  if (a.waiting >= WAITING_FOR_ASIDE) return `P.S. You've got ${a.waiting} things Silas hasn't seen. He'd love to.`;
  if (a.building) return `P.S. ${a.building} will be up by tomorrow.`;
  if (a.resting) return "P.S. The town's thinking about what to build next.";
  if (a.letter) return "P.S. There's a letter for you at the post office.";
  if (a.pip) return "P.S. Pip's hiding somewhere. Somebody in town saw which way she went.";
  return null;
}

