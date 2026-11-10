import { describe, expect, it } from 'vitest';
import { BODY, hipHeight, mixPose, SEATED, skiPose, STANDING, walkPose } from './pose';

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

describe('mixPose', () => {
  it('blends every joint', () => {
    const half = mixPose(STANDING, SEATED, 0.5);
    expect(half.hipL).toBeCloseTo((STANDING.hipL + SEATED.hipL) / 2);
    expect(half.elbow).toBeCloseTo((STANDING.elbow + SEATED.elbow) / 2);
    expect(mixPose(STANDING, SEATED, 0)).toEqual(STANDING);
    expect(mixPose(STANDING, SEATED, 1)).toEqual(SEATED);
  });
});
