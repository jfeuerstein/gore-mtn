import * as THREE from 'three/webgpu';
import { BODY, hipHeight, type Pose } from './pose';

/** What a figure wears: colours of jacket, trousers and hat, and the shape of the hat. */
export interface Outfit {
  jacket: number;
  hat: number;
  /** beanie, trapper, toque, ranger, cap or lamp. */
  style: string;
  trousers?: number;
}

/**
 * The skier: a small figure of rigid parts, jointed at hips, knees, shoulders and elbows and posed
 * by a Pose. About 2 model units tall, facing -z, feet at the origin.
 *
 * Colours are flat and the jacket is the most saturated thing on the mountain, so the player can
 * always find themselves.
 */
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
  private readonly head = new THREE.Group();
  private hat: THREE.Group | null = null;
  private hatStyle = '';

  /** @param outfit what to wear; the player's red jacket and blue beanie if not given */
  constructor(
    private readonly castShadow: boolean,
    outfit: Outfit = { jacket: 0xe2452f, hat: 0x2f6f8f, style: 'beanie' },
  ) {
    const mat = (color: number): THREE.MeshLambertMaterial => new THREE.MeshLambertMaterial({ color, flatShading: true });
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
    head.add(face, scarf, goggles);
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
  }

  /** Change the colours of jacket and hat, and the hat itself if its style differs. */
  setOutfit(outfit: Outfit): void {
    this.jacketMat.color.setHex(outfit.jacket);
    this.hatMat.color.setHex(outfit.hat);
    if (outfit.trousers !== undefined) this.trousersMat.color.setHex(outfit.trousers);
    if (outfit.style === this.hatStyle) return;
    this.hatStyle = outfit.style;
    if (this.hat) this.head.remove(this.hat);
    this.hat = this.buildHat(outfit.style);
    this.hat.traverse((o) => {
      if (o instanceof THREE.Mesh) o.castShadow = this.castShadow;
    });
    this.head.add(this.hat);
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
