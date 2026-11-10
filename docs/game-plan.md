# Gore Mountain: game plan

A cozy 3D collectathon set on the real Gore Mountain and in North Creek, NY, played on an iPhone and built entirely through Claude Code.

Working title: **Gore** (placeholder; pick a real one once the slice exists).

## 1. Decisions so far

| Question | Decision |
|---|---|
| Where it runs | Web app in Safari, installed to the Home Screen as a PWA. Just for you. |
| View | 3D, third-person follow camera, held upright (portrait), playable with one thumb |
| World | Real terrain and real trail/lift layout, compressed to game scale |
| Collecting | Garnets and minerals; a trail passport of stamps, pins, and patches |
| Seasons | Follows the real calendar and clock, with an in-world way to visit other seasons |
| Player | A small, simple human with swappable gear |
| Scope | A polished 10-minute vertical slice first, then grow region by region |
| Dev setup | Mix of cloud Claude Code sessions and a local machine |
| Device | iPhone 17 Pro on iOS 26.6 (WebGPU available; no upgrade needed) |
| Hosting | GitHub Pages from the public repo, deployed on every push |
| Movement | Skiing in winter, hiking the rest of the year. No snowboarding. |
| Must-haves | Sunway, Ruby Run, Quicksilver, Otter Slide, Foxlair, The Rumor, Lies, the Saddle Lodge, and the cafe and sandwich shop in North Creek |
| Art direction | No reference images. Claude proposes looks; you judge them on the phone. |

**Status:** milestone 0 is done: the phone holds 60 fps with a wide margin. Milestone 1 has started: skiing works as a first cut and needs your thumbs. See the roadmap.

## 2. What the game is

**The fantasy:** a season pass to a quiet mountain that lives in your pocket. You open it for five minutes, ride a lift, ski a run you know by name, spot a glint in a rock outcrop, stamp your passport, and put the phone away.

### Pillars

Use these to say no to features.

1. **Unhurried.** No timers, no fail states, no energy meters, no currency grind. Falling over is funny, not punishing.
2. **A real place, lovingly compressed.** Someone who skis Gore should recognize the shape of the mountain, find the trails where they belong, and know which way town is.
3. **Movement is the joy.** Skiing down and hiking up should feel good with nothing to collect. Lifts are a rest and a view, not a loading screen.
4. **Every outing fills the book.** A 3 to 10 minute session always ends with at least one new stamp or stone.
5. **The mountain follows the calendar.** Opening the game in January and in October should feel like two different visits.

### Non-goals

- Multiplayer, accounts, leaderboards, monetization
- Farming, crafting trees, combat
- Realistic ski simulation or trick scoring
- Photoreal rendering
- Recreating another game. The Vast White is a mood reference only: quiet, soft, snowy, small figure in a big landscape. Character, setting, story, and mechanics here are our own.

## 3. Core loop and systems

```
Town / base lodge
   -> choose an outing (lift, trailhead)
      -> go up (ride the lift, or hike)
         -> come down or across (ski a named trail, hike a path)
            -> detour for glints (minerals) and markers (stamps)
               -> back to town: fill the display case, trade duplicates for gear
                  -> gear opens new terrain and new finds
```

### Movement

The game is played with the phone upright, and one thumb is enough for everything.

- **Walking/hiking:** the thumb is a movement stick anywhere in the lower part of the screen. The camera swings round behind you as you walk, so there is nothing else to hold. To look around, drag the upper part of the screen or use a second finger. One context button sits by the thumb (talk, dig, stamp, board lift, clip into skis).
- **Skiing:** gravity does the work, and momentum carries you. Slide the thumb left and right to tip into a turn: gentle turns carve cleanly, hard turns at speed drift wide and scrub speed. Pull down for a hockey stop, where the skis swing sideways and you finish parked across the hill. Push up to tuck, or to pole from a standstill. The camera sits behind and above, following where you are going, which suits a tall screen: the run stretches up the display ahead of you. Trail difficulty (green, blue, black, glades) comes from the real pitch of the terrain.
- **Lifts:** board at the bottom, ride in real time with a free-look camera, unload at the top. Rides are short because the mountain is compressed.
- **Summer/fall:** same world, skis swapped for boots. Ski trails become meadows, hiking paths open, lifts that run in the real off-season (the gondola) still run.

