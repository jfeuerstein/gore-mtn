import * as THREE from 'three/webgpu';
import type { ProjectKind, ProjectState } from '../game/projects';
import { lit } from '../look/material';
import type { ProjectPlot } from './projectPlots';
import { blocks, placed, roof, siding, type Block } from './shapes';
import type { WallBox } from './walls';

const LOG = 0x7a5236;
const PLANK = 0x9a7b5c;
const PALE = 0xc9a36b;
const BARK = 0x5a3f2c;
const STONE = 0x7c8794;
const RED = 0xc8402d;
const GREEN = 0x2f6b4f;
const WHITE = 0xf1e9cf;

/** How far a thing that meets the ground goes on down below it, so that a slope leaves no gap. */
const DEEP = 3;
const sunk = (size: [number, number, number], at: [number, number, number], colour: number): Block => ({ size: [size[0], size[1] + DEEP, size[2]], at: [at[0], at[1] - DEEP / 2, at[2]], colour });

/** A spot staked out and waiting for the crew: four stakes with flagging, a pile of lumber and a sawhorse. */
function site(): { list: Block[]; extra: THREE.BufferGeometry[] } {
  const list: Block[] = [];
  for (const [x, z] of [
    [-2.2, -1.6],
    [2.2, -1.6],
    [2.2, 1.6],
    [-2.2, 1.6],
  ] as const) {
    list.push(sunk([0.09, 0.9, 0.09], [x, 0.45, z], PALE), { size: [0.22, 0.14, 0.03], at: [x + 0.12, 0.8, z], colour: 0xd9772b });
  }
  // Lumber, stacked and stickered, and a sawhorse with a board across it.
  for (let i = 0; i < 3; i++) list.push({ size: [3.0, 0.14, 0.9 - i * 0.2], at: [0, 0.16 + i * 0.17, -0.3], colour: i === 1 ? PLANK : PALE });
  list.push(sunk([0.1, 0.7, 0.1], [-1.0, 0.35, 1.0], BARK), sunk([0.1, 0.7, 0.1], [1.0, 0.35, 1.0], BARK), { size: [2.4, 0.1, 0.24], at: [0, 0.74, 1.0], colour: PALE }, { size: [1.9, 0.06, 0.34], at: [0.2, 0.83, 1.0], colour: PLANK, turn: 0.3 });
  return { list, extra: [] };
}

