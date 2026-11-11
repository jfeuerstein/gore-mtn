import { describe, expect, it } from 'vitest';
import { DEFAULTS, parseConfig } from '../config';
import { BENCH_STEPS, benchSearch, DEFAULT_BENCH_SECONDS, formatBench, type BenchResult } from './bench';
import { summarize } from './perf';

describe('benchmark steps', () => {
  it('compares the two renderers at the default load', () => {
    const only = (params: Record<string, string>) => BENCH_STEPS.some((s) => JSON.stringify(s.params) === JSON.stringify(params));
    expect(only({})).toBe(true);
    expect(only({ renderer: 'webgl' })).toBe(true);
  });

  it('brackets the default forest from both sides', () => {
    const counts = BENCH_STEPS.map((s) => Number(s.params.trees ?? DEFAULTS.trees));
    expect(Math.min(...counts)).toBeLessThan(DEFAULTS.trees);
    expect(Math.max(...counts)).toBeGreaterThan(DEFAULTS.trees);
  });

  it('measures the town and the lodge, with and without the other people, and one step that travels', () => {
    const at = (place: string, crowd: boolean) => BENCH_STEPS.some((s) => (s.params.at ?? 'saddle-lodge') === place && (s.params.crowd !== '0') === crowd && Object.keys(s.params).every((k) => k === 'at' || k === 'crowd'));
    expect(at('cafe', true) && at('cafe', false)).toBe(true);
    expect(at('saddle-lodge', true) && at('saddle-lodge', false)).toBe(true);
    expect(at('base-lodge', true)).toBe(true);
    expect(BENCH_STEPS.filter((s) => s.travel).length).toBe(1);
  });

  it('gives every step a distinct label', () => {
    expect(new Set(BENCH_STEPS.map((s) => s.label)).size).toBe(BENCH_STEPS.length);
  });

  it('builds a URL for each step that the game reads back correctly', () => {
    BENCH_STEPS.forEach((step, i) => {
      const cfg = parseConfig(benchSearch(i, DEFAULT_BENCH_SECONDS));
      expect(cfg.bench).toBe(i);
      expect(cfg.benchSeconds).toBe(DEFAULT_BENCH_SECONDS);
      expect(cfg.at).toBe(step.params.at ?? 'saddle-lodge');
      expect(cfg.renderer).toBe(step.params.renderer === 'webgl' ? 'webgl' : 'webgpu');
      expect(cfg.trees).toBe(Number(step.params.trees ?? DEFAULTS.trees));
      expect(cfg.shadows).toBe(step.params.shadows !== '0');
      expect(cfg.stride).toBe(Number(step.params.stride ?? 1));
      expect(cfg.viewDist).toBe(Number(step.params.view ?? DEFAULTS.viewDist));
      expect(cfg.crowd).toBe(step.params.crowd !== '0');
      // Pinned, so that a run in July can be set beside a run in January.
      expect(cfg.season).toBe(step.params.season ?? 'winter');
      expect(cfg.time).toBe(step.params.time ?? 'midday');
    });
    expect(parseConfig(benchSearch(0, 0.5)).benchSeconds).toBe(0.5);
    expect(() => benchSearch(BENCH_STEPS.length, 5)).toThrow();
  });
});

describe('formatBench', () => {
  it('writes one line per step with the numbers needed to compare them', () => {
    const result: BenchResult = {
      label: 'WebGPU, normal forest',
      backend: 'WebGPU',
      frame: summarize([...Array(95).fill(16.7), ...Array(5).fill(25)], Array(100).fill(3)),
      drawCalls: 39.4,
      triangles: 108200,
      trees: 9983,
      resolution: '804x1300 @2x',
    };
    const text = formatBench([result], 'test phone');
    const lines = text.split('\n');
    expect(lines).toHaveLength(3);
    expect(lines[1]).toContain('1. WebGPU, normal forest [WebGPU, 804x1300 @2x]');
    expect(lines[1]).toContain('cpu 3.0 ms');
    expect(lines[1]).toContain('17 ms 95%, 25 ms 5%');
    expect(lines[1]).toContain('39 calls, 108k tris, 9983 trees');
    expect(lines[2]).toBe('test phone');
  });
});