The ski controller is the make-or-break system. It gets built and tuned on grey boxes before any art exists.

### Collection 1: trail passport

Modeled on real patch programs (46er, fire tower challenge).

- **Trail stamps:** ski a named trail top to bottom, or hike a named path end to end.
- **Lift pins:** one per lift ridden.
- **Summit patches:** four peaks (Gore, Bear Mountain, Burnt Ridge, Little Gore) times four seasons is 16 patches.
- **Condition stamps:** first chair, powder day, bluebird day, night ski, peak foliage.
- **Landmark stamps:** fire tower, the depot, the Hudson, the old mine.

The passport is the progress screen. It is laid out like a real trail map, so empty stamps tell you where to go next.

### Collection 2: garnets and minerals

Gore is the home of the Barton garnet mines (worked since 1878), and garnet is New York's state gem. This gives the collectathon a hook no other ski game has.

- **Finding:** glints in rock outcrops, stream gravel, road cuts, wind-scoured ridges, tree wells, the old open pit.
- **Tools as progression:** rock hammer (outcrops), gold pan (streams, spring through fall), loupe (reveals quality), headlamp (night and mine finds).
- **Specimens roll size and quality,** like fish size in Animal Crossing, so there is always a bigger garnet to find.
- **Around 30 minerals** drawn from real Adirondack geology: almandine garnet, hornblende, labradorite, magnetite, graphite, wollastonite, tourmaline, pyrite, calcite, quartz, moonstone, diopside, ilmenite, serpentine, plus a few rare showpieces.
- **Seasonal availability:** snow hides ground deposits in winter but opens frozen streams and ice features; spring mud season exposes washouts; low summer water reveals river gravel.
- **Town payoff:** a display case in a museum-style room; a lapidary who cuts rough garnets into gems that get set into passport pins; duplicates trade for gear and clothing.

### Seasons, time, and weather

- **Default:** the game reads the device date and time. Ski season in winter, mud season in spring, hiking in summer, foliage in fall. Day and night follow the real clock.
- **Override: the Snow Train.** North Creek's depot is where the 1934 "ride up, slide down" ski trains arrived. In the game, a ticket from the depot takes you to another season. Tickets are earned, so you live in the real season first.
- **Stretch: real weather.** Open-Meteo offers a free, keyless forecast API. If it is snowing at Gore today, it snows in the game, and you earn a powder day stamp. Falls back to seasonal averages offline.

### Town

North Creek is the hub: depot, a short stretch of Main Street, the Hudson River, the Ski Bowl at the edge of town. A handful of characters give errands that point you at corners of the mountain. Keep dialogue short and optional.

## 4. The world

### Real-world facts to build from

- Gore Mountain, North Creek, Town of Johnsburg, Warren County, in the Adirondack Park. State-owned, operated by ORDA.
- Four peaks: Gore (3,600 ft), Bear Mountain, Burnt Ridge, Little Gore. Lowest point is the Ski Bowl base at 998 ft, for roughly 2,500 ft of vertical.
- The map data holds 112 named downhill trails and 14 lifts, including the Northwoods Gondola and the Adirondack Express.
- Every trail on the must-have list is in the data: Sunway, Ruby Run, Quicksilver, Otter Slide, The Rumor, Lies. The one remembered as "Foxtrot" is Foxlair.
- The Saddle Lodge sits at about 2,980 ft on Ruby Run, between Bear Mountain and the upper mountain.
- On Main Street in North Creek, the cafe is most likely Café Sarah (a bakery cafe) and the sandwich shop Izzy's Market & Deli. Both get a place in town.
- The North Creek Ski Bowl (in use since 1934) sits at the edge of town and connects to the upper mountain.
- The Schaefer Trail climbs from the Ski Bowl to the Gore summit, about 9.3 miles round trip. A fire tower stands on the summit.
- The Hudson River runs through North Creek.

