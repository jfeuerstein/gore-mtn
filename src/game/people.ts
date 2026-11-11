import type { Season } from '../look/season';
import type { Features } from '../player/skier';

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
  /** `aside` is metres to the east of the door, for when someone else is already standing there. */
  | { place: string; aside?: number }
  | { spot: string }
  /** `along` is how far up the lift line, 0..1; the foot of the lift if not given. */
  | { lift: string; along?: number }
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
  /** Not everyone is a person: a noticeboard is read, a dog or a cat is petted, and a snowman is, well, talked to. A person if not given. */
  kind?: 'person' | 'board' | 'dog' | 'cat' | 'snowman';
  /** Something that stands beside them: the groomer's snowcat, the patroller's sled. */
  prop?: 'snowcat' | 'sled';
  /** A few words on who they are, shown under the name. */
  role: string;
  at: Whereabouts;
  /** What they wear: jacket, trousers and hat colours, and the style of hat. */
  look: { jacket: number; trousers: number; hat: number; style: string; features?: Features };
  /** Said on first meeting, and after that one of these, by season or any time. */
  hello: string;
  chat: readonly string[];
  seasonal?: Partial<Record<Season, readonly string[]>>;
  /** Said, in place of small talk, when the weather or the hour calls for it. */
  moods?: Partial<Record<Mood, readonly string[]>>;
  /** Said once a day, in place of small talk, when the player turns up wearing a certain hat or jacket (by gear id). */
  wearing?: Record<string, string>;
}

/** Something about the moment that people remark on. */
export type Mood = 'snowing' | 'raining' | 'night' | 'dawn' | 'dusk';

