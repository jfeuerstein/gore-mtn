import type { Lead } from '../game/today';

/** A lead as the flyer shows it: with whether it has been done since the flyer went up. */
export interface FlyerLead extends Lead {
  done: boolean;
}

/** Everything on the flyer. */
export interface FlyerPage {
  /** "Wednesday · Nov 11". */
  date: string;
  /** The season, and what the sky is doing: "Winter · bluebird". */
  sky: string;
  leads: FlyerLead[];
  /** A line in pencil at the bottom, if there is anything to add: a letter waiting, say. */
  note: string | null;
  /** Where the player's flag is now, to show which lead has it. */
  flagged: { x: number; z: number } | null;
  /** True in the bike months, when the day's trail is a ride and has no snowflake by it. */
  riding?: boolean;
}

/** The mark beside each kind of lead: the trail's own mark is in its title, so it has a ski pole's basket. */
const MARK: Record<Lead['kind'], string> = { trail: '❄', place: '✉', person: '◆', rumour: '◆', project: '▲' };

/**
 * The flyer: a sheet of paper pinned up over the lower part of the screen, the first time the
 * game is opened on a day. It says what the day is like and names three leads; each can have
 * the player's flag planted on it. It is closed with one button, under the thumb.
 */
export class Flyer {
  private readonly sheet: HTMLElement;
  private readonly date: HTMLElement;
  private readonly sky: HTMLElement;
  private readonly list: HTMLElement;
  private readonly note: HTMLElement;
  private page: (() => FlyerPage) | null = null;
  /** Called when the flyer opens, so other sheets can get out of the way. */
  onOpen: (() => void) | null = null;
  /** Called when the player plants their flag on a lead. */
  onFlag: ((lead: Lead) => void) | null = null;

  constructor() {
    const app = document.getElementById('app') ?? document.body;
    const el = <K extends keyof HTMLElementTagNameMap>(tag: K, cls = '', text = ''): HTMLElementTagNameMap[K] => {
      const made = document.createElement(tag);
      if (cls) made.className = cls;
      if (text) made.textContent = text;
      return made;
    };
    this.sheet = el('div');
    this.sheet.id = 'flyer';
    this.sheet.hidden = true;
    const paper = el('div', 'paper');
    paper.append(el('i', 'pin'));
    const head = el('div', 'masthead');
    this.date = el('small');
    this.sky = el('small');
    const line = el('div', 'dateline');
    line.append(this.date, this.sky);
    head.append(el('h2', '', 'Today on the mountain'), line);
    this.list = el('div', 'leads');
    this.note = el('p', 'note');
    const go = el('button', 'go', "Let's go");
    go.type = 'button';
    go.addEventListener('click', () => this.close());
    paper.append(head, this.list, this.note, go);
    this.sheet.append(paper);
    app.appendChild(this.sheet);
  }

  get isOpen(): boolean {
    return !this.sheet.hidden;
  }

  /** Put the flyer up. `page` is asked again whenever something on it may have changed. */
  open(page: () => FlyerPage): void {
    this.onOpen?.();
    this.page = page;
    this.sheet.hidden = false;
    this.render();
  }

  close(): void {
    this.sheet.hidden = true;
  }

  private render(): void {
    const page = this.page?.();
    if (!page) return;
    this.date.textContent = page.date;
    this.sky.textContent = page.sky;
    this.note.textContent = page.note ?? '';
    this.note.hidden = !page.note;
    this.list.replaceChildren();
    if (page.leads.length === 0) {
      const none = document.createElement('p');
      none.className = 'none';
      none.textContent = "Nothing special today.\nGo wherever looks good.";
      this.list.append(none);
    }
    for (const lead of page.leads) {
      const row = document.createElement('div');
      row.className = `lead lead-${lead.kind}${lead.done ? ' done' : ''}`;
      const mark = document.createElement('i');
      mark.textContent = lead.done ? '✓' : lead.kind === 'trail' && page.riding ? '●' : MARK[lead.kind];
      const words = document.createElement('div');
      const head = document.createElement('small');
      head.textContent = lead.head;
      const title = document.createElement('b');
      title.textContent = lead.title;
      const why = document.createElement('span');
      why.textContent = lead.done ? 'Done. Nice.' : lead.why;
      words.append(head, title, why);
      row.append(mark, words);
      if (!lead.done) {
        const here = page.flagged !== null && Math.hypot(page.flagged.x - lead.x, page.flagged.z - lead.z) < 1;
        const flag = document.createElement('button');
        flag.type = 'button';
        flag.className = 'flag';
        flag.textContent = here ? 'Flagged' : 'Flag';
        flag.setAttribute('aria-pressed', String(here));
        flag.setAttribute('aria-label', `Plant your flag: ${lead.flag}`);
        flag.addEventListener('click', () => {
          this.onFlag?.(lead);
          this.render();
        });
        row.append(flag);
      }
      this.list.append(row);
    }
  }
}
