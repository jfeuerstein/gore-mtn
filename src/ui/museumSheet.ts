import { dropAway, sewn } from './motion';

/** One place in a hall, as the sheet shows it. */
export interface MuseumPlace {
  key: string;
  name: string;
  /** Where its picture is. */
  art: string;
  /** In its case; in the player's Book but not yet shown to the keeper; or not found yet. */
  state: 'in' | 'yours' | 'none';
  /** A painting is a picture, not a patch: shown square, and not sewn in. */
  picture?: boolean;
}

/** What the sheet needs to know, asked for again whenever something on it may have changed. */
export interface MuseumPage {
  /** A picture of the room, for the top of the sheet. */
  room: string;
  /** What the keeper has to say, in a row or two. */
  says: string;
  /** How many things the player has that he has not seen. */
  waiting: number;
  given: number;
  total: number;
  /** What he will hand over next, and at how many pieces; null when he has nothing more to give. */
  next: { at: number; what: string } | null;
  halls: readonly { name: string; bare: string; given: number; total: number; places: readonly MuseumPlace[] }[];
}

/**
 * The museum's sheet: the room, what its keeper says, a button to show him what is new, and
 * every hall with a place for each thing it could hold. What is in its case is in its colours;
 * what the player has and he has not seen stands out, waiting; the rest is a pale ghost, as in
 * the Book. A thing that has just gone into its case is sewn in, as a patch is.
 */
export class MuseumSheet {
  private readonly sheet: HTMLElement;
  private readonly body: HTMLElement;
  private readonly room: HTMLImageElement;
  private readonly says: HTMLElement;
  private readonly giveButton: HTMLButtonElement;
  private readonly count: HTMLElement;
  private readonly halls: HTMLElement;
  private page: (() => MuseumPage) | null = null;
  /** What went into its case since the sheet was last drawn, to be sewn in. */
  private fresh = new Set<string>();
  /** Called when the sheet opens, so other sheets can get out of the way. */
  onOpen: (() => void) | null = null;
  /** The player wants to show the keeper what they have. Gives back what went into the cases, by key. */
  onGive: (() => readonly string[]) | null = null;

  constructor() {
    const app = document.getElementById('app') ?? document.body;
    const el = <K extends keyof HTMLElementTagNameMap>(tag: K, cls = '', text = ''): HTMLElementTagNameMap[K] => {
      const made = document.createElement(tag);
      if (cls) made.className = cls;
      if (text) made.textContent = text;
      return made;
    };
    this.sheet = el('div');
    this.sheet.id = 'museum-sheet';
    this.sheet.hidden = true;
    const head = el('div', 'head');
    const close = el('button', '', 'Close');
    close.type = 'button';
    close.addEventListener('click', () => this.close());
    head.append(el('h2', '', 'Museum'), close);
    this.body = el('div', 'body');
    this.room = el('img', 'room');
    this.room.alt = '';
    this.says = el('p', 'says');
    this.giveButton = el('button', 'give');
    this.giveButton.type = 'button';
    this.giveButton.addEventListener('click', () => {
      this.fresh = new Set(this.onGive?.() ?? []);
      this.render();
      // What has just gone in is brought into view, if it is not already.
      this.body.querySelector('.sewn')?.scrollIntoView({ block: 'center', behavior: 'smooth' });
    });
    this.count = el('p', 'count');
    this.halls = el('div', 'halls');
    this.body.append(this.room, this.says, this.giveButton, this.count, this.halls);
    this.sheet.append(head, this.body);
    app.appendChild(this.sheet);
  }

  get isOpen(): boolean {
    return !this.sheet.hidden;
  }

  open(page: () => MuseumPage): void {
    this.onOpen?.();
    this.page = page;
    this.fresh.clear();
    this.sheet.hidden = false;
    this.body.scrollTop = 0;
    this.render();
  }

  close(): void {
    if (this.sheet.hidden) return;
    dropAway(this.sheet);
    this.sheet.hidden = true;
  }

  private render(): void {
    const page = this.page?.();
    if (!page) return;
    if (this.room.getAttribute('src') !== page.room) this.room.src = page.room;
    this.says.replaceChildren(
      ...page.says.split('\n').map((row) => {
        const line = document.createElement('span');
        line.textContent = row;
        return line;
      }),
    );
    this.giveButton.hidden = page.waiting === 0;
    this.giveButton.textContent = page.waiting === 1 ? 'Show Silas what you found' : `Show Silas all ${page.waiting}`;
    this.count.textContent = `${page.given} of ${page.total} in the cases${page.next ? ` · at ${page.next.at}, ${page.next.what}` : ''}`;
    this.halls.replaceChildren();
    for (const hall of page.halls) {
      const heading = document.createElement('h3');
      heading.textContent = hall.name;
      const tally = document.createElement('small');
      tally.textContent = `${hall.given} / ${hall.total}`;
      heading.append(tally);
      const grid = document.createElement('div');
      grid.className = 'cases';
      for (const place of hall.places) {
        const item = document.createElement('div');
        item.className = `case ${place.state}${place.picture ? ' picture' : ''}`;
        const pic = document.createElement('img');
        pic.src = place.art;
        pic.alt = '';
        pic.loading = 'lazy';
        // The name of a thing not yet found is not given away: the Book says what there is to look for.
        const label = document.createElement('small');
        label.textContent = place.state === 'none' ? '' : place.name;
        item.setAttribute('aria-label', place.state === 'in' ? `${place.name}: in its case` : place.state === 'yours' ? `${place.name}: yours to show` : 'An empty case');
        item.append(this.fresh.has(place.key) && !place.picture ? sewn(pic) : pic, label);
        grid.append(item);
      }
      this.halls.append(heading);
      if (hall.given === 0 && hall.places.every((p) => p.state === 'none')) {
        const bare = document.createElement('p');
        bare.className = 'note';
        bare.textContent = hall.bare;
        this.halls.append(bare);
      }
      this.halls.append(grid);
    }
  }
}
