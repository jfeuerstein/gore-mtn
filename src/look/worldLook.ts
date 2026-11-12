import type { Season } from './season';

/**
 * The land as a screen print. The pipeline paints two pictures of it (the ground up close and
 * the forest from afar); when the game loads, every pixel of each becomes the nearest of a
 * handful of inks for the season, so the land is flat shapes with hard edges, as on a park
 * poster. `plain` leaves the pictures as they came, to set beside it.
 *
 * Pure: it works on bytes, so it runs under Vitest, and the same bytes go to WebGPU and WebGL.
 */
export type WorldLook = 'plain' | 'poster';
export const WORLD_LOOKS: readonly WorldLook[] = ['plain', 'poster'];

/** The inks of each season's print. */
export const INKS: Record<Season, readonly number[]> = {
  // Cream snow, three blues of shade, spruce and navy; and ice, which the pictures do not have (`freeze`).
  winter: [0xfbf8ee, 0xc3d3ea, 0x8fa5cc, 0x5d7396, 0x4d6b78, 0x2c4a52, 0x22304a, 0xb59a78, 0x7fb4c8],
  // Old snow, thaw, khaki, olive, umber, pine, bud green.
  spring: [0xf4f1e6, 0xcfdcea, 0xa8a077, 0x7d8a52, 0x7a6650, 0x365543, 0xb9c47a, 0x9aa0a0, 0x3d86a0],
  // Cream, sage, meadow, forest, pine, deep pine, water, path.
  summer: [0xf1e9cf, 0xa9c98a, 0x6fa35c, 0x3f7d54, 0x2a5f4a, 0x1f4a44, 0x3d86a0, 0xc9a36b, 0xa08a66],
  // Cream, gold, orange, rust, maroon, pine, path, water.
  fall: [0xf1e9cf, 0xe3b03f, 0xd9772b, 0xb3472d, 0x7a3340, 0x2f5d4c, 0xc9a36b, 0x3d86a0, 0x8c6a48],
};

/** The ink of ice: a pond or a river in winter. */
export const ICE = 0x7fb4c8;

/**
 * Freeze the water in a winter picture. The pipeline paints winter's ponds and rivers as snow
 * like the ground round them, so that nothing says where the water is; here they are printed
 * as ice, from the map of where the water lies.
 * @param rgba the picture's bytes, four to a pixel
 * @param across how many squares the map of the water has across the picture, and `down` it
 * @param water whether a square of that map is water
 */
export function freeze(rgba: Uint8ClampedArray, width: number, height: number, across: number, down: number, water: (i: number, j: number) => boolean): void {
  for (let j = 0; j < down; j++) {
    const y0 = Math.floor((j * height) / down);
    const y1 = Math.floor(((j + 1) * height) / down);
    for (let i = 0; i < across; i++) {
      if (!water(i, j)) continue;
      const x0 = Math.floor((i * width) / across);
      const x1 = Math.floor(((i + 1) * width) / across);
      for (let y = y0; y < y1; y++) {
        for (let x = x0; x < x1; x++) {
          const p = (y * width + x) * 4;
          rgba[p] = (ICE >> 16) & 255;
          rgba[p + 1] = (ICE >> 8) & 255;
          rgba[p + 2] = ICE & 255;
        }
      }
    }
  }
}

/** The nearest of some inks to a colour. */
export function nearestInk(inks: readonly number[], r: number, g: number, b: number): number {
  let best = inks[0] as number;
  let least = Infinity;
  for (const ink of inks) {
    const dr = ((ink >> 16) & 255) - r;
    const dg = ((ink >> 8) & 255) - g;
    const db = (ink & 255) - b;
    // Green counts for most, as it does to the eye.
    const d = dr * dr * 3 + dg * dg * 4 + db * db * 2;
    if (d < least) {
      least = d;
      best = ink;
    }
  }
  return best;
}

/**
 * Repaint a picture of the land in place.
 * @param rgba the picture's bytes, four to a pixel
 */
