import { newPatch, sewn } from './motion';
import type { GameEvent } from '../game/game';

/** How long an announcement stays up, in milliseconds (a hint, which has to be read, stays longer), and how many show at once. */
const STAY = 3800;
const HINT_STAY = 7000;
const MOST = 3;

const KIND_MARK: Record<GameEvent['kind'], string> = {
  trail: '✓',
  path: '✓',
  season: '❖',
  sighting: '✦',
  errand: '✉',
  gear: '❉',
  item: '❑',
  patch: '★',
  hint: '☞',
  secret: '✎',
  museum: '◈',
  lift: '⌃',
  peak: '▲',
  landmark: '⌂',
  condition: '☼',
  mineral: '',
};

/**
 * Announcements of things just earned: a short stack near the top of the screen, where they can
 * be read without getting in the thumb's way. Extra ones wait their turn.
 */
export class Toasts {
  private readonly el: HTMLElement;
  private readonly waiting: GameEvent[] = [];
  /** The last thing announced, for checks. */
  last = '';

  /** @param visible false keeps announcements off the screen, for clean screenshots */
  constructor(visible = true) {
    this.el = document.createElement('div');
    this.el.id = 'toasts';
    this.el.hidden = !visible;
    (document.getElementById('app') ?? document.body).appendChild(this.el);
  }

  /** True while announcements are kept back: under the loading card (so from the very start), and while the welcome or the flyer is up. */
  private held = true;

  /** Keep announcements back, or let those that were waiting out. Safe to call every frame. */
  hold(on: boolean): void {
    if (this.held === on) return;
    this.held = on;
    if (!on) this.fill();
  }

  show(event: GameEvent): void {
    this.last = `${event.title} · ${event.detail}`;
    this.waiting.push(event);
    this.fill();
  }

  private fill(): void {
    while (!this.held && this.el.childElementCount < MOST && this.waiting.length > 0) {
      const event = this.waiting.shift() as GameEvent;
      const toast = document.createElement('div');
      toast.className = `toast toast-${event.kind}`;
      let mark: HTMLElement = document.createElement('span');
      mark.className = 'mark';
      if (event.kind === 'mineral') {
        mark.style.backgroundColor = `#${(event.colour ?? 0x888888).toString(16).padStart(6, '0')}`;
        const wrap = document.createElement('span');
        wrap.className = 'gem-wrap';
        wrap.appendChild(mark);
        mark = wrap;
      } else {
        mark.textContent = KIND_MARK[event.kind];
      }
      // What was just had, where there is a picture of it: shown big, the way a found thing is held up.
      if (event.art) {
        const pic = document.createElement('img');
        pic.className = 'pic';
        pic.alt = '';
        pic.src = `${import.meta.env.BASE_URL}art/${event.art}.webp`;
        // No picture after all: fall back to the mark.
        const plain = mark;
        pic.addEventListener('error', () => pic.replaceWith(plain));
        toast.classList.add('toast-pic');
        // A patch had for the first time is sewn on as it is held up.
        mark = newPatch(event) ? sewn(pic) : pic;
      }
      const text = document.createElement('span');
      const title = document.createElement('b');
      title.textContent = event.title;
      const detail = document.createElement('small');
      detail.textContent = event.detail;
      text.append(title, detail);
      toast.append(mark, text);
      this.el.appendChild(toast);
      const stay = event.kind === 'hint' ? HINT_STAY : STAY;
      window.setTimeout(() => toast.classList.add('going'), stay);
      window.setTimeout(() => {
        toast.remove();
        this.fill();
      }, stay + 350);
    }
  }
}
