# Gore

A cozy 3D collectathon on the real Gore Mountain and North Creek, NY. Web app for iPhone Safari,
installed to the Home Screen and played upright with one thumb. The full design is in `docs/game-plan.md`; read it before design work.

## Pillars

1. Unhurried: no timers, fail states, or grind.
2. A real place, lovingly compressed: real terrain, real trail names, in the right places.
3. Movement is the joy: skiing and hiking must feel good with nothing to collect.
4. Every outing fills the book: a 3 to 10 minute session ends with a new stamp or stone.
5. The mountain follows the calendar.

## Commands

```
npm run dev          # local dev server
npm test             # unit tests (Vitest)
npm run build        # type-check and build to dist/
npm run world        # regenerate public/world/ from USGS and OpenStreetMap (needs Python deps)
node tools/shot.mjs out.png "at=summit&trees=20000"   # screenshot the built game (upright phone size)
node tools/shot.mjs out.png "" 402 874 2 "document.getElementById('book-button').click()"   # ...after running a script in the page
node tools/touch-check.mjs                            # emulated-phone touch test of the built game
node tools/bench-check.mjs                            # runs the in-game benchmark end to end (slow)
node tools/webgpu-smoke.mjs                           # first frames through WebGPU raise no errors
NODE_USE_ENV_PROXY=1 node tools/art/make-art.mjs      # paint any missing portraits and plates (needs the fal key)
node tools/census.mjs "at=depot" "at=summit"          # where the draw calls go, by part of the scene
node tools/tour.mjs out "me=0&zoom=0.4" person:tom place:cafe pos:2114,-1906,2.4   # many pictures from one load
```

Run `npm test`, `npm run build`, `node tools/touch-check.mjs` and `node tools/webgpu-smoke.mjs`
before pushing. Every push deploys
to GitHub Pages, and the owner playtests on an iPhone 17 Pro.

## How to work here

- **Look at what you build.** Take a screenshot with `tools/shot.mjs` after any visual change and
  read it. Headless Chromium uses software WebGL, so its frame rates are meaningless; only the
  phone's numbers count.
- **The phone renders with WebGPU; the tools cannot show it.** Headless Chromium here starts
  WebGPU but cannot present it, so screenshots and checks run the WebGL 2 path, and
  `tools/webgpu-smoke.mjs` only confirms the first WebGPU frames raise no shader or pipeline
  errors. The browser destroys its WebGPU device a moment after those frames; the check expects
  that and says how many frames were drawn first. Prefer plain
  three.js materials (colour, map, vertex colours) that behave the same on both paths, and tell
  the owner when a change touches rendering so they look for breakage.
- **Every state is a URL.** Debug options live in `src/config.ts` and are read from the query
  string (`season`, `time`, `weather`, `at`, `pos`, `yaw`, `pitch`, `zoom`, `ski`, `trees`, `dpr`, `shadows`, `stride`, `view`, `renderer`,
  `hud`, `me`, `stats`, `intro`, `shortpage`, `bench`, `benchsecs`). `at` takes a place (`summit`, `depot`) or one of the
  town's named places (`copperfield-inn`, `cafe`, `johnsburg-town-hall`: the ids in
  `src/world/townPlaces.ts`), and stands the player across the street from its door. Add new ones there rather than hard-coding. `window.__gore` exposes state
  (including the book's counts, the stones lying nearby and the last announcement) and a few
  actions (`teleport`, `place`, `face`, `setView`) for scripts.
- **The world is generated, not edited.** `public/world/` comes from `tools/terrain/build_world.py`:
  heights, the trail mask, where no trees grow (`open.bin.gz`: roads, lots, paths, water) and how
  much of the forest is hardwood (`forest.bin.gz`), all gzipped (`src/world/codec.ts` reads
  them); and for each season `ground-<season>.png` (the ground up close: trails, forest floor,
  rock, with roads, paths and water painted in) and `canopy-<season>.png` (the forest as seen
  from afar). `world.json` also lists paths, roads, the town's buildings, ponds and named spots.
  Change the script and rerun it; never hand-edit the outputs. Trail and lift names come from
  OpenStreetMap, not memory.
- **Content is data.** Trails, lifts, places, and later minerals and stamps live in data files with
  tests that validate them.
- **Logic gets unit tests; feel gets the owner's thumbs.** Keep pure logic (heightfield, trails,
  input maths, save data) free of three.js so it runs under Vitest in Node.
