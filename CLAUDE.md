# Gore

A cozy 3D collectathon on Gore Mountain and North Creek, NY. Web app for iPhone Safari,
installed to the Home Screen and played upright with one thumb. The design as it stands is in `docs/game-plan.md`; read it before design work. `docs/history.md`
is the plan it started from and a diary of how it was built: a record, not a description.

The owner wants the feel of a cozy collecting game in the manner of Animal Crossing: soft,
friendly, a pleasure to fill shelves in. The mountain's general geography and its trail map
are kept true; beyond that, charm comes before accuracy. Buildings, shops and the town's
details may be invented.

## Pillars

1. Unhurried: no timers, fail states, or grind.
2. A real mountain, a storybook town: real terrain, real trail and lift names in the right
   places; the buildings, shops and everything small are made to be charming, not accurate.
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
node tools/shot.mjs out.png "" 402 874 1 "<script>" "$(cat save.json)"                       # ...starting from a given book
node tools/touch-check.mjs                            # emulated-phone touch test of the built game
node tools/bench-check.mjs                            # runs the in-game benchmark end to end (slow)
node tools/webgpu-smoke.mjs                           # first frames through WebGPU raise no errors
node tools/offline-check.mjs                          # with no network, the game opens in a season it has never loaded
NODE_USE_ENV_PROXY=1 node tools/art/make-art.mjs      # paint any missing portraits, postcards and room pictures (needs the fal key)
NODE_USE_ENV_PROXY=1 node tools/art/make-patches.mjs  # make any missing sheets of patches for the Book (needs the Tripo key)
NODE_USE_ENV_PROXY=1 node tools/models/make-models.mjs # picture, then shape, then low-poly model, for the field guide's made models
NODE_USE_ENV_PROXY=1 node tools/art/make-ground.mjs   # paint any missing sheets of ground marks, and lay them out (needs the fal key)
NODE_USE_ENV_PROXY=1 node tools/art/make-title.mjs    # the four posters on the way in, one sheet (needs the Tripo key)
node tools/art/make-icon.mjs                          # render the Home Screen icon from tools/art/icon.svg
node tools/census.mjs "at=depot" "at=summit"          # where the draw calls go, by part of the scene
node tools/tour.mjs out "me=0&zoom=0.4" person:tom place:cafe pos:2114,-1906,2.4   # many pictures from one load
node tools/tour.mjs out "me=0" secret:den roamer:nell run:run-1                    # ...of a secret, of someone who roams, of the top of an unmarked run
NODE_USE_ENV_PROXY=1 node tools/art/make-paintings.mjs  # the painter's views, four seasons to a sheet (needs the fal key)
```

Run `npm test`, `npm run build`, `node tools/touch-check.mjs` and `node tools/webgpu-smoke.mjs`
before pushing (and `node tools/offline-check.mjs` after touching `public/sw.js` or the build).
The tools that drive a browser need Playwright and its Chromium, which are not dependencies of
the game: cloud sessions have them; elsewhere, `npm install --no-save playwright && npx
playwright install chromium`. The deploy itself runs only the unit tests and the build.
Every push deploys
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
  the owner when a change touches rendering so they look for breakage. Two things have a
  shader of the game's own, both in three.js's shading language, which becomes WGSL or GLSL:
  the ground near the camera (`src/world/groundMaterial.ts`; `ground=flat` in the address, or
  Settings, draws the ground without it) and the edge of a shadow (`src/look/printShadow.ts`;
  `look=plain` or `shadows=0` goes without).
- **Every state is a URL.** Debug options live in `src/config.ts` and are read from the query
  string (`season`, `time`, `weather`, `at`, `pos`, `yaw`, `pitch`, `zoom`, `ski`, `trees`, `dpr`, `shadows`, `stride`, `view`, `renderer`,
  `hud`, `me`, `siding`, `crowd`, `look`, `ground`, `models`, `zoo`, `flyer`, `sky`, `stats`, `intro`, `shortpage`, `bench`, `benchsecs`). `at` takes `home` (the player's cabin, and the default), a place (`summit`, `depot`) or one of the
  town's named places (`copperfield-inn`, `cafe`, `johnsburg-town-hall`: the ids in
  `src/world/townPlaces.ts`), and stands the player across the street from its door. Add new ones there rather than hard-coding. `window.__gore` exposes state
  (including the book's counts, the stones lying nearby, the last announcement and who else is about) and a few
  actions (`teleport`, `place`, `face`, `setView`) for scripts.
- **The world is generated, not edited.** `public/world/` comes from `tools/terrain/build_world.py`:
  heights, the trail mask, where no trees grow (`open.bin.gz`: roads, lots, paths, water) and how
  much of the forest is hardwood (`forest.bin.gz`), all gzipped (`src/world/codec.ts` reads
  them); and for each season `ground-<season>.png` (the ground up close: trails, forest floor,
  rock, with roads, paths and water painted in) and `canopy-<season>.png` (the forest as seen
  from afar). `world.json` also lists paths, roads, the town's buildings, ponds and named spots.
  Change the script and rerun it; never hand-edit the outputs. Trail and lift names come from
  OpenStreetMap, not memory; `tidyName` (`src/world/names.ts`) only closes up doubled spaces
  and the like when they are loaded, and the save reads its trail names the same way.
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
- In winter every tree is a snowy fir (printed: spruce below, snow in shade on the middle
  boughs, snow in the light at the top). Out of winter each tree is dressed from `SEASON_LOOK`: spruce and fir stay green, and the hardwoods
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
  On a clear night it brings out the stars: a few hundred small diamonds, the same ones every
  night, that fade in by taking their colour from the sky, as the sun's disc does. No transparency.
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

Nearly everything in the game is built in code from simple shapes; the animals are made
outside it. The only pictures the world is drawn with are the pipeline's ground pictures, the
sheets of marks printed on the ground, the shop-sign sheet and the patches set out on the
cabin's board.

### The park print

The game's look is a park print: the owner chose it, for the world and for the animals, after
trying it beside the plain look. Four things make it, and anything new must take all four.

- **Inks.** `src/look/print.ts` (pure, tested) holds the short list of inks everything made is
  coloured from (`INKS`, `inkFor`). `blocks()` brings every colour it is given to its ink, and
  so does a figure's outfit. The land has its own inks for each season
  (`src/look/worldLook.ts`), which the pipeline's two pictures are repainted in when the game
  loads. Trees keep the colours `SEASON_LOOK` gives them, a flat tone to each tier.
- **Light in steps.** Everything the sun lights asks `lit()` in `src/look/material.ts` for its
  material: three.js's own toon material with a ramp of a few tones (`PRINT_TONES`), so that
  every face is one flat tone and a hillside breaks into shapes. It has no flat shading of
  its own, so a shape that wants facets carries a normal for each face. The street's surface
  stays smoothly lit: level ground in steps is a checkerboard. Make any new lit material with
  `lit()`, never `new MeshLambertMaterial`.
- **A line round things.** `rim()` in `print.ts` makes a shape's outline: the same shape a
  little larger, inside out, in ink. It goes into the same geometry, so it costs triangles
  but no draw call. `blocks()` gives one to every block stout enough to make part of a
  model's outline (`rimmed`: not posts, rails or panes) and to ready-made pieces such as
  roofs, once: a geometry it has made is marked, and is not rimmed again when pieces are
  joined. `outlined()` in `src/world/outline.ts` does the same for a tree (only on the patches
  nearest the camera, `RIM_DISTANCE`), a stone and a lift tower; `Skier.join` for each part of
  a figure, which is how the people and the crowd get theirs. The animals bring their own.
  Nothing with a rim may be drawn two-sided: the rim would cover it.
- **A banded sky.** Bands of flat colour near the horizon under one flat field (`Atmosphere`).
- **Shadows with a clean edge.** three.js's own shadow has a soft, grainy edge; in a print a
  shadow is one flat tone. `printShadow()` in `src/look/printShadow.ts` is given to the sun's
  shadow as its filter: it reads the shadow's picture at the same nine places round every
  pixel, which gives an even slope from light to shade, and cuts the slope at its middle.
- **Clean edges and small marks underfoot.** The ground's picture is about 1.7 m to a pixel.
  Stretched over the ground at the player's feet its inks ran into one another, and its
  pixels showed as stairs; a sharper picture of each tile was tried and, a foot to a pixel,
  showed its pixels too. So the ground near the camera is not drawn from a picture. Each
  tile within about 260 m is given, for a grid of points across it, how much each of the
  season's inks weighs there (`soften` and `weigh` in `worldLook.ts`, pure, tested: a wide
  bell, so a staircase in the picture is worn to a slope, with whatever is too narrow for
  the bell, a path or a stream, kept as drawn). The ground's shader (`GroundLook` in
  `src/world/groundMaterial.ts`) reads between the points and gives every pixel of the screen
  the heaviest ink, so an edge is a clean curve at any distance; `inkAt` is the same sum in
  plain numbers. Two small textures a tile, a little over a megabyte, made over a few frames
  when the camera comes near and let go when it has left.
- Over the inks the same shader prints the season's marks (`src/look/groundMarks.ts`, pure,
  tested): brush strokes on the trails' snow as the groomer leaves them, fallen leaves in
  fall, tufts and flower heads in a summer meadow, ferns under the trees, twigs and cones.
  The shapes are painted: the owner asked for fal in place of marks drawn in code.
  `tools/art/make-ground.mjs` asks for a sheet of separate black shapes of each of seven
  kinds (`GROUND_ART` in the art manifest) and `ground-sheet.py` cuts them out and scatters
  them over a square that repeats every 16 m, `public/art/ground/<kind>.png`, a centimetre
  and a half to a pixel. The colours are not painted, which is what keeps the marks part of
  the print: each is printed flat in one of the season's own inks. `GROUND_SHEETS` says
  which four kinds a season loads (a kind to a channel of one sheet) and `GROUND_MARKS`
  which two at most each ink wears, and in which ink. Far off, a mark is less than a pixel
  and fades out by itself. Which marks, how many and how big are the owner's to mark up:
  sizes and numbers are `KINDS` in `ground-sheet.py`. `ground=edges` draws the inks without
  the marks and `ground=flat` the far-off picture alone, to set beside it (also in Settings).
- In winter the water is ice. The pipeline paints winter's ponds and rivers as snow, so
  `freeze()` in `worldLook.ts` prints them in an ink of their own (`ICE`) when the pictures
  are repainted, from the map of where the water lies, and the marks give it the scratches
  of skates and drifted snow.
- The boards and shingles on buildings (`siding()`) are flat with one hard line under each
  course, as a pen would draw clapboard. Snow on a roof has none: it reads the texture half
  way up a course (`SMOOTH` in `shapes.ts`; at the foot of one, where it once read, is the
  line, which turned every winter roof grey).
- `look=plain&models=blocks` in the address draws the game as it was before the print, for
  setting one beside the other and for the benchmark's last step. It is not in Settings.
- The print costs about three draw calls and 130,000 to 300,000 triangles in a view (the rims),
  and nothing that can be measured in frame time on the phone (see Performance budget).

### Made models

- The animals of the field guide are made outside the game. `tools/models/make-models.mjs`
  asks an image model for a picture of each animal in `tools/models/manifest.mjs`, an
  image-to-3D model (Trellis, through fal) for its shape, and `convert.py` for a game-ready
  model: stood up, made one closed solid (`seal`: a generated shape is a skin with gaps, in
  pieces, and cut down it would have holes; the owner asked for none), cut down to about a
  thousand triangles, its texture baked into a colour per face, the colours graded to the
  picture, cut to six inks and gathered into patches (`calm`), with a dark outline hull. A
  test fails if any model has an open edge or a loose piece. The converter needs Python with
  trimesh, fast-simplification, scipy, scikit-image, pymeshfix and Pillow.
- They are one small JSON file, `public/models/park.json` (65 models, about 1.3 MB), read by
  `src/world/modelFiles.ts`, and stand in for the block models in `critterModels.ts` at the
  same height. Nearly the whole field guide has one: the animals, the birds, the plants and
  mushrooms, the cairn and the snowman (the hare has two, for its two coats). The icicles and
  the Rumor are still blocks. `zoo=1` lines the animals up in front of the player and `zoo=2`
  the rest.
- The first way makes a poor job of anything made of thin things: a clump of stems comes back
  as shards. A model marked `by: 'tripo'` in the manifest is made the other way: Tripo's image
  model paints it as a chunky toy (`TRIPO.look`) and Tripo makes a shape of that picture, by
  the picture's own task id, so nothing is uploaded. It is then printed like the rest. About
  40 credits each; the owner has said Tripo may be used for models and pictures.
- A model says which inks it may be printed in (`inks` in the manifest): an animal's earths,
  a bird's (which add blue, red and yellow) or a plant's (which add greens and the colours of
  flowers). A plant is asked for growing from a little mound, so that it stands as one piece.
  A clump of thin things does not always survive being cut down, so the converter pours it
  into coarser cubes until it does: such a model comes out stouter and simpler than its
  picture. Something white is painted `against` a colour: white on white comes back from the
  shape model as a wall. When a shape comes back wrong (a box behind it, lying flat), make it
  again with `--redo id --bump n`.
- **Things people have made** that stand out on the mountain are made models too
  (`thing-*` in the manifest, `by: 'fal-tripo'`): the secrets' register, plaque, bell, adit,
  cellar hole, rope tow engine, den (and its winter self), nest, sugar shack (and its winter
  self), ribbon stump, lantern and bucketed maple, and the roamers' easel, tent, campfire and
  music stand. The owner found the same things built from blocks too blocky beside the
  animals. A picture of each is painted through fal as the same chunky toy (`FAL_TRIPO.look`),
  Tripo's model as fal serves it makes the shape, and the converter prints it in the game's
  own inks (`--inks made`: `MADE` in `convert.py` is `INKS` in `print.ts`, with a toy's
  orange wood weathered to the game's timber first) at a triangle count of its own
  (`faces`). They are not given a new skin as the animals are (`--weld`): pouring a shape
  into cubes rounds every crease and leaves the cutting-down nothing to go by, so a wall
  came out as slivers at odd angles, which the owner saw. Tripo's shapes are one closed
  solid already once the seams of their picture are joined, so their own triangles are cut
  down (`welded` in `convert.py`), scraps dropped and a pinched seam mended; one that is
  not closed after all is given a new skin, and the tool says which route each took. A made
  thing need not be one solid, the owner has said, as long as every part of it is closed:
  where a picture has things standing apart (the stool by the easel, the cart before the
  adit), each is kept, and the test allows a `thing-*` a few closed pieces where an animal
  must be one. The picture is painted three-quarters on, so a model comes back facing any of
  four ways: `turn` in the manifest is set by looking at its preview
  (`tools/models/cache/<id>.park.png`: front at the left of the side view and the top of the
  view from above). `reink` puts right an ink that printed wrong, by name.
- `madeFor` in `secretMesh.ts` says which model each secret is and how tall it stands; each
  is a mesh of its own, drawn only within `SEEN_FROM` of the player, and one model stood in
  many places (the maples, the ribbons down a run) is an instanced mesh and its outline. The
  blocks they replaced are still there, and are what is drawn with `models=blocks`. The made
  models are fetched before the secrets are built. `madeProp` in `folk.ts` does the same for
  what stands beside the people who roam. The lantern's light is its own glass, drawn unlit
  after dark (`glassOf`).
- The pets (`pet-*`) are made the first way, like the animals.
- The converter can make other looks from the same shape (faceted, smooth); the owner tried
  those and chose the park print, so they do not ship.

### Built in code

Everything else is built in code from simple shapes.

- `src/world/shapes.ts` joins coloured blocks and roofs into one geometry that draws in a single
  call and can be instanced. Lodges, huts, the depot and the fire tower (`src/world/buildings.ts`),
  the houses of North Creek (`src/world/houses.ts`: each built for what it is, to the size of
  its plot),
  lift towers (`src/world/scenery.ts`) and chairs and cabins (`src/world/liftCars.ts`) are made
  this way. Windows are a separate unlit mesh whose colour follows the palette's `lamps`, so they
  glow after dark and in falling snow.
- Walls and roofs wear courses of boards and shingles: one small texture drawn in code
  (`siding()` in `shapes.ts`) that only varies up and down and multiplies the colour under it.
  `blocks()` gives every model the coordinates for it; anything snow-coloured is left smooth.
  The lodges, the town's houses and the named places use it. `siding=0` turns it off.
- Main Street is a street. Buildings whose fronts are on it in town are shops (false fronts,
  brick blocks, two-storey porches, little storefronts), each with a trade of its own from
  `SHOP_SIGNS`, given out in order along the street so no two neighbours match. The trades are
  plain ones and none is a real business. Every front wall in town is kept back to a building
  line (`setBack` in `footprints.ts`), because several real plots sit on the centre line.
- `src/world/roadways.ts` (pure, tested) says which roads have a surface of their own: those
  in town and at the foot of the mountain. `streetSurface.ts` lays it over the ground as one
  mesh: ploughed, with the snow banked along it, in winter; blacktop otherwise; and a sidewalk
  down each side of Main Street. It lies 9 cm above the ground, which feet still stand on.
  `buildKerbside` in `streetFurniture.ts` stands parked cars, utility poles and their wires,
  hydrants (in hats, in winter) and the town's tree along it; the car parks at the Base Lodge
  fill from the lodge outward. Cars are solid. Trees keep out of the street and the car parks.
  A car is one of three kinds (a saloon, a wagon, a pickup): a body with a bonnet lower than
  its cabin, glass all round under a roof of its own paint, hubs, bumpers and lamps; snow on
  it in winter, and skis on a wagon's rack. The street's surface is marked by a small texture
  of its own (`streetMarks`): the joints of the sidewalk's slabs, and places to park along
  the kerbs of the high street.
- The lodges are each their own building (`buildings.ts`): the Base Lodge has a great hall
  with a clock, a sun deck on posts on the mountain side, ticket windows and flags; the Saddle
  Lodge is low and all windows, with a terrace of chairs; the Ski Bowl's is a green town-park
  lodge with a porch and two yurts; the lodge on Peaceful Valley Road has rooms on two
  galleries. A model may report boards (signs), flues (smoke) and whatever of it is solid
  beyond its footprint. `resort.ts` adds what makes the foot of a ski hill look like one: roped
  lanes behind every chairlift's gate, a fire with chairs round it, and a painted trail map.
- `src/world/built.ts` puts together everything people have built apart from the lifts (lodges,
  the town, the train, lamps, signs, snow guns, smoke) and gives the game one group to add, one
  list of walls, `setLamps` for the hour and `update` for what moves. Add new structures there.
- The places with names have buildings of their own. `src/world/townPlaces.ts` (pure, tested)
  lists them, ties each to a real footprint or named point on the map, turns it to face its road
  and gives it a door; `src/world/townKit.ts` builds each from a kit by style (inn, store, post
  office, church, hall, barn, cafe, deli, mill, cabin and so on) with its front at its own +z.
  All of them are joined into two meshes, walls and windows. Add a place by adding a listing.
  The inn is dressed as an old hotel: green shutters, white boards at the corners and
  between the floors, a rail along the porch roof, and a gabled front over the door. The
  depot's platform has benches, a baggage cart with a trunk and a milk can, and an order mast.
- If the signs do not all fit on their sheet at full size, `signs.ts` draws them all a little
  smaller until they do. No board is left bare.
- Every word in the world is painted by `src/world/signs.ts` onto one canvas and drawn as one
  mesh: shopfronts, the depot's name, the train's, and a board at the top of every named trail
  and the foot of every lift (`src/world/trailSigns.ts`, pure, tested; posts in `signPosts.ts`).
  A sign is a `SignSpec`; give it a `width` for a board of a set size, and a `mark` for a
  trail's mark painted beside its words, or large by itself on a board with none.
- A trail's sign stands at its mouth: a few metres down from its top and at its own shoulder
  (the nearer edge of its snow, or 8 m from its middle where the snow is wide), so it is seen
  by whoever is about to set off and can be taken for no other trail's. It is two timber
  posts with the name in navy capitals on a cream plank and, standing on top, a square
  cream panel with the trail's mark large (green circle, blue square, black diamond, two
  diamonds), to be read from across the snow. Trails that set off from the same spot share
  a post, a plank each, with a panel for every different mark among them.
- `TownPlaces` also takes the season, and dresses the doors for it: a wreath and a string of
  lights in winter (the lights are in the windows mesh, so they come on at dusk), tubs of
  flowers in spring and summer, pumpkins in fall. Lamps down Main Street, benches by the doors
  and a welcome sign at each end of town (`src/world/streets.ts`, pure, tested;
  `streetFurniture.ts`) are joined into the same two meshes.
  Where a road has water on both sides there is a bridge (`bridges` there): railings for a
  culvert, a green steel truss for the highway over the Hudson.
- Smoke rises from the chimneys that are lit (every season but summer) and steam from the
  engine (`src/world/smoke.ts`): one instanced mesh, moved every frame, drawn only near the
  player. A kit reports its chimney tops as `flues`.
- Outside the lodges (`src/world/yards.ts`) there are racks of skis in the snow months and
  picnic tables otherwise. In winter and spring snow guns stand down the edges of the wide
  groomed trails (`src/world/snowGuns.ts`, pure, tested): one instanced mesh.
- Every building on the map without a name of its own is built for what it is.
  `src/world/houseKinds.ts` (pure, tested) reads each real footprint the way a person reads a
  town: its size, what it stands beside and which road it faces make it a cape, a farmhouse, a
  camp in the woods, a shed, a barn, a shop on Main Street, or one of the ski area's own
  buildings. `src/world/houses.ts` builds each kind to the size of its plot, with nothing
  stretched, and joins everything in one part of the map into a mesh of walls and a mesh of
  windows. Add a kind by adding it to `HouseKind`, `KITS` and the choosing in `houseKinds.ts`.
  Walls go on down below the floor so a building on a slope has no gap under it.
- The lifts (`src/world/scenery.ts`) are four draw calls for the whole mountain: towers and
  crossarms instanced, every cable in one set of lines, and one mesh for the gates, the
  stations at each end, the attendants' shacks and the carpets' belts.
- The depot stands on the real station's plot, lengthways along the rails, and the Snow Train
  stands beside its platform (`src/world/railway.ts`, pure, tested; `train.ts` for the model).
  The train is joined into the town's meshes and is as solid as a house.
- The skier (`src/player/skier.ts`) is rigid parts jointed at hips, knees, shoulders and elbows.
  The parts with flesh to them (limbs, the coat, boots, the head, mittens) are faceted solids,
  not boxes: `stack()` piles rings one on another, each turned half a step, so the sides are
  triangles, as the animals' are; `Skier.join` gives every face one normal. Small things
  (goggles, hair, an apron, hat brims) are still boxes.
  `src/player/pose.ts` (pure, tested) gives the joint angles for walking, a ski stance, a tuck, a
  hockey stop, poling, a pole planted for a turn and sitting on a chair; the player eases
  between them. Add a new action as a pose
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
  Skis put on pointing up the hill, or stepped off a lift on, are swung round the nearer way
  to point across it and a little down (`Player.offTheUphill`): at a standstill the poles
  lose to the slope, and a first run must not begin with nothing happening.
- On a bike, coasting down faster than `STAND_SPEED`, the rider stands on the pedals
  (`ridePose`'s `standing`).
- The poles are used. Pushed forward below the speed they are good for (`poleMaxSpeed`,
  11 m/s: a flat runout is taken at about 9, the pace of a strong skier skating), the skier
  poles, both together: `polePose` in `pose.ts` is the stroke, and it gives way to the tuck
  as the speed comes up. And a turn begun at more than a walk is marked with a touch of the
  pole on its inside (`planted`; `Player` starts one when the thumb goes over to a side).
  The owner asked for both. Each makes a small dry tick (`jingleFor('pole')`, the `tick` voice).
- The camera follows the direction of travel, not the skis, so it holds steady through a stop.
- Open water is painted on the ground. Out of winter someone crossing it wades, to the knees
  (`footing` in `main.ts`); in winter it is ice and snow like anywhere else.
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
  Three more are for sitting on a bench with a view: at sunrise, at sunset, and under the stars.
- Stones lie in five kinds of ground: on the groomed snow (so skiing a trail meets them), beside
  the trails, in steep bare rock, in deep woods (the rarer ones, which take a detour), and
  thick round the old quarries (`mine`, within `MINE_REACH`). They
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
  spring, summer and fall, and the town's houses all take their colour per instance.
- `src/ui/book.ts` is the Book sheet (Passport, Minerals, Guide and Pack pages) and `src/ui/toasts.ts` the
  announcements at the top of the screen. With `hud=0` announcements are hidden too. A page
  with four or more headings gets a row of them to jump by, which stays at the top as it
  scrolls: the Passport runs to many screens.
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
  done, a thing handed over, the day's bake, sandwich or book, a word about something the town
  has built for them, a reminder, a new errand, or small talk, in that order. The day's gift
  comes before any errand, so an errand in hand never hides it; only on a first meeting do
  the hello and the first ask come first.
- **How people talk.** The owner asked for the manner of A Short Hike, in their own voice: short
  lines that can be read in a breath, said the way a person would say them to a friend. So:
  contractions always; small hesitations (`Oh!`, `um`, `...`, `I guess`, `a little`); ` - ` for a
  dash; American spelling (this is upstate New York: `color`, `plow`, `donut`); sincerity before
  jokes, and never the same joke shape twice running. People talk about their own small worries
  and about each other more than about their jobs. A line may hold two or three short rows,
  split with `\n`, which the talk sheet shows one under another; some lines should be one plain
  row. Each person keeps their own softeners (Hazel and June say `kind of`, Otto `pretty`, Bram
  `I mean`, Marge `hon`; Ivy and Amos use none). Tom never speaks: his lines are notes stuck to
  him, written out in full by Pip, and are shown as handwriting. A test in `people.test.ts`
  fails on `do not`, `cannot` and British spelling. The wording is the owner's to mark up.
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
- Not everyone is a person. A `kind` of `board` is read, a `dog` or `cat` is petted (each a
  made model, filed in `park.json` under its id among the people, `biscuit` and `pickles`;
  with `models=blocks` they are built from blocks several times their size and brought back
  down, so that they still get the print's line: `fine()` in `folk.ts`), and the
  `snowman` is Tom, who is a snowman in winter (the field guide's own made model, in his top
  hat, so there is one snowman on the mountain and not two), a heap in spring and a scarecrow
  after that.
  What Tom has to say is shown as written notes signed `- Tom`.
  A `prop` (the groomer's snowcat, the patroller's sled) is one more mesh beside its owner.
- Three boards are chalked up fresh each time they are read (`src/game/report.ts`, pure, tested):
  the snow report by the Base Lodge door (the real season, sky and hour), the trail board
  outside the Saddle Lodge (each day, a trail not yet in the passport) and the observer's log at
  the fire tower (what is about this season and hour, the unseen first, with where to look).
- Someone whose whereabouts fall at one of the town's named places stands by its front door.
- People remark on the moment (`moods`: snowing, raining, night, dawn, dusk) before small talk,
  and once a day on what the player has on (`wearing`, by gear id).
- Benches can be sat on: by the doors in town and at the lookouts (`benches`, `viewBenches` in
  `src/world/streets.ts`; `Built.benches`). The action button reads Sit, then Stand up; pushing
  the stick also stands. `Player.sit` is the state, `Game.sat` keeps each bench the first time,
  and the Passport lists them. At a lookout the camera sits behind, for the view, and trees
  are kept out of it (`Built.near`); at a door it comes round in front.
  Sit still for a few seconds by day and a bird comes to the bench (`benchVisitor` in
  `wildlife.ts`: a chickadee, or a Canada jay at the high benches in the snow months) and is
  entered in the field guide.
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

## Other people

- The player is not alone on the hill. `src/world/crowd.ts` (pure, tested) says where everyone
  else is: skiers down the groomed, named trails (bikes in summer and fall, and fewer of them),
  people on about one chair in three, and four of the town walking a stretch of Main Street and
  back. Nobody is simulated: each is placed from the lift clock, so the crowd costs a little
  arithmetic and nothing is kept.
- They are nobody in particular: no names, nothing to say, nothing to collect. Anyone worth
  talking to belongs in `people.ts`.
- `src/world/crowdMesh.ts` draws them. On skis each of three outfits is held three ways
  (skiing, and touching the left pole or the right to the snow between turns: `plant` in
  `gliderAt`), an instanced mesh to each; on bikes one way. Chair riders are one mesh. Each
  figure is washed with a pale colour of its own so a few outfits look like a crowd. That is
  ten draw calls for the mountain in the snow months, nineteen with shadows. A walker is a mesh
  each, stepped through six pictures of a stride, and stops and looks at the player if the
  player stands in the way. `src/world/figure.ts` makes a figure in a pose as one geometry, for
  them and for `folk.ts`.
- Everyone goes in at night (`busyness`), and it thins at dawn and dusk. A skier grows from
  nothing at the top of a run and shrinks away at the bottom, so nobody pops in or out.
- `crowd=0` sends everyone home, to see what they cost. Keep their jackets quieter than the
  player's.

## Sound, hints and patches

- The church in town strikes the hour, by the real clock at Gore, for anyone within earshot,
  and the Snow Train whistles before it leaves. Neither happens under a pinned time.
- Sound is made in code (`src/audio/`): no sound files. `soundscape.ts` (pure, tested) works out
  how loud the wind, the skis, a lift and the rain should be for what the player is doing, and
  the tune for each kind of thing earned; `sound.ts` plays them with Web Audio. It starts on the
  first touch, as browsers require, and Settings turns it off. Keep it quiet: it is there to make
  movement feel like movement.
- `Game.hint(id)` is true once. `main.ts` uses it for the welcome and for a hint the first time
  each thing comes up. `intro=0` turns both off; the tools set it. Announcements are held back
  from the very start until the loading card, the welcome and the flyer are out of the way
  (`Toasts.hold`), and Settings can put the welcome up again.
- The last letter (`the-whole-town`) is sent, ahead of the queue, the day the Book is full:
  every patch earned but the one that waits on the real sky (`sky` in `patches.ts`,
  `bookFull`), which could take most of a year however keen the player. It is the game's
  only ending, and it asks the player to come up anyway. Once it has been had the town
  strings flags down Main Street, lamp to lamp, and leaves them up (`Built.celebrate`,
  `buntingSpans`). If the weather's patch is earned afterwards, Wren writes (`wren-sky`). The moment the
  last patch is earned is announced ("Your Book is full"), the flyer's P.S. says the letter is
  waiting before anything else, Dot has a line of her own for it, and it comes with one more
  patch for the cabin's board (`KEEPSAKE` in `patches.ts`: not one of the Book's, and made as
  a patch set of its own so the other sheets are cut as they were).
- A full book still has a flyer. With every trail stamped there is a trail of the day to go
  down again (`trailAgainLead`); with little else left, a patch still to earn is quoted, a
  different one each day (`patchLead`, which has nowhere for a flag); and the rumour's wording
  turns about.
- If the game cannot load, `showFatal` says so kindly, offers `Try again`, and keeps what went
  wrong small underneath.
- `src/game/patches.ts` lists the patches for finishing a whole kind of thing. They are checked
  once a second against a tally of the book. Add one as a line of data.
- `public/sw.js` keeps a copy of the game for playing with no signal. It asks the network first
  and falls back to its copy, so a new push is never hidden by an old one. It is registered only
  over https, so the dev server and the tools never see it. Twenty seconds after the game
  starts it is asked to keep the rest (`keep-all`): the build writes `files.json`, every file
  with a mark of its contents (`vite.config.ts`), and the worker fetches whatever has changed
  since it last looked, so a season not yet visited or a patch not yet earned can turn up
  with no signal. The page itself is kept last, only once everything it names has been, and
  what belonged only to an older version is dropped only then; a page asked for on a weak
  signal is waited on for four seconds before the kept copy is shown. `node tools/offline-check.mjs` checks that on the built game.
- Settings lead with what a player wants (the save code, sound, the welcome again, and the
  credits). Everything for testing is
  below the "For testing" line: places to go to, a season, an hour and a sky to pin, the
  renderer, how the ground is drawn up close, how thick the forest is, sharpness, the
  frame-rate readout and how far is drawn.
  Shadows, boards and shingles, the other people and full terrain detail are simply on; they
  can still be turned off from the address (`shadows=0`, `siding=0`, `crowd=0`, `stride=2`),
  which the benchmark uses.

## Pictures and lettering

- The portraits on the talk sheet and the postcards are painted by an image model through
  fal (`tools/art/`): `manifest.mjs` holds one prompt each and the look a set shares;
  `make-art.mjs` asks for whatever is missing, trims it and saves a small WebP under
  `public/art/`. `--redo id,id --bump 1` paints one again with another seed. Portraits are
  gouache plates (`LOOK`), each balanced to the same cream paper; postcards are flat
  park-poster prints with no lettering.
- The four pictures on the way in, which are also the seasons' stamps, are park posters too:
  the same village and mountain in each season's inks. They were soft storybook paintings,
  the one thing in the game that was not a print. `make-title.mjs` asks Tripo's image model
  (`chat_image_2.5_sunburst`, which the owner asked for) for all four on one sheet, so that
  they are one place seen four times, and cuts it. About 10 credits.
- The pictures on the signs over shop doors are round painted signs, printed flat with a navy
  ring, so that they belong to the world they hang in (the owner asked for this after seeing
  the first ones, soft little models, on the phone). They are made a sheet at a time like the
  patches, to a brief of their own (`SIGN_BRIEF`; `make-patches.mjs signs`, which keeps them
  in the cache), and `make-art.mjs shops` lays them out on one sheet
  (`public/art/shop-signs.webp`, with `src/world/shopSignArt.ts` saying which is which).
- Everything in the Book that is had or found is an embroidered patch: stamps for finishing
  things, summit patches, conditions, lift pins, hats and jackets, bakes, sandwiches and books,
  minerals and the field guide. The owner asked for the patch and trail-map look throughout,
  and found patches painted one at a time inconsistent. So they are made a sheet at a time
  (`tools/art/make-patches.mjs`, through Tripo's image model): up to sixteen to a sheet, to one
  brief (`PATCH_BRIEF`) that fixes the cloth, the border, the stitch and the game's colours,
  and says what each is for. Each set has its own colour of border (`PATCH_SETS`), as a trail
  map has a colour for each kind of trail. `cut-sheet.py` cuts a sheet into its patches by
  row and column, with nothing behind them; whatever a sheet left off is asked for once more.
  `--redo set` makes a set again. A sheet costs about 10 Tripo credits.
- The Book wears the same look (`#book-sheet` at the end of `src/style.css`): headings are a
  map legend's bands, lesser headings dotted like a path, and a patch sits on the page with no
  card under it.
