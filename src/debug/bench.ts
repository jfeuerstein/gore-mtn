import { describeSummary, summarize, type FrameSummary } from './perf';

/**
 * One-tap benchmark. It reloads the game through a fixed list of settings, measures each for a
 * few seconds while the camera turns a full circle on the spot (or, for a step that travels,
 * while the player is carried down a trail), and ends with a single block of text to paste back
 * into a Claude session.
 *
 * Progress lives in sessionStorage so it survives the reloads; the step being run is in the URL
 * (`?bench=3`) like every other state.
 */
export interface BenchStep {
  label: string;
  /** URL options that differ from the baseline. */
  params: Record<string, string>;
  /** Keep the on-screen readout updating during the step. */
  hudLive?: boolean;
  /**
   * A trail to be carried down, by name, in place of turning on the spot: the ground and the
   * forest are built ahead and dropped behind all the way, which turning never asks for.
   */
  travel?: string;
  /** Measure for this many times as long as the other steps. */
  long?: number;
}

/** How fast a travelling step goes, in metres a second: as fast as anything in the game moves, so nothing the player does asks more. */
export const TRAVEL_SPEED = 30;

/**
 * The steps. The first few are at the Saddle Lodge, where the owner's earlier runs were made,
 * so they can be set beside those. The rest ask what has not been measured on the phone: the
 * lodge and the town with everything since built there, what the other people on the mountain
 * cost, a busy evening, another season's trees, and travelling.
 */
export const BENCH_STEPS: readonly BenchStep[] = [
  { label: 'Saddle Lodge', params: {} },
  { label: 'Saddle Lodge, WebGL 2', params: { renderer: 'webgl' } },
  { label: 'Saddle Lodge, nobody about', params: { crowd: '0' } },
  { label: 'Saddle Lodge, thin forest', params: { trees: '110000' } },
  { label: 'Saddle Lodge, thick forest', params: { trees: '330000' } },
  { label: 'Base Lodge', params: { at: 'base-lodge' } },
  { label: 'Main Street', params: { at: 'cafe' } },
  { label: 'Main Street, nobody about', params: { at: 'cafe', crowd: '0' } },
  { label: 'Main Street, no shadows', params: { at: 'cafe', shadows: '0' } },
  { label: 'Main Street at dusk, snowing', params: { at: 'cafe', time: 'dusk', weather: 'snow' } },
  { label: 'Base Lodge in fall', params: { at: 'base-lodge', season: 'fall' } },
  { label: 'Down Sunway at lift speed', params: {}, travel: 'Sunway', long: 3 },
  // What the park print costs: the same view as step 6, drawn as the game was before it.
  { label: 'Base Lodge, before the print', params: { at: 'base-lodge', look: 'plain', models: 'blocks' } },
];

const BENCH_BASELINE: Record<string, string> = {
  season: 'winter',
  time: 'midday',
  weather: 'clear',
  at: 'saddle-lodge',
  renderer: 'webgpu',
  trees: '220000',
  shadows: '1',
  stride: '1',
  dpr: '2',
  view: '6500',
  crowd: '1',
  look: 'poster',
  models: 'park',
};

export const DEFAULT_BENCH_SECONDS = 5;
const WARMUP_MS = 1500;
const WARMUP_FRAMES = 10;
const STORE_KEY = 'gore-bench';

export interface BenchResult {
  label: string;
  backend: string;
  frame: FrameSummary;
  drawCalls: number;
  triangles: number;
  trees: number;
  resolution: string;
}

interface Stored {
  /** Query string to go back to when the benchmark ends. */
  returnTo: string;
  results: BenchResult[];
}

/** Query string that runs one step. Every step starts from the same baseline, whatever the player had set. */
export function benchSearch(index: number, seconds: number): string {
  const step = BENCH_STEPS[index];
  if (!step) throw new Error(`no benchmark step ${index}`);
  // Every option a step can change is spelled out, so results stay comparable when the game's
  // defaults move.
  const q = new URLSearchParams({ ...BENCH_BASELINE, ...step.params, bench: String(index) });
  if (seconds !== DEFAULT_BENCH_SECONDS) q.set('benchsecs', String(seconds));
  return `?${q.toString()}`;
}

export function formatBench(results: readonly BenchResult[], device: string): string {
  const lines = results.map(
    (r, i) =>
      `${i + 1}. ${r.label} [${r.backend}, ${r.resolution}]: ${describeSummary(r.frame)} | ` +
      `${Math.round(r.drawCalls)} calls, ${Math.round(r.triangles / 1000)}k tris, ${r.trees} trees`,
  );
  return [`Gore benchmark, ${results.length} of ${BENCH_STEPS.length} steps`, ...lines, device].join('\n');
}

function load(): Stored | null {
  try {
    const raw = sessionStorage.getItem(STORE_KEY);
    return raw ? (JSON.parse(raw) as Stored) : null;
  } catch {
    return null;
  }
}

function save(value: Stored): void {
  try {
    sessionStorage.setItem(STORE_KEY, JSON.stringify(value));
  } catch {
    // Private browsing can refuse storage; the benchmark then reports only its last step.
  }
}

