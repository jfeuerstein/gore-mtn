import * as THREE from 'three/webgpu';
import { CABLE_HEIGHT, LINE_OFFSET, towerYaw, type LiftPath } from './lifts';
import { blocks, type Block } from './shapes';

const GATE = 0xe8792b;
const STEEL = 0x4d5666;

/**
 * The lifts: towers with a crossarm, a cable up one side and down the other, a station at each
 * end, and at the bottom an attendant's shack and an orange gate to show where to board.
 * @param snowy whether snow lies on the roofs
 */
export function buildLifts(paths: readonly LiftPath[], snowy = true): THREE.Group {
  const group = new THREE.Group();
  group.name = 'lifts';
  const cableMat = new THREE.LineBasicMaterial({ color: 0x2c3340 });
  const m = new THREE.Matrix4();

  let towerCount = 0;
  for (const path of paths) if (!path.surface) towerCount += path.points.length / 3;
  const steel = new THREE.MeshLambertMaterial({ color: STEEL, flatShading: true });
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
  // Everything else is joined into one mesh (stations, shacks, gates, belts) and one set of
  // lines (the cables), so all the lifts on the mountain cost four draw calls between them.
  const works: Block[] = [];
  const cables: number[] = [];
  let t = 0;
  for (const path of paths) {
    const pts = path.points;
    const n = pts.length / 3;
    if (n < 2) continue;
    // The way the line sets off, flat on the map, and the turn that lays a model's own z along it.
    const run = Math.hypot((pts[3] as number) - (pts[0] as number), (pts[5] as number) - (pts[2] as number)) || 1;
    const dx = ((pts[3] as number) - (pts[0] as number)) / run;
    const dz = ((pts[5] as number) - (pts[2] as number)) / run;
    const turn = Math.atan2(dx, dz);
    /** A block given in the bottom station's own frame: x across the line, z up it, y above the ground there. */
    const foot = { x: pts[0] as number, y: (pts[1] as number) - (path.surface ? 0 : CABLE_HEIGHT), z: pts[2] as number };
    const atFoot = (size: [number, number, number], lx: number, y: number, lz: number, colour: number): Block => ({
      size,
      at: [foot.x + lx * dz + lz * dx, foot.y + y, foot.z - lx * dx + lz * dz],
      colour,
      turn,
    });
    // The gate: two posts and a beam, square to the line, to show where to board.
    works.push(atFoot([0.6, 7, 0.6], -4.2, 3.5, 0, GATE), atFoot([0.6, 7, 0.6], 4.2, 3.5, 0, GATE), atFoot([9, 0.7, 0.7], 0, 7, 0, GATE));
    // The attendant's shack, on the side they stand.
    works.push(
      atFoot([3.2, 2.6, 3.2], -11, 1.3, -5, 0x7a5232),
      atFoot([3.7, 0.3, 3.7], -11, 2.75, -5, snowy ? 0xf2f5fa : 0x4d5666),
      atFoot([1.5, 0.9, 0.1], -11, 1.6, -3.36, 0x3d4a5e),
      atFoot([0.1, 0.9, 1.5], -9.36, 1.6, -5, 0x3d4a5e),
    );
    // A lift that runs along the snow has no towers or cable: a dark belt on the ground instead.
    if (path.surface) {
      for (let i = 0; i + 5 < pts.length; i += 3) {
        const ax = pts[i] as number;
        const ay = pts[i + 1] as number;
        const az = pts[i + 2] as number;
        const bx = pts[i + 3] as number;
        const by = pts[i + 4] as number;
        const bz = pts[i + 5] as number;
        const flat = Math.hypot(bx - ax, bz - az);
        works.push({
          size: [1.4, 0.12, Math.hypot(flat, by - ay)],
          at: [(ax + bx) / 2, (ay + by) / 2 + 0.06, (az + bz) / 2],
          colour: STEEL,
          turn: Math.atan2(bx - ax, bz - az),
          tip: -Math.atan2(by - ay, flat),
        });
      }
      continue;
    }
    // One cable up the right of the towers and one down the left, hung from each crossarm.
    let before: [number, number, number, number, number, number] | null = null;
    for (let i = 0; i < pts.length; i += 3) {
      const p = new THREE.Vector3(pts[i], pts[i + 1], pts[i + 2]);
      const yaw = towerYaw(path, i / 3);
      const sx = Math.cos(yaw) * LINE_OFFSET;
      const sz = -Math.sin(yaw) * LINE_OFFSET;
      const here: [number, number, number, number, number, number] = [p.x + sx, p.y, p.z + sz, p.x - sx, p.y, p.z - sz];
      if (before) cables.push(before[0], before[1], before[2], here[0], here[1], here[2], before[3], before[4], before[5], here[3], here[4], here[5]);
      before = here;
      towers.setMatrixAt(t, m.makeTranslation(p.x, p.y, p.z));
      arms.setMatrixAt(t, m.compose(p, q.setFromAxisAngle(up, yaw), one));
      t++;
    }
    // A station at each end: a housing over the wheel the cable turns on, with a stripe, on a stout
    // mast. The gondola's are bigger and red, as the cabins are.
    const big = path.cabins;
    const paint = big ? 0xb53a2a : 0x3f5a4a;
    const w = LINE_OFFSET * 2 + (big ? 4 : 2.4);
    const len = big ? 12 : 7.5;
    const tall = big ? 3.4 : 2.2;
    for (const end of [0, n - 1]) {
      const ex = pts[end * 3] as number;
      const ey = pts[end * 3 + 1] as number;
      const ez = pts[end * 3 + 2] as number;
      // The line's direction at this end, pointing out past the end of the lift.
      const other = end === 0 ? 1 : n - 2;
      const out = Math.hypot(ex - (pts[other * 3] as number), ez - (pts[other * 3 + 2] as number)) || 1;
      const ox = (ex - (pts[other * 3] as number)) / out;
      const oz = (ez - (pts[other * 3 + 2] as number)) / out;
      const face = Math.atan2(ox, oz);
      const block = (size: [number, number, number], y: number, along: number, colour: number): Block => ({ size, at: [ex + ox * along, ey + y, ez + oz * along], colour, turn: face });
      works.push(
        block([w, tall, len], 0.35, len / 2 - 2.2, paint),
        block([w + 0.12, 0.5, len + 0.12], 0.1, len / 2 - 2.2, 0xf1e9d6),
        block([w + 0.3, 0.25, len + 0.3], 0.35 + tall / 2 + 0.12, len / 2 - 2.2, snowy ? 0xf2f5fa : 0x2c3340),
        block([1.1, CABLE_HEIGHT, 1.1], -CABLE_HEIGHT / 2, len - 3.4, STEEL),
      );
    }
  }
  towers.instanceMatrix.needsUpdate = true;
  towers.computeBoundingSphere();
  arms.instanceMatrix.needsUpdate = true;
  arms.computeBoundingSphere();
  const cableLines = new THREE.LineSegments(new THREE.BufferGeometry(), cableMat);
  cableLines.geometry.setAttribute('position', new THREE.Float32BufferAttribute(cables, 3));
  cableLines.geometry.computeBoundingSphere();
  const station = new THREE.Mesh(blocks(works), new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true }));
  station.castShadow = true;
  for (const part of [towers, arms, cableLines, station]) part.matrixAutoUpdate = false;
  group.add(towers, arms, cableLines, station);
  return group;
}