- The Book is a catalogue: `pic()` in `book.ts` shows a thing's picture when it has been had and
  a pale ghost of it when it has not, so every shelf shows what there is to look for. A
  `GameEvent` may carry `art` (as `patches/first-tracks`), and the announcement then holds the
  picture up. Add a collectible by adding its data, what is sewn on its patch in the manifest,
  and running `make-patches.mjs`; `art.test.ts` fails until the picture exists. Names are filed by `artSlug`.
- Picture signs hang over shop doors (`src/world/shopSigns.ts`): one mesh, one texture. A shop
  kit calls `hanging()` to put up the bracket and say where the picture goes.
- The prompts never name the game, the mountain's owner or the player, nor any other game. No key is ever in the
  repo: the fal key and the Tripo key are network secrets on the environment, sent by the
  session's proxy (`queue.fal.run`, `openapi.tripo3d.ai`).
- The interface has a look of its own, set out at the top of `src/style.css`: paper, ink and
  enamel colours as variables, a display face for headings and buttons, Caveat for anything
  handwritten, all bundled from `@fontsource`. Use the variables; do not add new colours or
  faces without the owner's say.
- The owner tried a rounded face and chose the poster capitals: Bebas Neue stays. The style
  sheet reads `--display`, `--display-weight` and `--display-case`, should that ever be revisited.

