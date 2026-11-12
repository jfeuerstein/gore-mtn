import { dayNumber } from './report';
import type { SaveData } from './save';

/**
 * Things that are only there at the right moment: a sea of cloud under the summits on a foggy
 * morning, shooting stars on the nights the real showers fall, and now and then the northern
 * lights. They are kept by the real calendar, clock and sky, as the conditions in the
 * passport are: nothing here can be had under a pinned hour. No DOM or three.js here.
 */
export interface Sight {
  id: 'sky-cloud' | 'sky-meteors' | 'sky-aurora';
  name: string;
  /** A few words for the Book's field notes. */
  note: string;
}

export const SIGHTS: readonly Sight[] = [
  { id: 'sky-cloud', name: 'A sea of cloud', note: 'You stood above it' },
  { id: 'sky-meteors', name: 'A meteor shower', note: 'Watched from the mountain' },
  { id: 'sky-aurora', name: 'The northern lights', note: 'Seen from the mountain' },
];

/** The year's meteor showers, by the evenings they are at their best. */
export const SHOWERS: readonly { name: string; month: number; from: number; to: number }[] = [
  { name: 'the Quadrantids', month: 1, from: 2, to: 4 },
  { name: 'the Lyrids', month: 4, from: 21, to: 23 },
  { name: 'the Eta Aquariids', month: 5, from: 4, to: 6 },
  { name: 'the Perseids', month: 8, from: 10, to: 14 },
  { name: 'the Orionids', month: 10, from: 20, to: 22 },
  { name: 'the Leonids', month: 11, from: 16, to: 18 },
  { name: 'the Geminids', month: 12, from: 12, to: 15 },
];

/** The shower that falls on a day's night, if one does. */
export function showerOn(day: string): { name: string } | null {
  const [, m, d] = day.split('-').map(Number) as [number, number, number];
  return SHOWERS.find((s) => s.month === m && d >= s.from && d <= s.to) ?? null;
}

/** One night in this many, in the dark half of the year, has the northern lights. */
const AURORA_EVERY = 6;

/** True on the nights the northern lights are out: now and then, from September to March. The same nights for everyone. */
export function auroraOn(day: string): boolean {
  const [, m] = day.split('-').map(Number) as [number, number];
  if (m > 3 && m < 9) return false;
  return dayNumber(`${day}-aurora`) % AURORA_EVERY === 0;
}

/** How high the top of the cloud lies when it fills the valleys, as a share of the mountain's height. */
export const CLOUD_TOP = 0.42;
/** How far above it someone has to be to be said to stand above it, in metres. */
export const CLOUD_CLEAR = 45;

/**
 * True when cloud is lying in the valleys under a clear sky: low cloud or fog, with nothing
 * falling, in the first hours of the day.
 * @param low how much low cloud there is, 0..1
 * @param hour the hour at Gore, 0..23
 */
export function cloudSea(low: number, snowing: number, hour: number): boolean {
  return low > 0.5 && snowing < 0.2 && hour >= 5 && hour < 11;
}

/** How many shooting stars, watched, earn the night skis. */
export const METEORS_FOR_SKIS = 5;

/**
 * Something in the sky has been seen under the real sky. Kept the first time, with what it
 * earns: snow-white goggles for standing above the cloud, the night skis for the northern
 * lights or for enough shooting stars.
 * @returns whether this was the first time, and what there is to give
 */
export function sawSight(save: SaveData, id: Sight['id'], day: string): { first: boolean; gear: string[] } {
  const first = !(id in save.secrets);
  if (first) save.secrets[id] = day;
  const owns = (gear: string): boolean => save.gear.owned.includes(gear);
  const gear: string[] = [];
  if (id === 'sky-cloud' && !owns('goggles-snow')) gear.push('goggles-snow');
  if (id === 'sky-aurora' && !owns('skis-night')) gear.push('skis-night');
  if (id === 'sky-meteors' && save.meteors >= METEORS_FOR_SKIS && !owns('skis-night')) gear.push('skis-night');
  return { first, gear };
}
