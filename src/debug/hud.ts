import { DEFAULTS, withParams, type Config } from '../config';
import { DIFFICULTY_MARK, type Place, type Trail } from '../world/trails';
import { startBench } from './bench';
import { describeSummary, type FrameSummary } from './perf';

export interface HudStats {
  frame: FrameSummary;
  drawCalls: number;
  triangles: number;
  backend: string;
  pixelRatio: number;
  width: number;
  height: number;
  trees: number;
}

interface OptionGroup {
  title: string;
  param: string;
  /** The value in force, in the same form the URL uses. */
  current: (c: Config) => string;
  options: { label: string; value: string }[];
}

const OPTIONS: OptionGroup[] = [
  {
    title: 'Camera distance',
    param: 'zoom',
    current: (c) => String(c.zoom),
    options: [
      { label: 'Closer', value: '0.75' },
      { label: 'Normal', value: '1' },
      { label: 'Further', value: '1.3' },
      { label: 'Furthest', value: '1.6' },
    ],
  },
  {
    title: 'Renderer',
    param: 'renderer',
    current: (c) => c.renderer,
    options: [
      { label: 'WebGPU', value: 'webgpu' },
      { label: 'WebGL 2', value: 'webgl' },
    ],
  },
  {
    title: 'Trees',
    param: 'trees',
    current: (c) => String(c.trees),
    options: ['0', '10000', '20000', '40000', '80000'].map((v) => ({
      label: v === '0' ? 'None' : `${Number(v) / 1000}k`,
      value: v,
    })),
  },
  {
    title: 'Sharpness (pixel ratio limit)',
    param: 'dpr',
    current: (c) => String(c.dpr),
    options: ['1', '2', '3'].map((v) => ({ label: v, value: v })),
  },
  {
    title: 'Shadows',
    param: 'shadows',
    current: (c) => (c.shadows ? '1' : '0'),
    options: [
      { label: 'Off', value: '0' },
      { label: 'On', value: '1' },
    ],
  },
  {
    title: 'Terrain detail',
    param: 'stride',
    current: (c) => String(c.stride),
    options: [
      { label: 'High', value: '1' },
      { label: 'Medium', value: '2' },
      { label: 'Low', value: '4' },
    ],
  },
  {
    title: 'View distance',
    param: 'view',
    current: (c) => String(c.viewDist),
    options: [
      { label: '400 m', value: '400' },
      { label: '700 m', value: '700' },
      { label: 'Whole mountain', value: '1500' },
    ],
  },
];

/** Browser and whether the game is running from the Home Screen, for reports. */
export function deviceLabel(): string {
  const installed = (navigator as { standalone?: boolean }).standalone === true;
  // Safe-area insets, read from CSS, show whether the page reaches under the status bar.
  const probe = document.createElement('div');
  probe.style.cssText =
    'position:fixed;visibility:hidden;padding:env(safe-area-inset-top) 0 env(safe-area-inset-bottom) 0';
  document.body.appendChild(probe);
  const style = getComputedStyle(probe);
  const insets = `${parseFloat(style.paddingTop) || 0}/${parseFloat(style.paddingBottom) || 0}`;
  probe.remove();
  return (
    `${installed ? 'Home Screen app' : 'browser tab'}, screen ${screen.width}x${screen.height}, ` +
    `page ${window.innerWidth}x${window.innerHeight}, insets top/bottom ${insets} | ${navigator.userAgent}`
  );
}

/** On-screen readout and settings menu for testing on a phone. */
export class Hud {
  private readonly statsEl = document.getElementById('stats') as HTMLElement;
  private readonly whereEl = document.getElementById('where') as HTMLElement;
  private readonly menuEl = document.getElementById('menu') as HTMLElement;
  private lastStats: HudStats | null = null;
  private lastWhere = '';

  constructor(
    private readonly cfg: Config,
    places: Place[],
    onTeleport: (place: Place) => void,
    onFast: (on: boolean) => void,
    onSkis: (on: boolean) => void,
  ) {
    const root = document.getElementById('hud') as HTMLElement;
    root.hidden = !cfg.hud;
    const button = document.getElementById('menu-button') as HTMLButtonElement;
    button.addEventListener('click', () => {
      this.menuEl.hidden = !this.menuEl.hidden;
    });
    const toggle = (id: string, initial: boolean, onChange: (on: boolean) => void): void => {
      const el = document.getElementById(id) as HTMLButtonElement;
      el.setAttribute('aria-pressed', String(initial));
      el.addEventListener('click', () => {
        const on = el.getAttribute('aria-pressed') !== 'true';
        el.setAttribute('aria-pressed', String(on));
        onChange(on);
      });
    };
    toggle('fast-button', false, onFast);
    toggle('ski-button', cfg.ski, onSkis);
    this.buildMenu(places, onTeleport);
  }

