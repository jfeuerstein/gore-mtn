import * as THREE from 'three/webgpu';
import type { Look } from '../look/looks';
import { makeRng } from '../rng';
import { CABLE_HEIGHT, LINE_OFFSET, pointAlong, towerYaw, type LiftPath } from './lifts';
import type { World } from './world';

/** How far away the sky and the far hills are drawn. Inside the camera's far limit. */
const SKY_RADIUS = 12000;

/** A gradient dome that follows the camera, with the sun as a bright disc where the light comes from. */
export function buildSky(look: Look): THREE.Group {
  const group = new THREE.Group();
  group.name = 'sky';
  const geo = new THREE.SphereGeometry(1, 32, 16);
  const top = new THREE.Color(look.sky.top);
  const middle = new THREE.Color(look.sky.middle);
  const horizon = new THREE.Color(look.sky.horizon);
  const pos = geo.getAttribute('position');
  const colors = new Float32Array(pos.count * 3);
  const c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    // Horizon colour at and below eye level, through the middle colour low in the sky, to the top.
    const up = Math.min(1, Math.max(0, pos.getY(i)));
    if (up < 0.22) c.copy(horizon).lerp(middle, up / 0.22);
    else c.copy(middle).lerp(top, Math.min(1, (up - 0.22) / 0.5));
    colors.set([c.r, c.g, c.b], i * 3);
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  const dome = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false, depthWrite: false }));
  dome.scale.setScalar(SKY_RADIUS);
  dome.renderOrder = -2;
  dome.frustumCulled = false;
  group.add(dome);

  if (look.sunDisc) {
    const disc = new THREE.Mesh(
      new THREE.CircleGeometry(look.sunDisc.size * SKY_RADIUS, 24),
      new THREE.MeshBasicMaterial({ color: look.sunDisc.colour, fog: false, depthWrite: false }),
    );
    const dir = new THREE.Vector3(...look.sun.direction).normalize();
    disc.position.copy(dir).multiplyScalar(SKY_RADIUS * 0.98);
    disc.lookAt(0, 0, 0);
    disc.renderOrder = -1;
    disc.frustumCulled = false;
    group.add(disc);
  }
  return group;
}

/**
 * What lies beyond the mapped mountain: a plain the colour of distant forest, and two rows of far
 * hills fading toward the horizon. Without them the world would stop at the edge of the data.
 */
export function buildBackdrop(look: Look): THREE.Group {
  const group = new THREE.Group();
  group.name = 'backdrop';
  const plain = new THREE.Mesh(new THREE.CircleGeometry(SKY_RADIUS, 48), new THREE.MeshBasicMaterial({ color: look.plain }));
  plain.rotation.x = -Math.PI / 2;
  plain.position.y = -6;
  group.add(plain);

  // Each row is a jagged wall round the world: low-poly silhouettes that rise out of the haze.
  // They are drawn without fog, so each fades by hand from the haze colour at its foot to its own
  // colour at the crest.
  const rng = makeRng(46);
  const haze = new THREE.Color(look.fog.colour);
  const rows = [
    { radius: 8200, low: 120, high: 560, colour: new THREE.Color(look.ridges[0]) },
    { radius: 10800, low: 220, high: 820, colour: new THREE.Color(look.ridges[1]) },
  ];
  for (const row of rows) {
    const SEGMENTS = 72;
    const positions: number[] = [];
    const colours: number[] = [];
    const heights: number[] = [];
    for (let i = 0; i < SEGMENTS; i++) {
      // A few broad swells with smaller peaks on top, the same every load.
      const a = (i / SEGMENTS) * Math.PI * 2;
      const swell = 0.5 + 0.5 * Math.sin(a * 3 + row.radius) * Math.cos(a * 5 + 1.3);
      heights.push(row.low + (row.high - row.low) * (0.35 * swell + 0.65 * rng() * swell + 0.1 * rng()));
    }
    for (let i = 0; i < SEGMENTS; i++) {
      const a0 = (i / SEGMENTS) * Math.PI * 2;
      const a1 = ((i + 1) / SEGMENTS) * Math.PI * 2;
      const h0 = heights[i] as number;
      const h1 = heights[(i + 1) % SEGMENTS] as number;
      const x0 = Math.cos(a0) * row.radius;
      const z0 = Math.sin(a0) * row.radius;
      const x1 = Math.cos(a1) * row.radius;
      const z1 = Math.sin(a1) * row.radius;
      positions.push(x0, -6, z0, x1, -6, z1, x0, h0, z0, x1, -6, z1, x1, h1, z1, x0, h0, z0);
      const foot = [haze.r, haze.g, haze.b];
      const crest = [row.colour.r, row.colour.g, row.colour.b];
      colours.push(...foot, ...foot, ...crest, ...foot, ...crest, ...crest);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(colours, 3));
    const ridge = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide, fog: false }));
    ridge.frustumCulled = false;
    group.add(ridge);
  }
  return group;
}

