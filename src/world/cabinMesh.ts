import * as THREE from 'three/webgpu';
import { SHELF_SLOTS, WALL_SLOTS, type CabinSave } from '../game/cabin';
import { isPrinted, lit } from '../look/material';
import { OUTLINE } from '../look/print';
import { CABIN, CHIMNEY, FEEDER, type CabinSite } from './cabin';
import { outlined } from './outline';
import { blocks, placed, roof, siding, type Block } from './shapes';

const LOG = 0x7a5236;
const PLANK = 0x9a7b5c;
const BARK = 0x5a3f2c;
const STONE = 0x7c8794;
const DOOR = 0xc8402d;

/** Where things are on the front wall, in the cabin's own frame: the shelf to the left of the door, the board to the right. */
const SHELF = { x: -2.2, y: 1.12, wide: 2.1 } as const;
const BOARD = { x: 2.2, y: 1.7, wide: 2.0, tall: 0.85 } as const;
/** How big a stone on the shelf and a patch on the board are, in metres. */
const STONE_SIZE = 0.3;
const PATCH_RADIUS = 0.27;

/**
 * The player's cabin: a log cabin with an open porch, a chimney and a woodpile, a shelf by the door
 * for stones, a board beside it for patches, and a feeder in the yard. The building is two
 * meshes (walls and windows); what is set out on it is a few more, there only when something
 * is: one for all the stones, one for each patch, one for whoever is at the feeder.
 */
export class Cabin {
  readonly group = new THREE.Group();
  private readonly glass = new THREE.MeshBasicMaterial({ color: 0x3d4a5e });
  private readonly dark = new THREE.Color(0x3d4a5e);
  private readonly lit = new THREE.Color(0xffd27a);
  private readonly stones: THREE.InstancedMesh;
  private readonly patches: THREE.Mesh[] = [];
  private readonly patchArt: string[] = [];
  private readonly guest: THREE.Mesh;
  private readonly guestLine: THREE.Mesh;
  private readonly loader = new THREE.TextureLoader();

