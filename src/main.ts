import '@fontsource/bebas-neue/latin-400.css';
import '@fontsource/caveat/latin-600.css';
import * as THREE from 'three/webgpu';
import { Sound } from './audio/sound';
import { parseConfig, withParams } from './config';
import { pinchedZoom } from './player/cameraMath';
import { BenchRun, showBenchResults } from './debug/bench';
import { deviceLabel, Hud } from './debug/hud';
import { Atmosphere } from './look/atmosphere';
import { paletteFor, type Weather } from './look/palette';
import { GROUND_SHEETS, MARK_SIZE, packSheets } from './look/groundMarks';
import { despeckle, freeze, inkOrder, restyle, type WorldLook } from './look/worldLook';
import { airFor, SEASON_LOOK, SEASON_NAME, seasonFor, seasonPalette, SEASONS, treeLook, type Season } from './look/season';
import { namedTime, sunPosition } from './look/sun';
import { easeWeather, fetchWeather, inventedWeather, NAMED_WEATHER } from './look/weather';
import { FrameStats } from './debug/perf';
import { COLLECT_REACH, Game, type GameEvent } from './game/game';
import { benchConditionsNow, conditionsNow } from './game/passport';
import { APPROACH, PEOPLE, type Mood } from './game/people';
import { LAST_LETTER, letterWaiting } from './game/letters';
import { dayNumber, sky, snowReport, trailOfTheDay, trailPick, wildlifeLog } from './game/report';
import { patchLead, trailAgainLead, dayBefore, flyerDate, personLead, pickLeads, placeLead, projectLead, rumourLead, trailLead, type Lead, postscript } from './game/today';
import { Flyer, type FlyerPage } from './ui/flyer';
import { CabinSheet } from './ui/cabinSheet';
import { MuseumSheet } from './ui/museumSheet';
import { fullness, given as inMuseum, had as hasPiece, HALLS, keeperSays, nextGift, PIECES } from './game/museum';
import { artSlug } from './game/artNames';
import { MINERALS } from './game/minerals';
import { KEEPSAKE, PATCHES } from './game/patches';
import { cabinSpots } from './world/cabin';
import { PROJECTS, townResting } from './game/projects';
import { TownProjects } from './world/projectMesh';
import { floorAt, projectFloors, projectWalls as wallsOfProject, type Floor } from './world/projectPlots';
import { Cabin } from './world/cabinMesh';
import { dayKey, parseSave, saveFromCode, saveToCode } from './game/save';
import { benchVisitor, SPECIES, speciesById, watchFor } from './game/wildlife';
import { Input } from './input/input';
import { Book, shortDay } from './ui/book';
import { TalkSheet, type Choice, type Written } from './ui/talk';
import { Toasts } from './ui/toasts';
import { sayDistance, wayTo } from './ui/mapView';
import { TrailMap, type MapPoint } from './ui/trailMap';
import { FollowCamera } from './player/followCamera';
import { Player } from './player/player';
import { pushOut } from './player/collide';
import { BIKE, fallLineYaw, SKI, SPRING_SKI } from './player/skiPhysics';
import { buildLiftPath, gateBeams, inLiftClearing, liftShacks, overBeam, pointAlong, stationNear } from './world/lifts';
import { Built } from './world/built';
import { signName } from './world/streets';
import { countryOf } from './world/country';
import { Critters } from './world/critters';
import { buildStops, CAMP_TENT, Folk, Keepsakes, type Keepsake, type Standing, type Stop } from './world/folk';
import { buildRoute, busyness, routePoint } from './world/crowd';
import { Crowd } from './world/crowdMesh';
import { critterGeometry, hasMadeModel, useMadeModels } from './world/critterModels';
import { LiftCars } from './world/liftCars';
import { loadModels } from './world/modelFiles';
import { Glints } from './world/glints';
import { buildLifts } from './world/scenery';
import { Snowfall } from './world/snowfall';
import { Terrain, type Print } from './world/terrainMesh';
import { SecretThings } from './world/secretMesh';
import { placeAt, secretSites, setting } from './world/secretSites';
import { leadLine, downRun } from './world/unmarked';
import { Plume } from './world/plume';
import { SkyShow } from './world/skyShow';
import { Powder } from './world/powder';
import { newPatch } from './ui/motion';
import { SpeedLines } from './world/speedLines';
import { inventedFresh, powderDepth } from './game/snowpack';
import { SnowField, type Hollow } from './world/snowField';
import { trackHalfWidth } from './world/tracks';
import { Companion } from './world/companion';
import { WornGround } from './world/wornMesh';
import { wornCells, wornKey } from './game/worn';
import { auroraOn, CLOUD_CLEAR, CLOUD_TOP, cloudSea, showerOn } from './game/sky';
import { Smoke } from './world/smoke';
import { BAND, bandAbout, bandWhole, CAMPER_HAUNTS, camperToday, concertOn, PAINTER_HAUNTS, painterToday, PIP_HAUNTS, pipToday, weekday, type Haunt } from './game/wanderers';
import { SECRETS, type Secret } from './game/secrets';
import { GroundLook } from './world/groundMaterial';
import { fromLocal } from './world/footprints';
import { townPlaceAt } from './world/townPlaces';
import { SkiTracks } from './world/tracks';
import { trailAt, type Place } from './world/trails';
import { Forest, TREE_RANGE } from './world/trees';
import { Walls, type WallBox } from './world/walls';
import { locate, namedSpots } from './world/whereabouts';
import { loadWorld, OPEN_LAND, OPEN_WATER } from './world/world';
import { printShadow } from './look/printShadow';
import { lit, usePrint } from './look/material';

/** The mountain's height from the river to the summit, in game metres. */
const RELIEF = 990;

/**
 * The season's sheet of ground marks: the pictures of its kinds, read and packed a kind to a
 * channel. Nothing, if any of them cannot be had: the ground is then printed without marks.
 */
async function loadMarks(season: Season, baseUrl: string): Promise<Uint8Array | null> {
  try {
    const pictures = await Promise.all(
      GROUND_SHEETS[season].map(async (kind) => {
        const image = new Image();
        image.src = `${baseUrl}art/ground/${kind}.png`;
        await image.decode();
        const canvas = document.createElement('canvas');
        canvas.width = canvas.height = MARK_SIZE;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (!ctx) throw new Error('no canvas');
        ctx.drawImage(image, 0, 0, MARK_SIZE, MARK_SIZE);
        return ctx.getImageData(0, 0, MARK_SIZE, MARK_SIZE).data;
      }),
    );
    return packSheets(pictures);
  } catch {
    return null;
  }
}

/** A picture of the land as a print: the same picture, repainted on a canvas in the season's inks. */
function repaint(texture: THREE.Texture, look: WorldLook, season: Season, keep: { print: Print | null } | null = null, water: { across: number; down: number; at: (i: number, j: number) => boolean } | null = null): THREE.Texture {
  if (look === 'plain') return texture;
  const image = texture.image as HTMLImageElement;
  const canvas = document.createElement('canvas');
  canvas.width = image.width;
  canvas.height = image.height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return texture;
  ctx.drawImage(image, 0, 0);
  const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height);
  restyle(pixels.data, look, season);
  // In winter the water is ice.
  if (water && season === 'winter') freeze(pixels.data, canvas.width, canvas.height, water.across, water.down, water.at);
  // The ground is seen from close to, where a stray pixel is a square blot: those are taken out.
  if (keep) despeckle(pixels.data, canvas.width, canvas.height);
  ctx.putImageData(pixels, 0, 0);
  // The ground's bytes are kept: the terrain weighs the inks of parts of them, for the ground underfoot.
  if (keep) keep.print = { data: pixels.data, width: canvas.width, height: canvas.height, order: inkOrder(pixels.data) };
  texture.dispose();
  return new THREE.CanvasTexture(canvas);
}

const M_TO_FT = 3.28084;
const MS_TO_MPH = 2.23694;
/** Camera pitch while riding a lift: nearly level, to look up the mountain. */
const LIFT_PITCH = 0.2;
/** Where the player's book is kept in the browser. */
const SAVE_KEY = 'gore.book';

/** Handle for screenshots and automated checks. See tools/shot.mjs. */
interface DebugHandle {
  ready: boolean;
  error: string | null;
  state(): Record<string, unknown>;
  teleport(placeId: string): boolean;
  setView(yaw: number, pitch: number): void;
  /** Turn the player and the camera to a yaw. */
  face(yaw: number): void;
  /** Stand the player at a position. */
  place(x: number, z: number): void;
  /** Where the trail map is looking: how far in, and the spot at the middle of it. */
  map(): { zoom: number; x: number; z: number };
  /** How many things are set to be drawn, by the part of the scene they belong to: where the draw calls go. */
  census(): Record<string, number>;
  /** Show or hide a part of the scene by name (as `census` lists them), to see what it costs. */
  show(part: string, on: boolean): void;
}

declare global {
  interface Window {
    __gore: DebugHandle;
  }
}

window.__gore = {
  ready: false,
  error: null,
  state: () => ({}),
  teleport: () => false,
  setView: () => {},
  face: () => {},
  place: () => {},
  map: () => ({ zoom: 1, x: 0, z: 0 }),
  census: () => ({}),
  show: () => {},
};

/**
 * The hint that marks the latest news as told. Change it when there is news again, and the
 * words where it is used: a returning player is told once.
 */
const NEWS = 'news-town';

/** How long someone must sit still on a bench before a bird will come to it, in seconds. */
const STILLNESS = 6;

/** What the mountain is doing while it loads. One is shown, by the minute of the hour. */
const LOADING_LINES = [
  'Loading the mountain…',
  'Combing the corduroy…',
  'Waking the lift attendants…',
  'Counting the garnets…',
  'Putting the chili on…',
  'Chalking up the snow report…',
  'Asking the Mayor…',
  'Getting up steam…',
];
{
  const line = document.getElementById('loading-line');
  if (line) line.textContent = LOADING_LINES[new Date().getMinutes() % LOADING_LINES.length] as string;
  // The season's picture behind the title, while the mountain loads.
  const loading = document.getElementById('loading');
  const asked = new URLSearchParams(location.search).get('season');
  const season = (SEASONS as readonly string[]).includes(asked ?? '') ? asked : seasonFor(new Date());
  if (loading) {
    loading.style.backgroundImage = `url(${import.meta.env.BASE_URL}art/title/${season}.webp)`;
    loading.classList.add('pictured');
  }
}

function showFatal(message: string): void {
  window.__gore.error = message;
  let el = document.getElementById('fatal');
  if (!el) {
    el = document.createElement('div');
    el.id = 'fatal';
    (document.getElementById('app') ?? document.body).appendChild(el);
  }
  // A kind word and a way on first; what went wrong, small, underneath, for whoever is fixing it.
  const sorry = document.createElement('b');
  sorry.textContent = "The mountain didn't load.";
  const why = document.createElement('p');
  why.textContent = navigator.onLine === false ? "There's no signal right now. It'll be here when there is." : "That happens sometimes. It's usually fine the second time.";
  const again = document.createElement('button');
  again.type = 'button';
  again.textContent = 'Try again';
  again.addEventListener('click', () => location.reload());
  const detail = document.createElement('small');
  detail.textContent = message;
  el.replaceChildren(sorry, why, again, detail);
}
window.addEventListener('error', (e) => showFatal(String(e.error?.stack ?? e.message)));
window.addEventListener('unhandledrejection', (e) => showFatal(String(e.reason?.stack ?? e.reason)));

/**
 * Launched from the Home Screen, iOS can lay the page out shorter than the screen by the height
 * of the status bar while still showing the whole screen, which leaves an empty bar along the
 * bottom. When that happens, size the game to the screen itself. See the note in style.css.
 */
/** Set from the `shortpage` option. See Config.shortPage. */
let pretendShort = 0;

function fillScreen(): void {
  const standalone =
    (navigator as { standalone?: boolean }).standalone === true || window.matchMedia('(display-mode: standalone)').matches;
  const upright = window.innerHeight >= window.innerWidth;
  const full = upright ? Math.max(screen.width, screen.height) : Math.min(screen.width, screen.height);
  const root = document.documentElement;
  // The height the page is actually laid out at. On some launches this is short even though
  // window.innerHeight reports the whole screen, so measure the layout, not the window.
  const page = Math.min(root.clientHeight || window.innerHeight, window.innerHeight);
  if (pretendShort > 0) {
    // A check is standing in for iOS: treat the screen as taller than the page by that much.
    root.style.setProperty('--app-height', `${page + pretendShort}px`);
    root.style.setProperty('--app-extra', `${pretendShort}px`);
  } else if (standalone && page < full - 1) {
    root.style.setProperty('--app-height', `${full}px`);
    root.style.setProperty('--app-extra', `${full - page}px`);
  } else {
    root.style.removeProperty('--app-height');
    root.style.removeProperty('--app-extra');
  }
}

