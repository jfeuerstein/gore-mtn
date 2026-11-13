import type { Season } from '../look/season';
import type { Whereabouts } from './people';
import type { SaveData } from './save';

/**
 * The mountain's secrets: things that are not on the map and that nothing points at. They are
 * found by going and looking. The owner asked for reasons to explore that are not only one
 * more thing for a shelf, so most of these are something to read, to follow or to come back
 * to; what they hand over (a key, something to wear, somebody to bring along) is a thank-you
 * and not the point. No DOM or three.js here.
 *
 * The Book lists a secret only once it has been found, and never says how many there are.
 */

/** Where a secret stands: as people and lost things are placed, or by one of a few ways of its own. */
export type SecretWhere =
  | Whereabouts
  /** On a summit, by its id among the peaks. */
  | { peak: string }
  /** A way along one of the named paths through the woods, 0..1. */
  | { path: string; along: number }
  /** Deep in the woods, far from any trail: the first, second, third remotest such place. */
  | { wild: number }
  /** At the door of one of the town's named places. */
  | { door: string }
  /** At the top of one of the unmarked runs: the first, second, third longest. */
  | { run: number }
  /** At the water's edge of a pond, by its id, on the side with the least built on it. */
  | { shore: string };

export type SecretKind = 'register' | 'plaque' | 'working' | 'room' | 'cairn' | 'bell' | 'den' | 'nest' | 'shack' | 'ribbon' | 'light';

export interface Secret {
  id: string;
  kind: SecretKind;
  /** What it is called, once found: in the Book, and on the sheet it is read in. */
  name: string;
  where: SecretWhere;
  /** Metres to stand off from that place, away from the trail or the door, into the trees. */
  off?: number;
  /** Something that goes back into the hill (a tunnel's mouth) is set against rising ground, well clear of the water, with its back to the slope. */
  into?: 'hill';
  /** What the action button says there. */
  action: string;
  /** What is read or found there. Each row is a page of the sheet: handwriting if it is signed. */
  pages: readonly { text: string; signed?: string }[];
  /** Something lying there to be picked up, the first time: a thing to wear, and a key. */
  gear?: string;
  key?: string;
  /** For a room: the key that opens it, what is said while it is locked, and the picture of the inside. */
  needs?: string;
  locked?: string;
  art?: string;
  /** Only there in these seasons (a nest), and only after dark (a lantern). All year and all day if not given. */
  seasons?: readonly Season[];
  nightly?: true;
  /** What leads to it from the nearest trail, and in which seasons it does. */
  lead?: { marks: 'tracks' | 'buckets'; seasons: readonly Season[] };
  /** What is found there in a particular season, in place of `pages` and `gear`. */
  turns?: Partial<Record<Season, { pages: Secret['pages']; gear?: string }>>;
  /** Gone, come upon in a hurry: it is walked up to. */
  shy?: true;
}

/** The keys, by id: what each is called. Where one lies and what it opens is in `SECRETS`. */
export const KEYS: Readonly<Record<string, string>> = {
  'key-brass': 'A brass key',
  'key-iron': 'An iron key',
  'key-tin': 'A little tin key',
  'key-copper': 'A green copper key',
};

/** A trail register: a tin box on a post, with a book in it that the town has been writing in for years. */
const register = (id: string, name: string, where: SecretWhere, pages: Secret['pages'], also: Partial<Secret> = {}): Secret => ({ id: `register-${id}`, kind: 'register', name, where, action: 'Open the box', pages, ...also });

