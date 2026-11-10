/**
 * Frame timing. No DOM or three.js here, so it runs under Vitest.
 *
 * Two numbers matter per frame. `frameMs` is the time from one frame to the next: what the player
 * sees. `cpuMs` is the time our own code spent producing the frame (game logic plus handing the
 * scene to the renderer). When frames are late but `cpuMs` is small, the delay is in the browser
 * or the GPU, not in the game's code.
 */

/**
 * Frame times fall on the display's refresh grid. An iPhone Pro refreshes every 8.3 ms and Safari
 * normally draws every second refresh (16.7 ms, 60 fps). A late frame lands one or more refreshes
 * later: 25 ms, 33 ms, and so on.
 */
export const BUCKETS = ['8', '17', '25', '33', 'slower'] as const;
export type Bucket = (typeof BUCKETS)[number];

export function bucketOf(frameMs: number): Bucket {
  if (frameMs < 12.5) return '8';
  if (frameMs < 21) return '17';
  if (frameMs < 29.5) return '25';
  if (frameMs < 38) return '33';
  return 'slower';
}

export interface FrameSummary {
  frames: number;
  fps: number;
  /** Frame time that 95% of frames beat. */
  p95Ms: number;
  worstMs: number;
  cpuAvgMs: number;
  cpuP95Ms: number;
  /** Share of frames in each bucket, 0..1. */
  buckets: Record<Bucket, number>;
}

function percentile(values: readonly number[], p: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))] as number;
}

export function summarize(frameMs: readonly number[], cpuMs: readonly number[]): FrameSummary {
  const buckets: Record<Bucket, number> = { '8': 0, '17': 0, '25': 0, '33': 0, slower: 0 };
  let total = 0;
  let worst = 0;
  for (const t of frameMs) {
    total += t;
    if (t > worst) worst = t;
    buckets[bucketOf(t)] += 1;
  }
  const n = frameMs.length;
  if (n > 0) for (const b of BUCKETS) buckets[b] /= n;
  const cpuTotal = cpuMs.reduce((sum, t) => sum + t, 0);
  return {
    frames: n,
    fps: total > 0 ? (n * 1000) / total : 0,
    p95Ms: percentile(frameMs, 0.95),
    worstMs: worst,
    cpuAvgMs: cpuMs.length > 0 ? cpuTotal / cpuMs.length : 0,
    cpuP95Ms: percentile(cpuMs, 0.95),
    buckets,
  };
}

/** For example "17 ms 94%, 25 ms 5%, 33 ms 1%". Buckets with no frames are left out. */
export function describeBuckets(buckets: Record<Bucket, number>): string {
  const parts: string[] = [];
  for (const b of BUCKETS) {
    const share = buckets[b];
    if (share <= 0) continue;
    const pct = share < 0.01 ? '<1' : String(Math.round(share * 100));
    parts.push(`${b === 'slower' ? 'slower' : `${b} ms`} ${pct}%`);
  }
  return parts.join(', ');
}

/** One line of numbers for a summary, shared by the readout report and the benchmark. */
export function describeSummary(s: FrameSummary): string {
  return (
    `${s.fps.toFixed(0)} fps, p95 ${s.p95Ms.toFixed(0)} ms, worst ${s.worstMs.toFixed(0)} ms, ` +
    `cpu ${s.cpuAvgMs.toFixed(1)} ms (p95 ${s.cpuP95Ms.toFixed(0)}) | ${describeBuckets(s.buckets)}`
  );
}

/** Rolling statistics over the last couple of seconds. */
export class FrameStats {
  private readonly frame: number[] = [];
  private readonly cpu: number[] = [];
  private total = 0;

  constructor(private readonly windowMs = 2000) {}

  push(frameMs: number, cpuMs: number): void {
    this.frame.push(frameMs);
    this.cpu.push(cpuMs);
    this.total += frameMs;
    while (this.frame.length > 1 && this.total - (this.frame[0] as number) >= this.windowMs) {
      this.total -= this.frame.shift() as number;
      this.cpu.shift();
    }
  }

  summary(): FrameSummary {
    return summarize(this.frame, this.cpu);
  }
}
