import { SEASONS, type Season } from '../look/season';
import { isOut, MINERALS } from './minerals';
import { dayNumber } from './report';
import type { SaveData } from './save';
import { PAINTER_HAUNTS, paintingId } from './wanderers';
import { SPECIES } from './wildlife';

/**
 * The museum: a room of empty cases in town, and a keeper who would like them filled. What
 * the player has found on the mountain can be shown to him, and then it is in a case: a
 * stone of each kind, a card for everything in the field guide, the painter's pictures on the
 * wall. Nothing is taken from the Book by it. The fourth hall is for old things, which are
 * not found by chance: the keeper says where one was lost, and it is gone and got (his
 * errands, in `people.ts`). No DOM or three.js here.
 */
export type Hall = 'stones' | 'nature' | 'old' | 'gallery';

export const HALLS: readonly { id: Hall; name: string; bare: string }[] = [
  { id: 'stones', name: 'The Stone Hall', bare: 'A stone of every kind the mountain has.' },
  { id: 'nature', name: 'Natural History', bare: 'A card for everything in your field guide.' },
  { id: 'old', name: 'Old Things', bare: 'Silas knows where each one was lost. Ask him.' },
  { id: 'gallery', name: 'The Gallery', bare: "Nell's paintings, if she'll part with them." },
];

/** Something old that belongs in the museum. Each is one of the keeper's errands, by the same id. */
export interface Relic {
  id: string;
  name: string;
  /** What its label says, once it is in its case. */
  label: string;
}

export const RELICS: readonly Relic[] = [
  { id: 'relic-lamp', name: "A miner's lamp", label: 'Left at the lower pit when the garnet men quit it.' },
  { id: 'relic-pail', name: "Tucker's lunch pail", label: 'Lost at the mine in 1931. Talked about until 1970.' },
  { id: 'relic-ski', name: 'One wooden ski', label: 'Came up on a snow train in 1934. Went home without its owner, or the other way round.' },
  { id: 'relic-ticket', name: 'A snow train ticket', label: 'Schenectady to North Creek and back. Punched.' },
  { id: 'relic-pike', name: 'A pike pole', label: 'The iron end. For steering logs down to the mills, from on top of the logs.' },
  { id: 'relic-badge', name: 'A gondola badge', label: 'Off one of the red cabins of 1967.' },
  { id: 'relic-tin', name: "The observer's tin", label: 'Field glasses, thirty years on the fire tower. They still work.' },
  { id: 'relic-cowbell', name: 'The race cowbell', label: 'Rung at every race on Showcase until it went missing in the middle of one.' },
];

/** One thing a case, a drawer or a wall of the museum is waiting for. */
export interface Piece {
  /** What it is filed under in the save: a kind and an id. */
  key: string;
  hall: Hall;
  name: string;
  /** Its picture: the set and the name under public/art. */
  art: string;
}

const title = (text: string): string => text.charAt(0).toUpperCase() + text.slice(1);

/** Everything the museum has a place for, hall by hall. */
export const PIECES: readonly Piece[] = [
  ...MINERALS.map((m): Piece => ({ key: `mineral:${m.id}`, hall: 'stones', name: m.name, art: `minerals/${m.id}` })),
  ...SPECIES.map((s): Piece => ({ key: `species:${s.id}`, hall: 'nature', name: s.name, art: `species/${s.id}` })),
  ...RELICS.map((r): Piece => ({ key: `relic:${r.id}`, hall: 'old', name: r.name, art: `relics/${r.id.replace(/^relic-/, '')}` })),
  ...PAINTER_HAUNTS.flatMap((h) => SEASONS.map((season): Piece => ({ key: `painting:${paintingId(h.id, season)}`, hall: 'gallery', name: `${title(h.name)}, ${season}`, art: `paintings/${paintingId(h.id, season)}` }))),
];

const idOf = (piece: Piece): string => piece.key.slice(piece.key.indexOf(':') + 1);

/** True if the player has the thing itself: it is in their Book, or (an old thing) they have brought it back. */
export function had(save: SaveData, piece: Piece): boolean {
  const id = idOf(piece);
  if (piece.hall === 'stones') return (save.minerals[id]?.count ?? 0) > 0;
  if (piece.hall === 'nature') return id in save.sightings;
  if (piece.hall === 'gallery') return id in save.paintings;
  return save.errands[id]?.done !== undefined;
}

