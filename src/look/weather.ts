import { GORE } from './sun';
import type { Weather } from './palette';

/**
 * The weather over Gore. The real weather when it can be had, and otherwise an invented one that
 * changes through the day the way mountain weather does. No three.js here.
 */

const clamp01 = (v: number): number => (v < 0 ? 0 : v > 1 ? 1 : v);

/** The settled kinds of weather that can be chosen in place of the real one. */
export const WEATHERS = ['clear', 'cloudy', 'snow', 'fog'] as const;
export type WeatherName = (typeof WEATHERS)[number];

export const NAMED_WEATHER: Record<WeatherName, Weather> = {
  clear: { overcast: 0, snowing: 0 },
  cloudy: { overcast: 1, snowing: 0 },
  snow: { overcast: 1, snowing: 1 },
  // Cloud lying in the valleys under a clear sky: from the summits, a sea of it.
  fog: { overcast: 0.1, snowing: 0, low: 1 },
};

/**
 * Read the current conditions out of an Open-Meteo forecast reply.
 * Any precipitation counts as snow: on the game's mountain it is always cold enough.
 * @returns null if the reply does not have what is needed
 */
export function weatherFromForecast(reply: unknown): Weather | null {
  const current = (reply as { current?: Record<string, unknown> } | null)?.current;
  if (!current || typeof current.cloud_cover !== 'number') return null;
  const falling = Math.max(
    typeof current.snowfall === 'number' ? current.snowfall : 0,
    typeof current.precipitation === 'number' ? current.precipitation : 0,
  );
  // Light flurries are about 0.1 (cm or mm an hour); 1 or more is properly snowing.
  const snowing = falling > 0 ? clamp01(0.35 + falling * 0.65) : 0;
  // A broken sky still reads as a clear day; only a mostly grey one flattens the light.
  const overcast = clamp01((current.cloud_cover - 40) / 50);
  // Fog (the service's codes 45 and 48), or a sky whose cloud is nearly all low cloud, lies in the valleys: the summits may stand clear of it.
  const lowCover = typeof current.cloud_cover_low === 'number' ? current.cloud_cover_low : 0;
  const upper = Math.max(typeof current.cloud_cover_mid === 'number' ? current.cloud_cover_mid : 0, typeof current.cloud_cover_high === 'number' ? current.cloud_cover_high : 0);
  const low = snowing === 0 && (current.weather_code === 45 || current.weather_code === 48 || (lowCover >= 80 && upper <= 30)) ? 1 : 0;
  return low > 0 ? { overcast: Math.max(overcast, snowing), snowing, low } : { overcast: Math.max(overcast, snowing), snowing };
}

/** A repeatable number in 0..1 for a whole number. */
function noise(n: number): number {
  let t = (n * 0x9e3779b1) >>> 0;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

/**
 * Invented weather for a moment in time, used when the real weather cannot be fetched.
 * It holds for a few hours and drifts from one spell to the next: clear about half the time,
 * cloudy a quarter, snowing a quarter. The same moment always gives the same weather.
 */
export function inventedWeather(when: Date): Weather {
  const SPELL_MS = 4 * 3600000;
  const spell = when.getTime() / SPELL_MS;
  const at = (n: number): Weather => {
    const roll = noise(n);
    if (roll < 0.5) return NAMED_WEATHER.clear;
    if (roll < 0.75) return NAMED_WEATHER.cloudy;
    return NAMED_WEATHER.snow;
  };
  const a = at(Math.floor(spell));
  const b = at(Math.floor(spell) + 1);
  // Hold steady for most of a spell, then ease into the next over its last quarter.
  const t = clamp01((spell - Math.floor(spell) - 0.75) / 0.25);
  const k = t * t * (3 - 2 * t);
  return { overcast: a.overcast + (b.overcast - a.overcast) * k, snowing: a.snowing + (b.snowing - a.snowing) * k };
}

/** Move the weather a step toward a target, so a change of weather rolls in rather than snapping. */
export function easeWeather(now: Weather, target: Weather, dt: number, perSecond = 0.12): Weather {
  const step = (a: number, b: number): number => a + Math.max(-perSecond * dt, Math.min(perSecond * dt, b - a));
  const low = step(now.low ?? 0, target.low ?? 0);
  return { overcast: step(now.overcast, target.overcast), snowing: step(now.snowing, target.snowing), ...(low > 0 ? { low } : {}) };
}

export const FORECAST_URL =
  `https://api.open-meteo.com/v1/forecast?latitude=${GORE.latitude}&longitude=${GORE.longitude}` +
  '&current=cloud_cover,cloud_cover_low,cloud_cover_mid,cloud_cover_high,snowfall,precipitation,weather_code,temperature_2m';

/**
 * The real weather at Gore right now, or null if it cannot be had (offline, or the service is
 * busy). The request names only the mountain; nothing about the player goes with it.
 */
export async function fetchWeather(timeoutMs = 5000): Promise<Weather | null> {
  const abort = new AbortController();
  const timer = setTimeout(() => abort.abort(), timeoutMs);
  try {
    const res = await fetch(FORECAST_URL, { signal: abort.signal });
    if (!res.ok) return null;
    return weatherFromForecast(await res.json());
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
