import { describe, expect, it } from 'vitest';
import { BODY, hipHeight, mixPose, PEDAL_LOW, planted, polePose, ridePose, SEATED, skiPose, STANDING, walkPose } from './pose';

const LEG = BODY.thigh + BODY.shin + BODY.boot;

describe('standing', () => {
  it('is nearly full height', () => {
    expect(hipHeight(STANDING)).toBeGreaterThan(LEG * 0.98);
  });
});

describe('walkPose', () => {
  it('swings the legs against each other and the arms against the legs', () => {
    for (const phase of [0.4, 1.3, 2.9, 4.4]) {
      const p = walkPose(phase, 1);
      expect(p.hipL).toBeCloseTo(-p.hipR);
      expect(Math.sign(p.shoulderL)).toBe(-Math.sign(p.hipL));
      expect(Math.sign(p.shoulderR)).toBe(-Math.sign(p.hipR));
    }
  });

  it('bends each knee in turn, never backwards', () => {
    let leftBent = false;
    let rightBent = false;
    for (let phase = 0; phase < Math.PI * 2; phase += 0.1) {
      const p = walkPose(phase, 1);
      expect(p.kneeL).toBeGreaterThanOrEqual(0);
      expect(p.kneeR).toBeGreaterThanOrEqual(0);
      if (p.kneeL > 0.8) leftBent = true;
      if (p.kneeR > 0.8) rightBent = true;
      expect(p.kneeL > 0.8 && p.kneeR > 0.8).toBe(false);
    }
    expect(leftBent && rightBent).toBe(true);
  });

  it('fades to standing as the walker slows to a stop', () => {
    const still = walkPose(1.2, 0);
    for (const key of Object.keys(STANDING) as (keyof typeof STANDING)[]) expect(still[key], key).toBeCloseTo(STANDING[key]);
    expect(Math.abs(walkPose(1.2, 0.5).hipL)).toBeLessThan(Math.abs(walkPose(1.2, 1).hipL));
  });

  it('keeps the hips near standing height through the stride', () => {
    for (let phase = 0; phase < Math.PI * 2; phase += 0.2) {
      expect(hipHeight(walkPose(phase, 1))).toBeGreaterThan(LEG * 0.86);
    }
  });
});

describe('skiPose', () => {
  it('keeps both feet under the hips in every stance', () => {
    for (const [tuck, brake] of [[0, 0], [0.5, 0], [1, 0], [0, 1]] as const) {
      const p = skiPose(tuck, brake);
      // Foot position ahead of the hip: thigh forward, shin back.
      const ahead = BODY.thigh * Math.sin(p.hipL) + BODY.shin * Math.sin(p.hipL - p.kneeL);
      expect(Math.abs(ahead)).toBeLessThan(0.02);
      expect(p.hipL).toBe(p.hipR);
    }
  });

  it('sits lower the deeper the tuck, with the body folded forward and the hands brought in', () => {
    const upright = skiPose(0, 0);
    const half = skiPose(0.5, 0);
    const tucked = skiPose(1, 0);
    expect(hipHeight(upright)).toBeLessThan(hipHeight(STANDING));
    expect(hipHeight(half)).toBeLessThan(hipHeight(upright));
    expect(hipHeight(tucked)).toBeLessThan(hipHeight(half));
    expect(hipHeight(tucked)).toBeGreaterThan(LEG * 0.55);
    expect(tucked.torso).toBeGreaterThan(upright.torso + 0.5);
    expect(tucked.armsOut).toBeLessThan(upright.armsOut);
    expect(tucked.poles).toBeLessThan(upright.poles); // poles swept further back
  });

  it('spreads the arms and sits a little lower in a hockey stop', () => {
    const stop = skiPose(0, 1);
    expect(stop.armsOut).toBeGreaterThan(skiPose(0, 0).armsOut + 0.3);
    expect(hipHeight(stop)).toBeLessThan(hipHeight(skiPose(0, 0)));
  });
});

describe('SEATED', () => {
  it('has level thighs and hanging shins, so the hips sit low', () => {
    expect(hipHeight(SEATED)).toBeLessThan(LEG * 0.65);
    expect(Math.abs(SEATED.hipL - SEATED.kneeL)).toBeLessThan(0.2); // shins near vertical
  });
});