- **One import source for three.js:** `three/webgpu`. The renderer is `WebGPURenderer`, which falls
  back to WebGL 2 by itself.
- **The mountain is too big to build all at once.** Terrain tiles (`src/world/terrainMesh.ts`) and
  forest patches (`src/world/trees.ts`) are built as the camera comes near, a couple per frame,
  and dropped when it leaves; a teleport builds its surroundings in one go. Beyond the range where
  trees are drawn, terrain wears the canopy texture instead. Anything new that covers the whole
  mountain (rocks, minerals, signs) must follow the same pattern rather than exist everywhere.
- **The ground you see is the ground you stand on.** `Heightfield.heightAt` uses the same
  triangle split as `buildTerrain`. Keep them in step.

## Seasons

The mountain follows the calendar (`src/look/season.ts`, pure and tested): winter from 10 November,
spring from April, summer from June, fall from mid-September.

- A season is a repaint of the same mountain, not a different one. The pipeline paints the ground
  and the far-off forest for each; the game loads the pair for the season it is in. Trees stand
  in the same places all year.
- Winter is the look the owner chose and is left exactly as it was: every tree a snowy fir. Out
  of winter each tree is dressed from `SEASON_LOOK`: spruce and fir stay green, and the hardwoods
  of the lower slopes are bare or budding in spring, green in summer, and red, orange and gold in
  fall. The dress is a colour per tree (instance colour over a plain grey tree) and a change of
  proportions, so it costs no extra draw calls.
- `seasonPalette()` recolours the land beyond the map and the ski or tyre track; the sky and the
  light stay those of `palette.ts`.
- The air (`src/world/snowfall.ts`) carries snow in winter and rain otherwise, leaves on a fair
  fall day and fireflies on a summer night.
- Skiing belongs to the snow. In spring the trails keep it, in ribbons through bare woods
  (`SPRING_SKI`: off the snow, skis crawl). In summer and fall the way down is a mountain bike
  (`BIKE`): the same simulation as skiing with other numbers, where pedalling stands in for
  poling. The button by the left thumb reads Skis or Bike to suit.
- `season=winter|spring|summer|fall` pins a season from the address or Settings, like `time` and
  `weather`. The tools pin winter unless told otherwise.
- After a change to trees, ground or light, look at all four:
  `node tools/shot.mjs out.png "season=fall&at=base-lodge&pitch=0.22"`.

## Time of day and weather

The owner chose the game's look from four tried on the phone: warm low-sun light with violet
shadows, and a quiet white when it is overcast or snowing. The game is one family of looks that
moves between those with the real time of day and the real weather at Gore.

- `src/look/sun.ts` works out where the sun is over Gore at any moment. `src/look/weather.ts`
  fetches the real sky from Open-Meteo (the request names only the mountain) and invents weather
  when that fails. `src/look/palette.ts` turns the sun's height and the weather into a palette by
  blending hand-tuned moments: night, twilight, golden hour, day, and snow by day and by night.
  All three are pure and tested. Change the look by editing the palettes there.
- `src/look/atmosphere.ts` paints a palette onto the scene (sky, sun or moon, light, haze, far
  hills) ten times a second. Haze also sets how far anything is drawn.
- Trees and snow are neutral in colour so they take on the colour of the light. Keep new models
  the same: no baked-in sunlight or shadow.
- Gore faces east, so dawn lights the trails and evening puts them in shade under a warm sky.
  That is true to the mountain; do not "fix" it.
- `time=dawn|midday|evening|dusk|night` and `weather=clear|cloudy|snow` pin a moment for trying
  things out, from the address or from Settings. They are not remembered: the game goes back to
  the real clock and sky when it is next opened. The tools pin midday and a clear sky unless told
  otherwise, so screenshots and checks do not depend on when they run.
- Art direction is the owner's call. Offer options to compare on the phone; do not settle it alone.
- After a change that affects light or colour, screenshot several moments, not one:
  `node tools/shot.mjs out.png "time=dusk&weather=snow&at=summit"`.

## Models

Everything in the game is built in code from simple shapes. There are no model or texture files
beyond the pipeline's ground pictures, and nothing needs Blender yet.

