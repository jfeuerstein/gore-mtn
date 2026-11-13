import type { CabinSave } from '../game/cabin';
import { dropAway } from './motion';

/** What the sheet needs to know, asked for again whenever something on it may have changed. */
export interface CabinPage {
  cabin: CabinSave;
  /** A picture for each mineral and each patch, by id. */
  stoneArt: (id: string) => string;
  patchArt: (id: string) => string;
  /** What each is called, for its label. */
  stoneName: (id: string) => string;
  patchName: (id: string) => string;
  /** The stones and patches the player has to set out, by id, in the Book's order. */
  stoneChoices: readonly string[];
  patchChoices: readonly string[];
  /** Who is at the feeder now, by name, if anyone. */
  guest: string | null;
}

/**
 * The cabin's sheet: what is on the shelf and the board, and the feeder. Tapping a place steps
 * it through what the player has; there is nothing to confirm and nothing to get wrong. With
 * more than a few things to choose from, the place last tapped also gets a strip of them all
 * underneath, so that any one can be had in a single tap.
 */
export class CabinSheet {
  private readonly sheet: HTMLElement;
  private readonly shelf: HTMLElement;
  private readonly wall: HTMLElement;
  private readonly shelfNote: HTMLElement;
  private readonly wallNote: HTMLElement;
  private readonly feederNote: HTMLElement;
  private readonly fill: HTMLButtonElement;
  private page: (() => CabinPage) | null = null;
  /** Called when the sheet opens, so other sheets can get out of the way. */
  onOpen: (() => void) | null = null;
  /** A place on the shelf or the board has been tapped. */
  onArrange: ((where: 'shelf' | 'wall', slot: number) => void) | null = null;
  /** Something has been chosen for a place from the strip: an id, or '' to leave it bare. */
  onPlace: ((where: 'shelf' | 'wall', slot: number, id: string) => void) | null = null;
  private readonly shelfStrip: HTMLElement;
  private readonly wallStrip: HTMLElement;
  /** The place last tapped, which the strip of choices is for. */
  private picked: { where: 'shelf' | 'wall'; slot: number } | null = null;
  /** The player wants the feeder filled. */
  onFill: (() => void) | null = null;

  constructor() {
    const app = document.getElementById('app') ?? document.body;
    const el = <K extends keyof HTMLElementTagNameMap>(tag: K, cls = '', text = ''): HTMLElementTagNameMap[K] => {
      const made = document.createElement(tag);
      if (cls) made.className = cls;
      if (text) made.textContent = text;
      return made;
    };
    this.sheet = el('div');
    this.sheet.id = 'cabin-sheet';
    this.sheet.hidden = true;
    const head = el('div', 'head');
    const close = el('button', '', 'Close');
    close.type = 'button';
    close.addEventListener('click', () => this.close());
    head.append(el('h2', '', 'Home'), close);
    this.shelf = el('div', 'places');
    this.wall = el('div', 'places');
    this.shelfNote = el('p', 'note');
    this.wallNote = el('p', 'note');
    this.shelfStrip = el('div', 'choices');
    this.wallStrip = el('div', 'choices');
    this.feederNote = el('p', 'note');
    this.fill = el('button', 'fill', 'Fill the feeder');
    this.fill.type = 'button';
    this.fill.addEventListener('click', () => {
      this.onFill?.();
      this.render();
    });
    const feeder = el('div', 'feeder');
    feeder.append(this.feederNote, this.fill);
    this.sheet.append(head, el('h3', '', 'On the shelf'), this.shelf, this.shelfStrip, this.shelfNote, el('h3', '', 'On the board'), this.wall, this.wallStrip, this.wallNote, el('h3', '', 'The feeder'), feeder);
    app.appendChild(this.sheet);
  }

  get isOpen(): boolean {
    return !this.sheet.hidden;
  }

  open(page: () => CabinPage): void {
    this.onOpen?.();
    this.page = page;
    this.picked = null;
    this.sheet.hidden = false;
    this.render();
  }

  close(): void {
    dropAway(this.sheet);
    this.sheet.hidden = true;
  }

  private render(): void {
    const page = this.page?.();
    if (!page) return;
    const row = (into: HTMLElement, where: 'shelf' | 'wall', ids: readonly string[], art: (id: string) => string, name: (id: string) => string): void => {
      into.replaceChildren();
      ids.forEach((id, slot) => {
        const place = document.createElement('button');
        place.type = 'button';
        place.className = `${id === '' ? 'place bare' : 'place'}${this.picked?.where === where && this.picked.slot === slot ? ' picked' : ''}`;
        place.setAttribute('aria-label', id === '' ? 'A bare place: tap to set something out' : `${name(id)}: tap to change`);
        if (id !== '') {
          const pic = document.createElement('img');
          pic.src = art(id);
          pic.alt = '';
          const label = document.createElement('small');
          label.textContent = name(id);
          place.append(pic, label);
        } else place.textContent = '+';
        place.addEventListener('click', () => {
          this.picked = { where, slot };
          this.onArrange?.(where, slot);
          this.render();
        });
        into.append(place);
      });
    };
    // Everything there is to choose from, for the place last tapped: worth showing once stepping through would be a chore.
    const strip = (into: HTMLElement, where: 'shelf' | 'wall', placed: readonly string[], choices: readonly string[], art: (id: string) => string, name: (id: string) => string): void => {
      into.replaceChildren();
      const slot = this.picked?.where === where ? this.picked.slot : -1;
      into.hidden = slot < 0 || choices.length < 4;
      if (into.hidden) return;
      const choose = (id: string, label: string, pic: string | null): void => {
        const choice = document.createElement('button');
        choice.type = 'button';
        choice.className = `choice${placed[slot] === id ? ' on' : ''}${id !== '' && placed.some((p, i) => p === id && i !== slot) ? ' out' : ''}`;
        choice.setAttribute('aria-label', label);
        if (pic) {
          const img = document.createElement('img');
          img.src = pic;
          img.alt = '';
          choice.append(img);
        } else choice.textContent = '–';
        choice.addEventListener('click', () => {
          this.onPlace?.(where, slot, id);
          this.render();
        });
        into.append(choice);
      };
      choose('', 'Leave it bare', null);
      for (const id of choices) choose(id, name(id), art(id));
    };
    row(this.shelf, 'shelf', page.cabin.shelf, page.stoneArt, page.stoneName);
    row(this.wall, 'wall', page.cabin.wall, page.patchArt, page.patchName);
    strip(this.shelfStrip, 'shelf', page.cabin.shelf, page.stoneChoices, page.stoneArt, page.stoneName);
    strip(this.wallStrip, 'wall', page.cabin.wall, page.patchChoices, page.patchArt, page.patchName);
    this.shelfNote.textContent = page.stoneChoices.length === 0 ? "Nothing to put here yet. Stones glint on the ground - go find one." : 'Tap a place to change what sits there.';
    this.wallNote.textContent = page.patchChoices.length === 0 ? "No patches yet. They're in the Book, with how to earn each." : 'Tap a place to change what hangs there.';
    const full = page.cabin.feeder !== '';
    this.feederNote.textContent = page.guest ? `Look - ${page.guest} at the feeder!` : full ? "It's full. Somebody might come by tomorrow." : "It's empty.";
    this.fill.hidden = full;
  }
}
