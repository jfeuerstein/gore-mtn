import { SEASONS, type Season } from './look/season';
import { TIMES, type TimeName } from './look/sun';
import { WEATHERS, type WeatherName } from './look/weather';
import { WORLD_LOOKS, type WorldLook } from './look/worldLook';

/** Debug and quality options, read from the URL so any state can be linked to and screenshotted. */
export interface Config {
  /** The season: by the calendar (or wherever the Snow Train has taken the player), or a named one for trying out. */
  season: 'real' | Season;
  /** The time of day: the real clock at Gore, or a named moment of today. */
  time: 'real' | TimeName;
  /** The weather: the real sky at Gore, or a settled kind. */
  weather: 'real' | WeatherName;
  /** Rendering backend. `webgl` forces the WebGL 2 fallback of the same renderer. */
  renderer: 'webgpu' | 'webgl';
  /** How many trees the whole mountain would hold if all of it were planted. Sets forest density. */
  trees: number;
  /** Upper limit on device pixel ratio. */
  dpr: number;
  shadows: boolean;
  /** Whether walls and roofs wear their courses of boards and shingles, or are left plain. */
  siding: boolean;
  /** How the land is painted: as the pipeline painted it, as a screen print, or as a map with contours. */
  look: WorldLook;
  /** Which models the animals are: the game's own blocks, or ones made outside it in one of the looks being tried. */
  models: 'blocks' | 'facet' | 'park' | 'smooth' | 'toy';
  /** Line every animal that has a made model up in a row in front of the player, to compare looks. */
  zoo: boolean;
  /** Whether anyone else is about: skiers on the trails, people on the chairs, the town out walking. */
  crowd: boolean;
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
  /** False to leave the player's own figure out of the picture, for photographing what they stand by. */
  me: boolean;
  /** Show the frame-rate readout. Off unless asked for. */
  stats: boolean;
  /** Greet a new player with a few words of welcome. The tools turn this off. */
  intro: boolean;
  /**
   * Pretend the page is laid out this many points shorter than the screen, as iOS does from the
   * Home Screen. For checking the layout where that cannot be reproduced.
   */
  shortPage: number;
  /** Benchmark step to run, or `done` to show the results. See src/debug/bench.ts. */
  bench: number | 'done' | null;
  /** Seconds measured per benchmark step. */
  benchSeconds: number;
}

export const DEFAULTS: Config = {
  season: 'real',
  time: 'real',
  weather: 'real',
  renderer: 'webgpu',
  // `trees` is how many the whole mountain would hold; only those within range of the camera are
  // ever planted. Distant trees and terrain are drawn in simpler forms.
  trees: 220000,
  dpr: 2,
  shadows: true,
  siding: true,
  crowd: true,
  look: 'plain',
  models: 'blocks',
  zoo: false,
  stride: 1,
  viewDist: 6500,
  at: 'base-lodge',
  pos: null,
  yaw: null,
  pitch: null,
  zoom: 1,
  ski: false,
  hud: true,
  me: true,
  stats: false,
  intro: true,
  shortPage: 0,
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

function oneOf<T extends string>(v: string | null, allowed: readonly T[]): T | null {
  return allowed.includes(v as T) ? (v as T) : null;
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
    season: oneOf(q.get('season'), SEASONS) ?? d.season,
    time: oneOf(q.get('time'), TIMES) ?? d.time,
    weather: oneOf(q.get('weather'), WEATHERS) ?? d.weather,
    renderer: q.get('renderer') === 'webgl' ? 'webgl' : d.renderer,
    trees: Math.round(num(q.get('trees'), d.trees, 0, 1000000)),
    dpr: num(q.get('dpr'), d.dpr, 0.5, 3),
    shadows: q.has('shadows') ? q.get('shadows') === '1' : d.shadows,
    siding: q.has('siding') ? q.get('siding') === '1' : d.siding,
    crowd: q.has('crowd') ? q.get('crowd') === '1' : d.crowd,
    zoo: q.get('zoo') === '1',
    look: oneOf(q.get('look'), WORLD_LOOKS) ?? d.look,
    // The print look brings the printed animals with it, unless others are asked for.
    models: oneOf(q.get('models'), ['blocks', 'facet', 'park', 'smooth', 'toy'] as const) ?? (q.get('look') === 'poster' ? 'park' : d.models),
    stride: Math.round(num(q.get('stride'), d.stride, 1, 8)),
    viewDist: num(q.get('view'), d.viewDist, 100, 12000),
    at: q.get('at') ?? d.at,
    pos,
    yaw: optNum(q.get('yaw')),
    pitch: optNum(q.get('pitch')),
    zoom: num(q.get('zoom'), d.zoom, 0.4, 3),
    ski: q.get('ski') === '1',
    hud: q.get('hud') !== '0',
    me: q.get('me') !== '0',
    stats: q.get('stats') === '1',
    intro: q.get('intro') !== '0',
    shortPage: num(q.get('shortpage'), d.shortPage, 0, 200),
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

/**
 * The looks being tried are kept from one opening of the game to the next, so that one can be
 * lived with on the phone, where the Home Screen opens the game with no options at all. An
 * option in the address is kept; one that is missing is filled in from what was kept. A
 * benchmark step is left alone: it must measure what its label says.
 */
export const KEPT_OPTIONS = ['look', 'models'] as const;
export function withKept(search: string, kept: (key: string) => string | null): { search: string; keep: Record<string, string> } {
  const q = new URLSearchParams(search);
  const keep: Record<string, string> = {};
  if (q.has('bench')) return { search, keep };
  for (const key of KEPT_OPTIONS) {
    const given = q.get(key);
    if (given !== null) keep[key] = given;
    else {
      const was = kept(key);
      if (was) q.set(key, was);
    }
  }
  const out = q.toString();
  return { search: out ? `?${out}` : '', keep };
}
