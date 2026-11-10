import * as THREE from 'three/webgpu';
import { BODY, hipHeight, type Pose } from './pose';

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

  constructor(castShadow: boolean) {
    const mat = (color: number): THREE.MeshLambertMaterial => new THREE.MeshLambertMaterial({ color, flatShading: true });
    const jacket = mat(0xe2452f);
    const trousers = mat(0x2b3a55);
    const dark = mat(0x1f242e);
    const skin = mat(0xf0c9a4);
    const hat = mat(0x2f6f8f);
    const cream = mat(0xf4ead8);
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
    const head = new THREE.Group();
    head.position.y = 0.62;
    const face = new THREE.Mesh(new THREE.SphereGeometry(0.19, 10, 8), skin);
    face.position.y = 0.17;
    const scarf = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.2, 0.1, 8), cream);
    scarf.position.y = 0.01;
    const beanie = new THREE.Mesh(new THREE.SphereGeometry(0.205, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), hat);
    beanie.position.y = 0.2;
    const cuff = new THREE.Mesh(new THREE.CylinderGeometry(0.212, 0.212, 0.07, 10), cream);
    cuff.position.y = 0.21;
    const pompom = new THREE.Mesh(new THREE.SphereGeometry(0.07, 6, 5), cream);
    pompom.position.y = 0.43;
    const goggles = box(0.3, 0.08, 0.08, dark, 0, 0.19, -0.16);
    head.add(face, scarf, beanie, cuff, pompom, goggles);
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
    this.root.traverse((o) => {
      if (o instanceof THREE.Mesh) o.castShadow = castShadow;
    });
  }

  /** Put the skis and poles on, or take them off. */
  setSkis(on: boolean): void {
    for (const part of [...this.skis, ...this.poles]) part.visible = on;
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