export function restyle(rgba: Uint8ClampedArray, look: WorldLook, season: Season): void {
  if (look === 'plain') return;
  const inks = INKS[season];
  // Colours repeat: the answer for each is worked out once.
  const known = new Map<number, number>();
  for (let i = 0; i < rgba.length; i += 4) {
    const key = ((rgba[i] as number) << 16) | ((rgba[i + 1] as number) << 8) | (rgba[i + 2] as number);
    let ink = known.get(key);
    if (ink === undefined) {
      ink = nearestInk(inks, rgba[i] as number, rgba[i + 1] as number, rgba[i + 2] as number);
      known.set(key, ink);
    }
    rgba[i] = (ink >> 16) & 255;
    rgba[i + 1] = (ink >> 8) & 255;
    rgba[i + 2] = ink & 255;
  }
}

/**
 * Take the specks out of a printed picture, in place. Brought to its inks, the land is left
 * with stray pixels of one ink in a field of another: one-pixel accidents of the picture it
 * was painted from, which enlarged become square blots. A pixel that has no neighbour of its
 * own ink, or only one, takes the ink most of its neighbours have. A line one pixel wide (a
 * path, the shade along a trail's edge) is left alone: each pixel of it has two neighbours.
 * @param rgba the picture's bytes, four to a pixel
 */
export function despeckle(rgba: Uint8ClampedArray, width: number, height: number): void {
  const key = (p: number): number => ((rgba[p] as number) << 16) | ((rgba[p + 1] as number) << 8) | (rgba[p + 2] as number);
  // Read from a copy of the inks, so that what is changed does not change what its neighbours see.
  const inks = new Int32Array(width * height);
  for (let i = 0; i < inks.length; i++) inks[i] = key(i * 4);
  const seen: number[] = [];
  const count: number[] = [];
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const at = y * width + x;
      const mine = inks[at] as number;
      let same = 0;
      seen.length = 0;
      count.length = 0;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (dx === 0 && dy === 0) continue;
          const k = inks[at + dy * width + dx] as number;
          if (k === mine) {
            same++;
            continue;
          }
          const j = seen.indexOf(k);
          if (j < 0) {
            seen.push(k);
            count.push(1);
          } else count[j] = (count[j] as number) + 1;
        }
      }
      if (same >= 2) continue;
      let best = 0;
      for (let j = 1; j < seen.length; j++) if ((count[j] as number) > (count[best] as number)) best = j;
      const ink = seen[best] as number;
      rgba[at * 4] = (ink >> 16) & 255;
      rgba[at * 4 + 1] = (ink >> 8) & 255;
      rgba[at * 4 + 2] = ink & 255;
    }
  }
}

/** How wide the bell is that `soften` weighs areas by, in pixels, and how far it reaches. */
const BROAD = 1.7;
const REACH = 4;
/** How far beyond a piece the weighing is done, so that what is narrow can be told at its edge. */
const PAD = 3;
/** Something narrow has a place when the pixels of it round about weigh this much, by a small bell. */
const FINE_SHARE = 0.45;

/**
 * A piece of a printed picture, made ready for enlarging: cut out with a margin round it, with
 * how much each ink weighs at each pixel.
 */
export interface Piece {
  width: number;
  height: number;
  /** Where the piece's corner was in the whole picture. */
  left: number;
  top: number;
  /** The inks in it, as 0xRRGGBB. The rest speak of them by their place in this list. */
  inks: number[];
  /** For each ink, how much it weighs at each pixel. Nothing, if the piece is all one ink. */
  weight: (Float32Array | null)[];
  /** For each pixel that is part of something narrow, one more than its ink; otherwise 0. */
  fine: Uint8Array;
  /** Whether a pixel, or any of the eight round it, is part of something narrow. */
  nearFine: Uint8Array;
}

