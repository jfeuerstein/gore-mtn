import * as THREE from 'three/webgpu';
import { blocks, placed, roof, type Block } from './shapes';
import type { Place } from './trails';

export { PLACE_FOOTPRINT, PLACE_HEIGHT } from './placeSizes';

const TIMBER = 0x8a5a3c;
const TIMBER_DARK = 0x6b4530;
const STONE = 0x7d8494;
/** Roofs: under snow in winter, shingle the rest of the year. Set when the buildings are made. */
let ROOF_SNOW = 0xf2f5fa;
const TRIM = 0xf4ead8;
const DOOR = 0x4a3326;
const STEEL = 0x4d5666;
const RED = 0xa8392b;

/** Windows are drawn apart from the walls, in one colour that the time of day can change. */
interface Model {
  walls: THREE.BufferGeometry;
  windows: THREE.BufferGeometry;
}

/**
 * A lodge: stone footing, timber walls, a snow-covered pitched roof with deep eaves, a chimney,
 * and rows of windows on the long sides. Its long side faces z.
 */
function lodge(width: number, depth: number, storeys: number, wing = false): Model {
  const wallH = 3.4 * storeys;
  const base = 1.1;
  const list: Block[] = [
    { size: [width + 0.6, base, depth + 0.6], at: [0, base / 2, 0], colour: STONE },
    { size: [width, wallH, depth], at: [0, base + wallH / 2, 0], colour: TIMBER },
    // Corner posts and a band under the eaves.
    ...[-1, 1].flatMap((sx) => [-1, 1].map((sz): Block => ({ size: [0.5, wallH, 0.5], at: [(sx * width) / 2, base + wallH / 2, (sz * depth) / 2], colour: TIMBER_DARK }))),
    { size: [width + 0.3, 0.4, depth + 0.3], at: [0, base + wallH - 0.2, 0], colour: TIMBER_DARK },
    // Chimney, door and a deck along the front.
    { size: [1.5, wallH + 5, 1.5], at: [width * 0.3, base + (wallH + 5) / 2, -depth * 0.18], colour: STONE },
    { size: [1.9, 0.5, 1.9], at: [width * 0.3, base + wallH + 5.1, -depth * 0.18], colour: ROOF_SNOW },
    { size: [2.2, 2.9, 0.3], at: [-width * 0.12, base + 1.45, depth / 2 + 0.1], colour: DOOR },
    { size: [width * 0.7, 0.3, 3], at: [-width * 0.1, base + 0.05, depth / 2 + 1.5], colour: TIMBER_DARK },
    { size: [width * 0.7, 0.25, 3.1], at: [-width * 0.1, base + 0.32, depth / 2 + 1.5], colour: ROOF_SNOW },
  ];
  const roofH = depth * 0.42;
  const extra = [placed(roof(width + 2.4, depth + 3, roofH, ROOF_SNOW, TIMBER_DARK), 0, base + wallH, 0)];
  if (wing) {
    // A lower wing at right angles, as the bigger lodges have.
    const ww = width * 0.42;
    const wd = depth * 0.9;
    list.push(
      { size: [ww + 0.6, base, wd + 0.6], at: [-width * 0.42, base / 2, -depth * 0.75], colour: STONE },
      { size: [ww, wallH * 0.75, wd], at: [-width * 0.42, base + (wallH * 0.75) / 2, -depth * 0.75], colour: TIMBER },
    );
    extra.push(placed(roof(wd + 2, ww + 2.4, ww * 0.42, ROOF_SNOW, TIMBER_DARK), -width * 0.42, base + wallH * 0.75, -depth * 0.75, Math.PI / 2));
  }

  // Windows: a row per storey on both long sides, and a pair in each gable.
  const panes: Block[] = [];
  const count = Math.max(2, Math.floor(width / 3.6));
  for (let s = 0; s < storeys; s++) {
    const y = base + 1.9 + s * 3.4;
    for (let i = 0; i < count; i++) {
      const x = -width / 2 + ((i + 0.5) * width) / count;
      // Leave room for the door on the ground floor at the front.
      if (!(s === 0 && Math.abs(x + width * 0.12) < 2)) panes.push({ size: [1.5, 1.5, 0.2], at: [x, y, depth / 2 + 0.06], colour: 0xffffff });
      panes.push({ size: [1.5, 1.5, 0.2], at: [x, y, -depth / 2 - 0.06], colour: 0xffffff });
    }
    for (const sx of [-1, 1]) {
      for (const z of [-depth * 0.22, depth * 0.22]) panes.push({ size: [0.2, 1.5, 1.5], at: [sx * (width / 2 + 0.06), y, z], colour: 0xffffff });
    }
  }
  return { walls: blocks(list, extra), windows: blocks(panes) };
}

