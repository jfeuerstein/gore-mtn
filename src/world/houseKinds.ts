import { faceToward, nearestOnLines, setBack } from './footprints';
import type { Footprint, Place, Road } from './trails';

/**
 * What every building on the map without a name of its own is to be: a home of one sort or
 * another, a shed, a shop on Main Street, one of the ski area's own buildings. The map gives a
 * footprint and nothing else, so this reads the footprint the way a person reads a town: how
 * big it is, what it stands beside, which way it must face. No three.js here.
 *
 * Nothing is drawn from this file. `houses.ts` builds each plan.
 */
export type HouseKind =
  // Homes.
  | 'cape'
  | 'farmhouse'
  | 'gablefront'
  | 'foursquare'
  | 'camp'
  | 'ranch'
  // What stands behind a home, or out along a road.
  | 'shed'
  | 'garage'
  | 'barn'
  | 'warehouse'
  // Main Street.
  | 'falsefront'
  | 'brickblock'
  | 'porchshop'
  | 'storefront'
  // The ski area's own.
  | 'lodgewing'
  | 'workshop'
  | 'liftshack';

export interface HousePlan {
  /** Which of the map's buildings this is. */
  index: number;
  kind: HouseKind;
  /** Where it stands; `y` is the ground at the middle of its front wall, so its door can be walked up to. */
  x: number;
  y: number;
  z: number;
  /** Width along the front and depth back from it, in metres, and the turn that puts its front (its own +z) toward its road. */
  w: number;
  d: number;
  turn: number;
  /** What the board over the door says, for a shop or a lodge. */
  sign: string | null;
  /** Four repeatable numbers in 0..1 of its own, for its paint, its trim and its particulars. */
  rolls: [number, number, number, number];
}

/** The street the shops are on. */
const HIGH_STREET = 'Main Street';
/** A building whose front is within this of the middle of the high street is on it, in metres. */
const ON_STREET = 15;
/** No front wall on the high street stands nearer the middle of it than this: room for the road and a sidewalk. */
export const BUILDING_LINE = 6;
/** The town is the part of the high street within this of the depot; nearer than `ALL_SHOPS`, every front is a shop. */
const TOWN_REACH = 780;
const ALL_SHOPS = 400;
/** Further out, this share of fronts are shops and the rest are homes that face the street. */
const SHOPS_BEYOND = 0.45;
/** Buildings within this of the foot of the mountain belong to the ski area. */
const RESORT_REACH: Record<string, number> = { 'base-lodge': 270, 'ski-bowl-lodge': 120 };

/**
 * What the shops are, in the order they are given out along the street from the depot. Plain
 * trades, as a small town's shopfronts are, and none of them a real business.
 */
export const SHOP_SIGNS: readonly string[] = [
  'HARDWARE',
  'BOOKS & MAPS',
  'GENERAL STORE',
  'OUTFITTERS',
  'DINER',
  'ANTIQUES',
  'BARBER',
  'SKI & BIKE',
  'PHARMACY',
  'GALLERY',
  'YARN & THREAD',
  'ICE CREAM',
  'TRADING POST',
  'FLORIST',
  'CHOCOLATES',
  'RECORDS',
  'FIVE & DIME',
  'GUIDE SERVICE',
  'TOYS',
  'LAUNDROMAT',
  'CANOES',
  'PIZZA',
  'SHOE REPAIR',
  'POTTERY',
  'MAPLE SYRUP',
  'BAIT & TACKLE',
  'GARNET GIFTS',
  'THRIFT SHOP',
  'CLOCK REPAIR',
  'FEED & SEED',
  'NEWSSTAND',
  'SUNDRIES',
];

/** What the ski area's bigger buildings are, largest first. */
const RESORT_SIGNS: readonly string[] = ['NORTHWOODS LODGE · RENTALS', 'SNOW SPORTS SCHOOL', 'SKI PATROL', 'TICKETS'];

