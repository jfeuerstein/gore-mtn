import type { Game } from '../game/game';
import { MINERALS } from '../game/minerals';
import { CONDITIONS, trailShare, type TrailEntry } from '../game/passport';
import { KIN_NAME, SPECIES, type Kin, type Species } from '../game/wildlife';
import { SEASON_NAME, SEASONS } from '../look/season';
import { DIFFICULTY_MARK } from '../world/trails';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "2026-11-10" as "Nov 10". */
export function shortDay(day: string): string {
  const [, month, date] = day.split('-').map(Number);
  const name = MONTHS[(month ?? 0) - 1];
  return name && date ? `${name} ${date}` : day;
}

/** The trails in the order a trail map lists them. */
const TRAIL_GROUPS: { title: string; has: (t: TrailEntry) => boolean }[] = [
  { title: 'Easier', has: (t) => !t.glade && t.difficulty === 'easy' },
  { title: 'More difficult', has: (t) => !t.glade && t.difficulty === 'intermediate' },
  { title: 'Most difficult', has: (t) => !t.glade && t.difficulty === 'advanced' },
  { title: 'Experts only', has: (t) => !t.glade && t.difficulty === 'expert' },
  { title: 'Glades', has: (t) => t.glade },
  { title: 'Terrain parks', has: (t) => !t.glade && t.difficulty === 'freeride' },
];

type Tab = 'passport' | 'minerals' | 'guide';

const SEASON_WORDS = (s: Species): string => (s.seasons ? s.seasons.map((q) => SEASON_NAME[q]).join(', ') : 'All year');
const WATCH_WORDS = (s: Species): string => (s.watches ? s.watches.join(', ') : '');

const el = <K extends keyof HTMLElementTagNameMap>(tag: K, className = '', text = ''): HTMLElementTagNameMap[K] => {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text) node.textContent = text;
  return node;
};

/**
 * The book: a sheet over the lower part of the screen with the trail passport on one page and the
 * mineral collection on the other. It shows what has been earned and what is still to find.
 */
export class Book {
  private readonly sheet: HTMLElement;
  private readonly body: HTMLElement;
  private readonly tabs = new Map<Tab, HTMLButtonElement>();
  private tab: Tab = 'passport';
  /** Called when the book opens, so other sheets can get out of the way. */
  onOpen: (() => void) | null = null;

  constructor(private readonly game: Game) {
    this.sheet = el('div');
    this.sheet.id = 'book-sheet';
    this.sheet.hidden = true;
    const head = el('div', 'head');
    const tabs = el('div', 'tabs');
    for (const [tab, label] of [
      ['passport', 'Passport'],
      ['minerals', 'Minerals'],
      ['guide', 'Field guide'],
    ] as const) {
      const button = el('button', '', label);
      button.type = 'button';
      button.dataset.tab = tab;
      button.addEventListener('click', () => {
        this.tab = tab;
        this.render();
        this.body.scrollTop = 0;
      });
      this.tabs.set(tab, button);
      tabs.appendChild(button);
    }
    const close = el('button', 'close', 'Close');
    close.type = 'button';
    close.addEventListener('click', () => this.close());
    head.append(tabs, close);
    this.body = el('div', 'body');
    this.sheet.append(head, this.body);
    (document.getElementById('app') ?? document.body).appendChild(this.sheet);
    document.getElementById('book-button')?.addEventListener('click', () => (this.sheet.hidden ? this.open() : this.close()));
  }

  get isOpen(): boolean {
    return !this.sheet.hidden;
  }

  open(): void {
    this.onOpen?.();
    this.sheet.hidden = false;
    this.render();
  }

  close(): void {
    this.sheet.hidden = true;
  }

  /** Something has been earned: bring the page up to date if it is on show. */
  refresh(): void {
    if (this.isOpen) this.render();
  }

  private render(): void {
    for (const [tab, button] of this.tabs) button.setAttribute('aria-pressed', String(tab === this.tab));
    this.body.replaceChildren(...(this.tab === 'passport' ? this.passport() : this.tab === 'minerals' ? this.minerals() : this.guide()));
  }