## The day's flyer

- The owner asked for a daily loop in the manner of an exploration-heavy Animal Crossing:
  see what is different today, pick somewhere to go, make an outing of it. The flyer is the
  first step. `src/game/today.ts` (pure, tested) says what is on it; `src/ui/flyer.ts` shows
  it: a sheet of paper pinned up over the lower part of the screen, the first time the game
  is opened on a calendar day (`Game.flyerDue`): at once, or as soon as the welcome or the news
  has been read. If midnight passes with the game open, the new day's flyer goes up when no
  other sheet is in the way, and what was staked out the day before is built there and then.
  The map's `Today` button brings it back. `flyer=1` puts it up for the tools.
- It names three leads (`pickLeads`), each in a different part of the mountain: the trail of
  the day (the one the Saddle Lodge board has picked), a place with no postcard yet, and
  either someone with something for the player or the inn's rumour, day about. When the
  town has a project in hand, it takes the second place (see Town projects): what was finished
  overnight first, then what wants staking out, then anything built earlier and never seen.
  Someone who has not yet done an errand is sent to the nearest person with something for
  them (`neighbour` in `main.ts`), and until six trails are stamped the trail of the day is an
  easy or middling one out in the open (`GENTLE_UNTIL` in `report.ts`). `dayNumber` is well
  stirred, so what is picked by the day does not walk down a list. The rumour's
  lead only says to ask Marge: where the stone lies is hers to tell. The three are chosen once
  and kept in the save (`leads`), so the flyer reads the same all day; one that has been done
  since is ticked and struck through.
