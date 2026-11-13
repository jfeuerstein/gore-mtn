import * as THREE from 'three/webgpu';
import type { Heightfield } from './heightfield';
import { lit } from '../look/material';

/** A new stretch of trench is laid each time the skier has travelled this far, in metres. */
const STEP = 0.6;
/** Stretches kept before the oldest are overwritten: about 700 m of trench. */
const MAX_STEPS = 1200;
/** Corners in a stretch: five faces across (a bank, a wall, the floor, a wall, a bank), two triangles each. */
const CORNERS = 5 * 6;
/** Lumps of snow in the air at once. */
const LUMPS = 90;
/** How fast a thrown lump falls, in metres a second a second, and how long the longest is in the air. */
const FALL = 9;
const LONGEST = 1.1;

/**
 * The shade of a trench's floor against the snow round it, as a groove is in a print: a touch
 * down where the snow is shallow, and well down, and bluer, where it is deep.
 */
const SHALLOW = [0.86, 0.9, 0.97] as const;
const DEEP = [0.6, 0.69, 0.87] as const;

/**
 * Loose snow, as the skier meets it. The ground the game draws is the top of the snow, so a
 * trench cannot be dug into it; it is drawn as a print would draw one: the floor a tone
 * darker than the snow, and on each side the snow that was pushed out of it, banked up in a
 * ridge that catches the light. Deeper snow makes a wider trench with higher banks. And
 * what the skis throw up in a turn is thrown up: lumps that fly, fall and are gone.
 *
 * Two draw calls: the trench, and the lumps.
 */
export class Powder {
  readonly group = new THREE.Group();
  private readonly trench: THREE.Mesh;
  private readonly positions = new Float32Array(MAX_STEPS * CORNERS * 3);
  private readonly normals = new Float32Array(MAX_STEPS * CORNERS * 3);
  private readonly colours = new Float32Array(MAX_STEPS * CORNERS * 3).fill(1);
  private readonly colour: THREE.BufferAttribute;
  private readonly position: THREE.BufferAttribute;
  private readonly normal: THREE.BufferAttribute;
  private readonly trenchMaterial: THREE.Material & { color: THREE.Color };
  private head = 0;
  /** The last cross-section laid: six points, bank foot to bank foot. */
  private last: Float32Array | null = null;
  private lastX = 0;
  private lastZ = 0;

  private readonly lumps: THREE.InstancedMesh;
  private readonly lumpMaterial: THREE.Material & { color: THREE.Color };
  private readonly at = new Float32Array(LUMPS * 3);
  private readonly going = new Float32Array(LUMPS * 3);
  private readonly age = new Float32Array(LUMPS).fill(1);
  private readonly life = new Float32Array(LUMPS).fill(1);
  private readonly size = new Float32Array(LUMPS);
  private next = 0;
  private owed = 0;
  private readonly m = new THREE.Matrix4();
  private readonly q = new THREE.Quaternion();
  private readonly p = new THREE.Vector3();
  private readonly s = new THREE.Vector3();

  constructor(shadows: boolean) {
    this.group.name = 'powder';
    this.position = new THREE.BufferAttribute(this.positions, 3);
    this.position.setUsage(THREE.DynamicDrawUsage);
    this.normal = new THREE.BufferAttribute(this.normals, 3);
    this.normal.setUsage(THREE.DynamicDrawUsage);
    // The banks are snow; the floor's shade is set as each stretch is laid.
    this.colour = new THREE.BufferAttribute(this.colours, 3);
    this.colour.setUsage(THREE.DynamicDrawUsage);
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', this.position);
    geometry.setAttribute('normal', this.normal);
    geometry.setAttribute('color', this.colour);
    this.trenchMaterial = lit({ color: 0xffffff, vertexColors: true, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4 }) as THREE.Material & { color: THREE.Color };
    this.trench = new THREE.Mesh(geometry, this.trenchMaterial);
    this.trench.name = 'trench';
    this.trench.frustumCulled = false;
    this.trench.receiveShadow = true;
    // A lump of snow: a few flat faces, each its own tone.
    const lump = new THREE.IcosahedronGeometry(0.5, 0).toNonIndexed();
    lump.computeVertexNormals();
    this.lumpMaterial = lit({ color: 0xffffff, flatShading: true }) as THREE.Material & { color: THREE.Color };
    this.lumps = new THREE.InstancedMesh(lump, this.lumpMaterial, LUMPS);
    this.lumps.name = 'spray';
    this.lumps.frustumCulled = false;
    this.lumps.castShadow = shadows;
    this.lumps.count = 0;
    this.group.add(this.trench, this.lumps);
  }