Trail and lift names in the game come from the data import, not from memory, and get checked against the current official trail map.

### Data sources

| Data | Source | Notes |
|---|---|---|
| Elevation | USGS 3DEP via The National Map | 1/3 arc-second (about 10 m) is free and enough after compression. 1 m lidar exists if more detail is ever wanted. Public domain. |
| Ski trails, lifts | OpenStreetMap (`piste:type`, `aerialway`) via Overpass API; OpenSkiMap for cross-checking | ODbL license: credit OpenStreetMap contributors in the game's credits. |
| Hiking paths, roads, buildings, rivers | OpenStreetMap | Same license. |
| Weather (stretch) | Open-Meteo | Free for non-commercial use, no key. |

### Compression

Starting numbers, to be tuned by feel:

- **Horizontal 1:1.2.** The game world is about 5.6 by 4.3 km, close to life size. (It began at 1:5, then 1:3; each felt small on the phone.)
- **Vertical 1.25:1.** About 990 m of game relief, which keeps slopes reading one and a half times steeper than reality.
- **Target feel:** a long run takes 80 to 100 seconds at around 50 mph, a short steep one about 20 seconds; top to bottom of the mountain is several minutes. On foot the mountain is a long walk, which is what the lifts are for.

### How terrain gets built

A Python pipeline in `tools/terrain/`, rerunnable from scratch:

1. Download the DEM for a bounding box, reproject to a local metric grid.
2. Apply compression and vertical exaggeration; smooth lightly so low-poly facets look intentional.
3. Pull OSM trails, lifts, paths, roads, buildings, and water; transform into game coordinates.
4. Rasterize ski trails into a **trail mask**. The mask drives everything that makes a ski mountain read correctly: groomed white corridors, forest everywhere else, flattened cross-slope on trails.
5. Export a 16-bit heightmap, the mask textures, and JSON for trails, lifts, and points of interest.

Trees, rocks, and mineral spawn points are scattered at build time from the masks with fixed seeds, so the world is identical on every load.

### Region roll-out

The real mountain gives a natural expansion path from town upward.

The order follows your memories of the mountain rather than the map's edge.

1. **Slice: the Base Lodge to the Saddle Lodge.** The Adirondack Express up, then Sunway, Quicksilver, Otter Slide, Foxlair, and Ruby Run down. The Base Lodge is the hub; the Saddle Lodge is the mid-mountain stop.
2. **The upper mountain.** The summit and fire tower, the Straight Brook lift, The Rumor, Lies, Chatiemac, Hawkeye, Open Pit.
3. **North Creek.** The depot and the Snow Train, Main Street with the cafe and the sandwich shop, the Hudson.
4. The Ski Bowl and Little Gore, which join town to the mountain
5. Burnt Ridge and the north side
6. The old garnet mine and the far glades

The whole mountain's terrain already exists in the game as a greybox. A region is "done" when it has art, lifts that run, stamps, and minerals.

Each region ships with its trails, lifts, stamps, and a mineral table. Regions load as chunks so the phone never holds the whole mountain at full detail.

## 5. Art direction

I could read descriptions of The Vast White but could not view its screenshots, and there are no reference images. So the look gets chosen by comparison instead: in milestone 2, Claude builds three or four distinct looks into the game itself (palette, shading, fog, tree shapes) plus a few generated concept images, and you pick and mix on your phone. What follows is the starting point, not a commitment.

### Target in one line

Soft, quiet, low-poly winter light: a tiny bright figure on a huge pale mountain, with blue ridgelines fading into haze.

### Principles

- **Shape over texture.** Big, simple, readable forms. No photographic textures. Color comes from vertex colors and one small shared palette texture.
- **Snow is the canvas.** Near-white, never pure white. Shadows are cool blue-violet; sun-facing slopes take warm peach at golden hour.
- **Depth through atmosphere.** Height-based fog pools in valleys. Distant Adirondack ridges are flat silhouettes in three or four fading blues.
- **Warm points in a cool world.** Lit windows, the lodge fireplace, lift-tower lamps at dusk, the player's jacket. The player's jacket is the most saturated thing on screen.
- **The world responds.** Ski tracks persist in the snow, tree branches shed snow when brushed, snowfall thickens with weather.
- **Soft light.** One sun, one hemisphere fill, a toon-style ramp with two or three steps and soft edges. No specular highlights except ice and gem facets.

