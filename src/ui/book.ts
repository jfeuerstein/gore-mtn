import { artSlug } from '../game/artNames';
import type { Game } from '../game/game';
import { MINERALS } from '../game/minerals';
import { CONDITIONS, trailShare, type TrailEntry } from '../game/passport';
import { LETTERS } from '../game/letters';
import { OFFERINGS } from '../game/offerings';
import { PATCHES } from '../game/patches';
import { ERRANDS, GEAR, personById, TOWN_ROUND } from '../game/people';
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

type Tab = 'passport' | 'minerals' | 'guide' | 'pack';

const SEASON_WORDS = (s: Species): string => (s.seasons ? s.seasons.map((q) => SEASON_NAME[q]).join(', ') : 'All year');
const WATCH_WORDS = (s: Species): string => (s.watches ? s.watches.join(', ') : '');

/** A picture from the game's generated art: a mineral's or a species' plate. Left out if it cannot be had. */
function plate(set: 'minerals' | 'species' | 'places', id: string): HTMLImageElement {
  const img = document.createElement('img');
  img.className = 'plate';
  img.alt = '';
  img.loading = 'lazy';
  img.decoding = 'async';
  img.src = `${import.meta.env.BASE_URL}art/${set}/${id}.webp`;
  img.addEventListener('error', () => (img.style.visibility = 'hidden'));
  return img;
}

/**
 * A picture of something that can be had: a patch, a hat, a bun. Whatever has not been had yet
 * is shown as a pale ghost of itself, so that the shelf says what there is to look for.
 * @param art its set and name under public/art, as "patches/first-tracks"
 */
function pic(art: string, have: boolean): HTMLImageElement {
  const img = document.createElement('img');
  img.className = have ? 'pic' : 'pic ghost';
  img.alt = '';
  img.loading = 'lazy';
  img.decoding = 'async';
  img.src = `${import.meta.env.BASE_URL}art/${art}.webp`;
  img.addEventListener('error', () => (img.style.visibility = 'hidden'));
  return img;
}

