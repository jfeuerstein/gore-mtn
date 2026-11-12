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
/** Once something the town has built has been staked out, and whoever is writing about it has been met. */
const built = (project: string, who: string) => (save: SaveData) => project in save.projects && who in save.met;

/** How many patches there are to earn. Kept here as a number so the post need not read the patch rules; a test holds the two together. */
export const EVERY_PATCH = 28;

/** The letter that closes a full book. */
export const LAST_LETTER = 'the-whole-town';

export const LETTERS: readonly Letter[] = [
  // The last letter, which goes to the head of the queue the day the book is full.
  {
    id: LAST_LETTER,
    from: null,
    signed: "-Everybody (Pip signed for Tom)",
    when: (save) => Object.keys(save.patches).length >= EVERY_PATCH,
    text: "We passed your Book around the inn last night. It's all in there - every trail, every stone, every one of us. Dot checked twice. Here's one more patch, for your wall. Come up anyway! Gus made chili.",
  },
  {
    id: 'test',
    from: 'dot',
    signed: "-Dot (post office)",
    text: "Hi! This is a test of your new mailbox. If you're reading this, it works.\nIf you're not reading this... I guess I'll never know. Anyway - welcome to town! :)",
  },
  {
    id: 'hazel-rules',
    from: 'hazel',
    signed: "-Hazel",
    when: met('hazel'),
    text: "Hi! It was nice to meet you today. There aren't really any rules up here. Okay, maybe one: don't ski into the snow guns. Somebody did that last year. (Me.)",
  },
  {
    id: 'pip-fox',
    from: 'pip',
    signed: "PIP",
    when: met('pip'),
    text: "DEAR SKIER. My mom says I have to practice writing letters so this is one. I saw a fox. It did not see me. I was quiet for almost four whole seconds.",
  },
  {
    id: 'otto-score',
    from: 'otto',
    signed: "-O.",
    when: met('otto'),
    text: "I've been thinking about your skiing. Eight out of ten today. You're getting better! One of the points was for the hat, but still.",
  },
  {
    id: 'town-snowman',
    from: null,
    signed: "Town of Johnsburg, Clerk's Office",
    text: "Dear Resident or Visitor: the snowman at the corner of Main and Bridge has been given a parking ticket. If he's yours, please move him by spring. Thanks!",
  },
  {
    id: 'gus-chili',
    from: 'gus',
    signed: "-Gus",
    when: met('gus'),
    text: "You asked about the chili. Honestly, it's mostly time. Start it the day before, and use more onions than seems right. There's one more thing, but I'm keeping that one. Come eat!",
  },
  {
    id: 'mica-club',
    from: 'mica',
    signed: "Dr. Mica (president, also the only member)",
    when: met('mica'),
    text: "You're invited to join the Gore Mountain Garnet Club! We meet whenever two members are in the same room. So far it's just me, so we haven't met yet. No pressure!! (Please come.)",
  },
  {
    id: 'bea-timetable',
    from: 'bea',
    signed: "-Bea, Conductor",
    when: met('bea'),
    text: "SNOW TRAIN TIMETABLE\nLeaves: when you're ready.\nArrives: when it's that season.\nDelays: none since 1934. (There was a cow.)",
  },
  {
    id: 'friend-snowman',
    from: null,
    signed: "A Friend (not Pip)",
    when: seen('snowman'),
    text: "You didn't see me build it. Nobody did.\nI put a carrot in the envelope for you. It's a little bit used.",
  },
  {
    id: 'june-names',
    from: 'june',
    signed: "-June",
    when: met('june'),
    text: "New this week: the Black Diamond brownie (it's really, really dark), the Mud Season muffin (double chocolate) and the Summit sticky bun (tall). Come by! I'll save you one.",
  },
  {
    id: 'wren-dawn',
    from: 'wren',
    signed: "-Wren",
    when: met('wren'),
    text: "The sunrise was really good today. Gold on the east face a little after seven, and then a raven on the rail. I thought you'd want to know. Come up early sometime, if you like.",
  },
  {
    id: 'walt-review',
    from: 'walt',
    signed: "-Walt",
    when: done('tower-special'),
    text: "Wren sent the wrapper back down with a note on it. The note says \"more pickle.\" Forty years I've been making that sandwich!\n...She's probably right.",
  },
  {
    id: 'otto-coffee',
    from: 'otto',
    signed: "-O.",
    when: done('ottos-coffee'),
    text: "About that coffee. I said it was a ten at the time, but I wanted to put it in writing. It was a ten. Thank you.",
  },
  {
    id: 'amos-light',
    from: 'amos',
    signed: "-Amos",
    when: met('amos'),
    text: "Some evening, hold a garnet up to the sun when it's low. No reason. Thirty years down that hole, and that's the one thing I'd tell anybody.",
  },
  {
    id: 'biscuit',
    from: 'biscuit',
    signed: "(a paw print, and some drool)",
    when: met('biscuit'),
    text: "The envelope's been chewed open and licked shut again. Inside there's a paw print, in gravy. It might be the nicest letter you've gotten all year.",
  },
  {
    id: 'pip-kite',
    from: 'pip',
    signed: "PIP (nine AND A HALF now)",
    when: done('lost-kite'),
    text: "I measured the bite in my kite. It is BIGGER THAN A BEAR BITE. I looked it up. Nothing has a mouth that big. Nothing we KNOW about.",
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
    signed: "-Marge, Copperfield Inn",
    when: met('marge'),
    text: "A guest left his skis here in 1987 and said he'd be right back. If you see him up on the mountain, could you tell him checkout was at eleven? Thanks, hon.",
  },
  {
    id: 'tom-dictated',
    from: 'tom',
    signed: "Tom (I said it. Pip wrote it.)",
    when: met('tom'),
    text: "DEAR PERSON. It was nice talking to you. I don't get to talk to a lot of people. Sorry about the handwriting, it is Pip's. She charges one mitten a page.",
  },
  {
    id: 'tom-hat',
    from: 'tom',
    signed: "Tom",
    when: done('toms-hat'),
    text: "I have my hat back and I feel like myself again. A crow sat on it this morning. I think that means it is a good hat.",
  },
  {
    id: 'flurry-forecast',
    from: 'flurry',
    signed: "-Mme. Flurry",
    when: met('flurry'),
    text: "FORECAST for the day you open this: there will be weather. Some of it will be outside. I sealed this ahead of time, so it counts. I've never been wrong with one of these!",
  },
  {
    id: 'ivy-report',
    from: 'ivy',
    signed: "-Ivy, Patrol",
    when: done('thermos'),
    text: "INCIDENT REPORT\nItem: one thermos. Status: found. Injuries: none. Contents: soup.\nNote: the finder didn't drink the soup. I checked. Thanks for that.",
  },
  {
    id: 'mayor-proclamation',
    from: 'pickles',
    signed: "Mayor Pickles (paw print)",
    when: met('pickles'),
    text: "PROCLAMATION: The person holding this letter has met the Mayor, and the Mayor didn't leave right away. That's rare.\n(He can't write. I do these for him. -Dot)",
  },
  {
    id: 'mayor-census',
    from: 'pickles',
    signed: "Office of the Mayor",
    when: done('census'),
    text: "The census is done! Fifteen kinds of residents, and counting. The Mayor wouldn't give a number for mice. He just looked pleased.\n(-Dot, for the Mayor)",
  },
  {
    id: 'bram-gerald',
    from: 'bram',
    signed: "-Bram",
    when: done('gerald'),
    text: "Went up last night to take another shot at Gerald. Three passes with the blade. This morning he was back, and I think a little bigger. I think he likes the attention.",
  },
  {
    id: 'fenn-overdue',
    from: 'fenn',
    signed: "-Mr. Fennimore",
    when: (save) => Object.keys(save.tried).some((id) => id.startsWith('book-')),
    text: "This is a reminder that the book you borrowed isn't due. Nothing here is, really. I've just always wanted to send a library notice that wouldn't ruin anybody's day. No need to reply.",
  },
  {
    id: 'june-walt',
    from: 'june',
    signed: "-June",
    when: (save) => Object.keys(save.tried).length >= 4,
    text: "Walt says his sandwiches bring more people to Main Street than my scones do. He's allowed to think that. He's also getting day-old scones this week. :)",
  },
  {
    id: 'home-feeder',
    from: 'wren',
    signed: "-Wren",
    when: (save) => save.cabin.feeder !== '' && 'wren' in save.met,
    text: "I heard you put a feeder up at your place. Good. Fill it at night and look in the morning - that's when they come. Don't stand too close. They know your jacket by now.",
  },
  {
    id: 'built-lean-to',
    from: 'otto',
    signed: "-O.",
    when: built('lean-to', 'otto'),
    text: "Thanks for staking out the lean-to. You picked a pretty good spot. It's close enough to your place that I might borrow your woodpile. I'll ask first. Probably.",
  },
  {
    id: 'built-dock',
    from: 'pip',
    signed: "PIP",
    when: built('rabbit-dock', 'pip'),
    text: "DEAR SKIER. There is a DOCK now. I ran to the end of it and stopped in time. Mom says I have to say that part. The fish are not scared of me yet but they will be.",
  },
  {
    id: 'built-bandstand',
    from: 'marge',
    signed: "-Marge",
    when: built('bandstand', 'marge'),
    text: "Hon - the bandstand. I stood in it this morning with my coffee and nobody could tell me I wasn't a band. Come by. Bring anything that makes a noise.",
  },
  {
    id: 'built-hut',
    from: 'gus',
    signed: "-Gus",
    when: built('burnt-ridge-hut', 'gus'),
    text: "The hut on Burnt Ridge has a stove now, so I brought chili up. Then I ate it, because nobody was there. It was pretty good. Come up sometime and I'll bring more.",
  },
  {
    id: 'built-lookout',
    from: 'amos',
    signed: "-A.",
    when: built('reservoir-deck', 'amos'),
    text: "The lookout is built. From it you can see the reservoir and the hill where the old road ran. I stood there an hour. Nobody asked me to move.",
  },
  {
    id: 'sven-pizza',
    from: 'sven',
    signed: "-Sven",
    when: met('sven'),
    text: "A student asked me today what comes after pizza and french fries. I said: lunch. He's my best student. I might let him teach.",
  },
];

/**
 * The letter waiting today, if any: the first one not yet collected whose time has come. There is
 * at most one a day, so the post is worth a visit tomorrow as well.
 * @param collected letters already had, by id, with the day each was collected
 */
export function letterWaiting(save: SaveData, collected: Record<string, string>, day: string): Letter | null {
  if (Object.values(collected).includes(day)) return null;
  return LETTERS.find((l) => !(l.id in collected) && (!l.when || l.when(save))) ?? null;
}