/**
 * Cut a piece out of a printed picture and weigh its inks, ready for `weigh`. The land's
 * picture is drawn on a grid, and what was a straight slanting edge on the ground (the side of
 * a trail, the edge of the woods) is a staircase of pixels in it; enlarged as drawn, the stairs
 * are metres wide. So each ink is weighed round every pixel by a wide bell, and the ground takes
 * the ink that weighs most where it falls: the stairs are worn to a slope, and an
 * edge runs in a curve.
 *
 * A wide bell would wipe away whatever is narrower than itself: a path, a stream, a cat track
 * two pixels across. So what it loses altogether is kept as drawn (`fine`): a pixel whose ink
 * does not weigh most there nor at any pixel beside it, and the pixels of the same thing
 * between it and where its ink does. A pixel lost from the edge of a broad area, the corner
 * of a stair, has its own ink beside it and is let go.
 *
 * It is done a piece at a time, for the ground near the camera, because the whole picture is
 * too big to do at once. A pixel's answer depends only on the picture within a few pixels of
 * it, so two pieces agree where they meet.
 *
 * @param x0 the left and top of the part wanted, and its size, in the picture's pixels
 */
export function soften(src: Uint8ClampedArray, srcW: number, srcH: number, x0: number, y0: number, w: number, h: number): Piece {
  // The piece, with room round it for `weigh` to read past the part wanted.
  const left = Math.floor(x0) - 2;
  const top = Math.floor(y0) - 2;
  const width = Math.ceil(x0 + w) + 2 - left;
  const height = Math.ceil(y0 + h) + 2 - top;
  // What is weighed: the piece and a little beyond. What is read: that, and the bell's reach.
  const ww = width + PAD * 2;
  const wh = height + PAD * 2;
  const rw = ww + REACH * 2;
  const rh = wh + REACH * 2;
  const clamp = (v: number, most: number): number => (v < 0 ? 0 : v > most ? most : v);
  // Every ink in it, numbered, and the part of what is read that each is found in.
  const inks: number[] = [];
  const box: number[][] = [];
  const which = new Uint8Array(rw * rh);
  for (let y = 0; y < rh; y++) {
    const sy = clamp(top - PAD - REACH + y, srcH - 1);
    for (let x = 0; x < rw; x++) {
      const p = (sy * srcW + clamp(left - PAD - REACH + x, srcW - 1)) * 4;
      const key = ((src[p] as number) << 16) | ((src[p + 1] as number) << 8) | (src[p + 2] as number);
      let n = inks.indexOf(key);
      if (n < 0) {
        n = inks.length;
        inks.push(key);
        box.push([x, x, y, y]);
      }
      which[y * rw + x] = n;
      const b = box[n] as number[];
      if (x < (b[0] as number)) b[0] = x;
      if (x > (b[1] as number)) b[1] = x;
      if (y > (b[3] as number)) b[3] = y;
    }
  }
  /** The ink a weighed pixel was drawn in. */
  const drawn = (x: number, y: number): number => which[(y + REACH) * rw + x + REACH] as number;
  const piece: Piece = { width, height, left, top, inks, weight: inks.map(() => null), fine: new Uint8Array(width * height), nearFine: new Uint8Array(width * height) };
  if (inks.length < 2) return piece;

  const bell = new Float32Array(REACH * 2 + 1);
  let whole = 0;
  for (let d = -REACH; d <= REACH; d++) whole += bell[d + REACH] = Math.exp(-(d * d) / (2 * BROAD * BROAD));
  for (let d = 0; d < bell.length; d++) bell[d] = (bell[d] as number) / whole;
  // For each ink in turn: how much of it there is round each pixel, across and then down.
  const across = new Float32Array(ww * rh);
  const fields: Float32Array[] = [];
  const top1 = new Float32Array(ww * wh);
  const winner = new Uint8Array(ww * wh);
  for (let n = 0; n < inks.length; n++) {
    const field = new Float32Array(ww * wh);
    fields.push(field);
    // Only the part of the picture within the bell's reach of the ink need be looked at.
    const b = box[n] as number[];
    const xa = Math.max(0, (b[0] as number) - REACH * 2);
    const xb = Math.min(ww - 1, b[1] as number);
    const ya = b[2] as number;
    const yb = b[3] as number;
    for (let y = ya; y <= yb; y++) {
      const row = y * rw;
      for (let x = xa; x <= xb; x++) {
        let sum = 0;
        for (let d = 0; d <= REACH * 2; d++) if (which[row + x + d] === n) sum += bell[d] as number;
        across[y * ww + x] = sum;
      }
    }
    const yc = Math.max(0, ya - REACH * 2);
    const yd = Math.min(wh - 1, yb);
    for (let y = yc; y <= yd; y++) {
      for (let x = xa; x <= xb; x++) {
        let sum = 0;
        for (let d = 0; d <= REACH * 2; d++) {
          const ry = y + d;
          if (ry >= ya && ry <= yb) sum += (across[ry * ww + x] as number) * (bell[d] as number);
        }
        const at = y * ww + x;
        field[at] = sum;
        if (sum > (top1[at] as number)) {
          top1[at] = sum;
          winner[at] = n;
        }
      }
    }
  }
  // What the bell has lost altogether: drawn in an ink that weighs most neither there nor beside it.
  const lost = new Uint8Array(ww * wh);
  for (let y = 1; y < wh - 1; y++) {
    for (let x = 1; x < ww - 1; x++) {
      const mine = drawn(x, y);
      const at = y * ww + x;
      if (winner[at] === mine) continue;
      let beside = false;
      for (let dy = -1; dy <= 1 && !beside; dy++) for (let dx = -1; dx <= 1; dx++) if (winner[at + dy * ww + dx] === mine) beside = true;
      lost[at] = beside ? 1 : 2;
    }
  }
  // Those are kept as drawn, and so are the pixels of the same thing that join them to the rest of their ink.
  const fineAt = (x: number, y: number): number => {
    // In the piece's own pixels; it may be asked one pixel beyond.
    const at = (y + PAD) * ww + x + PAD;
    const how = lost[at] as number;
    if (how === 0) return 0;
    const mine = drawn(x + PAD, y + PAD);
    if (how === 2) return mine + 1;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (lost[at + dy * ww + dx] === 2 && drawn(x + PAD + dx, y + PAD + dy) === mine) return mine + 1;
    return 0;
  };
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const at = y * width + x;
      piece.fine[at] = fineAt(x, y);
      let near = false;
      for (let dy = -1; dy <= 1 && !near; dy++) for (let dx = -1; dx <= 1; dx++) if (fineAt(x + dx, y + dy) !== 0) near = true;
      piece.nearFine[at] = near ? 1 : 0;
    }
  }
  for (let n = 0; n < inks.length; n++) {
    const field = fields[n] as Float32Array;
    const kept = new Float32Array(width * height);
    for (let y = 0; y < height; y++) kept.set(field.subarray((y + PAD) * ww + PAD, (y + PAD) * ww + PAD + width), y * width);
    piece.weight[n] = kept;
  }
  return piece;
}

