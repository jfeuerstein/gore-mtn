import * as THREE from 'three/webgpu';
import { parseConfig } from './config';
import { BenchRun, showBenchResults } from './debug/bench';
import { deviceLabel, Hud } from './debug/hud';
import { FrameStats } from './debug/perf';
import { Input } from './input/input';
import { FollowCamera } from './player/followCamera';
import { Player } from './player/player';
import { fallLineYaw } from './player/skiPhysics';
import { buildLifts, buildPlaces, buildSky, SKY_HORIZON } from './world/scenery';
import { Terrain } from './world/terrainMesh';
import { trailAt, type Place } from './world/trails';
import { buildTrees } from './world/trees';
import { loadWorld } from './world/world';

const M_TO_FT = 3.28084;
const MS_TO_MPH = 2.23694;

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
    document.body.appendChild(el);
  }
  el.textContent = `Something went wrong.\n\n${message}`;
}
window.addEventListener('error', (e) => showFatal(String(e.error?.stack ?? e.message)));
window.addEventListener('unhandledrejection', (e) => showFatal(String(e.reason?.stack ?? e.reason)));

/**
 * Launched from the Home Screen, iOS can lay the page out shorter than the screen by the height
 * of the status bar while still drawing it from the very top, which leaves an empty bar along the
 * bottom. When that happens, size the game to the screen itself.
 */
function fillScreen(): void {
  const standalone =
    (navigator as { standalone?: boolean }).standalone === true || window.matchMedia('(display-mode: standalone)').matches;
  const upright = window.innerHeight >= window.innerWidth;
  const full = upright ? Math.max(screen.width, screen.height) : Math.min(screen.width, screen.height);
  const root = document.documentElement;
  if (standalone && window.innerHeight < full - 1) root.style.setProperty('--app-height', `${full}px`);
  else root.style.removeProperty('--app-height');
}

async function boot(): Promise<void> {
  fillScreen();
  window.addEventListener('resize', fillScreen);
  window.addEventListener('orientationchange', fillScreen);
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

  const groundTexture = await new THREE.TextureLoader().loadAsync(`${import.meta.env.BASE_URL}world/ground.png`);
  const terrain = new Terrain(ground, world, groundTexture);
  const trees = buildTrees(ground, world, cfg.trees, cfg.shadows);
  scene.add(terrain.group, trees.group, buildLifts(ground, world), buildPlaces(world));

  const player = new Player(cfg.shadows);
  scene.add(player.object);
  const camera = new THREE.PerspectiveCamera(55, 1, 0.3, 6000); // lens is set by follow.setAspect()
  const follow = new FollowCamera(camera, cfg.zoom);
  const input = new Input(canvas);

  const summit = world.places.find((p) => p.id === 'summit');
  const baseLodge = world.places.find((p) => p.id === 'base-lodge');
  const teleport = (place: Place): void => {
    // Stand a little way off, on the side facing the view, so the placeholder building ends up
    // behind the camera.
    const lookAt = (place.id === 'summit' ? baseLodge : summit) ?? place;
    const dx = lookAt.x - place.x;
    const dz = lookAt.z - place.z;
    const len = Math.hypot(dx, dz) || 1;
    const px = place.x + (dx / len) * 20;
    const pz = place.z + (dz / len) * 20;
    // Start on groomed snow where there is some nearby, not in the trees.
    const spot = world.nearestTrailSpot(px, pz, 90) ?? { x: px, z: pz };
    player.place(spot.x, spot.z, ground);
    follow.faceToward(player.position.x, player.position.z, lookAt.x, lookAt.z);
    player.face(follow.yaw);
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
      ? new BenchRun(cfg.bench, cfg.benchSeconds, follow.yaw, { backend, trees: trees.count, resolution })
      : null;
  if (cfg.bench === 'done') showBenchResults(deviceLabel());

  const stats = new FrameStats();
  let last = performance.now();
  let sinceHud = 0;
  let frames = 0;

  const cull = (): void => {
    terrain.cull(camera.position.x, camera.position.z, cfg.viewDist);
    trees.cull(camera.position.x, camera.position.z, cfg.viewDist);
  };

  window.__gore.state = () => ({
    backend,
    x: player.position.x,
    y: player.position.y,
    z: player.position.z,
    yaw: follow.yaw,
    pitch: follow.pitch,
    mode: player.mode,
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
    // On foot the camera follows as hard as the stick is pushed. On skis it follows with speed,
    // and more firmly, because the skier's heading is the only thing steering the view. It also
    // follows a turn made at a standstill, so the player can see where the skis now point.
    const followAmount =
      player.mode === 'ski'
        ? Math.max(Math.min(1, player.speed / 3), Math.abs(input.moveX)) * 2.5
        : Math.min(1, Math.hypot(input.moveX, input.moveY));
    follow.follow(player.travelHeading, followAmount, dt, player.mode === 'ski');
    if (bench) follow.yaw = bench.yawAt(now);
    follow.update(player.position, ground, player.speed, dt);
    trees.update(player.position, camera.position, dt);
    sky.position.copy(camera.position);
    sun.target.position.copy(player.position);
    sun.position.copy(player.position).addScaledVector(sunDir, 150);
    cull();

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
      );
    }
    if (frames === 3) {
      document.getElementById('loading')?.remove();
      window.__gore.ready = true;
    }
  });
}

boot().catch((err: unknown) => showFatal(String((err as Error)?.stack ?? err)));
