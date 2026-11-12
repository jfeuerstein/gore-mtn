import { describe, expect, it } from 'vitest';
import { angleDiff } from './cameraMath';
import {
  advanceSki,
  BIKE,
  descentAlong,
  fallLineYaw,
  SKI,
  skierAt,
  slipAngle,
  speedOf,
  SPRING_SKI,
  stickToSki,
  travelYaw,
  type SkiGround,
  type SkiParams,
  type SkiInput,
  type SkiState,
} from './skiPhysics';
import { loadTestWorld } from '../world/testWorld';

const DEG = Math.PI / 180;
const NONE: SkiInput = { steer: 0, tuck: 0, brake: 0 };
const TUCK: SkiInput = { steer: 0, tuck: 1, brake: 0 };
const BRAKE: SkiInput = { steer: 0, tuck: 0, brake: 1 };
const steer = (v: number): SkiInput => ({ steer: v, tuck: 0, brake: 0 });

/** A flat-sided slope that falls toward +z (south) at `deg` degrees. */
const ramp = (deg: number): SkiGround => {
  const m = Math.tan(deg * DEG);
  const len = Math.hypot(1, m);
  return { normalAt: () => [0, 1 / len, m / len] };
};
const FLAT = ramp(0);
const DOWNHILL = Math.PI; // yaw that faces +z
const ACROSS = Math.PI / 2;
const UPHILL = 0;

/** A skier already moving at `speed` along `heading`. */
const moving = (heading: number, speed: number): SkiState => ({
  ...skierAt(0, 0, heading),
  vx: -Math.sin(heading) * speed,
  vz: -Math.cos(heading) * speed,
});
const run = (ground: SkiGround, start: SkiState, input: SkiInput, seconds: number, groomed = true): SkiState => {
  let s = start;
  for (let t = 0; t < seconds; t += 1 / 60) s = advanceSki(s, input, ground, () => groomed, 1 / 60);
  return s;
};
const topSpeed = (deg: number, input = NONE, groomed = true) => speedOf(run(ramp(deg), skierAt(0, 0, DOWNHILL), input, 60, groomed));

describe('descentAlong and fallLineYaw', () => {
  it('measures the slope in the direction of travel', () => {
    const g = ramp(30);
    expect(descentAlong(g, 0, 0, DOWNHILL)).toBeCloseTo(Math.sin(30 * DEG));
    expect(descentAlong(g, 0, 0, UPHILL)).toBeCloseTo(-Math.sin(30 * DEG));
    expect(descentAlong(g, 0, 0, ACROSS)).toBeCloseTo(0);
  });

  it('finds the way straight downhill', () => {
    expect(Math.abs(angleDiff(fallLineYaw(ramp(20), 0, 0), DOWNHILL))).toBeLessThan(1e-9);
  });
});

describe('gravity and speed', () => {
  it('starts sliding when pointed down a slope and moves the right way', () => {
    const s = run(ramp(20), skierAt(0, 0, DOWNHILL), NONE, 3);
    expect(speedOf(s)).toBeGreaterThan(5);
    expect(s.z).toBeGreaterThan(5);
    expect(s.x).toBeCloseTo(0);
  });

  it('settles at a top speed that rises with steepness', () => {
    const green = topSpeed(12);
    const blue = topSpeed(20);
    const black = topSpeed(32);
    expect(green).toBeGreaterThan(15);
    expect(green).toBeLessThan(20);
    expect(blue).toBeGreaterThan(20);
    expect(blue).toBeLessThan(26);
    expect(black).toBeGreaterThan(blue + 3);
    expect(black).toBeLessThan(33);
  });

  it('goes faster in a tuck', () => {
    expect(topSpeed(20, TUCK)).toBeGreaterThan(topSpeed(20) * 1.25);
  });

  it('is slower in ungroomed snow', () => {
    expect(topSpeed(20, NONE, false)).toBeLessThan(topSpeed(20) * 0.8);
  });

  it('builds speed over seconds, not instantly', () => {
    const top = topSpeed(20);
    expect(speedOf(run(ramp(20), skierAt(0, 0, DOWNHILL), NONE, 2))).toBeLessThan(top * 0.5);
    expect(speedOf(run(ramp(20), skierAt(0, 0, DOWNHILL), NONE, 12))).toBeGreaterThan(top * 0.8);
  });
});