- `src/world/shapes.ts` joins coloured blocks and roofs into one geometry that draws in a single
  call and can be instanced. Lodges, huts, the depot and the fire tower (`src/world/buildings.ts`),
  the houses of North Creek (`src/world/town.ts`: one house stretched to each real footprint,
  painted per house),
  lift towers (`src/world/scenery.ts`) and chairs and cabins (`src/world/liftCars.ts`) are made
  this way. Windows are a separate unlit mesh whose colour follows the palette's `lamps`, so they
  glow after dark and in falling snow.
- `src/world/built.ts` puts together everything people have built apart from the lifts (lodges,
  the town, the train, lamps, signs, snow guns, smoke) and gives the game one group to add, one
  list of walls, `setLamps` for the hour and `update` for what moves. Add new structures there.
- The places with names have buildings of their own. `src/world/townPlaces.ts` (pure, tested)
  lists them, ties each to a real footprint or named point on the map, turns it to face its road
  and gives it a door; `src/world/townKit.ts` builds each from a kit by style (inn, store, post
  office, church, hall, barn, cafe, deli, mill, cabin and so on) with its front at its own +z.
  All of them are joined into two meshes, walls and windows. Add a place by adding a listing.
- Every word in the world is painted by `src/world/signs.ts` onto one canvas and drawn as one
  mesh: shopfronts, the depot's name, the train's, and a board at the top of every named trail
  and the foot of every lift (`src/world/trailSigns.ts`, pure, tested; posts in `signPosts.ts`).
  A sign is a `SignSpec`; give it a `width` for a board of a set size.
- `TownPlaces` also takes the season, and dresses the doors for it: a wreath and a string of
  lights in winter (the lights are in the windows mesh, so they come on at dusk), tubs of
  flowers in spring and summer, pumpkins in fall. Lamps down Main Street, benches by the doors
  and a welcome sign at each end of town (`src/world/streets.ts`, pure, tested;
  `streetFurniture.ts`) are joined into the same two meshes.
- Smoke rises from the chimneys that are lit (every season but summer) and steam from the
  engine (`src/world/smoke.ts`): one instanced mesh, moved every frame, drawn only near the
  player. A kit reports its chimney tops as `flues`.
- Outside the lodges (`src/world/yards.ts`) there are racks of skis in the snow months and
  picnic tables otherwise. In winter and spring snow guns stand down the edges of the wide
  groomed trails (`src/world/snowGuns.ts`, pure, tested): one instanced mesh.
- The town's plain houses (`src/world/town.ts`) are one unit house stretched to each footprint.
  Its walls go on down below the floor so a house on a slope has no gap under it.
- The lifts (`src/world/scenery.ts`) are four draw calls for the whole mountain: towers and
  crossarms instanced, every cable in one set of lines, and one mesh for the gates, the
  stations at each end, the attendants' shacks and the carpets' belts.
- The depot stands on the real station's plot, lengthways along the rails, and the Snow Train
  stands beside its platform (`src/world/railway.ts`, pure, tested; `train.ts` for the model).
  The train is joined into the town's meshes and is as solid as a house.
- The skier (`src/player/skier.ts`) is rigid parts jointed at hips, knees, shoulders and elbows.
  `src/player/pose.ts` (pure, tested) gives the joint angles for walking, a ski stance, a tuck, a
  hockey stop and sitting on a chair; the player eases between them. Add a new action as a pose
  there, not as keyframes.
- Keep colours flat and neutral so the light does the colouring, and keep the skier's jacket the
  most saturated thing on screen.

## Skiing

- The simulation is `src/player/skiPhysics.ts`: pure, fixed-step, tested. The skier's velocity and
  the way the skis point are separate: edges pull the path into line with the skis up to a limit
  (carving), beyond which the skis drift (momentum), and braking swings the skis broadside (hockey
  stop). All tuning numbers are in `SKI` there. Change feel by changing those, then check the
  tests still describe what you want.
- `SKI_REPORT=1 npx vitest run src/player/skiPhysics.test.ts --reporter=verbose` skis a robot down
  real trails and prints length, time and speed for each. Use it to judge a tuning change before
  the owner tries it.
- One thumb: left and right steer, up tucks (and poles from a standstill), down is a hockey stop.
- The camera follows the direction of travel, not the skis, so it holds steady through a stop.
- No fail states: the skier can always stop, always get going again on the flat, and never slides
  backwards. A tree is a bump, not a crash (`src/player/collide.ts`): the skier is nudged clear and
  loses speed, more the squarer the hit. Buildings are solid too (`src/world/walls.ts`).
- Skis leave tracks (`src/world/tracks.ts`): thin lines when carving, wide scrapes when skidding.
  The last 900 m or so stay on the snow.