/** A brass plaque beside a trail, that says why it is called what it is called. None of it is true. */
const plaque = (trail: string, along: number, text: string): Secret => ({
  id: `plaque-${trail.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
  kind: 'plaque',
  name: trail,
  where: { trail, along },
  action: 'Read the plaque',
  pages: [{ text }],
});

export const SECRETS: readonly Secret[] = [
  // --- Registers: at the ends of things, where only somebody who meant to would get to. ---
  register('burnt-ridge', 'The Burnt Ridge register', { lift: 'Burnt Ridge Quad', along: 1 }, [
    { text: "Came up for the quiet. There's a lot of it. I'd forgotten how loud quiet is.", signed: '-Bram, a Tuesday' },
    { text: 'Counted eleven chickadees and one jay who thinks he owns the place. He might.', signed: '-Wren' },
    { text: 'HAZEL WAS HERE and so was I but she got here first because she has longer legs.', signed: 'PIP' },
    { text: "If you're reading this, the view's behind you. Turn around.", signed: '-Otto' },
  ], { off: 22 }),
  register('twister-cliffs', 'The register at Twister Cliffs', { spot: 'twister-cliffs' }, [
    { text: "I don't like heights. I came anyway. I'm writing this sitting down.", signed: '-Fenn' },
    { text: "Brought a sandwich named after this trail and ate it on this trail. Felt right.", signed: '-Walt' },
    { text: "You can see the inn from here. I waved. Nobody waved back, but it's far.", signed: '-Marge, hon' },
    { text: "The rock is warm in the afternoon. That's all I have to report.", signed: '-Ivy' },
  ]),
  register('vermont', 'The Vermont Overlook register', { spot: 'vermont-overlook' }, [
    { text: "That's Vermont over there. It looks the same as here, but they'd say that about us.", signed: '-Amos' },
    { text: 'Left a pair of goggles in the box. Wrong color for me. Right color for somebody.', signed: '-June' },
    { text: "I can see my mom from here!! (I can't.)", signed: 'PIP' },
    { text: "Sat until the light went. Walked down by feel. Wouldn't recommend it. Would recommend it.", signed: '-Wren' },
  ], { gear: 'goggles-rose' }),
  register('reservoir', 'The reservoir register', { spot: 'north-creek-reservoir' }, [
    { text: "The ice went out on the ninth this year. I've got it written down back to when I started writing things down.", signed: '-Amos' },
    { text: "Two loons. Or one loon twice. I'm not a bird person.", signed: '-Gus' },
    { text: "Skipped a stone seven times. Nobody saw. It's in the book now, so it counts.", signed: '-Bram' },
    { text: 'Nice pond.', signed: "-Sven (it's a reservoir -Dot)" },
  ], { off: 40 }),
  register('raymond-brook', 'The register at the end of Raymond Brook', { path: 'Raymond Brook Ski Trail', along: 0.97 }, [
    { text: "This is as far as the trail goes. I checked. It just kind of... stops.", signed: '-Hazel' },
    { text: "Somebody left a bedroll hanging on the post. It's dry. It's not mine. It's nice.", signed: '-Otto' },
    { text: "The brook is louder in April. I couldn't hear myself think, which was the idea.", signed: '-Dot' },
    { text: "WE WALKED THE WHOLE THING. Tom didn't come because he's a snowman.", signed: 'PIP' },
  ], { gear: 'pack-roll' }),
  register('second-pond', 'The Second Pond register', { path: 'Second Pond Overlook', along: 0.95 }, [
    { text: "There's a first pond, then. I've never found it.", signed: '-Fenn' },
    { text: "Someone hung a red pack on the post and didn't come back for it. It's been a year. I think it's yours now, whoever you are.", signed: '-Marge' },
    { text: "Good spot for a sandwich. I didn't have a sandwich. Poor planning.", signed: '-Walt, of all people' },
    { text: 'Saw the thing from the Rumor. Or a stump. It was pretty far.', signed: '-Mica' },
  ], { gear: 'pack-red' }),

  // --- Why it's called that. ---
  plaque('Sunway', 0.45, "SUNWAY. The first groomer said it was the only run where the sun got there before he did."),
  plaque('Twister', 0.5, "TWISTER. Laid out by a surveyor who lost his map and wouldn't say so."),
  plaque('Showcase', 0.4, "SHOWCASE. It runs right under the lift. Everybody's watching. Nobody's watching. Ski it anyway."),
  plaque('Quicksilver', 0.5, "QUICKSILVER. Named for a thermometer somebody dropped here in 1964. They never found all of it."),
  plaque('Ruby Run', 0.5, "RUBY RUN. They're garnets. A miner's daughter called them rubies, and nobody had the heart."),
  plaque('The Rumor', 0.35, "THE RUMOR. Somebody saw something here once. That's all anybody will tell you."),
  plaque('Lies', 0.4, "LIES. The trail next door is called The Rumor. This one's what people said about it afterward."),
  plaque('Hullabaloo', 0.5, "HULLABALOO. A school group came down here all at once in 1971. You could hear it from town."),
  plaque('Hawkeye', 0.5, "HAWKEYE. A red-tail has nested in the same pine since before the lift. She's not the same hawk. Probably."),
  plaque('Cloud', 0.4, "CLOUD. Some mornings you ski down into one. Some mornings you ski down out of one."),
  plaque('Echo', 0.5, "ECHO. Say something nice. It comes back."),
  plaque('Fairview', 0.5, "FAIRVIEW. The man who cut it thought the view was fair. He meant it as a compliment."),
  plaque('Foxlair', 0.5, "FOXLAIR. There was a den back in the birches. There still is. Go by quietly."),
  plaque('Headwaters', 0.4, "HEADWATERS. Three brooks start within a snowball's throw of here. Two of them end up in the Hudson."),
  plaque('Jamboree', 0.5, "JAMBOREE. The ski club's picnic ended up here one spring. Nobody remembers deciding that."),
  plaque('Otter Slide', 0.5, "OTTER SLIDE. The otters were here first. The trail just follows them."),
  plaque('Paradox', 0.5, "PARADOX. It looks steeper from the bottom than it does from the top. Nobody can explain it."),
  plaque('Pine Knot', 0.5, "PINE KNOT. One pine wouldn't come down. They went around it. It's still here, and it knows."),
  plaque('Sleeping Bear', 0.5, "SLEEPING BEAR. The crew found one, right here, in November. They came back in May."),
  plaque('Topridge', 0.4, "TOPRIDGE. It's the top of the ridge. Not every name has a story."),
  plaque('Wild Air', 0.5, "WILD AIR. A liftie said the air tasted different up here. He was right. It still does."),
  plaque('Woodchuck', 0.5, "WOODCHUCK. He lives under the third snow gun. He's never once seen his shadow. He doesn't look."),
  plaque('46er', 0.5, "46er. For anybody who's climbed all forty-six of the high peaks. And for anybody who's thought about it."),
  plaque('Open Pit', 0.5, "OPEN PIT. The garnet came out of the ground right here, by the wagonload. Mind the edge."),
  plaque('Powder Pass', 0.5, "POWDER PASS. The wind leaves it here. Don't tell anybody."),
  plaque('Twin Fawns', 0.5, "TWIN FAWNS. Two of them, every June, for six years running. Then three. They had to leave the sign."),
  plaque('North Star', 0.5, "NORTH STAR. Stand here on a clear night and look straight up the trail. There it is."),
  plaque('Potluck', 0.5, "POTLUCK. You get what you get. Some days it's corduroy. Some days it's soup."),

  // --- Old workings. ---
  {
    id: 'working-adit',
    kind: 'working',
    name: 'The old adit',
    where: { spot: 'barton-mine' },
    off: 26,
    into: 'hill',
    action: 'Look inside',
    pages: [
      { text: "A tunnel, timbered at the mouth, going back into the hill a little way. The walls catch the light: garnet, everywhere, like the inside of a pomegranate." },
      { text: "Somebody's leaned a pair of skis against the timbers, and hung a key on a nail. The tag on the key says OFFICE." },
    ],
    gear: 'skis-garnet',
    key: 'key-iron',
  },
  {
    id: 'working-cellar',
    kind: 'working',
    name: 'A cellar hole',
    where: { wild: 0 },
    action: 'Climb down',
    pages: [
      { text: "Four walls of fieldstone with no house on them, and an apple tree that someone planted by a door that isn't there." },
      { text: "In the corner, under a flat stone: a brass key, gone green at the edges. The tag says M.S. 1967. And a toad, who was here first, and has decided to come along." },
    ],
    gear: 'pet-toad',
    key: 'key-brass',
  },
  {
    id: 'working-rope-tow',
    kind: 'working',
    name: 'The rope tow',
    where: { place: 'ski-bowl-lodge' },
    off: 120,
    action: 'Look it over',
    pages: [
      { text: "An engine off a truck, bolted to a sled, with a wheel as tall as you are. This pulled people up the hill on a rope before anybody here had heard of a chairlift." },
      { text: "A plaid jacket is still hanging on the brake handle, stiff as a board. There's a little tin key in the pocket, on a string, with a paper tag: TUNING." },
    ],
    gear: 'jacket-plaid',
    key: 'key-tin',
  },

  // --- Rooms behind doors nobody remembers having the key to. ---
  {
    id: 'room-mid-station',
    kind: 'room',
    name: 'The old mid station',
    where: { door: 'old-gondola-mid-station' },
    action: 'Try the door',
    needs: 'key-brass',
    locked: "Locked. There's a brass plate round the keyhole, worn smooth. Somebody used to open this every morning.",
    art: 'rooms/mid-station',
    pages: [
      { text: "The key turns like it was oiled yesterday. Inside: a bench along one wall, a stove, a clock stopped at ten to four, and one red gondola cabin, the size of a phone booth, with its door open." },
      { text: "There's a sweater folded on the bench. Orange, with a stripe. It smells like woodsmoke and wax. It fits." },
    ],
    gear: 'jacket-1967',
  },
  {
    id: 'room-mine-office',
    kind: 'room',
    name: 'The mine office',
    where: { door: 'old-office' },
    action: 'Try the door',
    needs: 'key-iron',
    locked: "Locked. Through the window: a desk, a ledger left open, a lamp. Dust on everything, like snow.",
    art: 'rooms/mine-office',
    pages: [
      { text: "The ledger's last line is a date and a weight and the word GOOD. The pen is still in the fold of the book." },
      { text: "A pair of goggles hangs from the lamp: leather, with brown glass. The captain's, by the look of the hook they've worn in the brass." },
    ],
    gear: 'goggles-aviator',
  },
  {
    id: 'room-tuning',
    kind: 'room',
    name: 'The tuning shed',
    where: { door: 'tuning' },
    action: 'Try the door',
    needs: 'key-tin',
    locked: "Locked, with a little padlock a child could pick. You're not a child. Well.",
    art: 'rooms/tuning-shed',
    pages: [
      { text: "Skis, floor to rafters. Every pair anybody ever left to be waxed and never came back for, each with a paper tag." },
      { text: "One tag just says FOR WHOEVER FINDS THE KEY. Hickory, with leather bindings, as long as a door. They've been waxed." },
    ],
    gear: 'skis-hickory',
  },
  {
    id: 'room-power-house',
    kind: 'room',
    name: 'The power house',
    where: { door: 'power-house' },
    action: 'Try the door',
    needs: 'key-copper',
    locked: "Locked. Something inside is purring. It might be the dynamo.",
    art: 'rooms/power-house',
    pages: [
      { text: "A dynamo the size of a cow, painted green, that hasn't turned in fifty years. It's warm anyway. That's where the purring is coming from." },
      { text: "It wasn't the dynamo. A gray kitten walks out from behind it, looks you over, and sits down on your boot. That seems to be that." },
    ],
    gear: 'pet-kitten',
  },

  // --- Marks you leave. ---
  ...(['gore', 'bear', 'burnt-ridge', 'little-gore'] as const).map(
    (peak): Secret => ({ id: `cairn-${peak}`, kind: 'cairn', name: 'A cairn', where: { peak }, off: 9, action: 'Add a stone', pages: [] }),
  ),
  {
    id: 'bell',
    kind: 'bell',
    name: 'The summit bell',
    where: { peak: 'gore' },
    off: 16,
    action: 'Ring the bell',
    pages: [{ text: "A ship's bell on a timber frame, green with weather. The rope's new. Somebody keeps it up." }],
  },

  // --- Things to follow: prints in the snow, buckets on the maples. ---
  {
    id: 'den',
    kind: 'den',
    name: 'The fox den',
    where: { trail: 'Foxlair', along: 0.45 },
    off: 150,
    action: 'Look in',
    lead: { marks: 'tracks', seasons: ['winter'] },
    pages: [{ text: "A hole under the roots of a tipped-over birch. It's quiet. Somebody lives here, and they're out." }],
    turns: {
      winter: { pages: [{ text: "The tracks go in under the roots of a tipped-over birch. None come out.\nSomebody's home, and asleep. Better come back when the snow's gone." }] },
      spring: {
        pages: [{ text: "Three kits, tumbling over each other in last year's leaves. They stop. They look at you.\nTwo go back in. One doesn't. One follows you a little way, and then the rest of the way." }],
        gear: 'pet-kit',
      },
      summer: {
        pages: [{ text: "The kits are half grown and all legs. They've dug the door wider.\nOne trots over like it knows you. It's decided it does." }],
        gear: 'pet-kit',
      },
    },
  },
  {
    id: 'nest',
    kind: 'nest',
    name: 'The nest in the reeds',
    where: { shore: 'duck-pond' },
    action: 'Look closer',
    seasons: ['spring', 'summer'],
    shy: true,
    pages: [
      { text: "A nest in the reeds, lined with down. Five ducklings, and one egg that's late.\nIt hatches while you're standing there. It looks at you first. That's that, with ducks." },
    ],
    gear: 'pet-duckling',
  },
  {
    id: 'shack',
    kind: 'shack',
    name: 'The sugar shack',
    where: { wild: 4 },
    action: 'Go in',
    lead: { marks: 'buckets', seasons: ['spring'] },
    pages: [{ text: "A shack in the maples, shut up tight. There's a note on the door." }, { text: "Back when the sap runs.\nCold nights and warm days, that's all it takes. And me waking up.", signed: '-S.' }],
    turns: {
      spring: {
        pages: [
          { text: "It's warm in here and the windows are running. A pan as long as a bed, boiling. The whole shack smells like pancakes.\nNobody's in. There's a cap on a nail, and a note under it." },
          { text: "Gone to empty buckets. Stir it if it climbs.\nIf you found this place you followed forty buckets to do it, so you've earned the cap. Take a candy too.", signed: '-S.' },
        ],
        gear: 'hat-sugar',
      },
    },
  },

  // --- The unmarked runs: a ribbon at the top, and a way down that is on no map. ---
  ...["Nobody's", 'The Pencil Line', 'Hush'].map(
    (name, n): Secret => ({
      id: `run-${n + 1}`,
      kind: 'ribbon',
      name,
      where: { run: n },
      action: 'Look at the ribbon',
      pages: [
        { text: "A strip of orange ribbon, tied round a birch. Past it there's a way down through the trees. It isn't on the map.\nSomebody's written on the ribbon, very small." },
        { text: [`"Nobody's." Tell nobody.`, '"The Pencil Line." You never saw this.', '"Hush." Shh.'][n] as string, signed: ['-B.', '-H.', '-I.'][n] as string },
        { text: 'You pencil it onto your own map. Lightly.' },
      ],
    }),
  ),

  // --- The light at the quarry: after dark, and only for somebody who walks. ---
  {
    id: 'light',
    kind: 'light',
    name: 'The quarry lantern',
    where: { spot: 'garnet-quarry' },
    off: 42,
    action: 'Look at the lantern',
    nightly: true,
    shy: true,
    pages: [
      { text: "A lantern on an iron hook in the quarry wall. Lit. The wick's trimmed and the glass is clean.\nUnder it, on a nail: a pair of blue goggles, and a key gone green." },
      { text: "For whoever walks up slow enough to see it.\nI light it for the night shift. There hasn't been one since 1983. I light it anyway.", signed: '-A.' },
    ],
    gear: 'goggles-mirror',
    key: 'key-copper',
  },
];

/** The unmarked runs, by the id of the ribbon at the top of each. */
export const RUN_IDS: readonly string[] = SECRETS.filter((s) => s.kind === 'ribbon').map((s) => s.id);

/**
 * An unmarked run has been skied (or ridden, or walked) from its ribbon to the trail it comes
 * out on. Kept the first time, with what it earns: amber lenses for the first, birch skis
 * for all of them. Null if it has not been found, or has been done before.
 */
export function skiedRun(save: SaveData, id: string, day: string): { gear: string[]; done: number; of: number } | null {
  if (!RUN_IDS.includes(id) || !(id in save.secrets) || id in save.runs) return null;
  save.runs[id] = day;
  const done = RUN_IDS.filter((r) => r in save.runs).length;
  const gear: string[] = [];
  if (!save.gear.owned.includes('goggles-amber')) gear.push('goggles-amber');
  if (done >= RUN_IDS.length && !save.gear.owned.includes('skis-birch')) gear.push('skis-birch');
  return { gear, done, of: RUN_IDS.length };
}

/** True if a secret is there to be come upon just now: in its season, and after dark if it keeps to the dark. */
export function thereNow(secret: Secret, season: Season, night: boolean): boolean {
  return (!secret.seasons || secret.seasons.includes(season)) && (!secret.nightly || night);
}

/**
 * How each thing to wear, carry or bring along is come by, when it is not given for an errand
 * (those are in `people.ts`) and is not what the player starts in. A test holds this list to
 * the wardrobe: nothing may be in the Book that cannot be had.
 */
export const COME_BY: Readonly<Record<string, string>> = {
  'hat-beret': 'the painter, once she has given three paintings',
  'hat-crown': 'Pip, found five times',
  'hat-sugar': 'the sugar shack',
  'hat-straw': 'the camper, met on three days',
  'jacket-1967': 'the old mid station',
  'jacket-plaid': 'the rope tow',
  'jacket-band': "the band's first concert",
  'jacket-moss': 'the camper, the first time',
  'goggles-amber': 'the end of an unmarked run',
  'goggles-rose': 'the Vermont Overlook register',
  'goggles-mirror': 'the light at the old quarry',
  'goggles-aviator': 'the mine office',
  'goggles-snow': 'a morning above the clouds',
  'skis-hickory': 'the tuning shed',
  'skis-racer': 'Pip, found three times',
  'skis-birch': 'every unmarked run',
  'skis-garnet': 'the old adit',
  'skis-night': 'a meteor shower, or the northern lights',
  'pack-basket': 'the camper, met on two days',
  'pack-satchel': 'the painter, once she has given six paintings',
  'pack-red': 'the Second Pond register',
  'pack-roll': 'the register at the end of Raymond Brook',
  'hat-museum': 'the museum, at five pieces',
  'pack-specimen': 'the museum, at fifteen pieces',
  'goggles-loupe': 'the museum, at thirty pieces',
  'jacket-tweed': 'the museum, at fifty pieces',
  'skis-crystal': 'the museum, at seventy pieces',
  'trail-gold': 'a dozen stones on the cairns',
  'trail-garnet': 'ten plaques read',
  'trail-sky': 'every register signed',
  'trail-leaf': 'a path worn by walking it',
  'tune-fiddle': 'the fiddler',
  'tune-horn': 'the horn player',
  'tune-banjo': 'the banjo player',
  'tune-squeezebox': 'the squeezebox player',
  'pet-kit': 'the den at the end of the tracks',
  'pet-duckling': 'the nest by the Duck Pond',
  'pet-chickadee': 'four guests at the feeder',
  'pet-kitten': 'the power house',
  'pet-toad': 'the cellar hole',
};

export const secretById = (id: string): Secret | undefined => SECRETS.find((s) => s.id === id);

/** What the town has to say the day after the bell is rung, by who says it. Whoever is not here says nothing of it. */
export const BELL_HEARD: Readonly<Record<string, string>> = {
  hazel: "Oh! Was that you, on the bell yesterday? I heard it from the lodge. I kind of loved it.",
  otto: "Somebody rang the summit bell yesterday. Pretty sure it was you. Sounded pretty good.",
  marge: "Was that you ringing the bell up top, hon? The whole inn stopped to listen.",
  dot: "I heard the bell! I wrote down the time. I don't know why. It felt official.",
  june: "The bell rang yesterday and I kind of burned a tray of rolls listening. Worth it.",
  wren: "You rang the bell. It carries farther than you'd think. I heard it from the tower, and I was in the tower.",
  gus: "That bell yesterday. That was you? It's been years. Chili's on me.",
};

/** A full cairn: stones go on after this, but it grows no taller. */
export const CAIRN_TALL = 24;

/** What a find hands back: what there is to read, what was picked up, and whether the door was locked. */
export interface Found {
  secret: Secret;
  /** True the first time. */
  first: boolean;
  /** For a room: false while there is no key for it. */
  open: boolean;
  pages: readonly { text: string; signed?: string }[];
  /** Things to wear that were lying there, to be given (the game says so), and a key picked up. */
  gear: string[];
  key: string | null;
}

/** How many of a kind have been found. */
export function foundOf(save: SaveData, kind: SecretKind): number {
  return SECRETS.filter((s) => s.kind === kind && s.id in save.secrets).length;
}

/** The stones on every cairn, together. */
export function stonesLaid(save: SaveData): number {
  return Object.values(save.cairns).reduce((sum, c) => sum + c.stones, 0);
}

/**
 * Come upon a secret and do what is done there: read it, look inside, try the door. Marks it
 * found, picks up what was lying there, and says what there is to read. A room without its
 * key is not found: it only says that it is locked.
 */
export function discover(save: SaveData, id: string, day: string, season?: Season): Found | null {
  const secret = secretById(id);
  if (!secret || secret.kind === 'cairn') return null;
  const turn = season ? secret.turns?.[season] : undefined;
  if (secret.needs && !save.keys.includes(secret.needs)) return { secret, first: false, open: false, pages: [{ text: secret.locked ?? 'Locked.' }], gear: [], key: null };
  const first = !(id in save.secrets);
  if (first) save.secrets[id] = day;
  const gear: string[] = [];
  let key: string | null = null;
  const lying = turn ? turn.gear : secret.gear;
  if (lying && !save.gear.owned.includes(lying)) gear.push(lying);
  if (secret.key && !save.keys.includes(secret.key)) {
    save.keys.push(secret.key);
    key = secret.key;
  }
  // The thanks for doing a whole kind of thing: a line to leave in the snow.
  const registers = SECRETS.filter((s) => s.kind === 'register');
  if (secret.kind === 'register' && registers.every((s) => s.id in save.secrets) && !save.gear.owned.includes('trail-sky')) gear.push('trail-sky');
  if (secret.kind === 'plaque' && foundOf(save, 'plaque') >= PLAQUES_FOR_LINE && !save.gear.owned.includes('trail-garnet')) gear.push('trail-garnet');
  // A register has a line for whoever opens it: theirs, with the day.
  const pages = secret.kind === 'register' ? [...secret.pages, { text: "There's a pencil on a string, and room at the bottom of the page." }, { text: 'Made it.', signed: `-you, ${monthDay(save.secrets[id] as string)}` }] : (turn?.pages ?? secret.pages);
  return { secret, first, open: true, pages, gear, key };
}

/** How many plaques, read, earn the garnet line; and how many stones, laid, the gold. */
export const PLAQUES_FOR_LINE = 10;
export const STONES_FOR_GOLD = 12;

/**
 * Add a stone to a cairn: one a day, to each. Says how many are on it now, or null if today's
 * is already there.
 */
export function addStone(save: SaveData, id: string, day: string): { stones: number; gear: string[] } | null {
  const secret = secretById(id);
  if (!secret || secret.kind !== 'cairn') return null;
  const cairn = save.cairns[id] ?? { stones: 0, day: '' };
  if (cairn.day === day) return null;
  save.cairns[id] = { stones: cairn.stones + 1, day };
  if (!(id in save.secrets)) save.secrets[id] = day;
  return { stones: cairn.stones + 1, gear: stonesLaid(save) >= STONES_FOR_GOLD && !save.gear.owned.includes('trail-gold') ? ['trail-gold'] : [] };
}

/** Ring the summit bell. The town hears it, and says so tomorrow. */
export function ringBell(save: SaveData, day: string): boolean {
  if (!('bell' in save.secrets)) save.secrets.bell = day;
  const again = save.bell.rang === day;
  save.bell = { rang: day, told: again ? save.bell.told : [] };
  return !again;
}

/** True if someone has something to say about the bell today and has not yet said it. Asking does not use it up. */
export function bellHeard(save: SaveData, personId: string, day: string): boolean {
  return BELL_HEARD[personId] !== undefined && save.bell.rang !== '' && !save.bell.told.includes(personId) && dayAfter(save.bell.rang) === day;
}

/** What someone says about the bell, the day after it was rung: once each, and nothing on any other day. */
export function bellRemark(save: SaveData, personId: string, day: string): string | null {
  const line = BELL_HEARD[personId];
  if (!line || !save.bell.rang || save.bell.told.includes(personId)) return null;
  if (dayAfter(save.bell.rang) !== day) return null;
  save.bell.told.push(personId);
  return line;
}

/** The day after a day, as YYYY-MM-DD. */
export function dayAfter(day: string): string {
  const [y, m, d] = day.split('-').map(Number) as [number, number, number];
  const next = new Date(Date.UTC(y, m - 1, d + 1));
  return `${next.getUTCFullYear()}-${String(next.getUTCMonth() + 1).padStart(2, '0')}-${String(next.getUTCDate()).padStart(2, '0')}`;
}

const MONTHS = ['Jan.', 'Feb.', 'March', 'April', 'May', 'June', 'July', 'Aug.', 'Sept.', 'Oct.', 'Nov.', 'Dec.'];
/** A day as it would be written in a register: "Nov. 12". */
export function monthDay(day: string): string {
  const [, m, d] = day.split('-').map(Number) as [number, number, number];
  return `${MONTHS[m - 1] ?? ''} ${d}`;
}
