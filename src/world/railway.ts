import { faceToward, fromLocal, nearestOnLines } from './footprints';
import type { World } from './world';

/**
 * The North Creek depot and the Snow Train that waits at it. No three.js here.
 *
 * The depot's model stands where the map has the real station building, turned to lie along
 * the rails with its platform toward them. The train stands on the rails beside the platform.
 */
export interface DepotSetting {
  /** The middle of the station building, and the turn that puts its platform (its own +z) toward the rails. */
  x: number;
  z: number;
  turn: number;
  /** The building the map has for it, among `world.buildings`, or -1 if the map has none. */
  building: number;
  /** True when there are rails beside it for a train to stand on. */
  rails: boolean;
}

/** The station as the map names it. */
const STATION = 'North Creek';
/** From the middle of the station to the middle of the track: half the building, the platform, half a train. */
export const TRACK_OUT = 8.6;

export function depotSetting(world: World): DepotSetting | null {
  const place = world.places.find((p) => p.id === 'depot');
  if (!place) return null;
  const building = world.buildings.findIndex((b) => b.name === STATION);
  const base = building >= 0 ? (world.buildings[building] as { x: number; z: number; w: number; d: number; turn: number }) : { x: place.x, z: place.z, w: 26, d: 8, turn: 0 };
  const rail = nearestOnLines(world.rails, base.x, base.z);
  // No railway on the map, or none near: the depot stands as the map has it, square to the compass.
  if (!rail || rail.dist > 40) return { x: place.x, z: place.z, turn: 0, building: -1, rails: false };
  // Lengthways along the track, platform toward it...
  const along = Math.atan2(-rail.dz, rail.dx);
  const facing = faceToward({ x: base.x, z: base.z, w: 30, d: 8, turn: along }, rail.x, rail.z);
  // ...and set back so the platform's edge meets the side of the train.
  const back = rail.dist - TRACK_OUT;
  return { ...fromLocal({ x: base.x, z: base.z, turn: facing.turn }, 0, back), turn: facing.turn, building, rails: true };
}

export type CarKind = 'engine' | 'tender' | 'coach';

/** The train, from the front: how long each car is, in metres. */
export const TRAIN: readonly { kind: CarKind; length: number }[] = [
  { kind: 'engine', length: 9 },
  { kind: 'tender', length: 4.6 },
  { kind: 'coach', length: 13 },
  { kind: 'coach', length: 13 },
];
const COUPLING = 0.7;
export const TRAIN_LENGTH = TRAIN.reduce((sum, car) => sum + car.length, 0) + COUPLING * (TRAIN.length - 1);

export interface Car {
  kind: CarKind;
  length: number;
  /** The middle of the car, and the turn that lays its length along the track with its front toward its own +x. */
  x: number;
  z: number;
  turn: number;
}

/** Where each car of the train stands: in a line beside the depot's platform, the engine at the far end. */
export function trainCars(world: World): Car[] {
  const depot = depotSetting(world);
  if (!depot?.rails) return [];
  let front = TRAIN_LENGTH / 2;
  return TRAIN.map((car) => {
    const mid = front - car.length / 2;
    front -= car.length + COUPLING;
    return { kind: car.kind, length: car.length, ...fromLocal(depot, mid, TRACK_OUT), turn: depot.turn };
  });
}
