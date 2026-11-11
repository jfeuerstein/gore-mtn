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
  {
    id: 'tom-dictated',
    from: 'tom',
    signed: 'Tom (dictated; no hands)',
    when: met('tom'),
    text: 'I am writing to say that I enjoyed our talk. I do not get many. Please excuse the handwriting, which belongs to a child called Pip, who charges one mitten per page.',
  },
  {
    id: 'tom-hat',
    from: 'tom',
    signed: 'Tom',
    when: done('toms-hat'),
    text: 'The hat is back where it belongs and I am myself again. A crow sat on it this morning. I have decided this is a compliment, and I will hear nothing against it.',
  },
  {
    id: 'flurry-forecast',
    from: 'flurry',
    signed: 'Mme Flurry',
    when: met('flurry'),
    text: 'FORECAST for the day you read this: there will be weather. Some of it will be outside. Dress for it. This forecast was sealed in advance and has never once been wrong.',
  },
  {
    id: 'ivy-report',
    from: 'ivy',
    signed: 'Ivy, Patrol',
    when: done('thermos'),
    text: 'Incident report. Item: one thermos. Status: recovered. Injuries: none. Contents: soup. Note for the file: the finder did not drink the soup. Recommend for commendation.',
  },
  {
    id: 'mayor-proclamation',
    from: 'pickles',
    signed: 'His Honour the Mayor (paw print)',
    when: met('pickles'),
    text: 'PROCLAMATION. Be it known that the bearer of this letter has been seen by the Mayor, and that the Mayor did not immediately leave. Given under my paw at the Town Hall, between naps.',
  },
  {
    id: 'mayor-census',
    from: 'pickles',
    signed: 'Office of the Mayor',
    when: done('census'),
    text: 'The census is complete. Residents: fifteen kinds and counting. Mice: the Mayor declines to give a figure, but describes the number as "fewer".',
  },
  {
    id: 'bram-gerald',
    from: 'bram',
    signed: 'Bram',
    when: done('gerald'),
    text: 'Went up last night to have another go at Gerald. Three passes with the blade. This morning he was back, and a little bigger. I think he likes the attention.',
  },
  {
    id: 'fenn-overdue',
    from: 'fenn',
    signed: 'Fenn, Librarian',
    when: (save) => Object.keys(save.tried).some((id) => id.startsWith('book-')),
    text: 'A reminder that the book you borrowed is not due back. Nothing here is. I only wanted to send a library notice that would not spoil anybody\'s day. Please do not reply.',
  },
  {
    id: 'june-walt',
    from: 'june',
    signed: 'June',
    when: (save) => Object.keys(save.tried).length >= 4,
    text: 'Walt says his sandwiches bring more people to Main Street than my scones. Walt is welcome to his opinion and to day-old scones, which is what he is getting.',
  },
  {
    id: 'sven-pizza',
    from: 'sven',
    signed: 'Sven',
    when: met('sven'),
    text: 'A student asked me today what comes after pizza and french fries. I said: lunch. He is my best student. I may let him teach.',
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
