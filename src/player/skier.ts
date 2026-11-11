import * as THREE from 'three/webgpu';
import { BODY, hipHeight, type Pose } from './pose';
import { isPrinted, lit } from '../look/material';
import { inkFor, OUTLINE, rim } from '../look/print';

/**
 * What makes one person on the mountain look unlike the next: a face in place of the player's
 * goggles, hair, a beard, an apron. All optional, all colours as hex.
 */
export interface Features {
  /** Skin, if not the usual. */
  skin?: number;
  /** Hair showing below the hat, and how it is worn. */
  hair?: number;
  hairStyle?: 'short' | 'long' | 'braid' | 'bun' | 'curls';
  beard?: number;
  moustache?: number;
  glasses?: boolean;
  /** A bib apron over the coat. */
  apron?: number;
  /** A white cross on chest and back, as ski patrol wear. */
  cross?: boolean;
  /** A shawl over the shoulders. */
  shawl?: number;
  /** Brass buttons down the front, as on a uniform. */
  buttons?: boolean;
  /** How tall they stand against a grown-up, 1 if not given, and how broad. */
  height?: number;
  girth?: number;
}

/** What a figure wears: colours of jacket, trousers and hat, and the shape of the hat. */
export interface Outfit {
  jacket: number;
  hat: number;
  /** beanie, trapper, toque, ranger, cap, lamp, tophat, helmet, antlers, propeller or straw. */
  style: string;
  trousers?: number;
  /** A face and features of their own. The player has none: goggles, and that is all. */
  features?: Features;
}

/** A part of the figure whose meshes have been joined, and which of its vertices are painted from which material. */
interface Joined {
  part: THREE.Object3D;
  mesh: THREE.Mesh;
  paints: { material: THREE.MeshLambertMaterial; from: number; count: number }[];
}

/**
 * The skier: a small figure of rigid parts, jointed at hips, knees, shoulders and elbows and posed
 * by a Pose. About 2 model units tall, facing -z, feet at the origin.
 *
 * Colours are flat and the jacket is the most saturated thing on the mountain, so the player can
 * always find themselves.
 */
/** How far the dark rim round a printed figure stands out, in metres: the figure is about 1.4 tall. */
const FIGURE_RIM = 0.02;

export class Skier {
  readonly root = new THREE.Group();
  private readonly rig = new THREE.Group();
  private readonly torso = new THREE.Group();
  private readonly hips: THREE.Group[] = [];
  private readonly knees: THREE.Group[] = [];
  private readonly feet: THREE.Group[] = [];
  private readonly shoulders: THREE.Group[] = [];
  private readonly elbows: THREE.Group[] = [];
  private readonly skis: THREE.Object3D[] = [];
  private readonly poles: THREE.Object3D[] = [];
  /** The mountain bike, and its two wheels, which turn. */
  private readonly bike = new THREE.Group();
  private readonly wheels: THREE.Object3D[] = [];
  private readonly jacketMat: THREE.MeshLambertMaterial;
  private readonly trousersMat: THREE.MeshLambertMaterial;
  private readonly hatMat: THREE.MeshLambertMaterial;
  private readonly creamMat: THREE.MeshLambertMaterial;
  private readonly darkMat: THREE.MeshLambertMaterial;
  /** The parts that have been joined into one mesh each, and the one material they all share. */
  private joined: Joined[] = [];
  private readonly joinedMat = lit({ vertexColors: true, flatShading: true });
  private readonly head = new THREE.Group();
  private hat: THREE.Group | null = null;
  private hatStyle = '';

