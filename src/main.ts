import * as THREE from 'three/webgpu';
import { Sound } from './audio/sound';
import { parseConfig, withParams } from './config';
import { BenchRun, showBenchResults } from './debug/bench';
import { deviceLabel, Hud } from './debug/hud';
import { Atmosphere } from './look/atmosphere';
import { paletteFor, type Weather } from './look/palette';
import { airFor, SEASON_LOOK, SEASON_NAME, seasonFor, seasonPalette, SEASONS, treeLook, type Season } from './look/season';
import { namedTime, sunPosition } from './look/sun';
import { easeWeather, fetchWeather, inventedWeather, NAMED_WEATHER } from './look/weather';
import { FrameStats } from './debug/perf';
import { COLLECT_REACH, Game, type GameEvent } from './game/game';
import { conditionsNow } from './game/passport';
import { PEOPLE } from './game/people';
import { dayKey, parseSave, saveFromCode, saveToCode } from './game/save';
import { watchFor } from './game/wildlife';
import { Input } from './input/input';
import { Book } from './ui/book';
import { TalkSheet, type Choice } from './ui/talk';
import { Toasts } from './ui/toasts';
import { TrailMap } from './ui/trailMap';
import { FollowCamera } from './player/followCamera';
import { Player } from './player/player';
import { pushOut } from './player/collide';
import { BIKE, fallLineYaw, SKI, SPRING_SKI } from './player/skiPhysics';
import { buildLiftPath, inLiftClearing, pointAlong, stationNear } from './world/lifts';
import { Buildings, PLACE_FOOTPRINT, PLACE_HEIGHT } from './world/buildings';
import { countryOf } from './world/country';
import { Critters } from './world/critters';
import { buildStops, Folk, Keepsakes, type Keepsake, type Standing, type Stop } from './world/folk';
import { LiftCars } from './world/liftCars';
import { Glints } from './world/glints';
import { buildLifts } from './world/scenery';
import { Snowfall } from './world/snowfall';
import { Terrain } from './world/terrainMesh';
import { houseHeight, Town } from './world/town';
import { SkiTracks } from './world/tracks';
import { trailAt, type Place } from './world/trails';
import { Forest, TREE_RANGE } from './world/trees';
import { Walls, type WallBox } from './world/walls';
import { locate } from './world/whereabouts';
import { loadWorld, OPEN_LAND } from './world/world';

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
};