describe('standing still', () => {
  it('holds across the slope, facing uphill, and on a barely tilted flat', () => {
    expect(speedOf(run(ramp(25), skierAt(0, 0, ACROSS), NONE, 5))).toBe(0);
    expect(speedOf(run(ramp(25), skierAt(0, 0, UPHILL), NONE, 5))).toBe(0);
    expect(speedOf(run(ramp(3), skierAt(0, 0, DOWNHILL), NONE, 5))).toBe(0);
  });

  it('never slides backwards when momentum runs out going uphill', () => {
    const s = run(ramp(15), moving(UPHILL, 8), NONE, 20);
    expect(speedOf(s)).toBe(0);
    expect(s.z).toBeLessThan(0); // it coasted uphill and stayed there
  });

  it('can step round on the spot', () => {
    expect(run(FLAT, skierAt(0, 0, 0), steer(1), 1.5).heading).toBeLessThan(-2);
    expect(run(FLAT, skierAt(0, 0, 0), steer(-1), 1.5).heading).toBeGreaterThan(2);
  });

  it('lets the skier pole across the flat but not race on it', () => {
    const poling = speedOf(run(FLAT, skierAt(0, 0, 0), TUCK, 20));
    // A good pace: a flat runout is not a trudge. But slower than any real slope.
    expect(poling).toBeGreaterThan(7.5);
    expect(poling).toBeLessThan(SKI.poleMaxSpeed);
    // And it gets there briskly: most of the way in the first four seconds.
    expect(speedOf(run(FLAT, skierAt(0, 0, 0), TUCK, 4))).toBeGreaterThan(5.5);
    expect(speedOf(run(FLAT, moving(0, 6), NONE, 60))).toBe(0); // gliding alone comes to rest
  });
});

describe('turning', () => {
  it('turns right for a thumb to the right and left for the left', () => {
    expect(run(FLAT, moving(0, 12), steer(1), 0.5).heading).toBeLessThan(-0.2);
    expect(run(FLAT, moving(0, 12), steer(-1), 0.5).heading).toBeGreaterThan(0.2);
  });

  it('eases into a turn instead of snapping', () => {
    const early = run(FLAT, moving(0, 12), steer(1), 0.1);
    const later = run(FLAT, early, steer(1), 0.1);
    // More heading change in the second tenth of a second than the first.
    expect(Math.abs(later.heading - early.heading)).toBeGreaterThan(Math.abs(early.heading) * 1.3);
  });

  it('carves a gentle turn: the path follows the skis and little speed is lost', () => {
    const straight = run(FLAT, moving(0, 15), NONE, 1.5);
    const carved = run(FLAT, moving(0, 15), steer(0.4), 1.5);
    expect(Math.abs(slipAngle(carved))).toBeLessThan(0.2);
    expect(Math.abs(angleDiff(travelYaw(carved), 0))).toBeGreaterThan(0.4); // the path really did bend
    expect(speedOf(carved)).toBeGreaterThan(speedOf(straight) * 0.93);
  });

  it('drifts wide in a hard turn at speed: momentum carries on and speed scrubs off', () => {
    const straight = run(FLAT, moving(0, 22), NONE, 1);
    const hard = run(FLAT, moving(0, 22), steer(1), 1);
    // The skis have turned further than the skier's path has.
    expect(Math.abs(slipAngle(hard))).toBeGreaterThan(0.25);
    expect(speedOf(hard)).toBeLessThan(speedOf(straight) * 0.94);
    // The same thumb at low speed carves without drifting.
    expect(Math.abs(slipAngle(run(FLAT, moving(0, 7), steer(1), 1)))).toBeLessThan(0.2);
  });

  it('turns in a tighter circle at low speed than at high speed', () => {
    const radius = (speed: number) => {
      const s = run(FLAT, moving(0, speed), steer(0.5), 0.6);
      const again = run(FLAT, s, steer(0.5), 0.2);
      const turnRate = Math.abs(angleDiff(travelYaw(again), travelYaw(s))) / 0.2;
      return speedOf(again) / turnRate;
    };
    expect(radius(6)).toBeLessThan(radius(22));
  });
});

