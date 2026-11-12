import * as THREE from 'three/webgpu';
import { CAIRN_TALL, secretById, type Secret, type SecretKind } from '../game/secrets';
import { lit } from '../look/material';
import type { Season } from '../look/season';
import type { SecretSite } from './secretSites';
import { blocks, placed, type Block } from './shapes';

const BARK = 0x5a3f2c;
const TIMBER = 0x7a5236;
const TIN = 0x7c8794;
const BRASS = 0xc98f1f;
const STONE = 0x7c8794;
const DARK = 0x2a2e36;
const RUST = 0x9a4a2a;
const GARNET = 0x8f2f2a;
/** A course so tall that whatever is given it has none: iron, tin and stone are smooth, not boarded. */
const SMOOTH = 1e6;
/** How far a thing that meets the ground goes on down below it, so that a slope leaves no gap. */
const DEEP = 2.5;
const sunk = (size: [number, number, number], at: [number, number, number], colour: number, more: Partial<Block> = {}): Block => ({ size: [size[0], size[1] + DEEP, size[2]], at: [at[0], at[1] - DEEP / 2, at[2]], colour, ...more });

/** A geometry in one colour, to be joined with blocks. */
function tinted(geo: THREE.BufferGeometry, colour: number): THREE.BufferGeometry {
  const flat = geo.index ? geo.toNonIndexed() : geo;
  flat.computeVertexNormals();
  const c = new THREE.Color(colour);
  flat.setAttribute('color', new THREE.Float32BufferAttribute(Array.from({ length: flat.getAttribute('position').count }, () => [c.r, c.g, c.b]).flat(), 3));
  return flat;
}

