import type { Trail } from './trails';

/**
 * Where the snow guns stand: tall thin towers down the edges of the wide groomed trails, as on
 * the real mountain, where most of the snow below the summit is made. No three.js here.
 */
export interface SnowGun {
  x: number;
  z: number;
  /** Turn about the upright axis: its head leans over the trail, toward its own +z. */
  turn: number;
}

/** Metres between guns along a trail, one side then the other. */
const SPACING = 85;
/** Only trails groomed at least this wide have snowmaking. */
const MIN_WIDTH = 24;
/** No more than this many on the whole mountain. */
const MOST = 320;

/**
 * @param onTrail whether a spot is on groomed snow, to stand each gun just off its edge
 */
export function snowGuns(trails: readonly Trail[], onTrail: (x: number, z: number) => boolean): SnowGun[] {
  const guns: SnowGun[] = [];
  let side = 1;
  for (const trail of trails) {
    if (trail.area || trail.glade || trail.width < MIN_WIDTH || !trail.name) continue;
    const p = trail.pts;
    let next = SPACING * 0.6;
    for (let i = 0; i + 3 < p.length && guns.length < MOST; i += 2) {
      const ax = p[i] as number;
      const az = p[i + 1] as number;
      const len = Math.hypot((p[i + 2] as number) - ax, (p[i + 3] as number) - az);
      if (len === 0) continue;
      const dx = ((p[i + 2] as number) - ax) / len;
      const dz = ((p[i + 3] as number) - az) / len;
      for (; next <= len && guns.length < MOST; next += SPACING) {
        const cx = ax + dx * next;
        const cz = az + dz * next;
        // Out from the middle to the edge of the snow, and a step beyond.
        const nx = -dz * side;
        const nz = dx * side;
        let out = 4;
        while (out < 45 && onTrail(cx + nx * out, cz + nz * out)) out += 1.5;
        side = -side;
        // Where two trails run together there is no edge to stand at.
        if (out >= 45) continue;
        const x = cx + nx * (out + 1);
        const z = cz + nz * (out + 1);
        // A sliver between two trails is no place for one, and nor is the snow itself.
        if (onTrail(x, z) || !onTrail(cx + nx * (out - 4), cz + nz * (out - 4))) continue;
        if (guns.some((g) => Math.hypot(g.x - x, g.z - z) < 30)) continue;
        guns.push({ x, z, turn: Math.atan2(-nx, -nz) });
      }
      next -= len;
    }
  }
  return guns;
}
