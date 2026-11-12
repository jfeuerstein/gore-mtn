/**
 * Town projects: things the town builds, one after another, each of which adds a place to the
 * mountain for good. The third step of the daily loop: the flyer proposes one, the player goes
 * and stakes out the spot, and the next day it is built. No DOM or three.js here.
 *
 * The player's part is to go there. Nothing is paid, carried or handed in, nothing is timed,
 * and a project that is never staked out simply waits.
 */
export type ProjectKind = 'leanto' | 'dock' | 'bandstand' | 'hut' | 'deck';

export interface Project {
  /** Also the id of the postcard that being there earns, and of its picture. */
  id: string;
  name: string;
  kind: ProjectKind;
  /** Who is building it, by person id: they are named on the flyer. */
  who: string;
  /** What the flyer says while it wants staking out, and once it is built. */
  ask: string;
  done: string;
  /** What whoever wanted it says to the player, once, when it stands. */
  said: string;
}

/** In the order the town gets round to them. */
export const PROJECTS: readonly Project[] = [
  { id: 'lean-to', name: 'The Hardwood Lean-to', kind: 'leanto', who: 'otto', ask: 'Otto wants a lean-to in the woods by your place.', done: "Otto's lean-to is up. It smells like new wood.", said: "Hey - the lean-to's up! It came out pretty good.\nI took a nap in it already. Just to test it." },
  { id: 'rabbit-dock', name: 'The Rabbit Pond Dock', kind: 'dock', who: 'wren', ask: 'Wren thinks Rabbit Pond should have a dock.', done: "The dock's in at Rabbit Pond. Mind the last plank.", said: "They finished the dock! I can see it from up here.\nIt's really small from up here. I waved at it anyway." },
  { id: 'bandstand', name: 'The Duck Pond Bandstand', kind: 'bandstand', who: 'marge', ask: "Marge says a town isn't a town without a bandstand.", done: "The bandstand's up by the Duck Pond. No band yet.", said: "A bandstand, hon! A real one. Did you see it?\nNow I just need a band. Do you play anything? ...That's okay." },
  { id: 'burnt-ridge-hut', name: 'The Burnt Ridge Hut', kind: 'hut', who: 'gus', ask: 'Gus wants a warming hut at the top of Burnt Ridge.', done: "There's a warming hut on Burnt Ridge now. Gus lit the stove.", said: "The hut's open! I carried the stove up myself.\nWell - the snowcat carried it. I rode along." },
  { id: 'reservoir-deck', name: 'The Reservoir Lookout', kind: 'deck', who: 'amos', ask: 'Amos wants a lookout over the reservoir.', done: 'The lookout over the reservoir is built. Amos approves.', said: "They built the lookout. I went and stood on it.\nYou can see the water from there. It's a good place to stand." },
];

/** Where a project stands on a day: not yet proposed, wanting its spot staked out, being built, or built. */
export type ProjectState = 'later' | 'proposed' | 'building' | 'built';

/**
 * @param begun the day each project was staked out, by id
 */
export function projectState(id: string, begun: Readonly<Record<string, string>>, day: string): ProjectState {
  const at = PROJECTS.findIndex((p) => p.id === id);
  if (at < 0) return 'later';
  const mine = begun[id];
  // Staked out one day, built by the next.
  if (mine !== undefined) return mine < day ? 'built' : 'building';
  // The town takes them one at a time: the next is proposed once the one before is built.
  const before = PROJECTS[at - 1];
  return before === undefined || projectState(before.id, begun, day) === 'built' ? 'proposed' : 'later';
}

/** The project the town has in hand today, if any: the one wanting its spot, or the one being built. */
export function projectInHand(begun: Readonly<Record<string, string>>, day: string): { project: Project; state: 'proposed' | 'building' } | null {
  for (const project of PROJECTS) {
    const state = projectState(project.id, begun, day);
    if (state === 'proposed' || state === 'building') return { project, state };
  }
  return null;
}
