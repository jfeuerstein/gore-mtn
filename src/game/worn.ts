import { WORN_FULL, WORN_MOST, type SaveData } from './save';

/**
 * Paths worn by walking. Off the trails and the roads, the ground remembers where the player
 * has walked: a square of it crossed a few times is worn bare, and stays so. Walk the same way
 * to the same place often enough and there is a path there, on the ground and in pencil on
 * the map, that nobody made but the player. No DOM or three.js here.
 */

/** The side of a square of ground, in metres. */
export const WORN_CELL = 6;
/** How many times a square is crossed before it shows. */
export const WORN_AT = 3;
/** How many worn squares, together, are a path: about a quarter of a kilometre of it. */
export const PATH_FOR_LEAF = 40;

/** The square a place is in. */
export const wornKey = (x: number, z: number): string => `${Math.floor(x / WORN_CELL)},${Math.floor(z / WORN_CELL)}`;

/** The middle of a square. */
export function wornCentre(key: string): { x: number; z: number } {
  const [cx, cz] = key.split(',').map(Number) as [number, number];
  return { x: (cx + 0.5) * WORN_CELL, z: (cz + 0.5) * WORN_CELL };
}

/** The squares that are worn enough to show. */
export function wornCells(save: SaveData): { key: string; x: number; z: number; wear: number }[] {
  return Object.entries(save.worn)
    .filter(([, n]) => n >= WORN_AT)
    .map(([key, n]) => ({ key, ...wornCentre(key), wear: n }));
}

/**
 * The player has stepped into a square of open ground, on foot. It is a little more worn.
 * @returns whether it has just become worn enough to show, and what that has earned
 */
export function tread(save: SaveData, key: string): { shows: boolean; gear: string[] } {
  const was = save.worn[key] ?? 0;
  if (was >= WORN_FULL) return { shows: false, gear: [] };
  if (was === 0 && Object.keys(save.worn).length >= WORN_MOST) {
    // The ground keeps only so much: the least worn square, the one nobody went back to, grows over.
    let least: string | null = null;
    for (const [k, n] of Object.entries(save.worn)) if (least === null || n < (save.worn[least] as number)) least = k;
    if (least === null || (save.worn[least] as number) >= WORN_AT) return { shows: false, gear: [] };
    delete save.worn[least];
  }
  save.worn[key] = was + 1;
  const shows = was + 1 === WORN_AT;
  const gear = shows && wornCells(save).length >= PATH_FOR_LEAF && !save.gear.owned.includes('trail-leaf') ? ['trail-leaf'] : [];
  return { shows, gear };
}
