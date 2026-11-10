import { withParams, type Config } from '../config';
import { DIFFICULTY_MARK, type Place, type Trail } from '../world/trails';

export interface HudStats {
  fps: number;
  p95Ms: number;
  worstMs: number;
  drawCalls: number;
  triangles: number;
  backend: string;
  pixelRatio: number;
  width: number;
  height: number;
  trees: number;
}

interface Option {
  label: string;
  value: string | null;
}

const OPTIONS: { title: string; param: string; current: (c: Config) => string; options: Option[] }[] = [
  {
    title: 'Camera distance',
    param: 'zoom',
    current: (c) => String(c.zoom),
    options: [
      { label: 'Closer', value: '0.75' },
      { label: 'Default', value: null },
      { label: 'Further', value: '1.3' },
      { label: 'Furthest', value: '1.6' },
    ],
  },
  {
    title: 'Renderer',
    param: 'renderer',
    current: (c) => c.renderer,
    options: [
      { label: 'WebGPU', value: null },
      { label: 'WebGL 2', value: 'webgl' },
    ],
  },
  {
    title: 'Trees',
    param: 'trees',
    current: (c) => String(c.trees),
    options: ['0', '5000', '10000', '20000', '40000', '80000'].map((v) => ({
      label: v === '0' ? 'None' : `${Number(v) / 1000}k`,
      value: v === '10000' ? null : v,
    })),
  },
  {
    title: 'Sharpness (pixel ratio limit)',
    param: 'dpr',
    current: (c) => String(c.dpr),
    options: [
      { label: '1', value: '1' },
      { label: '2', value: null },
      { label: '3', value: '3' },
    ],
  },
  {
    title: 'Shadows',
    param: 'shadows',
    current: (c) => (c.shadows ? '1' : '0'),
    options: [
      { label: 'Off', value: null },
      { label: 'On', value: '1' },
    ],
  },
  {
    title: 'Terrain detail',
    param: 'stride',
    current: (c) => String(c.stride),
    options: [
      { label: 'High', value: '1' },
      { label: 'Medium', value: null },
      { label: 'Low', value: '4' },
    ],
  },
  {
    title: 'View distance',
    param: 'view',
    current: (c) => String(c.viewDist),
    options: [
      { label: '400 m', value: '400' },
      { label: '700 m', value: null },
      { label: 'Whole mountain', value: '1500' },
    ],
  },
];

const DEFAULT_VALUE: Record<string, string> = {
  zoom: '1',
  renderer: 'webgpu',
  trees: '10000',
  dpr: '2',
  shadows: '0',
  stride: '2',
  view: '700',
};

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
  ) {
    const root = document.getElementById('hud') as HTMLElement;
    root.hidden = !cfg.hud;
    const button = document.getElementById('menu-button') as HTMLButtonElement;
    button.addEventListener('click', () => {
      this.menuEl.hidden = !this.menuEl.hidden;
    });
    const fast = document.getElementById('fast-button') as HTMLButtonElement;
    fast.addEventListener('click', () => {
      const on = fast.getAttribute('aria-pressed') !== 'true';
      fast.setAttribute('aria-pressed', String(on));
      onFast(on);
    });
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
      for (const opt of group.options) {
        const a = add(row, 'a', opt.label);
        a.href = withParams(location.search, { [group.param]: opt.value }) || location.pathname;
        if ((opt.value ?? DEFAULT_VALUE[group.param]) === current) a.className = 'on';
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
    add(this.menuEl, 'p', 'Changing a setting reloads the page.');
  }

  /** One line that can be pasted back into a Claude session. */
  report(): string {
    const s = this.lastStats;
    if (!s) return 'no frames yet';
    return (
      `${s.backend} ${s.width}x${s.height} @${s.pixelRatio}x | ${s.fps.toFixed(0)} fps, p95 ${s.p95Ms.toFixed(1)} ms, ` +
      `worst ${s.worstMs.toFixed(1)} ms | ${s.drawCalls} calls, ${(s.triangles / 1000).toFixed(0)}k tris | ` +
      `trees ${s.trees}, stride ${this.cfg.stride}, view ${this.cfg.viewDist}, shadows ${this.cfg.shadows ? 'on' : 'off'}, ` +
      `zoom ${this.cfg.zoom} | ` +
      `${this.lastWhere} | ${navigator.userAgent}`
    );
  }

  setStats(s: HudStats): void {
    this.lastStats = s;
    this.statsEl.textContent =
      `${s.fps.toFixed(0).padStart(3)} fps   ${s.backend}\n` +
      `p95 ${s.p95Ms.toFixed(1)} ms  worst ${s.worstMs.toFixed(0)} ms\n` +
      `${s.drawCalls} calls  ${(s.triangles / 1000).toFixed(0)}k tris\n` +
      `${s.width}x${s.height} @${s.pixelRatio}x  ${(s.trees / 1000).toFixed(1)}k trees`;
  }

  setWhere(trail: Trail | null, elevationFt: number): void {
    const ft = `${Math.round(elevationFt).toLocaleString('en-US')} ft`;
    const text = trail ? `${trail.name} · ${ft}` : ft;
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
