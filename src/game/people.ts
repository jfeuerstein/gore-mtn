import type { Season } from '../look/season';

/**
 * The people of the mountain and the town: who they are, where they stand, what they say, and
 * the errands they ask. No DOM or three.js here.
 *
 * Talk is short and optional. An errand is never timed and never fails: it is a nudge toward a
 * corner of the mountain, and it waits as long as the player likes.
 */

/** Something an errand asks for. All of it is read from the book, so nothing is ever "handed in" and lost. */
export type Need =
  | { kind: 'mineral'; id: string; count: number }
  | { kind: 'mineralSize'; id: string; cm: number }
  | { kind: 'minerals'; count: number }
  | { kind: 'species'; id: string }
  | { kind: 'speciesCount'; count: number }
  | { kind: 'trail'; name: string }
  | { kind: 'trails'; count: number }
  | { kind: 'lifts'; count: number }
  | { kind: 'landmark'; id: string }
  | { kind: 'peak'; id: string }
  | { kind: 'stamps'; count: number }
  | { kind: 'seasons'; count: number }
  /** A thing to be carried: lost property picked up off the mountain, or something another person hands over. */
  | { kind: 'item'; id: string };

/** Where something is: by a place, a named spot, the foot of a lift, along a trail, or along a road from a place. */
export type Whereabouts =
  | { place: string }
  | { spot: string }
  | { lift: string }
  | { trail: string; along: number }
  | { road: string; from: string; metres: number };

export interface Errand {
  id: string;
  /** Who asks, and who it is finished with (the asker, unless it is a delivery). */
  from: string;
  to?: string;
  title: string;
  ask: string;
  /** Said when the player comes back without it. */
  nudge: string;
  need: Need;
  /** For an item: where it lies waiting, or who hands it over. */
  lost?: { name: string; at: Whereabouts };
  fetch?: { name: string; from: string; handover: string };
  thanks: string;
  reward?: { gear?: string; pass?: boolean };
  /** An errand that must be done first, and the seasons this one is asked in. */
  after?: string;
  seasons?: readonly Season[];
}

export interface Person {
  id: string;
  name: string;
  /** A few words on who they are, shown under the name. */
  role: string;
  at: Whereabouts;
  /** What they wear: jacket, trousers and hat colours, and the style of hat. */
  look: { jacket: number; trousers: number; hat: number; style: string };
  /** Said on first meeting, and after that one of these, by season or any time. */
  hello: string;
  chat: readonly string[];
  seasonal?: Partial<Record<Season, readonly string[]>>;
}

