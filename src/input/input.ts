import { stickVector } from './stick';
import { touchRole } from './zones';

const STICK_RADIUS = 56;

/**
 * Touch, mouse and keyboard input.
 * Touch: one thumb is enough. A touch in the stick zone (see zones.ts) is a movement stick that
 * appears where it lands; a touch elsewhere, or a second finger, drags the camera.
 * Desktop: WASD or arrows to move, Shift to go fast, drag to look.
 */
export class Input {
  moveX = 0;
  moveY = 0;
  fast = false;
  /** Set by the on-screen Fast button. */
  fastToggle = false;
  private lookDX = 0;
  private lookDY = 0;
  private stickId: number | null = null;
  private stickOrigin = { x: 0, y: 0 };
  private touchMove = { x: 0, y: 0 };
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
    document.body.appendChild(this.base);

    surface.addEventListener('pointerdown', this.onDown);
    surface.addEventListener('pointermove', this.onMove);
    surface.addEventListener('pointerup', this.onUp);
    surface.addEventListener('pointercancel', this.onUp);
    surface.addEventListener('contextmenu', (e) => e.preventDefault());
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
  }

  private readonly onDown = (e: PointerEvent): void => {
    e.preventDefault();
    this.surface.setPointerCapture(e.pointerId);
    const role =
      e.pointerType === 'mouse'
        ? 'look'
        : touchRole(e.clientX, e.clientY, window.innerWidth, window.innerHeight, this.stickId !== null);
    if (role === 'stick') {
      this.stickId = e.pointerId;
      this.stickOrigin = { x: e.clientX, y: e.clientY };
      this.base.hidden = false;
      this.base.style.transform = `translate(${e.clientX}px, ${e.clientY}px)`;
      this.knob.style.transform = 'translate(-50%, -50%)';
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
      this.knob.style.transform = `translate(calc(-50% + ${dx * clamp}px), calc(-50% + ${dy * clamp}px))`;
      return;
    }
    const last = this.looks.get(e.pointerId);
    if (last) {
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
