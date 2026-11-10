import { describe, expect, it } from 'vitest';
import { easeWeather, inventedWeather, NAMED_WEATHER, weatherFromForecast } from './weather';

describe('weatherFromForecast', () => {
  const reply = (current: Record<string, unknown>) => ({ current });

  it('reads a clear day', () => {
    expect(weatherFromForecast(reply({ cloud_cover: 10, snowfall: 0, precipitation: 0 }))).toEqual({ overcast: 0, snowing: 0 });
  });

  it('treats a broken sky as clear and a grey one as overcast', () => {
    expect(weatherFromForecast(reply({ cloud_cover: 40, snowfall: 0 }))?.overcast).toBe(0);
    expect(weatherFromForecast(reply({ cloud_cover: 65, snowfall: 0 }))?.overcast).toBeCloseTo(0.5);
    expect(weatherFromForecast(reply({ cloud_cover: 100, snowfall: 0 }))).toEqual({ overcast: 1, snowing: 0 });
  });

  it('snows lightly for flurries and fully for a proper fall', () => {
    const flurries = weatherFromForecast(reply({ cloud_cover: 90, snowfall: 0.1 }));
    const heavy = weatherFromForecast(reply({ cloud_cover: 100, snowfall: 1.5 }));
    expect(flurries?.snowing).toBeGreaterThan(0.3);
    expect(flurries?.snowing).toBeLessThan(0.6);
    expect(heavy?.snowing).toBe(1);
    expect(heavy?.overcast).toBe(1);
  });

  it('counts rain as snow, and snow brings its own cloud', () => {
    const w = weatherFromForecast(reply({ cloud_cover: 20, snowfall: 0, precipitation: 2 }));
    expect(w?.snowing).toBe(1);
    expect(w?.overcast).toBe(1);
  });

  it('gives up on a reply it cannot read', () => {
    expect(weatherFromForecast(null)).toBeNull();
    expect(weatherFromForecast({})).toBeNull();
    expect(weatherFromForecast({ current: { temperature_2m: -4 } })).toBeNull();
    expect(weatherFromForecast('service busy')).toBeNull();
  });
});

describe('inventedWeather', () => {
  it('is the same every time for the same moment', () => {
    const when = new Date('2026-11-10T15:00:00Z');
    expect(inventedWeather(when)).toEqual(inventedWeather(new Date(when.getTime())));
  });

  it('gives a fair mix of clear, cloudy and snowy spells over a season', () => {
    let clear = 0;
    let snow = 0;
    const N = 600;
    for (let i = 0; i < N; i++) {
      const w = inventedWeather(new Date(Date.UTC(2026, 10, 1) + i * 4 * 3600000 + 3600000));
      if (w.overcast === 0) clear++;
      if (w.snowing === 1) snow++;
    }
    expect(clear / N).toBeGreaterThan(0.38);
    expect(clear / N).toBeLessThan(0.62);
    expect(snow / N).toBeGreaterThan(0.15);
    expect(snow / N).toBeLessThan(0.35);
  });

  it('drifts from one spell to the next without a jump', () => {
    const start = Date.UTC(2026, 10, 1);
    for (let m = 0; m < 14 * 24 * 60; m += 5) {
      const a = inventedWeather(new Date(start + m * 60000));
      const b = inventedWeather(new Date(start + (m + 5) * 60000));
      expect(Math.abs(a.overcast - b.overcast)).toBeLessThan(0.2);
      expect(Math.abs(a.snowing - b.snowing)).toBeLessThan(0.2);
    }
  });
});

describe('easeWeather', () => {
  it('moves steadily toward the target and stops there', () => {
    let w = NAMED_WEATHER.clear;
    w = easeWeather(w, NAMED_WEATHER.snow, 1, 0.1);
    expect(w.snowing).toBeCloseTo(0.1);
    for (let i = 0; i < 20; i++) w = easeWeather(w, NAMED_WEATHER.snow, 1, 0.1);
    expect(w).toEqual(NAMED_WEATHER.snow);
  });
});
