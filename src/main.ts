import * as THREE from 'three/webgpu';
import { parseConfig } from './config';
import { Hud } from './debug/hud';
import { FrameStats } from './debug/perf';
import { Input } from './input/input';
import { FollowCamera } from './player/followCamera';
import { Player } from './player/player';
import { buildLifts, buildPlaces, buildSky, SKY_HORIZON } from './world/scenery';
import { buildTerrain } from './world/terrainMesh';
import { trailAt, type Place } from './world/trails';
import { buildTrees } from './world/trees';
import { loadWorld } from './world/world';

const M_TO_FT = 3.28084;

/** Handle for screenshots and automated checks. See tools/shot.mjs. */
interface DebugHandle {
  ready: boolean;
  error: string | null;
  state(): Record<string, unknown>;
  teleport(placeId: string): boolean;
  setView(yaw: number, pitch: number): void;
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

async function boot(): Promise<void> {
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

  const terrain = buildTerrain(ground, world);
  const trees = buildTrees(ground, world, cfg.trees, cfg.shadows);
  scene.add(terrain.group, trees.group, buildLifts(ground, world), buildPlaces(world));

  const player = new Player(cfg.shadows);
  scene.add(player.object);
  const camera = new THREE.PerspectiveCamera(55, 1, 0.3, 6000); // lens is set by follow.setAspect()
  const follow = new FollowCamera(camera);
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
    player.place(place.x + (dx / len) * 20, place.z + (dz / len) * 20, ground);
    follow.faceToward(player.position.x, player.position.z, lookAt.x, lookAt.z);
    player.face(follow.yaw);
  };

  const start = world.places.find((p) => p.id === cfg.at) ?? baseLodge ?? world.places[0];
  if (start) teleport(start);
  if (cfg.pos) player.place(cfg.pos.x, cfg.pos.z, ground);
  if (cfg.yaw !== null) follow.yaw = cfg.yaw;

  const hud = new Hud(cfg, world.places, teleport, (on) => (input.fastToggle = on));

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

  const stats = new FrameStats();
  let last = performance.now();
  let sinceHud = 0;
  let frames = 0;

  const cull = (): void => {
    const cx = camera.position.x;
    const cz = camera.position.z;
    for (const t of terrain.tiles) {
      t.mesh.visible = Math.hypot(t.centerX - cx, t.centerZ - cz) - t.radius < cfg.viewDist;
    }
    for (const p of trees.patches) {
      p.mesh.visible = Math.hypot(p.centerX - cx, p.centerZ - cz) - p.radius < cfg.viewDist;
    }
  };

  window.__gore.state = () => ({
    backend,
    x: player.position.x,
    y: player.position.y,
    z: player.position.z,
    yaw: follow.yaw,
    pitch: follow.pitch,
    fps: stats.fps,
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
  window.__gore.setView = (yaw, pitch) => {
    follow.yaw = yaw;
    follow.pitch = pitch;
  };

  await renderer.setAnimationLoop((now) => {
    const frameMs = now - last;
    last = now;
    const dt = Math.min(0.05, frameMs / 1000);
    // The first frames include shader compilation and would swamp the readout.
    if (frames > 10) stats.push(frameMs);

    input.update();
    const look = input.consumeLook();
    follow.look(look.dx, look.dy);
    player.update(dt, input.moveX, input.moveY, follow.yaw, input.fast, ground);
    follow.follow(player.travelHeading, Math.min(1, Math.hypot(input.moveX, input.moveY)), dt);
    follow.update(player.position, ground);
    sky.position.copy(camera.position);
    sun.target.position.copy(player.position);
    sun.position.copy(player.position).addScaledVector(sunDir, 150);
    cull();

    renderer.render(scene, camera);
    frames++;

    sinceHud += frameMs;
    if (sinceHud >= 250) {
      sinceHud = 0;
      hud.setStats({
        fps: stats.fps,
        p95Ms: stats.p95Ms,
        worstMs: stats.worstMs,
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
      );
    }
    if (frames === 3) {
      document.getElementById('loading')?.remove();
      window.__gore.ready = true;
    }
  });
}

boot().catch((err: unknown) => showFatal(String((err as Error)?.stack ?? err)));
