import * as THREE from 'three/webgpu';
import { MOST_PER_PATCH, type Find } from '../game/minerals';
import { isPrinted, lit } from '../look/material';
import { outlined } from './outline';

/** How tall a find is drawn, in metres: far larger than life, so it can be seen from the camera. */
const GEM_HEIGHT = 1;
/** How far across the twinkle over a find is at its fullest. */
const STAR_SIZE = 1.5;
/** How far above the snow a find hovers. */
const HOVER = 0.85;
/** Seconds a find takes to rise and vanish when picked up. */
const LEAVE = 0.45;
/** Most finds that can be on show at once: nine patches' worth, with room for a few on their way out. */
const CAPACITY = 9 * MOST_PER_PATCH + 24;

interface Gem {
  x: number;
  y: number;
  z: number;
  phase: number;
  colour: number;
  /** Seconds since it was picked up, or -1 while it lies waiting. */
  leaving: number;
}

/** A cut stone: two pyramids base to base, taller than wide, flat-faced so the light picks out each face. */
function gemGeometry(): THREE.BufferGeometry {
  const geometry = new THREE.OctahedronGeometry(0.5, 0);
  geometry.scale(0.62, 1, 0.62);
  return geometry;
}

/** A four-pointed star in the upright plane, for the twinkle over a find. */
function starGeometry(): THREE.BufferGeometry {
  const long = 0.5;
  const thin = 0.07;
  // Two thin diamonds crossed: one upright, one lying across.
  const positions = [0, long, 0, -thin, 0, 0, thin, 0, 0, 0, -long, 0, thin, 0, 0, -thin, 0, 0, long, 0, 0, 0, thin, 0, 0, -thin, 0, -long, 0, 0, 0, -thin, 0, 0, thin, 0];
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.computeVertexNormals();
  return geometry;
}

/** Write a turn about the upright axis, a size and a place into an instance's matrix. */
function setMatrix(out: ArrayLike<number> & { [i: number]: number }, at: number, x: number, y: number, z: number, yaw: number, wide: number, tall: number): void {
  const o = at * 16;
  const c = Math.cos(yaw) * wide;
  const s = Math.sin(yaw) * wide;
  out[o] = c;
  out[o + 1] = 0;
  out[o + 2] = -s;
  out[o + 3] = 0;
  out[o + 4] = 0;
  out[o + 5] = tall;
  out[o + 6] = 0;
  out[o + 7] = 0;
  out[o + 8] = s;
  out[o + 9] = 0;
  out[o + 10] = c;
  out[o + 11] = 0;
  out[o + 12] = x;
  out[o + 13] = y;
  out[o + 14] = z;
  out[o + 15] = 1;
}

/**
 * The day's finds near the player, drawn as stones hovering over the snow, each in its mineral's
 * colour with a gold twinkle above it so it can be spotted on white snow and after dark. Two draw
 * calls in all: one instanced mesh for the stones, coloured per instance, and one for the
 * twinkles. Only the finds within a patch or so of the player exist at all.
 */
export class Glints {
  readonly group = new THREE.Group();
  private readonly stones: THREE.InstancedMesh;
  private readonly stars: THREE.InstancedMesh;
  private readonly gems: Gem[] = [];
  private shown: readonly Find[] | null = null;
  private time = 0;
  private readonly tint = new THREE.Color();
  /** Set when the stones on show have changed, so their colours are written again. */
  private recolour = true;

  constructor(castShadow: boolean) {
    this.group.name = 'glints';
    // Printed, a stone has a dark line round it, as everything has: the line is part of the stone's own shape.
    const printed = isPrinted();
    this.stones = new THREE.InstancedMesh(printed ? outlined(gemGeometry(), 0.045) : gemGeometry(), lit({ color: 0xffffff, vertexColors: printed }), CAPACITY);
    this.stones.name = 'glint-stones';
    this.stones.castShadow = castShadow;
    // Give every instance a colour from the start, so the colour buffer exists before the first draw.
    for (let i = 0; i < CAPACITY; i++) this.stones.setColorAt(i, this.tint.set(0xffffff));
    // Unlit, so it shows at night; gold, so it shows against snow by day.
    this.stars = new THREE.InstancedMesh(starGeometry(), new THREE.MeshBasicMaterial({ color: 0xffc23d, side: THREE.DoubleSide }), CAPACITY);
    this.stars.name = 'glint-stars';
    for (const mesh of [this.stones, this.stars]) {
      mesh.count = 0;
      mesh.visible = false;
      // The instances are spread over a wide area that moves with the player.
      mesh.frustumCulled = false;
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      this.group.add(mesh);
    }
  }