/** A plate not yet earned: a pale ghost of it, to say there is something there to find. */
function ghost(set: 'minerals' | 'species', id: string): HTMLImageElement {
  const img = plate(set, id);
  img.className = 'plate ghost';
  return img;
}

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
  /** Called when the player changes what they are wearing. */
  onWear: (() => void) | null = null;

  /** Today's date, as the game reckons it, for what resets each day. Set by whoever owns the clock. */
  today: () => string = () => '';

  constructor(private readonly game: Game) {
    this.sheet = el('div');
    this.sheet.id = 'book-sheet';
    this.sheet.hidden = true;
    const head = el('div', 'head');
    const tabs = el('div', 'tabs');
    for (const [tab, label] of [
      ['passport', 'Passport'],
      ['minerals', 'Minerals'],
      ['guide', 'Guide'],
      ['pack', 'Pack'],
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
    const page = { passport: () => this.passport(), minerals: () => this.minerals(), guide: () => this.guide(), pack: () => this.pack() }[this.tab];
    this.body.replaceChildren(...page());
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
  private stamps(kind: string, items: { name: string; day: string | undefined; how?: string; pips?: { label: string; on: boolean }[]; art?: string }[]): HTMLElement {
    // With pictures, the stamps are a shelf of things: three to a row, each under its picture.
    const row = el('div', items.some((i) => i.art) ? 'stamps shelf' : 'stamps');
    for (const item of items) {
      const stamp = el('div', `stamp ${kind} ${item.day ? 'earned' : 'todo'}${item.art ? ' tile' : ''}`);
      if (item.art) stamp.appendChild(pic(item.art, Boolean(item.day)));
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

    out.push(this.heading('Patches', s.patches, s.patchesTotal));
    out.push(el('p', 'note', 'For the long hauls - finishing a whole kind of thing.'));
    out.push(this.stamps('patch', PATCHES.map((p) => ({ name: p.name, day: save.patches[p.id], how: p.how, art: `patches/${artSlug(p.id)}` }))));
    out.push(this.heading('Seasons', s.seasons, SEASONS.length));
    out.push(this.stamps('season', SEASONS.map((season) => ({ name: SEASON_NAME[season], day: save.seasons[season], how: 'Visit the mountain.', art: `title/${season}` }))));
    out.push(this.heading('Summits', s.seasonPeaks, s.seasonPeaksTotal));
    out.push(el('p', 'note', 'Each summit has a patch for every season.'));
    out.push(
      this.stamps(
        'peak',
        game.peaks.map((p) => ({
          name: p.name,
          day: save.peaks[p.id],
          how: 'Stand on top.',
          art: `peaks/${artSlug(p.id)}`,
          pips: SEASONS.map((season) => ({ label: SEASON_NAME[season].slice(0, 2), on: `${p.id}:${season}` in save.seasonPeaks })),
        })),
      ),
    );
    if (s.benchesTotal > 0) {
      out.push(this.heading('Benches', s.benches, s.benchesTotal));
      out.push(el('p', 'note', "Benches you've sat on, just for the view. They're by the doors in town and at the lookouts."));
      out.push(this.stamps('bench', (game.benches ?? []).map((b) => ({ name: b.name, day: save.benches[b.id], how: 'Sit a while.' }))));
    }
    out.push(this.heading('Landmarks', s.landmarks, s.landmarksTotal));
    out.push(el('p', 'note', "A postcard from everywhere you've stood."));
    // Each landmark is a postcard: blank until visited, then its picture and the day.
    const cards = el('div', 'stamps postcards');
    for (const place of game.landmarks) {
      const day = save.landmarks[place.id];
      const card = el('div', `stamp landmark postcard ${day ? 'earned' : 'todo'}`);
      if (day) card.appendChild(plate('places', place.id));
      else card.appendChild(el('span', 'badge', '?'));
      card.appendChild(el('b', '', place.name));
      card.appendChild(el('small', '', day ? shortDay(day) : 'Pay a visit.'));
      cards.appendChild(card);
    }
    out.push(cards);
    out.push(this.heading('Conditions', s.conditions, s.conditionsTotal));
    out.push(this.stamps('condition', CONDITIONS.map((c) => ({ name: c.name, day: save.conditions[c.id], how: c.how, art: `conditions/${artSlug(c.id)}` }))));
    out.push(this.heading('Lifts', s.lifts, s.liftsTotal));
    out.push(this.stamps('lift', game.liftNames.map((name) => ({ name, day: save.lifts[name], how: 'Ride to the top.', art: `pins/${artSlug(game.liftKind(name))}` }))));

    out.push(this.heading('Trails', s.trails, s.trailsTotal));
    out.push(el('p', 'note', "Ski a trail top to bottom to stamp it, or ride it once the snow's gone. It doesn't have to be in one run."));
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
    out.push(el('p', 'note', "The hiking, biking and cross-country trails through the woods. Follow one end to end, on foot or however you like. They're the dotted lines on the map."));
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

  /** Errands in hand and done, things being carried, and things to wear. */
  private pack(): HTMLElement[] {
    const { game } = this;
    const s = game.summary();
    const out: HTMLElement[] = [this.heading('Errands', s.errands, s.errandsTotal)];
    const active = game.activeErrands();
    if (active.length === 0 && s.errands === 0) {
      out.push(el('p', 'note', "People around the mountain and in town have things to ask. A gold mark over someone's head means they've got something for you. Nothing's timed, and you can't fail anything."));
    }
    const list = el('div', 'minerals');
    for (const e of active) {
      const card = el('div', 'mineral errand');
      card.appendChild(el('span', 'badge badge-errand', '✉'));
      const text = el('div');
      const who = personById(e.to ?? e.from);
      text.appendChild(el('b', '', e.title));
      text.appendChild(el('small', 'tally', game.needMet(e.need) ? `Done! Go see ${who?.name ?? 'them'}.` : `For ${who?.name ?? 'someone'} · ${who?.role ?? ''}`));
      text.appendChild(el('small', '', e.nudge));
      card.appendChild(text);
      list.appendChild(card);
    }
    for (const e of ERRANDS) {
      const done = game.save.errands[e.id]?.done;
      if (!done) continue;
      const card = el('div', 'mineral errand earned');
      card.appendChild(el('span', 'badge badge-errand', '✓'));
      const text = el('div');
      text.appendChild(el('b', '', e.title));
      text.appendChild(el('small', '', `For ${personById(e.from)?.name ?? 'someone'} · done ${shortDay(done)}`));
      card.appendChild(text);
      list.appendChild(card);
    }
    out.push(list);

    if (game.save.items.length > 0) {
      const h = el('h3', '', 'Carrying');
      out.push(h);
      const carried = ERRANDS.filter((e) => e.need.kind === 'item' && game.save.items.includes(e.need.id)).map((e) => e.lost?.name ?? e.fetch?.name ?? e.title);
      out.push(el('p', 'note', carried.join(' · ')));
    }

    const owned = GEAR.filter((g) => game.save.gear.owned.includes(g.id));
    out.push(this.heading('Wardrobe', owned.length, GEAR.length));
    out.push(el('p', 'note', "Hats and jackets people have given you. Tap one to put it on."));
    for (const slot of ['hat', 'jacket'] as const) {
      const row = el('div', 'wardrobe');
      for (const g of GEAR.filter((q) => q.slot === slot)) {
        const have = game.save.gear.owned.includes(g.id);
        const b = el('button', have ? (game.save.gear[slot] === g.id ? 'on' : '') : 'locked');
        b.type = 'button';
        b.disabled = !have;
        b.append(pic(`gear/${artSlug(g.id)}`, have), el('span', '', have ? g.name : '?'));
        b.addEventListener('click', () => {
          if (game.wear(g.id)) {
            this.onWear?.();
            this.render();
          }
        });
        row.appendChild(b);
      }
      out.push(row);
    }
    // The town round: a punch for each door called at today.
    const today = game.save.round.who;
    const round = el('div', `stamp round ${TOWN_ROUND.every((r) => today.includes(r.who)) ? 'earned' : 'todo'}`);
    round.appendChild(el('b', '', 'The town round'));
    round.appendChild(el('small', '', game.save.rounds.length === 0 ? 'Stop by every door in North Creek in one day.' : `Done on ${game.save.rounds.length} day${game.save.rounds.length === 1 ? '' : 's'}. Today:`));
    const punches = el('span', 'pips');
    for (const r of TOWN_ROUND) punches.appendChild(el('i', game.save.round.day === this.today() && today.includes(r.who) ? 'on' : '', r.door));
    round.appendChild(punches);
    out.push(el('h3', '', 'North Creek'));
    out.push(round);
    // What the town has handed over: a menu ticked off, and a library card stamped.
    for (const [title, kinds, hint] of [
      ['Tasted', ['bake', 'sandwich'], "June's bakery and Walt's deli on Main Street each have something new every day."],
      ['Library card', ['book'], "Fenn at the Town Hall library lends one book a day. He's never asked for one back."],
    ] as const) {
      const all = OFFERINGS.filter((o) => (kinds as readonly string[]).includes(o.kind));
      const had = all.filter((o) => o.id in game.save.tried);
      out.push(this.heading(title, had.length, all.length));
      if (had.length === 0) out.push(el('p', 'note', hint));
      // Everything on the menu, or on the shelves: what has been had, with a note; the rest as ghosts.
      const list = el('div', 'tried shelf');
      for (const o of all) {
        const have = o.id in game.save.tried;
        const row = el('div', have ? `ticket ticket-${o.kind} tile` : 'tile todo');
        row.appendChild(pic(`offerings/${artSlug(o.id)}`, have));
        row.appendChild(el('b', '', have ? o.name : '?'));
        if (have) row.appendChild(el('small', '', o.note));
        list.appendChild(row);
      }
      out.push(list);
    }
    // Letters collected from the post office, newest first, to read again.
    const letters = LETTERS.filter((l) => l.id in game.save.letters).sort((a, b) => (game.save.letters[b.id] ?? '').localeCompare(game.save.letters[a.id] ?? ''));
    out.push(this.heading('Letters', letters.length, LETTERS.length));
    if (letters.length === 0) out.push(el('p', 'note', "Dot at the North Creek Post Office keeps your mail. There's one letter a day."));
    for (const letter of letters) {
      const page = el('div', 'letter');
      page.appendChild(el('p', '', letter.text));
      page.appendChild(el('small', '', `${letter.signed} · ${shortDay(game.save.letters[letter.id] ?? '')}`));
      out.push(page);
    }
    if (game.save.pass) {
      out.push(el('h3', '', 'Snow Train pass'));
      out.push(el('p', 'note', game.save.away ? `You're visiting ${game.save.away}. Conductor Bea at the depot will take you on, or home.` : 'Conductor Bea at the North Creek depot will take you to any season.'));
    }
    return out;
  }

  private guide(): HTMLElement[] {
    const { game } = this;
    const s = game.summary();
    const out: HTMLElement[] = [this.heading('Field guide', s.species, s.speciesTotal)];
    out.push(el('p', 'note', "Get close to an animal, a bird or a plant to put it in the guide. Anything you haven't seen yet has a pale blue mark. What's out and about changes with the season and the hour."));
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
        card.appendChild(record ? plate('species', sp.id) : ghost('species', sp.id));
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
      el('p', 'note', s.specimens === 0 ? 'Stones glint on the snow by the trails, in bare rock and deep in the woods. New ones turn up every day.' : `${s.specimens} ${s.specimens === 1 ? 'stone' : 'stones'} picked up so far. New ones turn up every day.`),
    );
    const list = el('div', 'minerals');
    for (const mineral of MINERALS) {
      const record = game.save.minerals[mineral.id];
      const card = el('div', `mineral ${record ? 'earned' : 'todo'}`);
      const gem = record ? plate('minerals', mineral.id) : ghost('minerals', mineral.id);
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
