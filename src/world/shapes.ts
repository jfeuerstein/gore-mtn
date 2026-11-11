import * as THREE from 'three/webgpu';

/** One coloured block of a model. Sizes and positions are in the model's own units. */
export interface Block {
  size: [number, number, number];
  at: [number, number, number];
  colour: number;
  /** Turn about the upright axis, in radians. */
  turn?: number;
  /** Tip about the left-to-right axis, in radians. */
  tip?: number;
}

/**
 * Build one geometry out of coloured blocks. Models made this way draw in a single call, take
 * their colour from the vertices, and can be instanced. This is how the game's lodges, towers and
 * chairs are made: simple shapes, no asset files. Each also carries the coordinates `siding()`
 * needs, for the things that wear it.
 * @param course the height of one course of siding in the model's own units
 */
export function blocks(list: readonly Block[], extra: readonly THREE.BufferGeometry[] = [], course = COURSE): THREE.BufferGeometry {
  const positions: number[] = [];
  const normals: number[] = [];
  const colours: number[] = [];
  const uvs: number[] = [];
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const e = new THREE.Euler();
  const c = new THREE.Color();
  const add = (geo: THREE.BufferGeometry, colour: number | null): void => {
    const flat = geo.index ? geo.toNonIndexed() : geo;
    const p = flat.getAttribute('position');
    const n = flat.getAttribute('normal');
    const own = flat.getAttribute('color');
    // A piece made here before keeps the courses it was given then, however it has been turned since.
    const laid = colour === null ? flat.getAttribute('uv') : undefined;
    if (colour !== null) c.setHex(colour);
    for (let i = 0; i < p.count; i++) {
      positions.push(p.getX(i), p.getY(i), p.getZ(i));
      normals.push(n.getX(i), n.getY(i), n.getZ(i));
      if (colour !== null) colours.push(c.r, c.g, c.b);
      else colours.push(own.getX(i), own.getY(i), own.getZ(i));
      // Courses run level round the walls, and across a roof or a floor from front to back.
      // Snow has none: whatever is snow-coloured is left smooth.
      const r = colours[colours.length - 3] as number;
      const g = colours[colours.length - 2] as number;
      const b = colours[colours.length - 1] as number;
      const snow = Math.abs(r - SNOW.r) + Math.abs(g - SNOW.g) + Math.abs(b - SNOW.b) < 0.004;
      if (laid) uvs.push(laid.getX(i), laid.getY(i));
      else if (snow) uvs.push(0, SMOOTH);
      else uvs.push(0, (Math.abs(n.getY(i)) > 0.5 ? p.getZ(i) : p.getY(i)) / course);
    }
  };
  for (const b of list) {
    const geo = new THREE.BoxGeometry(b.size[0], b.size[1], b.size[2]);
    q.setFromEuler(e.set(b.tip ?? 0, b.turn ?? 0, 0, 'YXZ'));
    geo.applyMatrix4(m.compose(new THREE.Vector3(...b.at), q, new THREE.Vector3(1, 1, 1)));
    add(geo, b.colour);
  }
  // Ready-made pieces (which must carry their own colours) are appended as they are.
  for (const geo of extra) add(geo, null);
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  out.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  out.setAttribute('color', new THREE.Float32BufferAttribute(colours, 3));
  out.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  out.computeBoundingSphere();
  return out;
}

/** The colour of snow on a roof, which wears no courses, and the place on the texture that is smooth. */
const SNOW = new THREE.Color(0xf2f5fa);
const SMOOTH = 0.03;

/** The height of one course of boards, shingles or bricks, in metres: what `siding()` repeats over. */
export const COURSE = 0.32;

let boards: THREE.Texture | null = null;

/**
 * A texture of courses for anything built: each a little darker toward its lower edge, with a
 * line of shadow under it, so walls read as clapboard and roofs as shingle. It only varies up
 * and down, multiplies whatever colour is under it, and is shared by everything that uses it.
 * Null where there is no canvas to draw it on.
 */
export function siding(): THREE.Texture | null {
  if (boards) return boards;
  if (typeof document === 'undefined') return null;
  const canvas = document.createElement('canvas');
  canvas.width = 4;
  canvas.height = 32;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  for (let y = 0; y < 32; y++) {
    // The top of the canvas is the top of a course.
    const shade = y >= 29 ? 0.7 : 1 - (y / 29) * 0.1;
    const v = Math.round(255 * shade);
    ctx.fillStyle = `rgb(${v}, ${v}, ${v})`;
    ctx.fillRect(0, y, 4, 1);
  }
  boards = new THREE.CanvasTexture(canvas);
  boards.wrapS = boards.wrapT = THREE.RepeatWrapping;
  boards.colorSpace = THREE.SRGBColorSpace;
  boards.anisotropy = 4;
  return boards;
}

/**
 * A pitched roof: a triangular prism with its ridge along x, sitting with its eaves at y = 0.
 * Coloured `top` on the slopes and `end` on the gables.
 */
export function roof(width: number, depth: number, height: number, top: number, end: number): THREE.BufferGeometry {
  const w = width / 2;
  const d = depth / 2;
  const positions = [
    // South slope, north slope.
    -w, 0, d, w, 0, d, w, height, 0, -w, 0, d, w, height, 0, -w, height, 0,
    w, 0, -d, -w, 0, -d, -w, height, 0, w, 0, -d, -w, height, 0, w, height, 0,
    // Gables.
    -w, 0, -d, -w, 0, d, -w, height, 0, w, 0, d, w, 0, -d, w, height, 0,
    // Underside, so it is closed when seen from below the eaves.
    -w, 0, -d, w, 0, -d, w, 0, d, -w, 0, -d, w, 0, d, -w, 0, d,
  ];
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.computeVertexNormals();
  const a = new THREE.Color(top);
  const b = new THREE.Color(end);
  const colours: number[] = [];
  for (let v = 0; v < positions.length / 3; v++) {
    const colour = v < 12 ? a : b;
    colours.push(colour.r, colour.g, colour.b);
  }
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colours, 3));
  return geo;
}

/** A geometry moved, and optionally turned about the upright axis. Returns the same geometry. */
export function placed(geo: THREE.BufferGeometry, x: number, y: number, z: number, turn = 0): THREE.BufferGeometry {
  if (turn !== 0) geo.rotateY(turn);
  geo.translate(x, y, z);
  return geo;
}