describe('ridePose', () => {
  it('sits the rider at saddle height with both feet clear of the ground', () => {
    for (const phase of [0, 0.8, 1.6, 3.1, 4.7]) {
      const p = ridePose(phase, 1, 0, 0);
      // The lower foot is on a pedal at or above the bottom of its turn.
      expect(p.bob).toBeGreaterThanOrEqual(PEDAL_LOW);
      expect(hipHeight(p)).toBeGreaterThan(0.85);
      expect(hipHeight(p)).toBeLessThan(1.15);
      expect(p.kneeL).toBeGreaterThan(0);
      expect(p.kneeR).toBeGreaterThan(0);
    }
  });

  it('turns the legs against each other when pedalling and holds them level when coasting', () => {
    const pedalling = ridePose(Math.PI / 2, 1, 0, 0);
    expect(pedalling.hipL).toBeGreaterThan(pedalling.hipR);
    const coasting = ridePose(Math.PI / 2, 0, 0, 0);
    expect(coasting.hipL).toBeCloseTo(coasting.hipR);
    expect(coasting.kneeL).toBeCloseTo(coasting.kneeR);
  });

  it('drops the chest in a tuck and sits back to brake', () => {
    expect(ridePose(0, 0, 1, 0).torso).toBeGreaterThan(ridePose(0, 0, 0, 0).torso);
    expect(ridePose(0, 0, 0, 1).torso).toBeLessThan(ridePose(0, 0, 0, 0).torso);
  });
});

describe('mixPose', () => {
  it('blends every joint', () => {
    const half = mixPose(STANDING, SEATED, 0.5);
    expect(half.hipL).toBeCloseTo((STANDING.hipL + SEATED.hipL) / 2);
    expect(half.elbow).toBeCloseTo((STANDING.elbow + SEATED.elbow) / 2);
    expect(mixPose(STANDING, SEATED, 0)).toEqual(STANDING);
    expect(mixPose(STANDING, SEATED, 1)).toEqual(SEATED);
  });
});

describe('poling along the flat', () => {
  it('reaches forward, pushes through behind, and comes back to the reach', () => {
    const reach = polePose(0);
    const through = polePose(Math.PI);
    expect(reach.shoulderL).toBeGreaterThan(1.2);
    expect(through.shoulderL).toBeLessThan(-0.3);
    expect(reach.shoulderL).toBe(reach.shoulderR); // both poles together
    // Planted nearly upright; trailing at the end of the push.
    expect(reach.poles).toBeGreaterThan(-0.35);
    expect(through.poles).toBeLessThan(-1);
    const again = polePose(Math.PI * 2);
    for (const key of Object.keys(reach) as (keyof typeof reach)[]) expect(again[key], key).toBeCloseTo(reach[key]);
  });

  it('folds the body over the poles in the push, and stands up to swing them forward', () => {
    const push = polePose(Math.PI / 2);
    const swing = polePose((Math.PI * 3) / 2);
    expect(push.torso).toBeGreaterThan(swing.torso + 0.4);
    expect(hipHeight(push)).toBeLessThan(hipHeight(swing));
    for (let phase = 0; phase < 7; phase += 0.3) {
      const p = polePose(phase);
      expect(p.kneeL).toBeGreaterThanOrEqual(0);
      // The feet stay under the body: half the knee's bend at the hip.
      expect(p.hipL).toBeCloseTo(p.kneeL / 2);
    }
  });
});

describe('a pole planted for a turn', () => {
  it('swings one arm and its pole forward, and leaves the other alone', () => {
    const stance = skiPose(0, 0);
    const right = planted(stance, 1, 1);
    expect(right.shoulderR).toBeGreaterThan(stance.shoulderR + 0.3);
    expect(right.poles + right.plantR).toBeGreaterThan(0); // the tip ahead of the hand
    expect(right.shoulderL).toBe(stance.shoulderL);
    expect(right.plantL).toBe(0);
    const left = planted(stance, -1, 1);
    expect(left.shoulderL).toBeGreaterThan(stance.shoulderL + 0.3);
    expect(left.plantR).toBe(0);
    expect(planted(stance, 1, 0)).toEqual(stance);
  });
});

describe('standing on the pedals', () => {
  it('lifts the rider off the saddle with straighter legs, and not in a tuck', () => {
    const sat = ridePose(0, 0, 0, 0);
    const up = ridePose(0, 0, 0, 0, 1);
    expect(hipHeight(up)).toBeGreaterThan(hipHeight(sat) + 0.15);
    expect(up.kneeL).toBeLessThan(sat.kneeL - 0.5);
    expect(ridePose(0, 0, 0, 0, 0)).toEqual(sat);
    // Tucked right down there is no standing up.
    expect(hipHeight(ridePose(0, 0, 1, 0, 1))).toBeCloseTo(hipHeight(ridePose(0, 0, 1, 0)));
  });
});
