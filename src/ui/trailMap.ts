import type { LiftPath } from '../world/lifts';
import { DIFFICULTY_MARK, distToPolyline, type Difficulty, type Trail } from '../world/trails';
import type { World } from '../world/world';
import { boundsOf, clampCamera, lookAt, MAX_ZOOM, panBy, wholeMap, zoomAbout, type Bounds, type MapCamera, type MapView } from './mapView';

const TRAIL_COLOUR: Record<Difficulty, string> = {
  easy: '#2f9e55',
  intermediate: '#2b62c9',
  advanced: '#16181d',
  expert: '#16181d',
  freeride: '#d9822b',
};
const LIFT_COLOUR = '#c2412d';
const PATH_COLOUR = '#f4e4b8';
const INK = '#1f2a3a';
const PAPER = '#f7f1e3';
const GOLD = '#ffb02e';
const FLAG = '#c8402d';
/** What something already in the book is drawn in, when the map is showing what is left to do. */
const DONE = 'rgba(247, 241, 227, 0.55)';

/** The kinds of thing marked on the map with a sign of their own. */
export type PointKind = 'lodge' | 'summit' | 'landmark' | 'bench' | 'place' | 'person';

/** Something marked on the map. */
export interface MapPoint {
  kind: PointKind;
  x: number;
  z: number;
  /** Its name, as the caption gives it when it is tapped. */
  label: string;
  /** For things that go in the book: whether this one is in it yet. Left out for things that do not. */
  done?: boolean;
  /** A few more words for the caption: "sat on Nov 8", "not visited yet". */
  note?: string;
}

/** The player's own mark: a flag planted somewhere, to be found again. */
export interface MapFlag {
  x: number;
  z: number;
  label: string;
}

/** What the book says of a trail, a path or a lift. */
export interface MapProgress {
  done: boolean;
  /** "stamped Nov 8", "7 of 12 checkpoints", "not ridden yet". */
  note: string;
}

/** The layers that can be shown or hidden, each with its chip under the map. */
type Layer = 'trails' | 'lifts' | 'paths' | 'places' | 'people';
const LAYERS: readonly { id: Layer; label: string; marks: readonly (readonly [string, string])[] }[] = [
  {
    id: 'trails',
    label: 'Trails',
    marks: [
      [TRAIL_COLOUR.easy, '●'],
      [TRAIL_COLOUR.intermediate, '■'],
      [TRAIL_COLOUR.advanced, '◆'],
    ],
  },
  { id: 'lifts', label: 'Lifts', marks: [[LIFT_COLOUR, '—']] },
  { id: 'paths', label: 'Paths', marks: [['#8a6a3c', '⋯']] },
  { id: 'places', label: 'Places', marks: [[INK, '▪']] },
  { id: 'people', label: 'People', marks: [['#b9770e', '◆']] },
];

/** Which kinds of point belong to which layer. */
const LAYER_OF: Record<PointKind, Layer> = { lodge: 'places', summit: 'places', landmark: 'places', bench: 'places', place: 'places', person: 'people' };
/** How far in the map must be before each kind of point is drawn, and before its name is written beside it. */
const SHOWN_FROM: Record<PointKind, number> = { lodge: 1, summit: 1, landmark: 1.6, bench: 2.4, place: 1, person: 1 };
// A bench is never named on the map itself: there are many, and its name is a sentence. Tap it.
const NAMED_FROM: Record<PointKind, number> = { lodge: 1, summit: 2, landmark: 3.4, bench: Infinity, place: 5, person: 3.4 };
/** How far in before trails and lifts have their names written along them. */
const LINES_NAMED_FROM = 2.6;
/** How far in before the close picture of the ground takes over from the far one. */
const DETAIL_FROM = 2.2;

/** How close a tap must land to something to pick it, in screen points. */
const TAP_REACH = 16;
/** A finger that moves less than this has tapped, not dragged, in screen points. */
const DRAG_SLOP = 7;
/** Two taps this close together, in milliseconds and screen points, are a double tap. */
const DOUBLE_TAP_MS = 320;
const DOUBLE_TAP_REACH = 28;
/** Room left round the mountain at zoom 1, in metres. */
const MARGIN = 120;

