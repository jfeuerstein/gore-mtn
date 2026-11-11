import type { Difficulty } from '../world/trails';
import type { BookSummary } from './game';
import type { SaveData } from './save';

/**
 * Patches: the big embroidered ones, for finishing a whole kind of thing. They mark the long
 * goals a book takes weeks to reach, where stamps mark the small ones. No DOM or three.js here.
 */
export interface Patch {
  id: string;
  name: string;
  /** What it is for, shown before and after it is earned. */
  how: string;
}

/** What a patch is judged on. */
export interface Tally {
  summary: BookSummary;
  save: SaveData;
  /** Trails stamped and trails in all, by kind: each difficulty, and the glades. */
  trails: Record<Difficulty | 'glade', { done: number; total: number }>;
  /** The size of the largest stone found, in centimetres. */
  biggest: number;
}

const all = (t: { done: number; total: number }): boolean => t.total > 0 && t.done >= t.total;

export const PATCHES: readonly (Patch & { earned(t: Tally): boolean })[] = [
  { id: 'first-tracks', name: 'First Tracks', how: 'Stamp your first trail.', earned: (t) => t.summary.trails >= 1 },
  { id: 'green-circle', name: 'Green Circle', how: 'Stamp every easier trail.', earned: (t) => all(t.trails.easy) },
  { id: 'blue-square', name: 'Blue Square', how: 'Stamp every more difficult trail.', earned: (t) => all(t.trails.intermediate) },
  { id: 'black-diamond', name: 'Black Diamond', how: 'Stamp every most difficult trail.', earned: (t) => all(t.trails.advanced) },
  { id: 'double-diamond', name: 'Double Diamond', how: 'Stamp every experts-only trail.', earned: (t) => all(t.trails.expert) },
  { id: 'in-the-trees', name: 'In the Trees', how: 'Stamp every glade.', earned: (t) => all(t.trails.glade) },
  { id: 'half-the-mountain', name: 'Half the Mountain', how: 'Stamp half of all the trails.', earned: (t) => t.summary.trails * 2 >= t.summary.trailsTotal },
  { id: 'every-trail', name: 'Every Trail on the Map', how: 'Stamp every trail on the mountain.', earned: (t) => t.summary.trails >= t.summary.trailsTotal },
  { id: 'pathfinder', name: 'Pathfinder', how: 'Follow every path through the woods.', earned: (t) => t.summary.pathsTotal > 0 && t.summary.paths >= t.summary.pathsTotal },
  { id: 'chairman', name: 'Chairman of the Board', how: 'Ride every lift.', earned: (t) => t.summary.lifts >= t.summary.liftsTotal },
  { id: 'four-peaks', name: 'Four Peaks', how: 'Stand on all four summits.', earned: (t) => t.summary.peaks >= t.summary.peaksTotal },
  { id: 'sixteen-summits', name: 'Sixteen Summits', how: 'Stand on every summit in every season.', earned: (t) => t.summary.seasonPeaks >= t.summary.seasonPeaksTotal },
  { id: 'sightseer', name: 'Sightseer', how: 'Visit every landmark.', earned: (t) => t.summary.landmarks >= t.summary.landmarksTotal },
  { id: 'four-seasons', name: 'Four Seasons', how: 'See the mountain in winter, spring, summer and fall.', earned: (t) => t.summary.seasons >= 4 },
  { id: 'weatherproof', name: 'Weatherproof', how: 'Earn every conditions stamp.', earned: (t) => t.summary.conditions >= t.summary.conditionsTotal },
  { id: 'rockhound', name: 'Rockhound', how: 'Find every mineral.', earned: (t) => t.summary.minerals >= t.summary.mineralsTotal },
  { id: 'garnet-fever', name: 'Garnet Fever', how: 'Find fifty garnets.', earned: (t) => (t.save.minerals.garnet?.count ?? 0) >= 50 },
  { id: 'whopper', name: 'The Whopper', how: 'Find a stone over twenty centimetres.', earned: (t) => t.biggest >= 20 },
  { id: 'naturalist', name: 'Naturalist', how: 'Enter twenty things in the field guide.', earned: (t) => t.summary.species >= 20 },
  { id: 'full-guide', name: 'The Whole Guide', how: 'Fill the field guide.', earned: (t) => t.summary.species >= t.summary.speciesTotal },
  { id: 'believer', name: 'Believer', how: 'See for yourself whether it is all Lies.', earned: (t) => 'rumor' in t.save.sightings },
  { id: 'good-neighbour', name: 'Good Neighbour', how: 'Finish every errand.', earned: (t) => t.summary.errands >= t.summary.errandsTotal },
  { id: 'pen-pal', name: 'Pen Pal', how: 'Collect ten letters from the post office.', earned: (t) => t.summary.letters >= 10 },
  { id: 'regular', name: 'A Regular', how: 'Try twelve things from the bakery and the deli.', earned: (t) => t.summary.tasted >= 12 },
  { id: 'bookworm', name: 'Library Card', how: 'Read every book Fenn has to lend.', earned: (t) => t.summary.read >= t.summary.readTotal },
  { id: 'good-dog', name: 'Friend of Biscuit', how: 'Pet the dog on seven different days.', earned: (t) => t.save.pets.length >= 7 },
];

/** The patches a tally has earned, by id. */
export function patchesEarned(tally: Tally): string[] {
  return PATCHES.filter((p) => p.earned(tally)).map((p) => p.id);
}
