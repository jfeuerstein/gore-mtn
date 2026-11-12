import * as THREE from 'three/webgpu';
import type { Season } from '../look/season';
import { planted, ridePose, SEATED, skiPose, STANDING, walkPose, type Pose } from '../player/pose';
import type { Outfit } from '../player/skier';
import { buildGliders, buildRuns, buildSeats, buildWalkers, gliderAt, routePoint, streetSide, walkerAt, type Glider, type Route, type Run, type Seat, type Walker } from './crowd';
import { figureGeometry } from './figure';
import { carDistance, riderAlong, type LiftPath } from './lifts';
import type { World } from './world';
import { lit } from '../look/material';

/** The same scale the player is drawn at. */
const SCALE = 0.75;
/** Skiers and chair riders further than this from the player are not drawn, in metres; nor are walkers beyond theirs. */
const SKIER_RANGE = 1100;
const RIDER_RANGE = 800;
const WALKER_RANGE = 260;
/** Someone out walking stops for whoever is standing this close in front of them. */
const GIVE_WAY = 1.7;
/** Pictures in a stride, and the ground one stride covers, in metres. */
const STRIDE_FRAMES = 6;
const STRIDE = 1.7;

// Quieter than the player's red jacket, which stays the brightest thing on the hill.
const SLOPE_WEAR: readonly Outfit[] = [
  { jacket: 0x3a9aa0, trousers: 0x23282f, hat: 0xe2c050, style: 'beanie' },
  { jacket: 0x8068b0, trousers: 0x4a4f58, hat: 0xe8e4dc, style: 'helmet' },
  { jacket: 0xd4a84a, trousers: 0x2b3a55, hat: 0x4468a0, style: 'beanie' },
];
const CHAIR_WEAR: readonly Outfit[] = [{ jacket: 0x5a86c0, trousers: 0x2a2e36, hat: 0xd8d2c6, style: 'beanie' }];
/**
 * Each figure is washed over with one of these, so that a few outfits look like a crowd: the
 * colour multiplies everything the figure wears, and is kept pale so that faces stay faces.
 */
const WASHES: readonly number[] = [0xffffff, 0xd8e4ff, 0xffe0d0, 0xdcf2d8, 0xfff0c4, 0xe8d8f4];
// The town walks in coats and its own hair, not goggles.
const TOWN_WEAR: readonly Outfit[] = [
  { jacket: 0x5a6f8a, trousers: 0x3a3430, hat: 0x8a4a3a, style: 'beanie', features: { hair: 0x5a4636, hairStyle: 'long' } },
  { jacket: 0x8a6a4a, trousers: 0x2b3a55, hat: 0x4a5a48, style: 'cap', features: { hair: 0xb9b4ac, moustache: 0xb9b4ac, girth: 1.08 } },
  { jacket: 0x6a7f5a, trousers: 0x4a3a2e, hat: 0xd9c9a8, style: 'beanie', features: { hair: 0x2a2420, hairStyle: 'bun', glasses: true } },
  { jacket: 0x7a5a7a, trousers: 0x2a2e36, hat: 0x2a2e36, style: 'trapper', features: { beard: 0x6b4a33, height: 1.05 } },
];

/** Which of a few outfits a 0..1 roll picks. */
const pick = (wears: number, n: number): number => Math.min(n - 1, Math.floor(wears * n));

interface Strolling {
  walker: Walker;
  mesh: THREE.Mesh;
  frames: THREE.BufferGeometry[];
  stood: THREE.BufferGeometry;
  /** Seconds they have been held up, giving way: their own clock runs that far behind. */
  held: number;
  yaw: number;
}

/**
 * The crowd, drawn: the other skiers (or riders) on the trails and the people on the chairs as a
 * few instanced meshes for the whole mountain, and the town's walkers as a mesh each, stepped
 * through a handful of pictures of a stride. See `crowd.ts` for where each of them is.
 */
export class Crowd {
  readonly group = new THREE.Group();
  /** How many of each are being drawn just now, for the tools. */
  readonly shown = { skiers: 0, riders: 0, walkers: 0 };
  private readonly runs: Run[];
  private readonly gliders: Glider[];
  private readonly seats: Seat[];
  private readonly skiers: THREE.InstancedMesh[] = [];
  /** How many ways each outfit on the trails is held: a mesh to each. */
  private readonly ways: number;
  private readonly riders: THREE.InstancedMesh[] = [];
  private readonly street: Route | null;
  private readonly strolling: Strolling[] = [];
  private readonly m = new THREE.Matrix4();
  private readonly q = new THREE.Quaternion();
  private readonly lean = new THREE.Quaternion();
  private readonly p = new THREE.Vector3();
  private readonly s = new THREE.Vector3();
  private readonly up = new THREE.Vector3(0, 1, 0);
  private readonly ahead = new THREE.Vector3(0, 0, 1);
  private readonly wash = new THREE.Color();
  /** The skier nearest the player just now, for the tools. */
  nearest: { x: number; z: number; yaw: number } | null = null;
  /** Where the town's walkers are, for the tools. */
  readonly strollers: { x: number; z: number }[] = [];

