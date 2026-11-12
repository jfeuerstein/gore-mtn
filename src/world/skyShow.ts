import * as THREE from 'three/webgpu';
import { lit } from '../look/material';

/** How far off the things in the sky are drawn: inside the dome the stars are on. */
const FAR = 11000;
/** Seconds a shooting star takes to cross its bit of sky, and the longest wait for the next. */
const STREAK = 0.75;
const WAIT = 7;

const mix = (a: number, b: number, t: number): THREE.Color => new THREE.Color(a).lerp(new THREE.Color(b), t);

/**
 * What is in the sky only at the right moment: cloud lying in the valleys on a foggy morning,
 * shooting stars on the nights of the year's showers, and now and then the northern lights.
 * Three small meshes, each hidden unless its moment has come. Nothing here is see-through:
 * the lights are drawn in colours that run from green to the colour of the sky behind them,
 * as the stars take theirs from it.
 */
export class SkyShow {
  readonly group = new THREE.Group();
  private readonly sea: THREE.Mesh;
  private readonly streak: THREE.Mesh;
  private readonly lights: THREE.Mesh;
  private readonly lightsFrom = new THREE.Color(0x58d39a);
  private wait = 2;
  private flying = 0;
  private readonly from = new THREE.Vector3();
  private readonly to = new THREE.Vector3();
  private seaOn = false;
  private showerOn = false;
  /** How many shooting stars have crossed since this was last asked. */
  private crossed = 0;

