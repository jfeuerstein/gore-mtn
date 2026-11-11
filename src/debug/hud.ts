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
    title: 'Season',
    param: 'season',
    current: (c) => c.season,
    options: [
      { label: 'Real', value: 'real' },
      { label: 'Winter', value: 'winter' },
      { label: 'Spring', value: 'spring' },
      { label: 'Summer', value: 'summer' },
      { label: 'Fall', value: 'fall' },
    ],
  },
  {
    title: 'Time of day',
    param: 'time',
    current: (c) => c.time,
    options: [
      { label: 'Real', value: 'real' },
      { label: 'Dawn', value: 'dawn' },
      { label: 'Midday', value: 'midday' },
      { label: 'Evening', value: 'evening' },
      { label: 'Dusk', value: 'dusk' },
      { label: 'Night', value: 'night' },
    ],
  },
  {
    title: 'Weather',
    param: 'weather',
    current: (c) => c.weather,
    options: [
      { label: 'Real', value: 'real' },
      { label: 'Clear', value: 'clear' },
      { label: 'Cloudy', value: 'cloudy' },
      { label: 'Snow', value: 'snow' },
    ],
  },
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
    title: 'Forest',
    param: 'trees',
    current: (c) => String(c.trees),
    options: [
      { label: 'None', value: '0' },
      { label: 'Thin', value: '110000' },
      { label: 'Normal', value: '220000' },
      { label: 'Thick', value: '330000' },
    ],
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
    title: 'Boards and shingles on buildings',
    param: 'siding',
    current: (c) => (c.siding ? '1' : '0'),
    options: [
      { label: 'Plain', value: '0' },
      { label: 'On', value: '1' },
    ],
  },
  {
    title: 'World look',
    param: 'look',
    current: (c) => c.look,
    options: [
      { label: 'As it is', value: 'plain' },
      { label: 'Park print', value: 'poster' },
      { label: 'Contour map', value: 'topo' },
    ],
  },
  {
    title: 'Animal models',
    param: 'models',
    current: (c) => c.models,
    options: [
      { label: 'Blocks', value: 'blocks' },
      { label: 'Faceted', value: 'facet' },
      { label: 'Park print', value: 'park' },
      { label: 'Smooth', value: 'smooth' },
    ],
  },
  {
    title: 'Line the animals up to compare',
    param: 'zoo',
    current: (c) => (c.zoo ? '1' : '0'),
    options: [
      { label: 'Off', value: '0' },
      { label: 'On', value: '1' },
    ],
  },
  {
    title: 'Other people on the mountain',
    param: 'crowd',
    current: (c) => (c.crowd ? '1' : '0'),
    options: [
      { label: 'Nobody', value: '0' },
      { label: 'On', value: '1' },
    ],
  },
  {
    title: 'Terrain detail',
    param: 'stride',
    current: (c) => String(c.stride),
    options: [
      { label: 'Full', value: '1' },
      { label: 'Half', value: '2' },
    ],
  },
  {
    title: 'Frame-rate readout',
    param: 'stats',
    current: (c) => (c.stats ? '1' : '0'),
    options: [
      { label: 'Off', value: '0' },
      { label: 'On', value: '1' },
    ],
  },
  {
    title: 'View distance',
    param: 'view',
    current: (c) => String(c.viewDist),
    options: [
      { label: '2,000 m', value: '2000' },
      { label: '3,500 m', value: '3500' },
      { label: 'Whole mountain', value: '6500' },
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
    `page ${window.innerWidth}x${window.innerHeight}, game ${document.getElementById('app')?.clientHeight ?? 0} tall, ` +
    `insets top/bottom ${insets} | ${navigator.userAgent}`
  );
}