  private buildMenu(places: Place[], onTeleport: (place: Place) => void): void {
    const add = <K extends keyof HTMLElementTagNameMap>(parent: HTMLElement, tag: K, text?: string) => {
      const el = document.createElement(tag);
      if (text !== undefined) el.textContent = text;
      parent.appendChild(el);
      return el;
    };

    const close = add(this.menuEl, 'button', 'Close');
    close.type = 'button';
    close.className = 'close';
    close.addEventListener('click', () => (this.menuEl.hidden = true));

    add(this.menuEl, 'h2', 'Go to');
    const go = add(this.menuEl, 'div');
    go.className = 'row';
    for (const place of places) {
      const b = add(go, 'button', place.name);
      b.type = 'button';
      b.addEventListener('click', () => {
        onTeleport(place);
        this.menuEl.hidden = true;
      });
    }

    for (const group of OPTIONS) {
      add(this.menuEl, 'h2', group.title);
      const row = add(this.menuEl, 'div');
      row.className = 'row';
      const current = group.current(this.cfg);
      const fallback = group.current(DEFAULTS);
      for (const opt of group.options) {
        const a = add(row, 'a', opt.label);
        // Choosing the default removes the option from the URL, so the address stays short.
        const value = opt.value === fallback ? null : opt.value;
        a.href = withParams(location.search, { [group.param]: value }) || location.pathname;
        if (opt.value === current) a.className = 'on';
      }
    }

    add(this.menuEl, 'h2', 'Report');
    const row = add(this.menuEl, 'div');
    row.className = 'row';
    const copy = add(row, 'button', 'Copy performance report');
    copy.type = 'button';
    copy.addEventListener('click', () => {
      void navigator.clipboard?.writeText(this.report()).then(
        () => (copy.textContent = 'Copied'),
        () => (copy.textContent = 'Could not copy'),
      );
    });
    const bench = add(row, 'button', 'Run benchmark (about 90 seconds)');
    bench.type = 'button';
    bench.addEventListener('click', () => startBench(this.cfg.benchSeconds));
    add(this.menuEl, 'p', 'Changing a setting reloads the page. The benchmark tries nine settings by itself; leave the phone alone until it shows the results.');
  }

  /** One line that can be pasted back into a Claude session. */
  report(): string {
    const s = this.lastStats;
    if (!s) return 'no frames yet';
    return (
      `${s.backend} ${s.width}x${s.height} @${s.pixelRatio}x | ${describeSummary(s.frame)} | ` +
      `${s.drawCalls} calls, ${(s.triangles / 1000).toFixed(0)}k tris | ` +
      `trees ${s.trees}, stride ${this.cfg.stride}, view ${this.cfg.viewDist}, shadows ${this.cfg.shadows ? 'on' : 'off'}, ` +
      `zoom ${this.cfg.zoom} | ` +
      `${this.lastWhere} | ${deviceLabel()}`
    );
  }

  setStats(s: HudStats): void {
    this.lastStats = s;
    this.statsEl.textContent =
      `${s.frame.fps.toFixed(0).padStart(3)} fps   ${s.backend}\n` +
      `p95 ${s.frame.p95Ms.toFixed(0)} ms  worst ${s.frame.worstMs.toFixed(0)} ms\n` +
      `cpu ${s.frame.cpuAvgMs.toFixed(1)} ms  ${s.drawCalls} calls  ${(s.triangles / 1000).toFixed(0)}k tris\n` +
      `${s.width}x${s.height} @${s.pixelRatio}x  ${(s.trees / 1000).toFixed(1)}k trees`;
  }

  /** @param mph speed to show, or null to leave it out (on foot). */
  setWhere(trail: Trail | null, elevationFt: number, mph: number | null): void {
    const ft = `${Math.round(elevationFt).toLocaleString('en-US')} ft`;
    const pace = mph === null ? '' : ` · ${Math.round(mph)} mph`;
    const text = (trail ? `${trail.name} · ${ft}` : ft) + pace;
    if (text === this.lastWhere) return;
    this.lastWhere = text;
    this.whereEl.replaceChildren();
    if (trail) {
      const mark = document.createElement('span');
      mark.className = `mark-${trail.difficulty}`;
      mark.textContent = `${DIFFICULTY_MARK[trail.difficulty]} `;
      this.whereEl.appendChild(mark);
    }
    this.whereEl.appendChild(document.createTextNode(text));
  }
}
