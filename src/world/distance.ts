/**
 * Distance from every grid sample to the nearest marked sample, in world units.
 * `mask` marks samples with any non-zero value. Uses a two-pass chamfer transform, accurate to a
 * few percent, which is plenty for placing trees and scenery relative to trail edges.
 */
export function distanceToMask(mask: Uint8Array, cols: number, rows: number, cell: number): Float32Array {
  const FAR = 1e9;
  const STRAIGHT = 1;
  const DIAGONAL = Math.SQRT2;
  const d = new Float32Array(cols * rows);
  for (let i = 0; i < d.length; i++) d[i] = (mask[i] as number) > 0 ? 0 : FAR;
  const at = (c: number, r: number): number => (c < 0 || r < 0 || c >= cols || r >= rows ? FAR : (d[r * cols + c] as number));

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const i = r * cols + c;
      d[i] = Math.min(
        d[i] as number,
        at(c - 1, r) + STRAIGHT,
        at(c, r - 1) + STRAIGHT,
        at(c - 1, r - 1) + DIAGONAL,
        at(c + 1, r - 1) + DIAGONAL,
      );
    }
  }
  for (let r = rows - 1; r >= 0; r--) {
    for (let c = cols - 1; c >= 0; c--) {
      const i = r * cols + c;
      d[i] = Math.min(
        d[i] as number,
        at(c + 1, r) + STRAIGHT,
        at(c, r + 1) + STRAIGHT,
        at(c + 1, r + 1) + DIAGONAL,
        at(c - 1, r + 1) + DIAGONAL,
      );
    }
  }
  for (let i = 0; i < d.length; i++) d[i] = (d[i] as number) * cell;
  return d;
}