export const PEOPLE: readonly Person[] = [
  {
    id: 'hazel',
    name: 'Hazel',
    role: 'Ski patrol, Base Lodge',
    at: { place: 'base-lodge' },
    look: { jacket: 0xc8281e, trousers: 0x1f242e, hat: 0xc8281e, style: 'beanie' },
    hello: 'First day? The mountain is all yours. Nobody is keeping score, least of all me.',
    chat: [
      'The gondola goes to Bear Mountain, the Express to the Saddle. Either way is down from there.',
      'If you meet a tree, it wins. Gently. You will be fine.',
      'Tap the Book now and then. It is nice to see it fill up.',
    ],
    seasonal: {
      winter: ['Corduroy on Sunway this morning. Best there is.', 'Stones glint on the snow after a grooming. The cats turn them up.'],
      spring: ['Stay on the white stuff. The brown stuff is slow going on skis.'],
      summer: ['Bikes take the lifts too. Pedal with your thumb up, brake with it down.'],
      fall: ['Peak colour never lasts. Ride through it while it does.'],
    },
  },
  {
    id: 'otto',
    name: 'Otto',
    role: 'Lift attendant, Adirondack Express',
    at: { lift: 'Adirondack Express' },
    look: { jacket: 0x2b62c9, trousers: 0x3a3430, hat: 0xd9a441, style: 'trapper' },
    hello: 'Otto. I load chairs. Forty years, never dropped a skier. Dropped a sandwich once.',
    chat: [
      'Fourteen lifts on this hill, counting the carpets. I have ridden every one. Have you?',
      'You can see a lot of wildlife from a chair. They do not mind the lift. They mind you.',
      'I watched your last run. Seven out of ten. The seven is for enthusiasm.',
    ],
    seasonal: {
      winter: ['Cold enough for you? Good. Snow likes it.'],
      summer: ['Bikes go on the back of the chair. Do not ask me how. Trade secret.'],
    },
  },
  {
    id: 'gus',
    name: 'Gus',
    role: 'Cook, Saddle Lodge',
    at: { place: 'saddle-lodge' },
    look: { jacket: 0xf4f1ea, trousers: 0x2b3a55, hat: 0xf4f1ea, style: 'toque' },
    hello: 'Welcome to the Saddle. Chili is on. Chili is always on.',
    chat: [
      'Best view on the mountain is out that window. Second best is the chili.',
      'Everything up here comes up on a snowcat or a chairlift. Including me.',
    ],
    seasonal: {
      summer: ['Blueberries on the ledges this time of year. The bears and I have an understanding.'],
      fall: ['Chanterelles under the hardwoods after rain. Orange as a traffic cone, twice as tasty.'],
      winter: ['Warm your hands. The summit is colder than it looks from here.'],
    },
  },
  {
    id: 'wren',
    name: 'Wren',
    role: 'Fire tower observer, Gore summit',
    at: { place: 'summit' },
    look: { jacket: 0x4f7a3f, trousers: 0x5a4a3a, hat: 0x8a6a3c, style: 'ranger' },
    hello: 'You made it to the top. Sixty miles of Adirondacks, and on a clear day, Vermont.',
    chat: [
      'Ravens ride the updraft off the east face. I have names for all of them. They have names for me.',
      'The whole mountain is hardwood low down and spruce up here. In fall you can see the line.',
      'What you see depends on the hour. Dawn and dusk belong to the deer and the fox.',
    ],
    seasonal: {
      winter: ['A Canada jay will take a crust from your hand up here. It will also take the whole sandwich.'],
      summer: ['Fireflies in the meadows after dark. From up here it looks like the stars fell down.'],
    },
  },
  {
    id: 'mica',
    name: 'Dr. Mica',
    role: 'Geologist, Gore Mt. Mineral Shop',
    at: { spot: 'gore-mt-mineral-shop' },
    look: { jacket: 0x7a4fa3, trousers: 0x3a3430, hat: 0x8f1d2c, style: 'beanie' },
    hello: 'Ah, a collector! This mountain is a billion years of garnet and I intend to see all of it.',
    chat: [
      'Garnets here grow as big as a basketball. Most of mine are the size of a pea. One lives in hope.',
      'A new scatter of stones lies out every day. Frost and groomers bring them up.',
      'The rare ones keep off the trails: bare rock for labradorite, deep woods for wollastonite.',
      'They mined garnet on this mountain from 1878. Sandpaper, mostly. Imagine: a mountain of gems, for sandpaper.',
    ],
  },
  {
    id: 'bea',
    name: 'Conductor Bea',
    role: 'The Snow Train, North Creek depot',
    at: { place: 'depot' },
    look: { jacket: 0x1f2a3a, trousers: 0x1f2a3a, hat: 0x1f2a3a, style: 'cap' },
    hello: 'All aboard, or nearly. The first ski trains pulled in right here in 1934. Mine goes somewhere stranger.',
    chat: [
      'Ride up, slide down. That was the slogan. Still good advice.',
      'The Snow Train does not go to other places. It goes to other seasons.',
      'Whatever season you ride to, the mountain waits for you there until you ride home.',
    ],
  },
  {
    id: 'june',
    name: 'June',
    role: 'Baker, the café on Main Street',
    at: { road: 'Main Street', from: 'depot', metres: 170 },
    look: { jacket: 0xe8b040, trousers: 0x4a3a2e, hat: 0xf4ead8, style: 'beanie' },
    hello: 'Morning! Or whatever it is. Scones are out of the oven, and so am I for five minutes.',
    chat: [
      'Half the town skis and the other half feeds them. I do a bit of both.',
      'The turkeys cross Main Street at ten every morning. You could set the depot clock by them.',
    ],
    seasonal: {
      fall: ['Leaf season. The whole town smells of woodsmoke and cider doughnuts.'],
      winter: ['Snow day rule: first tracks, then breakfast. In that order.'],
    },
  },
  {
    id: 'walt',
    name: 'Walt',
    role: 'Sandwich maker, the deli on Main Street',
    at: { road: 'Main Street', from: 'depot', metres: 290 },
    look: { jacket: 0x3f8f5a, trousers: 0x2b3a55, hat: 0xf4f1ea, style: 'cap' },
    hello: 'Welcome to the deli. Everything on the board is named after a trail. Order a Rumor and see what you get.',
    chat: [
      'The Hudson starts as a pond up on Marcy. By the time it gets here it has opinions.',
      'An eagle fishes the river behind the depot most mornings. Better at it than I am.',
    ],
  },
  {
    id: 'pip',
    name: 'Pip',
    role: 'Aged nine, Ski Bowl',
    at: { place: 'ski-bowl-lodge' },
    look: { jacket: 0xe86aa0, trousers: 0x3f6fb5, hat: 0xf0d040, style: 'beanie' },
    hello: 'Hi! I am Pip. I am not lost. I know exactly where I am. It is my stuff that is lost.',
    chat: [
      'Somebody keeps building snowmen all over the mountain. Nobody knows who. Definitely nobody.',
      'My record down the Ski Bowl is one minute. I did not time it but it felt like one minute.',
      'There is a monster on The Rumor. My cousin saw it. My cousin also says he can fly.',
    ],
  },
  {
    id: 'amos',
    name: 'Amos',
    role: 'Retired miner, the old garnet quarry',
    at: { spot: 'garnet-quarry' },
    look: { jacket: 0x8a6a3c, trousers: 0x3a3430, hat: 0xd9a441, style: 'lamp' },
    hello: 'Do not mind me. I worked this pit thirty years and I like to come and look at it.',
    chat: [
      'The best garnet on Earth for grinding came out of this hole. Hard as sin and sharp when it breaks.',
      'There is more garnet lying about up here than anywhere on the hill. We were never tidy.',
      'Now and then you find one clear right through. Gem garnet. I found four in thirty years.',
    ],
  },
];

