import * as THREE from 'three/webgpu';
import { lit } from '../look/material';

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
  /**
   * A trail's mark, painted as a shape in its own colour: at the left of the words, or, on a
   * sign with no words, large in the middle. `lift` is a red disc with a chevron.
   */
  mark?: 'easy' | 'intermediate' | 'advanced' | 'expert' | 'freeride' | 'lift';
}

/** A trail's mark, as on any ski mountain: green circle, blue square, black diamond, two for experts only, an orange oval for the park. */
const MARK_INK: Record<NonNullable<SignSpec['mark']>, string> = { easy: '#2f8a4e', intermediate: '#2b5fb5', advanced: '#1d2026', expert: '#1d2026', freeride: '#d9822b', lift: '#c8402d' };

/** Paint a mark about (x, y), `size` across, with the print's dark line round it. */
function paintMark(ctx: CanvasRenderingContext2D, mark: NonNullable<SignSpec['mark']>, x: number, y: number, size: number, line: string): void {
  const r = size / 2;
  ctx.save();
  ctx.fillStyle = MARK_INK[mark];
  ctx.strokeStyle = line;
  ctx.lineWidth = Math.max(1.5, size * 0.07);
  ctx.lineJoin = 'round';
  const diamond = (cx: number, half: number): void => {
    ctx.beginPath();
    ctx.moveTo(cx, y - half);
    ctx.lineTo(cx + half * 0.82, y);
    ctx.lineTo(cx, y + half);
    ctx.lineTo(cx - half * 0.82, y);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  };
  if (mark === 'easy' || mark === 'lift') {
    ctx.beginPath();
    ctx.arc(x, y, r * 0.92, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    if (mark === 'lift') {
      // A chevron: up.
      ctx.strokeStyle = '#fffdf7';
      ctx.lineWidth = size * 0.13;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(x - r * 0.42, y + r * 0.2);
      ctx.lineTo(x, y - r * 0.28);
      ctx.lineTo(x + r * 0.42, y + r * 0.2);
      ctx.stroke();
    }
  } else if (mark === 'intermediate') {
    ctx.beginPath();
    ctx.rect(x - r * 0.82, y - r * 0.82, r * 1.64, r * 1.64);
    ctx.fill();
    ctx.stroke();
  } else if (mark === 'advanced') {
    diamond(x, r);
  } else if (mark === 'expert') {
    diamond(x - r * 0.52, r * 0.78);
    diamond(x + r * 0.52, r * 0.78);
  } else {
    ctx.beginPath();
    ctx.ellipse(x, y, r * 1.05, r * 0.66, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }
  ctx.restore();
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
  const keyOf = (s: SignSpec): string => `${s.text}|${s.board}|${s.ink}|${s.width ? (s.width / s.height).toFixed(2) : ''}|${s.mark ?? ''}`;
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
    // A mark with no words fills its panel; beside words it sits at their left, and they take the rest.
    const room = s.mark && s.text ? cell * 0.92 : 0;
    if (s.mark) paintMark(ctx, s.mark, s.text ? cx + 12 * scale + room / 2 : cx + w / 2, cy + cell / 2, s.text ? cell * 0.56 : cell * 0.72, s.ink);
    ctx.fillStyle = s.ink;
    // Words too long for a board of a set width are squeezed to fit it.
    const squeeze = Math.min(1, (w - 30 * scale - room) / words);
    ctx.save();
    ctx.translate(cx + (w + room) / 2, cy + cell / 2 + 3 * scale);
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
  const mesh = new THREE.Mesh(geometry, lit({ map: texture }));
  mesh.name = 'signs';
  mesh.matrixAutoUpdate = false;
  return mesh;
}