export const PEOPLE: readonly Person[] = [
  {
    id: 'hazel',
    name: 'Hazel',
    role: 'Ski patrol, Base Lodge',
    at: { place: 'base-lodge' },
    look: { jacket: 0xc8281e, trousers: 0x1f242e, hat: 0xc8281e, style: 'beanie', features: { hair: 0x7a4a2a, hairStyle: 'braid', cross: true } },
    wearing: {
      'jacket-patrol': 'Patrol red. People will ask you for directions now. Point uphill and look confident.',
    },
    hello: 'First day? The mountain is all yours. Nobody is keeping score, least of all me.',
    chat: [
      'The gondola goes to Bear Mountain, the Express to the Saddle. Either way is down from there.',
      'If you meet a tree, it wins. Gently. You will be fine.',
      'Tap the Book now and then. It is nice to see it fill up.',
      'Lost something? Everything turns up at the Base Lodge in the end. Gloves, goggles, husbands.',
      'People ask which trail is best. Whichever one you are smiling on.',
      'I have swept this mountain a thousand times. It has never once been the same mountain.',
    ],
    moods: {
      snowing: ['It is dumping. Go. Why are you talking to me? Go.'],
      dusk: ['Last chair soon. The light on Bear Mountain goes pink for about four minutes. Do not miss it.'],
      night: ['Mountain is yours at night. Mind the groomers. They cannot hear you over the radio and the radio is always country.'],
    },
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
    look: { jacket: 0x2b62c9, trousers: 0x3a3430, hat: 0xd9a441, style: 'trapper', features: { moustache: 0xe8e4dc, hair: 0xe8e4dc, girth: 1.08 } },
    wearing: {
      'hat-trapper': 'My spare hat! It suits you. It suited me more. But it suits you.',
      'jacket-liftie': 'The blue! Welcome to the brotherhood. We meet on Tuesdays. We do not meet on Tuesdays. There are no meetings.',
    },
    hello: 'Otto. I load chairs. Forty years, never dropped a skier. Dropped a sandwich once.',
    chat: [
      'Fourteen lifts on this hill, counting the carpets. I have ridden every one. Have you?',
      'You can see a lot of wildlife from a chair. They do not mind the lift. They mind you.',
      'I watched your last run. Seven out of ten. The seven is for enthusiasm.',
      'A chair comes round every nine seconds. I have counted. It is all I have counted.',
      'People wave from the chair. I wave back. That is the whole job, when you think about it.',
      'The gondola people think they are better than us. They have doors. That is all it is. Doors.',
    ],
    moods: {
      snowing: ['Snow on the seats. I sweep them. You sit in it anyway. Circle of life.'],
      night: ['Lift is stopped. I am only here because it is quiet and the shack has a heater.'],
      dawn: ['First chair. Best chair. Nobody on it but the two of us and you are not even on it yet.'],
      raining: ['Rain. Chairs are wet. I have a towel. It is also wet.'],
    },
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
    look: { jacket: 0xf4f1ea, trousers: 0x2b3a55, hat: 0xf4f1ea, style: 'toque', features: { beard: 0x5a4636, apron: 0xb53a2a, girth: 1.15 } },
    wearing: {
      'hat-toque': 'A cook\'s hat on the hill. If anyone asks, the special is chili. It is always chili.',
    },
    hello: 'Welcome to the Saddle. Chili is on. Chili is always on.',
    chat: [
      'Best view on the mountain is out that window. Second best is the chili.',
      'Everything up here comes up on a snowcat or a chairlift. Including me.',
      'People ski four miles for this chili and then ask what is in it. Beans. Mountain. Time.',
      'I ring the bell when the cornbread comes out. Nobody has ever heard it. The wind takes it.',
      'Biscuit gets one sausage a day. He gets it from six different people. I have stopped counting.',
    ],
    moods: {
      snowing: ['Storm days I sell twice the chili. I do not make it any faster. People wait. It is good for them.'],
      dusk: ['Kitchen closes when the light goes. The pot does not. Help yourself, bowl is on the hook.'],
      night: ['You are up late. So is the chili. It gets better after dark, like most of us.'],
    },
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
    look: { jacket: 0x4f7a3f, trousers: 0x5a4a3a, hat: 0x8a6a3c, style: 'ranger', features: { hair: 0x9a9aa0, hairStyle: 'long', glasses: true } },
    wearing: {
      'hat-ranger': 'The observer\'s hat. Careful. You start to see smoke everywhere. It is nearly always fog.',
    },
    hello: 'You made it to the top. Sixty miles of Adirondacks, and on a clear day, Vermont.',
    chat: [
      'Ravens ride the updraft off the east face. I have names for all of them. They have names for me.',
      'The whole mountain is hardwood low down and spruce up here. In fall you can see the line.',
      'What you see depends on the hour. Dawn and dusk belong to the deer and the fox.',
      'People think it is lonely up here. I have forty ravens, a marten and a radio. I am oversubscribed.',
      'I log the weather four times a day. Mostly I write "sky". It is usually right.',
      'On a still morning you can hear the Snow Train from up here. It sounds like someone remembering something.',
    ],
    moods: {
      snowing: ['Cannot see a thing. The tower is very good for that: you get to not see much further.'],
      dawn: ['Sun comes up over Vermont and lands here first. I have the earliest morning in the county.'],
      dusk: ['The lights come on in North Creek one by one. I count them. Somebody always forgets the porch.'],
      night: ['Clear night, you can read by the stars. Cloudy night, you can hear the owls arguing.'],
    },
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
    look: { jacket: 0x7a4fa3, trousers: 0x3a3430, hat: 0x8f1d2c, style: 'beanie', features: { glasses: true, hair: 0x3a2e26, hairStyle: 'curls' } },
    wearing: {
      'jacket-garnet': 'Garnet red. From across the lot you look like an almandine with legs. That is a compliment in this shop.',
    },
    hello: 'Ah, a collector! This mountain is a billion years of garnet and I intend to see all of it.',
    chat: [
      'Garnets here grow as big as a basketball. Most of mine are the size of a pea. One lives in hope.',
      'A new scatter of stones lies out every day. Frost and groomers bring them up.',
      'The rare ones keep off the trails: bare rock for labradorite, deep woods for wollastonite.',
      'They mined garnet on this mountain from 1878. Sandpaper, mostly. Imagine: a mountain of gems, for sandpaper.',
      'Labradorite flashes blue if you turn it just so. I have stood in a car park turning a rock for an hour. No regrets.',
      'People ask what the big garnet out front is worth. To me? The shop. To anyone else, a very heavy doorstop.',
    ],
    moods: {
      raining: ['Rain! Wet stones show their colours. Best collecting weather there is. Nobody believes me.'],
      snowing: ['Snow hides the stones and the groomers find them again. It is a partnership. They do not know about it.'],
      night: ['Garnet does not glow in the dark. I have checked. More than once. Still worth checking.'],
    },
  },
  {
    id: 'bea',
    name: 'Conductor Bea',
    role: 'The Snow Train, North Creek depot',
    at: { place: 'depot' },
    look: { jacket: 0x1f2a3a, trousers: 0x1f2a3a, hat: 0x1f2a3a, style: 'cap', features: { hair: 0x8a8f9c, hairStyle: 'bun', buttons: true } },
    wearing: {
      'hat-cap': 'A conductor\'s cap. Very smart. Do not shout "all aboard". That one is mine. Shout something else.',
    },
    hello: 'All aboard, or nearly. The first ski trains pulled in right here in 1934. Mine goes somewhere stranger.',
    chat: [
      'Ride up, slide down. That was the slogan. Still good advice.',
      'The Snow Train does not go to other places. It goes to other seasons.',
      'Whatever season you ride to, the mountain waits for you there until you ride home.',
      'The timetable says we leave "when ready". We have never yet been late.',
      'I punch every ticket myself. There are no tickets. I punch the air. It is the principle.',
      'The engine is older than the mountain road. She runs on coal, snow and compliments.',
    ],
    moods: {
      snowing: ['Snow on the line. That is not a delay. That is the whole point of the train.'],
      night: ['Night train. Same seats, better windows.'],
      dawn: ['First train of the day. The seats are cold and the coffee is not. Board whenever you like.'],
    },
  },
  {
    id: 'june',
    name: 'June',
    role: 'Baker, the café on Main Street',
    at: { road: 'Main Street', from: 'depot', metres: 170 },
    look: { jacket: 0xe8b040, trousers: 0x4a3a2e, hat: 0xf4ead8, style: 'beanie', features: { hair: 0xc8642d, hairStyle: 'bun', apron: 0xfffdf7 } },
    wearing: {
      'hat-toque': 'A toque! If you are after my job, the oven goes on at four in the morning. Still after it?',
    },
    hello: 'Morning! Or whatever it is. Scones are out of the oven, and so am I for five minutes.',
    chat: [
      'Half the town skis and the other half feeds them. I do a bit of both.',
      'The turkeys cross Main Street at ten every morning. You could set the depot clock by them.',
      'I name the sourdough starter every year. This one is Gerald. No relation.',
      'Walt and I have a feud. It is about napkins. It is in its ninth year.',
      'If the light is on, the oven is on. If the oven is on, come in. That is the whole sign.',
    ],
    moods: {
      snowing: ['Snow day! I bake double and the plough driver gets first pick. That is how you get a clear street.'],
      dawn: ['You are up with the bakers. There are two of us in this town and the other one is the oven.'],
      night: ['Closed. Sort of. I am just proving tomorrow. Try the door, it sticks.'],
      raining: ['Rain keeps people indoors, and indoors has scones in it. I do not mind the rain.'],
    },
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
    look: { jacket: 0x3f8f5a, trousers: 0x2b3a55, hat: 0xf4f1ea, style: 'cap', features: { moustache: 0x3a2e26, apron: 0xf4f1ea, girth: 1.12 } },
    hello: 'Welcome to the deli. Everything on the board is named after a trail. Order a Rumor and see what you get.',
    chat: [
      'The Hudson starts as a pond up on Marcy. By the time it gets here it has opinions.',
      'An eagle fishes the river behind the depot most mornings. Better at it than I am.',
      'The secret to a good sandwich is the bread. The secret to the bread is June. Do not tell her I said so.',
      'I once made a sandwich so tall a man took it up the gondola to eat it from the top down.',
      'People come off the mountain hungry enough to eat the menu. I laminated it. You learn.',
      'Napkins go on the left. June says the right. This is why we do not speak in March.',
    ],
    moods: {
      snowing: ['Powder day. I will sell forty sandwiches at eleven and none at twelve, because everybody is back up the hill.'],
      night: ['Kitchen is closed but I can do you a cold Rumor. They are better cold. Everyone says so who has not had one hot.'],
      raining: ['Soup weather. I do not make soup. I just like to say it.'],
    },
  },
  {
    id: 'pip',
    name: 'Pip',
    role: 'Aged nine, Ski Bowl',
    at: { place: 'ski-bowl-lodge' },
    look: { jacket: 0xe86aa0, trousers: 0x3f6fb5, hat: 0xf0d040, style: 'beanie', features: { hair: 0xe2b94a, hairStyle: 'long', height: 0.68, girth: 0.8 } },
    wearing: {
      'hat-rainbow': 'That is hat number NINE. I am on hat number fourteen now. Keep up.',
    },
    hello: 'Hi! I am Pip. I am not lost. I know exactly where I am. It is my stuff that is lost.',
    chat: [
      'Somebody keeps building snowmen all over the mountain. Nobody knows who. Definitely nobody.',
      'My record down the Ski Bowl is one minute. I did not time it but it felt like one minute.',
      'There is a monster on The Rumor. My cousin saw it. My cousin also says he can fly.',
      'I am going to ski every trail before I am ten. I have done three. I am nine and a half. It is fine.',
      'Tom is my friend. He does not say much to grown-ups. He says LOADS to me.',
      'I found a rock shaped like a potato. Dr. Mica says it is a rock. I say it is a potato rock.',
    ],
    moods: {
      snowing: ['IT IS SNOWING. I am catching it. I have caught nine. Wait. Eight. One melted.'],
      dusk: ['I have to go in when the lamps come on. They are not on yet. That one does not count.'],
      night: ['I am allowed to be up. I asked. I asked the dog.'],
    },
  },
  {
    id: 'amos',
    name: 'Amos',
    role: 'Retired miner, the old garnet quarry',
    at: { spot: 'garnet-quarry' },
    look: { jacket: 0x8a6a3c, trousers: 0x3a3430, hat: 0xd9a441, style: 'lamp', features: { beard: 0xe8e4dc, hair: 0xe8e4dc } },
    wearing: {
      'hat-lamp': 'My old lamp. Still lit, I see. Those are the batteries from 1994. Do not ask me how.',
    },
    hello: 'Do not mind me. I worked this pit thirty years and I like to come and look at it.',
    chat: [
      'The best garnet on Earth for grinding came out of this hole. Hard as sin and sharp when it breaks.',
      'There is more garnet lying about up here than anywhere on the hill. We were never tidy.',
      'Now and then you find one clear right through. Gem garnet. I found four in thirty years.',
      'We called the big crystals "plums". You would crack a boulder and there would be a plum the size of your head.',
      'The mine moved over to Ruby Mountain in the eighties. Same garnet. Worse view.',
      'Quiet now. Used to be you could not hear yourself think up here. Turns out I was not thinking much.',
    ],
    moods: {
      dusk: ['This time of day the whole pit goes red. Sun on the garnet. We used to stop work to look. Foreman too.'],
      snowing: ['Snow fills the pit level, like it was never dug. Come spring it remembers.'],
      night: ['My lamp would have been the only light for a mile, once. Now look at the town down there.'],
    },
  },
  {
    id: 'dot',
    name: 'Dot',
    role: 'Postmaster, North Creek Post Office',
    at: { spot: 'north-creek-post-office' },
    look: { jacket: 0x3f6fb5, trousers: 0x1f2a3a, hat: 0x1f2a3a, style: 'cap', features: { glasses: true, hair: 0xb9b4ac, hairStyle: 'bun', buttons: true } },
    wearing: {
      'hat-cap': 'A uniform cap. If you are from the head office, the stamps are all accounted for. Mostly.',
    },
    hello: 'Neither snow nor rain nor gloom of night. Fog, though. Fog I take personally. I am Dot. Your mail comes here.',
    chat: [
      'One letter a day, that is the rule. Any more and people stop reading them.',
      'Somebody on this mountain writes entirely in capital letters. I will not say who. She is nine.',
      'A postcard from every landmark and you would have quite an album. I am just saying.',
      'The dog at the Saddle Lodge gets more mail than the mayor.',
    ],
    moods: {
      snowing: ['Snow day. The mail still goes. The mail always goes. I just go slower.'],
      night: ['Post office is shut, technically. I am only standing here out of habit.'],
    },
  },
  {
    id: 'marge',
    name: 'Marge',
    role: 'Innkeeper, the Copperfield Inn',
    at: { spot: 'copperfield-inn' },
    look: { jacket: 0x9a4f6a, trousers: 0x3a3430, hat: 0xe8d9ae, style: 'beanie', features: { hair: 0x8f4a3a, hairStyle: 'curls', apron: 0x3a2e26 } },
    wearing: {
      'hat-tophat': 'A top hat, in my lobby. At last, somebody dressed for the wallpaper.',
    },
    hello: 'Forty beds, one of me. Sit anywhere. I hear everything in this town, usually before it happens.',
    chat: [
      'Half of what I hear is nonsense. The trick is that I never know which half.',
      'President Roosevelt came through this depot in 1901, in the middle of the night. Did not stay here. I would have remembered.',
      'A guest once asked for a room with a view of the summit. Every room has one. That is the trouble with mountains.',
      'Forty beds, one of me. I have a system. The system is that I do not sit down.',
      'Somebody checked in as "Tom" last winter and left a puddle. I have my suspicions.',
      'The piano in the lobby has not been tuned since the snow trains. It plays one song, and it is not the one you ask for.',
    ],
    moods: {
      snowing: ['Snowed in is my favourite kind of full. Nobody checks out and everybody wants cocoa.'],
      night: ['The lobby fire is lit till midnight. After that it is lit by whoever cannot sleep.'],
      dusk: ['Lamps are coming on along Main Street. I turn ours on last. Let them wait for it.'],
    },
  },
  {
    id: 'fenn',
    name: 'Mr. Fennimore',
    role: 'Librarian, Town of Johnsburg Library',
    at: { spot: 'town-of-johnsburg-library' },
    look: { jacket: 0x6b5a48, trousers: 0x3a3430, hat: 0x8a6a3c, style: 'ranger', features: { glasses: true, beard: 0x8a8f9c, height: 1.06, girth: 0.92 } },
    hello: 'Shh. Oh, we are outside. Force of habit. Welcome. Ask me anything about this town. I have read all of it.',
    chat: [
      'The first ski train pulled into North Creek in March of 1934, from Schenectady, with hundreds aboard. Ride up, slide down.',
      'Henry Barton started mining garnet on Gore in 1878. Not for jewels. For sandpaper. The hardest garnet in the world, and it sands furniture.',
      'In September 1901, Theodore Roosevelt reached our depot before dawn and learned there that he was President.',
      'Gore opened as a state ski centre in 1964, and put up the first gondola in New York State three years later.',
      'In 1934 skiers rode up the mountain road in the backs of trucks and skied down to the village. The Ski Bowl got its rope tow the year after.',
      'The steel fire tower on the summit went up in 1918. The observers who kept watch from it could see a campfire twenty miles off.',
      'The Hudson is small here. A couple of hundred miles on, it is the harbour of New York. Hard to credit, looking at it.',
      'Garnet is the state gem of New York, and the big ones came from this mountain. I keep one on the returns desk. People return it.',
      'They ran log drives down the Hudson past here every spring until 1950. The whole river, bank to bank, nothing but logs.',
      'The Adirondack Park is bigger than Yellowstone, Yosemite, Glacier, the Grand Canyon and the Great Smokies put together. I checked.',
    ],
  },
  {
    id: 'notices',
    name: 'the noticeboard',
    kind: 'board',
    role: 'Outside the Town Hall',
    at: { spot: 'johnsburg-town-hall' },
    look: { jacket: 0x8a6a3c, trousers: 0x8a6a3c, hat: 0x8a6a3c, style: 'beanie' },
    hello: 'NOTICE. Whoever is building snowmen on Main Street: the Town thanks you, and asks you to stop putting hats on the fire hydrants.',
    chat: [
      'LOST: one yellow mitten, child\'s. FOUND: one yellow mitten, child\'s. These notices were pinned up a week apart by the same child.',
      'FOR SALE: skis, 210 cm, used once, 1974. Owner has reconsidered skiing.',
      'TOWN MEETING, Tuesday. Agenda: the bridge; the other bridge; whether the turkeys may be asked to use the crossing.',
      'REWARD for information about the large footprints behind the school. Reward is a pie. — Marge',
      'GARNET SOCIETY meets Thursday. All welcome. Please, somebody, come. — Dr. M.',
      'WANTED: lift attendant to cover Otto\'s day off. Position has been open since 1986.',
      'CHILI COOK-OFF results: 1st, Gus. 2nd, Gus (second pot). 3rd, a pot nobody will admit to.',
      'REMINDER: the Snow Train does not stop for photographs, cows, or second thoughts.',
    ],
  },
  {
    id: 'biscuit',
    name: 'Biscuit',
    kind: 'dog',
    role: 'Mountain dog, Saddle Lodge',
    at: { place: 'saddle-lodge', aside: 8 },
    look: { jacket: 0xc98f4f, trousers: 0xf4ead8, hat: 0x6b4a33, style: 'beanie' },
    wearing: {
      'hat-antlers': 'Biscuit barks once at your antlers, formally, and then forgives you.',
      'hat-tophat': 'Biscuit has never seen a top hat. He would like to carry it somewhere and bury it.',
    },
    hello: 'Biscuit looks at you, then at your pockets, then at you again. His tail goes round like a propeller.',
    chat: [
      'Biscuit leans his whole weight on your leg. This is now your afternoon.',
      'Biscuit rolls over. It is not a request. It is a schedule.',
      'Biscuit sneezes snow at you, delighted with himself.',
      'Biscuit brings you a stick. It is, on inspection, a ski pole. It is not yours.',
      'Biscuit sits on your boots so you cannot leave. He has thought this through.',
    ],
    moods: {
      snowing: ['Biscuit is trying to catch snowflakes. He has caught four. He is counting.'],
      night: ['Biscuit is asleep with one eye open, in case of sandwiches.'],
    },
  },
  {
    id: 'sven',
    name: 'Sven',
    role: 'Ski instructor, Bear Cub',
    at: { lift: 'Bear Cub' },
    look: { jacket: 0x2f8f55, trousers: 0x1f242e, hat: 0xf4f1ea, style: 'beanie', features: { beard: 0xe2c66a, hair: 0xe2c66a, height: 1.08 } },
    wearing: {
      'hat-helmet': 'A helmet! Very good. Now you may fall over with confidence.',
    },
    hello: 'Pizza! French fries! Pizza! That is the whole lesson. Everything after that is confidence. I am Sven.',
    chat: [
      'Bend the knees. No, more. No, less. Perfect. Do not ask me what you did.',
      'The mountain does not care how you look. That is the best thing about it.',
      'I have taught four thousand people to stop. A few of them are still stopping.',
      'If you fall, you are learning. If you fall a lot, you are learning a lot. I tell the children this. Also the adults.',
    ],
    seasonal: {
      summer: ['No snow, so I teach mountain biking. Same lesson. Pizza does not apply. I say it anyway.'],
      spring: ['Spring snow! Like skiing on mashed potatoes. I mean that as praise.'],
    },
  },
  {
    id: 'bram',
    name: 'Bram',
    role: 'Groomer, Base Lodge',
    prop: 'snowcat',
    at: { place: 'gore-mountain-lodge' },
    look: { jacket: 0xd9822b, trousers: 0x3a3430, hat: 0x1f242e, style: 'trapper', features: { beard: 0x3a3430, girth: 1.1 } },
    wearing: {
      'jacket-groomer': 'Orange. Now the plough can see you. So can everybody else. Sorry about that.',
    },
    hello: 'I drive the cat. Not a cat. The cat. Twelve tons, tracks, big comb on the back. I make the corduroy while you sleep.',
    chat: [
      'People think the snow just lies like that. It does not. I comb it. Every night. Like a very large, very cold horse.',
      'Stones come up when I groom. Garnets, mostly. I used to stop for them. Now I leave them for whoever is up first.',
      'I see things up there at three in the morning. Deer. Foxes. Once, something tall. I do not discuss the tall thing.',
      'Best run on the mountain is whichever I did last. Ask me tomorrow, different answer.',
    ],
    moods: {
      night: ['Should be up on the hill by now. Just finishing my coffee. Do not tell Hazel.'],
      snowing: ['Fresh snow on top of fresh corduroy. I should be annoyed. I am not.'],
    },
  },
  {
    id: 'tom',
    name: 'Tom',
    kind: 'snowman',
    role: 'Snowman (winters). Scarecrow (summers).',
    at: { place: 'ski-bowl-lodge', aside: -15 },
    look: { jacket: 0xf4f6fa, trousers: 0xf4f6fa, hat: 0x22262d, style: 'tophat' },
    wearing: {
      'hat-tophat': 'That is my spare hat. On your head. I have decided to be flattered.',
    },
    hello: 'Hello. I am Tom. I am a snowman, professionally. Please do not look at the carrot. It is rude.',
    chat: [
      'I have stood here since the first snow. I have seen things. Mostly the same things.',
      'People ask if I get cold. I ask if they get warm. Nobody enjoys the conversation.',
      'A dog visited on Tuesday. I would rather not talk about it.',
      'I am told there is a mountain behind me. I have never been able to check.',
    ],
    seasonal: {
      spring: ['I am not melting. I am travelling light.', 'By May I will be mostly hat. It is a very good hat.'],
      summer: [
        'Summer job. Scarecrow. The crows and I have an understanding: they understand, and I stand.',
        'Same scarf. Different everything else. Let us not make it strange.',
      ],
      fall: [
        'The leaves get all the attention in the fall. Nobody is scared of me, and everybody is impressed by them.',
        'First frost any night now. I can feel it in my. Well. I can feel it.',
      ],
    },
    moods: {
      snowing: ['Ah. Reinforcements.'],
      raining: ['Rain. My natural predator.'],
      night: ['I do not sleep. I wait.'],
      dawn: ['Sunrise. Lovely. Terrifying. Lovely.'],
    },
  },
  {
    id: 'flurry',
    name: 'Madame Flurry',
    role: 'Weather prophet, the warming hut',
    at: { place: 'warming-hut' },
    look: { jacket: 0x6a3f8f, trousers: 0x3a2a4a, hat: 0xd9a441, style: 'beanie', features: { hair: 0xb9b4ac, hairStyle: 'curls', shawl: 0x8a5a2c, height: 0.94 } },
    wearing: {
      'hat-propeller': 'Is it turning? Then the wind has changed, or you have moved. The science is very exact.',
    },
    hello: 'Sit. Or stand, there are no chairs. I am Madame Flurry. I foretell the weather. Usually afterwards.',
    chat: [
      'I see a mountain. You are on it. The mists clear. That will be five dollars. I am joking. There is no money here, I have looked.',
      'My forecasts are right four times in ten. The television does no better, and the television has no shawl.',
      'The spirits say the snow will be "packed powder". The spirits always say "packed powder".',
      'Ask me about tomorrow. No, do not. Tomorrow I will tell you about today, and I will be right.',
    ],
    seasonal: {
      summer: ['I foresee a warm spell. Lasting, oh, until September.'],
      fall: ['The leaves will fall. You may hold me to that.'],
      spring: ['Mud. I see mud. I did not need the gift for that one.'],
    },
    moods: {
      snowing: ['I foresaw this snow. Not out loud. But I foresaw it.'],
      raining: ['Rain. I predicted "weather", and here it is. I stand by my work.'],
      night: ['The stars are out, or they would be. Either way: clear, or cloudy. Mark my words.'],
      dawn: ['Red sky at morning. Sailors take warning. Skiers take the gondola.'],
      dusk: ['The sun is going down in the west. I called that one years ago.'],
    },
  },
  {
    id: 'ivy',
    name: 'Ivy',
    role: 'Ski patrol, top of the gondola',
    prop: 'sled',
    at: { lift: 'Northwoods Gondola', along: 0.985 },
    look: { jacket: 0xc8281e, trousers: 0x1f242e, hat: 0xc8281e, style: 'helmet', features: { hair: 0x2a2420, hairStyle: 'braid', cross: true } },
    wearing: {
      'hat-helmet': 'Helmet on. Good. Now you look as if you know where the first aid room is. Do you? Nobody does.',
      'jacket-patrol': 'Two of us in red. If anybody falls over, we look at each other, and then you go.',
    },
    hello: 'Ski patrol. Ivy. Nothing is wrong. I just stand like this.',
    chat: [
      'Know the code: whoever is ahead of you has the right of way. So do the trees. The trees always win.',
      'I carry forty pounds of gear and a thermos. The thermos has saved more lives.',
      'There are no accidents on this mountain. There are bumps, and there are lessons.',
      'If you hit a tree, say sorry to it. That is not policy. It is just manners.',
    ],
    seasonal: {
      summer: ['Bike patrol in summer. Same sled. It has wheels now. Nobody asked for the wheels.'],
    },
    moods: {
      snowing: ['Visibility is low. Keep your tips up and your expectations medium.'],
      dusk: ['Last sweep soon. We ski every trail to see nobody is still out. Best part of the job. Tell no one.'],
      night: ['Mountain is closed. I am not here. You did not see me. Neither of us saw the groomer.'],
    },
  },
  {
    id: 'pickles',
    name: 'Mayor Pickles',
    kind: 'cat',
    role: 'Mayor of North Creek (a cat)',
    at: { spot: 'johnsburg-town-hall' },
    look: { jacket: 0xd9822b, trousers: 0xf4ead8, hat: 0xd9822b, style: 'beanie' },
    wearing: {
      'hat-antlers': '(The Mayor looks at your antlers for a long time. The Mayor has seen a deer. You are not fooling the Mayor.)',
      'hat-tophat': '(The Mayor considers your top hat a challenge to the office, and narrows one eye.)',
    },
    hello: 'Mrrp. (The Mayor of North Creek regards you. You have been entered in the minutes.)',
    chat: [
      '(The Mayor is in session. The session consists of sitting.)',
      '(The Mayor votes in favour of the sunbeam. The motion carries.)',
      '(You are granted an audience. It lasts four seconds. This is generous.)',
      '(The Mayor has no comment on the bird situation at this time.)',
      '(The Mayor permits one scratch behind the left ear. The right ear is under review.)',
    ],
    moods: {
      snowing: ['(The Mayor disapproves of the snow, and has asked that it be stopped.)'],
      raining: ['(The Mayor is indoors in spirit.)'],
      night: ['(The Mayor works nights. Nobody knows on what.)'],
    },
  },
];

