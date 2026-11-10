import * as THREE from 'three/webgpu';
import type { Heightfield } from './heightfield';
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
  mesh.scale.setScalar(4000);
  mesh.renderOrder = -1;
  mesh.frustumCulled = false;
  return mesh;
}

/** Placeholder lift lines: a cable that follows the ground, with a tower every 35 metres. */
export function buildLifts(hf: Heightfield, world: World): THREE.Group {
  const group = new THREE.Group();
  group.name = 'lifts';
  const cableMat = new THREE.LineBasicMaterial({ color: 0x2c3340 });
  const towers: THREE.Vector3[] = [];
  const CABLE_HEIGHT = 7;

  for (const lift of world.lifts) {
    const pts: THREE.Vector3[] = [];
    for (let i = 0; i + 3 < lift.pts.length; i += 2) {
      const ax = lift.pts[i] as number;
      const az = lift.pts[i + 1] as number;
      const bx = lift.pts[i + 2] as number;
      const bz = lift.pts[i + 3] as number;
      const steps = Math.max(1, Math.round(Math.hypot(bx - ax, bz - az) / 35));
      for (let s = i === 0 ? 0 : 1; s <= steps; s++) {
        const x = ax + ((bx - ax) * s) / steps;
        const z = az + ((bz - az) * s) / steps;
        const y = hf.heightAt(x, z);
        pts.push(new THREE.Vector3(x, y + CABLE_HEIGHT, z));
        towers.push(new THREE.Vector3(x, y, z));
      }
    }
    if (pts.length > 1) group.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), cableMat));
  }

  const towerGeo = new THREE.BoxGeometry(0.35, CABLE_HEIGHT, 0.35);
  towerGeo.translate(0, CABLE_HEIGHT / 2, 0);
  const towerMesh = new THREE.InstancedMesh(towerGeo, new THREE.MeshLambertMaterial({ color: 0x4d5666 }), towers.length);
  const m = new THREE.Matrix4();
  towers.forEach((t, i) => towerMesh.setMatrixAt(i, m.makeTranslation(t.x, t.y, t.z)));
  towerMesh.instanceMatrix.needsUpdate = true;
  towerMesh.computeBoundingSphere();
  group.add(towerMesh);
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
      const tower = new THREE.Mesh(new THREE.BoxGeometry(1.2, 12, 1.2), roof);
      tower.position.set(place.x, place.y + 6, place.z);
      group.add(tower);
      continue;
    }
    const body = new THREE.Mesh(new THREE.BoxGeometry(12, 5, 7), wall);
    body.position.set(place.x, place.y + 2.2, place.z);
    const top = new THREE.Mesh(new THREE.ConeGeometry(8.5, 3, 4), roof);
    top.rotation.y = Math.PI / 4;
    top.scale.z = 0.62;
    top.position.set(place.x, place.y + 6.2, place.z);
    body.castShadow = top.castShadow = true;
    group.add(body, top);
  }
  return group;
}