/**
 * How much each ink weighs at a grid of points across a part of the picture: what the ground
 * near the camera is drawn from.
 *
 * A picture of the ground, however much it is enlarged, has pixels of its own, and from a few
 * metres up they show: an edge goes soft and steps along them. So the ground near the camera
 * is not given a picture at all. It is given these weights, a point every half pixel of the
 * printed picture, and the ground's own shader reads between the points and gives each pixel
 * of the screen the ink that weighs most there (`inkAt` is the same sum). Between two points
 * a weight changes evenly, so the line where two inks weigh the same is a clean curve at any
 * distance.
 */
export interface Weights {
  /** Points across and down. The first and last lie on the edges of the part, so two parts side by side share theirs. */
  across: number;
  down: number;
  /** Four bytes to a point: what the second, third, fourth and fifth inks of the order weigh, out of 255. */
  a: Uint8Array;
  /** The same for the sixth to the ninth. The first ink's weight is whatever is left. */
  b: Uint8Array;
}

/** How many inks a part of the ground can be weighed in: the first, and four in each of two textures. */
export const MOST_INKS = 9;

/** The inks a printed picture is made of, the commonest first, as 0xRRGGBB. */
export function inkOrder(rgba: Uint8ClampedArray): number[] {
  const count = new Map<number, number>();
  for (let p = 0; p < rgba.length; p += 4) {
    const key = ((rgba[p] as number) << 16) | ((rgba[p + 1] as number) << 8) | (rgba[p + 2] as number);
    count.set(key, (count.get(key) ?? 0) + 1);
  }
  return [...count.entries()].sort((x, y) => y[1] - x[1] || x[0] - y[0]).map(([ink]) => ink);
}

