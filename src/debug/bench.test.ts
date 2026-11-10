import { describe, expect, it } from 'vitest';
import { parseConfig } from '../config';
import { BENCH_STEPS, benchSearch, DEFAULT_BENCH_SECONDS, formatBench, type BenchResult } from './bench';
import { summarize } from './perf';

describe('benchmark steps', () => {
  it('compares the two renderers at the default load', () => {
    const only = (params: Record<string, string>) => BENCH_STEPS.some((s) => JSON.stringify(s.params) === JSON.stringify(params));
    expect(only({})).toBe(true);
    expect(only({ renderer: 'webgl' })).toBe(true);
  });

  it('brackets the default tree count from both sides', () => {
    const counts = BENCH_STEPS.map((s) => Number(s.params.trees ?? 100000));
    expect(Math.min(...counts)).toBeLessThan(100000);
    expect(Math.max(...counts)).toBeGreaterThan(100000);
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
      expect(cfg.trees).toBe(Number(step.params.trees ?? 100000));
      expect(cfg.shadows).toBe(step.params.shadows !== '0');
      expect(cfg.stride).toBe(Number(step.params.stride ?? 1));
      expect(cfg.viewDist).toBe(Number(step.params.view ?? 2600));
    });
    expect(parseConfig(benchSearch(0, 0.5)).benchSeconds).toBe(0.5);
    expect(() => benchSearch(BENCH_STEPS.length, 5)).toThrow();
  });
});

describe('formatBench', () => {
  it('writes one line per step with the numbers needed to compare them', () => {
    const result: BenchResult = {
      label: 'WebGPU, 10k trees',
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
    expect(lines[1]).toContain('1. WebGPU, 10k trees [WebGPU, 804x1300 @2x]');
    expect(lines[1]).toContain('cpu 3.0 ms');
    expect(lines[1]).toContain('17 ms 95%, 25 ms 5%');
    expect(lines[1]).toContain('39 calls, 108k tris, 9983 trees');
    expect(lines[2]).toBe('test phone');
  });
});