export const ERRANDS: readonly Errand[] = [
  // Hazel: a first lap of the mountain.
  {
    id: 'first-chair',
    from: 'hazel',
    title: 'First chair',
    ask: 'Do me a favour and check the top of the Express is still there. Ride it up and come and tell me.',
    nudge: 'The Adirondack Express loads just down the hill. Look for the orange gate.',
    need: { kind: 'lifts', count: 1 },
    thanks: 'Still there? Good. Here, patrol wears these. You look the part now.',
    reward: { gear: 'jacket-patrol' },
  },
  {
    id: 'stamp-collector',
    from: 'hazel',
    title: 'Five stamps',
    ask: 'Now fill that passport a little. Five stamps of any kind: trails, lifts, lodges, whatever takes your fancy.',
    nudge: 'Five stamps in the passport. Ski a trail top to bottom and you will have one before you know it.',
    need: { kind: 'stamps', count: 5 },
    thanks: 'Five already. Go and show Conductor Bea down at the depot. She has something for people with full passports.',
    after: 'first-chair',
  },
  // Otto: coffee, and every lift.
  {
    id: 'ottos-coffee',
    from: 'june',
    to: 'otto',
    title: 'Coffee for Otto',
    ask: 'Would you run a coffee up to Otto at the Express? He has not left that lift shack since the Carter administration.',
    nudge: 'Otto is at the foot of the Adirondack Express, by the Base Lodge. Mind the lid.',
    need: { kind: 'item', id: 'coffee' },
    fetch: { name: 'A coffee, milk, two sugars', from: 'june', handover: 'Here it is. Milk, two sugars, and do not let him tell you otherwise.' },
    thanks: 'From June? Still hot! You are a ten out of ten. First ten I have given since 1987. Take my spare hat.',
    reward: { gear: 'hat-trapper' },
  },
  {
    id: 'every-lift',
    from: 'otto',
    title: 'Every lift on the hill',
    ask: 'Tell you what. Ride all fourteen lifts, carpets and J-bar and all, and I will let you into the brotherhood.',
    nudge: 'Fourteen pins. The little ones count. The Snow Train does not: that is a carpet, whatever Bea says.',
    need: { kind: 'lifts', count: 14 },
    thanks: 'All fourteen. I have only known three people do it, and two of them were me. Wear this with pride.',
    reward: { gear: 'jacket-liftie' },
    after: 'ottos-coffee',
  },
  // Gus: foraging.
  {
    id: 'blueberries',
    from: 'gus',
    title: 'Blueberry scouting',
    ask: 'I want blueberries for the pancakes. Find me a patch on the ledges and tell me where. Just find it, I will do the picking.',
    nudge: 'Wild blueberries like sunny rock. Look where it is steep and bare.',
    need: { kind: 'species', id: 'blueberry' },
    thanks: 'A whole ledge of them? Pancakes Saturday. You get the first stack, and the hat.',
    reward: { gear: 'hat-toque' },
    seasons: ['summer'],
  },
  {
    id: 'chanterelles',
    from: 'gus',
    title: 'Something orange',
    ask: 'Chanterelles. Egg-yolk orange, under the hardwoods. Find me some and the soup is on the house.',
    nudge: 'Under the hardwoods, low on the mountain. They like it after rain.',
    need: { kind: 'species', id: 'chanterelle' },
    thanks: 'Beautiful. Soup is on. It was going to be on anyway, but now it is on with mushrooms.',
    seasons: ['summer', 'fall'],
  },
  {
    id: 'warm-up',
    from: 'gus',
    title: 'Top to bottom',
    ask: 'Skied Sunway yet? Top to bottom, all the way from up here. Works up an appetite. That is my whole business model.',
    nudge: 'Sunway starts just outside and runs all the way down to the base.',
    need: { kind: 'trail', name: 'Sunway' },
    thanks: 'All of it? Sit down. Chili. Do not argue.',
  },
  // Wren: looking.
  {
    id: 'raven-count',
    from: 'wren',
    title: 'The raven census',
    ask: 'I am counting ravens and I keep counting the same one. Go and find me a raven I have not met.',
    nudge: 'Ravens like the ledges and the high trails. Big, black, and very pleased with themselves.',
    need: { kind: 'species', id: 'raven' },
    thanks: 'That will be Gerald. I know him. Still, a raven is a raven. Put it in your guide.',
  },
  {
    id: 'naturalist',
    from: 'wren',
    title: 'Ten in the guide',
    ask: 'Fill ten entries in that field guide of yours and you will see this mountain properly. Animals, birds, plants, anything.',
    nudge: 'Ten entries. Try the trail edges at dawn, and do go gently.',
    need: { kind: 'speciesCount', count: 10 },
    thanks: 'Ten! You have the eye. This is what the tower keepers wore, back when there was one on every summit.',
    reward: { gear: 'hat-ranger' },
    after: 'raven-count',
  },
  {
    id: 'lookouts',
    from: 'wren',
    title: 'The other view',
    ask: 'Everyone comes up here. Almost nobody walks out to the Vermont Overlook. Go and stand there a minute.',
    nudge: 'The Vermont Overlook is on the map as a lookout. It is worth the detour.',
    need: { kind: 'landmark', id: 'vermont-overlook' },
    thanks: 'Quiet out there, is it not? Now you know my second-favourite spot.',
    after: 'raven-count',
  },
  // Dr. Mica: stones.
  {
    id: 'six-garnets',
    from: 'mica',
    title: 'Six garnets',
    ask: 'Bring me word of six garnets. I do not need to keep them. I need to know they are being found.',
    nudge: 'Six almandine garnets. They are the dark red ones, and they are everywhere once you look.',
    need: { kind: 'mineral', id: 'garnet', count: 6 },
    thanks: 'Six! Marvellous. Wear the colour, then. Garnet red. It suits a collector.',
    reward: { gear: 'jacket-garnet' },
  },
  {
    id: 'eight-kinds',
    from: 'mica',
    title: 'A proper collection',
    ask: 'A collection is not a pile of garnets. Find eight different minerals. Leave the trails if you have to.',
    nudge: 'Eight kinds. The uncommon ones are in bare rock and deep woods.',
    need: { kind: 'minerals', count: 8 },
    thanks: 'Eight kinds. That is a cabinet, not a pocketful. I am genuinely moved.',
    reward: { gear: 'hat-garnet' },
    after: 'six-garnets',
  },
  {
    id: 'big-one',
    from: 'mica',
    title: 'The big one',
    ask: 'Somewhere on this hill is a garnet over fifteen centimetres. Find it. I shall not sleep until you do.',
    nudge: 'Over fifteen centimetres. They say the old quarry is the place to look.',
    need: { kind: 'mineralSize', id: 'garnet', cm: 15 },
    thanks: 'Look at the size of it! Look at it! I need to sit down.',
    after: 'six-garnets',
  },
  // Bea: the Snow Train.
  {
    id: 'season-pass',
    from: 'bea',
    title: 'A pass for the Snow Train',
    ask: 'The Snow Train is for people who know this season first. Show me a passport with five stamps and you ride free, forever.',
    nudge: 'Five stamps of any kind in the passport, and the Snow Train is yours.',
    need: { kind: 'stamps', count: 5 },
    thanks: 'Five stamps, all in order. Here is your pass. Talk to me whenever you want another season. Any season. That is rather the point.',
    reward: { pass: true },
  },
  {
    id: 'four-seasons',
    from: 'bea',
    title: 'All four',
    ask: 'Ride to every season at least once. Then come and tell me which is best. Everyone says something different.',
    nudge: 'Winter, spring, summer, fall. The train goes to all of them.',
    need: { kind: 'seasons', count: 4 },
    thanks: 'All four! And which was best? No, do not tell me. You are wrong anyway. Have a conductor\'s cap.',
    reward: { gear: 'hat-cap' },
    after: 'season-pass',
  },
  // Walt: a delivery up the mountain.
  {
    id: 'tower-special',
    from: 'walt',
    to: 'wren',
    title: 'The Fire Tower Special',
    ask: 'Wren up at the fire tower phones in the same order every week and nobody will carry it up. Would you? It travels well.',
    nudge: 'Wren is at the fire tower on the summit. Straight Brook Quad, then a short walk through the trees.',
    need: { kind: 'item', id: 'sandwich' },
    fetch: { name: 'The Fire Tower Special', from: 'walt', handover: 'One Fire Tower Special. Turkey, cheddar, apple, and a pickle I am very proud of.' },
    thanks: 'The Special! And still in one piece. Walt is an artist. You are a hero. The jays get none of it.',
    reward: { gear: 'jacket-forest' },
  },
  // Pip: lost property.
  {
    id: 'lost-mitten',
    from: 'pip',
    title: 'Pip\'s mitten',
    ask: 'I lost a mitten. A yellow one. It was on my hand and then it was not. I think it was on the Hudson chair. Under it. Maybe.',
    nudge: 'It is yellow and it is somewhere under the Hudson Chair. Probably.',
    need: { kind: 'item', id: 'mitten' },
    lost: { name: 'A small yellow mitten', at: { lift: 'Hudson Chair' } },
    thanks: 'MY MITTEN. You found it! Now I have two again. That is the right number.',
    seasons: ['winter', 'spring'],
  },
  {
    id: 'lost-goggles',
    from: 'pip',
    title: 'Pip\'s goggles',
    ask: 'Also my goggles. I took them off to look at a deer and then the deer left and so did my goggles. On Moxham, halfway down.',
    nudge: 'Goggles. Halfway down Moxham, where the deer was.',
    need: { kind: 'item', id: 'goggles' },
    lost: { name: 'A pair of small goggles', at: { trail: 'Moxham', along: 0.5 } },
    thanks: 'They still fit! Here, you can have my other hat. I have nine.',
    reward: { gear: 'hat-rainbow' },
    after: 'lost-mitten',
    seasons: ['winter', 'spring'],
  },
  {
    id: 'lost-kite',
    from: 'pip',
    title: 'Pip\'s kite',
    ask: 'My kite got away. It went up and then it went sideways. It came down by Rabbit Pond I think. It is red.',
    nudge: 'A red kite, somewhere by Rabbit Pond.',
    need: { kind: 'item', id: 'kite' },
    lost: { name: 'A red kite, slightly chewed', at: { spot: 'rabbit-pond' } },
    thanks: 'It has a bite out of it! Something BIT my KITE. This is the best day.',
    reward: { gear: 'hat-rainbow' },
    seasons: ['summer', 'fall'],
  },
  // Amos: the old workings.
  {
    id: 'gem-garnet',
    from: 'amos',
    title: 'Clear right through',
    ask: 'Thirty years and I found four gem garnets. Find one and show me. I would like to see one more.',
    nudge: 'Gem garnet. Clear, deep red. They turn up where the ordinary ones do, once in a long while. Try round here.',
    need: { kind: 'mineral', id: 'gem-garnet', count: 1 },
    thanks: 'Well now. Hold it up to the light. There. That is what the whole mountain is made of, if you could see it. Keep my lamp. I do not go underground any more.',
    reward: { gear: 'hat-lamp' },
  },
];

