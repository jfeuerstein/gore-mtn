import { describe, expect, it } from 'vitest';
import { dayEvents, namedTime, skyDirection, sunPosition, TIMES } from './sun';

const DEG = 180 / Math.PI;
const elevationAt = (iso: string) => sunPosition(new Date(iso)).elevation * DEG;

describe('sunPosition at Gore', () => {
  it('stands about 46 degrees high at noon on the equinox', () => {
    // Solar noon at 74 W is close to 17:03 UTC in late March.
    expect(elevationAt('2026-03-20T17:03:00Z')).toBeGreaterThan(45);
    expect(elevationAt('2026-03-20T17:03:00Z')).toBeLessThan(47.5);
  });

  it('is low at noon in midwinter and high in midsummer', () => {
    expect(elevationAt('2026-12-21T16:54:00Z')).toBeGreaterThan(21.5);
    expect(elevationAt('2026-12-21T16:54:00Z')).toBeLessThan(24);
    expect(elevationAt('2026-06-21T16:58:00Z')).toBeGreaterThan(68.5);
    expect(elevationAt('2026-06-21T16:58:00Z')).toBeLessThan(71);
  });

  it('is below the horizon at midnight', () => {
    expect(elevationAt('2026-01-15T05:00:00Z')).toBeLessThan(-40);
  });

  it('is in the east in the morning, the south at noon and the west in the evening', () => {
    const az = (iso: string) => sunPosition(new Date(iso)).azimuth * DEG;
    expect(az('2026-01-15T13:30:00Z')).toBeGreaterThan(110); // 8:30 am, south-east
    expect(az('2026-01-15T13:30:00Z')).toBeLessThan(140);
    expect(az('2026-01-15T17:05:00Z')).toBeGreaterThan(175); // solar noon, due south
    expect(az('2026-01-15T17:05:00Z')).toBeLessThan(185);
    expect(az('2026-01-15T20:30:00Z')).toBeGreaterThan(220); // 3:30 pm, south-west
    expect(az('2026-01-15T20:30:00Z')).toBeLessThan(245);
  });
});

describe('skyDirection', () => {
  it('uses the game axes: x east, y up, z south', () => {
    const east = skyDirection(0, Math.PI / 2);
    expect(east[0]).toBeCloseTo(1);
    expect(east[2]).toBeCloseTo(0);
    const south = skyDirection(0, Math.PI);
    expect(south[2]).toBeCloseTo(1);
    expect(skyDirection(Math.PI / 2, 0)[1]).toBeCloseTo(1);
  });
});

describe('dayEvents', () => {
  const day = dayEvents(new Date('2026-01-15T18:00:00Z'));
  const hoursUtc = (d: Date) => d.getUTCHours() + d.getUTCMinutes() / 60;

  it('finds a mid-January sunrise near 7:25 am and sunset near 4:45 pm Eastern', () => {
    expect(hoursUtc(day.sunrise)).toBeGreaterThan(12.2);
    expect(hoursUtc(day.sunrise)).toBeLessThan(12.6);
    expect(hoursUtc(day.sunset)).toBeGreaterThan(21.5);
    expect(hoursUtc(day.sunset)).toBeLessThan(21.9);
  });

  it('puts noon between them, with the sun at its highest', () => {
    expect(day.noon.getTime()).toBeGreaterThan(day.sunrise.getTime());
    expect(day.noon.getTime()).toBeLessThan(day.sunset.getTime());
    const peak = sunPosition(day.noon).elevation;
    expect(peak).toBeGreaterThan(sunPosition(new Date(day.noon.getTime() - 3600000)).elevation);
    expect(peak).toBeGreaterThan(sunPosition(new Date(day.noon.getTime() + 3600000)).elevation);
  });
});

describe('namedTime', () => {
  const today = new Date('2026-11-10T20:00:00Z');
  const el = (name: (typeof TIMES)[number]) => sunPosition(namedTime(name, today)).elevation * DEG;

  it('gives a low sun at dawn and in the evening, a high one at midday', () => {
    expect(el('dawn')).toBeGreaterThan(2);
    expect(el('dawn')).toBeLessThan(9);
    expect(el('evening')).toBeGreaterThan(2);
    expect(el('evening')).toBeLessThan(10);
    expect(el('midday')).toBeGreaterThan(25);
  });

  it('puts the sun just under the horizon at dusk and well under at night', () => {
    expect(el('dusk')).toBeLessThan(-1.5);
    expect(el('dusk')).toBeGreaterThan(-7);
    expect(el('night')).toBeLessThan(-30);
  });

  it('lights the mountain from the east at dawn and the west in the evening', () => {
    expect(skyDirection(0, sunPosition(namedTime('dawn', today)).azimuth)[0]).toBeGreaterThan(0.5);
    expect(skyDirection(0, sunPosition(namedTime('evening', today)).azimuth)[0]).toBeLessThan(-0.5);
  });
});
