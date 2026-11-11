import * as THREE from 'three/webgpu';
import type { Person } from '../game/people';
import { STANDING } from '../player/pose';
import { Skier, type Outfit } from '../player/skier';
import { blocks, type Block } from './shapes';

/** People further than this from the player are not drawn, in metres. */
const DRAW_RANGE = 220;
/** Within this distance a person turns to face the player. */
const NOTICE_RANGE = 28;
/** The same scale the player is drawn at. */
const SCALE = 0.75;

export interface Standing {
  person: Person;
  x: number;
  y: number;
  z: number;
}

/**
 * A standing figure in an outfit, as one geometry. The player's figure is a couple of dozen
 * jointed parts, each drawn separately; someone who only stands and turns can be all of those
 * parts fixed in place and joined, which draws in a single call.
 */
function standingFigure(outfit: Outfit): THREE.BufferGeometry {
  const skier = new Skier(false, outfit);
  // Hands a little forward and apart, as someone waiting does.
  skier.pose({ ...STANDING, shoulderL: 0.18, shoulderR: 0.1, armsOut: 0.12, elbow: 0.5 }, false);
  skier.root.updateMatrixWorld(true);
  const positions: number[] = [];
  const normals: number[] = [];
  const colours: number[] = [];
  skier.root.traverse((o) => {
    if (!(o instanceof THREE.Mesh) || !o.visible) return;
    // Skis, poles and the bike are there but hidden; a hidden parent hides its parts.
    for (let up: THREE.Object3D | null = o; up; up = up.parent) if (!up.visible) return;
    const geo = (o.geometry as THREE.BufferGeometry).index ? (o.geometry as THREE.BufferGeometry).toNonIndexed() : (o.geometry as THREE.BufferGeometry).clone();
    geo.applyMatrix4(o.matrixWorld);
    const colour = (o.material as THREE.MeshLambertMaterial).color;
    const p = geo.getAttribute('position');
    const n = geo.getAttribute('normal');
    for (let i = 0; i < p.count; i++) {
      positions.push(p.getX(i), p.getY(i), p.getZ(i));
      normals.push(n.getX(i), n.getY(i), n.getZ(i));
      colours.push(colour.r, colour.g, colour.b);
    }
  });
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  out.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  out.setAttribute('color', new THREE.Float32BufferAttribute(colours, 3));
  out.computeBoundingSphere();
  return out;
}

/** A small upright diamond that hangs over someone with something to say, or something to be picked up. */
function flag(colour: number): THREE.Mesh {
  const w = 0.2;
  const h = 0.42;
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute([0, h, 0, -w, 0, 0, w, 0, 0, 0, -h, 0, w, 0, 0, -w, 0, 0], 3));
  geo.computeVertexNormals();
  return new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: colour, side: THREE.DoubleSide }));
}

/**
 * The people of the mountain and the town, each standing at their post in their own colours. They
 * are the same jointed figure as the player. One turns to watch the player come up, and carries a
 * mark overhead while they have something to ask, hand over or say thanks for.
 */
export class Folk {
  readonly group = new THREE.Group();
  private readonly figures: { standing: Standing; body: THREE.Mesh; mark: THREE.Mesh; yaw: number }[] = [];
  private time = 0;

  constructor(people: readonly Standing[], castShadow: boolean) {
    this.group.name = 'folk';
    const material = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });
    for (const standing of people) {
      const body = new THREE.Mesh(standingFigure(standing.person.look), material);
      body.scale.setScalar(SCALE);
      body.position.set(standing.x, standing.y, standing.z);
      // Facing south to begin with, out from the door.
      body.rotation.y = Math.PI;
      body.castShadow = castShadow;
      const mark = flag(0xffb02e);
      mark.visible = false;
      this.group.add(body, mark);
      this.figures.push({ standing, body, mark, yaw: Math.PI });
    }
  }

  /** The nearest person within reach of a position, if any. */
  nearest(x: number, z: number, reach: number): Standing | null {
    let best: Standing | null = null;
    let bestDist = reach;
    for (const f of this.figures) {
      const d = Math.hypot(f.standing.x - x, f.standing.z - z);
      if (d < bestDist) {
        bestDist = d;
        best = f.standing;
      }
    }
    return best;
  }

  /**
   * @param hasBusiness whether a person has something for the player, by id
   * @param cameraYaw so the marks face the camera
   */
  update(dt: number, player: { x: number; z: number }, hasBusiness: (id: string) => boolean, cameraYaw: number): void {
    this.time += dt;
    for (const f of this.figures) {
      const { standing, body, mark } = f;
      const dx = player.x - standing.x;
      const dz = player.z - standing.z;
      const dist = Math.hypot(dx, dz);
      const shown = dist < DRAW_RANGE;
      body.visible = shown;
      mark.visible = shown && hasBusiness(standing.person.id);
      if (!shown) continue;
      // Turn to face whoever is coming; otherwise look out from the door.
      const want = dist < NOTICE_RANGE && dist > 0.5 ? Math.atan2(-dx, -dz) : Math.PI;
      const turn = Math.atan2(Math.sin(want - f.yaw), Math.cos(want - f.yaw));
      f.yaw += turn * Math.min(1, dt * 4);
      // Rocking a little on their heels, as people do who stand outside all day.
      body.rotation.set(Math.sin(this.time * 0.8 + standing.x) * 0.025, f.yaw, Math.sin(this.time * 0.6 + standing.z) * 0.02);
      if (mark.visible) {
        mark.position.set(standing.x, standing.y + 2.25 + Math.sin(this.time * 2.2 + standing.z) * 0.08, standing.z);
        mark.rotation.y = cameraYaw;
      }
    }
  }
}