/**
 * Weigh the inks of a part of the picture at a grid of points.
 *
 * What is narrow (a path, a stream) is laid over the broad areas as it was drawn: where the
 * pixels of it round about, weighed by a small bell, come to nearly half, it outweighs
 * everything else.
 *
 * @param piece the part of the picture, from `soften`
 * @param x0 the left and top of the part wanted, and its size, in the whole picture's pixels (fractions allowed)
 * @param order every ink of the picture, as 0xRRGGBB (`inkOrder`): at most `MOST_INKS`
 * @param into weights to carry on filling in, a few rows at a time
 * @param fromRow the first row of points to weigh, and how many
 */
export function weigh(
  piece: Piece,
  x0: number,
  y0: number,
  w: number,
  h: number,
  across: number,
  down: number,
  order: readonly number[],
  into: Weights | null = null,
  fromRow = 0,
  rows = down,
): Weights {
  const out = into ?? { across, down, a: new Uint8Array(across * down * 4), b: new Uint8Array(across * down * 4) };
  const { width, height, weight, fine, nearFine } = piece;
  const clampX = (x: number): number => (x < 0 ? 0 : x >= width ? width - 1 : x);
  const clampY = (y: number): number => (y < 0 ? 0 : y >= height ? height - 1 : y);
  // Where each of the piece's inks stands in the order.
  const place = piece.inks.map((ink) => Math.max(0, order.indexOf(ink)));
  const vals = new Float32Array(MOST_INKS);
  const fineInk = new Int32Array(9);
  const fineSum = new Float32Array(9);
  const wx = new Float32Array(3);
  const wy = new Float32Array(3);
  const end = Math.min(down, fromRow + rows);
  for (let j = fromRow; j < end; j++) {
    const sy = y0 - piece.top + (down > 1 ? j / (down - 1) : 0) * h - 0.5;
    const fy = Math.floor(sy);
    const ty = sy - fy;
    const rowA = clampY(fy) * width;
    const rowB = clampY(fy + 1) * width;
    const cy = Math.round(sy);
    const oy = sy - cy;
    for (let i = 0; i < across; i++) {
      const sx = x0 - piece.left + (across > 1 ? i / (across - 1) : 0) * w - 0.5;
      const fx = Math.floor(sx);
      const tx = sx - fx;
      const xa = clampX(fx);
      const xb = clampX(fx + 1);
      vals.fill(0);
      if (piece.inks.length === 1) vals[place[0] as number] = 1;
      else {
        const wa = (1 - tx) * (1 - ty);
        const wb = tx * (1 - ty);
        const wc = (1 - tx) * ty;
        const wd = tx * ty;
        for (let n = 0; n < weight.length; n++) {
          const f = weight[n];
          if (!f) continue;
          vals[place[n] as number] = (f[rowA + xa] as number) * wa + (f[rowA + xb] as number) * wb + (f[rowB + xa] as number) * wc + (f[rowB + xb] as number) * wd;
        }
      }
      const cx = Math.round(sx);
      if (nearFine[clampY(cy) * width + clampX(cx)]) {
        // Something narrow is close: the nine pixels round this point, by a small bell.
        const ox = sx - cx;
        wx[0] = 0.5 * (0.5 - ox) * (0.5 - ox);
        wx[1] = 0.75 - ox * ox;
        wx[2] = 0.5 * (0.5 + ox) * (0.5 + ox);
        wy[0] = 0.5 * (0.5 - oy) * (0.5 - oy);
        wy[1] = 0.75 - oy * oy;
        wy[2] = 0.5 * (0.5 + oy) * (0.5 + oy);
        let kinds = 0;
        for (let dy = -1; dy <= 1; dy++) {
          const row = clampY(cy + dy) * width;
          for (let dx = -1; dx <= 1; dx++) {
            const f = fine[row + clampX(cx + dx)] as number;
            if (f === 0) continue;
            let k = 0;
            while (k < kinds && fineInk[k] !== f) k++;
            if (k === kinds) {
              fineInk[kinds] = f;
              fineSum[kinds] = 0;
              kinds++;
            }
            fineSum[k] = (fineSum[k] as number) + (wx[dx + 1] as number) * (wy[dy + 1] as number);
          }
        }
        let most = 0;
        for (let k = 1; k < kinds; k++) if ((fineSum[k] as number) > (fineSum[most] as number)) most = k;
        // At `FINE_SHARE` of the bell it weighs a half, which nothing else can then exceed.
        const share = Math.min(1, (fineSum[most] as number) / (FINE_SHARE * 2));
        // The rest share what is left between them, as they stood without it.
        const at = place[(fineInk[most] as number) - 1] as number;
        vals[at] = 0;
        let rest = 0;
        for (let k = 0; k < MOST_INKS; k++) rest += vals[k] as number;
        for (let k = 0; k < MOST_INKS; k++) vals[k] = rest > 0 ? ((vals[k] as number) / rest) * (1 - share) : 0;
        vals[at] = share;
      }
      const to = (j * across + i) * 4;
      for (let c = 0; c < 4; c++) {
        out.a[to + c] = Math.round(Math.min(1, vals[c + 1] as number) * 255);
        out.b[to + c] = Math.round(Math.min(1, vals[c + 5] as number) * 255);
      }
    }
  }
  return out;
}