/** What each kind of secret looks like, its front at its own +z. A room has nothing of its own: it is a door. */
function model(secret: Secret, season: Season): { list: Block[]; extra: THREE.BufferGeometry[] } {
  const list: Block[] = [];
  const extra: THREE.BufferGeometry[] = [];
  if (secret.kind === 'register') {
    // A tin box on a post, with a lid that slopes to shed the rain.
    list.push(sunk([0.14, 1.15, 0.14], [0, 0.575, 0], BARK), { size: [0.52, 0.34, 0.36], at: [0, 1.3, 0.02], colour: TIN }, { size: [0.6, 0.05, 0.46], at: [0, 1.5, 0.04], colour: DARK, tip: 0.22 }, { size: [0.3, 0.12, 0.02], at: [0, 1.3, 0.21], colour: 0xfbf8ee });
  } else if (secret.kind === 'plaque') {
    // A brass plate on a short post, tipped back to be read, with three lines of lettering.
    list.push(sunk([0.12, 0.7, 0.12], [0, 0.35, 0], BARK), { size: [0.66, 0.44, 0.05], at: [0, 0.86, 0.06], colour: BRASS, tip: -0.5 });
    for (let i = 0; i < 3; i++) list.push({ size: [i === 0 ? 0.4 : 0.5, 0.035, 0.02], at: [0, 0.96 - i * 0.1, 0.13 - i * 0.05], colour: DARK, tip: -0.5 });
  } else if (secret.kind === 'cairn') {
    // Only the flat stone the first one is set on: the stones themselves are the player's, and are drawn as they are added.
    list.push({ size: [1.0, 0.16, 0.9], at: [0, 0.04, 0], colour: STONE, turn: 0.4 });
  } else if (secret.kind === 'bell') {
    // A ship's bell hung in a timber frame, with a rope to ring it by.
    for (const sx of [-0.6, 0.6]) list.push(sunk([0.16, 2.1, 0.16], [sx, 1.05, 0], TIMBER));
    list.push({ size: [1.6, 0.16, 0.2], at: [0, 2.15, 0], colour: TIMBER }, { size: [0.05, 0.3, 0.05], at: [0, 1.95, 0], colour: DARK }, { size: [0.03, 0.7, 0.03], at: [0.02, 1.25, 0.02], colour: 0xe2c99a });
    extra.push(placed(tinted(new THREE.CylinderGeometry(0.13, 0.3, 0.4, 8), 0x7fa9b8), 0, 1.62, 0), placed(tinted(new THREE.CylinderGeometry(0.33, 0.33, 0.05, 8), 0x7fa9b8), 0, 1.42, 0));
  } else if (secret.id === 'working-adit') {
    // The mouth of a tunnel: two posts and a lintel, the dark going back into the hill, garnet in the walls, and an ore cart on its rails.
    for (const sx of [-1.15, 1.15]) list.push(sunk([0.32, 2.3, 0.32], [sx, 1.15, 0], TIMBER));
    list.push({ size: [2.9, 0.34, 0.4], at: [0, 2.45, 0], colour: TIMBER }, sunk([2.0, 2.3, 4], [0, 1.15, -2.15], DARK), sunk([3.4, 3.0, 3.6], [0, 1.5, -2.6], STONE));
    const glints: [number, number][] = [[-0.9, 0.5], [-0.82, 1.3], [-0.7, 1.9], [0.88, 0.8], [0.8, 1.6], [0.6, 2.05], [-0.3, 2.1], [0.92, 0.3]];
    glints.forEach(([x, y], i) => list.push({ size: [0.14, 0.14, 0.1], at: [x, y, -0.2 - (i % 3) * 0.5], colour: i % 2 ? GARNET : 0xc8402d, turn: 0.7 }));
    for (const sx of [-0.35, 0.35]) list.push({ size: [0.07, 0.07, 5], at: [sx, 0.06, 1.2], colour: RUST });
    list.push({ size: [0.9, 0.5, 1.3], at: [0, 0.55, 2.4], colour: RUST }, { size: [0.7, 0.14, 1.0], at: [0, 0.86, 2.4], colour: GARNET });
    for (const sz of [1.95, 2.85]) list.push({ size: [0.95, 0.3, 0.3], at: [0, 0.2, sz], colour: DARK });
  } else if (secret.id === 'working-cellar') {
    // Four walls of fieldstone with no house on them, and the apple tree by the door that is not there.
    for (const [x, z, w, d] of [[0, -2.1, 4.8, 0.55], [0, 2.1, 1.6, 0.55], [-1.9, 2.1, 1.0, 0.55], [1.9, 2.1, 1.0, 0.55], [-2.15, 0, 0.55, 4.2], [2.15, 0, 0.55, 4.2]] as const) list.push(sunk([w, 0.75, d], [x, 0.375, z], STONE));
    list.push({ size: [0.9, 0.12, 0.7], at: [-1.3, 0.1, -1.4], colour: 0xa9b3c0, turn: 0.3 }, sunk([0.3, 2.0, 0.3], [3.4, 1.0, 2.6], BARK));
    if (season === 'winter') {
      for (const [a, len] of [[0.5, 1.3], [-0.6, 1.1], [0.1, 1.5]] as const) list.push({ size: [0.1, len, 0.1], at: [3.4 + Math.sin(a) * 0.5, 2.5, 2.6], colour: BARK, tip: 0, turn: a });
    } else {
      const leaf = season === 'fall' ? 0xc98f1f : 0x4f8a3f;
      list.push({ size: [2.2, 1.5, 2.2], at: [3.4, 2.7, 2.6], colour: leaf }, { size: [1.4, 0.8, 1.4], at: [3.6, 3.6, 2.4], colour: leaf });
      if (season !== 'spring') for (const [x, y, z] of [[2.5, 2.4, 3.4], [4.2, 2.9, 2.2], [3.3, 2.1, 3.75]] as const) list.push({ size: [0.2, 0.2, 0.2], at: [x, y, z], colour: 0xc8402d });
    }
  } else if (secret.id === 'working-rope-tow') {
    // A truck engine on a sled, a wheel as tall as a person, and a post the rope ran up to.
    for (const sx of [-0.7, 0.7]) list.push({ size: [0.2, 0.2, 3.2], at: [sx, 0.1, 0], colour: TIMBER });
    list.push({ size: [1.3, 0.85, 1.0], at: [0, 0.65, -0.6], colour: RUST }, { size: [0.9, 0.3, 0.6], at: [0, 1.2, -0.6], colour: DARK }, { size: [0.08, 0.9, 0.08], at: [0.75, 0.8, 0.5], colour: DARK, tip: 0.3 }, { size: [0.34, 0.5, 0.12], at: [0.76, 1.05, 0.62], colour: 0xb3472d });
    const wheel = tinted(new THREE.CylinderGeometry(0.95, 0.95, 0.14, 12), DARK);
    wheel.rotateZ(Math.PI / 2);
    extra.push(placed(wheel, -0.2, 1.05, 0.75), placed(tinted(new THREE.CylinderGeometry(0.2, 0.2, 0.2, 8).rotateZ(Math.PI / 2), RUST), -0.2, 1.05, 0.75));
    list.push(sunk([0.24, 3.4, 0.24], [-0.2, 1.7, 7], BARK), { size: [0.5, 0.5, 0.1], at: [-0.2, 3.2, 7.15], colour: DARK }, { size: [0.05, 0.05, 6.4], at: [-0.2, 2.5, 3.9], colour: 0xe2c99a, tip: -0.2 });
  }
  return { list, extra };
}

/** How close the player must come to a secret for it to be offered, by kind, in metres. */
const REACH: Record<SecretKind, number> = { register: 3, plaque: 3, working: 6.5, room: 3.6, cairn: 3.2, bell: 3 };
/** How far trees are kept back from one, in metres. */
const CLEAR: Record<SecretKind, number> = { register: 3.5, plaque: 2.5, working: 8, room: 0, cairn: 4, bell: 4.5 };