/** On-screen readout and settings menu for testing on a phone. */
export class Hud {
  private readonly statsEl = document.getElementById('stats') as HTMLElement;
  private readonly whereEl = document.getElementById('where') as HTMLElement;
  private readonly menuEl = document.getElementById('menu') as HTMLElement;
  private lastStats: HudStats | null = null;
  private lastWhere = '';
  private readonly actionEl = document.getElementById('action-button') as HTMLButtonElement;
  private onAction: (() => void) | null = null;
  private readonly talkEl = document.getElementById('talk-button') as HTMLButtonElement;
  private onTalk: (() => void) | null = null;

  constructor(
    private readonly cfg: Config,
    places: Place[],
    onTeleport: (place: Place) => void,
    onFast: (on: boolean) => void,
    onSkis: (on: boolean) => void,
    /** Where the player is, as address options, so a change of setting brings them back to the same spot. */
    private readonly place: () => Record<string, string | null> = () => ({}),
    /** The player's book as a code to keep somewhere safe, and a way to bring one back. */
    private readonly book: { code(): string; holds(code: string): boolean; restore(code: string): boolean } | null = null,
    /** Sound on or off. */
    private readonly sound: { enabled(): boolean; set(on: boolean): void } | null = null,
    /** Where the map and its data come from, for the credits. */
    private readonly attribution = '',
  ) {
    const root = document.getElementById('hud') as HTMLElement;
    root.hidden = !cfg.hud;
    this.statsEl.hidden = !cfg.stats;
    (document.getElementById('app') ?? document.body).classList.toggle('show-stats', cfg.stats);
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
    this.actionEl.addEventListener('click', () => this.onAction?.());
    this.talkEl.addEventListener('click', () => this.onTalk?.());
    this.buildMenu(places, onTeleport);
    toggle('fast-button', false, onFast);
    toggle('ski-button', cfg.ski, onSkis);
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

    if (this.book) {
      const book = this.book;
      add(this.menuEl, 'h2', 'Your book');
      const keep = add(this.menuEl, 'div');
      keep.className = 'row';
      const copyCode = add(keep, 'button', 'Copy save code');
      copyCode.type = 'button';
      copyCode.id = 'save-copy';
      const field = add(keep, 'input');
      field.id = 'save-field';
      field.type = 'text';
      field.placeholder = 'Paste a save code';
      field.autocapitalize = 'off';
      field.autocomplete = 'off';
      field.spellcheck = false;
      const restore = add(keep, 'button', 'Restore');
      restore.type = 'button';
      restore.id = 'save-restore';
      const note = add(this.menuEl, 'p', 'The book is kept on this phone. A save code is the whole book as text: keep one somewhere safe, or use it to carry the book to another browser.');
      copyCode.addEventListener('click', () => {
        const code = book.code();
        // Show it as well, so it can be copied by hand where the clipboard is not allowed.
        field.value = code;
        void (navigator.clipboard?.writeText(code) ?? Promise.reject()).then(
          () => (copyCode.textContent = 'Copied'),
          () => (copyCode.textContent = 'Select and copy it'),
        );
      });
      // Restoring replaces the book on this phone, so it takes two taps on the same code.
      let armed = '';
      restore.addEventListener('click', () => {
        const code = field.value.trim();
        if (!book.holds(code)) {
          note.textContent = 'That is not a save code.';
          armed = '';
        } else if (armed !== code) {
          armed = code;
          note.textContent = 'This replaces the book on this phone with the one in the code. Tap Restore again to go ahead.';
        } else {
          armed = '';
          note.textContent = book.restore(code) ? 'Book restored.' : 'That is not a save code.';
          field.value = '';
        }
      });
    }

    if (this.sound) {
      const sound = this.sound;
      add(this.menuEl, 'h2', 'Sound');
      const row = add(this.menuEl, 'div');
      row.className = 'row';
      const buttons = (['On', 'Off'] as const).map((label) => {
        const b = add(row, 'button', label);
        b.type = 'button';
        b.id = `sound-${label.toLowerCase()}`;
        return b;
      });
      const show = (): void => buttons.forEach((b, i) => b.setAttribute('aria-pressed', String(sound.enabled() === (i === 0))));
      buttons.forEach((b, i) =>
        b.addEventListener('click', () => {
          sound.set(i === 0);
          show();
        }),
      );
      show();
    }

    const optionGroup = (group: OptionGroup): void => {
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
        a.addEventListener('click', (e) => {
          e.preventDefault();
          location.assign(withParams(location.search, { ...this.place(), [group.param]: value }) || location.pathname);
        });
      }
      if (group.param === 'weather') {
        add(this.menuEl, 'p', 'Real follows the calendar, the clock and the sky over Gore. The others are for trying a moment out; the game goes back to Real the next time it is opened.');
      }
    };