  /** The colour of snow in this light, as the ground wears it. */
  setTint(colour: number): void {
    this.trenchMaterial.color.setHex(colour);
    this.lumpMaterial.color.setHex(colour);
  }

  /** Stop the trench, so the next stretch does not join up with it: skis off, a lift ride, a teleport, firm snow. */
  lift(): void {
    this.last = null;
  }

  /**
   * Extend the trench to where the skier is now. Call every frame while skiing in loose snow.
   * @param travel the way the skier is moving, as a yaw
   * @param half half the width of what the skis are sweeping, in metres: wider in a skid
   * @param depth how deep the loose snow is here, in metres
   */
  cut(x: number, z: number, travel: number, half: number, depth: number, hf: Heightfield): void {
    if (this.last && Math.hypot(x - this.lastX, z - this.lastZ) < STEP) return;
    const acrossX = Math.cos(travel);
    const acrossZ = -Math.sin(travel);
    // The floor is as wide as the skis sweep; the banks are higher and wider the deeper the snow.
    const floor = Math.max(0.3, half + 0.16);
    const bank = 0.2 + depth * 0.7;
    const crest = Math.min(0.24, depth * 0.6);
    const now = new Float32Array(18);
    // Across, in metres from the middle, and how high above the snow, bank foot to bank foot.
    const section: [number, number][] = [[-floor - bank, 0.02], [-floor - bank * 0.3, crest], [-floor, 0.035], [floor, 0.035], [floor + bank * 0.3, crest], [floor + bank, 0.02]];
    section.forEach(([off, up], i) => {
      const px = x + acrossX * off;
      const pz = z + acrossZ * off;
      now.set([px, hf.heightAt(px, pz) + up, pz], i * 3);
    });
    const prev = this.last;
    // A jump of more than a few steps means the skier was moved, not that they skied there.
    if (prev && Math.hypot(x - this.lastX, z - this.lastZ) < STEP * 8) {
      // Keep left on the left: if the direction of travel has swung right round, the section is the other way about.
      const swung = ((prev[15] as number) - (prev[0] as number)) * ((now[15] as number) - (now[0] as number)) + ((prev[17] as number) - (prev[2] as number)) * ((now[17] as number) - (now[2] as number)) < 0;
      if (swung) for (let i = 0; i < 3; i++) for (let k = 0; k < 3; k++) [now[i * 3 + k], now[(5 - i) * 3 + k]] = [now[(5 - i) * 3 + k] as number, now[i * 3 + k] as number];
      let o = (this.head % MAX_STEPS) * CORNERS * 3;
      const a = new THREE.Vector3();
      const b = new THREE.Vector3();
      const n = new THREE.Vector3();
      for (let face = 0; face < 5; face++) {
        const i = face * 3;
        const j = (face + 1) * 3;
        // The face between two points of the last section and the same two of this one.
        a.set((prev[j] as number) - (prev[i] as number), (prev[j + 1] as number) - (prev[i + 1] as number), (prev[j + 2] as number) - (prev[i + 2] as number));
        b.set((now[i] as number) - (prev[i] as number), (now[i + 1] as number) - (prev[i + 1] as number), (now[i + 2] as number) - (prev[i + 2] as number));
        n.crossVectors(a, b);
        // Listed so that it faces up, whichever way the skier is going, with the way it faces for the light.
        const up = n.y >= 0;
        if (!up) n.negate();
        n.normalize();
        const corners: [Float32Array, number][] = up ? [[prev, i], [prev, j], [now, i], [prev, j], [now, j], [now, i]] : [[prev, j], [prev, i], [now, i], [prev, j], [now, i], [now, j]];
        for (const [src, at] of corners) {
          this.positions[o] = src[at] as number;
          this.positions[o + 1] = src[at + 1] as number;
          this.positions[o + 2] = src[at + 2] as number;
          this.normals[o] = n.x;
          this.normals[o + 1] = n.y;
          this.normals[o + 2] = n.z;
          o += 3;
        }
      }
      // The floor is the third of the five faces: darker the deeper it was cut.
      const t = Math.min(1, depth / 0.32);
      const base = (this.head % MAX_STEPS) * CORNERS * 3;
      for (let corner = 12; corner < 18; corner++) for (let k = 0; k < 3; k++) this.colours[base + corner * 3 + k] = (SHALLOW[k] as number) + ((DEEP[k] as number) - (SHALLOW[k] as number)) * t;
      this.colour.needsUpdate = true;
      this.head++;
      this.position.needsUpdate = true;
      this.normal.needsUpdate = true;
    }
    this.last = now;
    this.lastX = x;
    this.lastZ = z;
  }

