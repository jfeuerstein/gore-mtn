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
  /** What is said instead of `thanks` when the player already has the thing it would give. */
  thanksOwned?: string;
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
      'jacket-patrol': 'Hey, patrol red! Looks good.\nPeople might ask you for directions now. Sorry in advance.',
    },
    hello: "Oh, hi! First day?\nNo rush on anything. Nobody's keeping score up here.",
    chat: [
      "The gondola goes to Bear Mountain. The Express goes up to the Saddle.\nHonestly, you can't pick wrong.",
      "If you bump a tree you just kind of... bounce. It's fine.\nI've done it. Don't tell Ivy.",
      "Have you looked in your Book lately?\nI like watching mine fill up. It's a little thing, but still.",
      'Anything lost on this mountain ends up at the Ski Bowl lodge eventually. Mostly mittens.',
      'People always ask me which trail is the best one.\nI say Sunway, and then I feel bad for the others.',
      "I've skied this hill... I don't know. A lot.\nI still like the first run of the day best.",
    ],
    moods: {
      snowing: ["It's really coming down!\n...Why are you talking to me? Go ski!"],
      dusk: ['The light on Bear Mountain goes pink right about now.\nIt lasts maybe four minutes. I try to catch it.'],
      night: ["You're out late! That's allowed.\nWave at Bram if you see the snowcat. He likes that."],
    },
    seasonal: {
      winter: ["Bram groomed Sunway last night.\nIt's really, really good right now.", 'The snowcats turn stones up when they groom. Keep an eye out for anything shiny.'],
      spring: ["Stick to the white parts. Skis don't love mud.\n(I found that out the fun way.)"],
      summer: ["Bikes ride the lifts in the summer.\nThumb up to pedal, thumb down to brake. That's kind of it."],
      fall: ['The leaves are at their best for about a week.\nThis might be the week. I never know.'],
    },
  },
  {
    id: 'otto',
    name: 'Otto',
    role: 'Lift attendant, Adirondack Express',
    at: { lift: 'Adirondack Express' },
    look: { jacket: 0x2b62c9, trousers: 0x3a3430, hat: 0xd9a441, style: 'trapper', features: { moustache: 0xe8e4dc, hair: 0xe8e4dc, girth: 1.08 } },
    wearing: {
      'hat-fenn': 'Is that a library hat?\n...I gave the book back. You were there!',
      'hat-trapper': 'Hey, my spare hat! It looks good on you.\nBetter than it did on the hook, anyway.',
      'jacket-liftie': "The blue jacket! You're one of us now.\nThere's no meetings or anything. We just wave.",
    },
    hello: "Hi there. I'm Otto. I load the chairs.\nForty years, and I've never dropped anybody.\n...I did drop a sandwich once.",
    chat: [
      "There's fourteen lifts on this hill, if you count the carpets.\nI count the carpets.",
      "You see a lot of animals from the chair. They don't mind the lift.\nThey mind you a little. No offense.",
      "I watched your last run. Seven out of ten!\nThe seven's mostly for enthusiasm.",
      "People wave from the chair, and I wave back. That's the whole job, really. I like it.",
      "Can I tell you something? I've never actually skied.\nI keep meaning to. It's been a while now.",
      "The gondola folks think they're fancy because they've got doors.\n...The doors are pretty nice, though.",
    ],
    moods: {
      snowing: ["I sweep the snow off every seat, and then it snows on them again.\nI don't mind. It's nice out."],
      night: ["Lift's stopped for the night. I'm just here because the shack has a heater.\nAnd it's quiet."],
      dawn: ["First chair of the day! It's the best one.\nNobody's on it yet. Could be you."],
      raining: ["The seats are wet, sorry. I've got a towel.\n...The towel's wet too."],
    },
    seasonal: {
      winter: ['Cold today, huh? Good. Snow likes it cold.'],
      summer: ["Bikes hang off the back of the chair in the summer.\nDon't ask me how I get them on there. I barely know."],
    },
  },
  {
    id: 'gus',
    name: 'Gus',
    role: 'Cook, Saddle Lodge',
    at: { place: 'saddle-lodge' },
    look: { jacket: 0xf4f1ea, trousers: 0x2b3a55, hat: 0xf4f1ea, style: 'toque', features: { beard: 0x5a4636, apron: 0xb53a2a, girth: 1.15 } },
    wearing: {
      'hat-toque': "Nice hat! If anybody asks you what the special is, it's chili.\nIt's a pretty easy job that way.",
    },
    hello: "Oh, hey, come in! Well - we're outside. Come over, anyway.\nI'm Gus. There's chili on. There's always chili on.",
    chat: [
      'The best view on the mountain is out that window right there.\nI get to look at it while I stir.',
      'Everything up here comes up on a chairlift or a snowcat. The onions, the beans, me.',
      "People ask what's in the chili. It's mostly beans, honestly.\nBeans and a really long time.",
      "I'm working on a cornbread. It's not there yet.\nIt's close, though! Ask me next week.",
      "Biscuit's only supposed to get one sausage a day.\nI think he gets about six. Everybody thinks they're the only one.",
    ],
    moods: {
      snowing: ['On snowy days I go through twice as much chili.\nPeople come in with their eyelashes frozen. I love it.'],
      dusk: ["The kitchen's closing up, but the pot stays on.\nBowls are on the hook. Help yourself, really."],
      night: ["You're up late! So's the chili.\nIt's better on the second day anyway."],
    },
    seasonal: {
      summer: ["The blueberries are out on the ledges right now.\nI'm thinking pancakes. I'm always thinking pancakes."],
      fall: ["After it rains there's chanterelles under the hardwoods. Bright orange.\nYou can't miss them. Well - I miss them all the time. But you can't."],
      winter: ["Warm your hands up for a minute. The summit's colder than it looks from here."],
    },
  },
  {
    id: 'wren',
    name: 'Wren',
    role: 'Fire tower observer, Gore summit',
    at: { place: 'summit' },
    look: { jacket: 0x4f7a3f, trousers: 0x5a4a3a, hat: 0x8a6a3c, style: 'ranger', features: { hair: 0x9a9aa0, hairStyle: 'long', glasses: true } },
    wearing: {
      'hat-ranger': "Hey, that's an observer's hat! It suits you.\nFair warning - you start seeing smoke everywhere. It's nearly always fog.",
    },
    hello: "Oh! Hi. Sorry - I don't get a lot of visitors up here.\nI'm Wren. I watch for smoke. On a clear day you can see Vermont, if you want to look.",
    chat: [
      "The ravens ride the wind up the east face in the mornings.\nI've named most of them. I think they know.",
      "It's hardwoods down low and spruce up here.\nIn the fall you can see the line where it changes. I really like that line.",
      "You'll see different animals depending on when you're out.\nDeer and foxes like dawn and dusk. I do too, I guess.",
      "People ask if it gets lonely. A little, sometimes.\nBut there's the ravens, and the radio. And now you.",
      'I write the weather down four times a day.\nMostly I just put "sky." Nobody\'s complained yet.',
      "On a quiet morning you can hear the train all the way up here.\nI don't know why, but I always stop and listen.",
    ],
    moods: {
      snowing: ["Can't see a thing today. Not much of a lookout, huh.\nIt's cozy, though."],
      dawn: ["The sun comes up over Vermont and gets here first.\nI don't tell people that. I should. It's kind of the best part."],
      dusk: ["The lights in North Creek come on one at a time around now.\nI count them. It's a small town. It doesn't take long."],
      night: ['On a clear night you can almost read by the stars.\nOn a cloudy one you just get owls. Also good.'],
    },
    seasonal: {
      winter: ["The Canada jays will take a crust right out of your hand.\nThey'll take the whole sandwich too, if you let them. I've let them."],
      summer: ["There are fireflies down in the meadows at night.\nFrom up here it looks like... I don't know. It looks really nice."],
    },
  },
  {
    id: 'mica',
    name: 'Dr. Mica',
    role: 'Geologist, Gore Mt. Mineral Shop',
    at: { spot: 'gore-mt-mineral-shop' },
    look: { jacket: 0x7a4fa3, trousers: 0x3a3430, hat: 0x8f1d2c, style: 'beanie', features: { glasses: true, hair: 0x3a2e26, hairStyle: 'curls' } },
    wearing: {
      'jacket-garnet': "Garnet red! Oh, I love it.\nFrom across the lot you looked like a big almandine. That's a compliment here.",
    },
    hello: "Oh! Are you a collector? You look like a collector.\nI'm Mica. This whole mountain is full of garnet and I think about it a LOT.",
    chat: [
      'The garnets here can get as big as a basketball.\nMine are mostly more like... peas. But still!',
      'New stones turn up every single day. The frost pushes them up, and the groomers.\nI check every morning. Every morning!',
      "The rare ones aren't on the trails. Try bare rock for labradorite, and deep woods for wollastonite.\nSorry. Was that a lot? That was a lot.",
      "They started mining garnet here in 1878. For sandpaper!\nA whole mountain of gems, and they made sandpaper. I'm mostly over it.",
      'Labradorite flashes blue if you tilt it just right.\nI stood in the parking lot turning one for an hour once. It was a good hour.',
      "People ask what the big garnet out front is worth.\nI don't know! I'd never sell it. I'm not great at running a shop.",
    ],
    moods: {
      raining: ["Rain! Wet stones show their colors way better.\nIt's the best collecting weather. Nobody believes me, but it is."],
      snowing: ["The snow covers the stones up and the groomers dig them back out.\nIt's a team effort. They don't know they're on the team."],
      night: ["Garnets don't glow in the dark. I checked.\n...I checked a few times."],
    },
  },
  {
    id: 'bea',
    name: 'Conductor Bea',
    role: 'The Snow Train, North Creek depot',
    at: { place: 'depot' },
    look: { jacket: 0x1f2a3a, trousers: 0x1f2a3a, hat: 0x1f2a3a, style: 'cap', features: { hair: 0x8a8f9c, hairStyle: 'bun', buttons: true } },
    wearing: {
      'hat-cap': "A conductor's cap! Very sharp.\nJust don't yell \"all aboard.\" I've been practicing mine.",
    },
    hello: "Hello! You're right on time. Well - there's no schedule, so everybody is.\nI'm Bea. Ski trains have been pulling in here since 1934. Mine's a little different.",
    chat: [
      '"Ride up, slide down." That was the slogan back then. Still good advice.',
      "The Snow Train doesn't really go to other places. It goes to other seasons.\nI don't totally know how. I just do the tickets.",
      "Whatever season you ride to, it'll wait for you. I'll bring you home whenever you like.",
      'The timetable just says "when ready."\nWe\'ve never been late. It\'s hard to be.',
      'The very first snow train got put off for weeks. Not enough snow!\nThey kept mailing out postcards with a new date. I love that.',
      "I punch every ticket myself. There aren't any tickets.\nSo I sort of punch the air. It feels right.",
    ],
    moods: {
      snowing: ["Snow on the tracks! That's not a delay.\nThat's the whole idea."],
      night: ["The night train's my favorite. Same seats, better windows."],
      dawn: ["First train of the day. The seats are cold, but the coffee's hot.\nGet on whenever you're ready."],
    },
  },
  {
    id: 'june',
    name: 'June',
    role: "Baker, June's Bakery",
    at: { road: 'Main Street', from: 'depot', metres: 170 },
    look: { jacket: 0xe8b040, trousers: 0x4a3a2e, hat: 0xf4ead8, style: 'beanie', features: { hair: 0xc8642d, hairStyle: 'bun', apron: 0xfffdf7 } },
    wearing: {
      'hat-toque': "A baker's hat! Are you after my job?\nThe oven goes on at four in the morning. ...Still interested?",
    },
    hello: "Oh, hi! Good morning. Or... whatever it is. I've been up since four.\nI'm June. The scones just came out, if you want one.",
    chat: [
      'Half this town skis and the other half feeds them. I do a little of both.',
      "The turkeys cross Main Street around ten every morning.\nEverybody just waits. It's kind of nice.",
      "Walt and I have been arguing about napkins for nine years.\nIt's not a real fight. I am right, though.",
      "If my light's on, the oven's on, and you can come in.\nThat's the whole sign. I never got around to making a real one.",
      "I still get excited when the bread comes out. Every time.\nIs that weird? I don't think it's weird.",
    ],
    moods: {
      snowing: ["Snow day! I bake double, and the plow driver gets first pick.\nOur street's always clear. Funny how that works."],
      dawn: ["You're up early! It's usually just me and the oven at this hour.\nIt's a good time of day. Don't tell everyone."],
      night: ["I'm closed, kind of. I'm just getting tomorrow's dough going.\nThe door sticks - push hard."],
      raining: ["I don't mind the rain. People come in and stay a while.\nThe windows fog up. It's cozy."],
    },
    seasonal: {
      fall: ["The whole town smells like woodsmoke and cider donuts right now. Some of that's me."],
      winter: ["My snow day rule is first tracks, then breakfast. In that order.\nI'll save you something."],
    },
  },
  {
    id: 'walt',
    name: 'Walt',
    role: 'Sandwich maker, the deli on Main Street',
    at: { road: 'Main Street', from: 'depot', metres: 290 },
    look: { jacket: 0x3f8f5a, trousers: 0x2b3a55, hat: 0xf4f1ea, style: 'cap', features: { moustache: 0x3a2e26, apron: 0xf4f1ea, girth: 1.12 } },
    hello: "Hey, welcome in. I'm Walt.\nEvery sandwich on the board is named after a trail. I'd start with the Rumor.",
    chat: [
      "The Hudson starts out as a little pond, way up on Mount Marcy.\nHard to believe, looking at it here. I think about that a lot.",
      "There's an eagle that fishes behind the depot most mornings.\nIt's better at it than I am. I've made my peace with that.",
      "The secret to a good sandwich is the bread, and the bread is June's.\nPlease don't tell her I said so.",
      'Somebody took one of my sandwiches up the gondola once, just to eat it at the top.\nBest review I ever got.',
      "People come off the mountain SO hungry.\nI had to laminate the menus. I'm only sort of joking.",
      "Napkins go on the left. June says the right.\nWe've been at it nine years. I'd miss it if she gave in.",
    ],
    moods: {
      snowing: ["On a powder day I sell forty sandwiches at eleven and none at noon.\nEverybody's back up the hill. Good for them."],
      night: ["The kitchen's closed, but I could make you a cold Rumor.\nI think they're better cold, honestly."],
      raining: ["Grilled cheese weather.\nThat's the Peaceful Valley, on the board. I'm just saying."],
    },
  },
  {
    id: 'pip',
    name: 'Pip',
    role: 'Aged nine, Ski Bowl',
    at: { place: 'ski-bowl-lodge' },
    look: { jacket: 0xe86aa0, trousers: 0x3f6fb5, hat: 0xf0d040, style: 'beanie', features: { hair: 0xe2b94a, hairStyle: 'long', height: 0.68, girth: 0.8 } },
    wearing: {
      'hat-rainbow': "That's my hat! Number nine!\nI'm on number fourteen now. You can keep it.",
    },
    hello: "Hi! I'm Pip. I'm nine.\nI'm not lost. I know where I am! It's my STUFF that's lost.",
    chat: [
      "Somebody keeps building snowmen all over the mountain.\nNobody knows who. I definitely don't know who.",
      "My record down the Ski Bowl is one minute.\nI didn't time it. But it FELT like one minute.",
      "There's a monster on The Rumor. My cousin saw it.\nMy cousin also says he can fly, so. I don't know.",
      "I'm going to ski every trail before I turn ten. I've done three.\nI'm nine and a half. It's fine. It's FINE.",
      "Tom's my friend. He doesn't talk to grown-ups.\nHe tells me stuff and I write it down for him. It's a real job.",
      "I found a rock that looks like a potato.\nDr. Mica says it's just a rock. I think she's jealous.",
    ],
    moods: {
      snowing: ["IT'S SNOWING! I'm catching them. I've got nine.\nWait. Eight. One melted."],
      dusk: ["I have to go in when the lamps come on.\nThey're not on yet. That one doesn't count."],
      night: ["I'm allowed to be up. I asked.\n...I asked a dog."],
    },
  },
  {
    id: 'amos',
    name: 'Amos',
    role: 'Retired miner, the old garnet quarry',
    at: { spot: 'garnet-quarry' },
    look: { jacket: 0x8a6a3c, trousers: 0x3a3430, hat: 0xd9a441, style: 'lamp', features: { beard: 0xe8e4dc, hair: 0xe8e4dc } },
    wearing: {
      'hat-lamp': "That's my old lamp. Still works, huh?\nI haven't changed those batteries since '94. Don't ask me.",
    },
    hello: "Don't mind me. I worked this pit thirty years.\nNow I just like to come up and look at it.",
    chat: [
      "The best garnet in the world for grinding came out of this hole.\nHard, and it breaks sharp. That's what you want.",
      "There's more garnet lying around up here than anywhere on the hill. We weren't very tidy.",
      "Once in a long while you'd find one clear all the way through. Gem garnet.\nI found four in thirty years.",
      "We called the big crystals plums.\nYou'd crack a boulder open and there'd be one the size of your head.",
      "The mine moved over to Ruby Mountain in the eighties.\nSame garnet. The view's not as good.",
      "It's quiet up here now. Used to be so loud you couldn't think.\nI like it better this way. Took me a while to say so.",
    ],
    moods: {
      dusk: ['Around now the whole pit goes red. Sun on the garnet.\nWe used to stop work and look. Even the foreman.'],
      snowing: ["The snow fills the pit in level, like nobody ever dug here.\nIt'll all be back in the spring."],
      night: ['My lamp used to be the only light for a mile. Look at the town down there now.'],
    },
  },
  {
    id: 'dot',
    name: 'Dot',
    role: 'Postmaster, North Creek Post Office',
    at: { spot: 'north-creek-post-office' },
    look: { jacket: 0x3f6fb5, trousers: 0x1f2a3a, hat: 0x1f2a3a, style: 'cap', features: { glasses: true, hair: 0xb9b4ac, hairStyle: 'bun', buttons: true } },
    wearing: {
      'jacket-postal': 'The uniform! It looks great on you.\nDogs might chase you now. Sorry - it comes with the jacket.',
      'hat-cap': 'Oh - are you from the head office?\nThe stamps are all accounted for. ...Mostly.',
    },
    hello: "Oh, hello! You're new. I'm Dot - I run the post office.\nYour mail comes here now. I already set you up a box.",
    chat: [
      "It's one letter a day here. That's my rule.\nAny more than that and people stop reading them.",
      "Somebody on this mountain writes everything in capital letters.\nI won't say who. She's nine.",
      "I don't read people's mail. I do read the postcards.\nThey're right there! Everybody does.",
      "Biscuit, up at the Saddle Lodge, gets more mail than the mayor.\nIt's mostly from Pip.",
      '"Neither snow nor rain," all of that. It\'s true!\nFog slows me down a little. I\'ll admit that.',
    ],
    moods: {
      snowing: ['The mail still goes out in the snow. I just walk a little slower.'],
      night: ["We're closed, technically.\nI'm just standing here out of habit. Hi!"],
    },
  },
  {
    id: 'marge',
    name: 'Marge',
    role: 'Innkeeper, the Copperfield Inn',
    at: { spot: 'copperfield-inn' },
    look: { jacket: 0x9a4f6a, trousers: 0x3a3430, hat: 0xe8d9ae, style: 'beanie', features: { hair: 0x8f4a3a, hairStyle: 'curls', apron: 0x3a2e26 } },
    wearing: {
      'jacket-innkeeper': "Room nine's coat! Oh, it looks so much better on a person.",
      'hat-tophat': "A top hat, in my lobby!\nFinally, somebody's dressed for the wallpaper.",
    },
    hello: "Hi, hon. Sit anywhere. I'm Marge - this is my inn.\nForty beds and just me. I hear pretty much everything in this town.",
    chat: [
      "About half of what I hear is nonsense.\nI never know which half. That's the fun of it.",
      "Teddy Roosevelt came through the depot in 1901, in the middle of the night.\nHe didn't stay here. I'm still a little annoyed.",
      "A guest asked me once for a room with a view of the mountain.\nThey all have one! It's right there.",
      "I've got a system for running this place.\nThe system is I don't sit down.",
      'Somebody checked in as "Tom" last winter and left a puddle in room six.\nI have my suspicions.',
      "I'm told they used to hold dances for the ski train crowd, up over the drugstore.\nBefore my time. I'd have gone.",
      "The piano in the lobby only really plays one song.\nIt's never the one you ask for. People seem to like it anyway.",
    ],
    moods: {
      snowing: ['Snowed in is my favorite kind of full. Nobody checks out, and everybody wants cocoa.'],
      night: ["I keep the lobby fire going till midnight. After that it's up to whoever can't sleep."],
      dusk: ["The lamps are coming on down Main Street.\nI always turn ours on last. I don't know why. I just like to."],
    },
  },
  {
    id: 'fenn',
    name: 'Mr. Fennimore',
    role: 'Librarian, Town of Johnsburg Library',
    at: { spot: 'town-of-johnsburg-library' },
    look: { jacket: 0x6b5a48, trousers: 0x3a3430, hat: 0x8a6a3c, style: 'ranger', features: { glasses: true, beard: 0x8a8f9c, height: 1.06, girth: 0.92 } },
    hello: "Shh- oh. We're outside. Sorry. Habit.\nI'm Mr. Fennimore, from the library. Ask me anything about this town. I've read, um, all of it.",
    chat: [
      "The first ski train got here in March of 1934, all the way from Schenectady.\nHundreds of people on it. I wish I'd seen that.",
      "A man named Henry Barton started mining garnet on Gore in 1878.\nNot for jewelry. For sandpaper. I find that sort of wonderful.",
      'In 1901 Theodore Roosevelt found out he was President at our depot. Before dawn.\nI think about it every time I walk past.',
      'Gore opened as a ski center in 1964. Three years later it had the first gondola in New York State.',
      'Back in 1934 skiers rode up the mine road in the back of a truck, and skied down to town.\nThe Ski Bowl got a rope tow the next year.',
      'The fire tower on the summit went up in 1918.\nAn observer could spot a campfire twenty miles off. Supposedly.',
      "The Hudson's so small here. A couple hundred miles on, it's New York Harbor.\nI don't know. That one gets me.",
      'Garnet is the state gem of New York. I keep one on the returns desk.\nPeople keep trying to return it.',
      'They floated logs down the Hudson past here every spring, right up until 1950. The whole river, bank to bank.',
      'The Adirondack Park is bigger than Yellowstone, Yosemite, Glacier, the Grand Canyon and the Smokies put together.\nI checked. Twice.',
      'A few of the old ski trails here started out as logging roads.\nThe ski club cleared them by hand. Rabbit Pond was one, I believe.',
    ],
  },
  {
    id: 'notices',
    name: 'the noticeboard',
    kind: 'board',
    role: 'Outside the Town Hall',
    at: { spot: 'johnsburg-town-hall' },
    look: { jacket: 0x8a6a3c, trousers: 0x8a6a3c, hat: 0x8a6a3c, style: 'beanie' },
    hello: "TO WHOEVER IS BUILDING SNOWMEN ON MAIN STREET:\nThank you. They're lovely. Please stop putting hats on the fire hydrants.\n- The Town",
    chat: [
      'LOST: one yellow mitten.\nFOUND: one yellow mitten.\n(Same handwriting. Pinned up a week apart.)',
      "FOR SALE: skis, 210 cm. Used once, in 1974.\nI've thought it over and skiing's not for me. Make an offer.",
      'TOWN MEETING, Tuesday.\n1. The bridge.\n2. The other bridge.\n3. Turkeys - can we ask them to use the crosswalk?',
      "Did anybody else see the big footprints behind the school??\nI'll trade a pie for information.\n- Marge",
      "GARNET CLUB meets Thursday! Everyone's welcome!\nPlease come. It's just me so far.\n- Dr. Mica",
      "HELP WANTED: someone to cover Otto's day off.\n(This has been up since 1986. He keeps saying he doesn't need one.)",
      'CHILI COOK-OFF RESULTS\n1st: Gus\n2nd: Gus (other pot)\n3rd: nobody will say whose this was',
      "REMINDER: the Snow Train can't stop for photos.\nOr cows. Sorry about last time.\n- Bea",
    ],
  },
  {
    // What it says is chalked up fresh from the real sky each time it is read (`snowReport`).
    id: 'report',
    name: 'the snow report',
    kind: 'board',
    role: 'Chalked up by the Base Lodge door',
    at: { place: 'base-lodge', aside: -11 },
    look: { jacket: 0x8a6a3c, trousers: 0x8a6a3c, hat: 0x8a6a3c, style: 'beanie' },
    hello: "SNOW REPORT\nConditions: good.\nMore soon. Somebody took the chalk.",
    chat: ["SNOW REPORT\nLifts: turning. Trails: open.\nChalk: still missing.", 'SNOW REPORT\nSame as yesterday. Yesterday was good.'],
  },
  {
    id: 'lostfound',
    name: 'the lost and found',
    kind: 'board',
    role: 'By the Ski Bowl lodge door',
    at: { place: 'ski-bowl-lodge', aside: 6 },
    look: { jacket: 0x8a6a3c, trousers: 0x8a6a3c, hat: 0x8a6a3c, style: 'beanie' },
    hello: 'LOST AND FOUND\nFound: one ski pole.\nLost: the other ski pole.\nIf you have it, you know who you are.',
    chat: [
      "FOUND: fourteen left mittens. No right ones.\nIf one's yours, it's in the box.",
      "LOST: my sense of direction, somewhere on Twister.\nNo reward. I'd just lose it again.",
      'FOUND: a top hat, full of snow.\nCLAIMED!! thank you. I am nodding.\n- Tom',
      "LOST: one red kite.\nFOUND: one red kite, with a bite out of it.\nWe don't know either.",
      'FOUND: a sandwich labeled "The Lies."\nIt\'s not a salad. Walt would like it picked up, please.',
      'LOST: one snowcat. Big, red. Last seen where I parked it.\n- Bram\nUPDATE: found it. It was where I parked it.',
      'FOUND: one green thermos, still warm.\nIvy, this is the fourth time.\n- Patrol',
      "LOST: nine hats.\nI'm not worried. I have more.\n- Pip (age 9)",
    ],
  },
  {
    // Picks, each day, a trail not yet in the passport (`trailOfTheDay`).
    id: 'trailboard',
    name: 'the trail board',
    kind: 'board',
    role: 'Outside the Saddle Lodge',
    at: { place: 'saddle-lodge', aside: -10 },
    look: { jacket: 0x8a6a3c, trousers: 0x8a6a3c, hat: 0x8a6a3c, style: 'beanie' },
    hello: "TRAIL OF THE DAY: coming soon.\nWhoever has the chalk is out skiing it.",
    chat: ["TRAIL OF THE DAY: coming soon.\nWhoever has the chalk is out skiing it.", 'TRAIL OF THE DAY: all of them. Any order.'],
  },
  {
    // What is about on the mountain this season and hour, the unseen first (`wildlifeLog`).
    id: 'log',
    name: 'the observer\'s log',
    kind: 'board',
    role: 'Pinned up at the foot of the fire tower',
    at: { place: 'summit', aside: -7 },
    look: { jacket: 0x8a6a3c, trousers: 0x8a6a3c, hat: 0x8a6a3c, style: 'beanie' },
    hello: "LOG\nWeather: sky.\nWildlife: some.\nMore when I find my pencil. - Wren",
    chat: ["LOG\nWeather: sky.\nWildlife: some.\nMore when I find my pencil. - Wren", 'LOG\nRavens: forty. Same forty, I think.'],
  },
  {
    id: 'biscuit',
    name: 'Biscuit',
    kind: 'dog',
    role: 'Mountain dog, Saddle Lodge',
    at: { place: 'saddle-lodge', aside: 8 },
    look: { jacket: 0xc98f4f, trousers: 0xf4ead8, hat: 0x6b4a33, style: 'beanie' },
    wearing: {
      'hat-antlers': 'Biscuit barks at your antlers. Just once.\nThen he feels bad about it.',
      'hat-tophat': "Biscuit has never seen a top hat before.\nHe'd like to carry it somewhere and bury it.",
    },
    hello: 'Biscuit looks at you. Then at your pockets. Then at you again.\nHis whole back half is wagging.',
    chat: [
      "Biscuit leans on your leg. All of him.\nYou're staying a while, apparently.",
      "Biscuit rolls over.\nHe's not asking.",
      'Biscuit sneezes snow on you.\nHe seems really proud of it.',
      "Biscuit brings you a stick. It's a ski pole.\nIt isn't yours. It's somebody's.",
      "Biscuit sits down on your boots.\nYou can't leave now. That's the idea.",
    ],
    moods: {
      snowing: ["Biscuit is trying to catch snowflakes.\nHe's gotten a few. He looks amazed every time."],
      night: ['Biscuit is asleep. One ear is still up.\nJust in case of sandwiches.'],
    },
  },
  {
    id: 'sven',
    name: 'Sven',
    role: 'Ski instructor, Bear Cub',
    at: { lift: 'Bear Cub' },
    look: { jacket: 0x2f8f55, trousers: 0x1f242e, hat: 0xf4f1ea, style: 'beanie', features: { beard: 0xe2c66a, hair: 0xe2c66a, height: 1.08 } },
    wearing: {
      'jacket-instructor': 'Instructor green! If anyone asks you anything, say "bend your knees."\nIt\'s right most of the time.',
      'hat-helmet': 'A helmet! Good. Very good.\nNow you can fall over and feel fine about it.',
    },
    hello: "Pizza! French fries! Pizza!\n...Sorry. That's the whole first lesson. I'm Sven. Hello!",
    chat: [
      "Bend your knees. A little more. A little less. There!\nDon't ask me what changed. I don't know either.",
      "The mountain doesn't care what you look like on the way down.\nI think that's the nicest thing about it.",
      "I've taught about four thousand people how to stop.\nA couple of them took a while. That's okay.",
      "If you fall down, you're learning. That's what I tell the kids.\nI tell the grown-ups too. They need it more.",
    ],
    seasonal: {
      summer: ['No snow, so I\'m teaching mountain biking.\nI still say "pizza." It doesn\'t mean anything on a bike. It\'s just habit.'],
      spring: ["Spring snow! It's like skiing on mashed potatoes. In a good way!"],
    },
  },
  {
    id: 'bram',
    name: 'Bram',
    role: 'Groomer, Gore Mountain Lodge',
    prop: 'snowcat',
    at: { place: 'gore-mountain-lodge' },
    look: { jacket: 0xd9822b, trousers: 0x3a3430, hat: 0x1f242e, style: 'trapper', features: { beard: 0x3a3430, girth: 1.1 } },
    wearing: {
      'jacket-groomer': 'Orange! Now the plow can see you.\nSo can everybody else. Sorry about that.',
    },
    hello: "Hey. I'm Bram. I drive the snowcat - that big thing there.\nI groom the trails at night, while everybody's asleep.",
    chat: [
      "People think the snow just sort of lies like that.\nIt doesn't. I comb it, every night. It takes hours.",
      "Stones come up when I groom. Garnets, mostly.\nI used to stop for them. Now I leave them for whoever's up first.",
      "You see things up there at three in the morning. Deer. Foxes.\nOnce something... tall. I don't really talk about that one.",
      "My favorite run is whichever one I groomed last. Ask me tomorrow and it'll be a different one.",
      "Nobody sees me do it, is the thing. They just see it done.\nThat's fine. Mostly fine.",
    ],
    moods: {
      night: ["I should be up on the hill already. I'm just finishing my coffee.\nDon't tell Hazel."],
      snowing: ["Fresh snow, right on top of my corduroy.\nI should be annoyed. I'm not, though. Look at it."],
    },
  },
  {
    // Tom does not speak. What he has to say is on notes stuck to him, in a nine-year-old's hand.
    id: 'tom',
    name: 'Tom',
    kind: 'snowman',
    role: 'Snowman (winters). Scarecrow (summers).',
    at: { place: 'ski-bowl-lodge', aside: -15 },
    look: { jacket: 0xf4f6fa, trousers: 0xf4f6fa, hat: 0x22262d, style: 'tophat' },
    wearing: {
      'hat-tophat': 'HEY that is my other hat!!\nIt looks nice. You can keep wearing it.',
    },
    hello: 'HI. I am Tom. I am a snowman.\nI can talk but I am shy, so my friend writes it down for me.',
    chat: [
      'I have been standing here since it snowed.\nIt is going good.',
      'PLEASE do not look at my nose.\nIt is a carrot. I know it is a carrot.',
      'A dog came on Tuesday.\nWe do not talk about it.',
      'Is there a mountain behind me? Somebody said there is.\nI can not turn around.',
    ],
    seasonal: {
      spring: ['I am NOT melting.\nI am just smaller now. It is on purpose.', 'Soon I will be mostly hat.\nIt is a good hat so that is ok.'],
      summer: ['I am a scarecrow in the summer.\nIt is the same job but with straw.', 'The crows are not scared of me. We are friends.\nDo not tell the farmer.'],
      fall: ['Everybody likes the leaves more than me right now.\nThat is ok. They are really good leaves.', 'It is going to snow soon.\nI can feel it in my straw.'],
    },
    moods: {
      snowing: ['MORE SNOW.\nYes. Good.'],
      raining: ['It is raining. I do not like it.\nThat is all.'],
      night: ['I do not sleep. I just stand here.\nIt is nice. You can see stars.'],
      dawn: ['The sun is coming up. It is pretty.\nIt is also a little scary, for me.'],
    },
  },
  {
    id: 'flurry',
    name: 'Madame Flurry',
    role: 'Weather prophet, the warming hut',
    at: { place: 'warming-hut' },
    look: { jacket: 0x6a3f8f, trousers: 0x3a2a4a, hat: 0xd9a441, style: 'beanie', features: { hair: 0xb9b4ac, hairStyle: 'curls', shawl: 0x8a5a2c, height: 0.94 } },
    wearing: {
      'hat-propeller': "Is it spinning? Then the wind's changed.\nOr you moved. It's one of those.",
    },
    hello: "Come in, sit down. ...There aren't any chairs. Stand, then.\nI'm Madame Flurry. I predict the weather. Usually a little after it happens.",
    chat: [
      "I'm seeing... a mountain. And you're on it.\nThat'll be five dollars. Kidding! Nobody here has any money. I've asked.",
      "I'm right about four times out of ten.\nThe TV isn't any better, and the TV doesn't have a shawl.",
      'The spirits say the snow today is "packed powder."\nThey say that every day. I think they\'re reading it off the report.',
      "Don't ask me about tomorrow. Ask me tomorrow about today.\nI'm very good at today.",
    ],
    seasonal: {
      summer: ["I'm sensing a warm spell.\nIt should last until... September-ish."],
      fall: ['The leaves are going to fall. You can hold me to that one.'],
      spring: ["I'm getting... mud. A lot of mud.\nI didn't really need the gift for that."],
    },
    moods: {
      snowing: ["I knew it was going to snow! I didn't say it out loud.\nBut I knew."],
      raining: ['I predicted "weather," and look. Here it is.\nI stand by that.'],
      night: ["The stars are out. Or they would be.\nIt's either clear or cloudy tonight. I feel strongly about that."],
      dawn: ['Red sky at morning, sailors take warning.\nSkiers take the gondola. I added that part.'],
      dusk: ["The sun's going down in the west tonight. I called that one years ago."],
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
      'hat-helmet': "Helmet. Good.\nYou look like you'd know where the first aid room is. Nobody does. I think it moves.",
      'jacket-patrol': 'Two of us in red now.\nIf somebody falls over, we look at each other, and then you go.',
    },
    hello: "Ski patrol. I'm Ivy.\nNothing's wrong. This is just how I stand.",
    chat: [
      "Whoever's downhill of you has the right of way. So do the trees.\nThe trees are pretty firm about it.",
      "I carry forty pounds of gear and one thermos.\nThe thermos gets used the most. It's soup.",
      'Nobody really gets hurt up here. You bump something, you slow down.\nMostly I hand out soup.',
      "If you hit a tree, say sorry to it. That's not a rule. I just think it's polite.",
    ],
    seasonal: {
      summer: ["It's bike patrol in the summer. Same sled, but they put wheels on it.\nI didn't ask for the wheels."],
    },
    moods: {
      snowing: ["You can't see much today. Go slow, okay?\nIt's really nice in the trees, though."],
      dusk: ["We do the last sweep soon. Ski every trail, make sure nobody's still out.\nIt's the best part of the job. Don't tell anyone."],
      night: ["The mountain's closed. I'm not here.\nYou didn't see me, and neither of us saw Bram."],
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
      'hat-antlers': "(The Mayor stares at your antlers for a long time.\nHe's seen a deer. You're not one.)",
      'hat-tophat': '(The Mayor looks at your top hat and narrows one eye.\nIt might be fine. It might not.)',
    },
    hello: "Mrrp.\n(This is Mayor Pickles. He's the mayor. He looks at you for a while.)",
    chat: [
      '(The Mayor is in a meeting.\nThe meeting is him, sitting.)',
      '(The Mayor moves into the sunbeam.\nNobody objects.)',
      "(The Mayor lets you pet him for about four seconds.\nThat's a lot, for him.)",
      '(A bird lands nearby.\nThe Mayor pretends not to notice. He notices.)',
      '(You can scratch behind the left ear.\nNot the right one. Nobody knows why.)',
    ],
    moods: {
      snowing: ["(The Mayor doesn't like the snow.\nHe looks at you like you could do something about it.)"],
      raining: ["(The Mayor is under the eaves.\nHe'd rather not discuss it.)"],
      night: ["(The Mayor is out late.\nHe's busy. With what, nobody's sure.)"],
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
    ask: "Could you do me a small favor?\nRide a lift up - any of them - and tell me how it looks up there. I haven't been up yet today.",
    nudge: "Any lift counts! They all load at an orange gate.\nThe little J-Bar's right here, if you want a short one.",
    need: { kind: 'lifts', count: 1 },
    thanks: "It's nice up there? Oh, good.\nHere - a patrol jacket. We had a spare, and you sort of look the part.",
    reward: { gear: 'jacket-patrol' },
  },
  {
    id: 'stamp-collector',
    from: 'hazel',
    title: 'Five stamps',
    ask: "Okay, next thing, if you want one.\nGet five stamps in your passport. Any kind - trails, lifts, lodges, whatever you run into.",
    nudge: "Five stamps, any kind.\nSki one trail top to bottom and that's one already.",
    need: { kind: 'stamps', count: 5 },
    thanks: "Five! That was fast.\nGo show Bea, down at the depot. She's got something for people with stamps.",
    after: 'first-chair',
  },
  // Otto: coffee, and every lift.
  {
    id: 'ottos-coffee',
    from: 'june',
    to: 'otto',
    title: 'Coffee for Otto',
    ask: "Hey, could you run a coffee up to Otto for me? He's at the Express lift, and he never takes a break.\nTotally fine if not!",
    nudge: "Otto's at the bottom of the Adirondack Express, by the Base Lodge.\nMind the lid - it's a little loose.",
    need: { kind: 'item', id: 'coffee' },
    fetch: { name: 'A coffee, milk, two sugars', from: 'june', handover: "Here you go. Milk, two sugars.\nHe'll tell you he takes it black. He doesn't." },
    thanks: "From June? And it's still hot!\nOkay, that's a ten out of ten. I don't give out a lot of tens. Here - take my spare hat.",
    reward: { gear: 'hat-trapper' },
  },
  {
    id: 'every-lift',
    from: 'otto',
    title: 'Every lift on the hill',
    ask: "Hey, want a project? Ride all fourteen lifts. Carpets and the J-bar too.\nI'd do it myself, but somebody has to load the chairs.",
    nudge: "Fourteen lift pins. The little ones count!\nSo does the carpet they call the Snow Train. The real train doesn't. I asked.",
    need: { kind: 'lifts', count: 14 },
    thanks: "All fourteen? Wow.\nI don't think anybody's done that but me, and I work here. Take a lift jacket. You earned it.",
    reward: { gear: 'jacket-liftie' },
    after: 'ottos-coffee',
  },
  // Gus: foraging.
  {
    id: 'blueberries',
    from: 'gus',
    title: 'Blueberry scouting',
    ask: "I want to do blueberry pancakes, but I can't leave the stove.\nCould you find me a patch up on the ledges? You don't have to pick any. Just tell me where.",
    nudge: "Blueberries like sunny rock. Try wherever it's steep and bare.",
    need: { kind: 'species', id: 'blueberry' },
    thanks: "A whole ledge of them? Oh, that's great.\nPancakes on Saturday. The first stack's yours. So's the hat.",
    reward: { gear: 'hat-toque' },
    seasons: ['summer'],
  },
  {
    id: 'chanterelles',
    from: 'gus',
    title: 'Something orange',
    ask: "Okay, so - chanterelles. They're orange, like an egg yolk, and they grow under the hardwoods.\nIf you spot any, tell me? I've got a soup in mind.",
    nudge: "Under the hardwoods, down low on the mountain. They come up after rain.",
    need: { kind: 'species', id: 'chanterelle' },
    thanks: "You found some! Beautiful.\nThe soup was happening either way, but now it's got mushrooms in it. Thank you.",
    seasons: ['summer', 'fall'],
  },
  {
    id: 'warm-up',
    from: 'gus',
    title: 'Top to bottom',
    ask: "Have you skied Sunway yet? All of it, from up here down to the base?\nYou should. Then come back hungry.",
    nudge: "Sunway starts right outside and goes all the way down to the base.",
    need: { kind: 'trail', name: 'Sunway' },
    thanks: "The whole thing? Nice.\nOkay, sit down. I'm getting you a bowl. No, really.",
  },
  // Wren: looking.
  {
    id: 'raven-count',
    from: 'wren',
    title: 'The raven census',
    ask: "I'm trying to count the ravens, but I think I keep counting the same one.\nIf you see a raven out there, would you tell me? One I haven't met.",
    nudge: "Ravens like the ledges and the high trails.\nBig and black and... smug, I guess. You'll know.",
    need: { kind: 'species', id: 'raven' },
    thanks: "Oh - that sounds like Paul. I know Paul.\nThat's okay! He still counts. Put him in your guide.",
  },
  {
    id: 'naturalist',
    from: 'wren',
    title: 'Ten in the guide',
    ask: "If you get ten things in your field guide, I've got something for you.\nAnimals, birds, plants - anything counts. No hurry.",
    nudge: "Ten entries in the guide. Try the edges of the trails around dawn.\nAnd go slow. Most things are shy.",
    need: { kind: 'speciesCount', count: 10 },
    thanks: "Ten! You've got a good eye.\nHere - the tower keepers used to wear these. Back when every summit had somebody.",
    reward: { gear: 'hat-ranger' },
    after: 'raven-count',
  },
  {
    id: 'lookouts',
    from: 'wren',
    title: 'The other view',
    ask: "Everybody comes up here to the tower. Hardly anybody walks out to the Vermont Overlook.\nYou should go stand there for a minute. That's all.",
    nudge: "The Vermont Overlook's on your map. It's worth the walk.",
    need: { kind: 'landmark', id: 'vermont-overlook' },
    thanks: "It's quiet out there, right?\nThat's my second favorite spot. I'm not telling you the first one.",
    after: 'raven-count',
  },
  // Dr. Mica: stones.
  {
    id: 'six-garnets',
    from: 'mica',
    title: 'Six garnets',
    ask: "Could you find six garnets? You don't have to bring them here or anything.\nI just really like knowing somebody's out there finding them.",
    nudge: "Six garnets. They're the dark red ones.\nOnce you start looking, they're kind of everywhere.",
    need: { kind: 'mineral', id: 'garnet', count: 6 },
    thanks: "Six! That's so good.\nHere - it's garnet red. I had it made for me, but honestly it's more of a collector's jacket.",
    reward: { gear: 'jacket-garnet' },
  },
  {
    id: 'eight-kinds',
    from: 'mica',
    title: 'A proper collection',
    ask: "Okay, next. A real collection isn't just garnets. (I say that with love.)\nCan you find eight different minerals? You might have to leave the trails.",
    nudge: "Eight kinds. The unusual ones are in bare rock and deep in the woods.",
    need: { kind: 'minerals', count: 8 },
    thanks: "Eight different kinds! That's a real collection. That's a CABINET.\nSorry. I'm a little emotional. Take the hat.",
    reward: { gear: 'hat-garnet' },
    after: 'six-garnets',
  },
  {
    id: 'big-one',
    from: 'mica',
    title: 'The big one',
    ask: "So... somewhere on this mountain there's a garnet bigger than fifteen centimeters. There has to be.\nIf you ever find one, will you come tell me? Please?",
    nudge: "Fifteen centimeters or more. People say the old quarry is the place to look.",
    need: { kind: 'mineralSize', id: 'garnet', cm: 15 },
    thanks: "Oh my gosh. Look at it. LOOK at it.\nI need to sit down for a second.",
    after: 'six-garnets',
  },
  // Bea: the Snow Train.
  {
    id: 'season-pass',
    from: 'bea',
    title: 'A pass for the Snow Train',
    ask: "I'd love to give you a pass. I just need to see five stamps in your passport first.\nIt's so I know you've had a look around this season.",
    nudge: "Five stamps in your passport, any kind, and the pass is yours.",
    need: { kind: 'stamps', count: 5 },
    thanks: "Five stamps. Perfect.\nHere's your pass - it's good forever. Come find me whenever you want a different season.",
    reward: { pass: true },
  },
  {
    id: 'four-seasons',
    from: 'bea',
    title: 'All four',
    ask: "Have you been to all four yet? You should ride to each one, at least once.\nThen tell me which is best. Everybody says something different.",
    nudge: "Winter, spring, summer, fall. The train goes to all of them.",
    need: { kind: 'seasons', count: 4 },
    thanks: "All four! Okay, so which was the best?\n...Actually, don't tell me. I like not knowing. Here, have a cap.",
    reward: { gear: 'hat-cap' },
    after: 'season-pass',
  },
  // Walt: a delivery up the mountain.
  {
    id: 'tower-special',
    from: 'walt',
    to: 'wren',
    title: 'The Fire Tower Special',
    ask: "Wren calls in the same order every week, and I can never get it up to the summit.\nWould you take it? It travels pretty well. No worries if not.",
    nudge: "Wren's at the fire tower on the summit.\nTake the Straight Brook Quad, then it's a short walk through the trees.",
    need: { kind: 'item', id: 'sandwich' },
    fetch: { name: 'The Fire Tower Special', from: 'walt', handover: "One Fire Tower Special. Turkey, cheddar and apple.\nThere's a pickle in there I'm really proud of." },
    thanks: "The Special! And it's still in one piece!\nTell Walt thank you. Actually - tell him more pickle. Here, this was a tower keeper's. It's yours.",
    reward: { gear: 'jacket-forest' },
  },
  // Pip: lost property.
  {
    id: 'lost-mitten',
    from: 'pip',
    title: 'Pip\'s mitten',
    ask: "I lost a mitten. A yellow one.\nIt was on my hand, and then it wasn't. I think it's under the Hudson Chair. Maybe.",
    nudge: "It's yellow, and it's under the Hudson Chair somewhere. Probably.",
    need: { kind: 'item', id: 'mitten' },
    lost: { name: 'A small yellow mitten', at: { lift: 'Hudson Chair', along: 0.45 } },
    thanks: "MY MITTEN! You found it!\nNow I have two again. Two is the right number.",
    seasons: ['winter', 'spring'],
  },
  {
    id: 'lost-goggles',
    from: 'pip',
    title: 'Pip\'s goggles',
    ask: "Um. Also my goggles.\nI took them off to look at a deer, and then the deer left, and so did my goggles. It was on Moxham. Like halfway down.",
    nudge: "My goggles. Halfway down Moxham, where the deer was.",
    need: { kind: 'item', id: 'goggles' },
    lost: { name: 'A pair of small goggles', at: { trail: 'Moxham', along: 0.5 } },
    thanks: "They still fit! Okay - you can have one of my hats.\nI have nine. I mean eight now. That's fine.",
    thanksOwned: "They still fit! Thank you thank you.\nYou've already got one of my hats, so... we're even. That's how it works.",
    reward: { gear: 'hat-rainbow' },
    after: 'lost-mitten',
    seasons: ['winter', 'spring'],
  },
  {
    id: 'lost-kite',
    from: 'pip',
    title: 'Pip\'s kite',
    ask: "My kite got away. It went up, and then it went sideways.\nI think it came down by Rabbit Pond. It's red.",
    nudge: "A red kite, somewhere by Rabbit Pond.",
    need: { kind: 'item', id: 'kite' },
    lost: { name: 'A red kite, slightly chewed', at: { spot: 'rabbit-pond' } },
    thanks: "There's a bite out of it. Something BIT my KITE!\nThis is the best day.",
    reward: { gear: 'hat-rainbow' },
    seasons: ['summer', 'fall'],
  },
  // Amos: the old workings.
  {
    id: 'gem-garnet',
    from: 'amos',
    title: 'Clear right through',
    ask: "Thirty years, and I found four gem garnets.\nIf you ever find one, bring it by? I'd like to see one more.",
    nudge: "Gem garnet. Clear, deep red.\nThey turn up where the regular ones do, just not often. Try around here.",
    need: { kind: 'mineral', id: 'gem-garnet', count: 1 },
    thanks: "Well, now. Hold it up to the light.\n...There. That's what this whole mountain's made of. Here, keep my lamp. I don't go underground anymore.",
    reward: { gear: 'hat-lamp' },
  },
  // Bram: the corduroy, and a bump called Gerald.
  {
    id: 'corduroy',
    from: 'bram',
    title: 'Corduroy critic',
    ask: "Could you do something for me? Ski six trails, top to bottom.\nThen come tell me how the corduroy was. Nobody ever tells me.",
    nudge: "Six trails stamped in your passport. Any six.\nI groomed all of them, so take your pick.",
    need: { kind: 'trails', count: 6 },
    thanks: "It was good? Yeah. I mean - I figured.\nStill nice to hear. Here, groomers wear orange. It's so the plow sees us.",
    reward: { gear: 'jacket-groomer' },
  },
  {
    id: 'gerald',
    from: 'bram',
    title: 'Meet Gerald',
    ask: "There's a bump on Twister I can't flatten. I've been trying for eleven winters.\nI call him Gerald. If you ski Twister, say hi for me.",
    nudge: "Twister, top to bottom. You'll know Gerald when you meet him.",
    need: { kind: 'trail', name: 'Twister' },
    thanks: "So you met him. About halfway down, a little rude?\nYeah, that's Gerald. I think he's going to outlast me.",
    after: 'corduroy',
  },
  // Tom: a hat, gone with the wind.
  {
    id: 'toms-hat',
    from: 'tom',
    title: 'A hat at large',
    ask: "HELP. My hat blew away. It went toward the Village Chair.\nI can't go get it because I am a snowman.\nIt is a top hat. Please.",
    nudge: "My hat is under the Village Chair somewhere.\nI would point but my arms are sticks.",
    need: { kind: 'item', id: 'tophat' },
    lost: { name: 'A top hat, full of snow', at: { lift: 'Village Chair', along: 0.55 } },
    thanks: "MY HAT!! Thank you thank you.\nYou can have my other one. I am nodding right now. You can't tell but I am.",
    reward: { gear: 'hat-tophat' },
  },
  // Madame Flurry: a reading of the seasons.
  {
    id: 'two-seasons',
    from: 'flurry',
    title: 'A second opinion',
    ask: "The spirits are vague about summer. So am I, to be honest.\nCould you go see the mountain in two different seasons and tell me what it's like? Bea can get you there.",
    nudge: "Two seasons. The Snow Train at the depot goes to all four, once you've got a pass.",
    need: { kind: 'seasons', count: 2 },
    thanks: "It's GREEN in the summer? I knew it.\nWell - I know it now. Take this. It spins when the wind changes.",
    reward: { gear: 'hat-propeller' },
  },
  // Ivy: a thermos, and a sweep.
  {
    id: 'thermos',
    from: 'ivy',
    title: 'The thermos',
    ask: "I left my thermos up by the fire tower. It's green.\nIt's sort of the most important thing I own. Could you grab it, if you're up there?",
    nudge: "A green thermos, by the fire tower, at the very top.",
    need: { kind: 'item', id: 'thermos' },
    lost: { name: 'A green thermos, still warm', at: { place: 'summit', aside: 7 } },
    thanks: "It's still warm. Huh.\nThank you. Really. Here - take a helmet. Patrol looks after its own.",
    reward: { gear: 'hat-helmet' },
  },
  {
    id: 'sweep',
    from: 'ivy',
    title: 'Last sweep',
    ask: "Want to help me sweep? Twelve trails, top to bottom. Any twelve.\nYell if you find anybody. You won't. Yelling's just fun.",
    nudge: "Twelve trails stamped. You can shout \"sweep!\" on the way down.\nI do.",
    need: { kind: 'trails', count: 12 },
    thanks: "Twelve trails, and nobody left out there.\nYou'd make a pretty good patroller. I don't usually say that.",
    after: 'thermos',
  },
  // The town: a parcel for the summit, a bet, a library book and some homework.
  {
    id: 'special-delivery',
    from: 'dot',
    to: 'wren',
    title: 'Special delivery',
    ask: "I've got a parcel for the fire tower, up on the summit.\nWe don't really deliver to summits. But you go up there, don't you?",
    nudge: "It's for Wren, at the fire tower on the very top of Gore.",
    need: { kind: 'item', id: 'parcel' },
    fetch: { name: 'A parcel that rattles', from: 'dot', handover: "Here it is. It rattles a little.\nDon't shake it. ...I already did." },
    thanks: "Batteries for the radio! And tea. So much tea. Dot always knows.\nOh - there's a jacket in here too, with your name on it. I think that makes you official.",
    reward: { gear: 'jacket-postal' },
  },
  {
    id: 'the-bet',
    from: 'marge',
    title: 'A bet with Walt',
    ask: "Okay, settle something for me. A guest says the old gondola's mid station is still standing, up in the woods.\nWalt says they tore it down in '99. There's a sandwich riding on it.",
    nudge: "The old gondola's mid station, up in the trees somewhere.\nIf it's there, go stand in front of it, then come tell me.",
    need: { kind: 'landmark', id: 'old-gondola-mid-station' },
    thanks: "It's still there? Concrete and everything?\nHa! Walt owes me a sandwich. Here - somebody left this in room nine, and it's nicer than anything I own.",
    reward: { gear: 'jacket-innkeeper' },
  },
  {
    id: 'overdue',
    from: 'fenn',
    title: 'Overdue',
    ask: "There's one book that's been out since 1987. \"Skiing Made Simple.\"\nThe card says it went to an O., at the lift shack. I don't want a fine or anything. I'd just like to see it.",
    nudge: "An O., at a lift shack.\nI'm told the Adirondack Express has had the same attendant for quite a while.",
    need: { kind: 'item', id: 'library-book' },
    fetch: { name: '"Skiing Made Simple", 1958', from: 'otto', handover: "Oh. That. I've been meaning to finish it.\nI got stuck on chapter two. Tell Fenn it was good, as far as I got." },
    thanks: "Nearly forty years overdue. I worked out the fine once. It was more than the building.\nIt's waived, obviously. Here - they gave me a spare hat when I started. I never knew why.",
    reward: { gear: 'hat-fenn' },
  },
  {
    id: 'homework',
    from: 'sven',
    title: 'Homework',
    ask: "I have homework for you! Ski Sunway, top to bottom. Slowly.\nSlow is the hard part. Going fast is easy - the mountain does that for you.",
    nudge: "Sunway, the whole thing, from the top. It's the long green one.\nTake your time. That's the assignment.",
    need: { kind: 'trail', name: 'Sunway' },
    thanks: "All of Sunway! Then you can ski anything. Really.\nHere - now you look like you know what you're doing. That's about half of teaching.",
    reward: { gear: 'jacket-instructor' },
  },
  // The Mayor's census, posted on the board and reported to the Mayor in person.
  {
    id: 'census',
    from: 'notices',
    to: 'pickles',
    title: "The Mayor's census",
    ask: "CENSUS! The Mayor would like to know who lives here. Anything with feathers, fur or leaves counts.\nFifteen kinds is plenty. Report to the Mayor. (He's the orange cat.)",
    nudge: "Fifteen kinds in your field guide. Then go see the Mayor, outside the Town Hall.",
    need: { kind: 'speciesCount', count: 15 },
    thanks: "(The Mayor looks over your field guide for a while. Then he sits on it.\nThat's a yes. There are also antlers for you, somehow.)",
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
  { id: 'jacket-postal', name: 'Mail carrier\'s blue', slot: 'jacket', colour: 0x5a6f8a },
  { id: 'jacket-innkeeper', name: 'The coat from room nine', slot: 'jacket', colour: 0x7a3f5a },
  { id: 'jacket-instructor', name: 'Instructor\'s green', slot: 'jacket', colour: 0x2f8f55 },
  { id: 'hat-fenn', name: 'Librarian\'s spare', slot: 'hat', colour: 0x5a4636, style: 'ranger' },
  { id: 'hat-tophat', name: 'Tom\'s spare top hat', slot: 'hat', colour: 0x22262d, style: 'tophat' },
  { id: 'hat-propeller', name: 'Weather vane beanie', slot: 'hat', colour: 0x6a3f8f, style: 'propeller' },
  { id: 'hat-helmet', name: 'Patrol helmet', slot: 'hat', colour: 0xc8281e, style: 'helmet' },
  { id: 'hat-antlers', name: 'Honorary antlers', slot: 'hat', colour: 0x8a6a3c, style: 'antlers' },
];

export const gearById = (id: string): Gear | undefined => GEAR.find((g) => g.id === id);
export const DEFAULT_GEAR = { hat: 'hat-blue', jacket: 'jacket-red' };