  /** @param outfit what to wear; the player's red jacket and blue beanie if not given */
  constructor(
    private readonly castShadow: boolean,
    outfit: Outfit = { jacket: 0xe2452f, hat: 0x2f6f8f, style: 'beanie' },
  ) {
    const mat = (color: number): THREE.MeshLambertMaterial => lit({ color, flatShading: true });
    const jacket = (this.jacketMat = mat(outfit.jacket));
    const trousers = (this.trousersMat = mat(outfit.trousers ?? 0x2b3a55));
    const dark = (this.darkMat = mat(0x1f242e));
    const skin = mat(0xf0c9a4);
    this.hatMat = mat(outfit.hat);
    const cream = (this.creamMat = mat(0xf4ead8));
    const leather = mat(0x6b4a33);
    const skiMat = mat(0xd9a441);
    const box = (w: number, h: number, d: number, m: THREE.Material, x = 0, y = 0, z = 0): THREE.Mesh => {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
      mesh.position.set(x, y, z);
      return mesh;
    };

    // Legs: hip -> thigh -> knee -> shin -> foot (boot and ski).
    for (const side of [-1, 1]) {
      const hip = new THREE.Group();
      hip.position.set(side * 0.12, 0, 0);
      hip.add(box(0.17, BODY.thigh, 0.19, trousers, 0, -BODY.thigh / 2, 0));
      const knee = new THREE.Group();
      knee.position.y = -BODY.thigh;
      knee.add(box(0.15, BODY.shin, 0.17, trousers, 0, -BODY.shin / 2, 0));
      const foot = new THREE.Group();
      foot.position.y = -BODY.shin;
      foot.add(box(0.19, BODY.boot, 0.34, dark, 0, -BODY.boot / 2, -0.05));
      const ski = new THREE.Group();
      ski.add(box(0.12, 0.035, 1.7, skiMat, 0, -BODY.boot - 0.018, -0.1));
      const tip = box(0.12, 0.035, 0.24, skiMat, 0, -BODY.boot + 0.03, -1.04);
      tip.rotation.x = 0.5;
      ski.add(tip);
      ski.visible = false;
      foot.add(ski);
      knee.add(foot);
      hip.add(knee);
      this.rig.add(hip);
      this.hips.push(hip);
      this.knees.push(knee);
      this.feet.push(foot);
      this.skis.push(ski);
    }

    // Body: jacket, pack, head, and the arms hung from the shoulders.
    const coat = new THREE.Mesh(new THREE.CylinderGeometry(0.21, 0.27, 0.6, 8), jacket);
    coat.position.y = 0.3;
    this.torso.add(coat, box(0.34, 0.4, 0.16, leather, 0, 0.36, 0.26));
    const head = this.head;
    head.position.y = 0.62;
    const face = new THREE.Mesh(new THREE.SphereGeometry(0.19, 10, 8), skin);
    face.position.y = 0.17;
    const scarf = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.2, 0.1, 8), cream);
    scarf.position.y = 0.01;
    const goggles = box(0.3, 0.08, 0.08, dark, 0, 0.19, -0.16);
    head.add(face, scarf);
    const f = outfit.features;
    if (!f) {
      head.add(goggles);
    } else {
      // A face: two eyes, and whatever else is theirs. The head is 0.19 across the cheek, its middle at 0.17.
      if (f.skin !== undefined) skin.color.setHex(f.skin);
      head.add(box(0.04, 0.05, 0.03, dark, -0.07, 0.2, -0.175), box(0.04, 0.05, 0.03, dark, 0.07, 0.2, -0.175));
      if (f.glasses) {
        const rim = mat(0x3a2e26);
        head.add(box(0.11, 0.09, 0.015, rim, -0.075, 0.2, -0.192), box(0.11, 0.09, 0.015, rim, 0.075, 0.2, -0.192), box(0.07, 0.05, 0.02, cream, -0.075, 0.2, -0.197), box(0.07, 0.05, 0.02, cream, 0.075, 0.2, -0.197), box(0.05, 0.015, 0.015, rim, 0, 0.21, -0.192));
        head.add(box(0.03, 0.035, 0.03, dark, -0.075, 0.2, -0.205), box(0.03, 0.035, 0.03, dark, 0.075, 0.2, -0.205));
      }
      if (f.moustache !== undefined) head.add(box(0.17, 0.045, 0.04, mat(f.moustache), 0, 0.115, -0.185));
      if (f.beard !== undefined) head.add(box(0.26, 0.15, 0.12, mat(f.beard), 0, 0.055, -0.125), box(0.3, 0.12, 0.1, mat(f.beard), 0, 0.09, -0.06));
      if (f.hair !== undefined) {
        const hair = mat(f.hair);
        const style = f.hairStyle ?? 'short';
        if (style === 'short') head.add(box(0.37, 0.13, 0.2, hair, 0, 0.15, 0.09));
        else if (style === 'curls') head.add(box(0.47, 0.2, 0.3, hair, 0, 0.15, 0.05), box(0.4, 0.14, 0.14, hair, 0, 0.05, 0.14));
        else head.add(box(0.38, 0.3, 0.15, hair, 0, 0.07, 0.13));
        if (style === 'braid') head.add(box(0.075, 0.42, 0.075, hair, 0.09, -0.2, 0.2), box(0.09, 0.05, 0.09, mat(0xc8402d), 0.09, -0.4, 0.2));
        if (style === 'bun') head.add(box(0.15, 0.15, 0.13, hair, 0, 0.2, 0.24));
      }
      // On the coat: the coat is about 0.23 from middle to front at chest height.
      if (f.apron !== undefined) {
        const apron = mat(f.apron);
        this.torso.add(box(0.3, 0.46, 0.03, apron, 0, 0.22, -0.265), box(0.2, 0.14, 0.03, apron, 0, 0.5, -0.235), box(0.5, 0.04, 0.5, apron, 0, 0.2, 0));
      }
      if (f.cross) {
        for (const z of [-0.255, 0.35]) this.torso.add(box(0.17, 0.055, 0.02, cream, 0, 0.42, z), box(0.055, 0.17, 0.02, cream, 0, 0.42, z));
      }
      if (f.buttons) {
        const brass = mat(0xe2b94a);
        for (const y of [0.16, 0.3, 0.44]) this.torso.add(box(0.045, 0.045, 0.03, brass, 0, y, -0.26 + (y - 0.16) * 0.08));
      }
      if (f.shawl !== undefined) {
        const shawl = mat(f.shawl);
        this.torso.add(box(0.66, 0.16, 0.5, shawl, 0, 0.5, 0.02), box(0.5, 0.2, 0.06, shawl, 0, 0.36, 0.3));
      }
    }
    this.torso.add(head);
    for (const side of [-1, 1]) {
      const shoulder = new THREE.Group();
      shoulder.position.set(side * 0.27, 0.52, 0);
      shoulder.add(box(0.13, 0.3, 0.14, jacket, 0, -0.15, 0));
      const elbow = new THREE.Group();
      elbow.position.y = -0.3;
      elbow.add(box(0.12, 0.26, 0.13, jacket, 0, -0.13, 0), box(0.14, 0.13, 0.15, dark, 0, -0.32, 0));
      // The pole hangs from the mitten; Skier.pose() swings it to point where the pose says.
      const pole = new THREE.Group();
      pole.position.y = -0.32;
      const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 1.15, 5), dark);
      shaft.position.y = -0.5;
      const basket = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.015, 6), dark);
      basket.position.y = -1.0;
      pole.add(shaft, basket);
      pole.visible = false;
      elbow.add(pole);
      shoulder.add(elbow);
      this.torso.add(shoulder);
      this.shoulders.push(shoulder);
      this.elbows.push(elbow);
      this.poles.push(pole);
    }
    this.rig.add(this.torso);
    // Children are short, cooks are broad.
    if (f?.height !== undefined || f?.girth !== undefined) this.root.scale.set(f.girth ?? 1, f.height ?? 1, f.girth ?? 1);
    this.root.add(this.rig);

    // The bike: two wheels, a frame of straight tubes, bars and a saddle. It faces -z like the rider.
    const frame = mat(0x2f6f8f);
    const WHEEL = 0.36;
    for (const z of [-0.56, 0.56]) {
      const wheel = new THREE.Group();
      wheel.position.set(0, WHEEL, z);
      const tyre = new THREE.Mesh(new THREE.CylinderGeometry(WHEEL, WHEEL, 0.07, 12), dark);
      tyre.rotation.z = Math.PI / 2;
      const hub = new THREE.Mesh(new THREE.CylinderGeometry(WHEEL * 0.62, WHEEL * 0.62, 0.075, 12), cream);
      hub.rotation.z = Math.PI / 2;
      // A spoke that can be seen going round.
      wheel.add(tyre, hub, box(0.08, WHEEL * 1.9, 0.05, dark));
      this.bike.add(wheel);
      this.wheels.push(wheel);
    }
    const tube = (length: number, y: number, z: number, tip: number, m: THREE.Material = frame): THREE.Mesh => {
      const part = box(0.06, length, 0.06, m, 0, y, z);
      part.rotation.x = tip;
      return part;
    };
    this.bike.add(
      // Seat tube, top tube, down tube, the stays to the back wheel, and the fork.
      tube(0.62, 0.66, 0.2, 0.25),
      tube(0.66, 0.9, -0.1, 1.45),
      tube(0.72, 0.62, -0.14, 0.95),
      tube(0.5, 0.4, 0.36, -1.35),
      tube(0.7, 0.66, -0.47, -0.28),
      box(0.56, 0.05, 0.06, dark, 0, 1.0, -0.4),
      box(0.16, 0.05, 0.3, dark, 0, 0.98, 0.2),
    );
    this.bike.visible = false;
    this.root.add(this.bike);
    this.root.traverse((o) => {
      if (o instanceof THREE.Mesh) o.castShadow = castShadow;
    });
    this.setOutfit(outfit);
    // Each rigid part of the figure is several boxes in several colours. Joined, each part is one
    // mesh: a dozen draw calls for the figure in place of two dozen, and the same again in shadow.
    const joints: THREE.Object3D[] = [];
    this.root.traverse((o) => {
      if (!(o instanceof THREE.Mesh)) joints.push(o);
    });
    for (const joint of joints) this.join(joint);
  }

  /**
   * Join a part's own meshes into one that takes its colours from its vertices. Only the lit,
   * flat-coloured ones: anything that shines by itself (a miner's lamp) stays as it is.
   */
  private join(part: THREE.Object3D): void {
    // Lit, either way of lighting: the print's material is not the plain one.
    const meshes = part.children.filter((c): c is THREE.Mesh => c instanceof THREE.Mesh && (c.material instanceof THREE.MeshLambertMaterial || c.material instanceof THREE.MeshToonMaterial) && c.material !== this.joinedMat);
    if (meshes.length === 0) return;
    const positions: number[] = [];
    const normals: number[] = [];
    const paints: Joined['paints'] = [];
    const rims: Float32Array[] = [];
    for (const mesh of meshes) {
      mesh.updateMatrix();
      const geo = (mesh.geometry.index ? mesh.geometry.toNonIndexed() : mesh.geometry.clone()).applyMatrix4(mesh.matrix);
      const p = geo.getAttribute('position');
      const n = geo.getAttribute('normal');
      paints.push({ material: mesh.material as THREE.MeshLambertMaterial, from: positions.length / 3, count: p.count });
      for (let i = 0; i < p.count; i++) {
        positions.push(p.getX(i), p.getY(i), p.getZ(i));
        normals.push(n.getX(i), n.getY(i), n.getZ(i));
      }
      // Printed, whatever is stout enough to make part of the figure's outline has a dark rim round it.
      geo.computeBoundingBox();
      const size = (geo.boundingBox as THREE.Box3).getSize(new THREE.Vector3());
      if (isPrinted() && Math.min(size.x, size.y, size.z) >= FIGURE_RIM * 3) rims.push(rim(p.array as Float32Array, FIGURE_RIM));
      part.remove(mesh);
    }
    const painted = positions.length / 3;
    for (const round of rims) {
      for (let i = 0; i < round.length; i += 9) {
        const ux = (round[i + 3] as number) - (round[i] as number);
        const uy = (round[i + 4] as number) - (round[i + 1] as number);
        const uz = (round[i + 5] as number) - (round[i + 2] as number);
        const vx = (round[i + 6] as number) - (round[i] as number);
        const vy = (round[i + 7] as number) - (round[i + 1] as number);
        const vz = (round[i + 8] as number) - (round[i + 2] as number);
        const nx = uy * vz - uz * vy;
        const ny = uz * vx - ux * vz;
        const nz = ux * vy - uy * vx;
        const len = Math.hypot(nx, ny, nz) || 1;
        for (let k = 0; k < 9; k += 3) {
          positions.push(round[i + k] as number, round[i + k + 1] as number, round[i + k + 2] as number);
          normals.push(nx / len, ny / len, nz / len);
        }
      }
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
    const colours = new Float32Array(positions.length);
    // The rim is ink, whatever the outfit: it is coloured once, here, and never repainted.
    const ink = new THREE.Color(OUTLINE);
    for (let i = painted; i < positions.length / 3; i++) colours.set([ink.r, ink.g, ink.b], i * 3);
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colours, 3));
    const mesh = new THREE.Mesh(geometry, this.joinedMat);
    mesh.castShadow = this.castShadow;
    part.add(mesh);
    const joined: Joined = { part, mesh, paints };
    this.joined.push(joined);
    this.paint(joined);
  }

  /** Give a joined part the colours its materials have now. */
  private paint(joined: Joined): void {
    const colours = joined.mesh.geometry.getAttribute('color') as THREE.BufferAttribute;
    const c = new THREE.Color();
    for (const { material, from, count } of joined.paints) {
      // Printed, every colour of an outfit is the nearest ink.
      if (isPrinted()) c.setHex(inkFor(material.color.getHex()));
      else c.copy(material.color);
      for (let i = from; i < from + count; i++) colours.setXYZ(i, c.r, c.g, c.b);
    }
    colours.needsUpdate = true;
  }

  /** Change the colours of jacket and hat, and the hat itself if its style differs. */
  setOutfit(outfit: Outfit): void {
    this.jacketMat.color.setHex(outfit.jacket);
    this.hatMat.color.setHex(outfit.hat);
    if (outfit.trousers !== undefined) this.trousersMat.color.setHex(outfit.trousers);
    if (outfit.style !== this.hatStyle) {
      this.hatStyle = outfit.style;
      const built = this.joined.length > 0;
      if (this.hat) {
        this.head.remove(this.hat);
        const old = this.hat;
        this.joined = this.joined.filter((j) => j.part !== old);
      }
      this.hat = this.buildHat(outfit.style);
      this.hat.traverse((o) => {
        if (o instanceof THREE.Mesh) o.castShadow = this.castShadow;
      });
      this.head.add(this.hat);
      // A hat put on after the figure was joined up is joined in its turn.
      if (built) this.join(this.hat);
    }
    // The joined parts wear their colours on their vertices, so a change of coat is a repaint.
    for (const joined of this.joined) this.paint(joined);
  }

  /** A hat, sitting on a head whose crown is about 0.36 above the neck. */
  private buildHat(style: string): THREE.Group {
    const g = new THREE.Group();
    const { hatMat: hat, creamMat: cream, darkMat: dark } = this;
    const part = (geo: THREE.BufferGeometry, m: THREE.Material, x: number, y: number, z: number): THREE.Mesh => {
      const mesh = new THREE.Mesh(geo, m);
      mesh.position.set(x, y, z);
      return mesh;
    };
    const dome = (): THREE.Mesh => part(new THREE.SphereGeometry(0.205, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), hat, 0, 0.2, 0);
    if (style === 'trapper') {
      // Fur-lined, with flaps over the ears.
      g.add(dome(), part(new THREE.BoxGeometry(0.34, 0.08, 0.08), cream, 0, 0.24, -0.17));
      for (const side of [-1, 1]) g.add(part(new THREE.BoxGeometry(0.07, 0.22, 0.2), hat, side * 0.2, 0.12, 0.01), part(new THREE.BoxGeometry(0.075, 0.05, 0.21), cream, side * 0.2, 0.02, 0.01));
    } else if (style === 'toque') {
      // A cook's tall white hat.
      g.add(part(new THREE.CylinderGeometry(0.2, 0.2, 0.08, 10), hat, 0, 0.26, 0), part(new THREE.CylinderGeometry(0.24, 0.19, 0.3, 10), hat, 0, 0.45, 0));
    } else if (style === 'ranger') {
      // Flat-brimmed, as fire tower observers wore.
      g.add(part(new THREE.CylinderGeometry(0.36, 0.36, 0.03, 12), hat, 0, 0.29, 0), part(new THREE.CylinderGeometry(0.15, 0.19, 0.17, 10), hat, 0, 0.39, 0), part(new THREE.CylinderGeometry(0.195, 0.195, 0.04, 10), dark, 0, 0.32, 0));
    } else if (style === 'cap') {
      // A peaked cap.
      g.add(part(new THREE.CylinderGeometry(0.21, 0.2, 0.13, 10), hat, 0, 0.32, 0), part(new THREE.BoxGeometry(0.3, 0.03, 0.16), dark, 0, 0.27, -0.24), part(new THREE.CylinderGeometry(0.205, 0.205, 0.04, 10), cream, 0, 0.28, 0));
    } else if (style === 'lamp') {
      // A miner's hard hat with its lamp, which stays lit.
      g.add(dome(), part(new THREE.CylinderGeometry(0.25, 0.25, 0.03, 12), hat, 0, 0.22, 0), part(new THREE.BoxGeometry(0.1, 0.09, 0.06), new THREE.MeshBasicMaterial({ color: 0xfff0a8 }), 0, 0.3, -0.2));
    } else if (style === 'tophat') {
      // A snowman's top hat, with a band.
      g.add(part(new THREE.CylinderGeometry(0.33, 0.33, 0.03, 12), hat, 0, 0.27, 0), part(new THREE.CylinderGeometry(0.19, 0.18, 0.34, 10), hat, 0, 0.45, 0), part(new THREE.CylinderGeometry(0.195, 0.195, 0.06, 10), cream, 0, 0.32, 0));
    } else if (style === 'helmet') {
      // A patroller's helmet: a full dome, a short peak, and goggles pushed up on it.
      g.add(part(new THREE.SphereGeometry(0.235, 10, 6, 0, Math.PI * 2, 0, Math.PI * 0.6), hat, 0, 0.17, 0), part(new THREE.BoxGeometry(0.3, 0.03, 0.1), dark, 0, 0.25, -0.24), part(new THREE.BoxGeometry(0.34, 0.09, 0.05), dark, 0, 0.34, -0.2), part(new THREE.BoxGeometry(0.26, 0.06, 0.02), new THREE.MeshBasicMaterial({ color: 0xffd76a }), 0, 0.34, -0.23));
    } else if (style === 'antlers') {
      // A plain cap with a pair of felt antlers.
      g.add(dome());
      for (const side of [-1, 1]) {
        const beam = part(new THREE.BoxGeometry(0.045, 0.34, 0.045), cream, side * 0.13, 0.52, 0);
        beam.rotation.z = -side * 0.35;
        const tine = part(new THREE.BoxGeometry(0.04, 0.16, 0.04), cream, side * 0.24, 0.56, 0);
        tine.rotation.z = -side * 1.1;
        const brow = part(new THREE.BoxGeometry(0.04, 0.13, 0.04), cream, side * 0.1, 0.5, -0.06);
        brow.rotation.x = -0.9;
        g.add(beam, tine, brow);
      }
    } else if (style === 'propeller') {
      // A beanie with a propeller on top, which does not turn, or says it does not.
      g.add(dome(), part(new THREE.CylinderGeometry(0.212, 0.212, 0.05, 10), cream, 0, 0.21, 0), part(new THREE.CylinderGeometry(0.015, 0.015, 0.12, 5), dark, 0, 0.46, 0));
      const blade = part(new THREE.BoxGeometry(0.4, 0.015, 0.07), lit({ color: 0xe2a52e, flatShading: true }), 0, 0.52, 0);
      blade.rotation.y = 0.6;
      g.add(blade, part(new THREE.SphereGeometry(0.03, 5, 4), lit({ color: 0xc8402d, flatShading: true }), 0, 0.53, 0));
    } else if (style === 'straw') {
      // A scarecrow's straw hat: wide, and a little crushed.
      g.add(part(new THREE.CylinderGeometry(0.4, 0.42, 0.03, 12), hat, 0, 0.28, 0), part(new THREE.CylinderGeometry(0.17, 0.2, 0.16, 10), hat, 0, 0.37, 0), part(new THREE.CylinderGeometry(0.205, 0.205, 0.04, 10), dark, 0, 0.31, 0));
    } else {
      // A beanie with a turned-up cuff and a pompom.
      g.add(dome(), part(new THREE.CylinderGeometry(0.212, 0.212, 0.07, 10), cream, 0, 0.21, 0), part(new THREE.SphereGeometry(0.07, 6, 5), cream, 0, 0.43, 0));
    }
    return g;
  }

  /** Put the skis and poles on, or take them off. */
  setSkis(on: boolean): void {
    for (const part of [...this.skis, ...this.poles]) part.visible = on;
  }

  /** Get on the bike, or off it. */
  setBike(on: boolean): void {
    this.bike.visible = on;
  }

  /** Turn the bike's wheels for a distance ridden, in model units. */
  rollWheels(distance: number): void {
    for (const wheel of this.wheels) wheel.rotation.x -= distance / 0.36;
  }

  /**
   * Move the joints to a pose.
   * @param flatFeet keep the soles level with the ground whatever the legs do, as on skis
   */
  pose(p: Pose, flatFeet: boolean): void {
    this.rig.position.y = hipHeight(p);
    const hips = [p.hipL, p.hipR];
    const knees = [p.kneeL, p.kneeR];
    const shoulders = [p.shoulderL, p.shoulderR];
    for (let i = 0; i < 2; i++) {
      const hip = hips[i] as number;
      const knee = knees[i] as number;
      // A positive turn about x swings a hanging limb forward (toward -z).
      (this.hips[i] as THREE.Group).rotation.x = hip;
      (this.knees[i] as THREE.Group).rotation.x = -knee;
      // On foot the sole follows the shin a little, which reads as a step.
      (this.feet[i] as THREE.Group).rotation.x = flatFeet ? knee - hip : (knee - hip) * 0.35;

      const side = i === 0 ? -1 : 1;
      const shoulder = shoulders[i] as number;
      (this.shoulders[i] as THREE.Group).rotation.set(shoulder, 0, side * p.armsOut);
      (this.elbows[i] as THREE.Group).rotation.x = p.elbow;
      // Cancel the turns of the body and arm above it, so the pole points where the pose says.
      (this.poles[i] as THREE.Object3D).rotation.x = p.poles - (shoulder + p.elbow - p.torso);
    }
    // Tipping forward is a negative turn about x for a part that points up.
    this.torso.rotation.x = -p.torso;
  }
}