- Each lead has a `Flag` button that plants the player's flag on it. A lead is never a chore:
  nothing is lost by ignoring it, there is no reward for doing all three, and tomorrow there
  are three more. Add a kind of lead by adding a builder beside `trailLead` and a place for it
  in `pickLeads`; its wording follows the rules for how people talk.

## The cabin

- The player has a cabin: the second step of the daily loop, somewhere that shows what they
  have found and changes because of it. The day begins in its yard (`at` defaults to `home`).
- `src/world/cabin.ts` (pure, tested) finds its plot: a small real building standing by
  itself in the woods a short way from the Base Lodge, beside a trail (on this map, 320 m off
  by Cedars Traverse), turned to face that trail. `Built` keeps the plot out of the houses,
  makes it solid, clears the trees round it and lights its fire. `src/world/cabinMesh.ts`
  builds it from blocks: log walls, an open porch (no porch roof: the camera looks down from
  behind and a roof would hide what is set out), a stone chimney, a woodpile, a feeder.
- `src/game/cabin.ts` (pure, tested) is the rules. A shelf by the door holds five stones and
  a board beside it three patches. Tapping a place on the cabin's sheet (`src/ui/cabinSheet.ts`,
  opened by the `Home` action at the door) steps it through what the player has found or
  earned and has not set out elsewhere, and then to bare. With four or more things to choose
  from, the place last tapped also gets a strip of them all, so any one is a single tap
  (`Game.place`). What is set out is in the save
  (`cabin`) and shows on the cabin itself: stones as one instanced mesh, each patch as a
  disc wearing its picture.