/**
 * The mountain's secrets as they stand in the world: every one of them joined into one mesh
 * (a few thousand triangles for the whole mountain, like the sign posts), and the stones of
 * the cairns as one more, since those are the player's and grow.
 */
export class SecretThings {
  readonly group = new THREE.Group();
  private readonly stones: THREE.InstancedMesh;
  private readonly cairns: { id: string; x: number; y: number; z: number; count: number }[] = [];
  private readonly placedAt: { site: SecretSite; secret: Secret }[] = [];

  constructor(sites: readonly SecretSite[], heightAt: (x: number, z: number) => number, season: Season, shadows: boolean) {
    this.group.name = 'secrets';
    const pieces: THREE.BufferGeometry[] = [];
    for (const site of sites) {
      const secret = secretById(site.id);
      if (!secret) continue;
      this.placedAt.push({ site, secret });
      const y = heightAt(site.x, site.z);
      if (secret.kind === 'cairn') this.cairns.push({ id: secret.id, x: site.x, y, z: site.z, count: 0 });
      const { list, extra } = model(secret, season);
      if (list.length + extra.length > 0) pieces.push(placed(blocks(list, extra, SMOOTH), site.x, y, site.z, site.turn));
    }
    const mesh = new THREE.Mesh(blocks([], pieces, SMOOTH), lit({ vertexColors: true, flatShading: true }));
    mesh.castShadow = shadows;
    mesh.receiveShadow = true;
    mesh.matrixAutoUpdate = false;
    this.group.add(mesh);
    // A stone: a lump with flat faces, each its own tone.
    const lump = new THREE.DodecahedronGeometry(0.17, 0).toNonIndexed();
    lump.computeVertexNormals();
    this.stones = new THREE.InstancedMesh(lump, lit({ color: 0xffffff, flatShading: true }), Math.max(1, this.cairns.length * CAIRN_TALL));
    this.stones.count = 0;
    this.stones.castShadow = shadows;
    this.stones.frustumCulled = false;
    this.group.add(this.stones);
  }

  /** The secret within reach of a point, the nearest if there are two. */
  near(x: number, z: number): { site: SecretSite; secret: Secret } | null {
    let best: { site: SecretSite; secret: Secret } | null = null;
    let least = Infinity;
    for (const at of this.placedAt) {
      const d = Math.hypot(at.site.x - x, at.site.z - z);
      if (d < REACH[at.secret.kind] && d < least) {
        least = d;
        best = at;
      }
    }
    return best;
  }

  /** True where a tree would stand in the way of one. */
  clears(x: number, z: number): boolean {
    for (const at of this.placedAt) if (Math.abs(at.site.x - x) < 9 && Math.hypot(at.site.x - x, at.site.z - z) < CLEAR[at.secret.kind]) return true;
    return false;
  }

  /** Where a secret stands, for the map. */
  where(id: string): SecretSite | undefined {
    return this.placedAt.find((p) => p.site.id === id)?.site;
  }

  /**
   * Pile the player's stones on the cairns: so many on each, in rings that draw in toward the
   * top, the same pile every time for the same number.
   */
  setStones(count: (id: string) => number): void {
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const e = new THREE.Euler();
    const p = new THREE.Vector3();
    const s = new THREE.Vector3();
    const c = new THREE.Color();
    let n = 0;
    for (const cairn of this.cairns) {
      const stones = Math.min(CAIRN_TALL, count(cairn.id));
      let level = 0;
      let inLevel = 0;
      for (let i = 0; i < stones; i++) {
        const room = Math.max(1, 6 - level);
        const a = (inLevel / room) * Math.PI * 2 + level * 0.7;
        const r = room === 1 ? 0 : 0.36 * (1 - level / 6.5);
        // Each a little its own size and a little turned, by where it comes in the pile.
        const size = 0.85 + ((i * 37) % 10) / 28;
        p.set(cairn.x + Math.sin(a) * r, cairn.y + 0.2 + level * 0.2, cairn.z + Math.cos(a) * r);
        q.setFromEuler(e.set(i * 1.3, i * 2.1, i * 0.7));
        this.stones.setMatrixAt(n, m.compose(p, q, s.set(size, size * 0.8, size)));
        this.stones.setColorAt(n, c.setHex([0xa9b3c0, 0x7c8794, 0xd3dae4, 0x9a7b5c][(i * 7) % 4] as number));
        n++;
        if (++inLevel >= room) {
          inLevel = 0;
          level++;
        }
      }
    }
    this.stones.count = n;
    this.stones.instanceMatrix.needsUpdate = true;
    if (this.stones.instanceColor) this.stones.instanceColor.needsUpdate = true;
  }
}