/** What each kind of thing is made of, with its front at its own +z. */
function model(kind: ProjectKind, roofColour: number): { list: Block[]; extra: THREE.BufferGeometry[] } {
  const list: Block[] = [];
  const extra: THREE.BufferGeometry[] = [];
  if (kind === 'leanto') {
    // An Adirondack lean-to: a floor, three log walls, a roof that slopes to the back, and a fire ring in front.
    list.push(sunk([4.2, 0.35, 2.8], [0, 0.18, -0.4], PLANK), { size: [4.2, 1.5, 0.3], at: [0, 1.1, -1.65], colour: LOG }, { size: [0.3, 1.9, 2.8], at: [-1.95, 1.3, -0.4], colour: LOG }, { size: [0.3, 1.9, 2.8], at: [1.95, 1.3, -0.4], colour: LOG });
    list.push({ size: [4.8, 0.2, 3.7], at: [0, 2.35, -0.55], colour: roofColour, tip: -0.3 }, { size: [4.2, 0.28, 0.3], at: [0, 2.72, 0.95], colour: BARK });
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      list.push({ size: [0.4, 0.3, 0.32], at: [Math.cos(a) * 0.7, 0.12, 2.9 + Math.sin(a) * 0.7], colour: STONE, turn: -a });
    }
    list.push({ size: [0.9, 0.16, 0.16], at: [0, 0.14, 2.9], colour: BARK, turn: 0.6 }, { size: [0.9, 0.16, 0.16], at: [0, 0.2, 2.9], colour: BARK, turn: -0.7 });
  } else if (kind === 'dock') {
    // A dock: planks running out over the water on posts, with a ladder at the end and a bench to sit and look.
    list.push({ size: [1.9, 0.14, 9], at: [0, 0.55, 4.2], colour: PLANK });
    for (const z of [0.4, 3.2, 6, 8.4]) for (const x of [-0.85, 0.85]) list.push(sunk([0.2, 1.0, 0.2], [x, 0.4, z], BARK));
    list.push({ size: [1.5, 0.08, 0.4], at: [0, 1.0, 7.9], colour: PALE }, { size: [0.08, 0.42, 0.34], at: [-0.6, 0.8, 7.9], colour: BARK }, { size: [0.08, 0.42, 0.34], at: [0.6, 0.8, 7.9], colour: BARK });
    list.push({ size: [0.08, 1.3, 0.08], at: [1.02, 0.4, 8.5], colour: PALE }, { size: [0.08, 1.3, 0.08], at: [1.02, 0.4, 8.1], colour: PALE });
    // Steps down to it from the bank.
    list.push(sunk([1.9, 0.3, 1.2], [0, 0.25, -0.5], PALE));
  } else if (kind === 'bandstand') {
    // A bandstand: a raised floor, a post at each corner, a rail, and a roof with a little cupola.
    list.push(sunk([5.4, 0.7, 5.4], [0, 0.35, 0], WHITE), sunk([1.6, 0.35, 0.8], [0, 0.18, 3.0], WHITE));
    for (const x of [-2.5, 2.5]) for (const z of [-2.5, 2.5]) list.push({ size: [0.24, 2.7, 0.24], at: [x, 2.05, z], colour: WHITE });
    for (const [x, z, w, d] of [
      [0, -2.5, 4.8, 0.1],
      [-2.5, 0, 0.1, 4.8],
      [2.5, 0, 0.1, 4.8],
      [-1.7, 2.5, 1.5, 0.1],
      [1.7, 2.5, 1.5, 0.1],
    ] as const) list.push({ size: [w, 0.1, d], at: [x, 1.55, z], colour: GREEN }, { size: [w, 0.08, d], at: [x, 1.1, z], colour: GREEN });
    extra.push(placed(roof(6.4, 6.4, 1.7, roofColour, GREEN), 0, 3.4, 0));
    list.push({ size: [1.0, 0.7, 1.0], at: [0, 5.1, 0], colour: WHITE }, { size: [1.3, 0.16, 1.3], at: [0, 5.5, 0], colour: GREEN });
  } else if (kind === 'hut') {
    // A warming hut: red boards, a green door, a stove pipe, a bench under the eave and skis left leaning.
    list.push(sunk([5.0, 2.7, 3.8], [0, 1.35, 0], RED), { size: [1.0, 2.0, 0.12], at: [-0.9, 1.1, 1.93], colour: GREEN });
    extra.push(placed(roof(5.8, 4.7, 1.6, roofColour, RED), 0, 2.7, 0));
    list.push({ size: [0.3, 1.6, 0.3], at: [1.6, 4.0, -0.6], colour: 0x3d4652 }, { size: [0.44, 0.1, 0.44], at: [1.6, 4.85, -0.6], colour: 0x3d4652 });
    list.push({ size: [1.9, 0.09, 0.42], at: [1.3, 0.55, 2.2], colour: PALE }, sunk([0.1, 0.5, 0.36], [0.5, 0.25, 2.2], BARK), sunk([0.1, 0.5, 0.36], [2.1, 0.25, 2.2], BARK));
    list.push({ size: [0.1, 1.8, 0.04], at: [-2.0, 0.95, 2.0], colour: 0xe3b03f, tip: -0.12 }, { size: [0.1, 1.8, 0.04], at: [-1.8, 0.95, 2.0], colour: 0xe3b03f, tip: -0.12 });
  } else {
    // A lookout: a deck out over the slope on posts, railed on three sides, with a viewer on a post.
    list.push({ size: [5.0, 0.2, 3.6], at: [0, 0.7, 1.4], colour: PLANK }, sunk([1.6, 0.4, 1.0], [0, 0.3, -0.9], PALE));
    for (const x of [-2.3, 2.3]) for (const z of [-0.2, 3.0]) list.push(sunk([0.24, 1.9, 0.24], [x, 0.85, z], BARK));
    for (const [x, z, w, d] of [
      [0, 3.1, 5.0, 0.1],
      [-2.4, 1.4, 0.1, 3.5],
      [2.4, 1.4, 0.1, 3.5],
    ] as const) list.push({ size: [w, 0.1, d], at: [x, 1.75, z], colour: BARK }, { size: [w, 0.08, d], at: [x, 1.3, z], colour: BARK });
    list.push({ size: [0.12, 1.0, 0.12], at: [1.2, 1.3, 2.6], colour: 0x3d4652 }, { size: [0.3, 0.26, 0.5], at: [1.2, 1.9, 2.65], colour: 0x2b62c9 });
  }
  return { list, extra };
}