- The feeder answers overnight. Filled from the sheet, it has somebody at it on any later
  day, by day (`FEEDER_GUESTS`, by season). They can be seen from the yard the day begins in; walking
  up to the feeder (4.5 m) puts them in the field guide and empties it. The flyer's P.S. says when
  somebody is there.
- Nothing about the cabin is a chore: a bare shelf is only bare, and an empty feeder only
  stays empty. The map marks it with a red house, and `window.__gore.teleport('home')` goes
  there.

## Town projects

- The third step of the daily loop: the town builds things, one after another, and each adds
  a place to the mountain for good. `src/game/projects.ts` (pure, tested) lists them
  (`PROJECTS`: a lean-to in the woods by the cabin, a dock on Rabbit Pond, a bandstand by the
  Duck Pond, a warming hut at the top of Burnt Ridge, a lookout over the reservoir) and says
  where each stands on a day: not yet proposed, wanting its spot staked out, being built, or
  built.
- The player's part is to go there. The flyer proposes the project in hand (it takes the place
  of the day's "worth the trip"); on the spot the action button reads `Stake it out`; stakes and
  lumber appear; and by the next calendar day it is built. Then the flyer says so, the map
  marks it, and being there earns a postcard: every project is a landmark, shown in the Book
  as not built yet until it is. While one is going up, the flyer's P.S. says it will be done
  tomorrow. The next is proposed once the one before has stood a few days (`REST`), so five
  projects last a keen player about three weeks; meanwhile the P.S. says the town is thinking
  about what to build next. A proposed plot has a post with a notice and a red pennant on it,
  to walk toward.
  Nothing is paid, carried or timed, and a project never staked out simply waits.
