# Credits and data sources

## The mountain

- **Elevation:** U.S. Geological Survey, 3D Elevation Program (3DEP). Public domain.
- **Trails, lifts, paths, roads, the railway, buildings, water and place names:**
  © OpenStreetMap contributors, available under the
  [Open Database License](https://www.openstreetmap.org/copyright).
- **Weather:** [Open-Meteo](https://open-meteo.com), CC BY 4.0. The game asks only for the
  conditions at the mountain's coordinates.

## The game

- **Rendering:** [three.js](https://threejs.org), MIT License. Its notice travels with the game
  as `licenses/three-MIT.txt`.
- **Sound:** made in the browser with Web Audio. There are no recordings.
- **Lettering:** [Bebas Neue](https://github.com/dharmatype/Bebas-Neue) by Ryoichi Tsunekawa and
  [Caveat](https://github.com/googlefonts/caveat) by Impallari Type, both under the SIL Open
  Font License 1.1, bundled through [Fontsource](https://fontsource.org). The licence travels
  with the game as `licenses/OFL.txt`.

## Pictures and models made for this game

All of these were generated for this game from prompts kept in the repository. None names a
real person, business or other game.

- **Portraits, postcards and the shapes of the marks printed on the ground**
  (leaves, tufts, flower heads, ferns, twigs, pebbles, brush strokes): FLUX.1 [schnell]
  (Black Forest Labs) through [fal](https://fal.ai), from `tools/art/manifest.mjs`.
- **The four posters on the way in, the pictures on the shop signs, and every patch in the Book** (stamps, summits, conditions, lift pins, things to wear, food and
  books, minerals and the field guide): Tripo's image model, a sheet at a time, from the same
  manifest and `tools/art/make-patches.mjs`.
- **The made models** (the field guide's animals, birds, plants and curiosities, and the dog
  and the cat, in `public/models/park.json`): most are a picture from FLUX.1 [schnell] given
  a shape by [TRELLIS](https://github.com/microsoft/TRELLIS) (Microsoft), both through fal;
  eleven (nine plants, the dog and the cat) are a picture and a shape from
  [Tripo](https://www.tripo3d.ai). All are then closed, cut down and coloured by
  `tools/models/convert.py`.
- **The painter's paintings** (`public/art/paintings/`) and the patches for things found on
  the mountain: OpenAI's GPT Image 1.5 through fal, a sheet at a time
  (`tools/art/make-paintings.mjs`, `tools/art/make-patches.mjs`). The pictures of the locked
  rooms are FLUX.1 [schnell], as the postcards are.
- **The pets** (a fox kit, a duckling, a kitten and a toad) are made models like the field
  guide's: FLUX.1 [schnell] and TRELLIS through fal.
- **The things people have made out on the mountain** (the den, the sugar shack, the
  lantern, the tent and the rest: `thing-*` in `tools/models/manifest.mjs`): a picture from
  OpenAI's GPT Image 1.5 and a shape from [Tripo](https://www.tripo3d.ai)'s H3.1 model, both
  through fal, then printed by `tools/models/convert.py` like the animals.
- **Everything else in the world** (terrain, trees, buildings, lifts, people, signs) is built
  in code.

## The town

The people of the town in this game are invented, and so are their businesses, their menus
and their opinions. Some buildings carry the names of real places in North Creek; nothing said
or sold in them here is theirs.

This is a personal, non-commercial fan project. It is not affiliated with or endorsed by Gore
Mountain, the Olympic Regional Development Authority, or any business in North Creek.
