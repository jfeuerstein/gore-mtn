import { describe, expect, it } from 'vitest';
import {
  buildLiftPath,
  CABLE_HEIGHT,
  inLiftClearing,
  LIFT_SPEED,
  LINE_CLEARING,
  LINE_OFFSET,
  pointAlong,
  riderAlong,
  rideSpeed,
  STATION_CLEARING,
  stationNear,
  TOWER_SPACING,
  towerYaw,
} from './lifts';
import { loadTestWorld } from './testWorld';
import type { Lift } from './trails';

// A straight lift 300 m long heading east up a 10% grade.
const lift: Lift = { name: 'Test Chair', kind: 'chair_lift', pts: [0, 0, 300, 0] };
const hill = (x: number): number => x * 0.1;
const path = buildLiftPath(lift, hill);

describe('buildLiftPath', () => {
  it('puts a tower at each end and at even spacing between', () => {
    expect(path.points.length / 3).toBe(300 / TOWER_SPACING + 1);
    expect(path.points.slice(0, 3)).toEqual([0, CABLE_HEIGHT, 0]);
    expect(path.points.slice(-3)).toEqual([300, 30 + CABLE_HEIGHT, 0]);
  });

  it('measures length along the cable, not across the map', () => {
    expect(path.length).toBeCloseTo(Math.hypot(300, 30));
    expect(path.at[0]).toBe(0);
    expect(path.at.at(-1)).toBeCloseTo(path.length);
  });

  it('follows a lift line with a bend in it without doubling the tower at the bend', () => {
    const bent = buildLiftPath({ name: null, kind: 'chair_lift', pts: [0, 0, 120, 0, 120, 120] }, () => 0);
    expect(bent.points.length / 3).toBe(5);
    expect(bent.length).toBeCloseTo(240);
  });
});

describe('pointAlong', () => {
  it('starts at the bottom station and ends at the top', () => {
    expect(pointAlong(path, 0)).toMatchObject({ x: 0, y: CABLE_HEIGHT, z: 0 });
    const top = pointAlong(path, path.length);
    expect(top.x).toBeCloseTo(300);
    expect(top.y).toBeCloseTo(30 + CABLE_HEIGHT);
  });

  it('moves evenly along the cable and faces the way it travels', () => {
    const mid = pointAlong(path, path.length / 2);
    expect(mid.x).toBeCloseTo(150);
    expect(mid.y).toBeCloseTo(15 + CABLE_HEIGHT);
    // Heading east: yaw -PI/2 in the game's convention.
    expect(mid.yaw).toBeCloseTo(-Math.PI / 2);
  });

  it('stays on the cable for distances past either end', () => {
    expect(pointAlong(path, -50).x).toBe(0);
    expect(pointAlong(path, 9999).x).toBeCloseTo(300);
  });
});

describe('riderAlong', () => {
  it('carries the rider up on the right of the towers', () => {
    // Heading east, the rider's right is south (+z).
    const mid = riderAlong(path, path.length / 2);
    expect(mid.x).toBeCloseTo(150);
    expect(mid.z).toBeCloseTo(LINE_OFFSET);
    expect(mid.y).toBeCloseTo(pointAlong(path, path.length / 2).y);
  });

  it('keeps the rider clear of every tower', () => {
    for (let i = 0; i < path.points.length; i += 3) {
      const at = riderAlong(path, path.at[i / 3] as number);
      expect(Math.hypot(at.x - (path.points[i] as number), at.z - (path.points[i + 2] as number))).toBeCloseTo(LINE_OFFSET);
    }
  });
});

describe('towerYaw', () => {
  it('faces along the line at every tower, including the end ones', () => {
    for (let i = 0; i < path.points.length / 3; i++) expect(towerYaw(path, i)).toBeCloseTo(-Math.PI / 2);
  });
});

describe('stationNear', () => {
  const other = buildLiftPath({ name: 'Other', kind: 'gondola', pts: [40, 0, 40, 300] }, () => 0);
  it('finds the lift whose bottom station is closest', () => {
    expect(stationNear([path, other], 5, 5)?.lift.name).toBe('Test Chair');
    expect(stationNear([path, other], 35, 5)?.lift.name).toBe('Other');
  });

  it('finds nothing away from any bottom station, including at a top station', () => {
    expect(stationNear([path, other], 150, 100)).toBeNull();
    expect(stationNear([path, other], 300, 0)).toBeNull();
  });
});

describe('rideSpeed', () => {
  it('eases out of the bottom station, runs at full speed, and eases into the top', () => {
    expect(rideSpeed(path, 0)).toBeLessThan(LIFT_SPEED * 0.5);
    expect(rideSpeed(path, 0)).toBeGreaterThan(0);
    expect(rideSpeed(path, path.length / 2)).toBe(LIFT_SPEED);
    expect(rideSpeed(path, path.length)).toBeLessThan(LIFT_SPEED * 0.5);
  });
});

describe('inLiftClearing', () => {
  it('clears a corridor along the line', () => {
    expect(inLiftClearing([path], 150, 0)).toBe(true);
    expect(inLiftClearing([path], 150, LINE_CLEARING - 1)).toBe(true);
    expect(inLiftClearing([path], 150, LINE_CLEARING + 1)).toBe(false);
  });

  it('clears a wider circle at each station', () => {
    expect(inLiftClearing([path], -(STATION_CLEARING - 1), 0)).toBe(true);
    expect(inLiftClearing([path], 300 + STATION_CLEARING - 1, 0)).toBe(true);
    expect(inLiftClearing([path], 0, STATION_CLEARING - 1)).toBe(true);
    expect(inLiftClearing([path], -(STATION_CLEARING + 1), 0)).toBe(false);
  });

  it('leaves the rest of the forest alone', () => {
    expect(inLiftClearing([path], 150, 200)).toBe(false);
    expect(inLiftClearing([], 0, 0)).toBe(false);
  });
});

describe('the real lifts', () => {
  const world = loadTestWorld();
  const paths = world.lifts.map((l) => buildLiftPath(l, (x, z) => world.source.heightAt(x, z)));

  it('all climb, and none takes longer than about a minute and a half', () => {
    for (const p of paths) {
      expect(p.points.at(-2) as number, String(p.lift.name)).toBeGreaterThan(p.points[1] as number);
      expect(p.length / LIFT_SPEED, String(p.lift.name)).toBeLessThan(90);
    }
  });

  it('can be boarded from the foot of each lift, by name', () => {
    for (const p of paths) {
      expect(stationNear(paths, p.points[0] as number, p.points[2] as number)?.lift.name).toBe(p.lift.name);
    }
    expect(paths.map((p) => p.lift.name)).toContain('Straight Brook Quad');
  });

  it('never drags the rider through the ground', () => {
    for (const p of paths) {
      for (let d = 0; d <= p.length; d += 10) {
        const at = pointAlong(p, d);
        expect(at.y - world.source.heightAt(at.x, at.z), `${p.lift.name} at ${d} m`).toBeGreaterThan(-20);
      }
    }
  });
});