export function loadBenchResults(): BenchResult[] {
  return load()?.results ?? [];
}

/** Begin the benchmark from the current page. */
export function startBench(seconds = DEFAULT_BENCH_SECONDS): void {
  const q = new URLSearchParams(location.search);
  q.delete('bench');
  q.delete('benchsecs');
  save({ returnTo: q.toString(), results: [] });
  location.assign(benchSearch(0, seconds));
}

/** Runs one step: turns the camera, collects frame times, stores the result and moves on. */
export class BenchRun {
  readonly step: BenchStep;
  private startedAt = -1;
  private measureFrom = -1;
  private seen = 0;
  private finished = false;
  private readonly frameMs: number[] = [];
  private readonly cpuMs: number[] = [];
  private drawCalls = 0;
  private triangles = 0;
  /** Seconds this step is measured for. */
  private readonly seconds: number;

  constructor(
    private readonly index: number,
    private readonly stepSeconds: number,
    private readonly baseYaw: number,
    private readonly env: { backend: string; trees: () => number; resolution: () => string },
  ) {
    const step = BENCH_STEPS[index];
    if (!step) throw new Error(`no benchmark step ${index}`);
    this.step = step;
    this.seconds = stepSeconds * (step.long ?? 1);
    const banner = document.createElement('div');
    banner.id = 'bench-banner';
    banner.textContent = `Benchmark ${index + 1} of ${BENCH_STEPS.length}: ${step.label}. Hands off the screen.`;
    (document.getElementById('app') ?? document.body).appendChild(banner);
  }

  get hudLive(): boolean {
    return this.step.hudLive === true;
  }

  /** Camera yaw for this moment: one full turn over the measured period. */
  yawAt(now: number): number {
    if (this.startedAt < 0) return this.baseYaw;
    return this.baseYaw + ((now - this.startedAt) / (this.seconds * 1000)) * Math.PI * 2;
  }

  /** For a step that travels: how far down its trail the player has been carried by this moment, in metres. */
  travelled(now: number): number {
    return this.startedAt < 0 ? 0 : ((now - this.startedAt) / 1000) * TRAVEL_SPEED;
  }

  /** Call once per frame, after rendering. */
  frame(now: number, frameMs: number, cpuMs: number, drawCalls: number, triangles: number): void {
    if (this.finished) return;
    if (this.startedAt < 0) this.startedAt = now;
    this.seen++;
    if (this.measureFrom < 0) {
      // Let shader compilation and first-use costs pass before measuring.
      if (now - this.startedAt >= WARMUP_MS && this.seen > WARMUP_FRAMES) this.measureFrom = now;
      return;
    }
    this.frameMs.push(frameMs);
    this.cpuMs.push(cpuMs);
    this.drawCalls += drawCalls;
    this.triangles += triangles;
    if (now - this.measureFrom >= this.seconds * 1000 && this.frameMs.length >= 5) this.finish();
  }

  private finish(): void {
    this.finished = true;
    const n = this.frameMs.length;
    const stored = load() ?? { returnTo: '', results: [] };
    stored.results[this.index] = {
      label: this.step.label,
      backend: this.env.backend,
      frame: summarize(this.frameMs, this.cpuMs),
      drawCalls: this.drawCalls / n,
      triangles: this.triangles / n,
      trees: this.env.trees(),
      resolution: this.env.resolution(),
    };
    save(stored);
    const next = this.index + 1;
    if (next < BENCH_STEPS.length) {
      location.replace(benchSearch(next, this.stepSeconds));
      return;
    }
    const q = new URLSearchParams(stored.returnTo);
    q.set('bench', 'done');
    location.replace(`?${q.toString()}`);
  }
}

/** Show the finished benchmark as a bottom sheet with a copy button. */
export function showBenchResults(device: string): void {
  const results = loadBenchResults().filter(Boolean);
  const text = results.length > 0 ? formatBench(results, device) : 'No benchmark results were saved.';
  const sheet = document.createElement('div');
  sheet.id = 'bench-results';
  const title = document.createElement('h2');
  title.textContent = 'Benchmark finished';
  const body = document.createElement('pre');
  body.textContent = text;
  const row = document.createElement('div');
  row.className = 'row';
  const copy = document.createElement('button');
  copy.type = 'button';
  copy.textContent = 'Copy results';
  copy.addEventListener('click', () => {
    void navigator.clipboard?.writeText(text).then(
      () => (copy.textContent = 'Copied'),
      () => (copy.textContent = 'Could not copy; select the text above'),
    );
  });
  const close = document.createElement('button');
  close.type = 'button';
  close.textContent = 'Close';
  close.addEventListener('click', () => {
    sheet.remove();
    const q = new URLSearchParams(location.search);
    q.delete('bench');
    const s = q.toString();
    history.replaceState(null, '', s ? `?${s}` : location.pathname);
  });
  row.append(copy, close);
  // Buttons come before the text so they are on screen without scrolling.
  sheet.append(title, row, body);
  (document.getElementById('app') ?? document.body).appendChild(sheet);
}
