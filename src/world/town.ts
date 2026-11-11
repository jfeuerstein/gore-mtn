import * as THREE from 'three/webgpu';
import { blocks, placed, roof, type Block } from './shapes';
import type { Footprint } from './trails';

/** Paint colours for the houses of North Creek. Each is picked by the house's place, so a house keeps its colour. */
const PAINTS = [0xece5d3, 0xcfd8df, 0xdcbfa6, 0xbcc8ae, 0xe8d9ae, 0xb9a996, 0xf5f2ea, 0xa9483a, 0xc7b79c, 0x9fb0bd];
const STEEPLE = 0xf5f2ea;

/** Share of a house's height that is wall; the rest is roof. */
const WALL_SHARE = 0.6;

/** A repeatable number in 0..1 for a place. */
function roll(x: number, z: number): number {
  let t = (Math.imul(Math.round(x * 10), 0x9e3779b1) ^ Math.imul(Math.round(z * 10), 0x85ebca6b)) >>> 0;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  return ((t ^ (t >>> 13)) >>> 0) / 4294967296;
}

/** How tall a building of a footprint stands, in metres, eaves and roof together. */
export function houseHeight(b: Footprint): number {
  const small = Math.min(b.w, b.d);
  // A shed is low, a house has a storey or two, and a big hall is lower for its size than a house.
  return Math.min(13, 3.2 + small * 0.55);
}

/**
 * The houses and halls of North Creek and the roads around the mountain, each on its real plot.
 * One house, a unit across, is stretched to fit every footprint: walls that take a coat of paint
 * per house, a roof in the season's colour, and windows that light after dark. Three draw calls.
 */
export class Town {
  readonly group = new THREE.Group();
  private readonly glass = new THREE.MeshBasicMaterial({ color: 0x3d4a5e });
  private readonly dark = new THREE.Color(0x3d4a5e);
  private readonly lit = new THREE.Color(0xffc56e);

  /** @param roofColour snow in winter, shingle otherwise */
  constructor(buildings: readonly Footprint[], castShadow: boolean, roofColour: number) {
    this.group.name = 'town';
    if (buildings.length === 0) return;
    const wallGeo = blocks([{ size: [1, WALL_SHARE, 1], at: [0, WALL_SHARE / 2, 0], colour: 0xffffff }]);
    const roofGeo = placed(roof(1.08, 1.12, 1 - WALL_SHARE, 0xffffff, 0xd8d8d8), 0, WALL_SHARE, 0);
    const panes: Block[] = [];
    for (const side of [-1, 1]) {
      for (const along of [-0.26, 0.26]) panes.push({ size: [0.14, 0.2, 0.02], at: [along, WALL_SHARE * 0.56, side * 0.505], colour: 0xffffff });
      panes.push({ size: [0.02, 0.2, 0.2], at: [side * 0.505, WALL_SHARE * 0.56, 0], colour: 0xffffff });
    }
    const paneGeo = blocks(panes);

    const walls = new THREE.InstancedMesh(wallGeo, new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true }), buildings.length);
    const roofs = new THREE.InstancedMesh(roofGeo, new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true, color: roofColour }), buildings.length);
    const windows = new THREE.InstancedMesh(paneGeo, this.glass, buildings.length);
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const up = new THREE.Vector3(0, 1, 0);
    const p = new THREE.Vector3();
    const s = new THREE.Vector3();
    const paint = new THREE.Color();
    const steeples: Block[] = [];
    buildings.forEach((b, i) => {
      const h = houseHeight(b);
      // Sunk a little, so the walls meet the ground on a slope.
      m.compose(p.set(b.x, b.y - 0.6, b.z), q.setFromAxisAngle(up, b.turn), s.set(b.w, h, b.d));
      walls.setMatrixAt(i, m);
      roofs.setMatrixAt(i, m);
      windows.setMatrixAt(i, m);
      const church = b.kind === 'place_of_worship' || b.kind === 'church';
      walls.setColorAt(i, paint.setHex(church ? STEEPLE : (PAINTS[Math.floor(roll(b.x, b.z) * PAINTS.length)] as number)));
      if (church) {
        // A steeple at one end, so the churches can be seen over the roofs.
        const ex = b.x + Math.cos(b.turn) * (b.w / 2 - 2);
        const ez = b.z - Math.sin(b.turn) * (b.w / 2 - 2);
        steeples.push(
          { size: [3.2, h + 5, 3.2], at: [ex, b.y + (h + 5) / 2 - 0.6, ez], colour: STEEPLE, turn: b.turn },
          { size: [2, 5, 2], at: [ex, b.y + h + 6.5, ez], colour: 0x5c6672, turn: b.turn },
        );
      }
    });
    for (const mesh of [walls, roofs, windows]) {
      mesh.instanceMatrix.needsUpdate = true;
      mesh.computeBoundingSphere();
      mesh.matrixAutoUpdate = false;
      this.group.add(mesh);
    }
    walls.castShadow = castShadow;
    roofs.castShadow = castShadow;
    walls.receiveShadow = true;
    if (steeples.length > 0) {
      const mesh = new THREE.Mesh(blocks(steeples), new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true }));
      mesh.castShadow = castShadow;
      mesh.matrixAutoUpdate = false;
      this.group.add(mesh);
    }
  }

  /** How lit the windows are: 0 by day, 1 after dark. */
  setLamps(amount: number): void {
    this.glass.color.copy(this.dark).lerp(this.lit, Math.min(1, Math.max(0, amount)));
  }
}
