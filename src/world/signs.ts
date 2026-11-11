import * as THREE from 'three/webgpu';

/** One painted sign: its words, where it hangs and which way it faces. */
export interface SignSpec {
  text: string;
  x: number;
  y: number;
  z: number;
  /** The way it faces, as a turn about the upright axis: 0 faces south (+z). */
  turn: number;
  /** Height of the board in metres, and the most it may be wide. A long name is painted smaller to fit. */
  height: number;
  maxWidth: number;
  /** A board of a set width, with the words in the middle of it, rather than one cut to fit its words. */
  width?: number;
  /** Board and lettering colours, as CSS. */
  board: string;
  ink: string;
  /** Painted on the back as well, for a sign on a post. */
  twoSided?: boolean;
}

const CELL = 64;
const ATLAS = 2048;

/**
 * Every sign in the game as one mesh. The words are painted once onto a single canvas, a strip
 * each, and each sign is a rectangle that shows its strip. One texture and one draw call, however
 * many signs there are.
 */
export async function buildSigns(specs: readonly SignSpec[]): Promise<THREE.Mesh | null> {
  if (specs.length === 0) return null;
  // The poster face the rest of the game uses. If it cannot be had, the browser's own will do.
  const face = '"Bebas Neue", "Arial Narrow", sans-serif';
  try {
    await Promise.race([document.fonts.load(`48px ${face}`), new Promise((done) => setTimeout(done, 1500))]);
  } catch {
    // Paint with what there is.
  }
  const canvas = document.createElement('canvas');
  canvas.width = ATLAS;
  canvas.height = ATLAS;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'center';

  // Lay the strips out in rows, one strip for each different sign. If they do not all fit on
  // the sheet at full size, everything is drawn a little smaller until they do, so that no
  // board is ever left bare.
  const keyOf = (s: SignSpec): string => `${s.text}|${s.board}|${s.ink}|${s.width ? (s.width / s.height).toFixed(2) : ''}`;
  const layOut = (scale: number): { strips: Map<string, { u: number; v: number; w: number; words: number }>; cell: number } | null => {
    const cell = Math.floor(CELL * scale);
    ctx.font = `${Math.round(46 * scale)}px ${face}`;
    const strips = new Map<string, { u: number; v: number; w: number; words: number }>();
    let cx = 0;
    let cy = 0;
    for (const s of specs) {
      const key = keyOf(s);
      if (strips.has(key)) continue;
      const words = ctx.measureText(s.text).width;
      const w = Math.min(ATLAS, Math.ceil(s.width ? (cell * s.width) / s.height : words + 44 * scale));
      if (cx + w > ATLAS) {
        cx = 0;
        cy += cell;
      }
      if (cy + cell > ATLAS) return null;
      strips.set(key, { u: cx, v: cy, w, words });
      cx += w;
    }
    return { strips, cell };
  };
  let scale = 1;
  let laid = layOut(scale);
  while (!laid && scale > 0.5) laid = layOut((scale *= 0.92));
  if (!laid) {
    console.warn('signs: too many for the sheet, even drawn small; none are painted');
    return null;
  }
  const { strips, cell } = laid;
  const painted = new Set<string>();
  for (const s of specs) {
    const key = keyOf(s);
    const strip = strips.get(key);
    if (!strip || painted.has(key)) continue;
    painted.add(key);
    const { u: cx, v: cy, w, words } = strip;
    ctx.fillStyle = s.board;
    ctx.fillRect(cx, cy, w, cell);
    // A painted border, set in from the edge.
    ctx.strokeStyle = s.ink;
    ctx.lineWidth = 3 * scale;
    ctx.strokeRect(cx + 5.5 * scale, cy + 5.5 * scale, w - 11 * scale, cell - 11 * scale);
    ctx.fillStyle = s.ink;
    // Words too long for a board of a set width are squeezed to fit it.
    const squeeze = Math.min(1, (w - 30 * scale) / words);
    ctx.save();
    ctx.translate(cx + w / 2, cy + cell / 2 + 3 * scale);
    ctx.scale(squeeze, 1);
    ctx.fillText(s.text, 0, 0);
    ctx.restore();
  }

  const positions: number[] = [];
  const normals: number[] = [];
  const uvs: number[] = [];
  for (const s of specs) {
    const strip = strips.get(keyOf(s));
    if (!strip) continue;
    let height = s.height;
    let width = (height * strip.w) / cell;
    if (width > s.maxWidth) {
      height *= s.maxWidth / width;
      width = s.maxWidth;
    }
    const u0 = strip.u / ATLAS;
    const u1 = (strip.u + strip.w) / ATLAS;
    const v0 = 1 - strip.v / ATLAS;
    const v1 = 1 - (strip.v + cell) / ATLAS;
    for (const turn of s.twoSided ? [s.turn, s.turn + Math.PI] : [s.turn]) {
      const cos = Math.cos(turn);
      const sin = Math.sin(turn);
      // A rectangle in its own x-y plane facing its +z, turned and set in place. Off its wall a little.
      const corner = (lx: number, ly: number): [number, number, number] => [s.x + lx * cos + 0.04 * sin, s.y + ly, s.z - lx * sin + 0.04 * cos];
      const a = corner(-width / 2, -height / 2);
      const b = corner(width / 2, -height / 2);
      const c = corner(width / 2, height / 2);
      const d = corner(-width / 2, height / 2);
      positions.push(...a, ...b, ...c, ...a, ...c, ...d);
      uvs.push(u0, v1, u1, v1, u1, v0, u0, v1, u1, v0, u0, v0);
      for (let i = 0; i < 6; i++) normals.push(sin, 0, cos);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  const mesh = new THREE.Mesh(geometry, new THREE.MeshLambertMaterial({ map: texture }));
  mesh.name = 'signs';
  mesh.matrixAutoUpdate = false;
  return mesh;
}
