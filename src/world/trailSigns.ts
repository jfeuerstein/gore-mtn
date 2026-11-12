import type { Difficulty, Lift, Trail } from './trails';

/**
 * Where the signs on the mountain stand, and what they say. No three.js here.
 *
 * Every named trail has a sign at its mouth: a few metres down from its top and at its own
 * shoulder, so that it is seen by whoever is about to set off down it and can be taken for
 * no other trail's. It carries the trail's mark (green circle, blue square, black diamond)
 * large on a panel of its own, to be read from across the snow, and its name on a plank
 * underneath. Where trails set off from the very same spot their planks share a post.
 * Every lift has its name at the bottom station.
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
const DOWN = 12;
/**
 * The furthest a sign stands from the middle of its trail, in metres. Where the snow is wider
 * than this (a summit, a junction), the sign stands on the snow at the trail's shoulder
 * rather than away at the far edge, where it would mark nothing.
 */
export const SHOULDER = 8;
/** Posts closer together than this share one post. */
const SHARE = 7;
/** The most planks one post carries. */
export const MOST = 3;

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
    // At the trail's shoulder: just past the edge of the snow on whichever side the edge is
    // nearer, or, where the snow runs wide, on it, at arm's length from the trail's middle.
    const rx = -at.dz;
    const rz = at.dx;
    const edge = (side: number): number => {
      for (let out = 2; out <= SHOULDER; out += 1) if (!onTrail(at.x + rx * side * out, at.z + rz * side * out)) return out + 0.8;
      return Infinity;
    };
    const right = trail.glade ? 3 : edge(1);
    const left = trail.glade ? Infinity : edge(-1);
    const side = left < right ? -1 : 1;
    const out = Math.min(SHOULDER, Math.min(right, left));
    // The sign faces back up the hill, to whoever is about to set off.
    add(at.x + rx * side * out, at.z + rz * side * out, Math.atan2(-at.dx, -at.dz), { text: name.toUpperCase(), difficulty: trail.difficulty });
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

/** Every plank is the paper and ink of the rest of the game; what tells one trail from another is its mark. */
export const BOARD_PAPER = '#f7f1e3';
export const BOARD_INK = '#22304a';

/** Heights of things on a post, in metres above the ground. */
export const BOARD_HEIGHT = 0.72;
export const BOARD_STEP = 0.82;
export const LOWEST_BOARD = 1.8;
/** The panel that carries a trail's mark, above its name: a square this many metres a side. */
export const MARK_PANEL = 1.5;