/**
 * Placeholder lifts: towers with a crossarm, a cable up one side and down the other, and an
 * orange gate at each bottom station to show where to board.
 */
export function buildLifts(paths: readonly LiftPath[]): THREE.Group {
  const group = new THREE.Group();
  group.name = 'lifts';
  const cableMat = new THREE.LineBasicMaterial({ color: 0x2c3340 });
  const m = new THREE.Matrix4();

  let towerCount = 0;
  for (const path of paths) towerCount += path.points.length / 3;
  const steel = new THREE.MeshLambertMaterial({ color: 0x4d5666 });
  const towerGeo = new THREE.BoxGeometry(0.7, CABLE_HEIGHT, 0.7);
  towerGeo.translate(0, -CABLE_HEIGHT / 2, 0); // hangs down from the cable height
  const armGeo = new THREE.BoxGeometry(LINE_OFFSET * 2 + 0.8, 0.45, 0.45);
  const towers = new THREE.InstancedMesh(towerGeo, steel, towerCount);
  const arms = new THREE.InstancedMesh(armGeo, steel, towerCount);
  const q = new THREE.Quaternion();
  const up = new THREE.Vector3(0, 1, 0);
  const one = new THREE.Vector3(1, 1, 1);
  let t = 0;
  for (const path of paths) {
    // One cable up the right of the towers and one down the left, hung from each crossarm.
    const rightLine: THREE.Vector3[] = [];
    const leftLine: THREE.Vector3[] = [];
    for (let i = 0; i < path.points.length; i += 3) {
      const p = new THREE.Vector3(path.points[i], path.points[i + 1], path.points[i + 2]);
      const yaw = towerYaw(path, i / 3);
      const side = new THREE.Vector3(Math.cos(yaw) * LINE_OFFSET, 0, -Math.sin(yaw) * LINE_OFFSET);
      rightLine.push(p.clone().add(side));
      leftLine.push(p.clone().sub(side));
      towers.setMatrixAt(t, m.makeTranslation(p.x, p.y, p.z));
      arms.setMatrixAt(t, m.compose(p, q.setFromAxisAngle(up, yaw), one));
      t++;
    }
    for (const line of [rightLine, leftLine]) {
      if (line.length > 1) group.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(line), cableMat));
    }
  }
  towers.instanceMatrix.needsUpdate = true;
  towers.computeBoundingSphere();
  arms.instanceMatrix.needsUpdate = true;
  arms.computeBoundingSphere();
  group.add(towers, arms);

  // Gate: two posts and a beam, square to the lift line.
  const gateMat = new THREE.MeshLambertMaterial({ color: 0xe8792b, flatShading: true });
  const post = new THREE.BoxGeometry(0.6, 7, 0.6);
  post.translate(0, 3.5, 0);
  const beam = new THREE.BoxGeometry(9, 0.7, 0.7);
  beam.translate(0, 7, 0);
  for (const path of paths) {
    const start = pointAlong(path, 0);
    const gate = new THREE.Group();
    const left = new THREE.Mesh(post, gateMat);
    left.position.x = -4.2;
    const right = new THREE.Mesh(post, gateMat);
    right.position.x = 4.2;
    gate.add(left, right, new THREE.Mesh(beam, gateMat));
    gate.position.set(start.x, start.y - CABLE_HEIGHT, start.z);
    gate.rotation.y = start.yaw;
    gate.traverse((o) => {
      if (o instanceof THREE.Mesh) o.castShadow = true;
    });
    group.add(gate);
  }
  return group;
}

/** Placeholder buildings: a warm box with a dark roof at each named place. */
export function buildPlaces(world: World): THREE.Group {
  const group = new THREE.Group();
  group.name = 'places';
  const wall = new THREE.MeshLambertMaterial({ color: 0xb5793f, flatShading: true });
  const roof = new THREE.MeshLambertMaterial({ color: 0x3d2f2a, flatShading: true });
  for (const place of world.places) {
    if (place.id === 'summit') {
      // Stand-in for the fire tower.
      const tower = new THREE.Mesh(new THREE.BoxGeometry(2.5, 22, 2.5), roof);
      tower.position.set(place.x, place.y + 11, place.z);
      group.add(tower);
      continue;
    }
    const body = new THREE.Mesh(new THREE.BoxGeometry(30, 11, 17), wall);
    body.position.set(place.x, place.y + 5, place.z);
    const top = new THREE.Mesh(new THREE.ConeGeometry(21, 7, 4), roof);
    top.rotation.y = Math.PI / 4;
    top.scale.z = 0.62;
    top.position.set(place.x, place.y + 14, place.z);
    body.castShadow = top.castShadow = true;
    group.add(body, top);
  }
  return group;
}
