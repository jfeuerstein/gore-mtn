import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { angleDiff } from './cameraMath';
import { advanceSki, descentAlong, fallLineYaw, SKI, stepSki, stickToSki, type SkiGround, type SkiInput, type SkiState } from './skiPhysics';
import { buildWorld } from '../world/world';

const DEG = Math.PI / 180;
const NONE: SkiInput = { steer: 0, tuck: 0, brake: 0 };

/** A flat-sided slope that falls toward +z (south) at `deg` degrees. */
const ramp = (deg: number): SkiGround => {
  const m = Math.tan(deg * DEG);
  const len = Math.hypot(1, m);
  return { normalAt: () => [0, 1 / len, m / len] };
};
const DOWNHILL = Math.PI; // yaw that faces +z
const ACROSS = Math.PI / 2;
const UPHILL = 0;

const run = (ground: SkiGround, start: Partial<SkiState>, input: SkiInput, seconds: number, groomed = true): SkiState => {
  let s: SkiState = { x: 0, z: 0, heading: DOWNHILL, speed: 0, ...start };
  for (let t = 0; t < seconds; t += 1 / 60) s = advanceSki(s, input, ground, () => groomed, 1 / 60);
  return s;
};
const topSpeed = (deg: number, input = NONE, groomed = true) => run(ramp(deg), {}, input, 60, groomed).speed;

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

