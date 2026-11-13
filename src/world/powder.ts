import * as THREE from 'three/webgpu';
import { lit } from '../look/material';

/** Puffs of snow in the air at once. */
const PUFFS = 720;
/** How long the longest-lived puff hangs, in seconds. */
const LONGEST = 0.8;

/**
 * Powder in the air: what a ski throws up out of loose snow. Not lumps: a cloud, made of
 * many small soft puffs that are thrown out, swell, slow in the air and are gone. Like the
 * smoke from the chimneys each is a small faceted lump, lit in the print's steps; and like
 * the smoke nothing is see-through: a puff ends by shrinking away. One instanced mesh.
 */
export class Powder {
  readonly mesh: THREE.InstancedMesh;
  private readonly material = lit({ color: 0xffffff, emissive: 0xb9c4d6, emissiveIntensity: 0.55 });
  private readonly at = new Float32Array(PUFFS * 3);
  private readonly going = new Float32Array(PUFFS * 3);
  private readonly age = new Float32Array(PUFFS).fill(1);
  private readonly life = new Float32Array(PUFFS).fill(1);
  private readonly size = new Float32Array(PUFFS);
  private next = 0;
  private owed = 0;
  private readonly m = new THREE.Matrix4();
  private readonly q = new THREE.Quaternion();
  private readonly p = new THREE.Vector3();
  private readonly s = new THREE.Vector3();

  constructor() {
    this.mesh = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(0.5, 0), this.material, PUFFS);
    this.mesh.name = 'powder';
    this.mesh.frustumCulled = false;
    this.mesh.count = 0;
  }

  /** The colour of snow in this light, and how much daylight there is, 0..1: a cloud of it is pale by day and only a shape after dark. */
  setTint(colour: number, daylight: number): void {
    this.material.color.setHex(colour);
    this.material.emissiveIntensity = 0.1 + 0.5 * Math.min(1, Math.max(0, daylight));
  }

  /**
   * Throw powder up from where the skis are. Call every frame while skiing in loose snow.
   * @param y the height of the top of the snow there
   * @param speed metres a second
   * @param travel the way the skier is moving, as a yaw
   * @param slip the angle between the skis and the way they are moving: a skid throws the most
   * @param depth how deep the loose snow is here, in metres
   */
  throwUp(dt: number, x: number, y: number, z: number, speed: number, travel: number, slip: number, depth: number): void {
    if (speed < 2.5 || depth <= 0.02) return;
    const skid = Math.abs(Math.sin(slip));
    const much = Math.min(1, depth / 0.22);
    // A wake all the time at speed; a wall of it broadside.
    this.owed += dt * much * Math.min(2.2, speed / 8) * (130 + skid * 700);
    const ahead = { x: -Math.sin(travel), z: -Math.cos(travel) };
    while (this.owed >= 1) {
      this.owed -= 1;
      const i = this.next;
      this.next = (this.next + 1) % PUFFS;
      const side = Math.random() < 0.5 ? -1 : 1;
      // Out to the sides and up, carried along with the skier a little; broadside, thrown on ahead, where the skis are pushing it.
      const out = (0.4 + Math.random() * 2.6) * side * (1 - skid * 0.5);
      const on = speed * (0.3 + Math.random() * 0.2 + skid * (0.25 + Math.random() * 0.35));
      this.at.set([x + ahead.z * side * 0.3 + (Math.random() - 0.5) * 0.7, y + 0.05 + Math.random() * 0.25, z - ahead.x * side * 0.3 + (Math.random() - 0.5) * 0.7], i * 3);
      this.going.set([ahead.x * on + ahead.z * out, 0.8 + Math.random() * 2.6 + skid * speed * 0.14, ahead.z * on - ahead.x * out], i * 3);
      this.age[i] = 0;
      this.life[i] = LONGEST * (0.35 + Math.random() * 0.65);
      // Small: a cloud is a great many flecks, not a few balls.
      this.size[i] = (0.05 + Math.random() * Math.random() * 0.2) * (0.7 + much * 0.6) * (1 + skid * 1.3);
    }
  }

  /** Move what is in the air. */
  update(dt: number): void {
    let live = 0;
    // The air slows a puff quickly: it is thrown, and then it hangs.
    const slow = Math.exp(-dt * 3.2);
    for (let i = 0; i < PUFFS; i++) {
      const age = (this.age[i] as number) + dt / (this.life[i] as number);
      this.age[i] = age;
      if (age >= 1) {
        this.s.setScalar(0);
        this.mesh.setMatrixAt(i, this.m.compose(this.p.set(0, -1000, 0), this.q, this.s));
        continue;
      }
      live++;
      const k = i * 3;
      this.going[k] = (this.going[k] as number) * slow;
      this.going[k + 1] = (this.going[k + 1] as number) * slow - 1.6 * dt;
      this.going[k + 2] = (this.going[k + 2] as number) * slow;
      this.at[k] = (this.at[k] as number) + (this.going[k] as number) * dt;
      this.at[k + 1] = (this.at[k + 1] as number) + (this.going[k + 1] as number) * dt;
      this.at[k + 2] = (this.at[k + 2] as number) + (this.going[k + 2] as number) * dt;
      // It swells as it leaves the ski, and thins away to nothing.
      const size = (this.size[i] as number) * Math.min(1, 0.4 + age * 3) * (1 - Math.max(0, age - 0.35) / 0.65) ** 1.3;
      this.mesh.setMatrixAt(i, this.m.compose(this.p.set(this.at[k] as number, this.at[k + 1] as number, this.at[k + 2] as number), this.q, this.s.set(size, size * 0.8, size)));
    }
    this.mesh.count = live > 0 ? PUFFS : 0;
    this.mesh.instanceMatrix.needsUpdate = true;
  }

  /** Puffs in the air: for the tools. */
  get puffs(): number {
    let n = 0;
    for (let i = 0; i < PUFFS; i++) if ((this.age[i] as number) < 1) n++;
    return n;
  }
}
