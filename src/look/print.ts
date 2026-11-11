/**
 * What makes a thing look printed, apart from how it is lit (`material.ts`): a short list of
 * inks that every made thing is coloured from, and a dark line round its outline. The animals
 * came with both from the tool that makes them; this gives the same to everything built in the
 * game itself (buildings, lifts, trees, people, stones), so that the world is one print.
 *
 * No three.js here: colours are numbers and shapes are lists of corners, so it runs under Vitest.
 */

/** The ink of every outline: the navy of the lettering. */
export const OUTLINE = 0x22304a;

/**
 * The inks. A park poster has perhaps a dozen; a whole town needs more, or every house is the
 * same house. These are the interface's own colours, the animals' earths, and enough paint for
 * a street: several of each family, light to dark, and no two close together.
 */
export const INKS: readonly number[] = [
  // Snow as it lies on a roof (kept exactly: the courses of boards leave it smooth), paper, cream.
  0xf2f5fa, 0xfbf8ee, 0xf1e9cf, 0xe2c99a,
  // Greys, light to dark, and the navy.
  0xd3dae4, 0xa9b3c0, 0x7c8794, 0x5e6670, 0x3d4652, 0x2a2e36, 0x22304a,
  // Blues.
  0xc3d3ea, 0x8fa5cc, 0x7fa9b8, 0x2b62c9, 0x2b4a5e,
  // Greens: sage, leaf, pine, spruce.
  0xa9c98a, 0x6fa35c, 0x4f8a3f, 0x2f6b4f, 0x1f4a44,
  // Yellows and oranges.
  0xf2d16b, 0xe3b03f, 0xc98f1f, 0xd9772b,
  // Reds and pinks, and a face.
  0xf0c9a4, 0xe8a79a, 0xc8402d, 0xb3472d, 0x8f2f2a, 0x7a3340,
  // Browns: tan, saddle, umber, bark.
  0xc9a36b, 0xa9763f, 0x9a7b5c, 0x7a5236, 0x5a3f2c, 0x4a3326,
  // Plum, for the odd front door.
  0x7a4fa3,
];

const known = new Map<number, number>();

/** The ink nearest a colour. */
export function inkFor(colour: number): number {
  const had = known.get(colour);
  if (had !== undefined) return had;
  const r = (colour >> 16) & 255;
  const g = (colour >> 8) & 255;
  const b = colour & 255;
  let best = INKS[0] as number;
  let least = Infinity;
  for (const ink of INKS) {
    const dr = ((ink >> 16) & 255) - r;
    const dg = ((ink >> 8) & 255) - g;
    const db = (ink & 255) - b;
    // As the eye weighs them: green most, blue least; and a little extra for getting the
    // lightness wrong, so that a pale wall stays pale and trim stays darker than what it trims.
    const light = (dr * 3 + dg * 6 + db) / 10;
    const d = dr * dr * 3 + dg * dg * 4 + db * db * 2 + light * light * 2;
    if (d < least) {
      least = d;
      best = ink;
    }
  }
  known.set(colour, best);
  return best;
}

/**
 * The outline of a shape: the same shape a little larger, turned inside out. Drawn with the
 * shape, only the far side of it shows, as a dark rim round the near one. It is part of the
 * same mesh, so it costs triangles but no draw call.
 *
 * @param corners the shape's triangles, three corners each, three numbers a corner
 * @param width how far the rim stands out, in the shape's own units
 * @returns the rim's triangles, in the same form, wound the other way
 */