describe('stepSki', () => {
  it('starts sliding when pointed down a slope and moves the right way', () => {
    const s = run(ramp(25), {}, NONE, 3);
    expect(s.speed).toBeGreaterThan(3);
    expect(s.z).toBeGreaterThan(3);
    expect(s.x).toBeCloseTo(0);
  });

  it('settles at an unhurried top speed that rises with steepness', () => {
    const green = topSpeed(12);
    const blue = topSpeed(25);
    const black = topSpeed(38);
    expect(green).toBeGreaterThan(6);
    expect(green).toBeLessThan(10);
    expect(blue).toBeGreaterThan(10);
    expect(blue).toBeLessThan(14);
    expect(black).toBeGreaterThan(blue + 1.5);
    expect(black).toBeLessThan(18);
  });

  it('goes faster in a tuck', () => {
    expect(topSpeed(25, { steer: 0, tuck: 1, brake: 0 })).toBeGreaterThan(topSpeed(25) * 1.25);
  });

  it('is slower in ungroomed snow', () => {
    expect(topSpeed(25, NONE, false)).toBeLessThan(topSpeed(25) * 0.85);
  });

  it('stops within a few seconds under the snowplough, even on a blue', () => {
    const s = run(ramp(25), { speed: 12 }, { steer: 0, tuck: 0, brake: 1 }, 4);
    expect(s.speed).toBe(0);
  });

  it('holds still across the slope, facing uphill, and on a barely tilted flat', () => {
    expect(run(ramp(25), { heading: ACROSS }, NONE, 5).speed).toBe(0);
    expect(run(ramp(25), { heading: UPHILL }, NONE, 5).speed).toBe(0);
    expect(run(ramp(3), {}, NONE, 5).speed).toBe(0);
  });

  it('never slides backwards when momentum runs out going uphill', () => {
    const s = run(ramp(15), { heading: UPHILL, speed: 8 }, NONE, 20);
    expect(s.speed).toBe(0);
    expect(s.z).toBeLessThan(0); // it coasted uphill and stayed there
  });

  it('turns right for a positive steer and loses speed doing it', () => {
    const start: SkiState = { x: 0, z: 0, heading: DOWNHILL, speed: 10 };
    const right = stepSki(start, { steer: 1, tuck: 0, brake: 0 }, ramp(0), true, 1 / 120);
    const straight = stepSki(start, NONE, ramp(0), true, 1 / 120);
    expect(right.heading).toBeLessThan(start.heading);
    expect(stepSki(start, { steer: -1, tuck: 0, brake: 0 }, ramp(0), true, 1 / 120).heading).toBeGreaterThan(start.heading);
    expect(right.speed).toBeLessThan(straight.speed);
  });

  it('turns more tightly at low speed than at high speed', () => {
    const turned = (speed: number) => Math.abs(stepSki({ x: 0, z: 0, heading: 0, speed }, { steer: 1, tuck: 0, brake: 0 }, ramp(0), true, 0.01).heading);
    expect(turned(2)).toBeGreaterThan(turned(15) * 1.5);
  });

  it('can turn on the spot at a standstill', () => {
    expect(run(ramp(0), { heading: 0 }, { steer: 1, tuck: 0, brake: 0 }, 1).heading).toBeLessThan(-2);
  });

  it('lets the skier pole across the flat but not race on it', () => {
    const poling = run(ramp(0), {}, { steer: 0, tuck: 1, brake: 0 }, 20);
    expect(poling.speed).toBeGreaterThan(2);
    expect(poling.speed).toBeLessThan(SKI.poleMaxSpeed);
    expect(run(ramp(0), { speed: 6 }, NONE, 30).speed).toBe(0); // gliding alone comes to rest
  });

  it('gives the same result whatever the frame rate', () => {
    const at = (fps: number) => {
      let s: SkiState = { x: 0, z: 0, heading: DOWNHILL + 0.4, speed: 0 };
      const input = { steer: 0.3, tuck: 0, brake: 0 };
      for (let i = 0; i < fps * 5; i++) s = advanceSki(s, input, ramp(22), () => true, 1 / fps);
      return s;
    };
    const a = at(60);
    const b = at(20);
    expect(b.speed).toBeCloseTo(a.speed, 1);
    expect(Math.hypot(b.x - a.x, b.z - a.z)).toBeLessThan(0.5);
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
  const read = (name: string) => readFileSync(new URL(`../../public/world/${name}`, import.meta.url));
  const buf = (b: Buffer): ArrayBuffer => b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer;
  const world = buildWorld(JSON.parse(read('world.json').toString()), buf(read('height.bin')), buf(read('trailmask.bin')));
  const ground = world.source.decimate(2);

  /** Ski a trail from top to bottom by steering at its centre line. Returns the time and speeds. */
  const descend = (name: string) => {
    const trail = world.trails.filter((t) => t.name === name && !t.area).sort((a, b) => b.pts.length - a.pts.length)[0];
    if (!trail) throw new Error(`no trail ${name}`);
    const pts = trail.pts;
    let s: SkiState = { x: pts[0] as number, z: pts[1] as number, heading: 0, speed: 0 };
    s.heading = Math.atan2(-((pts[2] as number) - s.x), -((pts[3] as number) - s.z));
    let target = 2;
    let t = 0;
    let max = 0;
    let length = 0;
    const dt = 1 / 60;
    while (target < pts.length && t < 600) {
      const tx = pts[target] as number;
      const tz = pts[target + 1] as number;
      if (Math.hypot(tx - s.x, tz - s.z) < 6) {
        target += 2;
        continue;
      }
      const want = Math.atan2(-(tx - s.x), -(tz - s.z));
      const steer = Math.max(-1, Math.min(1, -angleDiff(want, s.heading) * 2));
      // A real player poles when the trail flattens; so does this one.
      const next = advanceSki(s, { steer, tuck: s.speed < 2 ? 1 : 0, brake: 0 }, ground, world.onTrail, dt);
      length += Math.hypot(next.x - s.x, next.z - s.z);
      s = next;
      max = Math.max(max, s.speed);
      t += dt;
    }
    return { finished: target >= pts.length, seconds: t, max, average: length / t, length };
  };

  it.each(['Sunway', 'Quicksilver', 'Otter Slide', 'Ruby Run', 'Twister', 'The Rumor', 'Lies'])(
    '%s can be skied top to bottom at a relaxed pace',
    (name) => {
      const r = descend(name);
      expect(r.finished, `${name} stalled after ${r.seconds.toFixed(0)} s`).toBe(true);
      expect(r.max).toBeLessThan(20);
      expect(r.average).toBeGreaterThan(3);
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
      console.log(`${name.padEnd(12)} ${r.length.toFixed(0).padStart(4)} m  ${r.seconds.toFixed(0).padStart(3)} s  avg ${r.average.toFixed(1)}  max ${r.max.toFixed(1)} m/s  ${r.finished ? '' : 'STALLED'}`);
    }
  });
});
