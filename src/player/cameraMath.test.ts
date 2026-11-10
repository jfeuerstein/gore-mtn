import { describe, expect, it } from 'vitest';
import { angleDiff, followYaw, framingFor, verticalFovDeg } from './cameraMath';

const horizontalFov = (aspect: number) =>
  (2 * Math.atan(Math.tan((verticalFovDeg(aspect) * Math.PI) / 360) * aspect) * 180) / Math.PI;

describe('verticalFovDeg', () => {
  it('keeps a modest angle on wide screens', () => {
    expect(verticalFovDeg(16 / 9)).toBe(55);
    expect(verticalFovDeg(1)).toBe(55);
  });

  it('widens on an upright phone so the view is not a narrow slot', () => {
    const iphone = 402 / 874;
    expect(verticalFovDeg(iphone)).toBeGreaterThan(75);
    expect(horizontalFov(iphone)).toBeGreaterThan(41);
  });

  it('never exceeds the limit, however narrow the screen', () => {
    expect(verticalFovDeg(0.2)).toBe(80);
  });
});

describe('framingFor', () => {
  it('pulls back, aims higher and looks down more steeply on an upright phone', () => {
    const wide = framingFor(16 / 9);
    const tall = framingFor(402 / 874);
    expect(tall.distance).toBeGreaterThan(wide.distance);
    expect(tall.aimLift).toBeGreaterThan(wide.aimLift);
    expect(tall.pitch).toBeGreaterThan(wide.pitch);
  });

  it('places the player below the middle of an upright screen but above the thumb', () => {
    const f = framingFor(402 / 874);
    // How far below centre the player sits, as a fraction of half the screen height.
    const below = f.aimLift / Math.tan((f.fovDeg * Math.PI) / 360);
    // Between 55% and 65% of the way down the screen; the thumb rests below about 70%.
    expect(below).toBeGreaterThan(0.1);
    expect(below).toBeLessThan(0.3);
  });
});

describe('angleDiff', () => {
  it('takes the short way round', () => {
    expect(angleDiff(0.1, -0.1)).toBeCloseTo(0.2);
    expect(angleDiff(-3, 3)).toBeCloseTo(2 * Math.PI - 6);
  });
});

describe('followYaw', () => {
  it('turns toward the direction of travel', () => {
    const next = followYaw(0, 1, 1, 0.1);
    expect(next).toBeGreaterThan(0);
    expect(next).toBeLessThan(1);
  });

  it('settles behind the player over time without overshooting', () => {
    let yaw = 0;
    for (let i = 0; i < 600; i++) yaw = followYaw(yaw, 1.2, 1, 1 / 60);
    expect(yaw).toBeCloseTo(1.2, 2);
    expect(followYaw(0, 1, 1, 10)).toBeCloseTo(1);
  });

  it('does nothing when the player is standing still or walking toward the camera', () => {
    expect(followYaw(0.5, 1.5, 0, 0.1)).toBe(0.5);
    expect(followYaw(0, Math.PI, 1, 0.1)).toBe(0);
    expect(followYaw(0, -2.8, 1, 0.1)).toBe(0);
  });

  it('turns more gently for a gentle push', () => {
    expect(followYaw(0, 1, 0.3, 0.1)).toBeLessThan(followYaw(0, 1, 1, 0.1));
  });
});
