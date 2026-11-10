/** Decoding of the world's data files. No DOM types beyond typed arrays, so it runs under Vitest. */

/**
 * Undo the pipeline's `pack_heights`: each stored value is the difference from the sample to its
 * west, and the first value of a row is the difference from the first value of the row above.
 * Differences wrap at 65536.
 */
export function unpackHeights(packed: Uint16Array, cols: number, rows: number): Uint16Array {
  if (packed.length !== cols * rows) throw new Error('height data does not match the grid size');
  const out = new Uint16Array(packed.length);
  for (let r = 0; r < rows; r++) {
    const row = r * cols;
    out[row] = ((packed[row] as number) + (r > 0 ? (out[row - cols] as number) : 0)) & 0xffff;
    for (let c = 1; c < cols; c++) out[row + c] = ((packed[row + c] as number) + (out[row + c - 1] as number)) & 0xffff;
  }
  return out;
}

/** True when the bytes start with the gzip signature. */
export function isGzip(bytes: Uint8Array): boolean {
  return bytes.length > 2 && bytes[0] === 0x1f && bytes[1] === 0x8b;
}