interface Picked {
  trail?: Trail;
  lift?: LiftPath;
  path?: string;
  point?: MapPoint;
  flag?: boolean;
  /** A bare spot on the map, where a flag could be planted. */
  spot?: { x: number; z: number };
}

/**
 * The trail map: a sheet that slides over the lower part of the screen, with the summit at the
 * top. It is a window on the mountain that can be dragged about and zoomed (by the buttons, by
 * a double tap, or by a pinch); what is marked on it and named grows as it goes in. Tap
 * anything for its name and where it stands in the book. A flag can be planted anywhere.
 */
export class TrailMap {
  private readonly sheet: HTMLElement;
  private readonly canvas: HTMLCanvasElement;
  private readonly caption: HTMLElement;
  private readonly flagButton: HTMLButtonElement;
  private readonly chips = new Map<Layer | 'todo', HTMLButtonElement>();
  /** What the map is fitted to at zoom 1 (the trails and lifts), and how far it can be slid (the whole of the world). */
  private readonly bounds: Bounds;
  private readonly reach: Bounds;
  private camera: MapCamera;
  private view: MapView | null = null;
  private timer = 0;
  private frame = 0;
  private picked: Picked | null = null;
  private readonly hidden = new Set<Layer>();
  /** When on, what is already in the book is drawn faint, so that what is left stands out. */
  private todo = false;
  /** Fingers on the map, by pointer id, where each is now. */
  private readonly fingers = new Map<number, { u: number; v: number }>();
  private press: { u: number; v: number; moved: boolean } | null = null;
  private lastTap: { u: number; v: number; at: number } | null = null;
  /** The spread and middle of two fingers when last looked at, for a pinch. */
  private pinch: { spread: number; u: number; v: number } | null = null;

  /** Everything marked with a sign of its own. Asked for each time the map is drawn. */
  points: () => MapPoint[] = () => [];
  /** What the book says of a trail, path or lift, by name. */
  progress: (kind: 'trail' | 'path' | 'lift', name: string) => MapProgress | null = () => null;
  /** The player's flag, if one is planted. */
  flag: MapFlag | null = null;
  /** Called when the player plants a flag or takes it up. */
  onFlag: ((flag: MapFlag | null) => void) | null = null;
  /** Called when the map opens, so other sheets can get out of the way. */
  onOpen: (() => void) | null = null;
  /** Called by the Today button: the day's flyer, to be looked at again. */
  onToday: (() => void) | null = null;

