import type { SaveData } from './save';

/**
 * The post. One letter a day waits at the North Creek Post Office, from somebody the player has
 * met or something they have done. No DOM or three.js here.
 *
 * Letters are small rewards for coming back tomorrow. They ask for nothing.
 */
export interface Letter {
  id: string;
  /** Who it is from: a person's id for their portrait, and the name it is signed with. */
  from: string | null;
  signed: string;
  /** What has to be true of the book before it is sent. Always sent if not given. */
  when?: (save: SaveData) => boolean;
  text: string;
}

const met = (id: string) => (save: SaveData) => id in save.met;
const done = (id: string) => (save: SaveData) => Boolean(save.errands[id]?.done);
const seen = (id: string) => (save: SaveData) => id in save.sightings;

export const LETTERS: readonly Letter[] = [
  {
    id: 'test',
    from: 'dot',
    signed: 'Dot, Postmaster',
    text: 'This is a test of the North Creek postal system. If you are reading this, it works. If you are not reading this, please let me know.',
  },
  {
    id: 'hazel-rules',
    from: 'hazel',
    signed: 'Hazel',
    when: met('hazel'),
    text: 'Welcome to the mountain. Rule one: there are no rules. Rule two: do not ski into the snow gun. That one is less a rule than an observation.',
  },
  {
    id: 'pip-fox',
    from: 'pip',
    signed: 'PIP',
    when: met('pip'),
    text: 'DEAR SKIER. I am writing a letter because my mom said I have to practise. I saw a fox. It did not see me. I was quiet for almost four whole seconds.',
  },
  {
    id: 'otto-score',
    from: 'otto',
    signed: 'O.',
    when: met('otto'),
    text: 'Eight out of ten today. You are improving. Do not let it go to your head. The extra point was for the hat.',
  },
  {
    id: 'town-snowman',
    from: null,
    signed: 'Town of Johnsburg, Office of the Clerk',
    text: 'Dear Resident or Visitor: the snowman on the corner of Main and Bridge has been issued a parking ticket. If it is yours, please move it by spring.',
  },
  {
    id: 'gus-chili',
    from: 'gus',
    signed: 'Gus',
    when: met('gus'),
    text: 'You asked for the chili recipe. Step one: start yesterday. Step two: more than you think. Step three: I am not telling you step three.',
  },
  {
    id: 'mica-club',
    from: 'mica',
    signed: 'Dr. Mica (Founder, President, Only Member)',
    when: met('mica'),
    text: 'You are hereby invited to join the Gore Mountain Garnet Appreciation Society. We meet whenever two of us are in the same room. So far we have not met.',
  },
  {
    id: 'bea-timetable',
    from: 'bea',
    signed: 'B. — Conductor',
    when: met('bea'),
    text: 'SNOW TRAIN TIMETABLE. Departs: when you are ready. Arrives: when it is that season. Delays: none since 1934, when a cow was involved.',
  },
  {
    id: 'friend-snowman',
    from: null,
    signed: 'A Friend',
    when: seen('snowman'),
    text: 'You did not see me build it. Nobody did. Enclosed: one carrot, slightly used.',
  },
  {
    id: 'june-names',
    from: 'june',
    signed: 'June',
    when: met('june'),
    text: 'New on the counter this week: the Double Diamond (two kinds of chocolate), the Bunny Hill (it is a carrot muffin), and the Yard Sale (everything, everywhere).',
  },
  {
    id: 'wren-dawn',
    from: 'wren',
    signed: 'Wren, Tower 1',
    when: met('wren'),
    text: 'Sunrise report: it happened again. Gold on the east face by ten past, a raven on the rail by quarter past, coffee gone by half past. Come up early some time.',
  },
  {
    id: 'walt-review',
    from: 'walt',
    signed: 'Walt',
    when: done('tower-special'),
    text: 'Wren sent the sandwich wrapper back down with a note on it. The note says "more pickle." Forty years I have been making that sandwich. More pickle.',
  },
  {
    id: 'otto-coffee',
    from: 'otto',
    signed: 'O.',
    when: done('ottos-coffee'),
    text: 'About that coffee. I have thought it over and it was a ten. I said ten at the time, but I want it in writing. Ten.',
  },
  {
    id: 'amos-light',
    from: 'amos',
    signed: 'Amos',
    when: met('amos'),
    text: 'Hold a garnet up to a low sun some evening. Not for any reason. Thirty years underground and that is the thing I would tell anybody.',
  },
  {
    id: 'biscuit',
    from: 'biscuit',
    signed: '(a paw print, and some drool)',
    when: met('biscuit'),
    text: 'The envelope has been chewed open and licked shut again. Inside there is a paw print in gravy. It is the nicest letter you have had all year.',
  },
  {
    id: 'pip-kite',
    from: 'pip',
    signed: 'PIP (age nine AND A HALF now)',
    when: done('lost-kite'),
    text: 'I measured the bite in my kite. It is BIGGER THAN A BEAR BITE. I looked it up. Nothing has a mouth that big. Nothing we KNOW about.',
  },
  {
    id: 'rumor',
    from: null,
    signed: '(no signature, one very large muddy thumbprint)',
    when: seen('rumor'),
    text: 'u saw nothing. also sorry about the kite. it looked like food. it was not food.',
  },
  {
    id: 'marge-beds',
    from: 'marge',
    signed: 'Marge, Copperfield Inn',
    when: met('marge'),
    text: 'A guest left a pair of skis here in 1987 and said he would be right back. If you see him on the mountain, tell him checkout was at eleven.',
  },
];

export const letterById = (id: string): Letter | undefined => LETTERS.find((l) => l.id === id);

/**
 * The letter waiting today, if any: the first one not yet collected whose time has come. There is
 * at most one a day, so the post is worth a visit tomorrow as well.
 * @param collected letters already had, by id, with the day each was collected
 */
export function letterWaiting(save: SaveData, collected: Record<string, string>, day: string): Letter | null {
  if (Object.values(collected).includes(day)) return null;
  return LETTERS.find((l) => !(l.id in collected) && (!l.when || l.when(save))) ?? null;
}