  /**
   * Throw snow up from where the skis are. Call every frame while skiing in loose snow.
   * @param speed metres a second
   * @param travel the way the skier is moving, as a yaw
   * @param slip the angle between the skis and the way they are moving: a skid throws the most
   * @param depth how deep the loose snow is here, in metres
   */
  throwUp(dt: number, x: number, y: number, z: number, speed: number, travel: number, slip: number, depth: number): void {
    if (speed < 3 || depth <= 0) return;
    const skid = Math.abs(Math.sin(slip));
    // A little all the time at speed, as a wake; a great deal broadside.
    this.owed += dt * Math.min(1, depth / 0.18) * (speed / 9) * (5 + skid * 46);
    const ahead = { x: -Math.sin(travel), z: -Math.cos(travel) };
    while (this.owed >= 1) {
      this.owed -= 1;
      const i = this.next;
      this.next = (this.next + 1) % LUMPS;
      // Out to one side or the other, and in a skid mostly the way the skier is going: that is where the snow is pushed.
      const side = Math.random() < 0.5 ? -1 : 1;
      const out = (0.6 + Math.random() * 1.6) * (1 - skid * 0.6) * side;
      const on = speed * (skid * (0.35 + Math.random() * 0.3) - (1 - skid) * 0.08);
      this.at.set([x + ahead.z * side * 0.3 + (Math.random() - 0.5) * 0.5, y + 0.1, z - ahead.x * side * 0.3 + (Math.random() - 0.5) * 0.5], i * 3);
      this.going.set([ahead.x * on + ahead.z * out, 1.4 + Math.random() * 2.2 + skid * speed * 0.12, ahead.z * on - ahead.x * out], i * 3);
      this.age[i] = 0;
      this.life[i] = LONGEST * (0.55 + Math.random() * 0.45);
      this.size[i] = (0.16 + Math.random() * 0.2) * (0.7 + Math.min(1, depth / 0.25) * 0.7);
    }
  }

  /** Move what is in the air. */
  update(dt: number): void {
    let live = 0;
    for (let i = 0; i < LUMPS; i++) {
      const age = (this.age[i] as number) + dt / (this.life[i] as number);
      this.age[i] = age;
      if (age >= 1) {
        // Out of the way: a lump that has landed is nothing.
        this.s.setScalar(0);
        this.m.compose(this.p.set(0, -1000, 0), this.q, this.s);
        this.lumps.setMatrixAt(i, this.m);
        continue;
      }
      live++;
      const k = i * 3;
      this.going[k + 1] = (this.going[k + 1] as number) - FALL * dt;
      this.at[k] = (this.at[k] as number) + (this.going[k] as number) * dt;
      this.at[k + 1] = (this.at[k + 1] as number) + (this.going[k + 1] as number) * dt;
      this.at[k + 2] = (this.at[k + 2] as number) + (this.going[k + 2] as number) * dt;
      // Full size as it leaves the ski, and smaller as it comes apart in the air.
      const size = (this.size[i] as number) * (1 - age * age);
      this.q.setFromAxisAngle(this.p.set(0.3, 1, 0.5).normalize(), age * 5 + i);
      this.m.compose(this.p.set(this.at[k] as number, this.at[k + 1] as number, this.at[k + 2] as number), this.q, this.s.setScalar(size));
      this.lumps.setMatrixAt(i, this.m);
    }
    this.lumps.count = live > 0 ? LUMPS : 0;
    this.lumps.instanceMatrix.needsUpdate = true;
  }

  /** Stretches of trench laid so far, and lumps in the air: for the tools. */
  get counts(): { trench: number; lumps: number } {
    let lumps = 0;
    for (let i = 0; i < LUMPS; i++) if ((this.age[i] as number) < 1) lumps++;
    return { trench: this.head, lumps };
  }
}