  /**
   * @param ride what people come down the trails on this season
   * @param town a point in the middle of town, and how far from it people walk
   */
  constructor(
    world: World,
    private readonly paths: readonly LiftPath[],
    private readonly heightAt: (x: number, z: number) => number,
    season: Season,
    ride: 'skis' | 'bike',
    shadows: boolean,
    town: { x: number; z: number; reach: number } | null,
  ) {
    this.group.name = 'crowd';
    const material = lit({ vertexColors: true, flatShading: true });
    this.runs = buildRuns(world.trails, heightAt);
    // Fewer are out on bikes than on skis.
    this.gliders = buildGliders(this.runs).filter((g) => ride === 'skis' || g.keen < 0.5);
    this.seats = buildSeats(paths);
    // On skis each outfit is held in three ways (skiing, and touching the left pole or the right
    // to the snow between turns), a mesh to each, so the hill is not all one statue. A bike has one.
    const held: readonly ((stance: Pose) => Pose)[] = ride === 'bike' ? [(p) => p] : [(p) => p, (p) => planted(p, -1, 1), (p) => planted(p, 1, 1)];
    this.ways = held.length;
    const fleet = (wear: readonly Outfit[], cast: boolean, count: (k: number) => number, make: (o: Outfit, way: number) => THREE.BufferGeometry, ways = 1): THREE.InstancedMesh[] =>
      wear.flatMap((outfit, k) => Array.from({ length: ways }, (_, way) => ({ outfit, k, way }))).map(({ outfit, k, way }) => {
        const mesh = new THREE.InstancedMesh(make(outfit, way), material, Math.max(1, count(k)));
        mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
        // Its instances are all over the mountain; there is nothing to be gained by testing the one box round them.
        mesh.frustumCulled = false;
        mesh.castShadow = cast;
        // A wash for each place in the mesh. Who is drawn in which place changes from frame to
        // frame, so the washes are set again with the places (see `update`).
        for (let i = 0; i < mesh.count; i++) mesh.setColorAt(i, this.wash.setHex(WASHES[0] as number));
        mesh.count = 0;
        this.group.add(mesh);
        return mesh;
      });
    this.skiers = fleet(
      SLOPE_WEAR,
      shadows,
      (k) => this.gliders.filter((g) => pick(g.wears, SLOPE_WEAR.length) === k).length,
      (o, way) => (ride === 'bike' ? figureGeometry(o, ridePose(0.9, 0, 0.15, 0), 'bike') : figureGeometry(o, (held[way] as (stance: Pose) => Pose)(skiPose(0.12, 0)), 'skis', true)),
      held.length,
    );
    // Whoever rides up in the snow months has their skis on; a bike goes up on the back of the chair, out of sight.
    const onSnow = season === 'winter' || season === 'spring';
    // The chairs throw the shadows on the lift line; the people on them need not.
    this.riders = fleet(
      CHAIR_WEAR,
      false,
      (k) => this.seats.filter((s) => pick(s.wears, CHAIR_WEAR.length) === k).length,
      (o) => figureGeometry(o, SEATED, onSnow ? 'skis' : 'none', true),
    );

    // The town's walkers keep to the stretch of Main Street that has doors on it.
    this.street = town ? streetSide(world.roads, 'Main Street') : null;
    if (this.street && town) {
      let from = Infinity;
      let to = -Infinity;
      for (let d = 0; d <= this.street.length; d += 5) {
        const at = routePoint(this.street, d);
        if (Math.hypot(at.x - town.x, at.z - town.z) > town.reach) continue;
        from = Math.min(from, d);
        to = Math.max(to, d);
      }
      if (to - from > 60) {
        for (const walker of buildWalkers(TOWN_WEAR.length, from, to)) {
          const outfit = TOWN_WEAR[pick(walker.wears, TOWN_WEAR.length)] as Outfit;
          const frames = Array.from({ length: STRIDE_FRAMES }, (_, i) => figureGeometry(outfit, walkPose((i / STRIDE_FRAMES) * Math.PI * 2, 0.85)));
          const stood = figureGeometry(outfit, { ...STANDING, shoulderL: 0.12, shoulderR: 0.12, elbow: 0.4 });
          const mesh = new THREE.Mesh(stood, material);
          mesh.scale.setScalar(SCALE);
          mesh.castShadow = shadows;
          mesh.visible = false;
          this.group.add(mesh);
          this.strolling.push({ walker, mesh, frames, stood, held: 0, yaw: 0 });
        }
      }
    }
  }