describe('hockey stop', () => {
  it('swings the skis across the direction of travel', () => {
    const s = run(ramp(20), moving(DOWNHILL, 18), BRAKE, 0.6);
    expect(Math.abs(slipAngle(s))).toBeGreaterThan(1.2);
    // Still heading down the hill while the skis are sideways.
    expect(Math.abs(angleDiff(travelYaw(s), DOWNHILL))).toBeLessThan(0.3);
  });

  it('stops within a few seconds, even from speed on a black', () => {
    expect(speedOf(run(ramp(20), moving(DOWNHILL, 18), BRAKE, 4))).toBe(0);
    expect(speedOf(run(ramp(34), moving(DOWNHILL, 30), BRAKE, 8))).toBe(0);
  });

  it('leaves the skier parked across the hill, where they stay when the thumb lifts', () => {
    const stopped = run(ramp(25), moving(DOWNHILL, 16), BRAKE, 5);
    expect(Math.abs(Math.abs(angleDiff(stopped.heading, DOWNHILL)) - Math.PI / 2)).toBeLessThan(0.3);
    expect(speedOf(run(ramp(25), stopped, NONE, 5))).toBe(0);
  });

  it('turns the way the thumb leans, or the way the skis already point', () => {
    const right = run(ramp(15), moving(DOWNHILL, 15), { steer: 0.8, tuck: 0, brake: 1 }, 0.5);
    const left = run(ramp(15), moving(DOWNHILL, 15), { steer: -0.8, tuck: 0, brake: 1 }, 0.5);
    expect(slipAngle(right)).toBeLessThan(-1);
    expect(slipAngle(left)).toBeGreaterThan(1);
    const alreadyLeft = { ...moving(DOWNHILL, 15), heading: DOWNHILL + 0.3 };
    expect(slipAngle(run(ramp(15), alreadyLeft, BRAKE, 0.5))).toBeGreaterThan(1);
  });

  it('brakes more gently for a lighter touch', () => {
    const light = speedOf(run(FLAT, moving(0, 18), { steer: 0, tuck: 0, brake: 0.4 }, 1));
    const full = speedOf(run(FLAT, moving(0, 18), BRAKE, 1));
    expect(light).toBeGreaterThan(full + 2);
    expect(light).toBeLessThan(17);
  });
});

describe('simulation', () => {
  it('gives the same result whatever the frame rate', () => {
    const at = (fps: number) => {
      let s = skierAt(0, 0, DOWNHILL + 0.4);
      for (let i = 0; i < fps * 5; i++) s = advanceSki(s, steer(0.3), ramp(22), () => true, 1 / fps);
      return s;
    };
    const a = at(60);
    const b = at(20);
    expect(speedOf(b)).toBeCloseTo(speedOf(a), 1);
    expect(Math.hypot(b.x - a.x, b.z - a.z)).toBeLessThan(1);
  });
});

describe('the mountain bike', () => {
  const ride = (ground: SkiGround, start: SkiState, input: SkiInput, seconds: number, groomed = true, p: SkiParams = BIKE): SkiState => {
    let s = start;
    for (let t = 0; t < seconds; t += 1 / 60) s = advanceSki(s, input, ground, () => groomed, 1 / 60, p);
    return s;
  };

  it('rolls downhill by itself, but not as fast as skis slide', () => {
    const bike = speedOf(ride(ramp(15), skierAt(0, 0, DOWNHILL), NONE, 40));
    const skis = speedOf(run(ramp(15), skierAt(0, 0, DOWNHILL), NONE, 40));
    expect(bike).toBeGreaterThan(10);
    expect(bike).toBeLessThan(skis);
  });

  it('pedals to a brisk pace on the flat, faster than walking', () => {
    const v = speedOf(ride(FLAT, skierAt(0, 0, DOWNHILL), TUCK, 20));
    expect(v).toBeGreaterThan(8);
    expect(v).toBeLessThan(BIKE.poleMaxSpeed + 0.5);
  });

  it('pedals up a gentle hill, and stops rather than roll back on one too steep', () => {
    const gentle = ride(ramp(5), skierAt(0, 0, UPHILL), TUCK, 12);
    expect(gentle.z).toBeLessThan(-20);
    const steep = ride(ramp(30), moving(UPHILL, 6), NONE, 12);
    expect(speedOf(steep)).toBe(0);
    expect(steep.z).toBeLessThanOrEqual(0);
  });

  it('stops with the brake, sliding the back wheel round', () => {
    const start = moving(DOWNHILL, 14);
    const mid = ride(ramp(18), start, BRAKE, 0.6);
    expect(Math.abs(slipAngle(mid))).toBeGreaterThan(0.6);
    expect(speedOf(ride(ramp(18), start, BRAKE, 6))).toBe(0);
  });

  it('is slow off the trail, in the woods', () => {
    const on = speedOf(ride(ramp(15), skierAt(0, 0, DOWNHILL), NONE, 40));
    const off = speedOf(ride(ramp(15), skierAt(0, 0, DOWNHILL), NONE, 40, false));
    expect(off).toBeLessThan(on * 0.75);
  });
});

describe('spring skiing', () => {
  const springRun = (ground: SkiGround, start: SkiState, input: SkiInput, seconds: number, groomed: boolean): SkiState => {
    let s = start;
    for (let t = 0; t < seconds; t += 1 / 60) s = advanceSki(s, input, ground, () => groomed, 1 / 60, SPRING_SKI);
    return s;
  };

  it('runs nearly as fast as winter on the ribbons of snow', () => {
    const spring = speedOf(springRun(ramp(15), skierAt(0, 0, DOWNHILL), NONE, 40, true));
    const winter = speedOf(run(ramp(15), skierAt(0, 0, DOWNHILL), NONE, 40));
    expect(spring).toBeGreaterThan(winter * 0.9);
    expect(spring).toBeLessThanOrEqual(winter);
  });

  it('grinds to a crawl on bare ground, yet can always pole back to the snow', () => {
    const sliding = springRun(ramp(8), moving(DOWNHILL, 15), NONE, 12, false);
    expect(speedOf(sliding)).toBeLessThan(3);
    const poling = springRun(FLAT, skierAt(0, 0, DOWNHILL), TUCK, 10, false);
    expect(poling.z).toBeGreaterThan(3);
  });
});

