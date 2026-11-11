import * as THREE from 'three/webgpu';
import type { Sighting } from '../game/wildlife';
import type { Season } from '../look/season';
import { critterGeometry } from './critterModels';

/** Creatures further than this from the player are not drawn, in metres. */
const DRAW_RANGE = 280;
/** Seconds a startled creature takes to run or fly off and vanish. */
const FLEE_TIME = 2.4;
/** A plant that has been looked at stays where it is until the player is this far away. */
const LINGER_RANGE = 450;
/** Most markers on show at once. */
const MARKS = 128;

interface Critter {
  sighting: Sighting;
  mesh: THREE.Mesh;
  /** Height of the model, for placing the marker over it. */
  tall: number;
  ground: number;
  yaw: number;
  /** True while it has not yet been entered in the field guide. */
  fresh: boolean;
  /** Seconds since it was startled, or -1 while it is at ease. */
  fleeing: number;
  fleeX: number;
  fleeZ: number;
  /** Seen, and staying put: a plant, or a snowman. */
  lingering: boolean;
}

/** A small upright diamond, to mark something not yet in the guide. */
function markGeometry(): THREE.BufferGeometry {
  const w = 0.16;
  const h = 0.34;
  const positions = [0, h, 0, -w, 0, 0, w, 0, 0, 0, -h, 0, w, 0, 0, -w, 0, 0];
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.computeVertexNormals();
  return geo;
}

/**
 * The wildlife and plants near the player. Each is one small mesh, built from the species' model
 * and shared material; only those within a patch or so exist, and only the near ones are drawn.
 * Creatures look about while at ease, and run or fly off when startled or once they have been
 * seen. Anything not yet in the field guide carries a pale marker so it can be told from afar.
 */