  private heading(title: string, have: number, of: number): HTMLElement {
    const h = el('h3', '', title);
    h.appendChild(el('span', '', `${have} of ${of}`));
    return h;
  }

  /**
   * A row of stamps: inked when earned, a dotted outline when not.
   * `pips` are smaller marks on a stamp, one for each season it can be earned in.
   */
  private stamps(kind: string, items: { name: string; day: string | undefined; how?: string; pips?: { label: string; on: boolean }[] }[]): HTMLElement {
    const row = el('div', 'stamps');
    for (const item of items) {
      const stamp = el('div', `stamp ${kind} ${item.day ? 'earned' : 'todo'}`);
      stamp.appendChild(el('b', '', item.name));
      stamp.appendChild(el('small', '', item.day ? shortDay(item.day) : (item.how ?? '')));
      if (item.pips) {
        const pips = el('span', 'pips');
        for (const pip of item.pips) pips.appendChild(el('i', pip.on ? 'on' : '', pip.label));
        stamp.appendChild(pips);
      }
      row.appendChild(stamp);
    }
    return row;
  }

  private passport(): HTMLElement[] {
    const { game } = this;
    const save = game.save;
    const s = game.summary();
    const out: HTMLElement[] = [];

    out.push(this.heading('Seasons', s.seasons, SEASONS.length));
    out.push(this.stamps('season', SEASONS.map((season) => ({ name: SEASON_NAME[season], day: save.seasons[season], how: 'Visit the mountain.' }))));
    out.push(this.heading('Summits', s.seasonPeaks, s.seasonPeaksTotal));
    out.push(el('p', 'note', 'Each summit has a patch for every season.'));
    out.push(
      this.stamps(
        'peak',
        game.peaks.map((p) => ({
          name: p.name,
          day: save.peaks[p.id],
          how: 'Stand on top.',
          pips: SEASONS.map((season) => ({ label: SEASON_NAME[season].slice(0, 2), on: `${p.id}:${season}` in save.seasonPeaks })),
        })),
      ),
    );
    out.push(this.heading('Landmarks', s.landmarks, s.landmarksTotal));
    out.push(this.stamps('landmark', game.landmarks.map((p) => ({ name: p.name, day: save.landmarks[p.id], how: 'Pay a visit.' }))));
    out.push(this.heading('Conditions', s.conditions, s.conditionsTotal));
    out.push(this.stamps('condition', CONDITIONS.map((c) => ({ name: c.name, day: save.conditions[c.id], how: c.how }))));
    out.push(this.heading('Lifts', s.lifts, s.liftsTotal));
    out.push(this.stamps('lift', game.liftNames.map((name) => ({ name, day: save.lifts[name], how: 'Ride to the top.' }))));

    out.push(this.heading('Trails', s.trails, s.trailsTotal));
    out.push(el('p', 'note', 'Ski a trail from top to bottom to stamp it, or ride it when the snow has gone. It need not be in one run.'));
    for (const group of TRAIL_GROUPS) {
      const trails = game.trails.filter(group.has);
      if (trails.length === 0) continue;
      const done = trails.filter((t) => save.trails[t.name]?.stamped).length;
      const h = el('h4', '', group.title);
      h.appendChild(el('span', '', `${done} of ${trails.length}`));
      out.push(h);
      const list = el('div', 'trails');
      for (const trail of trails) {
        const progress = save.trails[trail.name];
        const row = el('div', `trail ${progress?.stamped ? 'earned' : ''}`);
        row.appendChild(el('span', `mark mark-${trail.difficulty}`, DIFFICULTY_MARK[trail.difficulty]));
        row.appendChild(el('span', 'name', trail.name));
        if (progress?.stamped) {
          row.appendChild(el('small', '', shortDay(progress.stamped)));
        } else {
          const share = trailShare(progress);
          const bar = el('span', 'bar');
          const fill = el('i');
          fill.style.width = `${Math.round(share * 100)}%`;
          bar.appendChild(fill);
          row.appendChild(bar);
        }
        list.appendChild(row);
      }
      out.push(list);
    }

    out.push(this.heading('Paths', s.paths, s.pathsTotal));
    out.push(el('p', 'note', 'The hiking, biking and cross-country trails through the woods. Follow one from end to end, on foot or however you like. They are on the map as dotted lines.'));
    const paths = el('div', 'trails');
    for (const path of game.paths) {
      const progress = save.paths[path.name];
      const row = el('div', `trail ${progress?.stamped ? 'earned' : ''}`);
      row.appendChild(el('span', 'mark mark-path', '⋯'));
      row.appendChild(el('span', 'name', path.name));
      if (progress?.stamped) {
        row.appendChild(el('small', '', shortDay(progress.stamped)));
      } else {
        const bar = el('span', 'bar');
        const fill = el('i');
        fill.style.width = `${Math.round(trailShare(progress) * 100)}%`;
        bar.appendChild(fill);
        row.appendChild(bar);
      }
      paths.appendChild(row);
    }
    out.push(paths);
    return out;
  }