  /**
   * @param backdrop the pipeline's picture of the whole mountain from afar, north up
   * @param where the player's position and the way they face
   * @param detail the pipeline's close picture of the ground, drawn once the map is well in
   */
  constructor(
    private readonly world: World,
    private readonly lifts: readonly LiftPath[],
    private readonly backdrop: CanvasImageSource,
    private readonly where: () => { x: number; z: number; yaw: number },
    private readonly detail: CanvasImageSource | null = null,
  ) {
    this.bounds = boundsOf([...world.trails.map((t) => t.pts), ...world.lifts.map((l) => l.pts), world.places.flatMap((p) => [p.x, p.z])]);
    const land = world.source;
    this.reach = { minX: land.minX, maxX: land.maxX, minZ: land.minZ, maxZ: land.maxZ };
    this.camera = wholeMap(this.bounds);

    const app = document.getElementById('app') ?? document.body;
    const el = <K extends keyof HTMLElementTagNameMap>(tag: K, cls = '', text = ''): HTMLElementTagNameMap[K] => {
      const made = document.createElement(tag);
      if (cls) made.className = cls;
      if (text) made.textContent = text;
      return made;
    };
    const button = (text: string, label: string, onClick: () => void): HTMLButtonElement => {
      const made = el('button', '', text);
      made.type = 'button';
      made.setAttribute('aria-label', label);
      made.addEventListener('click', onClick);
      return made;
    };
    this.sheet = el('div');
    this.sheet.id = 'map-sheet';
    this.sheet.hidden = true;
    const head = el('div', 'head');
    const today = button('Today', "Look at today's flyer again", () => this.onToday?.());
    today.className = 'today';
    head.append(el('h2', '', 'Trail map'), today, button('Close', 'Close the map', () => this.close()));

    // The map itself, with its buttons down its right-hand edge, where a thumb is.
    const frame = el('div', 'frame');
    this.canvas = el('canvas');
    const tools = el('div', 'tools');
    tools.append(
      button('+', 'Zoom in', () => this.zoomBy(1.7)),
      button('−', 'Zoom out', () => this.zoomBy(1 / 1.7)),
      button('Me', 'Go to where I am', () => this.goTo(this.where(), Math.max(this.camera.zoom, 4))),
      button('All', 'Show the whole mountain', () => this.goTo(wholeMap(this.bounds), 1)),
    );
    frame.append(this.canvas, tools);

    // What was tapped, and the flag.
    const told = el('div', 'told');
    this.caption = el('p', 'caption');
    this.flagButton = button('Flag', 'Plant a flag here', () => this.plant());
    this.flagButton.className = 'flag';
    this.flagButton.hidden = true;
    told.append(this.caption, this.flagButton);

    // The legend is the row of chips: each shows its mark, and hides or shows what it marks.
    const legend = el('div', 'legend');
    for (const layer of LAYERS) {
      const chip = button('', `Show or hide ${layer.label.toLowerCase()}`, () => {
        if (this.hidden.has(layer.id)) this.hidden.delete(layer.id);
        else this.hidden.add(layer.id);
        this.refresh();
      });
      for (const [colour, mark] of layer.marks) {
        const dot = el('i', '', mark);
        dot.style.color = colour;
        chip.append(dot);
      }
      chip.append(layer.label);
      this.chips.set(layer.id, chip);
      legend.append(chip);
    }
    const left = button('To do', 'Show what is left to do', () => {
      this.todo = !this.todo;
      this.refresh();
    });
    this.chips.set('todo', left);
    legend.append(left);

    this.sheet.append(head, frame, told, legend);
    app.appendChild(this.sheet);

    this.canvas.addEventListener('pointerdown', (e) => this.down(e));
    this.canvas.addEventListener('pointermove', (e) => this.move(e));
    this.canvas.addEventListener('pointerup', (e) => this.up(e));
    this.canvas.addEventListener('pointercancel', (e) => this.up(e, true));
    // A mouse wheel, for trying it at a desk.
    this.canvas.addEventListener(
      'wheel',
      (e) => {
        e.preventDefault();
        const at = this.pointOf(e);
        this.set(zoomAbout(this.bounds, this.width, this.height, this.camera, at.u, at.v, e.deltaY < 0 ? 1.25 : 0.8, MARGIN, this.reach));
      },
      { passive: false },
    );
    document.getElementById('map-button')?.addEventListener('click', () => (this.sheet.hidden ? this.open() : this.close()));
  }

  /** Where the map is looking, for the tools. */
  get looking(): MapCamera {
    return { ...this.camera };
  }

  open(): void {
    this.onOpen?.();
    this.sheet.hidden = false;
    this.pick(null);
    this.refresh();
    // Keep the "you are here" mark current while the map is up.
    this.timer = window.setInterval(() => this.draw(), 500);
  }

  close(): void {
    this.sheet.hidden = true;
    window.clearInterval(this.timer);
    this.fingers.clear();
    this.press = null;
    this.pinch = null;
  }

  /** The size of the window on the map, in screen points: as wide as the sheet, and as tall as leaves room for the rest of it. */
  private get width(): number {
    return Math.max(200, this.sheet.clientWidth - 28);
  }
  private get height(): number {
    const tall = this.sheet.parentElement?.clientHeight ?? 800;
    // Taller than wide, as the mountain is; never so tall that the chips fall off the bottom of a short screen.
    return Math.max(this.width + 30, Math.min(tall * 0.5, tall - 330));
  }

  private set(camera: MapCamera): void {
    this.camera = camera;
    this.later();
  }

  /** Draw at the next frame: a finger moves many times between frames. */
  private later(): void {
    if (this.frame) return;
    this.frame = requestAnimationFrame(() => {
      this.frame = 0;
      this.draw();
    });
  }

  private refresh(): void {
    for (const [id, chip] of this.chips) chip.setAttribute('aria-pressed', String(id === 'todo' ? this.todo : !this.hidden.has(id)));
    this.draw();
  }

  private zoomBy(factor: number): void {
    this.set(zoomAbout(this.bounds, this.width, this.height, this.camera, this.width / 2, this.height / 2, factor, MARGIN, this.reach));
  }

  private goTo(at: { x: number; z: number }, zoom: number): void {
    this.set(clampCamera(this.bounds, this.width, this.height, { zoom, x: at.x, z: at.z }, MARGIN, this.reach));
  }