/** True if it is in the museum. An old thing is in its case the moment it is brought back. */
export function given(save: SaveData, piece: Piece): boolean {
  return piece.hall === 'old' ? had(save, piece) : piece.key in save.museum;
}

/** What the player has that the keeper has not seen yet. */
export function toGive(save: SaveData): Piece[] {
  return PIECES.filter((piece) => piece.hall !== 'old' && had(save, piece) && !given(save, piece));
}

/** Show the keeper everything new. What went into the cases. */
export function give(save: SaveData, day: string): Piece[] {
  const pieces = toGive(save);
  for (const piece of pieces) save.museum[piece.key] = day;
  return pieces;
}

/** How full the museum is, in all and hall by hall. */
export function fullness(save: SaveData): { given: number; total: number; halls: Record<Hall, { given: number; total: number }> } {
  const halls: Record<Hall, { given: number; total: number }> = { stones: { given: 0, total: 0 }, nature: { given: 0, total: 0 }, old: { given: 0, total: 0 }, gallery: { given: 0, total: 0 } };
  let count = 0;
  for (const piece of PIECES) {
    halls[piece.hall].total++;
    if (given(save, piece)) {
      halls[piece.hall].given++;
      count++;
    }
  }
  return { given: count, total: PIECES.length, halls };
}

/** What the keeper hands over as the cases fill: something to wear, at so many pieces. */
export const MUSEUM_GIFTS: readonly { at: number; gear: string }[] = [
  { at: 5, gear: 'hat-museum' },
  { at: 15, gear: 'pack-specimen' },
  { at: 30, gear: 'goggles-loupe' },
  { at: 50, gear: 'jacket-tweed' },
  { at: 70, gear: 'skis-crystal' },
];

/** The next thing the keeper has to give, and how many pieces it waits on; null when he has given it all. */
export function nextGift(save: SaveData): { at: number; gear: string } | null {
  return MUSEUM_GIFTS.find((gift) => !save.gear.owned.includes(gift.gear)) ?? null;
}

/** A stone or a creature the museum has no example of, to go looking for, with where to look. */
export interface Wanted {
  piece: Piece;
  hint: string;
}

/**
 * What the keeper is asking after today: something the museum lacks that is about in this
 * season, the same thing all day and another tomorrow. A stone on the even days and something
 * for the drawers on the odd, where there is one of each to want. Null when nothing is lacking.
 */
export function wanted(save: SaveData, day: string, season: Season): Wanted | null {
  const n = dayNumber(`${day}-museum`);
  const stones: Wanted[] = MINERALS.filter((m) => !(`mineral:${m.id}` in save.museum) && (!m.when?.seasons || m.when.seasons.includes(season)) && (!m.when?.shower || isOut(m, { day, season, watch: 'day' }))).map((m) => ({
    piece: PIECES.find((p) => p.key === `mineral:${m.id}`) as Piece,
    hint: m.hint,
  }));
  const creatures: Wanted[] = SPECIES.filter((s) => !(`species:${s.id}` in save.museum) && (!s.seasons || s.seasons.includes(season))).map((s) => ({ piece: PIECES.find((p) => p.key === `species:${s.id}`) as Piece, hint: s.hint }));
  const first = n % 2 === 0 ? stones : creatures;
  const list = first.length > 0 ? first : first === stones ? creatures : stones;
  return list.length > 0 ? (list[(n >>> 1) % list.length] as Wanted) : null;
}

/**
 * What the keeper says on the museum's sheet, by how things stand. The wording is the
 * owner's to mark up, and keeps to how people talk: he says `I believe`.
 */
export function keeperSays(save: SaveData, day: string, season: Season): string {
  const full = fullness(save);
  const waiting = toGive(save).length;
  if (waiting > 0) return full.given === 0 ? "Oh! You've brought something. May I see?\nI've had the labels ready a long time." : waiting === 1 ? "You've got something I haven't seen. May I?" : `You've got ${waiting} things I haven't seen. May I?`;
  if (full.given === 0) return "Every case in here is empty.\nI believe that's what they call an opportunity.";
  if (full.given >= full.total) return "Every case is full. Every one!\nI walk around in here just to look.";
  const want = wanted(save, day, season);
  if (!want) return "That's everything I can think to ask for this time of year.\nCome back when the season turns.";
  return `There's an empty place in here marked "${want.piece.name}."\n${want.hint}`;
}