export const personById = (id: string): Person | undefined => PEOPLE.find((p) => p.id === id);
export const errandById = (id: string): Errand | undefined => ERRANDS.find((e) => e.id === id);

/** Things to wear, earned from errands. The first of each kind is what the player starts in. */
export interface Gear {
  id: string;
  name: string;
  slot: 'hat' | 'jacket';
  colour: number;
  /** For a hat, its shape. */
  style?: string;
}

export const GEAR: readonly Gear[] = [
  { id: 'jacket-red', name: 'Red jacket', slot: 'jacket', colour: 0xe2452f },
  { id: 'jacket-patrol', name: 'Patrol jacket', slot: 'jacket', colour: 0xc8281e },
  { id: 'jacket-liftie', name: 'Liftie\'s blue', slot: 'jacket', colour: 0x2b62c9 },
  { id: 'jacket-garnet', name: 'Garnet jacket', slot: 'jacket', colour: 0x8f1d2c },
  { id: 'jacket-forest', name: 'Tower keeper\'s green', slot: 'jacket', colour: 0x3f7a4a },
  { id: 'hat-blue', name: 'Blue beanie', slot: 'hat', colour: 0x2f6f8f, style: 'beanie' },
  { id: 'hat-trapper', name: 'Otto\'s spare trapper', slot: 'hat', colour: 0xd9a441, style: 'trapper' },
  { id: 'hat-toque', name: 'Cook\'s toque', slot: 'hat', colour: 0xf4f1ea, style: 'toque' },
  { id: 'hat-ranger', name: 'Tower keeper\'s hat', slot: 'hat', colour: 0x8a6a3c, style: 'ranger' },
  { id: 'hat-garnet', name: 'Garnet beanie', slot: 'hat', colour: 0x8f1d2c, style: 'beanie' },
  { id: 'hat-cap', name: 'Conductor\'s cap', slot: 'hat', colour: 0x1f2a3a, style: 'cap' },
  { id: 'hat-rainbow', name: 'Pip\'s ninth hat', slot: 'hat', colour: 0xf0d040, style: 'beanie' },
  { id: 'hat-lamp', name: 'Miner\'s lamp', slot: 'hat', colour: 0xd9a441, style: 'lamp' },
];

export const gearById = (id: string): Gear | undefined => GEAR.find((g) => g.id === id);
export const DEFAULT_GEAR = { hat: 'hat-blue', jacket: 'jacket-red' };