/**
 * The snow guns: a tall pole at the edge of the trail, its head leaning out over the snow, and
 * a hydrant box at its foot. One instanced mesh for all of them.
 */
export function buildSnowGuns(guns: readonly { x: number; z: number; turn: number }[], heightAt: (x: number, z: number) => number, castShadow: boolean): THREE.InstancedMesh {
  const geo = blocks([
    { size: [0.5, 0.9, 0.5], at: [0, 0.45, 0], colour: 0x2b5fb5 },
    { size: [0.14, 7.2, 0.14], at: [0, 3.6, 0], colour: 0xc9ced6 },
    { size: [0.1, 0.1, 1.7], at: [0, 7.35, 0.75], colour: 0xc9ced6, tip: -0.3 },
    { size: [0.36, 0.36, 0.55], at: [0, 7.66, 1.6], colour: 0xe2a52e, tip: -0.3 },
  ]);
  const mesh = new THREE.InstancedMesh(geo, new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true }), Math.max(1, guns.length));
  mesh.name = 'snow-guns';
  mesh.count = guns.length;
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const up = new THREE.Vector3(0, 1, 0);
  const p = new THREE.Vector3();
  const one = new THREE.Vector3(1, 1, 1);
  guns.forEach((gun, i) => mesh.setMatrixAt(i, m.compose(p.set(gun.x, heightAt(gun.x, gun.z) - 0.2, gun.z), q.setFromAxisAngle(up, gun.turn), one)));
  mesh.instanceMatrix.needsUpdate = true;
  mesh.computeBoundingSphere();
  mesh.castShadow = castShadow;
  mesh.matrixAutoUpdate = false;
  return mesh;
}