export class Critters {
  readonly group = new THREE.Group();
  private readonly material = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });
  private readonly marks: THREE.InstancedMesh;
  private readonly live = new Map<string, Critter>();
  private shown: readonly Sighting[] | null = null;
  private time = 0;

  constructor(
    private readonly season: Season,
    private readonly castShadow: boolean,
  ) {
    this.group.name = 'critters';
    // Unlit, so it shows at night; pale blue, so it is not mistaken for a stone's gold.
    this.marks = new THREE.InstancedMesh(markGeometry(), new THREE.MeshBasicMaterial({ color: 0xbfe9ff, side: THREE.DoubleSide }), MARKS);
    this.marks.name = 'critter-marks';
    this.marks.count = 0;
    this.marks.visible = false;
    this.marks.frustumCulled = false;
    this.marks.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.group.add(this.marks);
  }

  /** How many are on the mountain near the player just now. */
  get count(): number {
    return this.live.size;
  }

  /**
   * Show these sightings. Cheap to call every frame: nothing happens unless the list is a new one.
   * @param heightAt the ground they stand on
   * @param fresh whether a species has yet to be entered in the field guide
   */
  show(sightings: readonly Sighting[], heightAt: (x: number, z: number) => number, fresh: (speciesId: string) => boolean): void {
    if (sightings === this.shown) return;
    this.shown = sightings;
    const wanted = new Set(sightings.map((s) => s.id));
    for (const [id, c] of this.live) {
      // Those running off finish their run; those looked at and left in place stay a while.
      if (!wanted.has(id) && c.fleeing < 0 && !c.lingering) this.remove(id, c);
    }
    for (const s of sightings) {
      const have = this.live.get(s.id);
      if (have) {
        have.fresh = fresh(s.species.id);
        continue;
      }
      const geometry = critterGeometry(s.species.id, this.season);
      if (!geometry.boundingBox) geometry.computeBoundingBox();
      const mesh = new THREE.Mesh(geometry, this.material);
      const ground = heightAt(s.x, s.z);
      const yaw = s.roll * Math.PI * 2;
      mesh.position.set(s.x, ground, s.z);
      mesh.rotation.y = yaw;
      mesh.castShadow = this.castShadow;
      this.group.add(mesh);
      this.live.set(s.id, {
        sighting: s,
        mesh,
        tall: geometry.boundingBox?.max.y ?? 1,
        ground,
        yaw,
        fresh: fresh(s.species.id),
        fleeing: -1,
        fleeX: 0,
        fleeZ: 0,
        lingering: false,
      });
    }
  }

  private remove(id: string, c: Critter): void {
    this.group.remove(c.mesh);
    this.live.delete(id);
  }

  /** A creature has been startled, or seen and is off: it runs or flies away from a position. */
  flee(sighting: Sighting, fromX: number, fromZ: number): void {
    const c = this.live.get(sighting.id);
    if (!c || c.fleeing >= 0) return;
    const dx = sighting.x - fromX;
    const dz = sighting.z - fromZ;
    const d = Math.hypot(dx, dz) || 1;
    c.fleeing = 0;
    c.fleeX = dx / d;
    c.fleeZ = dz / d;
    c.fresh = false;
  }

  /** Something that does not run (a plant, a snowman) has been seen: it stays, without its marker. */
  settle(sighting: Sighting): void {
    const c = this.live.get(sighting.id);
    if (!c) return;
    c.lingering = true;
    c.fresh = false;
  }

  /** @param cameraYaw so the markers face the camera */
  update(dt: number, player: { x: number; z: number }, cameraYaw: number, heightAt: (x: number, z: number) => number): void {
    this.time += dt;
    const t = this.time;
    const marks = this.marks.instanceMatrix.array;
    const cos = Math.cos(cameraYaw);
    const sin = Math.sin(cameraYaw);
    let marked = 0;
    for (const [id, c] of this.live) {
      const { mesh, sighting } = c;
      const kin = sighting.species.kin;
      const dist = Math.hypot(mesh.position.x - player.x, mesh.position.z - player.z);
      if (c.lingering && dist > LINGER_RANGE) {
        this.remove(id, c);
        continue;
      }
      mesh.visible = dist < DRAW_RANGE;
      if (c.fleeing >= 0) {
        c.fleeing += dt;
        const k = c.fleeing / FLEE_TIME;
        if (k >= 1) {
          this.remove(id, c);
          continue;
        }
        // Birds take to the air; everything else bounds away over the ground.
        const speed = kin === 'bird' ? 11 : 9;
        mesh.position.x += c.fleeX * speed * dt;
        mesh.position.z += c.fleeZ * speed * dt;
        const ground = heightAt(mesh.position.x, mesh.position.z);
        mesh.position.y = kin === 'bird' ? ground + c.fleeing * 5 : ground + Math.abs(Math.sin(c.fleeing * 11)) * 0.5;
        mesh.rotation.y = Math.atan2(-c.fleeX, -c.fleeZ);
        mesh.scale.setScalar(k > 0.7 ? Math.max(0.01, 1 - (k - 0.7) / 0.3) : 1);
        continue;
      }
      if (!mesh.visible) continue;
      const phase = sighting.roll * 40;
      if (kin === 'animal' || kin === 'bird') {
        // At ease: looking about, with a hop now and then for a bird and a bob for anything afloat.
        mesh.rotation.y = c.yaw + Math.sin(t * 0.5 + phase) * 0.5;
        const hop = kin === 'bird' ? Math.max(0, Math.sin(t * 2.3 + phase)) ** 8 * 0.3 : 0;
        mesh.position.y = c.ground + hop + (sighting.species.haunts.water ? Math.sin(t * 1.4 + phase) * 0.04 : 0);
      }
      if (c.fresh && marked < MARKS) {
        const o = marked++ * 16;
        const size = 0.9 + 0.2 * Math.sin(t * 2.6 + phase);
        marks[o] = cos * size;
        marks[o + 1] = 0;
        marks[o + 2] = -sin * size;
        marks[o + 3] = 0;
        marks[o + 4] = 0;
        marks[o + 5] = size;
        marks[o + 6] = 0;
        marks[o + 7] = 0;
        marks[o + 8] = sin * size;
        marks[o + 9] = 0;
        marks[o + 10] = cos * size;
        marks[o + 11] = 0;
        marks[o + 12] = mesh.position.x;
        marks[o + 13] = mesh.position.y + c.tall + 0.55 + Math.sin(t * 1.9 + phase) * 0.06;
        marks[o + 14] = mesh.position.z;
        marks[o + 15] = 1;
      }
    }
    this.marks.count = marked;
    this.marks.visible = marked > 0;
    if (marked > 0) this.marks.instanceMatrix.needsUpdate = true;
  }
}
