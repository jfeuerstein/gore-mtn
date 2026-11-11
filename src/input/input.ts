import { stickVector } from './stick';
import { touchRole } from './zones';

const STICK_RADIUS = 56;

/**
 * Touch, mouse and keyboard input.
 * Touch: one thumb is enough. A touch in the stick zone (see zones.ts) is a movement stick that
 * appears where it lands; a touch elsewhere, or a second finger, drags the camera. Two fingers
 * off the stick pinch the camera nearer or further: a convenience, never a need.
 * Desktop: WASD or arrows to move, Shift to go fast, drag to look, wheel for distance.
 */
export class Input {
  moveX = 0;
  moveY = 0;
  fast = false;
  /** Set by the on-screen Fast button. */
  fastToggle = false;
  private lookDX = 0;
  private lookDY = 0;
  /** How the camera's distance should change for the pinching done since it was last asked for: 1 is no change. */
  private pinch = 1;
  private stickId: number | null = null;
  private stickOrigin = { x: 0, y: 0 };
  private touchMove = { x: 0, y: 0 };
  /** Knob offset waiting to be drawn, or null when it is up to date. */
  private knobPending: { x: number; y: number } | null = null;
  private readonly looks = new Map<number, { x: number; y: number }>();
  private readonly keys = new Set<string>();
  private readonly base: HTMLElement;
  private readonly knob: HTMLElement;

  constructor(private readonly surface: HTMLElement) {
    this.base = document.createElement('div');
    this.base.className = 'stick-base';
    this.knob = document.createElement('div');
    this.knob.className = 'stick-knob';
    this.base.appendChild(this.knob);
    this.base.hidden = true;
    (surface.parentElement ?? document.body).appendChild(this.base);

    surface.addEventListener('pointerdown', this.onDown);
    surface.addEventListener('pointermove', this.onMove);
    surface.addEventListener('pointerup', this.onUp);
    surface.addEventListener('pointercancel', this.onUp);
    surface.addEventListener('contextmenu', (e) => e.preventDefault());
    surface.addEventListener(
      'wheel',
      (e) => {
        e.preventDefault();
        this.pinch *= e.deltaY > 0 ? 1.08 : 1 / 1.08;
      },
      { passive: false },
    );
    // Safari's own pinch and rotate gestures would otherwise zoom the page.
    for (const type of ['gesturestart', 'gesturechange', 'gestureend']) {
      document.addEventListener(type, (e) => e.preventDefault());
    }
    window.addEventListener('keydown', (e) => this.keys.add(e.code));
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('blur', () => this.keys.clear());
  }

  /** Camera drag since the last call, in CSS pixels. */
  consumeLook(): { dx: number; dy: number } {
    const out = { dx: this.lookDX, dy: this.lookDY };
    this.lookDX = 0;
    this.lookDY = 0;
    return out;
  }

  /**
   * Pinching since the last call, as a factor for the camera's distance: fingers moving apart
   * bring it nearer (less than 1), fingers closing send it back. A mouse wheel does the same.
   */
  consumePinch(): number {
    const out = this.pinch;
    this.pinch = 1;
    return out;
  }

  /** How far apart the two fingers that are turning the camera are, or 0 if there are not two. */
  private spread(): number {
    if (this.looks.size < 2) return 0;
    const [a, b] = [...this.looks.values()] as [{ x: number; y: number }, { x: number; y: number }];
    return Math.hypot(a.x - b.x, a.y - b.y);
  }

  /** Refresh `moveX`, `moveY` and `fast` from the current keys and touches. Call once per frame. */
  update(): void {
    const k = this.keys;
    const kx = (k.has('KeyD') || k.has('ArrowRight') ? 1 : 0) - (k.has('KeyA') || k.has('ArrowLeft') ? 1 : 0);
    const ky = (k.has('KeyW') || k.has('ArrowUp') ? 1 : 0) - (k.has('KeyS') || k.has('ArrowDown') ? 1 : 0);
    if (kx !== 0 || ky !== 0) {
      const len = Math.hypot(kx, ky);
      this.moveX = kx / len;
      this.moveY = ky / len;
    } else {
      this.moveX = this.touchMove.x;
      this.moveY = this.touchMove.y;
    }
    this.fast = k.has('ShiftLeft') || k.has('ShiftRight') || this.fastToggle;
    if (this.knobPending) {
      const { x, y } = this.knobPending;
      this.knob.style.transform = `translate(calc(-50% + ${x}px), calc(-50% + ${y}px))`;
      this.knobPending = null;
    }
  }

  private readonly onDown = (e: PointerEvent): void => {
    e.preventDefault();
    try {
      this.surface.setPointerCapture(e.pointerId);
    } catch {
      // Not a pointer the browser will hold: it is followed while it stays on the picture.
    }
    const role =
      e.pointerType === 'mouse'
        ? 'look'
        : touchRole(e.clientX, e.clientY, this.surface.clientWidth, this.surface.clientHeight, this.stickId !== null);
    if (role === 'stick') {
      this.stickId = e.pointerId;
      this.stickOrigin = { x: e.clientX, y: e.clientY };
      this.base.hidden = false;
      this.base.style.transform = `translate(${e.clientX}px, ${e.clientY}px)`;
      this.knob.style.transform = 'translate(-50%, -50%)';
      this.knobPending = null;
    } else {
      this.looks.set(e.pointerId, { x: e.clientX, y: e.clientY });
    }
  };

  private readonly onMove = (e: PointerEvent): void => {
    if (e.pointerId === this.stickId) {
      const dx = e.clientX - this.stickOrigin.x;
      const dy = e.clientY - this.stickOrigin.y;
      this.touchMove = stickVector(dx, dy, STICK_RADIUS);
      const len = Math.hypot(dx, dy);
      const clamp = len > STICK_RADIUS ? STICK_RADIUS / len : 1;
      // Touch events can arrive faster than frames are drawn. Remember the latest position and
      // let update() write it, so the page is restyled at most once per frame.
      this.knobPending = { x: dx * clamp, y: dy * clamp };
      return;
    }
    const last = this.looks.get(e.pointerId);
    if (last) {
      // Two fingers off the stick are a pinch: they set the camera's distance and do not turn it.
      const before = this.spread();
      if (before > 0) {
        last.x = e.clientX;
        last.y = e.clientY;
        const now = this.spread();
        if (before > 8 && now > 8) this.pinch *= before / now;
        return;
      }
      this.lookDX += e.clientX - last.x;
      this.lookDY += e.clientY - last.y;
      last.x = e.clientX;
      last.y = e.clientY;
    }
  };

  private readonly onUp = (e: PointerEvent): void => {
    if (e.pointerId === this.stickId) {
      this.stickId = null;
      this.touchMove = { x: 0, y: 0 };
      this.base.hidden = true;
    }
    this.looks.delete(e.pointerId);
  };
}
