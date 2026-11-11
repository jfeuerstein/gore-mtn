import { faceToward, nearestOnLines, setBack } from './footprints';
import type { Footprint } from './trails';
import type { Whereabouts } from '../game/people';
import { locate, slug } from './whereabouts';
import type { World } from './world';

/**
 * The places in North Creek and round the mountain that have a name and a look of their own: the
 * inn, the post office, the church, the old mine buildings. Each is tied to something on the
 * real map (a named building, or a named point with a building by it), turned to face its road,
 * and given a style, a sign and a front door. No three.js here.
 */
export type TownStyle = 'inn' | 'store' | 'postoffice' | 'church' | 'hall' | 'barn' | 'cafe' | 'deli' | 'house' | 'mill' | 'powerhouse' | 'cabin' | 'station' | 'tavern' | 'shed' | 'firehouse';

interface Listing {
  id: string;
  /** What its sign says, in capitals. Empty for no sign. */
  sign: string;
  style: TownStyle;
  /** How to find it: a building's name on the map, or a named point with a building nearby. */
  building?: string;
  spot?: string;
  /** ...or the building nearest a described spot, such as where its keeper stands. */
  near?: Whereabouts;
}

export const TOWN_LISTINGS: readonly Listing[] = [
  { id: 'copperfield-inn', sign: 'COPPERFIELD INN', style: 'inn', building: 'Phoenix Inn Resort' },
  { id: 'tops', sign: 'MARKET', style: 'store', building: 'Tops' },
  { id: 'church', sign: '', style: 'church', building: 'Saint James Catholic Church' },
  { id: 'johnsburg-town-hall', sign: 'TOWN HALL & LIBRARY', style: 'hall', building: 'Johnsburg Town Hall' },
  { id: 'tannery-pond', sign: 'TANNERY POND', style: 'barn', building: 'Tannery Pond Community Association' },
  { id: 'hostel', sign: 'HEADS IN BEDS', style: 'house', building: 'Heads In Beds' },
  { id: 'tuning', sign: 'SKI TUNING', style: 'shed', building: 'Tuning Pavillion' },
  { id: 'north-creek-post-office', sign: 'POST OFFICE', style: 'postoffice', spot: 'north-creek-post-office' },
  { id: 'ski-bowl-cafe', sign: 'SKI BOWL CAFE', style: 'cafe', spot: 'ski-bowl-cafe' },
  { id: 'alpine-lodge', sign: 'ALPINE LODGE', style: 'inn', spot: 'the-alpine-lodge' },
  { id: 'tavern', sign: "BECK'S TAVERN", style: 'tavern', spot: 'becks-tavern' },
  // Where June bakes and Walt makes sandwiches: the buildings they stand outside.
  { id: 'cafe', sign: "JUNE'S BAKERY", style: 'cafe', near: { road: 'Main Street', from: 'depot', metres: 170 } },
  { id: 'deli', sign: "WALT'S DELI", style: 'deli', near: { road: 'Main Street', from: 'depot', metres: 290 } },
  { id: 'inn-on-gore', sign: 'THE INN ON GORE', style: 'inn', spot: 'the-inn-on-gore-mountain' },
  // The old Barton Mines hamlet, at the western edge of the map.
  { id: 'gore-mt-mineral-shop', sign: 'MINERAL SHOP', style: 'cabin', spot: 'gore-mt-mineral-shop' },
  { id: 'optical-mill', sign: 'OPTICAL MILL', style: 'mill', building: 'Optical Mill' },
  { id: 'power-house', sign: 'POWER HOUSE', style: 'powerhouse', building: 'Power House' },
  { id: 'old-office', sign: 'MINE OFFICE', style: 'house', building: 'Old Office' },
  { id: 'carpenter-shop', sign: 'CARPENTER', style: 'mill', building: 'Carpenter Shop' },
  { id: 'butler-building', sign: '', style: 'mill', building: 'Butler Building' },
  { id: 'fire-house', sign: 'FIRE HOUSE', style: 'firehouse', building: 'Fire House' },
  // On the mountain: a relic of the first gondola.
  { id: 'old-gondola-mid-station', sign: 'MID STATION · 1967', style: 'station', building: 'Old Gondola Mid Station' },
];

