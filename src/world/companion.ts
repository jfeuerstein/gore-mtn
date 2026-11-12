import * as THREE from 'three/webgpu';
import { lit } from '../look/material';
import { madeModel } from './critterModels';
import { modelGeometry } from './modelFiles';
import { blocks } from './shapes';

/** Who can come along, by the style its gear names: the model it is, how tall it stands, and whether it flies. */
const KINDS: Record<string, { model: string; tall: number; flies?: true; colour: number }> = {
  'pet-kit': { model: 'pet-kit', tall: 0.62, colour: 0xd9772b },
  'pet-duckling': { model: 'pet-duckling', tall: 0.4, colour: 0xf2d16b },
  'pet-chickadee': { model: 'chickadee', tall: 0.3, flies: true, colour: 0xa9b3c0 },
  'pet-kitten': { model: 'pet-kitten', tall: 0.5, colour: 0x5e6670 },
  'pet-toad': { model: 'pet-toad', tall: 0.34, colour: 0x7a5236 },
};

/**
 * Whoever has come along with the player: a fox kit, a duckling, a kitten, a toad, a chickadee.
 * It keeps a couple of steps behind on foot, hopping to catch up; on skis or a bike it rides
 * on the player's pack; a bird keeps about their head. One small mesh, and its outline.
 */
export class Companion {
  readonly group = new THREE.Group();
  private readonly material = lit({ vertexColors: true, flatShading: true });
  private readonly ink = new THREE.MeshBasicMaterial({ color: 0x22304a, side: THREE.BackSide });
  private kind = '';
  private body: THREE.Mesh | null = null;
  private readonly at = new THREE.Vector3();
  private facing = 0;
  private hop = 0;
  private settled = false;

  constructor(private readonly castShadow: boolean) {
    this.group.name = 'companion';
  }

  /** Who is along: a pet's style, or '' for nobody. */
  set(kind: string): void {
    if (kind === this.kind) return;
    this.kind = kind;
    if (this.body) this.group.remove(this.body);
    this.body = null;
    const spec = KINDS[kind];
    if (!spec) return;
    const file = madeModel(spec.model);
    if (file) {
      const made = modelGeometry(file, spec.tall);
      this.body = new THREE.Mesh(made.geometry, this.material);
      if (made.shell) this.body.add(new THREE.Mesh(made.shell, this.ink));
    } else {
      // Without the made models: a small body and a head, in its colour.
      const t = spec.tall;
      this.body = new THREE.Mesh(blocks([{ size: [t * 0.6, t * 0.6, t], at: [0, t * 0.4, 0], colour: spec.colour }, { size: [t * 0.5, t * 0.5, t * 0.5], at: [0, t * 0.8, -t * 0.5], colour: spec.colour }]), this.material);
    }
    this.body.castShadow = this.castShadow;
    this.group.add(this.body);
    this.settled = false;
  }

  /**
   * @param player where the player is, which way they face, and how fast they are going
   * @param riding on skis, a bike or a lift: whoever is along is carried
   * @param hidden nobody is to be seen (inside a gondola cabin)
   */
  update(dt: number, time: number, player: { x: number; y: number; z: number; heading: number; speed: number }, riding: boolean, hidden: boolean, heightAt: (x: number, z: number) => number): void {
    const body = this.body;
    const spec = KINDS[this.kind];
    if (!body || !spec) return;
    body.visible = !hidden;
    if (hidden) return;
    // Behind the player is the way they are not facing. (Yaw 0 looks north, -z.)
    const bx = Math.sin(player.heading);
    const bz = Math.cos(player.heading);
    if (spec.flies) {
      // Round and round the player's head, a little up and down, and now and then on their hat.
      const a = time * 1.3;
      const r = riding ? 0.5 : 0.9 + Math.sin(time * 0.37) * 0.35;
      this.at.set(player.x + Math.sin(a) * r, player.y + (riding ? 1.75 : 1.9) + Math.sin(time * 2.3) * 0.12, player.z + Math.cos(a) * r);
      body.position.copy(this.at);
      body.rotation.set(0, a + Math.PI / 2, Math.sin(time * 18) * 0.12);
      return;
    }
    if (riding) {
      // Carried: on the pack, looking over the player's shoulder.
      body.position.set(player.x + bx * 0.3, player.y + 0.95, player.z + bz * 0.3);
      body.rotation.set(0, player.heading, 0);
      this.settled = false;
      return;
    }
    // At the player's side and half a step back, where it can be seen; it comes at its own pace, faster the further it has fallen behind.
    const wantX = player.x + bx * 0.5 + bz * 1.15;
    const wantZ = player.z + bz * 0.5 - bx * 1.15;
    if (!this.settled || Math.hypot(wantX - this.at.x, wantZ - this.at.z) > 30) {
      this.at.set(wantX, 0, wantZ);
      this.settled = true;
    }
    const dx = wantX - this.at.x;
    const dz = wantZ - this.at.z;
    const off = Math.hypot(dx, dz);
    const moving = off > 0.35;
    if (moving) {
      const pace = Math.min(off, (1.2 + off * 2.2) * dt);
      this.at.x += (dx / off) * pace;
      this.at.z += (dz / off) * pace;
      this.facing = Math.atan2(-dx, -dz);
      this.hop += dt * (7 + Math.min(6, off * 2));
    } else {
      // Standing by: it looks where the player looks.
      const turn = Math.atan2(Math.sin(player.heading - this.facing), Math.cos(player.heading - this.facing));
      this.facing += turn * Math.min(1, dt * 2);
    }
    const lift = moving ? Math.abs(Math.sin(this.hop)) * spec.tall * 0.45 : Math.max(0, Math.sin(time * 1.1)) * 0.02;
    body.position.set(this.at.x, heightAt(this.at.x, this.at.z) + lift, this.at.z);
    body.rotation.set(0, this.facing, 0);
  }
}