/**
 * What of each kind of thing is solid, in its own frame (x, z, width, depth, and how tall it
 * stands, for keeping the camera out of a roof): the hut whole, the lean-to's three walls so
 * that it can be walked into, the bandstand's floor. The dock and the lookout's deck are left
 * open, to be walked out along.
 */
const SOLID: Record<ProjectKind, readonly (readonly [x: number, z: number, w: number, d: number, top?: number])[]> = {
  leanto: [
    [0, -1.65, 4.2, 0.3],
    [-1.95, -0.4, 0.3, 2.8],
    [1.95, -0.4, 0.3, 2.8],
  ],
  dock: [],
  bandstand: [[0, 0, 5.4, 5.4, 5.6]],
  hut: [[0, 0, 5.0, 3.8, 4.4]],
  deck: [],
};

/** The walls of a built project, where its plot is. */
export function projectWalls(kind: ProjectKind, plot: ProjectPlot, ground: number): WallBox[] {
  const c = Math.cos(plot.turn);
  const s = Math.sin(plot.turn);
  return SOLID[kind].map(([x, z, w, d, top]) => ({ x: plot.x + x * c + z * s, z: plot.z - x * s + z * c, w, d, turn: plot.turn, ...(top === undefined ? {} : { top: ground + top }) }));
}

/**
 * What the town builds: at each project's plot, nothing, a spot staked out, or the finished
 * thing. One mesh each, and only for those begun: a handful at most.
 */
export class TownProjects {
  readonly group = new THREE.Group();
  private readonly meshes = new Map<string, THREE.Mesh>();
  private readonly material: THREE.MeshLambertMaterial;

  constructor(
    private readonly plots: readonly ProjectPlot[],
    private readonly kinds: ReadonlyMap<string, ProjectKind>,
    private readonly heightAt: (x: number, z: number) => number,
    private readonly roofColour: number,
    private readonly shadows: boolean,
    textured: boolean,
  ) {
    this.group.name = 'projects';
    this.material = lit({ vertexColors: true, flatShading: true, map: textured ? siding() : null });
  }

  /** Show a project as it stands: gone, staked out, or built. */
  set(id: string, state: ProjectState): void {
    const old = this.meshes.get(id);
    if (old) {
      this.group.remove(old);
      old.geometry.dispose();
      this.meshes.delete(id);
    }
    const plot = this.plots.find((p) => p.id === id);
    const kind = this.kinds.get(id);
    if (!plot || !kind || state === 'later' || state === 'proposed') return;
    const { list, extra } = state === 'built' ? model(kind, this.roofColour) : site();
    const mesh = new THREE.Mesh(blocks(list, extra), this.material);
    mesh.position.set(plot.x, this.heightAt(plot.x, plot.z), plot.z);
    mesh.rotation.y = plot.turn;
    mesh.castShadow = this.shadows;
    mesh.receiveShadow = true;
    this.meshes.set(id, mesh);
    this.group.add(mesh);
  }
}
