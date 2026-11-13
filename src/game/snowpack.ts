import type { Season } from '../look/season';
import { dayNumber } from './report';

/**
 * How much loose snow is lying, and where. The mountain has a day's worth of new snow on it:
 * what really fell at Gore since yesterday, when that can be had, and otherwise an amount
 * made up for the day. The groomers pack the trails overnight, so most of it is off them;
 * what is falling now lies on everything. No DOM or three.js here.
 */

/** New snow since yesterday, in centimetres, out of a forecast reply; or null if the reply does not say. */
export function freshFromForecast(reply: unknown): number | null {
  const sums = (reply as { daily?: { snowfall_sum?: unknown } } | null)?.daily?.snowfall_sum;
  if (!Array.isArray(sums)) return null;
  const total = sums.reduce((sum: number, cm) => sum + (typeof cm === 'number' && Number.isFinite(cm) && cm > 0 ? cm : 0), 0);
  return Math.min(60, total);
}

/**
 * New snow for a day when the real figure cannot be had: nothing much on most days, a few
 * inches on some, and now and then a proper dump. The same for a day every time.
 */
export function inventedFresh(day: string): number {
  const roll = (dayNumber(`${day}-snow`) % 1000) / 1000;
  if (roll < 0.45) return Math.round(roll * 8);
  if (roll < 0.8) return 5 + Math.round((roll - 0.45) * 30);
  return 16 + Math.round((roll - 0.8) * 90);
}

/** The loose snow off the trails that is always there in winter, in centimetres: nobody grooms the woods. */
const LYING = 8;
/** The deepest loose snow is drawn, in metres: on a groomed trail, and off one. */
const GROOMED_MOST = 0.14;
const WILD_MOST = 0.42;

/**
 * How deep the loose snow is at a place, in metres.
 * @param freshCm new snow since yesterday, in centimetres
 * @param snowing how hard it is snowing now, 0..1
 * @param groomed on a groomed trail, where last night's snow was packed down
 */
export function powderDepth(freshCm: number, snowing: number, groomed: boolean, season: Season): number {
  // Snow is winter's. Spring's is old and wet and holds a ski up.
  if (season !== 'winter') return 0;
  const fresh = Math.max(0, freshCm);
  const cm = groomed ? fresh * 0.35 + snowing * 4 : LYING + fresh * 0.9 + snowing * 6;
  return Math.min(groomed ? GROOMED_MOST : WILD_MOST, cm / 100);
}

/** How far a skier or a walker sinks into loose snow of a depth, in metres: not to the bottom of it. */
export const sinkIn = (depth: number): number => depth * 0.72;

/** Loose snow shallower than this leaves the ordinary lines of the skis and no trench, in metres. */
export const TRENCH_FROM = 0.045;
