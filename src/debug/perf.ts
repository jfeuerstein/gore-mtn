/** Rolling frame-time statistics over the last couple of seconds. */
export class FrameStats {
  private readonly times: number[] = [];
  private readonly windowMs: number;
  private total = 0;

  constructor(windowMs = 2000) {
    this.windowMs = windowMs;
  }

  push(frameMs: number): void {
    this.times.push(frameMs);
    this.total += frameMs;
    while (this.times.length > 1 && this.total - (this.times[0] as number) >= this.windowMs) {
      this.total -= this.times.shift() as number;
    }
  }

  /** Average frames per second over the window. */
  get fps(): number {
    return this.total > 0 ? (this.times.length * 1000) / this.total : 0;
  }

  /** Longest single frame in the window, in milliseconds. */
  get worstMs(): number {
    let worst = 0;
    for (const t of this.times) if (t > worst) worst = t;
    return worst;
  }

  /** Frame time that 95% of frames in the window beat, in milliseconds. */
  get p95Ms(): number {
    if (this.times.length === 0) return 0;
    const sorted = [...this.times].sort((a, b) => a - b);
    return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95))] as number;
  }
}
