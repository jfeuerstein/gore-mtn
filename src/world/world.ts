import { Heightfield } from './heightfield';
import type { Lift, Place, Trail } from './trails';

interface WorldFile {
  grid: { cols: number; rows: number; cell: number; heightStep: number; width: number; depth: number };
  real: { hScale: number; vScale: number; elevMinM: number; elevMaxM: number };
  places: Place[];
  lifts: Lift[];
  trails: Trail[];
  paths: { name: string; pts: number[] }[];
  attribution: string;
}

/** Everything the terrain pipeline produced, loaded and ready to query. */
export interface World {
  /** Full-resolution ground heights. */
  source: Heightfield;
  /** 255 where a groomed ski trail runs, 0 elsewhere. Same grid as `source`. */
  trailMask: Uint8Array;
  trails: Trail[];
  lifts: Lift[];
  places: Place[];
  attribution: string;
  /** Real-world metres above sea level for a game height. */
  realElevationM(y: number): number;
  /** True when the position is on a groomed trail. */
  onTrail(x: number, z: number): boolean;
}

async function fetchBuffer(url: string): Promise<ArrayBuffer> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`could not load ${url}: ${res.status}`);
  return res.arrayBuffer();
}

export async function loadWorld(baseUrl: string): Promise<World> {
  const [meta, heightBuf, maskBuf] = await Promise.all([
    fetch(`${baseUrl}world/world.json`).then((r) => {
      if (!r.ok) throw new Error(`could not load world.json: ${r.status}`);
      return r.json() as Promise<WorldFile>;
    }),
    fetchBuffer(`${baseUrl}world/height.bin`),
    fetchBuffer(`${baseUrl}world/trailmask.bin`),
  ]);
  return buildWorld(meta, heightBuf, maskBuf);
}

export function buildWorld(meta: WorldFile, heightBuf: ArrayBuffer, maskBuf: ArrayBuffer): World {
  const { cols, rows, cell, heightStep, width, depth } = meta.grid;
  const raw = new Uint16Array(heightBuf);
  const trailMask = new Uint8Array(maskBuf);
  if (raw.length !== cols * rows || trailMask.length !== cols * rows) {
    throw new Error('world files do not match the grid size in world.json');
  }
  const heights = new Float32Array(raw.length);
  for (let i = 0; i < raw.length; i++) heights[i] = (raw[i] as number) * heightStep;
  const source = new Heightfield(cols, rows, cell, -width / 2, -depth / 2, heights);

  return {
    source,
    trailMask,
    trails: meta.trails,
    lifts: meta.lifts,
    places: meta.places,
    attribution: meta.attribution,
    realElevationM: (y) => meta.real.elevMinM + y / meta.real.vScale,
    onTrail(x, z) {
      const c = Math.round((x - source.originX) / cell);
      const r = Math.round((z - source.originZ) / cell);
      if (c < 0 || r < 0 || c >= cols || r >= rows) return false;
      return (trailMask[r * cols + c] as number) > 0;
    },
  };
}
