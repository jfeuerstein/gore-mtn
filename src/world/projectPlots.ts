import { PROJECTS, type ProjectKind } from '../game/projects';
import { distToPolyline } from './trails';
import { insideBox, type WallBox } from './walls';
import { locate } from './whereabouts';
import { OPEN_WATER, type World } from './world';

/**
 * Where each town project stands. Each is described the way a person would say it (by a pond,
 * at the top of a lift, along a path), and this finds ground there that can be built on: dry,
 * level enough, and off the trails. It also turns each to face its view: the water, or the way
 * the ground falls away. No three.js here.
 */
export interface ProjectPlot {
  id: string;
  x: number;
  z: number;
  /** The turn that puts its front (its own +z) toward what it looks at. */
  turn: number;
}

type Site = { path: string; along: number } | { pond: string } | { liftTop: string };

const SITES: Record<string, Site> = {
  'lean-to': { path: 'Hardwood Forest Loop', along: 0.5 },
  'rabbit-dock': { pond: 'rabbit-pond' },
  bandstand: { pond: 'duck-pond' },
  'burnt-ridge-hut': { liftTop: 'Burnt Ridge Quad' },
  'reservoir-deck': { pond: 'north-creek-reservoir' },
};

/** Ground steeper than this is not built on, in degrees; and nothing is built this near a ski trail, in metres. */
const TOO_STEEP = 10;
const OFF_TRAIL = 16;

/** The nearest buildable ground to a point, looking outward in rings; the point itself if nothing better is near. */
function buildable(world: World, x: number, z: number, least = 0): { x: number; z: number } {
  const hf = world.source;
  const good = (px: number, pz: number): boolean =>
    world.openAt(px, pz) !== OPEN_WATER && hf.slopeDegAt(px, pz) < TOO_STEEP && !world.trails.some((t) => !t.area && distToPolyline(px, pz, t.pts) < OFF_TRAIL) && !world.buildings.some((b) => Math.hypot(b.x - px, b.z - pz) < 14);
  for (let r = least; r <= 120; r += 4) {
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2;
      const px = x + Math.cos(a) * r;
      const pz = z + Math.sin(a) * r;
      if (good(px, pz)) return { x: px, z: pz };
      if (r === 0) break;
    }
  }
  return { x, z };
}

/** The plot of every project that this map has a place for. */
export function projectPlots(world: World): ProjectPlot[] {
  const hf = world.source;
  // The way the ground falls away from a point: where a view is.
  const downhill = (x: number, z: number): number => {
    const e = 6;
    const gx = hf.heightAt(x + e, z) - hf.heightAt(x - e, z);
    const gz = hf.heightAt(x, z + e) - hf.heightAt(x, z - e);
    return Math.atan2(-gx, -gz);
  };
  return PROJECTS.flatMap((project): ProjectPlot[] => {
    const site = SITES[project.id];
    if (!site) return [];
    if ('pond' in site) {
      const pond = world.ponds.find((p) => p.id === site.pond);
      const shore = locate(world, { spot: site.pond });
      if (!pond || !shore) return [];
      // On the shore, facing the water.
      return [{ id: project.id, x: shore.x, z: shore.z, turn: Math.atan2(pond.x - shore.x, pond.z - shore.z) }];
    }
    if ('liftTop' in site) {
      const top = locate(world, { lift: site.liftTop, along: 1 });
      if (!top) return [];
      // A little way off from where riders get down.
      const at = buildable(world, top.x, top.z, 24);
      return [{ id: project.id, ...at, turn: downhill(at.x, at.z) }];
    }
    const path = world.paths.filter((p) => p.name === site.path).sort((a, b) => b.pts.length - a.pts.length)[0];
    if (!path) return [];
    const i = Math.min(path.pts.length - 2, Math.floor((path.pts.length / 2) * site.along) * 2);
    // Beside the path, not on it.
    const at = buildable(world, path.pts[i] as number, path.pts[i + 1] as number, 8);
    return [{ id: project.id, ...at, turn: downhill(at.x, at.z) }];
  });
}

/**
 * What of each kind of thing is solid, in its own frame (x, z, width, depth, and how tall it
 * stands, for keeping the camera out of a roof): the hut whole, and the lean-to's three walls
 * so that it can be walked into. The dock, the bandstand and the lookout are floors to stand
 * on (see `FLOORS`), not walls.
 */
const SOLID: Record<ProjectKind, readonly (readonly [x: number, z: number, w: number, d: number, top?: number])[]> = {
  leanto: [
    [0, -1.65, 4.2, 0.3],
    [-1.95, -0.4, 0.3, 2.8],
    [1.95, -0.4, 0.3, 2.8],
  ],
  dock: [],
  bandstand: [],
  hut: [[0, 0, 5.0, 3.8, 4.4]],
  deck: [],
};

/** The walls of a built project, where its plot is. */
export function projectWalls(kind: ProjectKind, plot: ProjectPlot, ground: number): WallBox[] {
  const c = Math.cos(plot.turn);
  const s = Math.sin(plot.turn);
  return SOLID[kind].map(([x, z, w, d, top]) => ({ x: plot.x + x * c + z * s, z: plot.z - x * s + z * c, w, d, turn: plot.turn, ...(top === undefined ? {} : { top: ground + top }) }));
}

/** A floor to stand on: a box on the ground, and how high its top is, in the world's own heights. */
export interface Floor extends WallBox {
  top: number;
}

/**
 * What of each kind of thing can be stood on, in its own frame (x, z, width, depth, height of
 * the boards above the plot's ground): the dock's planks out over the water and the step down
 * to them, the bandstand's floor and its step, the lookout's deck and its step, the lean-to's
 * floor. Someone who walks onto one is stood on its boards, not on the ground under it.
 */
const FLOORS: Record<ProjectKind, readonly (readonly [x: number, z: number, w: number, d: number, up: number])[]> = {
  leanto: [[0, -0.4, 4.2, 2.8, 0.36]],
  dock: [
    [0, 4.2, 1.9, 9, 0.62],
    [0, -0.5, 1.9, 1.2, 0.4],
  ],
  bandstand: [
    [0, 0, 5.4, 5.4, 0.7],
    [0, -3.0, 1.6, 0.8, 0.36],
  ],
  hut: [],
  deck: [
    [0, 1.4, 5.0, 3.6, 0.8],
    [0, -0.9, 1.6, 1.0, 0.5],
  ],
};

/** The floors of a built project, where its plot is. */
export function projectFloors(kind: ProjectKind, plot: ProjectPlot, ground: number): Floor[] {
  const c = Math.cos(plot.turn);
  const s = Math.sin(plot.turn);
  return FLOORS[kind].map(([x, z, w, d, up]) => ({ x: plot.x + x * c + z * s, z: plot.z - x * s + z * c, w, d, turn: plot.turn, top: ground + up }));
}

/** How high someone at (x, z) stands if there is a floor there: the highest one, or null on bare ground. */
export function floorAt(floors: readonly Floor[], x: number, z: number): number | null {
  let top: number | null = null;
  for (const f of floors) if (insideBox(x, z, f) && (top === null || f.top > top)) top = f.top;
  return top;
}
