import * as THREE from 'three/webgpu';
import { parseConfig } from './config';
import { BenchRun, showBenchResults } from './debug/bench';
import { deviceLabel, Hud } from './debug/hud';
import { FrameStats } from './debug/perf';
import { Input } from './input/input';
import { FollowCamera } from './player/followCamera';
import { Player } from './player/player';
import { fallLineYaw } from './player/skiPhysics';
import { buildLiftPath, inLiftClearing, pointAlong, stationNear } from './world/lifts';
import { buildLifts, buildPlaces, buildSky, SKY_HORIZON } from './world/scenery';
import { Terrain } from './world/terrainMesh';
import { trailAt, type Place } from './world/trails';
import { Forest, TREE_RANGE } from './world/trees';
import { loadWorld } from './world/world';

const M_TO_FT = 3.28084;
const MS_TO_MPH = 2.23694;
/** Camera pitch while riding a lift: nearly level, to look up the mountain. */
const LIFT_PITCH = 0.2;

/** Handle for screenshots and automated checks. See tools/shot.mjs. */
interface DebugHandle {
  ready: boolean;
  error: string | null;
  state(): Record<string, unknown>;
  teleport(placeId: string): boolean;
  setView(yaw: number, pitch: number): void;
  /** Turn the player and the camera to a yaw. */
  face(yaw: number): void;
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
function fillScreen(): void {
  const standalone =
    (navigator as { standalone?: boolean }).standalone === true || window.matchMedia('(display-mode: standalone)').matches;
  const upright = window.innerHeight >= window.innerWidth;
  const full = upright ? Math.max(screen.width, screen.height) : Math.min(screen.width, screen.height);
  const root = document.documentElement;
  // The height the page is actually laid out at. On some launches this is short even though
  // window.innerHeight reports the whole screen, so measure the layout, not the window.
  const page = Math.min(root.clientHeight || window.innerHeight, window.innerHeight);
  if (standalone && page < full - 1) {
    root.style.setProperty('--app-height', `${full}px`);
    root.style.setProperty('--app-extra', `${full - page}px`);
  } else {
    root.style.removeProperty('--app-height');
    root.style.removeProperty('--app-extra');
  }
}

async function boot(): Promise<void> {
  fillScreen();
  for (const event of ['resize', 'orientationchange', 'pageshow']) window.addEventListener(event, fillScreen);
  document.addEventListener('visibilitychange', fillScreen);
  // iOS can settle the page's height a moment after launch without saying so.
  for (const delay of [300, 1500, 4000]) window.setTimeout(fillScreen, delay);
  const cfg = parseConfig(location.search);
  const canvas = document.getElementById('game') as HTMLCanvasElement;

  const renderer = new THREE.WebGPURenderer({ canvas, antialias: true, forceWebGL: cfg.renderer === 'webgl' });
  await renderer.init();
  const backend = (renderer.backend as { isWebGPUBackend?: boolean }).isWebGPUBackend ? 'WebGPU' : 'WebGL 2';
  renderer.shadowMap.enabled = cfg.shadows;

  const world = await loadWorld(import.meta.env.BASE_URL);
  // The drawn ground and the ground the player stands on are the same decimated grid.
  const ground = world.source.decimate(cfg.stride);

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(SKY_HORIZON, cfg.viewDist * 0.3, cfg.viewDist);
  const sky = buildSky();
  scene.add(sky);

  scene.add(new THREE.HemisphereLight(0xdfeaff, 0x8d97ad, 1.5));
  const sun = new THREE.DirectionalLight(0xfff1dc, 2.4);
  const sunDir = new THREE.Vector3(-0.55, 0.62, 0.56).normalize();
  if (cfg.shadows) {
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    const sc = sun.shadow.camera;
    sc.left = sc.bottom = -55;
    sc.right = sc.top = 55;
    sc.near = 1;
    sc.far = 400;
    sun.shadow.bias = -0.0008;
    sun.shadow.normalBias = 0.4;
  }
  scene.add(sun, sun.target);

  const loader = new THREE.TextureLoader();
  const [snowTexture, canopyTexture] = await Promise.all([
    loader.loadAsync(`${import.meta.env.BASE_URL}world/ground.png`),
    loader.loadAsync(`${import.meta.env.BASE_URL}world/canopy.png`),
  ]);
  const terrain = new Terrain(ground, snowTexture, canopyTexture);
  const liftPaths = world.lifts.map((lift) => buildLiftPath(lift, (x, z) => ground.heightAt(x, z)));
  const trees = new Forest(ground, world, cfg.trees, cfg.shadows, (x, z) => inLiftClearing(liftPaths, x, z));
  scene.add(terrain.group, trees.group, buildLifts(liftPaths), buildPlaces(world));

  const player = new Player(cfg.shadows);
  scene.add(player.object);
  const camera = new THREE.PerspectiveCamera(55, 1, 0.3, 16000); // lens is set by follow.setAspect()
  const follow = new FollowCamera(camera, cfg.zoom);
  const input = new Input(canvas);

  const summit = world.places.find((p) => p.id === 'summit');
  const baseLodge = world.places.find((p) => p.id === 'base-lodge');
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

  if (cfg.ski) player.setMode('ski');
  const hud = new Hud(
    cfg,
    world.places,
    teleport,
    (on) => (input.fastToggle = on),
    (on) => player.setMode(on ? 'ski' : 'walk'),
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

  // Trees are drawn out to the smaller of the view distance and the forest's own range; past
  // that, terrain wears the canopy texture. With trees switched off it wears snow throughout.
  const treeRange = cfg.trees > 0 ? Math.min(cfg.viewDist, TREE_RANGE) : Infinity;
  /** @param unlimited build everything in range at once: before the first frame and after a teleport */
  const cull = (unlimited = false): void => {
    terrain.cull(camera.position.x, camera.position.z, cfg.viewDist, treeRange, unlimited);
    trees.cull(camera.position.x, camera.position.z, cfg.viewDist, unlimited);
  };

  window.__gore.state = () => ({
    backend,
    x: player.position.x,
    y: player.position.y,
    z: player.position.z,
    yaw: follow.yaw,
    pitch: follow.pitch,
    mode: player.mode,
    lift: player.riding?.lift.name ?? null,
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
    const look = input.consumeLook();
    follow.look(look.dx, look.dy);
    player.update(dt, input.moveX, input.moveY, follow.yaw, input.fast, ground, world.onTrail);
    // At the top of a lift, set the player down on the snow a little way ahead of the last tower.
    const arrived = player.takeArrival();
    if (arrived) {
      const top = pointAlong(arrived, arrived.length);
      const ax = top.x - Math.sin(top.yaw) * 30;
      const az = top.z - Math.cos(top.yaw) * 30;
      const spot = world.nearestTrailSpot(ax, az, 150) ?? { x: ax, z: az };
      player.place(spot.x, spot.z, ground);
      player.face(top.yaw);
    }
    // Offer a ride when standing at the foot of a lift.
    const station = player.mode === 'lift' ? null : stationNear(liftPaths, player.position.x, player.position.z);
    if (station) {
      hud.setAction(`Ride ${station.lift.name ?? 'the lift'}`, () => {
        pitchAfterRide = follow.pitch;
        player.board(station);
      });
    }
    else hud.setAction(null);
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
    follow.update(player.position, ground, player.speed, dt);
    trees.update(player.position, camera.position, dt);
    sky.position.copy(camera.position);
    sun.target.position.copy(player.position);
    sun.position.copy(player.position).addScaledVector(sunDir, 150);
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
    }
  });
}

boot().catch((err: unknown) => showFatal(String((err as Error)?.stack ?? err)));
