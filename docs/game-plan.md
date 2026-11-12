# Gore: the game as it stands

A cozy 3D collectathon on Gore Mountain and in North Creek, NY, played upright on an iPhone
with one thumb and built entirely through Claude Code. This is the design as it is now. How
it is built and checked is in [CLAUDE.md](../CLAUDE.md); the plan it started from and a diary
of each milestone are in [history.md](history.md).

## 1. What the game is

**The fantasy:** a season pass to a quiet mountain that lives in your pocket. You open it for
five minutes, see what is different today, ride a lift, ski a run you know by name, come
across something for the book, and put the phone away.

### Pillars

Use these to say no to features.

1. **Unhurried.** No timers, no fail states, no energy meters, no currency. Nothing is a chore.
2. **A real mountain, a storybook town.** Real terrain; real trail and lift names in the right
   places. The buildings, the shops and everything small are made to be charming, not accurate.
3. **Movement is the joy.** Skiing down and walking about feel good with nothing to collect.
   A lift is a rest and a view.
4. **Every outing fills the book.** A 3 to 10 minute session ends with something new in it.
5. **The mountain follows the calendar.** The real date, the real hour and the real sky at
   Gore decide the season, the light and the weather.

### Non-goals

Multiplayer, accounts, scores, money; farming, crafting, combat; a realistic ski simulation;
photoreal rendering; a recreation of any other game.

### Decisions