/** A repeatable number in 0..1 for a place, and others to go with it. */
function roll(x: number, z: number, n = 0): number {
  let t = (Math.imul(Math.round(x * 10) + n * 7919, 0x9e3779b1) ^ Math.imul(Math.round(z * 10) - n * 104729, 0x85ebca6b)) >>> 0;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

/** A home, by its footprint: how big it is and how long for its width. */
function homeKind(w: number, d: number, pick: number, inTown: boolean): HouseKind {
  const small = Math.min(w, d);
  const long = Math.max(w, d);
  const area = w * d;
  if (small < 5.5 || area < 42) return 'shed';
  if (area < 75) return long / small < 1.7 ? 'garage' : 'shed';
  if (area > 620) return pick < 0.45 ? 'barn' : 'warehouse';
  if (long / small >= 2.3 && small <= 10.5) return 'ranch';
  // Out of town there are more camps in the woods; in town, more old houses.
  const camp = inTown ? 0.1 : 0.38;
  if (pick < camp) return 'camp';
  const rest = (pick - camp) / (1 - camp);
  // A narrow front suits a house with its gable to the road.
  if (w < d * 0.85) return rest < 0.6 ? 'gablefront' : 'foursquare';
  return rest < 0.34 ? 'cape' : rest < 0.7 ? 'farmhouse' : rest < 0.86 ? 'foursquare' : 'gablefront';
}

/** A shop, by its footprint. */
function shopKind(w: number, d: number, pick: number): HouseKind {
  if (Math.min(w, d) < 6.5) return 'shed';
  if (w * d > 620) return 'warehouse';
  if (w >= 15) return pick < 0.5 ? 'porchshop' : 'brickblock';
  if (pick < 0.3) return 'falsefront';
  if (pick < 0.56) return w >= 8 ? 'brickblock' : 'falsefront';
  if (pick < 0.8) return 'porchshop';
  return 'storefront';
}

/**
 * A plan for every building on the map that has not been given a look of its own.
 * @param skip the buildings that are named places, by index: they are built from their own kits
 */
export function planHouses(
  buildings: readonly Footprint[],
  roads: readonly Road[],
  places: readonly Place[],
  heightAt: (x: number, z: number) => number,
  skip: ReadonlySet<number> = new Set(),
): HousePlan[] {
  const depot = places.find((p) => p.id === 'depot');
  const street = roads.filter((r) => r.name === HIGH_STREET);
  const plans: HousePlan[] = [];
  /** The fronts on the high street, with how far each is from the depot, to be given their trades in order. */
  const fronts: { plan: HousePlan; from: number }[] = [];
  const resort: { plan: HousePlan; area: number; base: string }[] = [];

  buildings.forEach((b, index) => {
    if (skip.has(index)) return;
    const rolls: [number, number, number, number] = [roll(b.x, b.z), roll(b.x, b.z, 1), roll(b.x, b.z, 2), roll(b.x, b.z, 3)];
    const fromDepot = depot ? Math.hypot(b.x - depot.x, b.z - depot.z) : Infinity;
    const inTown = fromDepot < TOWN_REACH + 300;
    // It faces the high street if it stands on it; otherwise whatever road is nearest.
    const onStreet = fromDepot < TOWN_REACH ? nearestOnLines(street, b.x, b.z) : null;
    const facingStreet = onStreet ? faceToward(b, onStreet.x, onStreet.z) : null;
    const main = onStreet !== null && facingStreet !== null && onStreet.dist - facingStreet.d / 2 < ON_STREET;
    const road = main ? onStreet : nearestOnLines(roads, b.x, b.z);
    const turned = road && road.dist < 90 ? faceToward(b, road.x, road.z) : { w: b.w, d: b.d, turn: b.turn };
    // Whatever stands in town, near the high street, keeps to the building line.
    const facing = fromDepot < TOWN_REACH ? setBack({ x: b.x, z: b.z, ...turned }, street, BUILDING_LINE) : { x: b.x, z: b.z, ...turned };
    const sin = Math.sin(facing.turn);
    const cos = Math.cos(facing.turn);
    const plan: HousePlan = {
      index,
      kind: homeKind(facing.w, facing.d, rolls[0], inTown),
      y: heightAt(facing.x + (sin * facing.d) / 2, facing.z + (cos * facing.d) / 2),
      ...facing,
      sign: null,
      rolls,
    };
    const base = Object.keys(RESORT_REACH).find((id) => {
      const p = places.find((q) => q.id === id);
      return p !== undefined && Math.hypot(b.x - p.x, b.z - p.z) < (RESORT_REACH[id] as number);
    });
    if (base) {
      const area = b.w * b.d;
      plan.kind = area < 60 ? 'liftshack' : area < 260 ? 'workshop' : 'lodgewing';
      resort.push({ plan, area, base });
    } else if (main && (fromDepot < ALL_SHOPS || rolls[1] < SHOPS_BEYOND)) {
      plan.kind = shopKind(facing.w, facing.d, rolls[0]);
      if (plan.kind !== 'shed') fronts.push({ plan, from: fromDepot });
    } else if (main && plan.kind === 'camp') {
      // Nobody has a camp on Main Street.
      plan.kind = 'farmhouse';
    }
    plans.push(plan);
  });

  // Trades are given out along the street, so no two neighbours sell the same thing.
  fronts.sort((a, b) => a.from - b.from);
  fronts.forEach((f, i) => {
    if (f.plan.kind !== 'warehouse') f.plan.sign = SHOP_SIGNS[i % SHOP_SIGNS.length] as string;
  });
  // The ski area's biggest buildings are named; the rest are sheds and shacks that need no name.
  const lodges = resort.filter((r) => r.base === 'base-lodge' && r.plan.kind === 'lodgewing').sort((a, b) => b.area - a.area);
  lodges.forEach((r, i) => {
    r.plan.sign = RESORT_SIGNS[i] ?? null;
  });
  return plans;
}

/** How tall each kind stands, roof and all, in metres: for keeping the camera above it. */
export function planHeight(p: HousePlan): number {
  const walls: Record<HouseKind, number> = {
    cape: 3.2,
    farmhouse: 5.8,
    gablefront: 5.6,
    foursquare: 5.8,
    camp: 3.2,
    ranch: 3,
    shed: 2.5,
    garage: 2.9,
    barn: 6,
    warehouse: 5.2,
    falsefront: 7.6,
    brickblock: 9.6,
    porchshop: 6,
    storefront: 5,
    lodgewing: 7,
    workshop: 5,
    liftshack: 3,
  };
  return walls[p.kind] + 0.6 + Math.min(6, Math.min(p.w, p.d) * 0.42);
}