### Season palettes

| Season | Ground | Trees | Sky and light | Signature |
|---|---|---|---|---|
| Winter | off-white, blue-violet shadow | dark spruce green, snow-capped | pale blue to pink dusk | long shadows, ski tracks |
| Spring | brown, patchy snow, new green | bare birch, budding yellow-green | grey-blue, soft rain | mud, rushing brooks |
| Summer | deep meadow green | full green, layered | warm white, tall clouds | wildflowers on ski trails |
| Fall | gold grass | red and orange maple, yellow birch, dark fir | low amber sun | peak foliage on every ridge |

Season changes are palette and prop swaps on the same geometry, which is what makes four seasons affordable.

### Flora and props

Adirondack species keep it specific: balsam fir and red spruce as stacked cones, paper birch with white trunks, sugar maple as rounded blobs that carry fall color. Lift towers, chairs, gondola cabins, snow guns, trail signs with green circles, blue squares, and black diamonds.

### Character

Small and simple: around 1,500 triangles, dot eyes or no face, chunky mittens and boots. Built as separate rigid parts (head, torso, limbs) rather than a skinned mesh, so animation can be done in code. Hats, jackets, and skis swap by color and mesh.

### Composing for a tall screen

- The camera sits well back and high, looking down at about 35 degrees. The player is small, around 7% of the screen height, and sits just below the middle. The top half is the view; the bottom third belongs to the thumb and stays clear of anything that matters.
- Because the camera is far back, movement is brisk (7.5 m/s on foot) so the player still crosses the screen at a satisfying pace.
- The lens is wider top to bottom than a landscape game's (about 80 degrees), so the view is not a narrow slot. Tall subjects suit it: a run falling away below, a lift line climbing overhead, the summit above the trees.
- Things to read go at the top. Things to press go at the bottom, at least 44 points tall. Menus are sheets that slide up from the bottom edge.
- The bottom third of the screen is the movement stick; everything above it turns the camera.
- The passport and trail map are drawn tall: summit at the top, town at the bottom, scrolled with the thumb.

### Interface

Paper and enamel: a folding trail map, rubber-stamp ink, embroidered patches, enamel pins, a wooden mineral case with handwritten labels. Typography borrows from 1930s ski-train posters. Built in HTML and CSS over the 3D canvas so it stays crisp and is cheap to iterate.

### Keeping generated art consistent

- One written style guide and one locked palette file that every asset script imports.
- An **asset zoo** page in the game that shows every asset side by side under the real shader and lighting. This is where both you and Claude judge consistency.

## 6. Tech stack

| Layer | Choice | Why |
|---|---|---|
| Language and build | TypeScript, Vite | Fast rebuilds, type checks catch mistakes in generated code |
| Rendering | three.js (r187) | Code-first, plain text files, no editor needed, the library Claude writes best |
| Renderer | `WebGPURenderer` | Your iPhone has WebGPU in Safari, and the same renderer falls back to WebGL 2 by itself. The settings menu can force WebGL 2, so milestone 0 compares the two on your phone. |
| Movement and collision | Custom kinematic controller sampling the heightmap; `three-mesh-bvh` for props and buildings | Skiing on a heightfield is easier to tune by hand than a general physics engine. Add Rapier only if something needs real rigid bodies. |
| UI | HTML and CSS overlay | Crisp text, easy layout, easy to screenshot |
| Game data | JSON and typed tables for trails, lifts, minerals, stamps, spawn rules | Adding content becomes a data change, not a code change |
| Saves | IndexedDB, plus export and import of a save code | Safari can clear site data after about a week without visits. Installing to the Home Screen avoids that; the export code is the backup. |
| Offline | Web app manifest and service worker (`vite-plugin-pwa`) | Cell service at the real Gore is poor. The game should work on the gondola. |
| Audio | Web Audio API | Must be unlocked by a tap on iOS |
| Tests | Vitest for logic; Playwright for screenshots | Chromium and Playwright are already installed in cloud sessions |
| Hosting | Static deploy on every push | See below |
| Pipelines | Python for terrain (rasterio, numpy, shapely, pyproj); Blender Python for assets | Both run headless in cloud sessions |

