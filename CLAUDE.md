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
node tools/touch-check.mjs                            # emulated-phone touch test of the built game
node tools/bench-check.mjs                            # runs the in-game benchmark end to end (slow)
```

Run `npm test`, `npm run build` and `node tools/touch-check.mjs` before pushing. Every push deploys
to GitHub Pages, and the owner playtests on an iPhone 17 Pro.

## How to work here

- **Look at what you build.** Take a screenshot with `tools/shot.mjs` after any visual change and
  read it. Headless Chromium uses software WebGL, so its frame rates are meaningless; only the
  phone's numbers count.
- **Every state is a URL.** Debug options live in `src/config.ts` and are read from the query
  string (`at`, `pos`, `yaw`, `pitch`, `zoom`, `ski`, `trees`, `dpr`, `shadows`, `stride`, `view`, `renderer`,
  `hud`, `bench`, `benchsecs`). Add new ones there rather than hard-coding. `window.__gore` exposes state for scripts.
- **The world is generated, not edited.** `public/world/` comes from `tools/terrain/build_world.py`.
  Change the script and rerun it; never hand-edit the outputs. Trail and lift names come from
  OpenStreetMap, not memory.
- **Content is data.** Trails, lifts, places, and later minerals and stamps live in data files with
  tests that validate them.
- **Logic gets unit tests; feel gets the owner's thumbs.** Keep pure logic (heightfield, trails,
  input maths, save data) free of three.js so it runs under Vitest in Node.
- **One import source for three.js:** `three/webgpu`. The renderer is `WebGPURenderer`, which falls
  back to WebGL 2 by itself.
- **The ground you see is the ground you stand on.** `Heightfield.heightAt` uses the same
  triangle split as `buildTerrain`. Keep them in step.

## Skiing

- The simulation is `src/player/skiPhysics.ts`: pure, fixed-step, tested. All tuning numbers are in
  `SKI` there. Change feel by changing those, then check the tests still describe what you want.
- `SKI_REPORT=1 npx vitest run src/player/skiPhysics.test.ts --reporter=verbose` skis a robot down
  real trails and prints length, time and speed for each. Use it to judge a tuning change before
  the owner tries it.
- One thumb: left and right steer, up tucks (and poles from a standstill), down brakes.
- No fail states: the skier can always stop, always get going again on the flat, and never slides
  backwards.

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
  menus are bottom sheets. Respect the safe-area insets.
- The camera sits well back and high, so the player is small (about 7% of the screen height) and
  sits just below the middle, above where the thumb rests. Framing
  and lens come from `framingFor()` in `src/player/cameraMath.ts`; touch zones from
  `src/input/zones.ts`.
- Screenshots default to the upright phone size. Judge composition in that shape, not on a wide
  desktop window. Wide screens only need to work for development.

## Conventions

- Coordinates: +x east, +z south, +y up, in game metres. The world is centred on the origin.
- Scale: 1:5 horizontal, 1:3 vertical against the real mountain (set in the terrain script).
- Camera yaw 0 looks north (-z); positive yaw turns left.
- Placement is seeded (`src/rng.ts`) so the world is identical on every load.
- No secrets in the repo. The fal key lives in environment secrets or a gitignored `.env`.

## Performance budget

60 fps; under 150 draw calls and 300k triangles on screen; pixel ratio capped at 2; instancing for
anything repeated; first load under 15 MB.

Measured on the owner's iPhone 17 Pro (2026-11-10, Home Screen app): a steady 60 fps at every
benchmark step, up to 80,000 trees (427k triangles), with shadows, and at pixel ratio 3, using
about 2 ms of CPU per frame. WebGPU and WebGL 2 performed the same. The budget above is kept as a
deliberately cautious target so there is room for effects, and for heat and battery over a long
session, which a five-second measurement does not show.