async function boot(): Promise<void> {
  const cfg = parseConfig(location.search);
  // The print look lights everything in steps; it has to be said before anything is built.
  usePrint(cfg.look === 'poster');
  pretendShort = cfg.shortPage;
  fillScreen();
  for (const event of ['resize', 'orientationchange', 'pageshow']) window.addEventListener(event, fillScreen);
  document.addEventListener('visibilitychange', fillScreen);
  // iOS can settle the page's height a moment after launch without saying so.
  for (const delay of [300, 1500, 4000]) window.setTimeout(fillScreen, delay);
  const shadows = cfg.shadows;
  const canvas = document.getElementById('game') as HTMLCanvasElement;

  const renderer = new THREE.WebGPURenderer({ canvas, antialias: true, forceWebGL: cfg.renderer === 'webgl' });
  await renderer.init();
  const backend = (renderer.backend as { isWebGPUBackend?: boolean }).isWebGPUBackend ? 'WebGPU' : 'WebGL 2';
  renderer.shadowMap.enabled = shadows;

  const world = await loadWorld(import.meta.env.BASE_URL);
  // The player's book lives in the browser's storage; if that is unavailable the game still
  // plays, and simply forgets.
  const store = {
    read: (): string | null => {
      try {
        return localStorage.getItem(SAVE_KEY);
      } catch {
        return null;
      }
    },
    write: (text: string): void => {
      // A benchmark step stands at lodges, walks through town and is carried down a trail in
      // seasons the player may never have seen. None of that is the player's doing: it is not kept.
      if (typeof cfg.bench === 'number') return;
      try {
        localStorage.setItem(SAVE_KEY, text);
      } catch {
        // Private browsing, or storage full: nothing to be done.
      }
    },
  };
  // The season: one asked for by name; or wherever the Snow Train has taken the player; or the calendar's.
  const away = parseSave(store.read()).away as Season | null;
  const season: Season = cfg.season !== 'real' ? cfg.season : (away ?? seasonFor(new Date()));
  const look = SEASON_LOOK[season];
  // The drawn ground and the ground the player stands on are the same decimated grid.
  const ground = world.source.decimate(cfg.stride);

  const scene = new THREE.Scene();
  // Sky, light and haze all come from the atmosphere, which follows the clock and the weather.
  const atmosphere = new Atmosphere();
  scene.fog = atmosphere.fog;
  const snowfall = new Snowfall();
  scene.add(atmosphere.group, atmosphere.ambient, snowfall.mesh);
  const sun = atmosphere.light;
  if (shadows) {
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    const sc = sun.shadow.camera;
    sc.left = sc.bottom = -70;
    sc.right = sc.top = 70;
    sc.near = 1;
    sc.far = 400;
    sun.shadow.bias = -0.0008;
    sun.shadow.normalBias = 0.4;
    // In the print a shadow is one flat tone with a clean edge.
    if (cfg.look === 'poster') (sun.shadow as unknown as { filterNode: unknown }).filterNode = printShadow(2048);
  }
  scene.add(sun, sun.target);

  const loader = new THREE.TextureLoader();
  const [snowTexture, canopyTexture] = await Promise.all([
    loader.loadAsync(`${import.meta.env.BASE_URL}world/ground-${season}.png`),
    loader.loadAsync(`${import.meta.env.BASE_URL}world/canopy-${season}.png`),
  ]);
  // The print repaints both pictures in the season's inks before anything is drawn with them.
  const underfoot: { print: Print | null } = { print: null };
  // Where the water lies, square by square of the ground's own grid, for printing it as ice in winter.
  const water = {
    across: ground.cols,
    down: ground.rows,
    at: (i: number, j: number): boolean => world.openAt(ground.originX + i * ground.cell, ground.originZ + j * ground.cell) === OPEN_WATER,
  };
  const snowPicture = repaint(snowTexture, cfg.look, season, underfoot, water);
  const canopyPicture = repaint(canopyTexture, cfg.look, season, null, water);
  // Near the camera the ground is drawn from the weights of its inks, with the season's marks printed on it.
  const marks = underfoot.print && cfg.ground === 'marks' ? await loadMarks(season, import.meta.env.BASE_URL) : null;
  const groundLook = underfoot.print && cfg.ground !== 'flat' ? new GroundLook(season, underfoot.print.order, marks) : null;
  const terrain = new Terrain(ground, snowPicture, canopyPicture, underfoot.print, groundLook);
  const liftPaths = world.lifts.map((lift) => buildLiftPath(lift, (x, z) => ground.heightAt(x, z)));
  const beams = gateBeams(liftPaths);
  // Everything people have built, apart from the lifts: lodges, the town, the train, signs.
  const built = new Built(world, (x, z) => ground.heightAt(x, z), season, look.roof, shadows, cfg.siding);
  const { townPlaces, depot: depotAt } = built;
  // The player's own cabin, on the plot the map gives it: its door, its yard and its feeder.
  const cabin = built.cabin ? new Cabin(built.cabin, (x, z) => ground.heightAt(x, z), look.roof, shadows, cfg.siding) : null;
  const home = built.cabin ? cabinSpots(built.cabin) : null;
  // Trees keep out of lift corridors and stand back from buildings...
  // ...and off roads, paths, lots and water. Out of winter each tree is dressed for the season:
  // hardwoods low on the mountain, spruce and fir higher up.
  // The animals, and the things people have made out on the mountain, may be the game's own blocks or models made
  // outside it. They are fetched before anything that stands one of them up is built.
  if (cfg.models !== 'blocks') useMadeModels(await loadModels(cfg.models, import.meta.env.BASE_URL));
  // The mountain's secrets: registers, plaques, cairns, old workings. Nothing points at them.
  const secretSetting = setting(world, townPlaces);
  const secretPlaces = secretSites(world, townPlaces, secretSetting);
  // What leads to some of them from the nearest trail, in the season it does: prints in the snow, buckets on the maples.
  const leads = new Map<string, number[]>();
  for (const secret of SECRETS) {
    const site = secret.lead?.seasons.includes(season) ? secretPlaces.find((at) => at.id === secret.id) : undefined;
    if (site) leads.set(secret.id, leadLine(world, site.x, site.z));
  }
  const secretThings = new SecretThings(secretPlaces, (x, z) => ground.heightAt(x, z), season, shadows, { runs: secretSetting.runs, leads });
  scene.add(secretThings.group);
  // Steam from the sugar shack when it is boiling, and the camper's smoke, which is there to be seen from across the valley.
  const steam = new Smoke(secretThings.flues);
  const plume = new Plume();
  scene.add(steam.mesh, plume.mesh);
  // What is in the sky only at the right moment: cloud in the valleys, shooting stars, the northern lights.
  const cloudTop = RELIEF * CLOUD_TOP;
  const skyShow = new SkyShow(cloudTop, ground.maxX - ground.minX);
  scene.add(skyShow.group);
  // Loose snow, as a layer of its own lying over the ground round the player, for whoever goes through it to cut into;
  // the powder a ski throws up out of it; and the air going by at speed.
  const printed = underfoot.print;
  const snowField = new SnowField({
    heightAt: (x, z) => ground.heightAt(x, z),
    // It lies on everything but a road, a path or the water, a street that is ploughed, a floor of boards, and the foot of a wall.
    depthAt: (x, z) => (world.openAt(x, z) !== 0 || built.swept(x, z) || walls.bumpAt(x, z, 1.1) !== null || floorAt(floors, x, z) !== null ? 0 : powderDepth(freshNow(), weather.snowing, world.onTrail(x, z), season)),
    // The snow is the colour the ground under it is printed in, so a trail under new snow is still a trail; and where the
    // ground is not snow at all (rock, a tree's shade printed dark), it is the pale blue of snow in the woods.
    colourAt: (x, z, into) => {
      if (!printed) {
        into.setHex(0xc3d3ea);
        return;
      }
      const px = Math.min(printed.width - 1, Math.max(0, Math.floor((((x - ground.originX) / ground.cell + 0.5) / ground.cols) * printed.width)));
      const py = Math.min(printed.height - 1, Math.max(0, Math.floor((((z - ground.originZ) / ground.cell + 0.5) / ground.rows) * printed.height)));
      const i = (py * printed.width + px) * 4;
      const r = printed.data[i] as number;
      const g = printed.data[i + 1] as number;
      const b = printed.data[i + 2] as number;
      if (r + g + b < 520) into.setHex(0xc3d3ea);
      else into.setRGB(r / 255, g / 255, b / 255, THREE.SRGBColorSpace);
    },
  });
  const powder = new Powder();
  const speedLines = new SpeedLines();
  scene.add(snowField.mesh, powder.mesh, speedLines.mesh);
  // Wherever somebody might be standing on some day (the painter, the camper, the band, Pip), there is room to stand.
  const hauntSpots = [
    ...PAINTER_HAUNTS.map((h) => ['nell', h, 6] as const),
    ...CAMPER_HAUNTS.map((h) => ['ro', h, 9] as const),
    ...BAND.map((b) => [b.who, b.haunt, 5] as const),
    ...PIP_HAUNTS.map((h) => ['pip', h, 3] as const),
  ].flatMap(([who, haunt, room]) => {
    const site = placeAt(secretSetting, `${who}-${haunt.id}`, haunt.where, haunt.off ?? 0, secretPlaces);
    return site ? [{ x: site.x, z: site.z, room }] : [];
  });
  const hauntClear = (x: number, z: number): boolean => hauntSpots.some((h) => Math.abs(h.x - x) < h.room && Math.abs(h.z - z) < h.room && Math.hypot(h.x - x, h.z - z) < h.room);
  const trees = new Forest(
    ground,
    world,
    cfg.trees,
    shadows,
    (x, z) => world.openAt(x, z) !== 0 || inLiftClearing(liftPaths, x, z) || built.near(x, z) || secretThings.clears(x, z) || hauntClear(x, z),
    look.conifers ? (x, z, kindRoll, pickRoll) => treeLook(season, world.hardwoodAt(x, z), kindRoll, pickRoll) : null,
  );
  const liftCars = new LiftCars(liftPaths, shadows);
  // Everybody else: skiers down the trails, people on the chairs, the town out walking Main Street.
  const townMiddle = world.places.find((p) => p.id === 'depot');
  const crowd = cfg.crowd
    ? new Crowd(world, liftPaths, (x, z) => ground.heightAt(x, z), season, look.ride, shadows, townMiddle ? { x: townMiddle.x, z: townMiddle.z, reach: 520 } : null)
    : null;
  scene.add(terrain.group, trees.group, buildLifts(liftPaths, season === 'winter'), liftCars.group, built.group);
  if (cabin) scene.add(cabin.group);
  if (crowd) scene.add(crowd.group);
  // The attendants' shacks at the lifts are solid too, and have roofs a camera keeps out from under.
  const walls = new Walls([...built.walls, ...liftShacks(liftPaths)]);
  /** Where someone at a place must move to in order to clear a tree trunk or a wall. */
  const bumpAt = (x: number, z: number, radius: number) => {
    const trunk = trees.trunkAt(x, z, radius);
    return (trunk && pushOut(x, z, radius, trunk)) ?? walls.bumpAt(x, z, radius);
  };
  /** Ground that runs fast: a trail, or a road, path or lawn. */
  const firmAt = (x: number, z: number): boolean => world.onTrail(x, z) || world.openAt(x, z) === OPEN_LAND;

  const player = new Player(shadows, look.ride, look.ride === 'bike' ? BIKE : season === 'spring' ? SPRING_SKI : SKI);
  // A bike's wheels run in one line; skis side by side.
  const tracks = new SkiTracks(undefined, look.ride === 'bike' ? 0 : undefined);
  const glints = new Glints(shadows);
  const critters = new Critters(season, shadows);
  // For comparing looks: every animal that has a made model, in a row a few steps in front of the player.
  const zoo = new THREE.Group();
  zoo.name = 'zoo';
  const lineUp = (x: number, z: number, yaw: number): void => {
    zoo.clear();
    const flat = lit({ vertexColors: true, flatShading: true });
    const soft = lit({ vertexColors: true });
    const ink = new THREE.MeshBasicMaterial({ color: 0x22304a, side: THREE.BackSide });
    // Four rows of four across the way the player is looking, the small ones in front: an upright screen has no room for more.
    const all =
      cfg.zoo === 2
        ? ['chanterelle', 'flyagaric', 'trillium', 'troutlily', 'ladyslipper', 'daisy', 'fiddlehead', 'blueberry', 'mapleleaf', 'balsamcone', 'birchbark', 'goldenrod', 'chickadee', 'hummingbird', 'chipmunk', 'cattail', 'bluejay', 'grayjay', 'grouse', 'hare', 'raven', 'loon', 'cairn', 'snowman']
        : ['squirrel', 'marten', 'otter', 'beaver', 'porcupine', 'raccoon', 'fox', 'owl', 'bobcat', 'coyote', 'turkey', 'eagle', 'deer', 'bear', 'moose', 'heron'];
    // A look that has only some of them shows only those, not the rest in blocks.
    const ids = cfg.models === 'blocks' ? all : all.filter(hasMadeModel);
    const ahead = { x: -Math.sin(yaw), z: -Math.cos(yaw) };
    const across = { x: Math.cos(yaw), z: -Math.sin(yaw) };
    ids.forEach((id, i) => {
      const row = Math.floor(i / 4);
      // Small things stand closer together and nearer than big ones.
      const wide = cfg.zoo === 2 ? 0.75 + row * 0.22 : 1.3 + row * 0.75;
      const deep = cfg.zoo === 2 ? 2.2 + row * 1.25 : 3.5 + row * 3;
      const along = ((i % 4) - 1.5) * wide;
      const px = x + ahead.x * deep + across.x * along;
      const pz = z + ahead.z * deep + across.z * along;
      const geometry = critterGeometry(id, season);
      const mesh = new THREE.Mesh(geometry, geometry.userData.smooth ? soft : flat);
      if (geometry.userData.shell) mesh.add(new THREE.Mesh(geometry.userData.shell as THREE.BufferGeometry, ink));
      mesh.position.set(px, ground.heightAt(px, pz), pz);
      // Side on to the player, heads to the left.
      mesh.rotation.y = yaw + Math.PI / 2;
      mesh.castShadow = shadows;
      zoo.add(mesh);
    });
  };
  scene.add(zoo);
  scene.add(player.object, tracks.mesh, glints.group, critters.group);
  if (!cfg.me) player.object.visible = false;

  // The collecting game.
  const game = new Game(
    {
      trails: world.trails,
      lifts: world.lifts,
      places: world.places,
      paths: world.paths,
      openAt: (x, z) => world.openAt(x, z),
      country: countryOf(world),
      spots: namedSpots(world),
      benches: built.benches,
      projects: built.plots,
      // Places a rumoured stone may lie: the lookouts, the ponds and the old workings, each resolved to ground that can be stood on.
      rumourSpots: [...world.spots.filter((sp) => sp.kind === 'viewpoint' || sp.kind === 'quarry'), ...world.ponds.filter((sp) => ['rabbit-pond', 'duck-pond', 'north-creek-reservoir'].includes(sp.id))].flatMap((sp) => {
        const at = locate(world, { spot: sp.id });
        return at ? [{ name: sp.name, x: at.x, z: at.z }] : [];
      }),
      minX: world.source.minX,
      minZ: world.source.minZ,
      trailDistance: (x, z) => world.trailDistance(x, z),
      slopeDegAt: (x, z) => world.source.slopeDegAt(x, z),
      mineDistance: (x, z) => Math.min(...world.spots.filter((sp) => sp.kind === 'quarry').map((sp) => Math.hypot(sp.x - x, sp.z - z))),
    },
    store,
  );
  // Once the letter from everybody has been had, the town's flags are out, and stay out.
  if (LAST_LETTER in game.save.letters) built.celebrate();
  const toasts = new Toasts(cfg.hud);
  const book = new Book(game);
  // Sound starts with the first touch, which is when a browser will let it.
  const sound = new Sound();
  // Safari counts the end of a touch, not its start, as the player's say-so; listen for both.
  for (const gesture of ['pointerdown', 'pointerup', 'touchend', 'click', 'keydown']) window.addEventListener(gesture, () => sound.unlock(), { passive: true });
  const announce = (events: readonly GameEvent[]): void => {
    if (events.length === 0) return;
    for (const event of events) {
      toasts.show(event);
      // A patch had for the first time is sewn on in the announcement, and again in its place in the Book when that is next looked at.
      if (event.art && newPatch(event)) book.earned(event.art);
    }
    // One tune for a batch, the grandest of them, so several stamps at once do not clash.
    const order = ['patch', 'peak', 'season', 'gear', 'secret', 'mineral', 'trail', 'path', 'lift', 'landmark', 'condition', 'errand', 'sighting', 'item'];
    const lead = [...events].sort((a, b) => order.indexOf(a.kind) - order.indexOf(b.kind))[0] as GameEvent;
    sound.play(lead.kind, lead.detail);
    book.refresh();
  };
  const church = townPlaces.find((p) => p.style === 'church') ?? null;
  /** The hour the church last struck, so it strikes once as each hour comes round. */
  let struck: number | null = null;
  /** The hour of the day at the mountain, 0 to 23, whatever clock the phone keeps. */
  const goreHour = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', hour: 'numeric', hourCycle: 'h23' });
  const hourAtGore = (when: Date): number => Number(goreHour.format(when)) % 24;
  /** The bench last sat down on. Whether the player is still on it is the player's to say. */
  let sittingOn: (typeof built.benches)[number] | null = null;
  /** How long the player has been sitting still, in seconds, and the bird that has come to sit by them, if one has. */
  let satFor = 0;
  const visitor = new THREE.Mesh(new THREE.BufferGeometry(), lit({ vertexColors: true, flatShading: true }));
  visitor.visible = false;
  visitor.castShadow = shadows;
  scene.add(visitor);
  /** The middle of town, for a word of introduction on first walking in. */
  const townHeart = townPlaces.find((p) => p.id === 'north-creek-post-office') ?? townPlaces.find((p) => p.id === 'copperfield-inn') ?? null;
  /** Say something helpful, the first time it is needed and never again. */
  const hint = (id: string, title: string, detail: string): void => {
    if (cfg.intro && game.hint(id)) toasts.show({ kind: 'hint', title, detail });
  };
  // Keep the book safe when the game is put away.
  window.addEventListener('pagehide', () => game.persist());
  document.addEventListener('visibilitychange', () => game.persist());
  const camera = new THREE.PerspectiveCamera(55, 1, 0.3, 16000); // lens is set by follow.setAspect()
  // How far back the camera stands is the player's to set, by pinching, and is remembered.
  // An address that names a distance has its way, for the tools.
  const ZOOM_KEY = 'gore.zoom';
  const zoomKept = (): number => {
    if (new URLSearchParams(location.search).has('zoom')) return cfg.zoom;
    try {
      const kept = Number(localStorage.getItem(ZOOM_KEY));
      return kept > 0 ? pinchedZoom(kept, 1) : cfg.zoom;
    } catch {
      return cfg.zoom;
    }
  };
  const follow = new FollowCamera(camera, zoomKept());
  const input = new Input(canvas);

  const summit = world.places.find((p) => p.id === 'summit');
  const baseLodge = world.places.find((p) => p.id === 'base-lodge');
  let liftClock = 0;
  /** True while the welcome is on the screen. */
  let welcomed = false;
  /** The camera pitch to return to after a lift ride, while that is still under way. */
  let pitchAfterRide: number | null = null;
  /** Set when the player has jumped somewhere, so the surroundings are built at once, not gradually. */
  let fillScene = true;
  const teleport = (place: Place): void => {
    // Stand a little way off, on the side facing the view, so the placeholder building ends up
    // behind the camera.
    const lookAt = (place.id === 'summit' ? baseLodge : summit) ?? place;
    const dx = lookAt.x - place.x;
    const dz = lookAt.z - place.z;
    const len = Math.hypot(dx, dz) || 1;
    const px = place.x + (dx / len) * 50;
    const pz = place.z + (dz / len) * 50;
    // Start on groomed snow where there is some nearby, not in the trees.
    const spot = world.nearestTrailSpot(px, pz, 225) ?? { x: px, z: pz };
    player.place(spot.x, spot.z, ground);
    follow.faceToward(player.position.x, player.position.z, lookAt.x, lookAt.z);
    player.face(follow.yaw);
    fillScene = true;
  };

  const start = world.places.find((p) => p.id === cfg.at) ?? baseLodge ?? world.places[0];
  if (start) teleport(start);
  // `at` may also name one of the town's places: stand across the street from its front door.
  const startDoor = townPlaces.find((p) => p.id === cfg.at);
  if (startDoor) {
    // Far enough back to see the front, and out of whatever stands across the street.
    const back = startDoor.d / 2 + 13;
    let sx = startDoor.x + Math.sin(startDoor.turn) * back;
    let sz = startDoor.z + Math.cos(startDoor.turn) * back;
    for (let i = 0; i < 4; i++) {
      const bump = walls.bumpAt(sx, sz, 2.5);
      if (!bump) break;
      sx = bump.x + bump.nx * 0.5;
      sz = bump.z + bump.nz * 0.5;
    }
    player.place(sx, sz, ground);
    follow.faceToward(player.position.x, player.position.z, startDoor.x, startDoor.z);
    player.face(follow.yaw);
    fillScene = true;
  }
  // The day begins at home: in the yard, looking at the cabin.
  const goHome = (): boolean => {
    if (!home || !built.cabin) return false;
    player.place(home.yard.x, home.yard.z, ground);
    follow.faceToward(player.position.x, player.position.z, built.cabin.x, built.cabin.z);
    player.face(follow.yaw);
    fillScene = true;
    return true;
  };
  if (cfg.at === 'home') goHome();
  if (cfg.pos) player.place(cfg.pos.x, cfg.pos.z, ground);
  if (cfg.yaw !== null) {
    follow.yaw = cfg.yaw;
    player.face(cfg.yaw);
  }
  if (cfg.zoo) lineUp(player.position.x, player.position.z, follow.yaw);

  const trailMap = new TrailMap(
    world,
    liftPaths,
    canopyPicture.image as CanvasImageSource,
    () => ({ x: player.position.x, z: player.position.z, yaw: player.travelHeading }),
    snowPicture.image as CanvasImageSource,
  );
  // One sheet at a time.
  const talkSheet = new TalkSheet();
  const flyer = new Flyer();
  trailMap.onOpen = () => {
    book.close();
    talkSheet.close();
    flyer.close();
    cabinSheet.close();
    museumSheet.close();
  };
  book.onOpen = () => {
    trailMap.close();
    talkSheet.close();
    flyer.close();
    cabinSheet.close();
    museumSheet.close();
  };
  talkSheet.onOpen = () => {
    trailMap.close();
    book.close();
    flyer.close();
    cabinSheet.close();
    museumSheet.close();
  };
  flyer.onOpen = () => {
    trailMap.close();
    book.close();
    talkSheet.close();
    cabinSheet.close();
    museumSheet.close();
  };
  // The cabin: what is on its shelf and its board is set out from the save, and changed from its sheet.
  const cabinSheet = new CabinSheet();
  const art = (set: string, id: string): string => `${import.meta.env.BASE_URL}art/${set}/${artSlug(id)}.webp`;
  const setOut = (): void => cabin?.show(game.save.cabin, (id) => MINERALS.find((m) => m.id === id)?.colour ?? 0xb0a090, (id) => art('patches', id));
  setOut();
  cabinSheet.onOpen = () => {
    trailMap.close();
    book.close();
    talkSheet.close();
    flyer.close();
    museumSheet.close();
  };
  // The museum: what is in its cases, and what the player has to show its keeper.
  const museumSheet = new MuseumSheet();
  const museumDoor = townPlaces.find((p) => p.id === 'museum')?.door ?? null;
  museumSheet.onOpen = () => {
    trailMap.close();
    book.close();
    talkSheet.close();
    flyer.close();
    cabinSheet.close();
  };
  museumSheet.onGive = () => {
    const { pieces, events } = game.museumGive(today);
    announce(events);
    return pieces.map((piece) => piece.key);
  };
  const openMuseum = (): void =>
    museumSheet.open(() => {
      const full = fullness(game.save);
      const gift = nextGift(game.save);
      return {
        room: art('rooms', 'museum'),
        says: keeperSays(game.save, today, season),
        waiting: game.museumWaiting().length,
        given: full.given,
        total: full.total,
        next: gift && full.given < gift.at ? { at: gift.at, what: 'something from Silas' } : null,
        halls: HALLS.map((hall) => ({
          name: hall.name,
          bare: hall.bare,
          ...full.halls[hall.id],
          places: PIECES.filter((piece) => piece.hall === hall.id).map((piece) => ({
            key: piece.key,
            name: piece.name,
            art: `${import.meta.env.BASE_URL}art/${piece.art}.webp`,
            state: inMuseum(game.save, piece) ? ('in' as const) : hasPiece(game.save, piece) ? ('yours' as const) : ('none' as const),
            picture: hall.id === 'gallery',
          })),
        })),
      };
    });
  cabinSheet.onArrange = (where, slot) => {
    game.arrange(where, slot);
    setOut();
  };
  cabinSheet.onPlace = (where, slot, id) => {
    game.place(where, slot, id);
    setOut();
  };
  cabinSheet.onFill = () => {
    if (game.fillFeeder(today)) toasts.show({ kind: 'hint', title: 'Feeder filled', detail: 'Somebody might come by tomorrow.' });
  };
  const openCabin = (): void =>
    cabinSheet.open(() => {
      const guest = game.feederGuest(today, season, watch);
      return {
        cabin: game.save.cabin,
        stoneArt: (id) => art('minerals', id),
        patchArt: (id) => art('patches', id),
        stoneName: (id) => MINERALS.find((m) => m.id === id)?.name ?? id,
        patchName: (id) => (id === KEEPSAKE.id ? KEEPSAKE.name : (PATCHES.find((p) => p.id === id)?.name ?? id)),
        stoneChoices: game.shelfChoices(),
        patchChoices: game.wallChoices(),
        guest: guest ? (speciesById(guest)?.name ?? null) : null,
      };
    });
  // What the town builds: each project as it stands today, staked out or built.
  const townProjects = new TownProjects(built.plots, new Map(PROJECTS.map((p) => [p.id, p.kind])), (x, z) => ground.heightAt(x, z), look.roof, shadows, cfg.siding);
  scene.add(townProjects.group);
  /** What of each built project is solid, so that it can be taken away again if the book changes. */
  const projectWalls = new Map<string, WallBox[]>();
  /** The floors of what has been built: a dock's planks, a bandstand's boards. */
  let floors: Floor[] = [];
  const showProjects = (): void => {
    for (const p of PROJECTS) {
      const state = game.projectState(p.id, today);
      townProjects.set(p.id, state);
      for (const box of projectWalls.get(p.id) ?? []) walls.remove(box);
      const plot = built.plots.find((q) => q.id === p.id);
      const solid = state === 'built' && plot ? wallsOfProject(p.kind, plot, ground.heightAt(plot.x, plot.z)) : [];
      for (const box of solid) walls.add(box);
      projectWalls.set(p.id, solid);
    }
    floors = PROJECTS.flatMap((p) => {
      const plot = built.plots.find((q) => q.id === p.id);
      return plot && game.projectState(p.id, today) === 'built' ? projectFloors(p.kind, plot, ground.heightAt(plot.x, plot.z)) : [];
    });
  };
  /**
   * How far above the ground (or below it) the player's feet are: up on a floor the town has
   * built, or, out of winter, down in the water to the knees. Open water is only painted on
   * the ground, so someone crossing it wades. It is eased, so a step up is a step and not a jump.
   */
  let footing = 0;
  const WADE = -0.55;
  /** Where the ground is asked about, round the player's feet, to tell the shallows from the middle. */
  const SHALLOWS: readonly (readonly [number, number])[] = [
    [0, 0],
    [5, 0],
    [-5, 0],
    [0, 5],
    [0, -5],
  ];
  /** True while whoever was at the feeder is still there for the player to look at, though the feeder is empty again. */
  let guestStays = false;

  // --- People, lost property and the shuttle --------------------------------------------------
  /** A spot near a described place where someone can stand: clear of walls, on the ground. */
  const standAt = (at: Parameters<typeof locate>[1], dx = 0, dz = 0): { x: number; y: number; z: number } | null => {
    const where = locate(world, at);
    if (!where) return null;
    let x = where.x + dx;
    let z = where.z + dz;
    for (let i = 0; i < 4; i++) {
      const bump = walls.bumpAt(x, z, 1.4);
      if (!bump) break;
      x = bump.x + bump.nx * 0.5;
      z = bump.z + bump.nz * 0.5;
    }
    return { x, y: ground.heightAt(x, z), z };
  };
  // Someone described as being at one of the town's named places stands by its front door,
  // a step to one side, and the next to arrive stands on the other.
  const atDoor = new Map<string, number>();
  const standings = PEOPLE.flatMap((person): Standing[] => {
    // Whoever is somewhere different every day is stood there once the day is known.
    if (person.roams) return [];
    const described = 'spot' in person.at || 'road' in person.at ? locate(world, person.at) : null;
    const keeps = described && townPlaceAt(townPlaces, described.x, described.z);
    if (keeps) {
      const taken = atDoor.get(keeps.id) ?? 0;
      atDoor.set(keeps.id, taken + 1);
      const aside = (taken % 2 === 0 ? 1 : -1) * (2.4 + Math.floor(taken / 2) * 2.4);
      const x = keeps.door.x + Math.cos(keeps.turn) * aside;
      const z = keeps.door.z - Math.sin(keeps.turn) * aside;
      return [{ person, x, y: ground.heightAt(x, z), z }];
    }
    const at = standAt(person.at);
    if (!at) return [];
    // The groomer's snowcat is parked a little way off; the patroller's sled lies at her feet.
    const beside = person.prop === 'snowcat' ? standAt(person.at, 9, 6) : person.prop === 'sled' ? standAt(person.at, 1.6, -0.6) : null;
    return [{ person, ...at, ...(beside ? { prop: { ...beside, turn: person.prop === 'snowcat' ? 2.5 : 0.4 } } : {}) }];
  });
  // The people who roam: a painter, a camper, the band. Each begins nowhere, and is stood wherever today finds them.
  const roamers = PEOPLE.filter((person) => person.roams).map((person): Standing => ({ person, x: 0, y: -1000, z: 0, ...(person.prop ? { prop: { x: 0, y: -1000, z: 0, turn: 0 } } : {}) }));
  const folk = new Folk([...standings, ...roamers], shadows, season);
  // What the map marks: the lodges and the town, the four summits, every place worth a postcard,
  // every bench, the town's doors, and whoever has something for the player. Things that go in
  // the book say whether they are in it yet.
  const MAP_LODGES: Record<string, string> = { 'base-lodge': 'Base Lodge', 'saddle-lodge': 'Saddle Lodge', 'ski-bowl-lodge': 'Ski Bowl', depot: 'North Creek' };
  const kept = (day: string | undefined, did: string, yet: string): string => (day ? `${did} ${shortDay(day)}` : yet);
  const fixedPoints: MapPoint[] = [
    ...(built.cabin ? [{ kind: 'home', x: built.cabin.x, z: built.cabin.z, label: 'Home', note: 'your cabin' } satisfies MapPoint] : []),
    ...world.places.filter((p) => p.id in MAP_LODGES).map((p): MapPoint => ({ kind: 'lodge', x: p.x, z: p.z, label: MAP_LODGES[p.id] as string })),
    ...townPlaces.filter((p) => p.sign).map((p): MapPoint => ({ kind: 'place', x: p.x, z: p.z, label: signName(p.sign) })),
  ];
  trailMap.points = () => [
    ...fixedPoints,
    ...game.peaks.map((p): MapPoint => ({ kind: 'summit', x: p.x, z: p.z, label: p.name, done: p.id in game.save.peaks, note: kept(game.save.peaks[p.id], 'stood on', 'not climbed yet') })),
    // A lodge that is also worth a postcard is marked as a lodge.
    ...game.landmarks
      .filter((l) => !(l.id in MAP_LODGES) && !game.peaks.some((p) => p.id === l.id) && game.landmarkOpen(l.id, today))
      .map((l): MapPoint => ({ kind: 'landmark', x: l.x, z: l.z, label: l.name, done: l.id in game.save.landmarks, note: kept(game.save.landmarks[l.id], 'visited', 'no postcard yet') })),
    // The spot the town wants staked out, or where the crew is at work.
    ...built.plots.flatMap((plot): MapPoint[] => {
      const inHand = game.projectInHand(today);
      return inHand?.project.id === plot.id ? [{ kind: 'landmark', x: plot.x, z: plot.z, label: inHand.project.name, done: false, note: inHand.state === 'proposed' ? 'wants staking out' : 'being built' }] : [];
    }),
    ...built.benches.map((b): MapPoint => ({ kind: 'bench', x: b.x, z: b.z, label: `Bench: ${b.name}`, done: b.id in game.save.benches, note: kept(game.save.benches[b.id], 'sat on', 'not sat on yet') })),
    ...standings.filter((st) => game.hasBusiness(st.person.id, season)).map((st): MapPoint => ({ kind: 'person', x: st.x, z: st.z, label: `${st.person.name} · ${st.person.role}` })),
    // What the player has found that is on no map is on theirs, in pencil. (A room is a door in town, and is marked as one.)
    ...secretPlaces.flatMap((at): MapPoint[] => {
      const secret = SECRETS.find((sec) => sec.id === at.id);
      const day = game.save.secrets[at.id];
      return secret && day && secret.kind !== 'room' ? [{ kind: 'secret', x: at.x, z: at.z, label: secret.kind === 'plaque' ? `Why it's called ${secret.name}` : secret.name, note: `found ${shortDay(day)}` }] : [];
    }),
  ];
  // In pencil: the unmarked runs that have been found, and the ground the player has worn into paths (a dot to each square).
  trailMap.pencilled = () => [...secretSetting.runs.filter((run) => run.id in game.save.secrets).map((run) => run.pts), ...wornCells(game.save).map((cell) => [cell.x, cell.z, cell.x + 0.5, cell.z])];
  trailMap.progress = (kind, name) => {
    if (kind === 'lift') return { done: name in game.save.lifts, note: kept(game.save.lifts[name], 'ridden', 'not ridden yet') };
    const entry = (kind === 'trail' ? game.save.trails : game.save.paths)[name];
    if (entry?.stamped) return { done: true, note: `stamped ${shortDay(entry.stamped)}` };
    const passed = [...(entry?.seen ?? '')].filter((c) => c === '1').length;
    const of = entry?.seen.length ?? 0;
    return { done: false, note: passed > 0 ? `${passed} of ${of} checkpoints` : 'no stamp yet' };
  };
  // The player's flag: planted from the map, it stands in the world as a pennant on a pole, and
  // a pointer under the place name says how far off it is and which way. Coming to it takes it up.
  const pennant = new THREE.Group();
  pennant.name = 'flag';
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.09, 9, 6).translate(0, 4.5, 0), lit({ color: 0xd9dde4, flatShading: true }));
  const cloth = new THREE.BufferGeometry();
  cloth.setAttribute('position', new THREE.BufferAttribute(new Float32Array([0, 9, 0, 0, 7.2, 0, 2.8, 8.1, 0]), 3));
  cloth.computeVertexNormals();
  pennant.add(pole, new THREE.Mesh(cloth, lit({ color: 0xc8402d, side: THREE.DoubleSide, flatShading: true })));
  pennant.visible = false;
  scene.add(pennant);
  const pointer = document.createElement('div');
  pointer.id = 'flag-pointer';
  pointer.hidden = true;
  const pointerArrow = document.createElement('i');
  pointerArrow.textContent = '▲';
  const pointerText = document.createElement('span');
  pointer.append(pointerArrow, pointerText);
  document.getElementById('hud')?.appendChild(pointer);
  const showFlag = (): void => {
    const flag = game.save.flag;
    trailMap.flag = flag;
    pennant.visible = flag !== null;
    pointer.hidden = flag === null;
    if (flag) pennant.position.set(flag.x, ground.heightAt(flag.x, flag.z), flag.z);
  };
  /** Turn the pointer toward the flag, as seen from where the camera looks. */
  const pointToFlag = (): void => {
    const flag = game.save.flag;
    if (!flag) return;
    const way = wayTo({ x: player.position.x, z: player.position.z, yaw: follow.yaw }, flag);
    // Up the screen is straight ahead; a turn to the left leans the arrow left.
    pointerArrow.style.transform = `rotate(${(-way.turn).toFixed(2)}rad)`;
    const text = `${flag.label} · ${sayDistance(way.metres)}`;
    if (pointerText.textContent !== text) pointerText.textContent = text;
  };
  trailMap.onFlag = (flag) => {
    game.plant(flag);
    showFlag();
    pointToFlag();
  };
  showFlag();
  const keepsakes = new Keepsakes();
  /** A step given in a building's own frame (along its front, out from it), as a step in the world. */
  const offsetFrom = (at: { turn: number }, lx: number, lz: number): [number, number] => {
    const step = fromLocal({ x: 0, z: 0, turn: at.turn }, lx, lz);
    return [step.x, step.z];
  };
  // The shuttle runs between the mountain, the Ski Bowl and town.
  const stops: Stop[] = [
    ['base-lodge', 'the Base Lodge'],
    ['ski-bowl-lodge', 'the Ski Bowl'],
    ['depot', 'North Creek'],
  ].flatMap(([id, name]): Stop[] => {
    // The depot's stop is on the town side of the station, away from the track.
    const at = id === 'depot' && depotAt?.rails ? standAt({ place: 'depot' }, ...offsetFrom(depotAt, -21, -15)) : standAt({ place: id as string }, 13, 7);
    return at ? [{ id: id as string, name: name as string, ...at }] : [];
  });
  // And out to the old garnet mine, where the tours have always gone by bus.
  const mineStop = standAt({ spot: 'gore-mt-mineral-shop' }, 12, 8);
  if (mineStop) stops.push({ id: 'mine', name: 'the Mineral Shop', ...mineStop });
  scene.add(folk.group, keepsakes.group, buildStops(stops, shadows));
  let heardTune = game.flourish().tune;
  player.setOutfit(game.outfit());
  sound.setTune(game.flourish().tune);
  book.onWear = () => {
    player.setOutfit(game.outfit());
    sound.setTune(game.flourish().tune);
    // Something of the tune that has just been put on, to hear it by.
    if (game.flourish().tune !== heardTune) sound.play('gear');
    heardTune = game.flourish().tune;
  };

  /** Lay out whatever lost property the errands in hand are looking for. */
  /** Lost property lying out just now, and where. */
  let lostNow: Keepsake[] = [];
  const layKeepsakes = (): void => {
    lostNow = game.lostItems().flatMap((item): Keepsake[] => {
      const at = standAt(item.at);
      return at ? [{ id: item.id, ...at }] : [];
    });
    keepsakes.set(lostNow);
  };
  layKeepsakes();

  /** Ride the Snow Train to a season, or home: the game opens again at the depot in that season. */
  const rideTrain = (to: Season | null): void => {
    if (!game.ride(to)) return;
    const depot = stops.find((st) => st.id === 'depot');
    // Two toots on the whistle, and off. The game opens again in the season the train has reached.
    talkSheet.close();
    sound.play('train');
    toasts.show({ kind: 'season', title: 'All aboard', detail: to ? `Next stop: ${SEASON_NAME[to].toLowerCase()}` : 'Next stop: home' });
    // Step down onto the platform, beside the coaches; or by the shuttle stop if the map has no rails.
    const platform = depotAt?.rails ? fromLocal(depotAt, 9, 5.6) : depot ? { x: depot.x, z: depot.z + 6 } : null;
    const next = withParams(location.search, { season: null, at: null, pos: platform ? `${platform.x.toFixed(1)},${platform.z.toFixed(1)}` : null, ski: null }) || location.pathname;
    window.setTimeout(() => location.assign(next), 1700);
  };

  /** What there is to remark on just now: the weather first, then the hour. */
  const moodNow = (): Mood | null => {
    if (weather.snowing > 0.3) return look.falling === 'snow' ? 'snowing' : 'raining';
    return watch === 'day' ? null : watch;
  };

  const talkTo = (standing: Standing): void => {
    const talk = game.talk(standing.person.id, today, season, moodNow(), watch);
    if (!talk) return;
    // A tune, played on the spot.
    if (talk.tune) sound.phrase(talk.tune);
    // A painting is held up as it is handed over.
    const painting = talk.events.find((e) => e.art?.startsWith('paintings/'))?.art ?? null;
    // A dog is not talked to. He is petted, and once a day it counts.
    if (standing.person.kind === 'dog' && game.pet(today)) talk.events.push({ kind: 'sighting', title: standing.person.name, detail: 'Good dog' });
    announce(talk.events);
    if (talk.events.some((e) => e.kind === 'gear')) book.refresh();
    const choices: Choice[] = [];
    const offer = talk.offer;
    if (offer) {
      choices.push({
        label: 'I\'ll do it',
        primary: true,
        onPick: () => {
          announce(game.accept(offer.id, today));
          layKeepsakes();
          // Asked for something that is already done (a lift ridden on the way here), they are told so there and then:
          // nobody is sent away to come straight back.
          if ((offer.to ?? offer.from) === standing.person.id && offer.need.kind !== 'item' && game.needMet(offer.need)) window.setTimeout(() => talkTo(standing), 350);
        },
      });
    }
    if (talk.train) {
      // The train goes to every season but the one the player is standing in.
      const home = seasonFor(new Date());
      for (const to of SEASONS) {
        if (to === season) continue;
        choices.push({ label: to === home ? `${SEASON_NAME[to]} (home)` : SEASON_NAME[to], onPick: () => rideTrain(to === home ? null : to) });
      }
      talk.lines.push(`Where to? It's ${SEASON_NAME[season].toLowerCase()} here.`);
    }
    const lines: (string | Written)[] = [...talk.lines];
    // Some boards are chalked up fresh each time they are read: from the sky as it is this
    // minute, from the passport, from what is about on the mountain at this hour.
    const chalked: Record<string, () => string> = {
      report: () => snowReport({ season, overcast: weather.overcast, falling: weather.snowing, watch, day: today, fresh: freshNow() }, world.lifts.length, game.trails.length),
      trailboard: () => trailOfTheDay(game.trails, (name) => Boolean(game.save.trails[name]?.stamped), today, look.ride === 'bike'),
      log: () => wildlifeLog(SPECIES, (id) => id in game.save.sightings, season, watch, today),
    };
    const chalk = chalked[standing.person.id];
    if (chalk) lines.splice(0, lines.length, chalk());
    // A letter is read on the spot, in the hand it was written in.
    if (talk.letter) lines.push({ written: talk.letter.text, signed: talk.letter.signed });
    // The letter from everybody: by the time it has been read, the town has its flags out.
    if (talk.letter?.id === LAST_LETTER) built.celebrate();
    const board = talk.person.kind === 'board';
    // A snowman says nothing. His side of it is on notes stuck to him, in a child's hand.
    const notes = talk.person.kind === 'snowman';
    talkSheet.open(
      // A board's name is written small ("the noticeboard"); as a title it takes a capital.
      board ? talk.person.name.charAt(0).toUpperCase() + talk.person.name.slice(1) : talk.person.name,
      talk.person.role,
      board || notes ? lines.map((line) => (typeof line === 'string' ? { written: line, ...(notes ? { signed: '- Tom' } : {}) } : line)) : lines,
      choices,
      board ? null : `${import.meta.env.BASE_URL}art/people/${talk.person.id}.webp`,
      'Goodbye',
      painting ? `${import.meta.env.BASE_URL}art/${painting}.webp` : null,
    );
    if (talk.events.some((e) => e.kind === 'gear')) player.setOutfit(game.outfit());
  };

  const rideShuttle = (from: Stop): void => {
    talkSheet.open(
      'The Gore shuttle',
      `Waiting at ${from.name}`,
      ['Hop in. Where to?'],
      stops
        .filter((st) => st.id !== from.id)
        .map((st) => ({
          label: st.name.replace(/^the /, ''),
          onPick: () => {
            player.place(st.x - 3, st.z + 3, ground);
            follow.faceToward(st.x - 3, st.z + 3, st.x - 3, st.z + 40);
            player.face(follow.yaw);
            fillScene = true;
            tracks.lift();
            toasts.show({ kind: 'item', title: 'The Gore shuttle', detail: `Dropped you at ${st.name}` });
          },
        })),
    );
  };

  if (cfg.ski) player.setMode('ski');
  // The button by the left thumb puts on whatever the season rides: skis, or the bike.
  const rideButton = document.getElementById('ski-button');
  if (rideButton) rideButton.textContent = look.ride === 'bike' ? 'Bike' : 'Skis';
  const hud = new Hud(
    cfg,
    world.places,
    teleport,
    (on) => (input.fastToggle = on),
    (on) => player.setMode(on ? 'ski' : 'walk'),
    () => ({
      pos: `${player.position.x.toFixed(1)},${player.position.z.toFixed(1)}`,
      yaw: follow.yaw.toFixed(3),
      pitch: follow.pitch.toFixed(3),
      ski: player.mode === 'ski' ? '1' : null,
      at: null,
    }),
    {
      code: () => saveToCode(game.save),
      holds: (code) => saveFromCode(code) !== null,
      restore: (code) => {
        const save = saveFromCode(code);
        if (save) {
          game.restore(save);
          // A book from elsewhere may be in another season, with other things built, worn and found: the game
          // is begun again from it, once the sheet has had a moment to say so.
          window.setTimeout(() => window.location.reload(), 900);
        }
        return Boolean(save);
      },
    },
    { enabled: () => sound.enabled, set: (on) => sound.setEnabled(on) },
    world.attribution,
  );

  let pixelRatio = 1;
  const resize = (): void => {
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    if (w === 0 || h === 0) return;
    pixelRatio = Math.min(window.devicePixelRatio || 1, cfg.dpr);
    renderer.setPixelRatio(pixelRatio);
    renderer.setSize(w, h, false);
    follow.setAspect(w / h);
  };
  new ResizeObserver(resize).observe(canvas);
  resize();
  follow.pitch = cfg.pitch ?? follow.defaultPitch;

  const resolution = (): string =>
    `${Math.round(canvas.clientWidth * pixelRatio)}x${Math.round(canvas.clientHeight * pixelRatio)} @${pixelRatio}x`;
  const bench =
    typeof cfg.bench === 'number'
      ? new BenchRun(cfg.bench, cfg.benchSeconds, follow.yaw, { backend, trees: () => trees.count, resolution })
      : null;
  // The trail a travelling step is carried down: the longest piece of it on the map.
  const benchTrail = bench?.step.travel
    ? world.trails
        .filter((t) => t.name === bench.step.travel && !t.area)
        .map((t) => buildRoute(t.pts))
        .sort((a, b) => b.length - a.length)[0]
    : undefined;
  const benchRoute = benchTrail && benchTrail.length > 50 ? benchTrail : null;
  if (cfg.bench === 'done') showBenchResults(deviceLabel());

  const stats = new FrameStats();
  let last = performance.now();
  let sinceHud = 0;
  let frames = 0;

  // --- Time of day and weather -------------------------------------------------------------
  // A named time is a fixed moment of today; otherwise the clock runs. Likewise the weather is
  // either a settled kind, or the real sky over Gore, with an invented one until that arrives
  // and whenever it cannot be had.
  const fixedTime = cfg.time === 'real' ? null : namedTime(cfg.time, new Date());
  const skyTime = (): Date => fixedTime ?? new Date();
  let realWeather: Weather | null = null;
  const refreshWeather = (): void => {
    void fetchWeather().then((w) => {
      if (w) realWeather = w;
    });
  };
  if (cfg.weather === 'real') {
    refreshWeather();
    window.setInterval(refreshWeather, 20 * 60000);
  }
  const weatherAbout = (): Weather => (cfg.weather === 'real' ? (realWeather ?? inventedWeather(skyTime())) : NAMED_WEATHER[cfg.weather]);
  /** True when cloud is lying in the valleys: a pinned fog is there at any hour, to be looked at. */
  const seaNow = (w: Weather): boolean => (cfg.weather === 'fog' ? true : cloudSea(w.low ?? 0, w.snowing, hourAtGore(skyTime())));
  /** The weather as it is where the camera is: with cloud in the valleys, grey underneath it and clear above. */
  const weatherWanted = (): Weather => {
    const w = weatherAbout();
    if (!seaNow(w)) return w;
    return camera.position.y > cloudTop + 12 ? { ...w, overcast: Math.min(w.overcast, 0.12) } : { ...w, overcast: 1 };
  };
  /** The evening a night belongs to: the small hours are still last night. */
  const nightOf = (): string => dayKey(new Date(Date.now() - 12 * 3600000));
  let weather = weatherWanted();
  let sunNow = sunPosition(skyTime());
  let viewDist = cfg.viewDist;
  /** Repaint the scene for the time and weather. Cheap enough to do several times a second. */
  const paintSky = (seconds: number): void => {
    weather = easeWeather(weather, weatherWanted(), seconds);
    sunNow = sunPosition(skyTime());
    const sunDeg = (sunNow.elevation * 180) / Math.PI;
    const palette = seasonPalette(paletteFor(sunDeg, weather), season);
    // Stars on a clear night: out once the sun is well down, and hidden by cloud.
    const starlight = Math.min(1, Math.max(0, (-sunDeg - 5) / 7)) * (1 - weather.overcast);
    atmosphere.apply(palette, sunNow, starlight);
    const starry = starlight > 0.5;
    skyShow.set(seaNow(weatherAbout()), starry && (cfg.sky === 'meteors' || (cfg.sky === 'real' && showerOn(nightOf()) !== null)), starry && (cfg.sky === 'aurora' || (cfg.sky === 'real' && auroraOn(nightOf()))), palette.skyTop);
    terrain.setTints(palette.snowTint, palette.canopyTint);
    powder.setTint(palette.snowTint, 1 - palette.lamps);
    snowField.setTint(palette.snowTint);
    speedLines.setTint(palette.snowTint, palette.track);
    // The mark the skis leave: the season's own, or a line the player has come by.
    tracks.setColour(game.flourish().track || palette.track);
    // Snow in winter, rain otherwise; leaves on a fair fall day, fireflies on a summer night.
    const air = airFor(season, palette.snowfall, sunDeg);
    snowfall.setKind(air.kind);
    snowfall.setAmount(air.amount);
    built.setLamps(palette.lamps);
    steam.setDaylight(1 - palette.lamps);
    plume.setDaylight(1 - palette.lamps);
    cabin?.setLamps(palette.lamps);
    viewDist = Math.min(cfg.viewDist, palette.fogFar);
  };
  paintSky(0);
  let sinceSky = 0;

  // The day the finds are laid out for and stamps are dated with: the player's own calendar day.
  let today = dayKey(new Date());
  book.today = () => today;
  // The stones the player has put on the cairns, as they were left.
  secretThings.setStones((id) => game.stones(id));
  // The ground the player has worn by walking it, and whoever has come along with them.
  /** New snow since yesterday, in centimetres: a number from the address, what the sky's source says, or an amount made up for the day. */
  const freshNow = (): number => cfg.powder ?? weather.fresh ?? inventedFresh(today);
  /** How deep the loose snow lay where the player is, in metres, before they went through it. Not on a road, a floor or a lift. */
  let snowDeep = 0;
  let sinceHollows = 0;
  /**
   * What is lying or standing on the ground near the player that the snow must not bury: the day's stones, whatever of the
   * field guide is about, a fox's prints, lost property, the ground the player has worn, and anybody who is standing out in it.
   */
  const hollowsNow = (): Hollow[] => {
    const px = player.position.x;
    const pz = player.position.z;
    const near = (x: number, z: number): boolean => Math.abs(x - px) < 36 && Math.abs(z - pz) < 36;
    const out: Hollow[] = [];
    for (const find of game.findsNear(px, pz, today)) if (near(find.x, find.z)) out.push({ x: find.x, z: find.z, r: 0.8 });
    for (const sighting of game.sightingsNear(px, pz, today, season, watch)) if (near(sighting.x, sighting.z)) out.push({ x: sighting.x, z: sighting.z, r: 1 });
    // A fox's prints run in a line: the snow is trodden down all along it, a narrow trail of its own.
    for (const pts of leads.values()) {
      for (let i = 0; i + 3 < pts.length; i += 2) {
        if (!near(pts[i] as number, pts[i + 1] as number)) continue;
        for (let t = 0; t < 1; t += 0.25) out.push({ x: (pts[i] as number) + ((pts[i + 2] as number) - (pts[i] as number)) * t, z: (pts[i + 1] as number) + ((pts[i + 3] as number) - (pts[i + 1] as number)) * t, r: 0.75 });
      }
    }
    for (const item of lostNow) if (near(item.x, item.z)) out.push({ x: item.x, z: item.z, r: 0.9 });
    // A cairn is small and low: the snow is kept off it, or it would be a white lump, or nothing.
    for (const site of secretPlaces) if (site.id.startsWith('cairn-') && near(site.x, site.z)) out.push({ x: site.x, z: site.z, r: 1.5 });
    for (const cell of wornCells(game.save)) if (near(cell.x, cell.z)) out.push({ x: cell.x, z: cell.z, r: 3 });
    for (const st of [...standings, ...roamers]) {
      if (!near(st.x, st.z)) continue;
      out.push({ x: st.x, z: st.z, r: 1.4 });
      if (st.prop) out.push({ x: st.prop.x, z: st.prop.z, r: st.person.prop === 'camp' ? 4.5 : 1.6 });
    }
    return out;
  };
  const velocity = new THREE.Vector3();
  const wornGround = new WornGround(season);
  wornGround.set(wornCells(game.save), (x, z) => ground.heightAt(x, z));
  const companion = new Companion(shadows);
  companion.set(game.flourish().pet);
  scene.add(wornGround.mesh, companion.group);
  let wornAt = '';
  /** Where the player stood to read whatever is on the talk sheet that nobody is saying: a plaque, a register, a room. */
  let reading: { x: number; z: number } | null = null;
  /** Do what is done at one of the mountain's secrets: add the stone, ring the bell, or read what there is to read. */
  const openSecret = (secret: Secret): void => {
    if (secret.kind === 'cairn') {
      const events = game.cairn(secret.id, today);
      if (events.length === 0) toasts.show({ kind: 'hint', title: "Today's stone is on it", detail: `${game.stones(secret.id)} of yours so far. One a day.` });
      announce(events);
      secretThings.setStones((id) => game.stones(id));
      return;
    }
    if (secret.kind === 'bell') {
      const first = !('bell' in game.save.secrets);
      sound.play('bell');
      if (game.ring(today)) toasts.show({ kind: 'secret', title: 'The summit bell', detail: first ? 'It carries all the way to town' : 'They heard that in town' });
      return;
    }
    const result = game.secret(secret.id, today, season);
    if (!result) return;
    const { found, events } = result;
    const subtitle = secret.kind === 'plaque' ? 'A brass plaque' : secret.kind === 'register' ? 'A tin box on a post' : secret.kind === 'room' ? (found.open ? 'Unlocked' : 'Locked') : 'Not on any map';
    talkSheet.open(
      secret.name,
      subtitle,
      found.pages.map((page) => (page.signed ? { written: page.text, signed: page.signed } : page.text)),
      [],
      null,
      'Close',
      found.open && secret.art ? `${import.meta.env.BASE_URL}art/${secret.art}.webp` : null,
    );
    reading = { x: player.position.x, z: player.position.z };
    announce(events);
    player.setOutfit(game.outfit());
  };
  /** Where a haunt is in the world: worked out as a secret's place is, and the same every time. */
  const hauntAt = (who: string, haunt: Haunt): { x: number; y: number; z: number; turn: number } | null => {
    const site = placeAt(secretSetting, `${who}-${haunt.id}`, haunt.where, haunt.off ?? 0, secretPlaces);
    return site ? { x: site.x, y: ground.heightAt(site.x, site.z), z: site.z, turn: site.turn } : null;
  };
  /** Something stood a step or two from a person, on the side they face. */
  const beside = (at: { x: number; z: number; turn: number }, ahead: number, across: number): { x: number; y: number; z: number; turn: number } => {
    const x = at.x + Math.sin(at.turn) * ahead + Math.cos(at.turn) * across;
    const z = at.z + Math.cos(at.turn) * ahead - Math.sin(at.turn) * across;
    return { x, y: ground.heightAt(x, z), z, turn: at.turn };
  };
  let bar = 0;
  let wasAt = { x: 0, z: 0 };
  /**
   * Stand the people who roam wherever this day and this hour find them, and Pip wherever she
   * is hiding. Nobody is moved from under the player's nose: someone near stays put until the
   * next time.
   * @param first at the start, when everyone is stood wherever they should be
   * @param newDay midnight has passed: Pip, who hides for the day, hides again
   */
  const placeRoamers = (first: boolean, newDay = false): void => {
    const px = player.position.x;
    const pz = player.position.z;
    secretThings.setNight(watch === 'night');
    for (const st of roamers) {
      if (!first && folk.about(st.person.id) && Math.hypot(st.x - px, st.z - pz) < 120) continue;
      let at: { x: number; y: number; z: number; turn: number } | null = null;
      let prop: { x: number; y: number; z: number; turn: number } | undefined;
      if (st.person.roams === 'painter') {
        // Out while there is light to paint by.
        at = watch === 'night' ? null : hauntAt('nell', painterToday(today));
        // (The easel has its stool beside it now: both are a step further off, so that she is not standing in the stool.)
        if (at) prop = beside(at, 0.2, -2.0);
      } else if (st.person.roams === 'camper') {
        at = hauntAt('ro', camperToday(today));
        if (at) {
          const fire = beside(at, 2.6, 0.4);
          // The tent stands a few steps from the fire, and the two are one piece: it is turned about the fire to
          // wherever the ground is most nearly the fire's own height, so that on a hillside the tent is neither
          // buried nor in the air.
          let turn = fire.turn;
          let least = Infinity;
          for (let k = 0; k < 24; k++) {
            const t = fire.turn + (k / 24) * Math.PI * 2;
            const tx = fire.x + CAMP_TENT.x * Math.cos(t) + CAMP_TENT.z * Math.sin(t);
            const tz = fire.z - CAMP_TENT.x * Math.sin(t) + CAMP_TENT.z * Math.cos(t);
            // (Not out onto a trail or the water, either; and as little turned from where it was as may be.)
            const off = Math.abs(ground.heightAt(tx, tz) - fire.y) + (world.openAt(tx, tz) !== 0 || world.onTrail(tx, tz) ? 5 : 0) + Math.min(k, 24 - k) * 0.004;
            if (off < least) {
              least = off;
              turn = t;
            }
          }
          prop = { ...fire, turn };
          plume.set({ x: prop.x, y: prop.y, z: prop.z });
        }
      } else if (st.person.roams === 'band' && bandAbout(game.save, today)) {
        const n = BAND.findIndex((b) => b.who === st.person.id);
        const stand = built.plots.find((plot) => plot.id === 'bandstand');
        if (stand && concertOn(game.save, today, watch)) {
          // All four on the bandstand, in a row across it, facing out.
          const spot = beside({ x: stand.x, z: stand.z, turn: stand.turn }, -0.4, (n - 1.5) * 1.15);
          at = { ...spot, y: floorAt(floors, spot.x, spot.z) ?? spot.y };
        } else at = hauntAt(st.person.id, (BAND[n] as (typeof BAND)[number]).haunt);
        if (at) prop = { ...beside(at, 0.75, 0.25), y: at.y };
      }
      folk.move(st.person.id, at ? { ...at, ...(prop ? { prop } : {}) } : null);
    }
    // Pip, when she is out hiding, is wherever today's hiding place is.
    const pip = standings.find((st) => st.person.id === 'pip');
    if (pip && (first || newDay) && game.pipHides(today, season) && (first || Math.hypot(pip.x - px, pip.z - pz) > 120)) {
      const at = hauntAt('pip', pipToday(today));
      if (at) folk.move('pip', at);
    }
  };
  /** How much of each unmarked run has been come down: tenths of it passed, since the game was opened. */
  const runTenths = new Map<string, Set<number>>();
  /** The player is somewhere: if that is on an unmarked run, note how far down it; at the bottom, with most of it behind them, it is done. */
  const runAlong = (px: number, pz: number): void => {
    if (player.mode === 'lift') return;
    for (const run of secretSetting.runs) {
      if (run.id in game.save.runs) continue;
      if (Math.abs((run.pts[0] as number) - px) > 1300 || Math.abs((run.pts[1] as number) - pz) > 1300) continue;
      const tenths = runTenths.get(run.id) ?? new Set<number>();
      runTenths.set(run.id, tenths);
      if (!downRun(run, px, pz, tenths)) continue;
      // Somebody who came down it without stopping at the ribbon has found it all the same.
      if (!(run.id in game.save.secrets)) announce(game.secret(run.id, today, season)?.events ?? []);
      announce(game.ranRun(run.id, today));
      book.refresh();
    }
  };
  showProjects();
  announce(game.arrivedIn(season, today));
  if (away === season && cfg.season === 'real') toasts.show({ kind: 'season', title: `${SEASON_NAME[season]}, by Snow Train`, detail: 'Conductor Bea at the depot will take you home' });
  /** The welcome: a few words for someone new. Settings can put it up again. */
  const openWelcome = (): void => {
    talkSheet.open('Welcome to Gore', 'A quiet mountain, in your pocket', [
      "Hi! There's no timer here, and nothing can go wrong.\nJust wander around.",
      'Rest your thumb on the lower part of the screen to walk.\nDrag higher up to look around. Pinch to pull the camera back.',
      `Tap ${look.ride === 'bike' ? 'Bike' : 'Skis'}, bottom left, and point yourself downhill.\nThe lifts will bring you back up.`,
      'Stones glint on the ground. Trails, lifts and summits stamp your passport.\nIt all goes in the Book, bottom right.',
      "This is your cabin. Every day starts here, with a flyer of things worth doing.\nIf you get turned around, the Map knows the way.",
    ], [], null, "Let's go");
    welcomed = true;
  };
  hud.onHowTo = openWelcome;
  /** True when the day's flyer is to go up as soon as nothing else is open: after the welcome, and when midnight passes. */
  let flyerWaits = false;
  /** The trail the player was last seen skiing on, by name, to notice when they come off it. */
  let skiedOn: string | null = null;
  /** True while any sheet is up over the picture. */
  const sheetOpen = (): boolean => document.querySelector('#talk-sheet:not([hidden]), #book-sheet:not([hidden]), #map-sheet:not([hidden]), #cabin-sheet:not([hidden]), #museum-sheet:not([hidden]), #menu:not([hidden]), #flyer:not([hidden])') !== null;
  /** The watch of the day, which decides what wildlife is about. */
  let watch = watchFor((sunNow.elevation * 180) / Math.PI, sunNow.azimuth < Math.PI);
  game.setMoment(season, watch);
  placeRoamers(true);
  // --- Today's flyer ---------------------------------------------------------------------------
  // Every lead there could be, with whether it is still open: a trail without its stamp, a place
  // without its postcard, someone with something for the player, and the inn's rumour.
  const leadsNow = (): { lead: Lead; open: boolean }[] => {
    const riding = look.ride === 'bike';
    const trails = game.trails.flatMap((t) => {
      const line = world.trails.find((w) => w.name === t.name && !w.area);
      return line ? [{ lead: trailLead(t, line.pts[0] as number, line.pts[1] as number, today, riding), open: !game.save.trails[t.name]?.stamped }] : [];
    });
    // A place the town has not built yet is nowhere to send anyone.
    const places = game.landmarks.filter((l) => !PROJECTS.some((p) => p.id === l.id)).map((l) => ({ lead: placeLead(l, today), open: !(l.id in game.save.landmarks) }));
    // What the town is building: what was finished overnight first, then the spot to stake
    // out, then anything built earlier that has still not been seen.
    const yesterday = dayBefore(today);
    const projects = PROJECTS.flatMap((p) => {
      const plot = built.plots.find((at) => at.id === p.id);
      const state = game.projectState(p.id, today);
      if (!plot || state === 'later') return [];
      const stands = state === 'built' ? (game.save.projects[p.id] === yesterday ? 'new' : 'standing') : 'proposed';
      // Once staked out, today's lead is done: it stays on the flyer, ticked.
      return [{ lead: projectLead(p, stands, plot.x, plot.z), open: state === 'built' ? !(p.id in game.save.landmarks) : state === 'proposed', rank: stands === 'new' ? 0 : stands === 'proposed' ? 1 : 2 }];
    })
      .sort((a, b) => a.rank - b.rank)
      .map(({ lead, open }) => ({ lead, open }));
    const people = standings.filter((st) => (st.person.kind ?? 'person') !== 'board').map((st) => ({ lead: personLead(st.person, st.x, st.z), open: game.hasBusiness(st.person.id, season) }));
    const marge = standings.find((st) => st.person.id === 'marge');
    const rumour = marge && game.rumour(today) ? [{ lead: rumourLead(marge.person.name, marge.x, marge.z, today), open: !game.rumourFound(today) }] : [];
    // With every trail stamped there is still a trail of the day, to go down again.
    const again = trails.some((t) => t.open)
      ? []
      : (() => {
          const lines = game.trails.flatMap((t) => {
            const line = world.trails.find((w) => w.name === t.name && !w.area);
            return line ? [{ t, line }] : [];
          });
          const pick = lines[dayNumber(today) % Math.max(1, lines.length)];
          return pick ? [{ lead: trailAgainLead(pick.t, pick.line.pts[0] as number, pick.line.pts[1] as number, today, riding), open: true }] : [];
        })();
    // And for a book so nearly full that little else is left to point at: a patch still to earn, a different one each day.
    const unearned = PATCHES.filter((p) => !(p.id in game.save.patches));
    const still = unearned.length > 0 ? [{ lead: patchLead(unearned[dayNumber(today) % unearned.length] as (typeof PATCHES)[number]), open: true }] : [];
    return [...projects, ...trails, ...again, ...places, ...people, ...rumour, ...still];
  };
  /**
   * Whoever a newcomer should meet first: until an errand has been done, the person nearest
   * the cabin who has something for them. After that the flyer picks for itself.
   */
  const neighbour = (): string | null => {
    if (Object.values(game.save.errands).some((e) => e.done)) return null;
    const from = home ? home.door : { x: player.position.x, z: player.position.z };
    const near = standings
      .filter((st) => (st.person.kind ?? 'person') === 'person' && game.hasBusiness(st.person.id, season))
      .sort((a, b) => Math.hypot(a.x - from.x, a.z - from.z) - Math.hypot(b.x - from.x, b.z - from.z))[0];
    return near ? `person:${near.person.id}` : null;
  };
  const flyerPage = (): FlyerPage => {
    const all = leadsNow();
    const ids = game.leadsFor(today, () => {
      const pick = trailPick(game.trails, (name) => Boolean(game.save.trails[name]?.stamped), today);
      return pickLeads(all.filter((l) => l.open).map((l) => l.lead), today, pick ? `trail:${pick.name}` : null, neighbour());
    });
    const letter = letterWaiting(game.save, game.save.letters, today);
    const inHand = game.projectInHand(today);
    const building = inHand?.state === 'building' ? inHand.project : null;
    return {
      date: flyerDate(today),
      sky: `${SEASON_NAME[season]} · ${sky({ season, overcast: weather.overcast, falling: weather.snowing, watch, day: today }).toLowerCase()}`,
      leads: ids.flatMap((id) => {
        const found = all.find((l) => l.lead.id === id);
        if (found) return [{ ...found.lead, done: !found.open }];
        // A patch that was on this morning's flyer and has been earned since is ticked.
        const earned = id.startsWith('patch:') ? PATCHES.find((p) => `patch:${p.id}` === id) : undefined;
        return earned ? [{ ...patchLead(earned), done: true }] : [];
      }),
      // One line in pencil, of whatever most wants saying today.
      note: postscript({
        lastLetter: letter?.id === LAST_LETTER,
        shower: season === seasonFor(new Date()) ? (showerOn(today)?.name ?? null) : null,
        concert: weekday(today) === 6 && bandAbout(game.save, today) && bandWhole(game.save),
        guest: game.feederGuest(today, season, watch) !== null,
        waiting: 'silas' in game.save.met ? game.museumWaiting().length : 0,
        building: building?.name ?? null,
        resting: townResting(game.save.projects, today),
        letter: letter !== null && letter !== undefined,
        pip: game.pipHides(today, season),
      }),
      flagged: game.save.flag,
      riding: look.ride === 'bike',
    };
  };
  flyer.onFlag = (lead) => {
    game.plant({ x: lead.x, z: lead.z, label: lead.flag });
    showFlag();
    pointToFlag();
  };
  // The map has a way back to the flyer, for the rest of the day.
  trailMap.onToday = () => flyer.open(flyerPage);
  const heightAt = (x: number, z: number): number => ground.heightAt(x, z);
  let sinceSlow = 0;
  /**
   * Conditions are stamped only when the game is showing the real sky. A moment pinned from
   * Settings or the address is for looking at, not for collecting.
   */
  const honestSky = cfg.season === 'real' && cfg.time === 'real' && cfg.weather === 'real';

  /** @param unlimited build everything in range at once: before the first frame and after a teleport */
  const cull = (unlimited = false): void => {
    // Haze sets how far there is anything to see, so nothing beyond it need be drawn. Trees are
    // drawn out to the smaller of that and the forest's own range; past it, terrain wears the
    // canopy texture. With trees switched off it wears snow throughout.
    const treeRange = cfg.trees > 0 ? Math.min(viewDist, TREE_RANGE) : Infinity;
    terrain.cull(camera.position.x, camera.position.z, viewDist, treeRange, unlimited);
    trees.cull(camera.position.x, camera.position.z, viewDist, unlimited);
  };

  window.__gore.state = () => ({
    backend,
    x: player.position.x,
    y: player.position.y,
    z: player.position.z,
    yaw: follow.yaw,
    pitch: follow.pitch,
    mode: player.mode,
    season,
    glide: player.glide,
    lift: player.riding?.lift.name ?? null,
    tracks: tracks.count,
    sunElevationDeg: (sunNow.elevation * 180) / Math.PI,
    weather,
    weatherSource: cfg.weather !== 'real' ? 'chosen' : realWeather ? 'real' : 'invented',
    viewDist,
    nearestTree: trees.trunkAt(player.position.x, player.position.z, 300),
    day: today,
    book: game.summary(),
    finds: game.findsNear(player.position.x, player.position.z, today).map((f) => ({ x: f.x, z: f.z, mineral: f.mineral.id })),
    toast: toasts.last,
    watch,
    away,
    // How many others are in the picture just now.
    flag: game.save.flag,
    flyer: flyer.isOpen,
    projects: built.plots.map((p) => ({ id: p.id, x: p.x, z: p.z, turn: p.turn, state: game.projectState(p.id, today) })),
    museum: { door: museumDoor, sheet: museumSheet.isOpen, ...fullness(game.save), waiting: game.museumWaiting().length },
    cabin: home ? { ...game.save.cabin, door: home.door, feederAt: home.feeder, guest: cabin?.hasGuest ?? false, sheet: cabinSheet.isOpen } : null,
    zoom: follow.zoomNow,
    crowd: crowd ? { ...crowd.shown, nearest: crowd.nearest, strollers: crowd.strollers.map((w) => ({ x: w.x, z: w.z })) } : null,
    people: standings.map((st) => ({ id: st.person.id, x: st.x, z: st.z, business: game.hasBusiness(st.person.id, season) })),
    sky: skyShow.now(),
    // How deep the loose snow is under the player, in metres, and what has been cut and thrown.
    powder: { depth: snowDeep, top: snowField.topAt(player.position.x, player.position.z), fresh: freshNow(), puffs: powder.puffs, lines: speedLines.mesh.count },
    // For the tools: where the secrets stand, who is roaming and where, and the unmarked runs from top to bottom.
    secrets: secretPlaces.map((at) => ({ id: at.id, x: at.x, z: at.z, turn: at.turn, found: at.id in game.save.secrets })),
    roamers: roamers.map((st) => ({ id: st.person.id, x: st.x, z: st.z, about: folk.about(st.person.id), waits: game.roamerWaits(st.person.id, today, season, watch) })),
    runs: secretSetting.runs.map((run) => ({ id: run.id, length: run.length, top: [run.pts[0], run.pts[1]], bottom: [run.pts.at(-2), run.pts.at(-1)], way: run.pts.filter((_, i) => Math.floor(i / 2) % 5 === 0), done: run.id in game.save.runs })),
    // The benches, and whether the player is sitting on one.
    benches: built.benches.map((b) => ({ id: b.id, x: b.x, z: b.z, turn: b.turn })),
    seated: player.seated,
    // The town's named places, each with its front: for scripts that want to go and look at one.
    town: townPlaces.map((p) => ({ id: p.id, x: p.x, z: p.z, w: p.w, d: p.d, turn: p.turn })),
    stops: stops.map((st) => ({ id: st.id, x: st.x, z: st.z })),
    errands: game.activeErrands().map((e) => e.id),
    items: [...game.save.items],
    wearing: { ...game.save.gear },
    pass: game.save.pass,
    sound: sound.enabled,
    hints: [...game.save.hints],
    sightings: game.sightingsNear(player.position.x, player.position.z, today, season, watch).map((s) => ({ x: s.x, z: s.z, species: s.species.id, kin: s.species.kin, shy: Boolean(s.species.shy) })),
    speed: player.speed,
    heading: player.travelHeading,
    slip: player.slip,
    fallLineYaw: fallLineYaw(ground, player.position.x, player.position.z),
    fps: stats.summary().fps,
    drawCalls: renderer.info.render.drawCalls,
    triangles: renderer.info.render.triangles,
    trees: trees.count,
    frames,
  });
  window.__gore.map = () => trailMap.looking;
  window.__gore.teleport = (id) => {
    if (id === 'home') return goHome();
    const place = world.places.find((p) => p.id === id);
    if (place) teleport(place);
    return Boolean(place);
  };
  window.__gore.place = (x, z) => {
    player.place(x, z, ground);
    fillScene = true;
  };
  window.__gore.census = () => {
    const counts: Record<string, number> = {};
    for (const top of scene.children) {
      let n = 0;
      top.traverseVisible((o) => {
        if ((o as THREE.Mesh).isMesh || (o as THREE.Line).isLine || (o as THREE.Points).isPoints) n++;
      });
      if (n > 0) counts[top.name || top.type] = (counts[top.name || top.type] ?? 0) + n;
    }
    return counts;
  };
  window.__gore.show = (part, on) => {
    for (const top of scene.children) if ((top.name || top.type) === part) top.visible = on;
  };
  window.__gore.face = (yaw) => {
    player.face(yaw);
    follow.yaw = yaw;
  };
  window.__gore.setView = (yaw, pitch) => {
    follow.yaw = yaw;
    follow.pitch = pitch;
  };

  await renderer.setAnimationLoop((now) => {
    const cpuStart = performance.now();
    const frameMs = now - last;
    last = now;
    const dt = Math.min(0.05, frameMs / 1000);

    input.update();
    const drag = input.consumeLook();
    follow.look(drag.dx, drag.dy);
    const pinch = input.consumePinch();
    if (pinch !== 1) {
      follow.setZoom(pinchedZoom(follow.zoomNow, pinch));
      try {
        localStorage.setItem(ZOOM_KEY, follow.zoomNow.toFixed(3));
      } catch {
        // Private browsing: the distance lasts until the game is put away.
      }
    }
    // The lifts run on their own clock, which the chairs and any rider share.
    liftClock += dt;
    liftCars.update(liftClock);
    built.update(liftClock, player.position.x, player.position.z);
    crowd?.update(liftClock, dt, player.position, busyness(watch));
    player.update(dt, input.moveX, input.moveY, follow.yaw, input.fast, ground, firmAt, bumpAt, liftClock);
    if (player.mode !== 'lift') {
      const under = ground.heightAt(player.position.x, player.position.z);
      const floor = floorAt(floors, player.position.x, player.position.z);
      // The water gets deeper going in: how much of the ground round about is water says how deep.
      const wet = season === 'winter' ? 0 : SHALLOWS.reduce((n, [dx, dz]) => n + (world.openAt(player.position.x + dx, player.position.z + dz) === OPEN_WATER ? 1 : 0), 0) / SHALLOWS.length;
      // In winter the snow lies in a layer of its own. Whoever is in it pushes it down where they are and aside
      // from there: a pair of skis cuts a trough as wide as they sweep, a pair of boots a narrower one.
      let onSnow = 0;
      if (season === 'winter') {
        if (snowField.follow(player.position.x, player.position.z, hollowsNow)) sinceHollows = 0;
        snowDeep = snowField.depthAt(player.position.x, player.position.z);
        if (floor === null) {
          const skiing = player.mode === 'ski';
          snowField.tread(player.position.x, player.position.z, skiing ? trackHalfWidth(player.speed > 2.5 ? player.slip : 0) + 0.15 : 0.2, skiing ? 0.5 : 0.3);
          onSnow = snowField.topAt(player.position.x, player.position.z);
        } else snowField.lift();
      } else snowDeep = 0;
      // They stand on what is left under them: the floor of their own trough.
      const wanted = floor !== null ? Math.max(0, floor - under) : wet > 0 ? WADE * wet : onSnow;
      footing += (wanted - footing) * Math.min(1, dt * 12);
      // Under the bandstand's roof the camera would see only roof: it comes off while the player is on its floor.
      const roofed = floor === null ? null : (built.plots.find((q) => (q.id === 'bandstand' || q.id === 'lean-to') && Math.hypot(q.x - player.position.x, q.z - player.position.z) < 4.2) ?? null);
      townProjects.openRoof(roofed?.id ?? null);
      if (Math.abs(footing) > 0.005) player.position.y = under + footing;
    } else {
      footing = 0;
      snowField.lift();
    }
    // Skis leave their marks; anything else lifts them off the snow.
    if (player.mode === 'ski' && player.speed > 1.2) {
      // Below a crawl the direction of travel is not steady enough to draw from; use the skis.
      const steady = player.speed > 2.5;
      tracks.add(
        player.position.x,
        player.position.z,
        player.skiHeading,
        steady ? player.travelHeading : player.skiHeading,
        steady ? player.slip : 0,
        ground,
      );
    } else if (player.mode !== 'ski') {
      tracks.lift();
    }
    // ...and out of loose snow they throw powder up: a wake of it at speed, a wall of it broadside.
    if (player.mode === 'ski' && snowDeep > 0.02) powder.throwUp(dt, player.position.x, player.position.y, player.position.z, player.speed, player.travelHeading, player.slip, snowDeep);
    powder.update(dt);
    // What has come to lie on the ground since the snow was last laid (the day's stones, something that has wandered up) is uncovered.
    sinceHollows += dt;
    if (season === 'winter' && sinceHollows > 1) {
      sinceHollows = 0;
      snowField.uncover(hollowsNow());
    }
    snowField.update();
    // The air going by: which way the skier is going, down the slope as well as along it, and how fast.
    if (player.mode === 'ski' && player.speed > 2) {
      const dx = -Math.sin(player.travelHeading);
      const dz = -Math.cos(player.travelHeading);
      velocity.set(dx, ground.heightAt(player.position.x + dx, player.position.z + dz) - ground.heightAt(player.position.x, player.position.z), dz).normalize().multiplyScalar(player.speed);
    } else velocity.set(0, 0, 0);
    speedLines.update(dt, camera.position, velocity);
    // At the top of a lift, set the player down on the snow a little way ahead of the last tower.
    const arrived = player.takeArrival();
    if (arrived) {
      if (player.mode === 'ski') hint('offlift', 'Top of the lift', 'Steer left or right till you point downhill. The hill does the rest.');
      const top = pointAlong(arrived, arrived.length);
      const ax = top.x - Math.sin(top.yaw) * 30;
      const az = top.z - Math.cos(top.yaw) * 30;
      const spot = world.nearestTrailSpot(ax, az, 150) ?? { x: ax, z: az };
      player.place(spot.x, spot.z, ground);
      player.face(top.yaw);
      announce(game.rode(arrived.lift.name, today));
    }

    // --- Collecting --------------------------------------------------------------------------
    // Skiing a trail fills in its stamp; standing somewhere worth a visit earns that; and a find
    // is picked up by coming close to it. None of it happens from a lift.
    const px = player.position.x;
    const pz = player.position.z;
    if (player.mode !== 'lift') {
      if (player.mode === 'ski') announce(game.skiedAt(px, pz, today));
      announce(game.travelledAt(px, pz, today));
      announce(game.reachedAt(px, pz, today, season));
      const flagged = game.save.flag?.label;
      if (flagged && game.reachedFlag(px, pz)) {
        showFlag();
        toasts.show({ kind: 'hint', title: 'You found your flag', detail: flagged });
      }
      for (const { find, event } of game.pickUp(px, pz, today)) {
        glints.pickedUp(find, (x, z) => ground.heightAt(x, z));
        announce([event]);
        hint('stone', 'Your first stone', "It's in the Book. New ones turn up every day.");
      }
    }
    glints.show(game.findsNear(px, pz, today), (x, z) => ground.heightAt(x, z));
    glints.update(dt, follow.yaw);
    // Wildlife: anything come close to is seen and goes in the field guide, then makes off. A shy
    // creature come upon at speed bolts first. From a lift everything below can be watched at ease.
    const looked = game.lookAbout(px, pz, player.mode === 'lift' ? 0 : player.speed, today, season, watch);
    // The first time something not yet in the guide is near, say what its mark means and how to see it.
    if (player.mode !== 'lift' && window.__gore.ready && !sheetOpen() && game.sightingsNear(px, pz, today, season, watch).some((s) => !(s.species.id in game.save.sightings) && Math.hypot(s.x - px, s.z - pz) < 45)) {
      hint('guide', 'Something for the field guide', 'The pale blue mark is over it. Come close, gently.');
    }
    for (const { sighting, event } of looked.seen) {
      if (sighting.species.kin === 'animal' || sighting.species.kin === 'bird' || sighting.species.id === 'rumor') critters.flee(sighting, px, pz);
      else critters.settle(sighting);
      announce([event]);
    }
    for (const sighting of looked.bolted) {
      critters.flee(sighting, px, pz);
      // Say what it was the first few times, so the player learns to go gently.
      if (!(sighting.species.id in game.save.sightings)) toasts.show({ kind: 'sighting', title: 'Something bolted', detail: 'Shy animals need a slow approach' });
    }
    critters.show(game.sightingsNear(px, pz, today, season, watch), heightAt, (id) => !(id in game.save.sightings));
    critters.update(dt, player.position, follow.yaw, heightAt);
    sinceSlow += frameMs;
    // The day's flyer goes up the moment nothing else is in the way: not a second later, under a thumb that has already moved.
    if (flyerWaits && cfg.intro && cfg.hud && !bench && cfg.bench === null && !sheetOpen() && player.mode !== 'lift') {
      flyerWaits = false;
      if (game.flyerDue(today)) flyer.open(flyerPage);
    }
    if (sinceSlow >= 1000) {
      sinceSlow = 0;
      const now = dayKey(new Date());
      if (now !== today) {
        // Midnight has passed with the game open: what was staked out yesterday is built, and
        // there is a new flyer to put up when nothing else is in the way.
        today = now;
        showProjects();
        placeRoamers(false, true);
        flyerWaits = true;
      }
      const before = watch;
      watch = watchFor((sunNow.elevation * 180) / Math.PI, sunNow.azimuth < Math.PI);
      game.setMoment(season, watch);
      // The hour has turned: the painter packs up at night, the band gathers at dusk, the lantern is lit.
      if (watch !== before) placeRoamers(false);
      // On a Saturday night with the band on the bandstand, there is music for anyone near enough to hear it.
      const stand = built.plots.find((plot) => plot.id === 'bandstand');
      if (stand && concertOn(game.save, today, watch) && Math.hypot(stand.x - px, stand.z - pz) < 90) sound.phrase((BAND[bar++ % BAND.length] as (typeof BAND)[number]).tune.replace(/^tune-/, ''), bar);
      // What is in the sky only now and then is kept, under the real sky, by whoever is out under it.
      const crossed = skyShow.takeCrossed();
      if (honestSky && player.mode !== 'lift') {
        const w = weatherAbout();
        if (cloudSea(w.low ?? 0, w.snowing, hourAtGore(new Date())) && player.position.y > cloudTop + CLOUD_CLEAR) announce(game.saw('sky-cloud', today));
        const starry = sunNow.elevation < -0.2 && weather.overcast < 0.3;
        if (starry && auroraOn(nightOf())) announce(game.saw('sky-aurora', today));
        if (starry && crossed > 0 && showerOn(nightOf())) announce(game.saw('sky-meteors', today, crossed));
      }
      // Sitting on a bench with a view, under the real sky, earns the stamps that are for sitting.
      if (honestSky && player.seated && sittingOn?.view) {
        announce(game.skiedIn(benchConditionsNow((sunNow.elevation * 180) / Math.PI, sunNow.azimuth < Math.PI, weather), today));
      }
      if (honestSky && player.mode === 'ski' && player.speed > 3) {
        announce(game.skiedIn(conditionsNow((sunNow.elevation * 180) / Math.PI, sunNow.azimuth < Math.PI, weather, season), today));
      }
      layKeepsakes();
      // The church in town strikes the hour, by the real clock at Gore, for anyone near enough to hear.
      if (cfg.time === 'real') {
        const hour = hourAtGore(new Date());
        if (struck !== null && hour !== struck && church && Math.hypot(px - church.x, pz - church.z) < 600) sound.play('toll', String(hour % 12 || 12));
        struck = hour;
      }
      announce(game.checkPatches(today));
      game.persist();
    }
    // A pole going into the snow: a small dry tick.
    const tick = player.takeTick();
    if (tick) sound.play('pole', tick);
    // The sound of where the player is and what they are doing.
    sound.update(
      dt,
      {
        mode: player.mode,
        glide: player.glide,
        speed: player.speed,
        slip: player.slip,
        height: Math.min(1, Math.max(0, player.position.y / 990)),
        falling: weather.snowing,
        rain: look.falling === 'rain',
      },
      sunNow.elevation < -0.1,
      season === 'summer' && sunNow.elevation < -0.02,
    );
    if (player.mode === 'ski') hint(look.ride === 'bike' ? 'bike' : 'skis', look.ride === 'bike' ? 'On the bike' : 'On skis', look.ride === 'bike' ? 'Left and right steer. Thumb up pedals, thumb down brakes.' : 'Left and right steer. Thumb up tucks, thumb down stops.');
    // People turn to watch the player come; lost property waits to be picked up.
    folk.update(dt, player.position, (id) => (roamers.some((r) => r.person.id === id) ? game.roamerWaits(id, today, season, watch) : game.hasBusiness(id, season)), follow.yaw);
    // The secrets that are shy: a lantern that goes out, a nest that empties, for anyone in a hurry.
    // (Set down somewhere by a lift, the shuttle or a tool, the player has not come in a hurry.)
    const carried = player.mode === 'lift' || Math.hypot(px - wasAt.x, pz - wasAt.z) > 12;
    wasAt = { x: px, z: pz };
    const startled = secretThings.about(px, pz, carried ? 0 : player.speed, liftClock);
    if (startled) toasts.show({ kind: 'hint', title: startled.kind === 'light' ? 'A light went out' : 'Something slipped into the reeds', detail: 'Whatever it was, it wants a slow approach' });
    // (The camera looks along -z at yaw 0, and turns left as yaw grows: in front of it is the way it faces, as x and z.)
    skyShow.update(dt, camera.position, liftClock, Math.atan2(-Math.sin(follow.yaw), -Math.cos(follow.yaw)));
    // Whoever is along keeps up on foot and is carried otherwise.
    companion.set(game.flourish().pet);
    companion.update(dt, liftClock, { x: px, y: player.position.y, z: pz, heading: player.skiHeading, speed: player.speed }, player.mode !== 'walk', !player.object.visible, (x, z) => floorAt(floors, x, z) ?? ground.heightAt(x, z) + snowField.topAt(x, z));
    // Open ground, walked over, wears: a square crossed a few times shows, and enough of them are a path.
    if (player.mode === 'walk' && !player.seated && !carried) {
      const key = wornKey(px, pz);
      if (key !== wornAt) {
        wornAt = key;
        if (world.openAt(px, pz) === 0 && world.trailDistance(px, pz) > 5 && !built.near(px, pz) && floorAt(floors, px, pz) === null) {
          const stepped = game.trod(key);
          if (stepped.shows) wornGround.set(wornCells(game.save), (x, z) => ground.heightAt(x, z));
          announce(stepped.events);
        }
      }
    }
    steam.update(liftClock, px, pz);
    plume.update(liftClock);
    runAlong(px, pz);
    keepsakes.update(dt, follow.yaw);
    if (player.mode !== 'lift') {
      const found = keepsakes.near(px, pz, COLLECT_REACH);
      if (found) {
        announce(game.takeItem(found.id));
        layKeepsakes();
      }
    }
    // Wandering off ends a conversation. The welcome stays until it is read or closed.
    if (welcomed && !talkSheet.isOpen) {
      welcomed = false;
      // The welcome has been read: now the day's flyer, as on any other day.
      flyerWaits = true;
    }
    // Nothing is announced under the loading card, the welcome or the flyer: it waits its turn.
    toasts.hold(!window.__gore.ready || welcomed || flyerWaits || flyer.isOpen);
    const someone = player.mode === 'lift' ? null : folk.nearest(px, pz, 7);
    const stop = player.mode === 'lift' || someone ? null : (stops.find((st) => Math.hypot(st.x - px, st.z - pz) < 9) ?? null);
    // A sheet is put away when whoever or whatever it was about has been walked away from.
    if (reading && (!talkSheet.isOpen || Math.hypot(reading.x - px, reading.z - pz) > 12)) reading = null;
    if (talkSheet.isOpen && !someone && !stop && !welcomed && !reading) talkSheet.close();
    // Offer a ride when standing at the foot of a lift.
    const station = player.mode === 'lift' ? null : stationNear(liftPaths, player.position.x, player.position.z);
    // ...and a seat when standing by a bench.
    const seat = station || player.mode !== 'walk' ? null : (built.benches.find((b) => Math.hypot(b.x - px, b.z - pz) < 2.2) ?? null);
    // ...and, on the spot the town wants to build on, the chance to stake it out.
    const wanted = player.mode === 'lift' ? null : game.projectInHand(today);
    const secretHere = secretThings.near(px, pz);
    const staking = wanted?.state === 'proposed' ? (built.plots.find((p) => p.id === wanted.project.id && Math.hypot(p.x - px, p.z - pz) < 9) ?? null) : null;
    if (staking) hint('project', 'This is the spot', 'Tap Stake it out, and the crew builds it overnight.');
    if (station) {
      hud.setAction(`Ride ${station.lift.name ?? 'the lift'}`, () => {
        pitchAfterRide = follow.pitch;
        player.board(station, liftClock);
      });
    } else if (player.seated) {
      hud.setAction('Stand up', () => player.stand());
    } else if (seat) {
      hud.setAction('Sit', () => {
        // On the seat, a little out from the back, facing the way the bench does.
        const at = fromLocal(seat, 0, 0.28);
        player.sit(at.x, at.z, seat.turn + Math.PI, ground);
        // At a lookout the camera sits behind, to share the view. Against a wall it comes round in
        // front, since behind is the inside of a building.
        follow.yaw = seat.view ? seat.turn + Math.PI : seat.turn;
        sittingOn = seat;
        announce(game.sat(seat.id, today));
      });
    } else if (staking) {
      hud.setAction('Stake it out', () => {
        announce(game.stakeOut(staking.id, today));
        showProjects();
      });
    } else if (home && player.mode === 'walk' && Math.hypot(home.door.x - px, home.door.z - pz) < 3.6) {
      hud.setAction('Home', openCabin);
    } else if (museumDoor && player.mode === 'walk' && Math.hypot(museumDoor.x - px, museumDoor.z - pz) < 4.2) {
      hud.setAction('Museum', openMuseum);
      hint('museum', 'The museum', "Tap Museum to see the cases. Show Silas what you've found - you keep all of it.");
    } else if (secretHere && player.mode !== 'lift') {
      // One of the mountain's secrets: something to read, to look into, to add to, to ring.
      const { secret } = secretHere;
      hud.setAction(secret.kind === 'room' && secret.id in game.save.secrets ? 'Go in' : secret.action, () => openSecret(secret));
    } else hud.setAction(null);
    if (cabinSheet.isOpen && home && Math.hypot(home.door.x - px, home.door.z - pz) > 9) cabinSheet.close();
    if (museumSheet.isOpen && museumDoor && Math.hypot(museumDoor.x - px, museumDoor.z - pz) > 10) museumSheet.close();
    // Whoever is at the feeder is there to be seen from the trail; coming home is what puts them in the guide.
    if (cabin && home) {
      const guest = game.feederGuest(today, season, watch);
      const away = Math.hypot(home.feeder.x - px, home.feeder.z - pz);
      if (guest && !cabin.hasGuest) cabin.setGuest(critterGeometry(guest, season));
      // Close enough to be standing at the feeder: the yard the day begins in is further off than this.
      if (guest && away < 4.5 && player.mode !== 'lift') {
        announce(game.metGuest(today, season, watch));
        guestStays = true;
      }
      if (guestStays && away > 70) guestStays = false;
      if (!guest && !guestStays && cabin.hasGuest) cabin.setGuest(null);
      if (away < 30) hint('home', 'Your cabin', 'Tap Home at the door to set out what you find.');
    }
    if (station) hint('lift', 'A lift', 'Tap Ride at the orange gate to go up.');
    if (seat && !player.seated) hint('bench', 'A bench', "Tap Sit. There's no hurry.");
    if (someone) hint('talk', 'Someone to talk to', 'A gold mark means they have something for you.');
    if (stop && !someone) hint('shuttle', 'The shuttle', 'It runs between the mountain, the Ski Bowl, town and the old garnet mine.');
    if (townHeart && Math.hypot(player.position.x - townHeart.x, player.position.z - townHeart.z) < 240) {
      hint('town', 'North Creek', 'Something new every day: a letter, a bake, a sandwich, a book.');
    }
    if (someone) hud.setTalk(`${APPROACH[someone.person.kind ?? 'person']} ${someone.person.name}`, () => talkTo(someone));
    else if (stop) hud.setTalk('Take the shuttle', () => rideShuttle(stop));
    else hud.setTalk(null);
    // Sit still for a little while by day and a bird comes to the bench. It is gone on standing.
    if (player.seated && sittingOn) {
      // By the clock on the wall, not the game's steps: a slow frame is still time spent sitting.
      satFor += Math.min(1, frameMs / 1000);
      if (satFor > STILLNESS && !visitor.visible) {
        const bird = benchVisitor(sittingOn.id, season, watch);
        if (bird) {
          visitor.geometry = critterGeometry(bird.id, season);
          // On the end of the bench's back, turned toward whoever is sitting there.
          const perch = fromLocal(sittingOn, 0.62, -0.14);
          visitor.position.set(perch.x, ground.heightAt(sittingOn.x, sittingOn.z) + 1.02, perch.z);
          visitor.rotation.y = sittingOn.turn + Math.PI / 2;
          // The field guide's models are made large, to be seen across a slope. On a bench, a bird is bird-sized.
          visitor.scale.setScalar(0.38);
          visitor.visible = true;
          announce(game.visitedBy(bird.id, today));
        }
      }
    } else if (satFor > 0) {
      satFor = 0;
      visitor.visible = false;
    }
    // On a lift the camera levels out to take in the mountain ahead, then goes back to how the
    // player had it.
    if (player.mode === 'lift') follow.settlePitch(LIFT_PITCH, dt);
    else if (pitchAfterRide !== null && follow.settlePitch(pitchAfterRide, dt)) pitchAfterRide = null;
    // On foot the camera follows as hard as the stick is pushed. On skis it follows with speed,
    // and more firmly, because the skier's heading is the only thing steering the view. It also
    // follows a turn made at a standstill, so the player can see where the skis now point.
    const followAmount =
      player.mode === 'lift'
        ? 1.5
        : player.mode === 'ski'
          ? Math.max(Math.min(1, player.speed / 3), Math.abs(input.moveX)) * 2.5
          : Math.min(1, Math.hypot(input.moveX, input.moveY));
    follow.follow(player.travelHeading, followAmount, dt, player.mode !== 'walk');
    if (bench && benchRoute) {
      // A step that travels: carried down the trail, looking the way it goes.
      const d = bench.travelled(now) % benchRoute.length;
      const at = routePoint(benchRoute, d);
      const ahead = routePoint(benchRoute, d + 8);
      player.place(at.x, at.z, ground);
      const yaw = Math.atan2(-(ahead.x - at.x), -(ahead.z - at.z));
      player.face(yaw);
      follow.yaw = yaw;
    } else if (bench) follow.yaw = bench.yawAt(now);
    follow.update(player.position, ground, player.speed, dt, (x, z) => walls.roofAt(x, z));
    // The beam over a lift's gate is just where the camera sits: it rises over one as it comes to it.
    camera.position.y += overBeam(beams, camera.position.x, camera.position.y, camera.position.z);
    trees.update(player.position, camera.position, dt);
    sinceSky += frameMs;
    if (sinceSky >= 100) {
      paintSky(sinceSky / 1000);
      sinceSky = 0;
    }
    atmosphere.follow(camera.position);
    snowfall.update(camera.position, dt);
    sun.target.position.copy(player.position);
    sun.position.copy(player.position).addScaledVector(atmosphere.lightDirection, 150);
    cull(fillScene);
    fillScene = false;

    renderer.render(scene, camera);
    frames++;
    const cpuMs = performance.now() - cpuStart;
    // The first frames include shader compilation and would swamp the readout.
    if (frames > 10) stats.push(frameMs, cpuMs);
    bench?.frame(now, frameMs, cpuMs, renderer.info.render.drawCalls, renderer.info.render.triangles);

    sinceHud += frameMs;
    // During a benchmark the readout stays still, so that it cannot disturb what is being measured.
    if (sinceHud >= 250 && (!bench || bench.hudLive)) {
      sinceHud = 0;
      hud.setStats({
        frame: stats.summary(),
        drawCalls: renderer.info.render.drawCalls,
        triangles: renderer.info.render.triangles,
        backend,
        pixelRatio,
        width: Math.round(canvas.clientWidth * pixelRatio),
        height: Math.round(canvas.clientHeight * pixelRatio),
        trees: trees.count,
      });
      pointToFlag();
      const trailNow = trailAt(world.trails, player.position.x, player.position.z);
      // Coming off a trail that is mostly skied and not stamped, the player is told what is left of it.
      const skiing = player.mode === 'ski' ? (trailNow?.name ?? null) : null;
      if (skiedOn && skiing !== skiedOn) announce(game.leftTrail(skiedOn, today));
      skiedOn = skiing;
      hud.setWhere(
        trailNow,
        world.realElevationM(player.position.y) * M_TO_FT,
        player.mode === 'ski' ? player.speed * MS_TO_MPH : null,
        player.riding ? (player.riding.lift.name ?? 'Lift') : null,
      );
    }
    if (frames === 3) {
      document.getElementById('loading')?.remove();
      window.__gore.ready = true;
      // A few words of welcome, the first time the game is opened.
      if (cfg.intro && cfg.hud && !bench && cfg.bench === null && game.hint('welcome')) {
        openWelcome();
        // Someone new has just been told everything. The news is for those who were here before.
        game.hint(NEWS);
      } else if (cfg.intro && cfg.hud && !bench && cfg.bench === null && game.hint(NEWS)) {
        // Once, for someone coming back to a mountain that has changed since they last opened it.
        talkSheet.open('Since you were last here', 'News from the mountain', [
          "The mountain's been printed! Flat colors, a line around everything.\nSame mountain. It just dressed up.",
          "There's a flyer every morning now, with three things worth going out for.\nPut your flag on one. Or don't! It's only a flyer.",
          "You've got a cabin, in the woods by Cedars Traverse. The day starts there.\nPut your best stones on the shelf, and fill the feeder.",
          "The town wants to build a few things. It needs somebody to stake out the spots.\nAnd the map zooms now - pinch the picture, too, to pull the camera back.",
        ], [], null, "Let's go");
        welcomed = true;
      } else if (cfg.flyer || (cfg.intro && cfg.hud && !bench && cfg.bench === null && game.flyerDue(today))) {
        // The first time the game is opened on a day, the day's flyer is put up.
        flyer.open(flyerPage);
      }
    }
  });
}

boot().catch((err: unknown) => showFatal(String((err as Error)?.stack ?? err)));

// Keep a copy of the game for when there is no signal. Only where it is really installed: a
// development server or a test would only be confused by an older copy.
if ('serviceWorker' in navigator && location.protocol === 'https:') {
  window.addEventListener('load', () => {
    void navigator.serviceWorker
      .register(`${import.meta.env.BASE_URL}sw.js`)
      .then(() => navigator.serviceWorker.ready)
      // Once the game has had a while to itself, have the rest of it kept too: the other
      // seasons' ground and every picture, so a new season or patch can turn up with no signal.
      .then((worker) => window.setTimeout(() => worker.active?.postMessage('keep-all'), 20000))
      .catch(() => undefined);
  });
}
