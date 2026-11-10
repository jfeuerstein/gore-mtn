/** Debug and quality options, read from the URL so any state can be linked to and screenshotted. */
export interface Config {
  /** Rendering backend. `webgl` forces the WebGL 2 fallback of the same renderer. */
  renderer: 'webgpu' | 'webgl';
  /** Target number of trees across the whole mountain. */
  trees: number;
  /** Upper limit on device pixel ratio. */
  dpr: number;
  shadows: boolean;
  /** Terrain mesh uses every Nth elevation sample. */
  stride: number;
  /** Trees and terrain tiles beyond this distance are not drawn. */
  viewDist: number;
  /** Place id to start at. */
  at: string;
  /** Exact start position, overrides `at`. */
  pos: { x: number; z: number } | null;
  yaw: number | null;
  pitch: number | null;
  /** Multiplies the camera distance; above 1 pulls back. */
  zoom: number;
  /** Start on skis. */
  ski: boolean;
  hud: boolean;
  /** Benchmark step to run, or `done` to show the results. See src/debug/bench.ts. */
  bench: number | 'done' | null;
  /** Seconds measured per benchmark step. */
  benchSeconds: number;
}

export const DEFAULTS: Config = {
  renderer: 'webgpu',
  // Measured on the owner's iPhone 17 Pro (see docs/game-plan.md): these hold a steady 60 fps
  // with room to spare, as do 80,000 trees and a pixel ratio of 3.
  trees: 40000,
  dpr: 2,
  shadows: true,
  stride: 2,
  viewDist: 1500,
  at: 'base-lodge',
  pos: null,
  yaw: null,
  pitch: null,
  zoom: 1,
  ski: false,
  hud: true,
  bench: null,
  benchSeconds: 5,
};

function num(v: string | null, fallback: number, min: number, max: number): number {
  if (v === null || v.trim() === '') return fallback;
  const n = Number(v);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
}

function optNum(v: string | null): number | null {
  if (v === null || v.trim() === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function optIndex(v: string | null): number | null {
  const n = optNum(v);
  return n !== null && Number.isInteger(n) && n >= 0 ? n : null;
}

export function parseConfig(search: string): Config {
  const q = new URLSearchParams(search);
  const d = DEFAULTS;
  const posParts = (q.get('pos') ?? '').split(',').map(Number);
  const [px, pz] = posParts;
  const pos =
    posParts.length === 2 && px !== undefined && pz !== undefined && Number.isFinite(px) && Number.isFinite(pz)
      ? { x: px, z: pz }
      : null;
  return {
    renderer: q.get('renderer') === 'webgl' ? 'webgl' : d.renderer,
    trees: Math.round(num(q.get('trees'), d.trees, 0, 200000)),
    dpr: num(q.get('dpr'), d.dpr, 0.5, 3),
    shadows: q.has('shadows') ? q.get('shadows') === '1' : d.shadows,
    stride: Math.round(num(q.get('stride'), d.stride, 1, 8)),
    viewDist: num(q.get('view'), d.viewDist, 100, 5000),
    at: q.get('at') ?? d.at,
    pos,
    yaw: optNum(q.get('yaw')),
    pitch: optNum(q.get('pitch')),
    zoom: num(q.get('zoom'), d.zoom, 0.4, 3),
    ski: q.get('ski') === '1',
    hud: q.get('hud') !== '0',
    bench: q.get('bench') === 'done' ? 'done' : optIndex(q.get('bench')),
    benchSeconds: num(q.get('benchsecs'), d.benchSeconds, 0.1, 60),
  };
}

/** Query string for the current page with some options changed. Options equal to the default are dropped. */
export function withParams(search: string, changes: Record<string, string | null>): string {
  const q = new URLSearchParams(search);
  for (const [k, v] of Object.entries(changes)) {
    if (v === null) q.delete(k);
    else q.set(k, v);
  }
  const s = q.toString();
  return s ? `?${s}` : '';
}