  // --- Fingers ----------------------------------------------------------------------------------

  private pointOf(e: { clientX: number; clientY: number }): { u: number; v: number } {
    const box = this.canvas.getBoundingClientRect();
    return { u: e.clientX - box.left, v: e.clientY - box.top };
  }

  private down(e: PointerEvent): void {
    const at = this.pointOf(e);
    // A first finger starts afresh: one whose lifting was never heard of must not be left on the map.
    if (e.isPrimary) this.fingers.clear();
    this.fingers.set(e.pointerId, at);
    try {
      // So that a drag which runs off the edge of the map is still followed.
      this.canvas.setPointerCapture(e.pointerId);
    } catch {
      // Not a pointer the browser will hold: the drag ends at the edge, that is all.
    }
    if (this.fingers.size === 1) this.press = { ...at, moved: false };
    else {
      // A second finger: this is a pinch, and no longer a tap.
      if (this.press) this.press.moved = true;
      this.pinch = this.spread();
    }
  }

  private move(e: PointerEvent): void {
    const was = this.fingers.get(e.pointerId);
    if (!was) return;
    const at = this.pointOf(e);
    this.fingers.set(e.pointerId, at);
    if (this.fingers.size >= 2) {
      const now = this.spread();
      const before = this.pinch;
      this.pinch = now;
      if (!now || !before || before.spread < 1) return;
      // The spot between the fingers stays between them, and the map grows as they part.
      let camera = panBy(this.bounds, this.width, this.height, this.camera, now.u - before.u, now.v - before.v, MARGIN, this.reach);
      camera = zoomAbout(this.bounds, this.width, this.height, camera, now.u, now.v, now.spread / before.spread, MARGIN, this.reach);
      this.set(camera);
      return;
    }
    const press = this.press;
    if (!press) return;
    if (!press.moved && Math.hypot(at.u - press.u, at.v - press.v) < DRAG_SLOP) return;
    press.moved = true;
    this.set(panBy(this.bounds, this.width, this.height, this.camera, at.u - was.u, at.v - was.v, MARGIN, this.reach));
  }

  private up(e: PointerEvent, cancelled = false): void {
    if (!this.fingers.delete(e.pointerId)) return;
    this.pinch = this.fingers.size >= 2 ? this.spread() : null;
    if (this.fingers.size > 0) return;
    const press = this.press;
    this.press = null;
    if (!press || press.moved || cancelled) return;
    const now = performance.now();
    const last = this.lastTap;
    if (last && now - last.at < DOUBLE_TAP_MS && Math.hypot(last.u - press.u, last.v - press.v) < DOUBLE_TAP_REACH) {
      // A double tap goes in on the spot; at the limit, it goes back out to the whole mountain.
      this.lastTap = null;
      if (this.camera.zoom >= MAX_ZOOM - 0.01) this.goTo(wholeMap(this.bounds), 1);
      else this.set(zoomAbout(this.bounds, this.width, this.height, this.camera, press.u, press.v, 2, MARGIN, this.reach));
      return;
    }
    this.lastTap = { ...press, at: now };
    this.tap(press.u, press.v);
  }

  private spread(): { spread: number; u: number; v: number } | null {
    const [a, b] = [...this.fingers.values()];
    if (!a || !b) return null;
    return { spread: Math.hypot(a.u - b.u, a.v - b.v), u: (a.u + b.u) / 2, v: (a.v + b.v) / 2 };
  }

  // --- Drawing ----------------------------------------------------------------------------------

  private shows(kind: PointKind): boolean {
    return !this.hidden.has(LAYER_OF[kind]) && this.camera.zoom >= SHOWN_FROM[kind];
  }

