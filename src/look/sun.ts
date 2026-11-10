/**
 * Where the sun is in the sky over Gore Mountain at a moment in time. No DOM or three.js here.
 *
 * Accurate to about a degree, which is far more than the game needs: it decides the colour of the
 * light and which side of the mountain is in shade, not navigation.
 */

/** Gore Mountain's summit. */
export const GORE = { latitude: 43.673, longitude: -74.006 };

const RAD = Math.PI / 180;

export interface SunPosition {
  /** Angle above the horizon in radians; negative when the sun is down. */
  elevation: number;
  /** Compass bearing in radians, clockwise from north: east is PI/2, south is PI. */
  azimuth: number;
}

export function sunPosition(when: Date, place = GORE): SunPosition {
  // Days since the J2000 epoch, and the sun's ecliptic position on that day.
  const days = when.getTime() / 86400000 - 10957.5;
  const meanLongitude = (280.46 + 0.9856474 * days) * RAD;
  const meanAnomaly = (357.528 + 0.9856003 * days) * RAD;
  const ecliptic = meanLongitude + (1.915 * Math.sin(meanAnomaly) + 0.02 * Math.sin(2 * meanAnomaly)) * RAD;
  const tilt = (23.439 - 0.0000004 * days) * RAD;
  const rightAscension = Math.atan2(Math.cos(tilt) * Math.sin(ecliptic), Math.cos(ecliptic));
  const declination = Math.asin(Math.sin(tilt) * Math.sin(ecliptic));

  // How far the sun is past the local meridian.
  const greenwichSidereal = (280.46061837 + 360.98564736629 * days) * RAD;
  const hourAngle = greenwichSidereal + place.longitude * RAD - rightAscension;
  const lat = place.latitude * RAD;

  const elevation = Math.asin(Math.sin(lat) * Math.sin(declination) + Math.cos(lat) * Math.cos(declination) * Math.cos(hourAngle));
  const azimuth = Math.atan2(-Math.sin(hourAngle), Math.tan(declination) * Math.cos(lat) - Math.sin(lat) * Math.cos(hourAngle));
  return { elevation, azimuth: (azimuth + Math.PI * 2) % (Math.PI * 2) };
}

/** Unit vector toward a point in the sky, in the game's axes: x east, y up, z south. */
export function skyDirection(elevation: number, azimuth: number): [number, number, number] {
  const flat = Math.cos(elevation);
  return [Math.sin(azimuth) * flat, Math.sin(elevation), -Math.cos(azimuth) * flat];
}

export interface DayEvents {
  sunrise: Date;
  /** When the sun is highest. */
  noon: Date;
  sunset: Date;
}

/**
 * Sunrise, solar noon and sunset for the day at Gore that contains `when`. Found by stepping
 * through the day, which is plenty fast and has no special cases.
 */
export function dayEvents(when: Date, place = GORE): DayEvents {
  // Gore keeps Eastern time; standard time is close enough to find "today".
  const EASTERN_OFFSET_MS = 5 * 3600000;
  const dayStart = Math.floor((when.getTime() - EASTERN_OFFSET_MS) / 86400000) * 86400000 + EASTERN_OFFSET_MS;
  const STEP = 60000;
  let sunrise = dayStart;
  let sunset = dayStart;
  let noon = dayStart;
  let highest = -Infinity;
  let before = sunPosition(new Date(dayStart), place).elevation;
  for (let t = dayStart + STEP; t <= dayStart + 86400000; t += STEP) {
    const now = sunPosition(new Date(t), place).elevation;
    if (before < 0 && now >= 0) sunrise = t;
    if (before >= 0 && now < 0) sunset = t;
    if (now > highest) {
      highest = now;
      noon = t;
    }
    before = now;
  }
  return { sunrise: new Date(sunrise), noon: new Date(noon), sunset: new Date(sunset) };
}

/** Named moments of the day that can be chosen in place of the real time. */
export const TIMES = ['dawn', 'midday', 'evening', 'dusk', 'night'] as const;
export type TimeName = (typeof TIMES)[number];

/** The moment today that a name stands for. */
export function namedTime(name: TimeName, today: Date, place = GORE): Date {
  const { sunrise, noon, sunset } = dayEvents(today, place);
  const MINUTE = 60000;
  switch (name) {
    case 'dawn':
      return new Date(sunrise.getTime() + 35 * MINUTE);
    case 'midday':
      return noon;
    case 'evening':
      return new Date(sunset.getTime() - 40 * MINUTE);
    case 'dusk':
      return new Date(sunset.getTime() + 22 * MINUTE);
    case 'night':
      return new Date(sunset.getTime() + 5 * 60 * MINUTE);
  }
}