**Hosting:** GitHub Pages, free because the repository is public. A GitHub Actions workflow tests, builds, and publishes on every push.

**Considered and set aside:** Godot and Unity web exports are heavy on iOS Safari and depend on binary scene files and an editor, which fits poorly with a code-generated workflow. A native iOS build needs a Mac and a $99 per year Apple Developer account. If the web build ever outgrows Safari, wrapping it with Capacitor is the path to the App Store without a rewrite.

### Phone performance budget

Starting targets, to be confirmed on your device:

- 60 fps target with a 30 fps fallback mode; device pixel ratio capped at 2
- Under 150 draw calls and 300,000 triangles on screen
- Trees, rocks, and lift chairs drawn with instancing
- One shadow-casting light with a small shadow map near the player; blob shadows beyond
- Fog hides chunk loading and distant detail
- First load under 15 MB for the slice; meshes compressed with Meshopt

## 7. Asset pipeline and tools

### 3D assets, in order of preference

1. **Procedural Blender Python (primary).** Trees, rocks, lift towers, chairs, cabins, buildings, signs, and the character are generated by scripts in `tools/assets/` and exported as glTF with vertex colors. Everything is reproducible, reviewable as text, and consistent because it shares one palette and one set of proportions. Runs headless in cloud sessions.
2. **Free CC0 packs as placeholders.** Kenney and Quaternius. Good for greyboxing; replace before the slice is called done.
3. **fal image-to-3D for hero props.** Organic or one-off shapes that are tedious to script: a moose statue, the fire tower's details, mineral specimens. Generated meshes come out dense, with messy topology and baked-in lighting, so each one goes through a Blender cleanup script: decimate, remap colors to the palette, bake to vertex colors. Expect roughly $0.10 to $0.60 per generation depending on the model; check fal's current pricing.

### 2D assets

This is where image generation is strongest and where fal earns its place:

- Passport stamps, pins, and patches
- Mineral illustrations for the display case
- Concept art and palette exploration before building 3D
- Sky gradients and cloud shapes
- App icon and splash screen

Generate with a fixed style prompt and a reference image so the set matches. Vector-trace stamps to SVG where possible.

### Animation

The riskiest part of an all-generated pipeline, so the design avoids it. The character is rigid parts animated in code: a walk cycle is sine waves on hips and knees, and a ski stance is a lean plus knee bend driven by turn rate and slope. No skinning, no motion capture, no manual rigging. Mixamo stays in reserve if a skinned character is ever wanted, though it needs a manual trip through its website.

### Audio

- **Ambience and effects:** wind, ski edges on snow, lift machinery, boots on gravel, hammer taps. Start with CC0 sources (freesound, Kenney), fill gaps with a generated-audio model on fal.
- **Music:** sparse and quiet. A few short generated or CC0 pieces that fade in at summits and in town. Silence and wind do most of the work.
- Check the license of every model and library used and keep a `CREDITS.md`.

### Secrets

The fal API key goes in the cloud environment's secret settings or a local `.env` that is gitignored. It never goes in the repository or in chat. Cloud sessions also need fal's host allowed in the environment's network settings.

## 8. Working with Claude Code

Things that matter more for a generated game than for a hand-built one.