  private draw(): void {
    if (this.sheet.hidden) return;
    const { world } = this;
    const width = this.width;
    const height = this.height;
    this.camera = clampCamera(this.bounds, width, height, this.camera, MARGIN, this.reach);
    const view = lookAt(this.bounds, width, height, this.camera, MARGIN);
    this.view = view;
    const zoom = this.camera.zoom;
    const ratio = Math.min(3, window.devicePixelRatio || 1);
    if (this.canvas.width !== Math.round(width * ratio) || this.canvas.height !== Math.round(height * ratio)) {
      this.canvas.style.width = `${width}px`;
      this.canvas.style.height = `${height}px`;
      this.canvas.width = Math.round(width * ratio);
      this.canvas.height = Math.round(height * ratio);
    }
    const ctx = this.canvas.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    ctx.fillStyle = '#5a6f74';
    ctx.fillRect(0, 0, width, height);

    // Backdrop: the picture of the land, turned so that west is up. One of its pixels covers a
    // block of the world; work out where its corners land and let the canvas do the rest. Well
    // in, the close picture of the ground is sharper than the far one.
    const src = world.source;
    const picture = this.detail && zoom >= DETAIL_FROM ? this.detail : this.backdrop;
    const image = picture as { width: number; height: number };
    const perPixelX = (src.cols * src.cell) / image.width;
    const perPixelZ = (src.rows * src.cell) / image.height;
    const origin = view.toMap(src.originX - src.cell / 2, src.originZ - src.cell / 2);
    ctx.save();
    ctx.transform(0, perPixelX * view.scale, -perPixelZ * view.scale, 0, origin.u, origin.v);
    ctx.drawImage(picture, 0, 0);
    ctx.restore();

    // Lines thicken a little as the map goes in, but far less than the map grows.
    const thick = 1 + 0.35 * Math.log2(zoom);
    const trace = (pts: readonly number[]): void => {
      ctx.beginPath();
      for (let i = 0; i + 1 < pts.length; i += 2) {
        const p = view.toMap(pts[i] as number, pts[i + 1] as number);
        if (i === 0) ctx.moveTo(p.u, p.v);
        else ctx.lineTo(p.u, p.v);
      }
    };
    const faint = (kind: 'trail' | 'path' | 'lift', name: string | null | undefined): boolean => this.todo && !!name && this.progress(kind, name)?.done === true;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';

    // Paths through the woods: dotted, under everything else.
    if (!this.hidden.has('paths')) {
      for (const path of world.paths) {
        trace(path.pts);
        ctx.setLineDash([2, 3]);
        ctx.strokeStyle = faint('path', path.name) ? DONE : PATH_COLOUR;
        ctx.lineWidth = (this.picked?.path === path.name ? 3 : 1.3) * thick;
        ctx.stroke();
      }
      ctx.setLineDash([]);
    }

    // Trails, easiest first so the harder ones sit on top where they cross.
    if (!this.hidden.has('trails')) {
      const order: Difficulty[] = ['easy', 'freeride', 'intermediate', 'advanced', 'expert'];
      for (const difficulty of order) {
        for (const trail of world.trails) {
          if (trail.difficulty !== difficulty || trail.area) continue;
          trace(trail.pts);
          ctx.setLineDash(trail.glade ? [3, 3] : []);
          ctx.strokeStyle = faint('trail', trail.name) ? DONE : TRAIL_COLOUR[difficulty];
          ctx.lineWidth = (this.picked?.trail?.name === trail.name ? 4 : 1.8) * thick;
          ctx.stroke();
        }
      }
      ctx.setLineDash([]);
    }

    // Lifts: a straight line with a ring at the bottom station, where you board.
    if (!this.hidden.has('lifts')) {
      for (const path of this.lifts) {
        const done = faint('lift', path.lift.name);
        trace(path.lift.pts);
        ctx.strokeStyle = done ? DONE : LIFT_COLOUR;
        ctx.lineWidth = (this.picked?.lift === path ? 4 : 2) * thick;
        ctx.stroke();
        const foot = view.toMap(path.points[0] as number, path.points[2] as number);
        ctx.beginPath();
        ctx.arc(foot.u, foot.v, 3.2 * thick, 0, Math.PI * 2);
        ctx.fillStyle = '#fff';
        ctx.fill();
        ctx.lineWidth = 1.6;
        ctx.stroke();
      }
    }

    // Names: written once the map is far enough in, and never one over another.
    const taken: { l: number; t: number; r: number; b: number }[] = [];
    const free = (l: number, t: number, r: number, b: number): boolean => {
      if (r < 0 || l > width || b < 0 || t > height) return false;
      if (taken.some((k) => l < k.r && r > k.l && t < k.b && b > k.t)) return false;
      taken.push({ l, t, r, b });
      return true;
    };
    const write = (text: string, u: number, v: number, colour: string, align: CanvasTextAlign = 'left'): void => {
      ctx.textAlign = align;
      ctx.lineWidth = 3;
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.92)';
      ctx.strokeText(text, u, v);
      ctx.fillStyle = colour;
      ctx.fillText(text, u, v);
    };
    ctx.textBaseline = 'middle';