  private guide(): HTMLElement[] {
    const { game } = this;
    const s = game.summary();
    const out: HTMLElement[] = [this.heading('Field guide', s.species, s.speciesTotal)];
    out.push(el('p', 'note', 'Come close to an animal, a bird or a plant to enter it in the guide. Anything not yet in it carries a pale blue mark. What is about changes with the season and the hour.'));
    for (const kin of ['animal', 'bird', 'plant', 'curio'] as Kin[]) {
      const entries = SPECIES.filter((sp) => sp.kin === kin);
      const seen = entries.filter((sp) => game.save.sightings[sp.id]).length;
      const h = el('h4', '', KIN_NAME[kin]);
      h.appendChild(el('span', '', `${seen} of ${entries.length}`));
      out.push(h);
      const list = el('div', 'minerals');
      for (const sp of entries) {
        const record = game.save.sightings[sp.id];
        const card = el('div', `mineral species ${record ? 'earned' : 'todo'}`);
        card.appendChild(el('span', `badge badge-${kin}`, record ? sp.name.charAt(0) : '?'));
        const text = el('div');
        text.appendChild(el('b', '', sp.name));
        if (record) {
          text.appendChild(el('small', 'tally', `Seen ${record.count === 1 ? 'once' : `${record.count} times`} · first ${shortDay(record.first)}`));
          text.appendChild(el('small', '', sp.about));
        } else {
          text.appendChild(el('small', '', sp.hint));
        }
        const when = [SEASON_WORDS(sp), WATCH_WORDS(sp)].filter(Boolean).join(' · ');
        text.appendChild(el('small', 'when', when));
        card.append(card.firstChild as Node, text);
        list.appendChild(card);
      }
      out.push(list);
    }
    return out;
  }

  private minerals(): HTMLElement[] {
    const { game } = this;
    const s = game.summary();
    const out: HTMLElement[] = [this.heading('Minerals', s.minerals, s.mineralsTotal)];
    out.push(
      el('p', 'note', s.specimens === 0 ? 'Stones glint on the snow beside the trails, in bare rock and deep in the woods. A new scatter lies out every day.' : `${s.specimens} ${s.specimens === 1 ? 'stone' : 'stones'} picked up so far. A new scatter lies out every day.`),
    );
    const list = el('div', 'minerals');
    for (const mineral of MINERALS) {
      const record = game.save.minerals[mineral.id];
      const card = el('div', `mineral ${record ? 'earned' : 'todo'}`);
      const gem = el('span', 'gem-wrap');
      const stone = el('span', 'gem');
      if (record) stone.style.backgroundColor = `#${mineral.colour.toString(16).padStart(6, '0')}`;
      gem.appendChild(stone);
      const text = el('div');
      const name = el('b', '', mineral.name);
      name.appendChild(el('span', `rarity ${mineral.rarity}`, mineral.rarity));
      text.appendChild(name);
      if (record) {
        text.appendChild(el('small', 'tally', `${record.count} found · largest ${record.best.toFixed(1)} cm · first ${shortDay(record.first)}`));
        text.appendChild(el('small', '', mineral.about));
      } else {
        text.appendChild(el('small', '', mineral.hint));
      }
      card.append(gem, text);
      list.appendChild(card);
    }
    out.push(list);
    return out;
  }
}