export interface TownPlace {
  id: string;
  sign: string;
  style: TownStyle;
  x: number;
  y: number;
  z: number;
  /** Width along the front and depth back from it, in metres. */
  w: number;
  d: number;
  /** Turn about the upright axis. The front, with the door and the sign, is the side its own +z faces. */
  turn: number;
  /** A spot just outside the front door. */
  door: { x: number; z: number };
  /** Which of the map's buildings this is, or -1 for one put up where the map has only a point. */
  building: number;
}

/** The street the town is built along, and how far back from the middle of it every front wall is kept. */
const HIGH_STREET = 'Main Street';
const BUILDING_LINE = 6;

/** How far out from the front wall the spot by the door is: clear of a porch. */
const DOOR_OUT = 4.5;

/** How near a building must be to a named point on the map to be the one meant, in metres. */
const SPOT_REACH = 45;

/** Every listed place that the map has, resolved to a footprint that faces its road. */
export function resolveTownPlaces(world: World): TownPlace[] {
  const out: TownPlace[] = [];
  const used = new Set<number>();
  for (const listing of TOWN_LISTINGS) {
    let index = -1;
    let base: Footprint | null = null;
    if (listing.building) {
      index = world.buildings.findIndex((b) => b.name === listing.building);
    } else {
      const spot = listing.spot ? world.spots.find((s) => s.id === listing.spot) : listing.near ? locate(world, listing.near) : null;
      if (!spot) continue;
      let bestDist = SPOT_REACH;
      world.buildings.forEach((b, i) => {
        const d = Math.hypot(b.x - spot.x, b.z - spot.z);
        // Not a shed, and not one already spoken for.
        if (d < bestDist && !used.has(i) && Math.min(b.w, b.d) >= 6) {
          bestDist = d;
          index = i;
        }
      });
      // The map has the name but no building: put one up on the spot.
      if (index < 0) base = { x: spot.x, y: world.source.heightAt(spot.x, spot.z), z: spot.z, w: 15, d: 10, turn: 0, kind: null };
    }
    if (index >= 0) {
      if (used.has(index)) continue;
      used.add(index);
      base = world.buildings[index] as Footprint;
    }
    if (!base) continue;
    const road = nearestOnLines(world.roads, base.x, base.z) ?? { x: base.x, z: base.z + 10 };
    // Turned to its road; and, if that is the high street, kept back from it far enough for a sidewalk.
    const facing = setBack({ x: base.x, z: base.z, ...faceToward(base, road.x, road.z) }, world.roads.filter((r) => r.name === HIGH_STREET), BUILDING_LINE);
    const sin = Math.sin(facing.turn);
    const cos = Math.cos(facing.turn);
    const out_ = facing.d / 2 + DOOR_OUT;
    out.push({
      id: listing.id,
      sign: listing.sign,
      style: listing.style,
      // It stands level with the ground at its front wall, so the door can always be walked up to.
      y: world.source.heightAt(facing.x + (sin * facing.d) / 2, facing.z + (cos * facing.d) / 2),
      ...facing,
      door: { x: facing.x + sin * out_, z: facing.z + cos * out_ },
      building: index,
    });
  }
  return out;
}

/** The listed place whose walls a point is at or just outside, if any: the one a person described as being there keeps. */
export function townPlaceAt(places: readonly TownPlace[], x: number, z: number, reach = 14): TownPlace | undefined {
  let best: TownPlace | undefined;
  let bestDist = Infinity;
  for (const p of places) {
    const d = Math.hypot(p.x - x, p.z - z);
    if (d < Math.max(p.w, p.d) / 2 + reach && d < bestDist) {
      bestDist = d;
      best = p;
    }
  }
  return best;
}

/** The listed place a description of whereabouts means, if any: by its id, or by the name of its building. */
export function townPlaceFor(places: readonly TownPlace[], spot: string): TownPlace | undefined {
  return places.find((p) => p.id === spot) ?? places.find((p) => {
    const listing = TOWN_LISTINGS.find((l) => l.id === p.id);
    return (listing?.spot === spot) || (listing?.building !== undefined && slug(listing.building) === spot);
  });
}

export { faceToward };