function showFatal(message: string): void {
  window.__gore.error = message;
  let el = document.getElementById('fatal');
  if (!el) {
    el = document.createElement('div');
    el.id = 'fatal';
    (document.getElementById('app') ?? document.body).appendChild(el);
  }
  el.textContent = `Something went wrong.\n\n${message}`;
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
  }
  scene.add(sun, sun.target);

  const loader = new THREE.TextureLoader();
  const [snowTexture, canopyTexture] = await Promise.all([
    loader.loadAsync(`${import.meta.env.BASE_URL}world/ground-${season}.png`),
    loader.loadAsync(`${import.meta.env.BASE_URL}world/canopy-${season}.png`),
  ]);
  const terrain = new Terrain(ground, snowTexture, canopyTexture);
  const liftPaths = world.lifts.map((lift) => buildLiftPath(lift, (x, z) => ground.heightAt(x, z)));
  // Trees keep out of lift corridors and stand back from buildings.
  const nearBuilding = (x: number, z: number): boolean =>
    world.places.some((p) => Math.hypot(p.x - x, p.z - z) < (p.id === 'base-lodge' ? 46 : 30));
  // ...and off roads, paths, lots and water. Out of winter each tree is dressed for the season:
  // hardwoods low on the mountain, spruce and fir higher up.
  const trees = new Forest(
    ground,
    world,
    cfg.trees,
    shadows,
    (x, z) => world.openAt(x, z) !== 0 || inLiftClearing(liftPaths, x, z) || nearBuilding(x, z),
    look.conifers ? (x, z, kindRoll, pickRoll) => treeLook(season, world.hardwoodAt(x, z), kindRoll, pickRoll) : null,
  );
  const buildings = new Buildings(world.places, shadows, look.roof);
  const town = new Town(world.buildings, shadows, look.roof);
  const liftCars = new LiftCars(liftPaths, shadows);
  scene.add(terrain.group, trees.group, buildLifts(liftPaths), liftCars.group, buildings.group, town.group);
  // Buildings are solid: the lodges and huts by their models' footprints, the town by its plots.
  const walls = new Walls([
    ...world.places.flatMap((p): WallBox[] => {
      const size = PLACE_FOOTPRINT[p.id];
      return size ? [{ x: p.x, z: p.z, w: size[0], d: size[1], turn: 0, top: p.y + (PLACE_HEIGHT[p.id] ?? 8) }] : [];
    }),
    ...world.buildings.map((b): WallBox => ({ x: b.x, z: b.z, w: b.w, d: b.d, turn: b.turn, top: b.y + houseHeight(b) })),
  ]);
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
  scene.add(player.object, tracks.mesh, glints.group, critters.group);

  // The collecting game.
  const game = new Game(
    {
      trails: world.trails,
      lifts: world.lifts,
      places: world.places,
      paths: world.paths,
      openAt: (x, z) => world.openAt(x, z),
      country: countryOf(world),
      spots: [...world.spots, ...world.ponds],
      minX: world.source.minX,
      minZ: world.source.minZ,
      trailDistance: (x, z) => world.trailDistance(x, z),
      slopeDegAt: (x, z) => world.source.slopeDegAt(x, z),
      mineDistance: (x, z) => Math.min(...world.spots.filter((sp) => sp.kind === 'quarry').map((sp) => Math.hypot(sp.x - x, sp.z - z))),
    },
    store,
  );
  const toasts = new Toasts(cfg.hud);
  const book = new Book(game);
  // Sound starts with the first touch, which is when a browser will let it.
  const sound = new Sound();
  // Safari counts the end of a touch, not its start, as the player's say-so; listen for both.
  for (const gesture of ['pointerdown', 'pointerup', 'touchend', 'click', 'keydown']) window.addEventListener(gesture, () => sound.unlock(), { passive: true });
  const announce = (events: readonly GameEvent[]): void => {
    if (events.length === 0) return;
    for (const event of events) toasts.show(event);
    // One tune for a batch, the grandest of them, so several stamps at once do not clash.
    const order = ['patch', 'peak', 'season', 'gear', 'mineral', 'trail', 'path', 'lift', 'landmark', 'condition', 'errand', 'sighting', 'item'];
    const lead = [...events].sort((a, b) => order.indexOf(a.kind) - order.indexOf(b.kind))[0] as GameEvent;
    sound.play(lead.kind, lead.detail);
    book.refresh();
  };
  /** Say something helpful, the first time it is needed and never again. */
  const hint = (id: string, title: string, detail: string): void => {
    if (cfg.intro && game.hint(id)) toasts.show({ kind: 'hint', title, detail });
  };
  // Keep the book safe when the game is put away.
  window.addEventListener('pagehide', () => game.persist());
  document.addEventListener('visibilitychange', () => game.persist());
  const camera = new THREE.PerspectiveCamera(55, 1, 0.3, 16000); // lens is set by follow.setAspect()
  const follow = new FollowCamera(camera, cfg.zoom);
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
  if (cfg.pos) player.place(cfg.pos.x, cfg.pos.z, ground);
  if (cfg.yaw !== null) {
    follow.yaw = cfg.yaw;
    player.face(cfg.yaw);
  }

  const trailMap = new TrailMap(world, liftPaths, canopyTexture.image as CanvasImageSource, () => ({
    x: player.position.x,
    z: player.position.z,
    yaw: player.travelHeading,
  }));
  // One sheet at a time.
  const talkSheet = new TalkSheet();
  trailMap.onOpen = () => {
    book.close();
    talkSheet.close();
  };
  book.onOpen = () => {
    trailMap.close();
    talkSheet.close();
  };
  talkSheet.onOpen = () => {
    trailMap.close();
    book.close();
  };

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
  const standings = PEOPLE.flatMap((person): Standing[] => {
    const at = standAt(person.at);
    return at ? [{ person, ...at }] : [];
  });
  const folk = new Folk(standings, shadows);
  const keepsakes = new Keepsakes();
  // The shuttle runs between the mountain, the Ski Bowl and town.
  const stops: Stop[] = [
    ['base-lodge', 'the Base Lodge'],
    ['ski-bowl-lodge', 'the Ski Bowl'],
    ['depot', 'North Creek'],
  ].flatMap(([id, name]): Stop[] => {
    const at = standAt({ place: id as string }, 13, 7);
    return at ? [{ id: id as string, name: name as string, ...at }] : [];
  });
  scene.add(folk.group, keepsakes.group, buildStops(stops, shadows));
  player.setOutfit(game.outfit());
  book.onWear = () => player.setOutfit(game.outfit());

  /** Lay out whatever lost property the errands in hand are looking for. */
  const layKeepsakes = (): void => {
    keepsakes.set(
      game.lostItems().flatMap((item): Keepsake[] => {
        const at = standAt(item.at);
        return at ? [{ id: item.id, ...at }] : [];
      }),
    );
  };
  layKeepsakes();

  /** Ride the Snow Train to a season, or home: the game opens again at the depot in that season. */
  const rideTrain = (to: Season | null): void => {
    if (!game.ride(to)) return;
    const depot = stops.find((st) => st.id === 'depot');
    location.assign(withParams(location.search, { season: null, at: null, pos: depot ? `${depot.x.toFixed(1)},${(depot.z + 6).toFixed(1)}` : null, ski: null }) || location.pathname);
  };

  const talkTo = (standing: Standing): void => {
    const talk = game.talk(standing.person.id, today, season);
    if (!talk) return;
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
      talk.lines.push(`Where to? It is ${SEASON_NAME[season].toLowerCase()} here.`);
    }
    talkSheet.open(talk.person.name, talk.person.role, talk.lines, choices);
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
          player.setOutfit(game.outfit());
          layKeepsakes();
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
  const weatherWanted = (): Weather => (cfg.weather === 'real' ? (realWeather ?? inventedWeather(skyTime())) : NAMED_WEATHER[cfg.weather]);
  let weather = weatherWanted();
  let sunNow = sunPosition(skyTime());
  let viewDist = cfg.viewDist;
  /** Repaint the scene for the time and weather. Cheap enough to do several times a second. */
  const paintSky = (seconds: number): void => {
    weather = easeWeather(weather, weatherWanted(), seconds);
    sunNow = sunPosition(skyTime());
    const sunDeg = (sunNow.elevation * 180) / Math.PI;
    const palette = seasonPalette(paletteFor(sunDeg, weather), season);
    atmosphere.apply(palette, sunNow);
    terrain.setTints(palette.snowTint, palette.canopyTint);
    tracks.setColour(palette.track);
    // Snow in winter, rain otherwise; leaves on a fair fall day, fireflies on a summer night.
    const air = airFor(season, palette.snowfall, sunDeg);
    snowfall.setKind(air.kind);
    snowfall.setAmount(air.amount);
    buildings.setLamps(palette.lamps);
    town.setLamps(palette.lamps);
    viewDist = Math.min(cfg.viewDist, palette.fogFar);
  };
  paintSky(0);
  let sinceSky = 0;

  // The day the finds are laid out for and stamps are dated with: the player's own calendar day.
  let today = dayKey(new Date());
  announce(game.arrivedIn(season, today));
  if (away === season && cfg.season === 'real') toasts.show({ kind: 'season', title: `${SEASON_NAME[season]}, by Snow Train`, detail: 'Conductor Bea at the depot will take you home' });
  /** The watch of the day, which decides what wildlife is about. */
  let watch = watchFor((sunNow.elevation * 180) / Math.PI, sunNow.azimuth < Math.PI);
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
    people: standings.map((st) => ({ id: st.person.id, x: st.x, z: st.z, business: game.hasBusiness(st.person.id, season) })),
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
  window.__gore.teleport = (id) => {
    const place = world.places.find((p) => p.id === id);
    if (place) teleport(place);
    return Boolean(place);
  };
  window.__gore.place = (x, z) => {
    player.place(x, z, ground);
    fillScene = true;
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
    // The lifts run on their own clock, which the chairs and any rider share.
    liftClock += dt;
    liftCars.update(liftClock);
    player.update(dt, input.moveX, input.moveY, follow.yaw, input.fast, ground, firmAt, bumpAt, liftClock);
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
    // At the top of a lift, set the player down on the snow a little way ahead of the last tower.
    const arrived = player.takeArrival();
    if (arrived) {
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
      for (const { find, event } of game.pickUp(px, pz, today)) {
        glints.pickedUp(find, (x, z) => ground.heightAt(x, z));
        announce([event]);
        hint('stone', 'Your first stone', 'It is in the Book. A new scatter lies out every day.');
      }
    }
    glints.show(game.findsNear(px, pz, today), (x, z) => ground.heightAt(x, z));
    glints.update(dt, follow.yaw);
    // Wildlife: anything come close to is seen and goes in the field guide, then makes off. A shy
    // creature come upon at speed bolts first. From a lift everything below can be watched at ease.
    const looked = game.lookAbout(px, pz, player.mode === 'lift' ? 0 : player.speed, today, season, watch);
    if (looked.seen.length > 0) hint('guide', 'In the field guide', 'A pale blue mark shows anything you have not seen before.');
    for (const { sighting, event } of looked.seen) {
      if (sighting.species.kin === 'animal' || sighting.species.kin === 'bird' || sighting.species.id === 'rumor') critters.flee(sighting, px, pz);
      else critters.settle(sighting);
      announce([event]);
    }
    for (const sighting of looked.bolted) {
      critters.flee(sighting, px, pz);
      // Say what it was the first few times, so the player learns to go gently.
      if (!(sighting.species.id in game.save.sightings)) toasts.show({ kind: 'sighting', title: 'Something bolted', detail: 'Shy creatures need a gentle approach' });
    }
    critters.show(game.sightingsNear(px, pz, today, season, watch), heightAt, (id) => !(id in game.save.sightings));
    critters.update(dt, player.position, follow.yaw, heightAt);
    sinceSlow += frameMs;
    if (sinceSlow >= 1000) {
      sinceSlow = 0;
      today = dayKey(new Date());
      watch = watchFor((sunNow.elevation * 180) / Math.PI, sunNow.azimuth < Math.PI);
      if (honestSky && player.mode === 'ski' && player.speed > 3) {
        announce(game.skiedIn(conditionsNow((sunNow.elevation * 180) / Math.PI, sunNow.azimuth < Math.PI, weather, season), today));
      }
      layKeepsakes();
      announce(game.checkPatches(today));
      game.persist();
    }
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
    folk.update(dt, player.position, (id) => game.hasBusiness(id, season), follow.yaw);
    keepsakes.update(dt, follow.yaw);
    if (player.mode !== 'lift') {
      const found = keepsakes.near(px, pz, COLLECT_REACH);
      if (found) {
        announce(game.takeItem(found.id));
        layKeepsakes();
      }
    }
    // Wandering off ends a conversation. The welcome stays until it is read or closed.
    if (welcomed && !talkSheet.isOpen) welcomed = false;
    const someone = player.mode === 'lift' ? null : folk.nearest(px, pz, 7);
    const stop = player.mode === 'lift' || someone ? null : (stops.find((st) => Math.hypot(st.x - px, st.z - pz) < 9) ?? null);
    if (talkSheet.isOpen && !someone && !stop && !welcomed) talkSheet.close();
    // Offer a ride when standing at the foot of a lift.
    const station = player.mode === 'lift' ? null : stationNear(liftPaths, player.position.x, player.position.z);
    if (station) {
      hud.setAction(`Ride ${station.lift.name ?? 'the lift'}`, () => {
        pitchAfterRide = follow.pitch;
        player.board(station, liftClock);
      });
    }
    else hud.setAction(null);
    if (station) hint('lift', 'A lift', 'Tap Ride at the orange gate to go up.');
    if (someone) hint('talk', 'Someone to talk to', 'A gold mark overhead means they have something for you.');
    if (someone) hud.setTalk(`Talk to ${someone.person.name}`, () => talkTo(someone));
    else if (stop) hud.setTalk('Take the shuttle', () => rideShuttle(stop));
    else hud.setTalk(null);
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
    if (bench) follow.yaw = bench.yawAt(now);
    follow.update(player.position, ground, player.speed, dt, (x, z) => walls.roofAt(x, z));
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
      hud.setWhere(
        trailAt(world.trails, player.position.x, player.position.z),
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
        talkSheet.open('Welcome to Gore', 'A quiet mountain, in your pocket', [
          'Nothing here is timed, and nothing can go wrong. Wander.',
          'Rest a thumb on the lower part of the screen to walk. Drag higher up to look around.',
          `Tap ${look.ride === 'bike' ? 'Bike' : 'Skis'}, bottom left, and point yourself downhill. The lifts will bring you back up.`,
          'Stones glint on the ground. Trails, lifts and summits stamp your passport. The Book, bottom right, keeps it all.',
        ]);
        welcomed = true;
      }
    }
  });
}

boot().catch((err: unknown) => showFatal(String((err as Error)?.stack ?? err)));

// Keep a copy of the game for when there is no signal. Only where it is really installed: a
// development server or a test would only be confused by an older copy.
if ('serviceWorker' in navigator && location.protocol === 'https:') {
  window.addEventListener('load', () => void navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch(() => undefined));
}