  /**
   * Put everyone where they are at this moment.
   * @param clock the lift clock, in seconds, which the chairs run on too
   * @param busy how busy the mountain is, 0..1: nobody is out in the dark
   */
  update(clock: number, dt: number, player: { x: number; z: number }, busy: number): void {
    // The skiers, each on their own run.
    const counts = this.skiers.map(() => 0);
    this.nearest = null;
    let nearest = Infinity;
    for (const g of this.gliders) {
      if (g.keen > busy) continue;
      const run = this.runs[g.run] as Run;
      const now = gliderAt(run, g, clock);
      if (!now || now.size <= 0) continue;
      if (Math.abs(now.x - player.x) > SKIER_RANGE || Math.abs(now.z - player.z) > SKIER_RANGE) continue;
      // Their outfit, and how they are holding themselves just now.
      const k = pick(g.wears, this.skiers.length / this.ways) * this.ways + (this.ways > 1 ? (now.plant < 0 ? 1 : now.plant > 0 ? 2 : 0) : 0);
      this.q.setFromAxisAngle(this.up, now.yaw);
      // Tipped into the turn, about the way they are facing.
      this.q.multiply(this.lean.setFromAxisAngle(this.ahead, -now.lean));
      this.p.set(now.x, this.heightAt(now.x, now.z), now.z);
      const mesh = this.skiers[k] as THREE.InstancedMesh;
      mesh.setMatrixAt(counts[k] as number, this.m.compose(this.p, this.q, this.s.setScalar(SCALE * now.size)));
      mesh.setColorAt(counts[k] as number, this.wash.setHex(WASHES[pick(g.lead / (Math.PI * 2), WASHES.length)] as number));
      counts[k] = (counts[k] as number) + 1;
      const far = Math.hypot(now.x - player.x, now.z - player.z);
      if (far < nearest) {
        nearest = far;
        this.nearest = { x: now.x, z: now.z, yaw: now.yaw };
      }
    }
    this.shown.skiers = 0;
    this.skiers.forEach((mesh, k) => {
      mesh.count = counts[k] as number;
      mesh.visible = mesh.count > 0;
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      this.shown.skiers += mesh.count;
    });

    // The people on the chairs, placed from the same clock as the chairs under them.
    const seated = this.riders.map(() => 0);
    for (const seat of this.seats) {
      if (seat.keen > busy) continue;
      const path = this.paths[seat.lift] as LiftPath;
      const d = carDistance(path, seat.slot, clock);
      if (d > path.length) continue;
      const at = riderAlong(path, d);
      if (Math.abs(at.x - player.x) > RIDER_RANGE || Math.abs(at.z - player.z) > RIDER_RANGE) continue;
      const k = pick(seat.wears, this.riders.length);
      this.p.set(at.x + Math.cos(at.yaw) * seat.aside, at.y, at.z - Math.sin(at.yaw) * seat.aside);
      this.q.setFromAxisAngle(this.up, at.yaw);
      const mesh = this.riders[k] as THREE.InstancedMesh;
      mesh.setMatrixAt(seated[k] as number, this.m.compose(this.p, this.q, this.s.setScalar(SCALE)));
      mesh.setColorAt(seated[k] as number, this.wash.setHex(WASHES[pick(seat.keen, WASHES.length)] as number));
      seated[k] = (seated[k] as number) + 1;
    }
    this.shown.riders = 0;
    this.riders.forEach((mesh, k) => {
      mesh.count = seated[k] as number;
      mesh.visible = mesh.count > 0;
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      this.shown.riders += mesh.count;
    });

    // The town, out for a walk. They are in by dark, like everyone else.
    this.shown.walkers = 0;
    this.strollers.length = 0;
    const street = this.street;
    if (!street) return;
    for (const st of this.strolling) {
      const now = walkerAt(st.walker, clock - st.held);
      const at = routePoint(street, now.distance);
      this.strollers.push(at);
      const dx = player.x - at.x;
      const dz = player.z - at.z;
      const far = Math.hypot(dx, dz);
      st.mesh.visible = busy > 0 && far < WALKER_RANGE;
      if (!st.mesh.visible) continue;
      this.shown.walkers++;
      // The way the street runs here, for the way they are going along it.
      const a = routePoint(street, now.distance - 1);
      const b = routePoint(street, now.distance + 1);
      const along = Math.atan2(-(b.x - a.x), -(b.z - a.z));
      // Stood at an end, they turn to go back the way they came.
      let want = now.heading === 0 ? along + (now.end === 1 ? Math.PI : 0) : along + (now.heading === -1 ? Math.PI : 0);
      let walking = now.heading !== 0;
      // Someone in the way: stop, and look at them, until they move.
      if (walking && far < GIVE_WAY) {
        st.held += dt;
        walking = false;
        want = Math.atan2(-dx, -dz);
      }
      const turn = Math.atan2(Math.sin(want - st.yaw), Math.cos(want - st.yaw));
      st.yaw += turn * Math.min(1, dt * 5);
      const frame = Math.floor((now.walked / STRIDE) * STRIDE_FRAMES) % STRIDE_FRAMES;
      const geometry = walking ? (st.frames[frame] as THREE.BufferGeometry) : st.stood;
      if (st.mesh.geometry !== geometry) st.mesh.geometry = geometry;
      st.mesh.position.set(at.x, this.heightAt(at.x, at.z), at.z);
      st.mesh.rotation.y = st.yaw;
    }
  }
}