- `src/world/projectPlots.ts` (pure, tested) finds each plot from a description (along a
  path, on a pond's shore, at the top of a lift): dry ground, level enough, off the trails,
  turned to face the water or the way the ground falls away. `Built` keeps a clearing at
  every plot from the start, and the view in front of it. `src/world/projectMesh.ts` builds
  each from blocks, one mesh apiece. The hut and the lean-to's walls are solid (`projectWalls`;
  `Walls.add` and `remove` let walls come and go after the game has begun). The dock, the
  bandstand, the lookout and the lean-to's floor are stood on (`projectFloors`, `floorAt`):
  `main.ts` raises the player onto the boards. The bandstand's roof and the lean-to's are
  pieces of their own that come off while the player is under them (`TownProjects.openRoof`),
  as the cabin's porch has none: the camera looks down from behind and would see only roof.
- Whoever wanted a thing built says so once when it stands (`Project.said`), and writes about
  it (`letters.ts`).
- What has been staked out is in the save (`projects`, the day each was). Add a project by
  adding it to `PROJECTS`, a site for it in `projectPlots.ts`, a model in `projectMesh.ts` and
  a postcard in the art manifest.

## Secrets

- The owner asked for reasons to go out and explore that are not only one more thing for a
  shelf. `src/game/secrets.ts` (pure, tested) is the mountain's secrets: things that are on
  no map and that nothing points at. `SECRETS` is the data; `discover()` is what happens at
  one. The Book lists a secret under Field notes only once it has been found, and never
  says how many there are.