/**
 * The town round: the doors in North Creek worth knocking on every day. Calling at all of them
 * in one day is a round, and rounds are counted.
 */
export const TOWN_ROUND: readonly { who: string; door: string }[] = [
  { who: 'dot', door: 'Post office' },
  { who: 'marge', door: 'Inn' },
  { who: 'june', door: 'Bakery' },
  { who: 'walt', door: 'Deli' },
  { who: 'fenn', door: 'Library' },
];

/** The verb on the button for approaching each kind of thing. */
export const APPROACH: Record<NonNullable<Person['kind']>, string> = { person: 'Talk to', board: 'Read', dog: 'Pet', cat: 'Pet', snowman: 'Talk to' };

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
    lost: { name: 'A small yellow mitten', at: { lift: 'Hudson Chair', along: 0.45 } },
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
  // Bram: the corduroy, and a bump called Gerald.
  {
    id: 'corduroy',
    from: 'bram',
    title: 'Corduroy critic',
    ask: 'Do something for me. Ski six trails, top to bottom, and come and tell me the corduroy held. Nobody ever tells me.',
    nudge: 'Six trails stamped in the passport. I combed all of them. Take your pick.',
    need: { kind: 'trails', count: 6 },
    thanks: 'It held? Of course it held. Still. Nice to hear it said. Here, groomers wear orange so the plough sees us.',
    reward: { gear: 'jacket-groomer' },
  },
  {
    id: 'gerald',
    from: 'bram',
    title: 'Meet Gerald',
    ask: 'There is a bump on Twister I cannot flatten. Eleven winters I have tried. I call him Gerald. Go and ski Twister and give him my regards.',
    nudge: 'Twister, top to bottom. You will know Gerald when you meet him.',
    need: { kind: 'trail', name: 'Twister' },
    thanks: 'You met him, then. Big fellow, about halfway down, no manners? That is Gerald. He will outlive us all.',
    after: 'corduroy',
  },
  // Tom: a hat, gone with the wind.
  {
    id: 'toms-hat',
    from: 'tom',
    title: 'A hat at large',
    ask: 'My good hat blew off toward the Village Chair. I would go after it, but you see how things are with me. It is a top hat. It is not a subtle hat.',
    nudge: 'A top hat, somewhere under the Village Chair. I would point, but. Twigs.',
    need: { kind: 'item', id: 'tophat' },
    lost: { name: 'A top hat, full of snow', at: { lift: 'Village Chair', along: 0.55 } },
    thanks: 'My hat! Oh, that is better. A person feels undressed. Keep the spare. No, I insist. I cannot nod, but imagine that I am nodding.',
    reward: { gear: 'hat-tophat' },
  },
  // Madame Flurry: a reading of the seasons.
  {
    id: 'two-seasons',
    from: 'flurry',
    title: 'A second opinion',
    ask: 'The spirits are vague about summer. Go and look at this mountain in two different seasons and tell me what you saw. Conductor Bea can arrange the travel.',
    nudge: 'Two seasons seen. The Snow Train at the depot goes to all four, once you hold a pass.',
    need: { kind: 'seasons', count: 2 },
    thanks: 'Green? In summer? I knew it. I knew it the moment you told me. Take this. It turns when the wind changes, or when you walk.',
    reward: { gear: 'hat-propeller' },
  },
  // Ivy: a thermos, and a sweep.
  {
    id: 'thermos',
    from: 'ivy',
    title: 'The thermos',
    ask: 'I left my thermos up by the fire tower on the summit. It is green and it is the most important piece of rescue equipment I own.',
    nudge: 'A green thermos, by the fire tower at the very top.',
    need: { kind: 'item', id: 'thermos' },
    lost: { name: 'A green thermos, still warm', at: { place: 'summit', aside: 7 } },
    thanks: 'Still warm. That is either very good insulation or very bad news. Thank you. Patrol looks after its own: take a helmet.',
    reward: { gear: 'hat-helmet' },
  },
  {
    id: 'sweep',
    from: 'ivy',
    title: 'Last sweep',
    ask: 'Help me sweep. Twelve trails, top to bottom, any twelve, and call out if you find anybody. You will not. But call out. It is fun.',
    nudge: 'Twelve trails stamped. Shout "sweep" if you like. I do.',
    need: { kind: 'trails', count: 12 },
    thanks: 'Twelve trails and nobody left behind. That is a clean sweep. You would make a decent patroller. I do not say that. I have just said it.',
    after: 'thermos',
  },
  // The Mayor's census, posted on the board and reported to the Mayor in person.
  {
    id: 'census',
    from: 'notices',
    to: 'pickles',
    title: "The Mayor's census",
    ask: 'CENSUS. By order of the Mayor, all residents with feathers, fur or leaves are to be counted. Fifteen kinds will do. Report to the Mayor in person. The Mayor is the orange one.',
    nudge: 'Fifteen kinds in the field guide, then see the Mayor outside the Town Hall.',
    need: { kind: 'speciesCount', count: 15 },
    thanks: '(The Mayor inspects your field guide for some time, and then sits on it. This is the highest honour the town can bestow. There are also antlers.)',
    reward: { gear: 'hat-antlers' },
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
  { id: 'jacket-groomer', name: 'Groomer\'s orange', slot: 'jacket', colour: 0xe8742a },
  { id: 'hat-tophat', name: 'Tom\'s spare top hat', slot: 'hat', colour: 0x22262d, style: 'tophat' },
  { id: 'hat-propeller', name: 'Weather vane beanie', slot: 'hat', colour: 0x6a3f8f, style: 'propeller' },
  { id: 'hat-helmet', name: 'Patrol helmet', slot: 'hat', colour: 0xc8281e, style: 'helmet' },
  { id: 'hat-antlers', name: 'Honorary antlers', slot: 'hat', colour: 0x8a6a3c, style: 'antlers' },
];

export const gearById = (id: string): Gear | undefined => GEAR.find((g) => g.id === id);
export const DEFAULT_GEAR = { hat: 'hat-blue', jacket: 'jacket-red' };
