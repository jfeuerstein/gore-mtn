# Playtest guide

This is the game as it stands after being taken past the vertical slice. Nothing in it since
milestone 1 has had your thumbs on it, so expect rough edges and say where they are.

## Before you start

- Open the game from the Home Screen icon as before. A new version arrives by itself. You will
  get the welcome once, even though your book is not new; close it or read it through.
- Your existing book carries over. Stamps earned before the seasons were told apart count as
  winter's.
- Sound starts with your first touch. The phone's silent mode may mute it; Settings > Sound
  turns it off for good.
- Today the calendar says winter. The other seasons are reached by the Snow Train (see below),
  or straight away from Settings > For testing > Season.

## A first half hour

1. **Ski.** Ride the Adirondack Express and ski Sunway to the bottom. Stones lie on the snow;
   swerve for a few. Listen to the skis: a carve should hiss, a hockey stop should scrape.
2. **Talk.** Hazel stands by the Base Lodge door with a gold mark over her head. Take her
   errand. Otto is at the foot of the Express.
3. **Look.** Slow down near the trees. Anything with a pale blue mark is not yet in your field
   guide; come close to enter it. Deer and foxes bolt if you arrive fast.
4. **Go to town.** The shuttle waits by the Base Lodge (a blue sign and a cream bus). Ride it to
   North Creek. June the baker, a short way down Main Street, has a coffee that wants carrying.
5. **Earn the Snow Train.** Conductor Bea at the depot asks for five stamps in your passport.
   Then she will take you to any season. Try fall first.
6. **Ride.** In summer and fall the Skis button reads Bike. Thumb up pedals, down brakes.
7. **Open the Book** now and then. Four pages: Passport, Minerals, Guide, Pack.

## Things worth finding

- The fire tower on Gore's summit, a short walk through the trees from the Straight Brook Quad.
  Wren, the observer, is up there.
- The old Garnet Quarry and Barton Mine, on the map as landmarks. The ground round them is thick
  with garnets, big ones among them. Amos is at the quarry.
- The four lookouts: Vermont Overlook, Twister Cliffs, Windy Hill Lookout, Scenic View.
- Rabbit Pond, and the paths through the woods, which are dotted lines on the map.
- A summer night, for the fireflies. A fall day from the summit, for the colour.
- Whatever it is that walks the woods near The Rumor at dusk. Go very gently.
- North Creek on foot, door to door: Dot at the post office has a letter for you each day,
  Marge at the Copperfield Inn has the day's rumour of a rare stone, June and Walt on Main
  Street have something new to eat, and Fenn at the Town Hall lends a book. Read the
  noticeboard. Greet the Mayor.
- The Snow Train at the depot, after dark, with its windows lit.
- The old gondola's mid station, in the woods on the mountain. It is on no sign.
- Tom, by the Ski Bowl lodge. Visit him in every season.
- The Mineral Shop, out west past the summit, by shuttle: there is a garnet outside you cannot miss.

## What I could not check from here

- **How it looks on your phone's WebGPU.** The tools here draw with the fallback renderer. The
  stones and, out of winter, every tree take their colour per instance; if stones are all white,
  or the fall forest is grey, that is the thing to tell me first.
- **Frame rate.** There is far more on the mountain than when you last ran the benchmark, and
  draw calls are over the cautious target in places. Settings > For testing > Run benchmark,
  pasted back, would settle it. Try it in winter and once in fall.
- **Sound on a real speaker.** I have only seen the numbers, not heard it.
- **The live weather.** Still unverified from this side.
- **Offline play.** After one launch with a signal, try opening the game in aeroplane mode.
- **The lettering.** The interface and every sign in the world use two bundled typefaces. If
  signs show as blank boards, or the buttons fall back to a plain face, tell me.
- **The town's houses and the trail signs on WebGPU.** The houses are coloured per instance and
  the signs are one painted texture; both are new since you last looked.

## What to tell me

The full list is under "What to judge" in `docs/game-plan.md`. In short:

- Is each season worth the train ride? Which looks wrong?
- Is the bike fun?
- Wildlife and people: pleasure or clutter? Too much talk, too little?
- Does town feel like North Creek? I put June's bakery and Walt's deli in real buildings on Main
  Street, but I chose which. Say if they should move, and what else the town is missing.
- The new look of the menus and the Book, the portraits and the plates: right for the game?
- The new people: funny, or too much?
- Is the sound pleasant after twenty minutes?
- After a week of five-minute visits: does the book still pull you back?

## Known limits

- Buildings have no insides. Everyone stands outside their door.
- The river and ponds can be walked on.
- Settings > Go to, and fast travel, earn stamps like arriving any other way. They are for
  testing, and they will fill your book with things you did not earn.
- A season pinned from Settings earns no conditions stamps. One reached by Snow Train does.
- Restoring a save code replaces the whole book.
