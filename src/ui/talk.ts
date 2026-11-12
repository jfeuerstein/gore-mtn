/** Something written, to be read rather than heard: a letter, a notice. Shown as handwriting on its own paper. */
export interface Written {
  written: string;
  signed?: string;
}

/** A choice offered at the end of what someone says. */
export interface Choice {
  label: string;
  onPick: () => void;
  /** The one a thumb should land on first. */
  primary?: boolean;
  /** Shown but not to be tapped: where the player already is, say. */
  disabled?: boolean;
}

/**
 * What someone says: a small sheet at the bottom of the screen with their name, their words a
 * line at a time, and at the end whatever there is to choose. Talk is always optional: every
 * sheet can be closed, and nothing is lost by closing it.
 */
export class TalkSheet {
  private readonly sheet: HTMLElement;
  private readonly portrait: HTMLImageElement;
  private readonly title: HTMLElement;
  private readonly subtitle: HTMLElement;
  private readonly text: HTMLElement;
  private readonly buttons: HTMLElement;
  private lines: (string | Written)[] = [];
  private at = 0;
  private choices: Choice[] = [];
  private farewell = 'Goodbye';
  /** Called when the sheet opens, so other sheets can get out of the way. */
  onOpen: (() => void) | null = null;

  constructor() {
    const make = <K extends keyof HTMLElementTagNameMap>(tag: K, className: string): HTMLElementTagNameMap[K] => {
      const el = document.createElement(tag);
      el.className = className;
      return el;
    };
    this.sheet = make('div', '');
    this.sheet.id = 'talk-sheet';
    this.sheet.hidden = true;
    const head = make('div', 'head');
    this.portrait = make('img', 'portrait');
    this.portrait.alt = '';
    this.portrait.hidden = true;
    // A picture that cannot be had (no signal, the first time) is simply left out.
    this.portrait.addEventListener('error', () => (this.portrait.hidden = true));
    const names = make('div', 'names');
    this.title = make('b', '');
    this.subtitle = make('small', '');
    names.append(this.title, this.subtitle);
    const close = make('button', 'close');
    close.type = 'button';
    close.textContent = 'Close';
    close.addEventListener('click', () => this.close());
    head.append(this.portrait, names, close);
    this.text = make('p', 'line');
    this.buttons = make('div', 'choices');
    this.sheet.append(head, this.text, this.buttons);
    (document.getElementById('app') ?? document.body).appendChild(this.sheet);
  }

  get isOpen(): boolean {
    return !this.sheet.hidden;
  }

  /**
   * @param lines what is said, shown one at a time
   * @param choices offered after the last line, besides leaving
   * @param portrait the address of a picture of whoever is speaking, if there is one
   */
  /** @param farewell what the button that closes the sheet says when there is nothing to choose: someone is said goodbye to, a notice is not */
  open(title: string, subtitle: string, lines: readonly (string | Written)[], choices: readonly Choice[] = [], portrait: string | null = null, farewell = 'Goodbye'): void {
    this.farewell = farewell;
    this.onOpen?.();
    this.portrait.hidden = portrait === null;
    if (portrait !== null && this.portrait.getAttribute('src') !== portrait) this.portrait.src = portrait;
    this.title.textContent = title;
    this.subtitle.textContent = subtitle;
    this.lines = [...lines];
    this.choices = [...choices];
    this.at = 0;
    this.sheet.hidden = false;
    this.show();
  }

  close(): void {
    this.sheet.hidden = true;
  }

  private show(): void {
    const line = this.lines[this.at] ?? '';
    const written = typeof line !== 'string';
    this.text.className = written ? 'line written' : 'line';
    this.text.textContent = written ? line.written : line;
    if (written && line.signed) {
      const signed = document.createElement('span');
      signed.className = 'signed';
      signed.textContent = line.signed;
      this.text.appendChild(signed);
    }
    this.buttons.replaceChildren();
    const add = (label: string, onTap: () => void, primary = false, disabled = false): void => {
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = label;
      if (primary) b.className = 'primary';
      b.disabled = disabled;
      b.addEventListener('click', onTap);
      this.buttons.appendChild(b);
    };
    if (this.at < this.lines.length - 1) {
      add('Next', () => {
        this.at++;
        this.show();
      }, true);
      return;
    }
    for (const choice of this.choices) {
      add(choice.label, () => {
        this.close();
        choice.onPick();
      }, choice.primary, choice.disabled);
    }
    add(this.choices.length > 0 ? 'Not now' : this.farewell, () => this.close(), this.choices.length === 0);
  }
}