- Where one stands is a description (`SecretWhere`: as people are placed, or on a peak,
  along a path, at a town place's door, or `wild`: a walk into the woods far from any
  trail), turned into a place by `src/world/secretSites.ts` (pure, tested).
  `src/world/secretMesh.ts` builds them all from blocks into one mesh, keeps trees off
  them, and says which is within reach; the action button then offers what is done there
  (`openSecret` in `main.ts`), and what there is to read comes up on the talk sheet, which
  can show a picture over the words.
- The kinds so far. **Registers**: a tin box on a post at the far end of things, with a
  logbook the town has been writing in for years, and a line for the player with the date.
  **Plaques**: a brass plate beside a trail saying why it is called what it is called
  (invented, every one; none for a trail named after a real person or a people).
  **Old workings**: the adit at the mine, a cellar hole in the woods, the rope tow's
  engine. **Rooms**: named places in town and at the mine whose doors are locked; a key
  lies in one of the old workings, and the inside is a picture (`public/art/rooms/`,
  `ROOM_ART`). **Cairns**: one on each summit, which takes a stone a day from the player
  and grows. **The bell** on Gore's summit, which the town says it heard, the next day
  (`BELL_HEARD`).
- A secret may hand over something to wear and a key, once. `COME_BY` lists how every thing
  in the wardrobe that is not an errand's is come by, and a test holds it to `GEAR`: nothing
  may be in the Book that cannot be had.
- The wardrobe has eight kinds of thing (`GEAR_SLOTS` in `people.ts`): hats, jackets,
  goggles, skis, packs, the track the skis leave, the voice the player's tunes are played
  in (`TUNE_VOICES`), and company (a pet). `Game.outfit()` is what the figure wears and
  `Game.flourish()` the rest. Their patches are made a sheet at a time like the others, by
  the same family of model through fal (`gear:found` in `PATCH_SETS`, `by: 'fal'`).
- **Things to follow.** A secret may have a `lead`: in the seasons it names, something is
  set down from the nearest trail to it (`leadLine` in `src/world/unmarked.ts`, pure, tested).
  A fox's prints in the winter snow go to a den, which is asleep then and hands over a kit
  in spring or summer (`turns`: what a secret is in a particular season); buckets on the
  maples in spring go to a sugar shack, which is boiling then and shut otherwise. A secret
  may keep to seasons (`seasons`: a nest by the Duck Pond) or to the dark (`nightly`), and
  may be `shy`: come upon faster than `GENTLE_SPEED` it is gone until the player has been
  well away (`SecretThings.about`). The lantern at the old quarry is both: lit only at
  night, out for anyone who hurries, and under it the key to the last locked door.
- **Unmarked runs** (`unmarkedRuns`, the same file): the three longest ways down through
  forest that set off beside one trail and come out on another, found from the ground.
  Trees are kept back along each (`runCorridor`), a birch with an orange ribbon stands at
  the top (a secret, `kind: 'ribbon'`) and a smaller one every 160 m. Finding one pencils
  it onto the map; coming down it top to bottom counts it (`Game.ranRun`, `runAlong` in
  `main.ts`).
- **Found things are pencilled on the player's own map**: a small cross at each secret
  found (`PointKind` `secret`), the unmarked runs as pencil lines, and worn ground as dots
  (`TrailMap.pencilled`).
- **The right moment** (`src/game/sky.ts`, pure, tested; `src/world/skyShow.ts`). Cloud
  lying in the valleys on a morning of fog or low cloud (`Weather.low`, from the service's
  fog codes and low cloud cover): from above `CLOUD_TOP` it is a flat pale sea with the
  ridges standing out of it, and underneath it is an overcast day. Shooting stars on the
  nights of the year's real showers (`SHOWERS`), and the northern lights about one clear
  night in six from September to March (`auroraOn`), drawn as curtains whose colour runs
  from green to the sky's own, so nothing is see-through. All three are kept only under
  the real calendar, clock and sky (`Game.saw`). `weather=fog`, `sky=meteors` and
  `sky=aurora` in the address show them for the tools; the flyer's P.S. says when a shower
  is tonight.
- **Marks the player leaves.** Besides the cairns and the bell: ground worn by walking
  (`src/game/worn.ts`, pure, tested; `src/world/wornMesh.ts`). Off the trails and roads,
  each six-metre square remembers being crossed on foot; at three crossings it shows, as a
  patch of packed snow or bare earth, and enough of them are a path (`PATH_FOR_LEAF`). At
  most `WORN_MOST` squares are kept: what was never gone back to grows over.
- The wording of every register, plaque and room is the owner's to mark up, and follows the
  rules for how people talk.

## People who roam

- `src/game/wanderers.ts` (pure, tested) is the people who are somewhere different every
  day, and on no map or flyer (`roams` on a `Person`). Each has a list of haunts and takes
  them in turn, never the same two days running; a haunt is placed as a secret is
  (`placeAt` in `secretSites.ts`), and trees keep clear of every haunt from the start.
  `placeRoamers` in `main.ts` stands them (`Folk.move`) at the start, at midnight and when
  the hour turns, never moving anyone from under the player's nose.
- **Nell, the painter**, is at a view by day with her easel, and hands over that view's
  painting for the season: six views by four seasons, `public/art/paintings/`. A view's
  four are painted on one sheet so that they are one place seen four times
  (`tools/art/make-paintings.mjs`, through fal). They are kept in the Book under Paintings.
