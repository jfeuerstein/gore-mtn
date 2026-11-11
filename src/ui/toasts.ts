import type { GameEvent } from '../game/game';

/** How long an announcement stays up, in milliseconds, and how many show at once. */
const STAY = 3800;
const MOST = 3;

const KIND_MARK: Record<GameEvent['kind'], string> = {
  trail: '✓',
  path: '✓',
  season: '❖',
  sighting: '✦',
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

  show(event: GameEvent): void {
    this.last = `${event.title} · ${event.detail}`;
    this.waiting.push(event);
    this.fill();
  }

  private fill(): void {
    while (this.el.childElementCount < MOST && this.waiting.length > 0) {
      const event = this.waiting.shift() as GameEvent;
      const toast = document.createElement('div');
      toast.className = `toast toast-${event.kind}`;
      let mark = document.createElement('span');
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
      const text = document.createElement('span');
      const title = document.createElement('b');
      title.textContent = event.title;
      const detail = document.createElement('small');
      detail.textContent = event.detail;
      text.append(title, detail);
      toast.append(mark, text);
      this.el.appendChild(toast);
      window.setTimeout(() => toast.classList.add('going'), STAY);
      window.setTimeout(() => {
        toast.remove();
        this.fill();
      }, STAY + 350);
    }
  }
}