  /** @param top the height the cloud's top lies at, in metres; @param span how far across the world is */
  constructor(private readonly top: number, span: number) {
    this.group.name = 'sky show';
    // The cloud: a wide sheet with a little swell to it, lit in steps like everything else, so that it is shapes and not a floor.
    const sheet = new THREE.PlaneGeometry(span * 3.2, span * 3.2, 56, 56);
    sheet.rotateX(-Math.PI / 2);
    const at = sheet.getAttribute('position');
    for (let i = 0; i < at.count; i++) {
      const x = at.getX(i);
      const z = at.getZ(i);
      at.setY(i, Math.sin(x * 0.0041 + 1.3) * 9 + Math.sin(z * 0.0057 + x * 0.0019) * 7 + Math.sin((x + z) * 0.011) * 3.5);
    }
    const flat = sheet.toNonIndexed();
    flat.computeVertexNormals();
    this.sea = new THREE.Mesh(flat, lit({ color: 0xf4f6fa, flatShading: true }));
    this.sea.position.y = top;
    this.sea.visible = false;
    this.sea.receiveShadow = true;
    // A shooting star: a sliver, longer than it is wide, that crosses a little of the sky and is gone.
    this.streak = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial({ color: 0xfff4dc, fog: false, depthWrite: false }));
    this.streak.visible = false;
    this.streak.frustumCulled = false;
    this.streak.renderOrder = -1.4;
    // The northern lights: three curtains across the north, each a band of upright strips, green at the foot and the sky's own colour at the top.
    const positions: number[] = [];
    const tones: number[] = [];
    for (let c = 0; c < 3; c++) {
      const radius = FAR * (0.86 - c * 0.07);
      const low = FAR * (0.12 + c * 0.05);
      const tall = FAR * (0.34 - c * 0.05);
      const strips = 40;
      for (let i = 0; i < strips; i++) {
        // North is -z. Each curtain is an arc of it, and wavers along its length.
        const a0 = -0.9 + c * 0.25 + (i / strips) * (1.5 - c * 0.2);
        const a1 = -0.9 + c * 0.25 + ((i + 1) / strips) * (1.5 - c * 0.2);
        const wave = (a: number): number => 1 + Math.sin(a * 9 + c * 2.1) * 0.05 + Math.sin(a * 23 + c) * 0.02;
        const foot = (a: number): [number, number, number] => [Math.sin(a) * radius * wave(a), low + Math.sin(a * 5 + c * 1.7) * FAR * 0.03, -Math.cos(a) * radius * wave(a)];
        const head = (a: number, k: number): [number, number, number] => [Math.sin(a) * radius * wave(a) * 0.93, low + tall * k, -Math.cos(a) * radius * wave(a) * 0.93];
        // Strips of two heights by turns, so that the top edge is a comb and not a line.
        const k = i % 2 ? 1 : 0.72 + (((i * 7) % 5) / 5) * 0.2;
        positions.push(...foot(a0), ...foot(a1), ...head(a1, k), ...foot(a0), ...head(a1, k), ...head(a0, k));
        tones.push(0, 0, 1, 0, 1, 1);
      }
    }
    const curtain = new THREE.BufferGeometry();
    curtain.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    curtain.setAttribute('tone', new THREE.Float32BufferAttribute(tones, 1));
    curtain.setAttribute('color', new THREE.Float32BufferAttribute(new Float32Array((positions.length / 3) * 3), 3));
    this.lights = new THREE.Mesh(curtain, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide, fog: false, depthWrite: false }));
    this.lights.visible = false;
    this.lights.frustumCulled = false;
    this.lights.renderOrder = -1.45;
    this.group.add(this.sea, this.streak, this.lights);
  }

  /**
   * What the moment has in it.
   * @param sea cloud is lying in the valleys
   * @param shower there are shooting stars tonight, and the stars are out
   * @param lights the northern lights are out
   * @param skyTop the colour of the sky overhead, which the lights fade into
   */
  set(sea: boolean, shower: boolean, lights: boolean, skyTop: number): void {
    this.seaOn = sea;
    this.showerOn = shower;
    if (!shower) this.streak.visible = false;
    this.lights.visible = lights;
    if (lights) {
      const tone = this.lights.geometry.getAttribute('tone');
      const colour = this.lights.geometry.getAttribute('color');
      const foot = mix(skyTop, this.lightsFrom.getHex(), 0.8);
      const head = new THREE.Color(skyTop);
      for (let i = 0; i < tone.count; i++) {
        const c = tone.getX(i) > 0.5 ? head : foot;
        colour.setXYZ(i, c.r, c.g, c.b);
      }
      colour.needsUpdate = true;
    }
  }

  /** What is in the sky just now, for the tools. */
  now(): { sea: boolean; shower: boolean; lights: boolean; streak: boolean } {
    return { sea: this.seaOn, shower: this.showerOn, lights: this.lights.visible, streak: this.streak.visible };
  }

  /** True when the camera is above the cloud, with the cloud there to be above. */
  above(cameraY: number): boolean {
    return this.seaOn && cameraY > this.top + 12;
  }

  /** How many shooting stars have crossed since last asked. */
  takeCrossed(): number {
    const n = this.crossed;
    this.crossed = 0;
    return n;
  }

  /** @param facing the way the camera looks, as an angle about upright: shooting stars fall in the part of the sky that is in front of it */
  update(dt: number, camera: THREE.Vector3, time: number, facing = 0): void {
    // The cloud is a floor only to someone above it; from underneath it is the fog they are standing in.
    this.sea.visible = this.above(camera.y);
    if (this.sea.visible) this.sea.position.set(camera.x - (camera.x % 400), this.top, camera.z - (camera.z % 400));
    if (this.lights.visible) {
      this.lights.position.copy(camera);
      // The curtains sway, slowly, the whole of them together.
      this.lights.rotation.y = Math.sin(time * 0.05) * 0.12;
      this.lights.scale.y = 1 + Math.sin(time * 0.23) * 0.06;
    }
    if (!this.showerOn) return;
    if (this.flying > 0) {
      this.flying -= dt;
      const t = 1 - Math.max(0, this.flying) / STREAK;
      this.streak.position.copy(camera).addScaledVector(this.from, 1 - t).addScaledVector(this.to, t);
      // Long in the middle of its flight, a point at either end.
      const length = FAR * 0.085 * Math.sin(t * Math.PI);
      // As thick as a bright star is wide: thinner, and on a small screen it is not drawn at all.
      this.streak.scale.set(FAR * 0.003, FAR * 0.003, Math.max(1, length));
      this.streak.lookAt(this.streak.position.x + this.to.x - this.from.x, this.streak.position.y + this.to.y - this.from.y, this.streak.position.z + this.to.z - this.from.z);
      if (this.flying <= 0) {
        this.streak.visible = false;
        this.crossed++;
      }
      return;
    }
    this.wait -= dt;
    if (this.wait > 0) return;
    this.wait = 2 + Math.random() * WAIT;
    this.flying = STREAK;
    // From somewhere high in the sky, down and across a little of it.
    const a = facing + (Math.random() - 0.5) * 1.1;
    // Low enough to be seen without looking up: the camera looks down on the player, and has only so much sky.
    const up = 0.16 + Math.random() * 0.34;
    this.from.set(Math.sin(a) * Math.sqrt(1 - up * up), up, Math.cos(a) * Math.sqrt(1 - up * up)).multiplyScalar(FAR);
    const b = a + (Math.random() < 0.5 ? -1 : 1) * (0.12 + Math.random() * 0.12);
    const down = Math.max(0.05, up - 0.07 - Math.random() * 0.1);
    this.to.set(Math.sin(b) * Math.sqrt(1 - down * down), down, Math.cos(b) * Math.sqrt(1 - down * down)).multiplyScalar(FAR);
    this.streak.visible = true;
  }
}