- **Claude cannot feel the game. You can.** The whole project is a loop: Claude pushes, the site deploys, you play on your phone, you describe what felt wrong. Get that loop under two minutes in milestone 0.
- **Give Claude eyes.** A debug mode driven by URL parameters (teleport to a spot, set season and time, freeze the camera) lets Playwright take screenshots that Claude can inspect. Without this, visual bugs go unnoticed.
- **Tune on the phone.** Expose ski physics and camera constants in an on-screen debug panel. You slide values until it feels right and paste the numbers back.
- **Content as data.** Once the systems exist, "add the Burnt Ridge trails and twelve stamps" should be a data change that tests can validate.
- **Tests for logic, eyes for feel.** Save and load, passport completion rules, spawn tables, and season resolution get unit tests. Feel and look get screenshots and your thumbs.
- **A `CLAUDE.md` in the repo** holding the pillars, performance budget, palette rules, and commands, so every new session starts with the same understanding.
- **One system per session.** Small, focused sessions with a clear check at the end work better than "build the game".
- **Cloud versus local.** Cloud sessions handle code, the terrain pipeline, procedural Blender, and screenshot checks. The local machine is for opening an asset in Blender's interface, anything that needs a real GPU, and Safari's remote inspector attached to your phone.

## 9. Roadmap

Each milestone ends with something playable on your phone and a single question to answer.

| # | Milestone | Contents | Gate |
|---|---|---|---|
| 0 | Foundations (done) | Project scaffold, auto-deploy, `CLAUDE.md`, touch input, the whole real mountain as a greybox with instanced trees and a settings menu for load testing | Does it hold 60 fps on your iPhone, and at what tree count? |
| 1 | Greybox skiing (in progress) | One-thumb ski controller with momentum and a hockey stop, clip in and out, every lift rideable, trees that duck out of the camera's way; still to come: a tuning panel | Is skiing Sunway fun with grey boxes? |
| 2 | The look | Snow and toon shading, fog, sky and time of day, trees, ski tracks, character | Would you set a screenshot as your wallpaper? |
| 3 | The collecting loop | Mineral spawns and digging, passport stamps, UI, saves | Does a five-minute session end with something new? |
| 4 | Lodges and seasons | Base Lodge and Saddle Lodge as real places, two characters, display case, a ticket window to one other season (it moves to the depot when town is built) | Does the second season feel like a different visit? |
| 5 | Slice polish | Audio, onboarding, offline install, icon, credits | Would you show it to a friend? |

**Slice contents:** the Base Lodge to the Saddle Lodge; the Adirondack Express; Sunway, Quicksilver, Otter Slide, Foxlair, and Ruby Run; about 12 minerals and 15 passport entries; winter plus one other season.

### Milestone 0: what to test on the phone

Open the deployed page in Safari, hold the phone upright, and walk around with one thumb. The readout in the top left shows frame rate, and Settings changes the load. The questions:

1. Frame rate at the default settings (10,000 trees, WebGPU).
2. The same with the renderer set to WebGL 2. Whichever is smoother becomes the default.
3. How many trees it takes to drop below 60 fps (20k, 40k, 80k), and whether "Whole mountain" view distance is affordable.
4. Whether shadows cost much.
5. How one-thumb play feels: stick size, how quickly the camera swings round behind you, where the player sits on the screen, whether the thumb covers anything, and anything Safari does that gets in the way.

"Run benchmark" in Settings answers questions 1 to 4 in one go: it steps through nine settings by itself in about 90 seconds and ends with a block of text to copy and paste back. "Copy performance report" does the same for whatever is on screen at the moment.

### Milestone 0 result

Measured on the iPhone 17 Pro, running from the Home Screen:

| Setting | Result |
|---|---|
| WebGPU, 10k / 40k / 80k trees | 60 fps at each (80k trees is 427k triangles) |
| WebGL 2, 10k / 40k trees | 60 fps, indistinguishable from WebGPU |
| Shadows on | 60 fps |
| Pixel ratio 3 (full sharpness) | 60 fps |
| CPU time per frame | about 2 ms of the 16.7 ms available |

Decisions taken from this:

