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
  string (`time`, `weather`, `at`, `pos`, `yaw`, `pitch`, `zoom`, `ski`, `trees`, `dpr`, `shadows`, `stride`, `view`, `renderer`,
  `hud`, `shortpage`, `bench`, `benchsecs`). Add new ones there rather than hard-coding. `window.__gore` exposes state
  (including the book's counts, the stones lying nearby and the last announcement) and a few
  actions (`teleport`, `place`, `face`, `setView`) for scripts.
- **The world is generated, not edited.** `public/world/` comes from `tools/terrain/build_world.py`:
  heights and the trail mask (gzipped; `src/world/codec.ts` reads them), `ground.png` (the snow's
  colour up close: bright trails, shaded edges, bare rock) and `canopy.png` (the forest as seen
  from afar).
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
  lift towers (`src/world/scenery.ts`) and chairs and cabins (`src/world/liftCars.ts`) are made
  this way. Windows are a separate unlit mesh whose colour follows the palette's `lamps`, so they
  glow after dark and in falling snow.
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
  loses speed, more the squarer the hit.
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
- Trails are stamped by skiing past nine in ten of their checkpoints, with progress kept between
  runs. Lifts are pinned on arrival at the top. Summits and landmarks are earned by being there.
  Conditions are earned by skiing under the real clock and sky only, never a pinned moment.
- Stones lie in four kinds of ground: on the groomed snow (so skiing a trail meets them), beside
  the trails, in steep bare rock and in deep woods (the rarer ones, which take a detour). They
  are laid out patch by patch from the date and the place, so the day's scatter is the same on
  every load and new at midnight. `FIND_REPORT=1 npx vitest run src/game/minerals.test.ts`
  prints how many lie on the real mountain, by kind of ground. Change density with `KEEP` and
  `TRIES` in `minerals.ts`, then check that report.
- `src/world/glints.ts` draws the stones near the player: one instanced mesh coloured per
  instance, and one of unlit gold twinkles, two draw calls in all. This is the one place that
  uses per-instance colour; the owner has yet to confirm it on the phone's WebGPU.
- `src/ui/book.ts` is the Book sheet (Passport and Minerals pages) and `src/ui/toasts.ts` the
  announcements at the top of the screen. With `hud=0` announcements are hidden too.
- The book is saved in `localStorage` under `gore.book`, at most once a second and when the game
  is put away. Add to the save by adding a field that `parseSave` fills in when it is missing;
  never change the meaning of an existing one. Settings can copy the book out as a save code and
  restore from one.
- New things to collect are data: add them to the tables in `passport.ts` or `minerals.ts`, with
  a test, and the Book lists them.

## Trail map

- The Map button opens `src/ui/trailMap.ts`, a bottom sheet drawn on a 2D canvas over the
  pipeline's canopy picture. West is up, so the summit is at the top as on a ski map; the
  projection is `src/ui/mapView.ts` (pure, tested).
- It shows every trail by difficulty, every lift with a ring where you board, the main places, and
  an arrow for the player. Tapping a trail or lift names it.

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

Measured on the owner's iPhone 17 Pro (2026-11-10, Home Screen app) with the mountain at near
life size: a steady 60 fps at every benchmark step, including the thick forest (623k triangles,
104 draw calls), shadows, and pixel ratio 3, using about 4.4 ms of CPU per frame. WebGPU and
WebGL 2 performed the same. The benchmark turns the camera on the spot, so it does not measure
the cost of building terrain and forest while travelling. The budget above is kept as a
deliberately cautious target so there is room for effects, and for heat and battery over a long
session, which a five-second measurement does not show.