| Question | Decision |
|---|---|
| Where it runs | A web app in Safari, installed to the Home Screen. GitHub Pages, deployed on every push. |
| View | 3D, a camera well back and high, phone upright, everything reachable with one thumb |
| World | The real mountain and town from USGS and OpenStreetMap, close to life size |
| Movement | Skis on snow (winter, and spring's ribbons); a mountain bike in summer and fall; boots always |
| Collecting | A passport of trails, lifts, summits, places and conditions; minerals; a field guide |
| Seasons | The real calendar, with the Snow Train to visit the others |
| Look | A park print: flat inks, light in a few steps, a line round things, a banded sky |
| Interface | Paper, ink and enamel; poster capitals; handwriting for anything written; embroidered patches |
| Device | iPhone 17 Pro. WebGPU, with WebGL 2 as the fallback. |

## 2. The day

The game is built round a day, in the manner of an exploration-heavy collecting game.

```
Open the game
   -> the day's flyer: what the sky is doing, and three leads in three parts of the mountain
      -> plant a flag on one, and go: on foot, by lift, on skis or a bike, by shuttle
         -> on the way: stones on the snow, something for the field guide, a stamp, a bench
            -> bring it home: set a stone on the shelf, a patch on the board, fill the feeder
               -> tomorrow something has changed: a guest at the feeder, a letter,
                  a thing the town has built, three new leads
```

- **The flyer** is pinned up the first time the game is opened each day. Its three leads are
  the trail of the day, a place with no postcard yet (or the thing the town is building), and
  either someone with something for you or the inn's rumour of a rare stone. A lead is never
  a chore: nothing is lost by ignoring it and there is no prize for doing all three.
- **The cabin** is the player's own: a log cabin in the woods a short way from the Base Lodge,
  where every day begins. A shelf by the door shows five stones and a board three patches,
  chosen from what has been found. A feeder filled today has a guest at it tomorrow.
- **Town projects.** The town builds five things, one after another: a lean-to, a dock, a
  bandstand, a warming hut, a lookout. The player's part is to go and stake out the spot; by
  the next day it is built, for good, with a postcard for being there, boards to stand on,
  and a word and a letter from whoever wanted it.
- **The town's daily round.** A letter at the post office, the inn's rumour, a new bake, a new
  sandwich, a new library book; five doors called at in a day is a punch on a card.
- **The Snow Train**, once its pass is earned, carries the player to another season.
- **An ending, of a kind.** The day every patch is earned, one last letter comes from the
  whole town. It says there is nothing left to find, and to come up anyway.

## 3. What there is to do

### Movement

- **On foot:** the lower third of the screen is a movement stick; everything above turns the
  camera, which otherwise swings round behind. Two fingers pinch the camera nearer or further.
- **Skiing:** left and right steer, up tucks (and poles from a standstill), down is a hockey
  stop. Gentle turns carve; hard turns at speed drift. A tree is a bump, not a crash. The
  skier can always stop and always get going again.
- **The bike** is the same simulation with other numbers, for when the snow has gone.
- **Lifts:** all fourteen run. Board at the bottom, ride for up to a minute with the camera
  looking up the mountain, get off as you got on.
- **The shuttle** runs between the Base Lodge, the Ski Bowl and the depot.

### The Book

Everything had or found is an embroidered patch in the Book, shown as a pale ghost until it is
earned, so every shelf shows what there is to look for.

| Page | What is in it |
|---|---|
| Passport | A stamp for every named trail (over ninety) and woodland path, skied or walked past nine in ten of its checkpoints; a pin for each of the 14 lifts; a patch for each of 4 summits in each season; 25 postcards for places (five of them built by the town); 15 conditions earned under the real sky; every bench sat on; 28 patches for finishing whole kinds of thing |
| Minerals | 12 minerals of the Adirondacks, garnet first, found as stones on the groomed snow, beside the trails, in bare rock and in deep woods. The day's scatter is new at midnight. Each keeps its best size. |
| Guide | 42 animals, birds, plants and curiosities, each with its ground, its seasons and its hours. Shy ones bolt if come upon fast. |
| Pack | Hats and jackets to wear (22), letters (28), what has been tasted and read (33), the town round |

### People

Twenty-five to meet: seventeen people, five boards to read, a dog, a cat who is mayor, and
Tom, who is a snowman in winter and speaks in notes. They have 31 errands between them, never
timed and never failed; rewards are things to wear. They talk in short lines, about their own
small worries and each other. Three boards are chalked fresh each time they are read: the snow
report, the trail of the day, and the observer's log at the fire tower.

Others ski the trails, ride the chairs and walk Main Street. They are nobody in particular.

### Seasons, the hour and the weather

Winter from 10 November, spring from April, summer from June, fall from mid-September. A
season is a repaint of the same mountain: the ground, the far forest, each tree's dress, what
is in the air, what lives where, what the town puts by its doors, and how the player gets
down. The sun is where it really is over Gore, and the sky is the real one, fetched from
Open-Meteo, or invented when there is no signal.

## 4. The world

- Gore Mountain, North Creek, Town of Johnsburg, in the Adirondack Park. Four summits: Gore,
  Bear Mountain, Burnt Ridge, Little Gore.
- About 5.6 by 4.3 km with 990 m of relief: 1:1.2 across and 1.25:1 up against the real
  mountain, so slopes read one and a half times steeper than life. A long run takes a minute
  and a half; on foot the mountain is a long walk, which is what the lifts are for.
- Generated, never edited: `tools/terrain/build_world.py` makes heights, the trail mask,
  where no trees grow, how much of the forest is hardwood, and for each season a picture of
  the ground and one of the far forest, from USGS elevation and OpenStreetMap.
- Every building on the map is built for what it is: a cape, a farmhouse, a camp, a barn, a
  shop on Main Street. Places with names have buildings of their own. Trades and people are
  invented, and none is a real business.

## 5. The look

The owner chose the look by trying alternatives on the phone, twice: first the light (warm
low sun with violet shadows, a quiet white under snow), then the park print for the world and
everything in it.

- **Inks.** One short list of colours for everything made; the land has its own inks for
  each season.
- **Light in steps.** A few flat tones to each surface, so a hillside breaks into shapes.
- **A line round things.** Buildings, trees nearby, people, animals, stones and lift towers
  carry a dark outline.
- **A banded sky**, and hard edges on the ground underfoot.
- **Colour belongs to the light.** Models are flat and neutral; the hour and the weather
  colour them. The player's jacket is the most saturated thing on screen.
- **The player is small**: about a twentieth of the screen's height, just below the middle,
  above where the thumb rests.

The interface is paper, ink and enamel: Bebas Neue capitals for headings and buttons, Caveat
for anything handwritten, bottom sheets for every menu, and the Book laid out like a trail
map's legend with patches sewn on.

## 6. How it is made

| Layer | Choice |
|---|---|
| Language and build | TypeScript, Vite |
| Rendering | three.js, `WebGPURenderer`, falling back to WebGL 2 by itself |
| Movement | Our own fixed-step simulation on the heightfield; boxes for buildings, circles for trees |
| Interface | HTML and CSS over the canvas |
| Content | Typed tables (trails, people, errands, minerals, species, patches, projects), each with tests |
| Saves | `localStorage`, read defensively, with a save code in Settings as the backup |
| Offline | A hand-written service worker: network first, and a copy of the whole game kept for when there is none |
| Sound | Web Audio, made in code; there are no sound files |
| Checks | Vitest for the rules; Playwright scripts for pictures, touch, WebGPU's first frames and the benchmark |

### Where things come from

- **Built in code:** terrain, trees, every building, lifts, the train, signs, the people and
  the player (jointed figures, posed by code), stones, street furniture.
- **Made outside and brought in:** the field guide's 41 models. A picture of each (FLUX,
  through fal) is given a shape (Trellis, through fal), which a converter closes, cuts down to
  about a thousand triangles and prints in six inks.
- **Painted:** portraits, postcards, title pictures and shop-sign pictures (FLUX, through
  fal); the Book's patches, a sheet at a time to one brief (Tripo's image model).
- **Keys** are secrets of the build environment. None is in the repository.

### Budget

60 fps on the owner's phone, measured with the in-game benchmark. The cautious targets of 150
draw calls and 300,000 triangles were set early and are exceeded (about 150 to 200 calls, and
up to about 1.1 million triangles since the print); the phone held 60 fps at every benchmark
step when last measured, which was before the print. First load is about 8 MB against a
budget of 15.

## 7. What is still open

These are the owner's to settle; none blocks play.

1. **The print on the phone.** Its cost has not been measured there (benchmark step 6 against
   step 13), nor has it been seen on WebGPU, which the tools cannot show.
2. **Heat and battery** over a long session.
3. **The wording.** Every line of talk, every letter and every flyer lead is data, and the
   owner's to mark up.
4. **Names.** "Gore" is a working title. Shops and people are invented; the inn and a few
   buildings carry real names.
5. **A licence** for the repository, if it is ever to be shared beyond its owner.