    const camera = OPTIONS.find((g) => g.param === 'zoom');
    if (camera) optionGroup(camera);

    // Everything below is for trying things out and for measuring, not for playing.
    const testing = add(this.menuEl, 'h2', 'For testing');
    testing.className = 'divider';
    add(this.menuEl, 'p', 'These jump about the mountain, pin a season or an hour, and trade looks for speed. Changing one reloads the page.');
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
    // For getting about while testing: on foot, the stick moves at the speed of a fast lift.
    const fast = add(go, 'button', 'Fast travel');
    fast.type = 'button';
    fast.id = 'fast-button';

    for (const group of OPTIONS) if (group.param !== 'zoom') optionGroup(group);

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

    add(this.menuEl, 'h2', 'About');
    add(this.menuEl, 'p', 'Gore is a personal, non-commercial fan project, not affiliated with or endorsed by Gore Mountain or any business in North Creek.');
    add(this.menuEl, 'p', `${this.attribution} Weather: Open-Meteo. Drawn with three.js.`.trim());
  }

  /** One line that can be pasted back into a Claude session. */
  report(): string {
    const s = this.lastStats;
    if (!s) return 'no frames yet';
    return (
      `${s.backend} ${s.width}x${s.height} @${s.pixelRatio}x | ${describeSummary(s.frame)} | ` +
      `${s.drawCalls} calls, ${(s.triangles / 1000).toFixed(0)}k tris | ` +
      `trees ${s.trees}, stride ${this.cfg.stride}, view ${this.cfg.viewDist}, shadows ${this.cfg.shadows ? 'on' : 'off'}, ` +
      `zoom ${this.cfg.zoom}, time ${this.cfg.time}, weather ${this.cfg.weather} | ` +
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

  /**
   * Offer something to do here, as a button by the thumb, or take the offer away with null.
   * Safe to call every frame.
   */
  setAction(label: string | null, onTap: (() => void) | null = null): void {
    this.onAction = onTap;
    if (label === null) {
      if (!this.actionEl.hidden) this.actionEl.hidden = true;
      return;
    }
    if (this.actionEl.textContent !== label) this.actionEl.textContent = label;
    if (this.actionEl.hidden) this.actionEl.hidden = false;
  }

  /**
   * Offer a second thing to do here, such as talking to someone standing by a lift. It sits above
   * the first. Safe to call every frame.
   */
  setTalk(label: string | null, onTap: (() => void) | null = null): void {
    this.onTalk = onTap;
    if (label === null) {
      if (!this.talkEl.hidden) this.talkEl.hidden = true;
      return;
    }
    if (this.talkEl.textContent !== label) this.talkEl.textContent = label;
    if (this.talkEl.hidden) this.talkEl.hidden = false;
  }

  /**
   * @param mph speed to show, or null to leave it out (on foot)
   * @param liftName the lift being ridden, shown in place of a trail
   */
  setWhere(trail: Trail | null, elevationFt: number, mph: number | null, liftName: string | null = null): void {
    const ft = `${Math.round(elevationFt).toLocaleString('en-US')} ft`;
    const pace = mph === null ? '' : ` · ${Math.round(mph)} mph`;
    if (liftName !== null) trail = null;
    const text = (liftName !== null ? `${liftName} · ${ft}` : trail ? `${trail.name} · ${ft}` : ft) + pace;
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
