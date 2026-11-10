/**
 * A regular grid of ground heights. Sample (0, 0) sits at (originX, originZ); columns run east
 * (+x) and rows run south (+z). Heights between samples follow the same two triangles per cell
 * that the terrain mesh draws, so anything standing on `heightAt` stands exactly on the visible
 * ground.
 */
export class Heightfield {
  readonly width: number;
  readonly depth: number;

  constructor(
    readonly cols: number,
    readonly rows: number,
    readonly cell: number,
    readonly originX: number,
    readonly originZ: number,
    readonly data: Float32Array,
  ) {
    if (data.length !== cols * rows) throw new Error('heightfield data does not match its size');
    this.width = (cols - 1) * cell;
    this.depth = (rows - 1) * cell;
  }

  get minX(): number {
    return this.originX;
  }
  get maxX(): number {
    return this.originX + this.width;
  }
  get minZ(): number {
    return this.originZ;
  }
  get maxZ(): number {
    return this.originZ + this.depth;
  }

  /** Height at a sample. Indices are clamped to the grid. */
  at(col: number, row: number): number {
    const c = col < 0 ? 0 : col >= this.cols ? this.cols - 1 : col;
    const r = row < 0 ? 0 : row >= this.rows ? this.rows - 1 : row;
    return this.data[r * this.cols + c] as number;
  }

  /** Ground height at a world position. Positions outside the grid use the nearest edge. */
  heightAt(x: number, z: number): number {
    const gx = Math.min(Math.max((x - this.originX) / this.cell, 0), this.cols - 1);
    const gz = Math.min(Math.max((z - this.originZ) / this.cell, 0), this.rows - 1);
    const c = Math.min(Math.floor(gx), this.cols - 2);
    const r = Math.min(Math.floor(gz), this.rows - 2);
    const fx = gx - c;
    const fz = gz - r;
    const a = this.at(c, r);
    const b = this.at(c + 1, r);
    const cc = this.at(c, r + 1);
    const d = this.at(c + 1, r + 1);
    // Each cell is split along the b-c diagonal, matching buildTerrain().
    if (fx + fz <= 1) return a + (b - a) * fx + (cc - a) * fz;
    return d + (cc - d) * (1 - fx) + (b - d) * (1 - fz);
  }

  /** Downhill-facing unit normal of the ground, as [x, y, z]. */
  normalAt(x: number, z: number): [number, number, number] {
    const e = this.cell * 0.5;
    const dx = (this.heightAt(x + e, z) - this.heightAt(x - e, z)) / (2 * e);
    const dz = (this.heightAt(x, z + e) - this.heightAt(x, z - e)) / (2 * e);
    const len = Math.hypot(dx, 1, dz);
    return [-dx / len, 1 / len, -dz / len];
  }

  /** Slope steepness in degrees: 0 is flat, 90 is a cliff. */
  slopeDegAt(x: number, z: number): number {
    const n = this.normalAt(x, z);
    return (Math.acos(Math.min(1, n[1])) * 180) / Math.PI;
  }

  /** A coarser copy that keeps every `stride`th sample. Trailing samples that do not fit are dropped. */
  decimate(stride: number): Heightfield {
    if (stride <= 1) return this;
    const cols = Math.floor((this.cols - 1) / stride) + 1;
    const rows = Math.floor((this.rows - 1) / stride) + 1;
    const data = new Float32Array(cols * rows);
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) data[r * cols + c] = this.at(c * stride, r * stride);
    }
    return new Heightfield(cols, rows, this.cell * stride, this.originX, this.originZ, data);
  }
}