  /**
   * @param roofColour what its roof wears this season: snow, or shingle
   */
  constructor(site: CabinSite, heightAt: (x: number, z: number) => number, roofColour: number, shadows: boolean, textured: boolean) {
    this.group.name = 'cabin';
    const floor = heightAt(site.x, site.z);
    this.group.position.set(site.x, floor, site.z);
    this.group.rotation.y = site.turn;
    const { w, d, porch, walls } = CABIN;
    const front = d / 2;
    // Everything that meets the ground goes on down below it, so that a slope leaves no gap.
    const DEEP = 3;
    const sunk = (size: [number, number, number], at: [number, number, number], colour: number): Block => ({ size: [size[0], size[1] + DEEP, size[2]], at: [at[0], at[1] - DEEP / 2, at[2]], colour });
    // The feeder stands on the yard's own ground, which is not the cabin's floor.
    const cos = Math.cos(site.turn);
    const sin = Math.sin(site.turn);
    const yard = heightAt(site.x + FEEDER.x * cos + FEEDER.z * sin, site.z - FEEDER.x * sin + FEEDER.z * cos) - floor;
    const list: Block[] = [
      sunk([w, walls, d], [0, walls / 2, 0], LOG),
      // The porch: an open deck with a step up to it and a rail post at each front corner. It has
      // no roof of its own: the camera looks down from behind, and a roof would hide the shelf and the board.
      sunk([w + 0.4, 0.3, porch], [0, 0, front + porch / 2], PLANK),
      sunk([1.7, 0.2, 0.55], [0, -0.2, front + porch + 0.27], PLANK),
      { size: [0.16, 0.95, 0.16], at: [-(w / 2) - 0.02, 0.62, front + porch - 0.14], colour: BARK },
      { size: [0.16, 0.95, 0.16], at: [w / 2 + 0.02, 0.62, front + porch - 0.14], colour: BARK },
      { size: [0.1, 0.1, porch - 0.2], at: [-(w / 2) - 0.02, 1.05, front + porch / 2], colour: BARK },
      { size: [0.1, 0.1, porch - 0.2], at: [w / 2 + 0.02, 1.05, front + porch / 2], colour: BARK },
      { size: [1.0, 2.0, 0.12], at: [0, 1.15, front + 0.03], colour: DOOR },
      { size: [0.1, 0.1, 0.08], at: [0.34, 1.12, front + 0.12], colour: 0xe3b03f },
      // The shelf and its brackets, and the board in its frame.
      { size: [SHELF.wide, 0.07, 0.36], at: [SHELF.x, SHELF.y, front + 0.18], colour: 0xc9a36b },
      { size: [0.06, 0.28, 0.3], at: [SHELF.x - 0.85, SHELF.y - 0.17, front + 0.15], colour: BARK },
      { size: [0.06, 0.28, 0.3], at: [SHELF.x + 0.85, SHELF.y - 0.17, front + 0.15], colour: BARK },
      { size: [BOARD.wide, BOARD.tall, 0.07], at: [BOARD.x, BOARD.y, front + 0.035], colour: 0xf1e9cf },
      { size: [BOARD.wide + 0.12, 0.07, 0.1], at: [BOARD.x, BOARD.y + BOARD.tall / 2 + 0.03, front + 0.05], colour: BARK },
      { size: [BOARD.wide + 0.12, 0.07, 0.1], at: [BOARD.x, BOARD.y - BOARD.tall / 2 - 0.03, front + 0.05], colour: BARK },
      // A stone chimney up through the roof at the back, and a woodpile against the side wall.
      sunk([0.95, CHIMNEY.top, 0.95], [CHIMNEY.x, CHIMNEY.top / 2, CHIMNEY.z], STONE),
      sunk([0.7, 1.0, 2.4], [w / 2 + 0.42, 0.5, -0.5], BARK),
      // The feeder: a post, a tray, two little posts and a red roof.
      sunk([0.1, FEEDER.tray, 0.1], [FEEDER.x, yard + FEEDER.tray / 2, FEEDER.z], BARK),
      { size: [0.58, 0.06, 0.58], at: [FEEDER.x, yard + FEEDER.tray, FEEDER.z], colour: 0xc9a36b },
      { size: [0.04, 0.42, 0.04], at: [FEEDER.x - 0.22, yard + FEEDER.tray + 0.22, FEEDER.z], colour: BARK },
      { size: [0.04, 0.42, 0.04], at: [FEEDER.x + 0.22, yard + FEEDER.tray + 0.22, FEEDER.z], colour: BARK },
      { size: [0.74, 0.07, 0.74], at: [FEEDER.x, yard + FEEDER.tray + 0.46, FEEDER.z], colour: DOOR },
    ];
    // The eaves stand out only a little at the front, for the same reason.
    const top = placed(roof(w + 0.9, d + 0.7, CABIN.roof, roofColour, LOG), 0, walls, 0);
    const body = new THREE.Mesh(blocks(list, [top]), lit({ vertexColors: true, flatShading: true, map: textured ? siding() : null }));
    body.castShadow = shadows;
    body.receiveShadow = true;
    // A window in each side wall, lit after dark like any other.
    const panes = new THREE.Mesh(
      blocks(
        [
          { size: [0.06, 0.95, 1.2], at: [-(w / 2) - 0.02, 1.6, 0.9], colour: 0xffffff },
          { size: [0.06, 0.95, 1.2], at: [w / 2 + 0.02, 1.6, 1.4], colour: 0xffffff },
          { size: [0.42, 0.42, 0.04], at: [0, 1.75, front + 0.1], colour: 0xffffff },
        ],
        [],
        undefined,
        0,
      ),
      this.glass,
    );
    this.group.add(body, panes);

    // What is set out. The stones are one mesh, coloured each by its mineral.
    const printed = isPrinted();
    const gem = new THREE.OctahedronGeometry(0.5, 0);
    gem.scale(0.62, 1, 0.62);
    this.stones = new THREE.InstancedMesh(printed ? outlined(gem, 0.05) : gem, lit({ color: 0xffffff, vertexColors: printed }), SHELF_SLOTS);
    this.stones.castShadow = shadows;
    const tint = new THREE.Color(0xffffff);
    for (let i = 0; i < SHELF_SLOTS; i++) this.stones.setColorAt(i, tint);
    this.stones.count = 0;
    this.stones.frustumCulled = false;
    this.group.add(this.stones);
    // The patches are a disc each, wearing its picture.
    const disc = new THREE.CircleGeometry(PATCH_RADIUS, 24);
    // The picture has a little bare margin round the patch: the disc takes the patch alone.
    const uv = disc.getAttribute('uv');
    for (let i = 0; i < uv.count; i++) uv.setXY(i, 0.5 + (uv.getX(i) - 0.5) * 0.9, 0.5 + (uv.getY(i) - 0.5) * 0.9);
    for (let i = 0; i < WALL_SLOTS; i++) {
      const patch = new THREE.Mesh(disc, lit({ color: 0xffffff }));
      patch.position.set(BOARD.x + (i - (WALL_SLOTS - 1) / 2) * 0.64, BOARD.y, front + 0.08);
      patch.visible = false;
      this.patches.push(patch);
      this.patchArt.push('');
      this.group.add(patch);
    }
    // Whoever is at the feeder, with the line round them that every creature has.
    this.guest = new THREE.Mesh(new THREE.BufferGeometry(), lit({ vertexColors: true, flatShading: true }));
    this.guestLine = new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshBasicMaterial({ color: OUTLINE, side: THREE.BackSide }));
    this.guest.add(this.guestLine);
    this.guest.position.set(FEEDER.x, yard + FEEDER.tray + 0.03, FEEDER.z);
    // The field guide's models are made large, to be seen across a slope. On a feeder, a bird is bird-sized.
    this.guest.scale.setScalar(0.4);
    this.guest.rotation.y = Math.PI / 2;
    this.guest.castShadow = shadows;
    this.guest.visible = false;
    this.group.add(this.guest);
  }

  /** Light the windows, 0 by day to 1 after dark. */
  setLamps(amount: number): void {
    this.glass.color.copy(this.dark).lerp(this.lit, Math.min(1, Math.max(0, amount)));
  }

  /**
   * Set out what the save says is on the shelf and the board.
   * @param colourOf a mineral's colour, by id
   * @param artOf where a patch's picture is, by id
   */
  show(cabin: CabinSave, colourOf: (id: string) => number, artOf: (id: string) => string): void {
    const m = new THREE.Matrix4();
    const tint = new THREE.Color();
    let n = 0;
    cabin.shelf.forEach((id, i) => {
      if (id === '' || i >= SHELF_SLOTS) return;
      // Each has its own place along the shelf, whether or not its neighbours are there.
      const x = SHELF.x + (i - (SHELF_SLOTS - 1) / 2) * 0.4;
      m.makeScale(STONE_SIZE, STONE_SIZE, STONE_SIZE).setPosition(x, SHELF.y + 0.035 + STONE_SIZE / 2, CABIN.d / 2 + 0.18);
      this.stones.setMatrixAt(n, m);
      this.stones.setColorAt(n, tint.setHex(colourOf(id)));
      n++;
    });
    this.stones.count = n;
    this.stones.instanceMatrix.needsUpdate = true;
    if (this.stones.instanceColor) this.stones.instanceColor.needsUpdate = true;
    this.patches.forEach((patch, i) => {
      const id = cabin.wall[i] ?? '';
      patch.visible = id !== '';
      if (id === '' || this.patchArt[i] === id) return;
      this.patchArt[i] = id;
      const material = patch.material as THREE.MeshLambertMaterial;
      this.loader.load(artOf(id), (texture) => {
        // A slow picture may arrive after the place has been given to another.
        if (this.patchArt[i] !== id) return texture.dispose();
        texture.colorSpace = THREE.SRGBColorSpace;
        material.map?.dispose();
        material.map = texture;
        material.needsUpdate = true;
      });
    });
  }

  /** Put somebody on the feeder, or nobody. */
  setGuest(geometry: THREE.BufferGeometry | null): void {
    this.guest.visible = geometry !== null;
    if (!geometry) return;
    this.guest.geometry = geometry;
    const shell = geometry.userData.shell as THREE.BufferGeometry | null | undefined;
    this.guestLine.visible = Boolean(shell);
    if (shell) this.guestLine.geometry = shell;
  }

  get hasGuest(): boolean {
    return this.guest.visible;
  }
}