export function rim(corners: ArrayLike<number>, width: number): Float32Array {
  const count = corners.length / 3;
  // Corners that are in the same place move together, or the rim would come apart at its edges.
  const place = new Map<string, number>();
  const where = new Int32Array(count);
  const sums: number[] = [];
  const faces: number[][] = [];
  for (let i = 0; i < count; i++) {
    const key = `${Math.round((corners[i * 3] as number) * 1000)},${Math.round((corners[i * 3 + 1] as number) * 1000)},${Math.round((corners[i * 3 + 2] as number) * 1000)}`;
    let at = place.get(key);
    if (at === undefined) {
      at = sums.length / 3;
      place.set(key, at);
      sums.push(0, 0, 0);
      faces.push([]);
    }
    where[i] = at;
  }
  // The way each face looks, counted once at each of its corners however many triangles the face is cut into.
  for (let t = 0; t + 2 < count; t += 3) {
    const ax = corners[t * 3] as number;
    const ay = corners[t * 3 + 1] as number;
    const az = corners[t * 3 + 2] as number;
    const ux = (corners[t * 3 + 3] as number) - ax;
    const uy = (corners[t * 3 + 4] as number) - ay;
    const uz = (corners[t * 3 + 5] as number) - az;
    const vx = (corners[t * 3 + 6] as number) - ax;
    const vy = (corners[t * 3 + 7] as number) - ay;
    const vz = (corners[t * 3 + 8] as number) - az;
    let nx = uy * vz - uz * vy;
    let ny = uz * vx - ux * vz;
    let nz = ux * vy - uy * vx;
    const len = Math.hypot(nx, ny, nz);
    if (len < 1e-12) continue;
    nx /= len;
    ny /= len;
    nz /= len;
    for (let k = 0; k < 3; k++) {
      const at = where[t + k] as number;
      const seen = faces[at] as number[];
      let fresh = true;
      for (let f = 0; f < seen.length; f += 3) {
        if ((seen[f] as number) * nx + (seen[f + 1] as number) * ny + (seen[f + 2] as number) * nz > 0.999) {
          fresh = false;
          break;
        }
      }
      if (!fresh) continue;
      seen.push(nx, ny, nz);
      sums[at * 3] = (sums[at * 3] as number) + nx;
      sums[at * 3 + 1] = (sums[at * 3 + 1] as number) + ny;
      sums[at * 3 + 2] = (sums[at * 3 + 2] as number) + nz;
    }
  }
  // Each place moves outward far enough that every face meeting there is `width` further out:
  // a square corner moves along its diagonal by more than `width`, as a mitre does.
  const moves = new Float32Array(sums.length);
  for (let at = 0; at < faces.length; at++) {
    const sx = sums[at * 3] as number;
    const sy = sums[at * 3 + 1] as number;
    const sz = sums[at * 3 + 2] as number;
    const len = Math.hypot(sx, sy, sz);
    if (len < 1e-9) continue;
    const seen = faces[at] as number[];
    let lean = 0;
    for (let f = 0; f < seen.length; f += 3) lean += ((seen[f] as number) * sx + (seen[f + 1] as number) * sy + (seen[f + 2] as number) * sz) / len;
    // A needle-sharp corner would shoot off: it is held to two and a half widths.
    const far = width / Math.max(0.4, lean / (seen.length / 3));
    moves[at * 3] = (sx / len) * far;
    moves[at * 3 + 1] = (sy / len) * far;
    moves[at * 3 + 2] = (sz / len) * far;
  }
  const out = new Float32Array(corners.length);
  for (let t = 0; t + 2 < count; t += 3) {
    // Second and third corners change places: the triangle now faces inward.
    const order = [t, t + 2, t + 1];
    for (let k = 0; k < 3; k++) {
      const from = order[k] as number;
      const at = where[from] as number;
      out[(t + k) * 3] = (corners[from * 3] as number) + (moves[at * 3] as number);
      out[(t + k) * 3 + 1] = (corners[from * 3 + 1] as number) + (moves[at * 3 + 1] as number);
      out[(t + k) * 3 + 2] = (corners[from * 3 + 2] as number) + (moves[at * 3 + 2] as number);
    }
  }
  return out;
}

/**
 * Whether a block is worth a rim: one that makes part of the outline of what it belongs to.
 * A post, a rail or a pane is a line already, and a rim would only thicken it.
 */
export function rimmed(sizeX: number, sizeY: number, sizeZ: number): boolean {
  const [small, middle, large] = [Math.abs(sizeX), Math.abs(sizeY), Math.abs(sizeZ)].sort((a, b) => a - b) as [number, number, number];
  return small >= 0.12 && middle >= 0.5 && large >= 1;
}