## Lifts

- `src/world/lifts.ts` holds the maths (pure, tested): where each cable runs, where a rider is
  along it, which station the player is standing at, and the corridor kept clear of trees.
- A ride is offered by the action button (`Hud.setAction`) at a lift's bottom station. Use the same
  button for anything else the player can do where they stand.
- Riders go up on the right of the towers at 30 m/s, so the longest ride is about a minute, and
  the camera levels out to look up the mountain. The player gets off as they got on: on foot or
  on skis.
- Chairs and gondola cabins travel every lift on a shared lift clock. A rider boards the chair
  that is leaving the station and is placed from the same clock, so they stay on it. Inside a
  gondola cabin the rider is hidden. Magic carpets and the J-bar carry the rider along the snow,
  standing, with no towers or chairs.

## Collecting

- The rules are in `src/game/`, pure and tested, with no DOM or three.js: `passport.ts` (trail
  checkpoints and stamps, summits, landmarks, conditions), `minerals.ts` (the minerals, the kinds
  of ground they lie in, and the day's scatter), `save.ts` (the save, read defensively, and the
  save code) and `game.ts`, which ties them together: `main.ts` tells it where the player is and
  what they are doing, and it returns what that earned.
- Trails are stamped by skiing (or riding) past nine in ten of their checkpoints, with progress
  kept between runs. The named paths through the woods are stamped the same way, on foot or
  however the player likes. Lifts are pinned on arrival at the top. Landmarks are earned by being
  there, and each summit has a patch for every season. The first visit to each season is a stamp.
  Conditions, some of them particular to a season, are earned by skiing or riding under the real
  calendar, clock and sky only, never a pinned one.
- Stones lie in four kinds of ground: on the groomed snow (so skiing a trail meets them), beside
  the trails, in steep bare rock and in deep woods (the rarer ones, which take a detour). They
  are laid out patch by patch from the date and the place, so the day's scatter is the same on
  every load and new at midnight. `FIND_REPORT=1 npx vitest run src/game/minerals.test.ts`
  prints how many lie on the real mountain, by kind of ground. Change density with `KEEP` and
  `TRIES` in `minerals.ts`, then check that report.
- The field guide is `src/game/wildlife.ts`: some forty animals, birds, plants and curiosities,
  each with the kinds of ground, seasons and watches of the day (dawn, day, dusk, night) it keeps
  to. Sightings are scattered like stones, but change with the watch as well as the day. Coming
  close enters one in the guide; a shy creature come upon faster than `GENTLE_SPEED` bolts
  unseen. `src/world/country.ts` is the world as wildlife sees it. `FIND_REPORT=1 npx vitest run
  src/game/wildlife.test.ts` prints how many of each are about in every season and watch.
- `src/world/critterModels.ts` builds each species from blocks (a few body plans: four legs, a
  bird, a clump of plants) and `src/world/critters.ts` shows the ones near the player: one small
  mesh each, drawn within 280 m, with a pale blue mark over anything not yet in the guide. A new
  species needs an entry in `SPECIES` and a model; tests check both exist.
- `src/world/glints.ts` draws the stones near the player: one instanced mesh coloured per
  instance, and one of unlit gold twinkles, two draw calls in all. Stones, the dressed trees of
  spring, summer and fall, and the town's houses all take their colour per instance; the owner
  has yet to confirm that on the phone's WebGPU.
- `src/ui/book.ts` is the Book sheet (Passport, Minerals, Guide and Pack pages) and `src/ui/toasts.ts` the
  announcements at the top of the screen. With `hud=0` announcements are hidden too.
  Landmarks are postcards: blank until visited, then a picture (`public/art/places/`).
- The book is saved in `localStorage` under `gore.book`, at most once a second and when the game
  is put away. Add to the save by adding a field that `parseSave` fills in when it is missing;
  never change the meaning of an existing one. Settings can copy the book out as a save code and
  restore from one.
- New things to collect are data: add them to the tables in `passport.ts` or `minerals.ts`, with
  a test, and the Book lists them.

## People and errands

- `src/game/people.ts` is the cast, their lines, their errands and the things to wear, all as
  data. `Game.talk()` decides what someone says: a greeting the first time, thanks for an errand
  done, a thing handed over, a reminder, a new errand, or small talk, in that order.