    // Points, the least of them first, so that a lodge sits over a bench and a person over both.
    const points = this.points().filter((p) => this.shows(p.kind));
    const rank: PointKind[] = ['place', 'bench', 'landmark', 'summit', 'lodge', 'person'];
    points.sort((a, b) => rank.indexOf(a.kind) - rank.indexOf(b.kind));
    for (const point of points) {
      const p = view.toMap(point.x, point.z);
      if (p.u < -12 || p.u > width + 12 || p.v < -12 || p.v > height + 12) continue;
      this.sign(ctx, point, p.u, p.v, this.picked?.point?.label === point.label && this.picked.point.kind === point.kind);
    }

    // The names of points, the weightiest first, so that they get the room.
    ctx.font = '600 11px ui-rounded, system-ui, sans-serif';
    for (const point of [...points].reverse()) {
      if (zoom < NAMED_FROM[point.kind]) continue;
      const p = view.toMap(point.x, point.z);
      const text = point.kind === 'person' ? (point.label.split(' · ')[0] as string) : point.label;
      const wide = ctx.measureText(text).width;
      // Kept inside the edge, which is rounded off at the corners and has the buttons down its right.
      const left = p.u + wide + 64 > width;
      const at = left ? p.u - 8 : p.u + 8;
      if (!free(left ? at - wide : at, p.v - 7, left ? at : at + wide, p.v + 7)) continue;
      write(text, at, p.v, INK, left ? 'right' : 'left');
    }

    // The names of trails and lifts, each at the middle of its line.
    if (zoom >= LINES_NAMED_FROM) {
      ctx.font = '700 10px ui-rounded, system-ui, sans-serif';
      const name = (text: string, pts: readonly number[], colour: string): void => {
        const mid = Math.floor(pts.length / 4) * 2;
        const p = view.toMap(pts[mid] as number, pts[mid + 1] as number);
        const wide = ctx.measureText(text).width;
        if (!free(p.u - wide / 2 - 2, p.v - 7, p.u + wide / 2 + 2, p.v + 7)) return;
        write(text, p.u, p.v, colour, 'center');
      };
      if (!this.hidden.has('lifts')) for (const path of this.lifts) if (path.lift.name) name(path.lift.name, path.lift.pts, LIFT_COLOUR);
      if (!this.hidden.has('trails')) {
        const seen = new Set<string>();
        for (const trail of world.trails) {
          if (!trail.name || trail.area || seen.has(trail.name)) continue;
          seen.add(trail.name);
          name(trail.name, trail.pts, TRAIL_COLOUR[trail.difficulty]);
        }
      }
    }

    // A bare spot that has been tapped: a small cross, where a flag would go.
    const spot = this.picked?.spot;
    if (spot) {
      const p = view.toMap(spot.x, spot.z);
      ctx.strokeStyle = INK;
      ctx.lineWidth = 3.4;
      for (const colour of ['#fff', INK]) {
        ctx.strokeStyle = colour;
        ctx.beginPath();
        ctx.moveTo(p.u - 6, p.v);
        ctx.lineTo(p.u + 6, p.v);
        ctx.moveTo(p.u, p.v - 6);
        ctx.lineTo(p.u, p.v + 6);
        ctx.stroke();
        ctx.lineWidth = 1.6;
      }
    }

    // The player's flag: a pennant on a pole, its foot on the spot.
    if (this.flag) {
      const p = view.toMap(this.flag.x, this.flag.z);
      ctx.strokeStyle = INK;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(p.u, p.v);
      ctx.lineTo(p.u, p.v - 17);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(p.u, p.v - 17);
      ctx.lineTo(p.u + 11, p.v - 13);
      ctx.lineTo(p.u, p.v - 9);
      ctx.closePath();
      ctx.fillStyle = FLAG;
      ctx.lineWidth = 1.3;
      ctx.fill();
      ctx.stroke();
    }