describe('stickToSki', () => {
  it('steers with left and right alone', () => {
    expect(stickToSki(0.8, 0.1)).toEqual({ steer: 0.8, tuck: 0, brake: 0 });
    expect(stickToSki(-1, -0.2)).toEqual({ steer: -1, tuck: 0, brake: 0 });
  });

  it('tucks when pushed up and brakes when pulled down, past a dead zone', () => {
    expect(stickToSki(0, 1).tuck).toBeCloseTo(1);
    expect(stickToSki(0, 0.65).tuck).toBeCloseTo(0.5);
    expect(stickToSki(0, -1)).toEqual({ steer: 0, tuck: 0, brake: 1 });
  });
});

describe('skiing the real mountain', () => {
  const world = loadTestWorld();
  const ground = world.source;

  /** Ski a trail from top to bottom by steering at its centre line. Returns the time and speeds. */
  const descend = (name: string) => {
    const trail = world.trails.filter((t) => t.name === name && !t.area).sort((a, b) => b.pts.length - a.pts.length)[0];
    if (!trail) throw new Error(`no trail ${name}`);
    const pts = trail.pts;
    let s = skierAt(pts[0] as number, pts[1] as number, 0);
    s.heading = Math.atan2(-((pts[2] as number) - s.x), -((pts[3] as number) - s.z));
    let target = 2;
    let t = 0;
    let max = 0;
    let length = 0;
    let offTrail = 0;
    const dt = 1 / 60;
    while (target < pts.length && t < 600) {
      const tx = pts[target] as number;
      const tz = pts[target + 1] as number;
      if (Math.hypot(tx - s.x, tz - s.z) < 9) {
        target += 2;
        continue;
      }
      const want = Math.atan2(-(tx - s.x), -(tz - s.z));
      const turn = Math.max(-1, Math.min(1, -angleDiff(want, s.heading) * 2));
      // A real player poles when the trail flattens; so does this one.
      const next = advanceSki(s, { steer: turn, tuck: speedOf(s) < 3 ? 1 : 0, brake: 0 }, ground, world.onTrail, dt);
      length += Math.hypot(next.x - s.x, next.z - s.z);
      s = next;
      max = Math.max(max, speedOf(s));
      if (!world.onTrail(s.x, s.z)) offTrail += dt;
      t += dt;
    }
    return { finished: target >= pts.length, seconds: t, max, average: length / t, length, offTrail: offTrail / t };
  };

  it.each(['Sunway', 'Quicksilver', 'Ruby Run', 'Twister', 'Showcase', 'The Rumor', 'Lies'])(
    '%s can be skied top to bottom without leaving the trail much',
    (name) => {
      const r = descend(name);
      expect(r.finished, `${name} stalled after ${r.seconds.toFixed(0)} s`).toBe(true);
      expect(r.max).toBeLessThan(36);
      expect(r.average).toBeGreaterThan(5);
      expect(r.offTrail, `${name}: share of time off the groomed trail`).toBeLessThan(0.25);
    },
  );

  it('reaches a higher top speed on the expert runs than on the beginner runs', () => {
    // Top speed, not average: The Rumor is steep but short, so much of it is spent getting going.
    expect(descend('The Rumor').max).toBeGreaterThan(descend('Sunway').max + 1);
    expect(descend('Lies').max).toBeGreaterThan(descend('Ruby Run').max + 1);
  });

  // SKI_REPORT=1 npx vitest run src/player/skiPhysics.test.ts --reporter=verbose
  it.runIf(process.env.SKI_REPORT)('reports run lengths and times (for tuning)', () => {
    for (const name of ['Sunway', 'Quicksilver', 'Otter Slide', 'Ruby Run', 'Twister', 'Showcase', 'The Rumor', 'Lies']) {
      const r = descend(name);
      console.log(
        `${name.padEnd(12)} ${r.length.toFixed(0).padStart(4)} m  ${r.seconds.toFixed(0).padStart(3)} s  avg ${r.average.toFixed(1)}  ` +
          `max ${r.max.toFixed(1)} m/s (${(r.max * 2.237).toFixed(0)} mph)  off trail ${(r.offTrail * 100).toFixed(0)}%  ${r.finished ? '' : 'STALLED'}`,
      );
    }
  });
});
