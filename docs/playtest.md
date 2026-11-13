# Playtest guide

What to try on the phone, and what only your thumbs and eyes can settle. The game as a whole
is described in [game-plan.md](game-plan.md).

## Before you start

- Open the game from the Home Screen icon. A new version arrives by itself. A new player gets a
  welcome; a returning one gets a short note of what is new, once.
- Your existing book carries over. Settings can copy it out as a save code and restore it.
- Sound starts with your first touch. The phone's silent switch may mute it; Settings turns it
  off for good.
- The season, the hour and the sky are the real ones at Gore. The other seasons are reached by
  the Snow Train, or at once from Settings > For testing.

## A first day

1. **Read the flyer.** It is pinned up the first time you open the game each day: what the
   sky is doing and three leads. Tap `Flag` on one and a pennant stands there in the world,
   with an arrow under the place name at the top of the screen. `Let's go` puts it away; the
   map's `Today` button brings it back.
2. **Look round your cabin.** You start in its yard. At the door, tap `Home`: set a stone on
   the shelf and a patch on the board once you have some, and fill the feeder.
3. **Walk to the Base Lodge**, a few minutes along Cedars Traverse (open the Map and tap `Me`
   if you lose your way). Hazel is by the door with a gold mark over her head. Read the snow
   report chalked up beside her.
4. **Ski.** Ride the Adirondack Express, tap `Skis`, and come down Sunway. Stones lie on the
   snow; swerve for a few. Left and right steer, up tucks, down is a hockey stop.
5. **Look.** Slow down near the trees. Anything with a pale blue mark over it is not yet in
   your field guide; come close to enter it. Deer and foxes bolt if you arrive fast.
6. **Stake out the lean-to.** The flyer's middle lead is something the town wants to build.
   Go to the spot, tap `Stake it out`, and come back tomorrow.
7. **Go to town.** The shuttle waits by the Base Lodge. In North Creek, call at the post
   office, the inn, the bakery, the deli and the library: each has something for you daily.
8. **Open the Book** now and then. Four pages: Passport, Minerals, Guide, Pack.

## The next days

- **The feeder.** Fill it one day and somebody is at it the next, by day. Coming home puts
  them in the field guide.
- **The town's projects.** Each is built the day after you stake it out, and the next is
  proposed once it stands: a lean-to, a dock, a bandstand, a warming hut, a lookout. Walk out
  along the dock, up into the bandstand, onto the lookout. Whoever wanted each one has
  something to say about it, and writes.
- **The Snow Train.** Conductor Bea at the depot asks for five stamps in your passport, then
  takes you to any season. In summer and fall the `Skis` button reads `Bike`.
- **The map.** Drag it, zoom with `+` and `−` or a double tap, tap anything to name it and
  see where it stands in the book, plant your flag anywhere. `To do` fades what you have.
- **The camera.** Two fingers on the picture pinch it nearer or further, and it stays there.

## Things worth finding

- The fire tower on Gore's summit, a short walk from the Straight Brook Quad. Wren, the
  observer, is up there, and her log says what is about this hour.
- The old Garnet Quarry and Barton Mine. The ground round them is thick with garnets.
- The four lookouts, each with a bench. Sit at one at sunrise, at sunset and under the stars.
  Sit still by day and see who turns up.
- Rabbit Pond, and the paths through the woods, which are dotted lines on the map.
- A summer night, for the fireflies. A fall day from the summit, for the colour.
- Whatever it is that walks the woods near The Rumor at dusk. Go very gently.
- The trail of the day, on the board outside the Saddle Lodge.
- The Snow Train at the depot, after dark, with its windows lit.
- Tom, by the Ski Bowl lodge. Visit him in every season.
- The Mayor.

## Things that are on no map

Nothing points at these. They are found by going and looking, and the Book lists one (under
Field notes, on the Pack page) only once it has been found. Whatever is found is pencilled
onto your own map.

- Tin boxes on posts at the far ends of things, each with a logbook to sign.
- Brass plaques beside trails that say why the trail is called that. None of it is true.
- The old adit at the mine, a cellar hole in the woods, the rope tow's engine. Keys lie in
  them. Some doors in town and at the mine are locked.