/**
 * The ink at a place in a part of the ground, by its weights: its place in the order. This is
 * the sum the ground's shader does for every pixel of the screen, kept here in plain numbers
 * so that it can be tested.
 * @param tx how far across the part, from 0 to 1, and `ty` how far down
 */
export function inkAt(weights: Weights, tx: number, ty: number): number {
  const { across, down, a, b } = weights;
  const px = Math.min(Math.max(tx, 0), 1) * (across - 1);
  const py = Math.min(Math.max(ty, 0), 1) * (down - 1);
  const x0 = Math.min(Math.floor(px), Math.max(0, across - 2));
  const y0 = Math.min(Math.floor(py), Math.max(0, down - 2));
  const x1 = Math.min(x0 + 1, across - 1);
  const y1 = Math.min(y0 + 1, down - 1);
  const fx = px - x0;
  const fy = py - y0;
  const read = (from: Uint8Array, c: number): number =>
    ((from[(y0 * across + x0) * 4 + c] as number) * (1 - fx) * (1 - fy) +
      (from[(y0 * across + x1) * 4 + c] as number) * fx * (1 - fy) +
      (from[(y1 * across + x0) * 4 + c] as number) * (1 - fx) * fy +
      (from[(y1 * across + x1) * 4 + c] as number) * fx * fy) /
    255;
  const w: number[] = [0];
  for (let c = 0; c < 4; c++) w.push(read(a, c));
  for (let c = 0; c < 4; c++) w.push(read(b, c));
  let best = 1;
  for (let k = 1; k < w.length; k++) best -= w[k] as number;
  let ink = 0;
  for (let k = 1; k < w.length; k++) {
    if ((w[k] as number) > best) {
      best = w[k] as number;
      ink = k;
    }
  }
  return ink;
}
