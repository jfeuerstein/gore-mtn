import { DIFFICULTY_MARK, type Difficulty, type Lift, type Trail } from './trails';

/**
 * Where the signs on the mountain stand, and what they say. No three.js here.
 *
 * Every named trail has a sign at its top, at the edge of the snow, as on the real mountain:
 * green circle, blue square, black diamond. Where several trails set off from the same spot
 * their boards share a post. Every lift has its name at the bottom station.
 */
export interface Board {
  text: string;
  difficulty: Difficulty | 'lift';
}

export interface SignPost {
  x: number;
  z: number;
  /** The way the boards face, as a turn about the upright axis: 0 faces south (+z). */
  turn: number;
  boards: Board[];
}

/** How far down from the top of a trail its sign stands, in metres. */
const DOWN = 9;
/** Posts closer together than this share one post. */
const SHARE = 9;
/** The most boards one post carries. */
const MOST = 5;

/** The point a distance along a flat list of x, z pairs, and the direction of travel there. */
function along(pts: readonly number[], metres: number): { x: number; z: number; dx: number; dz: number } {
  let left = metres;
  for (let i = 0; i + 3 < pts.length; i += 2) {
    const ax = pts[i] as number;
    const az = pts[i + 1] as number;
    const bx = pts[i + 2] as number;
    const bz = pts[i + 3] as number;
    const len = Math.hypot(bx - ax, bz - az);
    if (len === 0) continue;
    if (left <= len || i + 5 >= pts.length) {
      const t = Math.min(1, left / len);
      return { x: ax + (bx - ax) * t, z: az + (bz - az) * t, dx: (bx - ax) / len, dz: (bz - az) / len };
    }
    left -= len;
  }
  return { x: pts[0] ?? 0, z: pts[1] ?? 0, dx: 0, dz: 1 };
}

/**
 * @param heightAt the height of the ground, to tell which stretch of a trail is its top
 * @param onTrail whether a spot is on groomed snow, to stand the post at its edge
 */
export function trailSignPosts(
  trails: readonly Trail[],
  lifts: readonly Lift[],
  heightAt: (x: number, z: number) => number,
  onTrail: (x: number, z: number) => boolean,
): SignPost[] {
  const posts: SignPost[] = [];
  const add = (x: number, z: number, turn: number, board: Board): void => {
    const shared = posts.find((p) => p.boards.length < MOST && Math.hypot(p.x - x, p.z - z) < SHARE && !p.boards.some((b) => b.text === board.text));
    if (shared) shared.boards.push(board);
    else posts.push({ x, z, turn, boards: [board] });
  };

  // A trail is often drawn on the map in several stretches. The sign goes at the top of the highest.
  const tops = new Map<string, Trail>();
  for (const trail of trails) {
    if (!trail.name || trail.area || trail.pts.length < 4) continue;
    const best = tops.get(trail.name);
    if (!best || heightAt(trail.pts[0] as number, trail.pts[1] as number) > heightAt(best.pts[0] as number, best.pts[1] as number)) tops.set(trail.name, trail);
  }
  for (const [name, trail] of tops) {
    const at = along(trail.pts, DOWN);
    // Off to the skier's right, a step past the edge of the snow.
    const rx = -at.dz;
    const rz = at.dx;
    let out = trail.glade ? 4 : 2;
    while (out < 34 && onTrail(at.x + rx * out, at.z + rz * out)) out += 1.5;
    out += 1;
    // The boards face back up the hill, to whoever is about to set off.
    add(at.x + rx * out, at.z + rz * out, Math.atan2(-at.dx, -at.dz), { text: `${DIFFICULTY_MARK[trail.difficulty]} ${name.toUpperCase()}`, difficulty: trail.difficulty });
  }

  // Lifts: the name by the bottom station, to the left of the line, facing whoever walks up.
  const named = new Set<string>();
  for (const lift of lifts) {
    if (!lift.name || lift.pts.length < 4 || named.has(lift.name)) continue;
    named.add(lift.name);
    const at = along(lift.pts, 0);
    posts.push({ x: at.x + at.dz * 7 - at.dx * 5, z: at.z - at.dx * 7 - at.dz * 5, turn: Math.atan2(-at.dx, -at.dz), boards: [{ text: lift.name.toUpperCase(), difficulty: 'lift' }] });
  }
  return posts;
}

/** Board and lettering colours, as on the mountain's own signs. */
export const BOARD_COLOURS: Record<Board['difficulty'], { board: string; ink: string }> = {
  easy: { board: '#2f8a4e', ink: '#fffdf7' },
  intermediate: { board: '#2b5fb5', ink: '#fffdf7' },
  advanced: { board: '#1d2026', ink: '#fffdf7' },
  expert: { board: '#1d2026', ink: '#fffdf7' },
  freeride: { board: '#d9822b', ink: '#1d2026' },
  lift: { board: '#c8402d', ink: '#fffdf7' },
};

/** Heights of things on a post, in metres above the ground. */
export const BOARD_HEIGHT = 0.5;
export const BOARD_STEP = 0.58;
export const LOWEST_BOARD = 1.7;
