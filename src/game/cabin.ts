import type { Season } from '../look/season';
import { dayNumber } from './report';
import type { Watch } from './wildlife';

/**
 * The cabin: somewhere of the player's own that shows what they have found. Stones go on the
 * shelf by the door, patches on the board beside it, and the feeder in the yard, once filled,
 * has somebody at it the next day. These are the rules; `world/cabin.ts` says where it stands
 * and `world/cabinMesh.ts` builds it. No DOM or three.js here.
 *
 * Nothing here is a chore. A shelf left bare is only bare; a feeder left empty only stays empty.
 */

/** How many stones the shelf holds, and how many patches the board. */
export const SHELF_SLOTS = 5;
export const WALL_SLOTS = 3;

/** The cabin, as it is kept in the save. */
export interface CabinSave {
  /** The mineral in each place on the shelf, by id; '' for a bare place. */
  shelf: string[];
  /** The patch in each place on the board, by id; '' for a bare place. */
  wall: string[];
  /** The day the feeder was last filled, or '' if it is empty. */
  feeder: string;
}

export function emptyCabin(): CabinSave {
  return { shelf: Array<string>(SHELF_SLOTS).fill(''), wall: Array<string>(WALL_SLOTS).fill(''), feeder: '' };
}

/**
 * What goes in a place next, when it is tapped: the next of what the player has that is not
 * already set out somewhere else, and after the last of those, nothing.
 * @param have everything that could go there, in a settled order
 * @param placed what is in every place now, this one included
 * @param slot the place being tapped
 */
export function nextChoice(have: readonly string[], placed: readonly string[], slot: number): string {
  const now = placed[slot] ?? '';
  const elsewhere = new Set(placed.filter((id, i) => i !== slot && id !== ''));
  const free = have.filter((id) => !elsewhere.has(id));
  const at = free.indexOf(now);
  // From bare to the first; from the last to bare.
  return at + 1 < free.length ? (free[at + 1] as string) : '';
}

/** Who comes to a filled feeder, by season. All are in the field guide. */
export const FEEDER_GUESTS: Record<Season, readonly string[]> = {
  winter: ['chickadee', 'grayjay', 'bluejay', 'squirrel'],
  spring: ['chickadee', 'bluejay', 'chipmunk'],
  summer: ['hummingbird', 'chickadee', 'chipmunk', 'bluejay'],
  fall: ['bluejay', 'chickadee', 'squirrel', 'chipmunk'],
};

/**
 * Who is at the feeder: somebody, if it was filled on an earlier day and it is not night.
 * Whoever it is stays the same all day.
 */
export function feederGuest(cabin: CabinSave, day: string, season: Season, watch: Watch): string | null {
  if (cabin.feeder === '' || cabin.feeder >= day || watch === 'night') return null;
  const guests = FEEDER_GUESTS[season];
  return guests[dayNumber(day) % guests.length] ?? null;
}