- Stay on WebGPU, with WebGL 2 as the automatic fallback.
- Defaults at the time: 40,000 trees, the whole mountain in view, shadows on. Pixel ratio stays at 2 to save heat and battery; 3 is available in Settings.
- Since then the mountain has been enlarged twice, to near life size, with only the terrain and trees near the camera built in detail. Measured again on the phone at that size: 60 fps at every step, including the thick forest at 623k triangles, with about 4.4 ms of CPU per frame. The benchmark turns on the spot, so stutter while travelling fast is judged by eye.
- The budget stays where it was, as a cautious target. The measurement was five seconds per step on a cool phone and says nothing about a long session.

An earlier single reading in a Safari tab showed about one frame in twenty arriving late. The benchmark did not reproduce that from the Home Screen. Whether it was the browser tab or touch input is not known yet; the copied performance report now carries enough detail to tell if it comes back.

### Milestone 1: what to test on the phone

Tap **Skis** (bottom left) at the top of a run, point downhill, and let go.

1. Speed and momentum: a robot skier now reaches 50 mph on Sunway (80 seconds), 53 on Showcase and 59 on The Rumor (22 seconds). Does it build and carry the way skiing should?
2. Turning: hard turns now bend the path about a third more tightly. Sharp enough? Do gentle turns still carve and hard ones still drift in a way that feels like skiing?
3. The hockey stop (thumb down): does it look and feel right, and stop soon enough? Lean the thumb left or right while braking to choose which way the skis swing.
4. The camera: does it stay where you want it through turns and stops? Is the bottom third the right amount of screen for the stick?
5. Scale: the mountain is now two and a half times bigger again, close to life size, with trees 8 to 15 m tall. Big enough? Do the skier, trails and trees look right against each other?
6. The bottom of the screen from the Home Screen: does the mountain now reach the bottom edge, with the buttons visible? If a bar is still there, is it dark blue or pale blue? Dark means the page can draw there and the layout is still wrong; pale means iOS itself is covering it, and the fix is a different status bar setting.
7. Lifts: walk or ski to an orange gate at the foot of a lift and tap Ride. Is about a minute up the Adirondack Express the right length? Is the view up the mountain what you want to look at?
8. While skiing fast, watch for stutters, or for trees or ground detail appearing late ahead of you.

Trees stand thickest along the trail edges, and the snow on a trail is brighter than under the trees, so each run reads as a corridor. Trees that come between the camera and you shrink to saplings and grow back, so you stay in view in the forest.

Not built yet: colliding with trees, snow tracks, getting air off rolls, a trail map for finding lifts.

## 10. Risks and honest perspectives

- **Ski feel on a touchscreen is the whole game.** If milestone 1 is not fun, nothing after it will fix that. Spend disproportionate time there.
- **Scope.** The real mountain has more than 100 trails. The region roll-out exists so the game is complete at every step and never waits on the whole map.
- **Consistency of generated art.** Mixing AI meshes from different models produces a visibly mismatched world. Procedural assets and a locked palette are the defense; treat AI meshes as the exception.
- **iOS Safari quirks.** Memory limits are lower than on desktop, audio needs a tap to start, storage can be cleared for sites that are not installed, and orientation cannot be reliably locked from a web page, so a phone turned sideways gets a "turn your phone upright" prompt. Safe-area insets and the home-indicator swipe need handling. All of this is checked in milestone 0.
- **Real calendar means waiting.** That is the charm and the cost. The Snow Train and a developer override keep testing and impatience from being a problem.
- **Real names.** For a personal game, real trail and place names are part of the point. If this is ever shared publicly, revisit the use of private business names and any logos.
- **Polish takes longer than systems.** Generated code gets a system working quickly. Getting it to feel finished takes many small rounds of your feedback.

## 11. Expected cost

| Item | Cost |
|---|---|
| Hosting | Free |
| Elevation and map data | Free |
| Blender, three.js, Vite, Playwright | Free |
| fal generations for the slice | Roughly $10 to $30 |
| Apple Developer account | Not needed for the web app; $99 per year only if it later goes to the App Store |

## 12. Open questions

1. The milestone 0 phone results (see the roadmap).
2. Are Café Sarah and Izzy's Market & Deli the places you remember?
3. The fal key is not needed until milestone 2. When it is, it gets entered through a secure form or environment settings, never pasted into chat or committed.