export interface Keepsake {
  id: string;
  x: number;
  y: number;
  z: number;
}

const KEEPSAKE_MODEL: Record<string, Block[]> = {
  mitten: [
    { size: [0.34, 0.14, 0.46], at: [0, 0.1, 0], colour: 0xf0d040 },
    { size: [0.14, 0.12, 0.2], at: [0.22, 0.09, 0.08], colour: 0xf0d040 },
    { size: [0.36, 0.15, 0.12], at: [0, 0.1, 0.26], colour: 0xfafafa },
  ],
  goggles: [
    { size: [0.5, 0.2, 0.12], at: [0, 0.14, 0], colour: 0x2b3a55 },
    { size: [0.42, 0.13, 0.04], at: [0, 0.14, -0.07], colour: 0xf0a030 },
    { size: [0.7, 0.06, 0.05], at: [0, 0.14, 0.12], colour: 0xe86aa0 },
  ],
  kite: [
    { size: [0.9, 0.04, 0.9], at: [0, 0.2, 0], colour: 0xd02a2a, turn: Math.PI / 4, tip: 0.25 },
    { size: [0.05, 0.03, 1.2], at: [0, 0.22, 0], colour: 0x6b4a33, tip: 0.25 },
    { size: [0.06, 0.03, 0.9], at: [0.1, 0.05, 0.8], colour: 0xf0d040, turn: 0.4 },
  ],
};

/** Lost property lying on the mountain while someone is looking for it: a small thing with a mark over it. */
export class Keepsakes {
  readonly group = new THREE.Group();
  private readonly material = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });
  private readonly shown = new Map<string, { item: Keepsake; mesh: THREE.Mesh; mark: THREE.Mesh }>();
  private time = 0;

  /** The items lying about just now. */
  set(items: readonly Keepsake[]): void {
    const wanted = new Set(items.map((i) => i.id));
    for (const [id, s] of this.shown) {
      if (wanted.has(id)) continue;
      this.group.remove(s.mesh, s.mark);
      this.shown.delete(id);
    }
    for (const item of items) {
      if (this.shown.has(item.id)) continue;
      const mesh = new THREE.Mesh(blocks(KEEPSAKE_MODEL[item.id] ?? [{ size: [0.4, 0.3, 0.4], at: [0, 0.15, 0], colour: 0xc2412d }]), this.material);
      // Bigger than life, like everything small in the game.
      mesh.scale.setScalar(1.6);
      mesh.position.set(item.x, item.y + 0.05, item.z);
      const mark = flag(0xffb02e);
      this.group.add(mesh, mark);
      this.shown.set(item.id, { item, mesh, mark });
    }
  }

  /** The item within reach of a position, if any. */
  near(x: number, z: number, reach: number): Keepsake | null {
    for (const s of this.shown.values()) if (Math.hypot(s.item.x - x, s.item.z - z) <= reach) return s.item;
    return null;
  }

  update(dt: number, cameraYaw: number): void {
    this.time += dt;
    for (const s of this.shown.values()) {
      s.mark.position.set(s.item.x, s.item.y + 1.6 + Math.sin(this.time * 2.4) * 0.1, s.item.z);
      s.mark.rotation.y = cameraYaw;
    }
  }
}

export interface Stop {
  id: string;
  name: string;
  x: number;
  y: number;
  z: number;
}

/** The shuttle's stops: a sign, and the little bus that waits there. */
export function buildStops(stops: readonly Stop[], castShadow: boolean): THREE.Group {
  const group = new THREE.Group();
  group.name = 'stops';
  const material = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });
  for (const stop of stops) {
    const list: Block[] = [
      // The sign.
      { size: [0.12, 2.6, 0.12], at: [0, 1.3, 0], colour: 0x4d5666 },
      { size: [0.9, 0.6, 0.08], at: [0, 2.5, 0], colour: 0x2b62c9 },
      { size: [0.5, 0.26, 0.1], at: [0, 2.5, 0], colour: 0xf4f1ea },
      // The bus: cream with a red stripe, as old ski shuttles were.
      { size: [2.3, 1.9, 5.6], at: [3.4, 1.4, 0], colour: 0xf1e8d6 },
      { size: [2.34, 0.34, 5.64], at: [3.4, 1.0, 0], colour: 0xc2412d },
      { size: [2.1, 0.12, 5.2], at: [3.4, 2.4, 0], colour: 0xd9d2c0 },
      { size: [2.32, 0.6, 4.6], at: [3.4, 1.75, -0.2], colour: 0x3d4a5e },
      ...[-1.7, 1.7].flatMap((z): Block[] => [-1, 1].map((sx): Block => ({ size: [0.3, 0.8, 0.8], at: [3.4 + sx * 1.1, 0.4, z], colour: 0x1c1c20 }))),
    ];
    const mesh = new THREE.Mesh(blocks(list), material);
    mesh.position.set(stop.x, stop.y - 0.1, stop.z);
    mesh.castShadow = castShadow;
    mesh.matrixAutoUpdate = false;
    mesh.updateMatrix();
    group.add(mesh);
  }
  return group;
}