    // You are here: an arrowhead pointing the way the player faces.
    const you = this.where();
    const here = view.toMap(you.x, you.z);
    ctx.save();
    ctx.translate(here.u, here.v);
    ctx.rotate(view.toMapAngle(you.yaw));
    ctx.beginPath();
    ctx.moveTo(0, -8);
    ctx.lineTo(5.5, 6);
    ctx.lineTo(0, 3);
    ctx.lineTo(-5.5, 6);
    ctx.closePath();
    ctx.fillStyle = '#ffd23f';
    ctx.strokeStyle = INK;
    ctx.lineWidth = 1.6;
    ctx.fill();
    ctx.stroke();
    ctx.restore();

    // A scale bar, bottom left: a round number of feet, however far in the map is.
    const feet = [100, 200, 500, 1000, 2000, 5000].find((f) => (f / 3.28084) * view.scale >= 44) ?? 5000;
    const long = (feet / 3.28084) * view.scale;
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 4.5;
    for (const colour of ['#fff', INK]) {
      ctx.strokeStyle = colour;
      ctx.beginPath();
      ctx.moveTo(10, height - 15);
      ctx.lineTo(10, height - 10);
      ctx.lineTo(10 + long, height - 10);
      ctx.lineTo(10 + long, height - 15);
      ctx.stroke();
      ctx.lineWidth = 1.8;
    }
    ctx.font = '700 10px ui-rounded, system-ui, sans-serif';
    write(feet >= 5000 ? '1 mi' : `${feet.toLocaleString('en-US')} ft`, 10, height - 23, INK);
  }

  /** The sign for one kind of point, drawn at a spot. What is in the book is filled in; what is not is hollow. */
  private sign(ctx: CanvasRenderingContext2D, point: MapPoint, u: number, v: number, picked: boolean): void {
    const big = picked ? 1.45 : 1;
    const done = point.done !== false;
    // With "to do" on, what is already in the book steps back.
    ctx.globalAlpha = this.todo && point.done === true ? 0.4 : 1;
    ctx.strokeStyle = INK;
    ctx.lineWidth = 1.3;
    ctx.beginPath();
    switch (point.kind) {
      case 'lodge': {
        // A little house.
        const s = 5 * big;
        ctx.moveTo(u, v - s * 1.25);
        ctx.lineTo(u + s, v - s * 0.2);
        ctx.lineTo(u + s, v + s * 0.85);
        ctx.lineTo(u - s, v + s * 0.85);
        ctx.lineTo(u - s, v - s * 0.2);
        ctx.closePath();
        ctx.fillStyle = INK;
        ctx.strokeStyle = '#fff';
        break;
      }
      case 'summit': {
        // A peak.
        const s = 6 * big;
        ctx.moveTo(u, v - s);
        ctx.lineTo(u + s * 0.95, v + s * 0.7);
        ctx.lineTo(u - s * 0.95, v + s * 0.7);
        ctx.closePath();
        ctx.fillStyle = done ? '#2f6b4f' : PAPER;
        break;
      }
      case 'landmark': {
        // A postcard's stamp: a small ring.
        ctx.arc(u, v, 3.6 * big, 0, Math.PI * 2);
        ctx.fillStyle = done ? '#2b62c9' : PAPER;
        break;
      }
      case 'bench': {
        // A seat, seen from above.
        const s = 3.6 * big;
        ctx.rect(u - s, v - s * 0.5, s * 2, s);
        ctx.fillStyle = done ? '#a9763f' : PAPER;
        break;
      }
      case 'place': {
        // A door in town.
        const s = 2.2 * big;
        ctx.rect(u - s, v - s, s * 2, s * 2);
        ctx.fillStyle = PAPER;
        ctx.lineWidth = 1;
        break;
      }
      case 'person': {
        // The gold diamond that hangs over their head.
        const s = 5 * big;
        ctx.moveTo(u, v - s);
        ctx.lineTo(u + s * 0.72, v);
        ctx.lineTo(u, v + s);
        ctx.lineTo(u - s * 0.72, v);
        ctx.closePath();
        ctx.fillStyle = GOLD;
        break;
      }
    }
    ctx.fill();
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  // --- Picking ----------------------------------------------------------------------------------

  /** Name whatever is nearest a tap; or, if nothing is, mark the bare spot. */
  private tap(u: number, v: number): void {
    const view = this.view;
    if (!view) return;
    const at = view.toWorld(u, v);
    const reach = TAP_REACH / view.scale;
    let best = reach;
    let found: Picked | null = null;
    if (!this.hidden.has('lifts')) {
      for (const path of this.lifts) {
        const d = distToPolyline(at.x, at.z, path.lift.pts);
        if (d < best) {
          best = d;
          found = { lift: path };
        }
      }
    }
    if (!this.hidden.has('trails')) {
      for (const trail of this.world.trails) {
        if (!trail.name || trail.area) continue;
        const d = distToPolyline(at.x, at.z, trail.pts);
        if (d < best) {
          best = d;
          found = { trail };
        }
      }
    }
    // A path is picked only when no trail or lift is as close.
    if (!this.hidden.has('paths')) {
      for (const path of this.world.paths) {
        const d = distToPolyline(at.x, at.z, path.pts);
        if (d < best * 0.6) {
          best = d;
          found = { path: path.name };
        }
      }
    }
    // A sign is small, and is what someone tapping near one is after: the nearest wins over any line.
    let nearest = reach * 0.9;
    for (const point of this.points()) {
      if (!this.shows(point.kind)) continue;
      // Doors stand close together in town, and a person outranks whatever they stand beside.
      const d = Math.hypot(point.x - at.x, point.z - at.z) * (point.kind === 'person' ? 0.6 : point.kind === 'place' ? 1.3 : 1);
      if (d < nearest) {
        nearest = d;
        found = { point };
      }
    }
    if (this.flag && Math.hypot(this.flag.x - at.x, this.flag.z - at.z) < reach) found = { flag: true };
    this.pick(found ?? { spot: at });
    this.draw();
  }

  /** Say what was picked, and offer the flag. */
  private pick(found: Picked | null): void {
    this.picked = found;
    const say = (what: string, note?: string): string => (note ? `${what} · ${note}` : what);
    let text = 'Drag to look around. Tap anything for its name.';
    if (found?.flag && this.flag) text = `Your flag · ${this.flag.label}`;
    else if (found?.point) text = say(found.point.label, found.point.note);
    else if (found?.path) text = say(`Path: ${found.path}`, this.progress('path', found.path)?.note);
    else if (found?.lift) text = say(`Lift: ${found.lift.lift.name ?? 'unnamed'}`, found.lift.lift.name ? this.progress('lift', found.lift.lift.name)?.note : undefined);
    else if (found?.trail) text = say(`${DIFFICULTY_MARK[found.trail.difficulty]} ${found.trail.name}${found.trail.glade ? ' (glade)' : ''}`, this.progress('trail', found.trail.name as string)?.note);
    else if (found?.spot) text = 'A spot on the mountain.';
    this.caption.textContent = text;
    // The flag goes wherever was tapped; tapping the flag itself takes it up.
    this.flagButton.hidden = !found;
    this.flagButton.textContent = found?.flag ? 'Take up' : 'Flag';
    this.flagButton.setAttribute('aria-label', found?.flag ? 'Take up the flag' : 'Plant a flag here');
  }

  /** Where the thing that is picked is, and what a flag planted on it would be called. */
  private target(): MapFlag | null {
    const found = this.picked;
    if (!found) return null;
    const middle = (pts: readonly number[]): { x: number; z: number } => {
      const mid = Math.floor(pts.length / 4) * 2;
      return { x: pts[mid] as number, z: pts[mid + 1] as number };
    };
    if (found.point) return { x: found.point.x, z: found.point.z, label: found.point.label.split(' · ')[0] as string };
    // A lift is flagged at its foot, where it is boarded; a trail at its top, where it is begun.
    if (found.lift) return { x: found.lift.points[0] as number, z: found.lift.points[2] as number, label: found.lift.lift.name ?? 'A lift' };
    if (found.trail) return { x: found.trail.pts[0] as number, z: found.trail.pts[1] as number, label: `Top of ${found.trail.name}` };
    if (found.path) {
      const path = this.world.paths.find((p) => p.name === found.path);
      return path ? { ...middle(path.pts), label: path.name } : null;
    }
    if (found.spot) return { ...found.spot, label: 'A spot you marked' };
    return null;
  }

  private plant(): void {
    const next = this.picked?.flag ? null : this.target();
    this.flag = next;
    this.onFlag?.(next);
    this.pick(next ? { flag: true } : null);
    this.draw();
  }
}