- **Ro, the camper**, pitches somewhere out of the way each morning. His smoke
  (`src/world/plume.ts`) stands 85 m over the trees and is drawn from any distance: it is
  how he is found. He has something for the first three days he is found.
- **The band.** Four players practise alone around the mountain once the bandstand is
  built; each teaches a tune (a voice for the player's own jingles). With all four heard,
  they play on the bandstand on Saturdays from dusk (`concertOn`), and the first concert
  comes with the band's jacket.
- **Pip hides.** Once she has been met and wants nothing of the player, she is somewhere
  else every day (`PIP_HAUNTS`), and the first two people in town asked that day say which
  way she went (`hints`: vague, and true). Found three times she gives up her racing skis;
  five, a paper crown.
- Their lines follow the rules for how people talk, each with a softener of their own
  (Nell `sort of`, Ro `I figure`, Fitch `maybe`, Bo `more or less`, Sal `well`; Hattie
  none), and are the owner's to mark up.

## Company

- A pet comes along (`src/world/companion.ts`): the fox kit from the den, the duckling from
  the nest, the kitten from the power house, the toad from the cellar hole, and a chickadee
  once four different guests have been seen at the cabin's feeder (`GUESTS_FOR_BIRD`). On
  foot it keeps at the player's side, hopping to catch up; on skis, a bike or a lift it
  rides on the pack; the chickadee keeps about the player's head. The four that are not
  field-guide animals are made models of their own (`pet-*` in `tools/models/manifest.mjs`).

## Trail map

- The Map button opens `src/ui/trailMap.ts`, a bottom sheet drawn on a 2D canvas over the
  pipeline's pictures of the land. West is up, so the summit is at the top as on a ski map.
  The maths is `src/ui/mapView.ts` (pure, tested): the projection, the window's camera
  (`lookAt`, `clampCamera`, `zoomAbout`, `panBy`), and `wayTo` and `sayDistance` for the flag.
- The map is a window on the mountain. One finger drags it; the `+` and `−` buttons down its
  right edge, or a double tap, zoom it (a pinch does too, but nothing needs two fingers); `Me`
  goes to the player and `All` back to the whole mountain. It is fitted to the trails and can
  be slid out to the edge of the world, since the town lies beyond them. Well in, the close
  picture of the ground takes over from the far one.
- What is marked grows as the map goes in (`SHOWN_FROM`, `NAMED_FROM`): lodges and summits
  always; then places worth a postcard, benches, the town's doors; then names, of trails and
  lifts along their lines and of points beside them, never one over another. Each kind of
  point has its own sign, filled in if it is in the book and hollow if not. `main.ts` gives
  the map its points (`TrailMap.points`) and what the book says of a trail, path or lift
  (`TrailMap.progress`); tapping anything names it and says where it stands in the book.
- The legend is a row of chips that show and hide what they mark (trails, lifts, paths,
  places, people). `Not yet` fades everything already in the book, so what is left stands out.
- A flag can be planted on anything tapped, or on a bare spot. It is kept in the save
  (`flag`), stands in the world as a pennant on a pole, and a pointer under the place name
  gives its name, the distance and an arrow that turns with the camera. Coming to it takes it
  up (`Game.reachedFlag`). It is only a mark to steer by: it earns nothing.
- The `Today` button in the map's head puts the day's flyer back up.
- `window.__gore.map()` says where the map is looking, for the tools.

## Measuring performance

- The owner measures on the phone with Settings > For testing > Run benchmark, which steps through fixed settings
  (`src/debug/bench.ts`) and ends with a block of text to paste back. Change the step list when a
  new question needs answering; run `node tools/bench-check.mjs` after touching it.
- The steps now (thirteen, about a minute and a half): the Saddle Lodge as before, to set beside
  the earlier run; then the Base Lodge and Main Street, each with and without the other people;
  Main Street without shadows and on a snowy dusk; the Base Lodge in fall; and one step that is
  carried down Sunway at lift speed, which measures building ground and forest while travelling;
  and last, the Base Lodge drawn as the game was before the print, to set beside step 6 and
  see what the print costs. Season, time and weather are pinned for every step.
- A benchmark step never writes to the player's book: it stands in places and seasons the
  player has not been.
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
- The camera sits well back and high, so the player is small (about 5% of the screen height) and
  sits just below the middle, above where the thumb rests. How far back is the player's to
  set: two fingers on the picture, off the stick, pinch it nearer or further (a mouse wheel
  does the same), and the distance is remembered (`gore.zoom`). `zoom` in the address has its
  way, for the tools. Framing
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

60 fps on the owner's phone; pixel ratio capped at 2; instancing for anything repeated; first
load under 15 MB (it is about 8).

The game was first held to 150 draw calls and 300,000 triangles on screen. It is well over
both, and the phone holds 60 fps all the same, so those numbers are a caution, not a wall:
what counts is the benchmark on the phone. Three things keep the draw calls where they are:

- Far terrain is drawn in blocks. While every tile in a three-by-three block is at its coarsest
  detail and in the same texture, the block is one mesh (`Terrain.cull`); otherwise its tiles
  are drawn one by one.
- The figure's rigid parts are each one mesh (`Skier.join`), painted on their vertices and
  repainted when the outfit changes. About thirteen meshes on foot.
- The lodges, the named places, the lifts, the signs and the train are a dozen meshes in all.

`node tools/census.mjs` lists what is switched on by part of the scene, and
`window.__gore.show(part, false)` hides a part, to see what it costs in `state().drawCalls`.

Measured on the owner's iPhone 17 Pro (2026-11-12, Home Screen app, WebGPU, 804 x 1748 at 2x),
with everything built up to the park print, the made models, the cabin and the town's
projects: a steady 60 fps at all thirteen benchmark steps, 98 to 100% of frames on time, none
slower than 30 ms, using 3.3 to 6.3 ms of CPU a frame.

- Saddle Lodge: 170 calls, 1,158k triangles. Without the other people, 163 calls. Thick forest:
  1,365k triangles, every frame on time.
- Base Lodge: 154 calls, 980k triangles; in fall, 152 and 847k.
- Main Street: 131 calls, 939k triangles; without shadows, 93 calls and 595k; on a snowy dusk, 98.
- Carried down Sunway at lift speed, building ground and forest all the way: 60 fps, 172 calls,
  1,123k triangles, 6.3 ms of CPU, fewer than 1% of frames late.
- WebGL 2 gave the same picture.
- **What the print costs:** the Base Lodge with it (step 6) is 154 calls and 980k triangles; as
  the game was before it (step 13), 151 and 848k. Three draw calls, 132,000 triangles, and no
  frame time that can be measured.

The owner has looked at the print, the outlines and the made models on the phone's WebGPU and
they look right. For comparison, the day before (2026-11-11, before the print): 157 calls and
858k triangles at the Saddle Lodge, also a steady 60 fps.

What the benchmark still does not show is heat and battery over a long session: each step
measures five seconds (fifteen for the trail). The owner should say if the phone runs warm.
