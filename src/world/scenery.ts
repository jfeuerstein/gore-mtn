import * as THREE from 'three/webgpu';
import { CABLE_HEIGHT, LINE_OFFSET, pointAlong, towerYaw, type LiftPath } from './lifts';
import { blocks } from './shapes';

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
  for (const path of paths) if (!path.surface) towerCount += path.points.length / 3;
  const steel = new THREE.MeshLambertMaterial({ color: 0x4d5666, flatShading: true });
  // A tapered post hanging down from the cable height, and a crossarm with a wheel assembly at
  // each end for the cable to run over.
  const towerGeo = new THREE.CylinderGeometry(0.26, 0.5, CABLE_HEIGHT + 2, 6);
  towerGeo.translate(0, -(CABLE_HEIGHT + 2) / 2, 0);
  const armGeo = blocks([
    { size: [LINE_OFFSET * 2 + 0.6, 0.4, 0.4], at: [0, 0.1, 0], colour: 0xffffff },
    { size: [0.35, 0.3, 2.4], at: [LINE_OFFSET, 0.12, 0], colour: 0xffffff },
    { size: [0.35, 0.3, 2.4], at: [-LINE_OFFSET, 0.12, 0], colour: 0xffffff },
  ]);
  const towers = new THREE.InstancedMesh(towerGeo, steel, Math.max(1, towerCount));
  const arms = new THREE.InstancedMesh(armGeo, steel, Math.max(1, towerCount));
  towers.count = arms.count = towerCount;
  const q = new THREE.Quaternion();
  const up = new THREE.Vector3(0, 1, 0);
  const one = new THREE.Vector3(1, 1, 1);
  let t = 0;
  for (const path of paths) {
    // A lift that runs along the snow has no towers or cable: a dark belt on the ground instead.
    if (path.surface) {
      for (let i = 0; i + 3 < path.points.length; i += 3) {
        const a = new THREE.Vector3(path.points[i], path.points[i + 1], path.points[i + 2]);
        const b = new THREE.Vector3(path.points[i + 3], path.points[i + 4], path.points[i + 5]);
        const belt = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.12, a.distanceTo(b)), steel);
        belt.position.copy(a).add(b).multiplyScalar(0.5);
        belt.position.y += 0.06;
        belt.lookAt(b.x, b.y + 0.06, b.z);
        group.add(belt);
      }
      continue;
    }
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
    gate.position.set(start.x, start.y - (path.surface ? 0 : CABLE_HEIGHT), start.z);
    gate.rotation.y = start.yaw;
    gate.traverse((o) => {
      if (o instanceof THREE.Mesh) o.castShadow = true;
    });
    group.add(gate);
  }
  return group;
}
