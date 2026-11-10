import * as THREE from 'three/webgpu';
import { CABLE_HEIGHT, LINE_OFFSET, pointAlong, towerYaw, type LiftPath } from './lifts';
import type { World } from './world';

export const SKY_TOP = 0x8fb4e6;
export const SKY_HORIZON = 0xe6edf7;

/** A gradient dome that follows the camera. Fog matches its horizon colour. */
export function buildSky(): THREE.Mesh {
  const geo = new THREE.SphereGeometry(1, 24, 12);
  const top = new THREE.Color(SKY_TOP);
  const horizon = new THREE.Color(SKY_HORIZON);
  const pos = geo.getAttribute('position');
  const colors = new Float32Array(pos.count * 3);
  const c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const t = Math.min(1, Math.max(0, pos.getY(i) * 2.2));
    c.copy(horizon).lerp(top, t);
    colors.set([c.r, c.g, c.b], i * 3);
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  const mat = new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false, depthWrite: false });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.scale.setScalar(12000);
  mesh.renderOrder = -1;
  mesh.frustumCulled = false;
  return mesh;
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