- A cairn on each summit takes one stone a day. The bell on Gore is heard in town.
- In winter, a line of prints leaves a trail high on the mountain. Follow it. Go back in spring.
- In spring, buckets hang on the maples somewhere in the woods. Follow those.
- A column of smoke over the trees, in a different place every day. Somebody is camping.
- A painter at one of the views, a different one each day, by daylight.
- Orange ribbon tied round a birch beside a trail: the top of a way down that has no name.
- A light at the old quarry after dark. Walk.
- Once the bandstand is built: music in the woods, and then on Saturday evenings.
- Pip, once she has no more errands, hides somewhere new each day. Ask in town.
- On a real foggy morning, go up. On the nights of the real meteor showers (the Leonids are
  16 to 18 November), look up. The northern lights are out some clear nights from fall to spring.
- Walk the same way through the woods a few times and look at the ground.
- `weather=fog`, `sky=meteors` and `sky=aurora` in the address show the last three without waiting.

## New to feel for

- Loose snow. Off the groomed trails there is always some; after a real snowfall there is
  more, and some on the trails too. You sink into it, cut a trench and throw snow in a turn.
  `powder=30` in the address makes it a deep day, `powder=0` a bare one.
- Speed lines, from a little faster than poling. Say if there are too many or too few.
- The sheets, the Book's pages and the buttons move a little now.
- A patch earned for the first time is sewn on, in the announcement and in the Book.

## What only the phone can show

The tools here draw with the fallback renderer and cannot present WebGPU, so these are yours.
(The print, the outlines and the made models have been looked at on the phone and are right, and
the benchmark of 2026-11-12 holds 60 fps at every step.)

- **The ground at your feet.** It is drawn a new way: clean curved edges between its
  colours, and small printed marks on it (lines on the trails' snow, leaves in fall, tufts
  and daisies in summer). This is the one thing drawn by a shader of the game's own, so it
  is the likeliest to look wrong on the phone: say if the ground is black, striped, or
  flickers. Settings > For testing > Ground up close switches between the marks, clean
  edges alone, and the ground as it was drawn far off, to compare. Are the marks the right
  size and number? Too busy at speed?
- **Shadows.** They are now one flat tone with a clean edge, by the game's other shader.
  Say if any shadow is missing, speckled, or crawls as you move.
- **Winter.** Roofs carry snow now, and ponds and the river are ice. Cars, the inn, the
  depot's platform and Main Street's sidewalks and parking places have all been dressed.
- **The other skiers** touch a pole to the snow between turns; on the bike, coast downhill
  fast and the rider stands on the pedals. A pole going in makes a small tick.
- **Poles.** On a flat stretch, push the thumb forward: the skier poles, both together, up
  to a good pace, then folds into the tuck. Is it fast enough? And at speed each new turn
  gets a touch of the pole on its inside: does it read, or is it fussy?
- **The new ski start.** Skis put on while you face up a slope, or stepped off a lift on,
  are swung round to point across the hill and a little down. To try it: walk a few steps up
  any trail, stop facing uphill, and tap `Skis`; or tap `Skis` before you ride a lift and see
  which way you point at the top. You should start to slide without doing anything.
- **Heat and battery** over twenty minutes.
- **Sound on a real speaker**, and whether it tires.
- **Offline.** After a minute or two with a signal, try aeroplane mode: the game should open,
  in any season, with every picture.

## What to tell me

- Does the flyer make you want to go somewhere? Are three leads the right number?
- Is the cabin worth coming home to? Do the shelf and the board feel like yours?
- Did you come back the next day to see what the town built?
- The people: is the talk the right length, in the right voice? Mark up any line.
- Does each season feel like a different visit? Is the bike fun?
- Does North Creek feel like a town you would walk through?
- After a week of five-minute visits: does the book still pull you back?

## Known limits

- Buildings have no insides. Everyone stands outside their door.
- The river and ponds are painted on the ground: out of winter you wade across them to the
  knees, and in winter they are snow like anywhere else.
- Settings > For testing > Go to earns stamps like arriving any other way, and will fill your
  book with things you did not earn.
- A season or an hour pinned from Settings earns no condition patches. A season reached by
  Snow Train does.
- Restoring a save code replaces the whole book.