/** A small warming hut: one room, one window each side. */
function hut(): Model {
  return lodge(7, 5.5, 1);
}

/** North Creek's depot: a long, low station with a wide platform roof and a sign. */
function depot(): Model {
  const m = lodge(26, 8, 1);
  const extra = blocks([
    { size: [34, 0.5, 4.5], at: [0, 0.25, 6.6], colour: STONE },
    { size: [34, 0.3, 5], at: [0, 4.3, 6.4], colour: TIMBER_DARK },
    { size: [34.4, 0.35, 5.4], at: [0, 4.62, 6.4], colour: ROOF_SNOW },
    ...[-14, -7, 0, 7, 14].map((x): Block => ({ size: [0.35, 4, 0.35], at: [x, 2.2, 8.4], colour: TIMBER_DARK })),
    { size: [7, 1.1, 0.25], at: [0, 5.6, 4.3], colour: TRIM },
  ]);
  return { walls: blocks([], [m.walls, extra]), windows: m.windows };
}

/** The summit fire tower: four splayed legs, cross braces, and a cab with a roof on top. */
function fireTower(): Model {
  const height = 18;
  const list: Block[] = [];
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      list.push({ size: [0.3, height, 0.3], at: [sx * 1.9, height / 2, sz * 1.9], colour: STEEL });
    }
  }
  for (let y = 3; y < height; y += 3.6) {
    for (const s of [-1, 1]) {
      list.push({ size: [4.1, 0.16, 0.16], at: [0, y, s * 1.9], colour: STEEL }, { size: [0.16, 0.16, 4.1], at: [s * 1.9, y, 0], colour: STEEL });
    }
  }
  list.push(
    { size: [5, 0.3, 5], at: [0, height, 0], colour: TIMBER_DARK },
    { size: [4.2, 2.4, 4.2], at: [0, height + 1.35, 0], colour: RED },
    { size: [5.2, 0.3, 5.2], at: [0, height + 2.7, 0], colour: TIMBER_DARK },
  );
  const cap = placed(roof(5.2, 5.2, 1.6, ROOF_SNOW, RED), 0, height + 2.85, 0);
  const panes: Block[] = [];
  for (const s of [-1, 1]) {
    panes.push({ size: [3.2, 1.1, 0.12], at: [0, height + 1.6, s * 2.12], colour: 0xffffff }, { size: [0.12, 1.1, 3.2], at: [s * 2.12, height + 1.6, 0], colour: 0xffffff });
  }
  return { walls: blocks(list, [cap]), windows: blocks(panes) };
}

const MODELS: Record<string, () => Model> = {
  'base-lodge': () => lodge(44, 16, 2, true),
  'saddle-lodge': () => lodge(22, 11, 1, true),
  'gore-mountain-lodge': () => lodge(30, 13, 2),
  'ski-bowl-lodge': () => lodge(24, 11, 2),
  'warming-hut': hut,
  'warming-hut-2': hut,
  depot,
  summit: fireTower,
};

/** Dark glass by day; lamplight after dark. */
const GLASS_DARK = new THREE.Color(0x3d4a5e);
const GLASS_LIT = new THREE.Color(0xffc56e);

/** The lodges, huts, depot and fire tower, each standing at its real place. */
export class Buildings {
  readonly group = new THREE.Group();
  private readonly glass = new THREE.MeshBasicMaterial({ color: GLASS_DARK.getHex(), vertexColors: true });

  /** @param roof the colour of the roofs: snow, or shingle */
  constructor(places: readonly Place[], castShadow: boolean, roof = 0xf2f5fa) {
    this.group.name = 'buildings';
    ROOF_SNOW = roof;
    const walls = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });
    for (const place of places) {
      const make = MODELS[place.id];
      if (!make) continue;
      const model = make();
      const body = new THREE.Mesh(model.walls, walls);
      body.castShadow = castShadow;
      body.receiveShadow = true;
      const panes = new THREE.Mesh(model.windows, this.glass);
      for (const mesh of [body, panes]) {
        // Sunk a little, so the footing meets the snow on sloping ground.
        mesh.position.set(place.x, place.y - 0.8, place.z);
        mesh.matrixAutoUpdate = false;
        mesh.updateMatrix();
        this.group.add(mesh);
      }
    }
  }

  /** How lit the windows are: 0 by day, 1 after dark. */
  setLamps(amount: number): void {
    this.glass.color.copy(GLASS_DARK).lerp(GLASS_LIT, Math.min(1, Math.max(0, amount)));
  }
}
