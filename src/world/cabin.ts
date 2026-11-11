import { fromLocal } from './footprints';
import { distToPolyline, type Footprint, type Place } from './trails';

/**
 * Where the player's cabin stands. It takes the plot of a real building: a small one, by
 * itself in the woods, a short way from the Base Lodge and beside a trail, so that the day can
 * begin and end there on skis. The map gives the plot; this turns it to face its trail and
 * says where its door, its shelf, its board and its feeder are. No three.js here.
 */

/** The cabin's own size, in metres: the map's footprint is a shed's, and a cabin wants a little more. */
export const CABIN = {
  w: 7.2,
  d: 5.6,
  /** How far the porch stands out from the front wall. */
  porch: 2.2,
  /** Wall height, and the height of the roof above it. */
  walls: 2.9,
  roof: 1.9,
} as const;

export interface CabinSite {
  /** Which of the map's buildings it replaces. */
  building: number;
  x: number;
  z: number;
  /** The turn that puts its front (its own +z) toward its trail. */
  turn: number;
}

/** No nearer the Base Lodge than this (that is the resort's own ground), and no further, in metres. */
const NEAREST = 150;
const FURTHEST = 600;
/** A plot is by itself if no other building stands within this. */
const ALONE = 100;
/** Bigger than this is somebody's house, in square metres. */
const SMALL = 70;

/** The plot, or null on a map that has none to give. */
export function cabinSite(buildings: readonly Footprint[], places: readonly Place[], trails: readonly { pts: number[]; area?: boolean }[]): CabinSite | null {
  const base = places.find((p) => p.id === 'base-lodge');
  if (!base) return null;
  let best: { index: number; far: number } | null = null;
  buildings.forEach((b, index) => {
    const far = Math.hypot(b.x - base.x, b.z - base.z);
    if (far < NEAREST || far > FURTHEST || b.w * b.d > SMALL) return;
    if (buildings.some((o, i) => i !== index && Math.hypot(o.x - b.x, o.z - b.z) < ALONE)) return;
    if (!best || far < best.far) best = { index, far };
  });
  const found = best as { index: number; far: number } | null;
  if (!found) return null;
  const plot = buildings[found.index] as Footprint;
  // It faces the nearest trail: that is the way home.
  let near = Infinity;
  let turn = plot.turn;
  for (const trail of trails) {
    if (trail.area) continue;
    const pts = trail.pts;
    for (let i = 0; i + 3 < pts.length; i += 2) {
      const ax = pts[i] as number;
      const az = pts[i + 1] as number;
      const bx = pts[i + 2] as number;
      const bz = pts[i + 3] as number;
      const d = distToPolyline(plot.x, plot.z, [ax, az, bx, bz]);
      if (d >= near) continue;
      near = d;
      // The nearest point of this stretch, and the turn that faces it.
      const len = Math.hypot(bx - ax, bz - az) || 1;
      const t = Math.min(1, Math.max(0, ((plot.x - ax) * (bx - ax) + (plot.z - az) * (bz - az)) / (len * len)));
      turn = Math.atan2(ax + (bx - ax) * t - plot.x, az + (bz - az) * t - plot.z);
    }
  }
  return { building: found.index, x: plot.x, z: plot.z, turn };
}

/** Places about the cabin, in the world: each is a step from its middle, along its front and out from it. */
export function cabinSpots(site: CabinSite): {
  /** Where to stand to be at the door: on the ground in front of the porch. */
  door: { x: number; z: number };
  /** The foot of the feeder's post, off to one side of the yard. */
  feeder: { x: number; z: number };
  /** Where the day begins: a few steps back from the porch, looking at the cabin. */
  yard: { x: number; z: number };
} {
  return {
    door: fromLocal(site, 0, CABIN.d / 2 + CABIN.porch + 0.9),
    feeder: fromLocal(site, FEEDER.x, FEEDER.z),
    yard: fromLocal(site, -0.6, CABIN.d / 2 + CABIN.porch + 6.5),
  };
}

/** Where the feeder stands, in the cabin's own frame, and how high its tray is. */
export const FEEDER = { x: 4.9, z: CABIN.d / 2 + 3.6, tray: 1.55 } as const;

/** Where the chimney comes up through the roof, in the cabin's own frame, and how high its top is above the floor. */
export const CHIMNEY = { x: -(CABIN.w / 2) + 0.95, z: -(CABIN.d / 2) + 0.95, top: CABIN.walls + CABIN.roof + 0.7 } as const;