- An errand reads its need from the book (stones found, species seen, stamps earned) or from a
  carried item; nothing is ever handed in and lost. Errands are never timed and cannot be failed.
  Rewards are hats and jackets, worn from the Pack page of the Book. Add an errand by adding it
  to `ERRANDS`; the tests check that everything it names exists on the real mountain.
- Where someone stands is a description (`by a place's door`, `at the foot of a lift`, `along a
  road`), turned into a position by `src/world/whereabouts.ts`, so it survives a regenerated
  world. Lost property is placed the same way and lies out only while its errand is in hand.
- `src/world/folk.ts` draws the people: the player's own jointed figure in another outfit, posed
  once and joined into a single mesh, so each costs one draw call. A gold mark hangs over anyone
  with something for the player. `src/ui/talk.ts` is the sheet they speak in, with their
  portrait; anything written (a letter, a notice) is shown as handwriting on ruled paper.
- Each has a face and features of their own (`look.features`: hair, a beard, glasses, an apron,
  a patrol cross, a child's height), built onto the figure by `Skier`. The player has none:
  goggles, as ever.
- Not everyone is a person. A `kind` of `board` is read, a `dog` or `cat` is petted, and the
  `snowman` is Tom, who is a snowman in winter, a heap in spring and a scarecrow after that.
  A `prop` (the groomer's snowcat, the patroller's sled) is one more mesh beside its owner.
- Someone whose whereabouts fall at one of the town's named places stands by its front door.
- People remark on the moment (`moods`: snowing, raining, night, dawn, dusk) before small talk,
  and once a day on what the player has on (`wearing`, by gear id).
- The town round (`TOWN_ROUND`): calling at the post office, the inn, the bakery, the deli and
  the library in one day is counted, and shown as a punch card on the Pack page.
- The town gives small things daily, all data: a letter at the post office
  (`src/game/letters.ts`, sent once what it mentions has happened), the inn's rumour of a rare
  stone lying at a named spot (`Game.rumour`), and one new bake, sandwich or library book from
  June, Walt and Fenn (`src/game/offerings.ts`; every sandwich is named after a real trail and
  the library's books are true). They are kept on the Pack page.
- The second action button (`Hud.setTalk`) is for talking and for the shuttle, and sits above
  the first when both are offered, as beside a lift.
- The shuttle carries the player between the Base Lodge, the Ski Bowl and the depot. The Snow
  Train, once its pass is earned from Conductor Bea, carries them to another season: the choice
  is kept in the save (`away`) and the game reopens in it. The `season` option still overrides.

## Sound, hints and patches

- The church in town strikes the hour, by the real clock at Gore, for anyone within earshot,
  and the Snow Train whistles before it leaves. Neither happens under a pinned time.
- Sound is made in code (`src/audio/`): no sound files. `soundscape.ts` (pure, tested) works out
  how loud the wind, the skis, a lift and the rain should be for what the player is doing, and
  the tune for each kind of thing earned; `sound.ts` plays them with Web Audio. It starts on the
  first touch, as browsers require, and Settings turns it off. Keep it quiet: it is there to make
  movement feel like movement.
- `Game.hint(id)` is true once. `main.ts` uses it for the welcome and for a hint the first time
  each thing comes up. `intro=0` turns both off; the tools set it.
- `src/game/patches.ts` lists the patches for finishing a whole kind of thing. They are checked
  once a second against a tally of the book. Add one as a line of data.
- `public/sw.js` keeps a copy of the game for playing with no signal. It asks the network first
  and falls back to its copy, so a new push is never hidden by an old one. It is registered only
  over https, so the dev server and the tools never see it.
- Settings lead with what a player wants (the save code, sound, camera distance). Everything for
  testing is below the "For testing" line; put new debug options there.

## Pictures and lettering

- The portraits on the talk sheet and the plates in the Book are painted by an image model
  through fal (`tools/art/`): `manifest.mjs` holds one prompt per person, mineral and species
  and the one look they share; `make-art.mjs` asks for whatever is missing, trims it and saves
  a small WebP under `public/art/`. A test checks that everyone and everything has a picture.
  `--redo id,id --bump 1` paints one again with another seed.
- The prompts never name the game, the mountain's owner or the player. The key is never in the
  repo: here it is a network secret on the environment, sent by the session's proxy.
- The interface has a look of its own, set out at the top of `src/style.css`: paper, ink and
  enamel colours as variables, Bebas Neue for headings and buttons, Caveat for anything
  handwritten, both bundled from `@fontsource`. Use the variables; do not add new colours or
  faces without the owner's say.

## Trail map

- The Map button opens `src/ui/trailMap.ts`, a bottom sheet drawn on a 2D canvas over the
  pipeline's canopy picture. West is up, so the summit is at the top as on a ski map; the
  projection is `src/ui/mapView.ts` (pure, tested).
- It shows every trail by difficulty, every lift with a ring where you board, the paths through
  the woods as dotted lines, the main places, an arrow for the player, and a gold diamond for
  anyone with something for the player (`TrailMap.marks`). Tapping any of them names it.

## Measuring performance

- The owner measures on the phone with Settings > Run benchmark, which steps through fixed settings
  (`src/debug/bench.ts`) and ends with a block of text to paste back. Change the step list when a
  new question needs answering; run `node tools/bench-check.mjs` after touching it.
- Read the results by frame-time bucket, not only by fps. Frames land on the display's refresh
  grid: 17 ms is on time at 60 fps, 25 ms and 33 ms are late frames.
- `cpu` is time spent in our own frame callback. Late frames with a small `cpu` mean the delay is
  in the browser or GPU, not the game's code.

## Portrait and one thumb

The game is designed only for an upright phone (402 x 874 points on the owner's iPhone 17 Pro).

- Everything must be playable with one thumb. A second finger may add convenience, never necessity.
- Things to read go at the top; things to press go in the bottom third, at least 44 points tall;
  menus are bottom sheets. Respect the safe-area insets. The bottom row is Skis, Map and Book;
  testing aids such as fast travel live in Settings.
- The bottom third of the screen is the movement stick; everything above turns the camera.
- Everything on screen lives in `#app`, which is sized by hand; nothing is pinned to the page
  (`position: fixed`, `height: 100%` on the body). From the Home Screen, iOS lays the page out
  shorter than the screen it shows. The note at the top of `src/style.css` explains the scheme:
  the picture fills the screen, and controls keep within the part the page is sure to cover.
  Attach new overlays to `#app`, and use `--bottom-clear` for anything placed near the bottom.
- The camera sits well back and high, so the player is small (about 6% of the screen height) and
  sits just below the middle, above where the thumb rests. Framing
  and lens come from `framingFor()` in `src/player/cameraMath.ts`; touch zones from
  `src/input/zones.ts`.
- Screenshots default to the upright phone size. Judge composition in that shape, not on a wide
  desktop window. Wide screens only need to work for development.

## Conventions

- Coordinates: +x east, +z south, +y up, in game metres. The world is centred on the origin.
- Scale: close to life size. 1:1.2 horizontal and 1.25:1 vertical against the real mountain (set
  in the terrain script), so slopes read 1.5 times steeper than life. The world is about 5.6 by
  4.3 km with 990 m of relief; heights are sampled every 3.3 m. The skier is about 1.4 m tall and
  trees 8 to 15 m.
- Camera yaw 0 looks north (-z); positive yaw turns left.
- Placement is seeded (`src/rng.ts`) so the world is identical on every load.
- No secrets in the repo. The fal key lives in environment secrets or a gitignored `.env`.

## Performance budget

60 fps; under 150 draw calls and 300k triangles on screen; pixel ratio capped at 2; instancing for
anything repeated; first load under 15 MB.

Since that was measured, a great deal has been added (seasons, the town, wildlife, people, signs,
the train), none of it yet measured on the phone. In headless runs a view from a lodge or the
depot draws 180 to 310 calls, over the target above; the owner's next benchmark will say
whether that matters. `node tools/census.mjs` shows where they go: terrain tiles (252 on the
mountain, those in view drawn) and forest patches are most of it; the player's figure is about
twenty; the lodges, the town, the lifts, the signs and the train are a dozen between them.
If the phone says it matters, the far terrain tiles are the place to start (join them into
larger pieces), then the player's figure (join the parts that move together).

Measured on the owner's iPhone 17 Pro (2026-11-10, Home Screen app) with the mountain at near
life size: a steady 60 fps at every benchmark step, including the thick forest (623k triangles,
104 draw calls), shadows, and pixel ratio 3, using about 4.4 ms of CPU per frame. WebGPU and
WebGL 2 performed the same. The benchmark turns the camera on the spot, so it does not measure
the cost of building terrain and forest while travelling. The budget above is kept as a
deliberately cautious target so there is room for effects, and for heat and battery over a long
session, which a five-second measurement does not show.
