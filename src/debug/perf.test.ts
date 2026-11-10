import { describe, expect, it } from 'vitest';
import { bucketOf, describeBuckets, FrameStats, summarize } from './perf';

describe('bucketOf', () => {
  it('sorts frame times onto the 120 Hz refresh grid', () => {
    expect(bucketOf(8.3)).toBe('8');
    expect(bucketOf(16)).toBe('17');
    expect(bucketOf(17)).toBe('17');
    expect(bucketOf(25)).toBe('25');
    expect(bucketOf(26)).toBe('25');
    expect(bucketOf(33)).toBe('33');
    expect(bucketOf(43)).toBe('slower');
  });
});

describe('summarize', () => {
  it('describes a steady 60 fps run', () => {
    const s = summarize(Array(120).fill(1000 / 60), Array(120).fill(3));
    expect(s.fps).toBeCloseTo(60);
    expect(s.p95Ms).toBeCloseTo(16.67, 1);
    expect(s.buckets['17']).toBe(1);
    expect(s.cpuAvgMs).toBe(3);
  });

  it('shows late frames in the average, the tail and the buckets', () => {
    // 90 on-time frames, 9 one refresh late, 1 long hitch.
    const frames = [...Array(90).fill(16.7), ...Array(9).fill(25), 43];
    const s = summarize(frames, Array(100).fill(2));
    expect(s.fps).toBeLessThan(60);
    expect(s.fps).toBeGreaterThan(55);
    expect(s.p95Ms).toBe(25);
    expect(s.worstMs).toBe(43);
    expect(s.buckets['17']).toBeCloseTo(0.9);
    expect(s.buckets['25']).toBeCloseTo(0.09);
    expect(s.buckets.slower).toBeCloseTo(0.01);
  });

  it('copes with no frames', () => {
    const s = summarize([], []);
    expect(s.fps).toBe(0);
    expect(s.p95Ms).toBe(0);
    expect(describeBuckets(s.buckets)).toBe('');
  });
});

describe('describeBuckets', () => {
  it('lists only the buckets that have frames', () => {
    expect(describeBuckets({ '8': 0, '17': 0.94, '25': 0.05, '33': 0.01, slower: 0 })).toBe('17 ms 94%, 25 ms 5%, 33 ms 1%');
    expect(describeBuckets({ '8': 0, '17': 0.996, '25': 0, '33': 0, slower: 0.004 })).toBe('17 ms 100%, slower <1%');
  });
});

describe('FrameStats', () => {
  it('forgets frames older than its window', () => {
    const stats = new FrameStats(1000);
    stats.push(500, 400); // an old hitch
    for (let i = 0; i < 120; i++) stats.push(1000 / 60, 2);
    const s = stats.summary();
    expect(s.worstMs).toBeCloseTo(16.67, 1);
    expect(s.cpuAvgMs).toBe(2);
    expect(s.frames).toBeLessThanOrEqual(61);
  });
});