  /** How many finds are on show. */
  get count(): number {
    return this.shown?.length ?? 0;
  }

  /**
   * Show these finds. Cheap to call every frame: nothing happens unless the list is a new one.
   * @param heightAt the ground the finds lie on
   */
  show(finds: readonly Find[], heightAt: (x: number, z: number) => number): void {
    if (finds === this.shown) return;
    this.shown = finds;
    // Keep any that are on their way out; replace the rest.
    let kept = 0;
    for (const gem of this.gems) if (gem.leaving >= 0) this.gems[kept++] = gem;
    this.gems.length = kept;
    for (const find of finds) {
      if (this.gems.length >= CAPACITY) break;
      // The phase comes from the place, so a find turns the same way each time it is shown.
      const phase = (((find.x * 0.37 + find.z * 0.73) % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
      this.gems.push({ x: find.x, y: heightAt(find.x, find.z), z: find.z, phase, colour: find.mineral.colour, leaving: -1 });
    }
    this.recolour = true;
  }

  /** A find has been picked up: send it off with a little rise and spin. */
  pickedUp(find: Find, heightAt: (x: number, z: number) => number): void {
    if (this.gems.length >= CAPACITY) return;
    this.gems.push({ x: find.x, y: heightAt(find.x, find.z), z: find.z, phase: 0, colour: find.mineral.colour, leaving: 0 });
    this.recolour = true;
  }

  /** @param cameraYaw so the twinkles face the camera */
  update(dt: number, cameraYaw: number): void {
    this.time += dt;
    const t = this.time;
    const gems = this.gems;
    // Drop the ones that have finished leaving.
    let kept = 0;
    for (const gem of gems) {
      if (gem.leaving >= 0) gem.leaving += dt;
      if (gem.leaving < LEAVE) gems[kept++] = gem;
    }
    if (kept < gems.length) {
      gems.length = kept;
      this.recolour = true;
    }
    const stones = this.stones.instanceMatrix.array;
    const stars = this.stars.instanceMatrix.array;
    for (let i = 0; i < gems.length; i++) {
      const gem = gems[i] as Gem;
      let rise = Math.sin(t * 1.7 + gem.phase) * 0.08;
      let size = 1;
      let spin = t * 1.1 + gem.phase;
      if (gem.leaving >= 0) {
        const k = gem.leaving / LEAVE;
        rise = k * 2.2;
        size = 1 - k * k;
        spin = t * 9;
      }
      setMatrix(stones, i, gem.x, gem.y + HOVER + rise, gem.z, spin, GEM_HEIGHT * size, GEM_HEIGHT * size);
      // The twinkle swells and fades, each find in its own time.
      const twinkle = (0.72 + 0.28 * Math.sin(t * 3.1 + gem.phase * 3)) * size * STAR_SIZE;
      setMatrix(stars, i, gem.x, gem.y + HOVER + rise + GEM_HEIGHT * 0.5 + STAR_SIZE * 0.42, gem.z, cameraYaw, twinkle, twinkle);
      if (this.recolour) this.stones.setColorAt(i, this.tint.set(gem.colour));
    }
    for (const mesh of [this.stones, this.stars]) {
      mesh.count = gems.length;
      mesh.visible = gems.length > 0;
      mesh.instanceMatrix.needsUpdate = true;
    }
    if (this.recolour && this.stones.instanceColor) this.stones.instanceColor.needsUpdate = true;
    this.recolour = false;
  }
}
