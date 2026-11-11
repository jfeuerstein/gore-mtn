import type { LiftPath } from '../world/lifts';
import { DIFFICULTY_MARK, distToPolyline, type Difficulty, type Trail } from '../world/trails';
import type { World } from '../world/world';
import { boundsOf, fitMap, type MapView } from './mapView';

const TRAIL_COLOUR: Record<Difficulty, string> = {
  easy: '#2f9e55',
  intermediate: '#2b62c9',
  advanced: '#16181d',
  expert: '#16181d',
  freeride: '#d9822b',
};
const LIFT_COLOUR = '#c2412d';
const PATH_COLOUR = '#f4e4b8';
/** Places worth a label on the map, by id. */
const LABELLED = new Set(['base-lodge', 'saddle-lodge', 'summit', 'ski-bowl-lodge', 'depot']);
/** Something marked on the map with a gold diamond: someone with an errand, say. */
export interface MapMark {
  x: number;
  z: number;
  /** What the caption says when it is tapped. */
  label: string;
}

/** How close a tap must land to a trail or lift to pick it, in screen points. */
const TAP_REACH = 16;

/**
 * The trail map: a sheet that slides over the lower part of the screen, with the summit at the
 * top, every trail and lift, and where the player is. Tap a trail or lift to see its name.
 */
export class TrailMap {
  private readonly sheet: HTMLElement;
  private readonly canvas: HTMLCanvasElement;
  private readonly caption: HTMLElement;
  private view: MapView | null = null;
  private timer = 0;
  private picked: { trail?: Trail; lift?: LiftPath; path?: string; mark?: MapMark } | null = null;
  /** People with something for the player, and anything else worth a mark. Asked for each time the map is drawn. */
  marks: () => MapMark[] = () => [];
  /** Places with a name that can be tapped for it: the town's doors. Small squares, under the marks. */
  spots: MapMark[] = [];
  /** Called when the map opens, so other sheets can get out of the way. */
  onOpen: (() => void) | null = null;

  /**
   * @param backdrop the pipeline's canopy picture of the whole mountain, north up
   * @param where the player's position and the way they face
   */
  constructor(
    private readonly world: World,
    private readonly lifts: readonly LiftPath[],
    private readonly backdrop: CanvasImageSource,
    private readonly where: () => { x: number; z: number; yaw: number },
  ) {
    const app = document.getElementById('app') ?? document.body;
    this.sheet = document.createElement('div');
    this.sheet.id = 'map-sheet';
    this.sheet.hidden = true;
    const head = document.createElement('div');
    head.className = 'head';
    const title = document.createElement('h2');
    title.textContent = 'Trail map';
    const close = document.createElement('button');
    close.type = 'button';
    close.textContent = 'Close';
    close.addEventListener('click', () => this.close());
    head.append(title, close);
    this.canvas = document.createElement('canvas');
    this.caption = document.createElement('p');
    this.caption.className = 'caption';
    const legend = document.createElement('p');
    legend.className = 'legend';
    for (const [colour, text] of [
      [TRAIL_COLOUR.easy, '● easier'],
      [TRAIL_COLOUR.intermediate, '■ more difficult'],
      [TRAIL_COLOUR.advanced, '◆ most difficult'],
      [LIFT_COLOUR, '— lift'],
      ['#8a6a3c', '⋯ path'],
      ['#b9770e', '◆ someone waiting'],
    ] as const) {
      const item = document.createElement('span');
      item.style.color = colour;
      item.textContent = text;
      legend.append(item);
    }
    this.sheet.append(head, this.canvas, this.caption, legend);
    app.appendChild(this.sheet);

    this.canvas.addEventListener('click', (e) => this.pick(e));
    document.getElementById('map-button')?.addEventListener('click', () => (this.sheet.hidden ? this.open() : this.close()));
  }

  open(): void {
    this.onOpen?.();
    this.sheet.hidden = false;
    this.picked = null;
    this.caption.textContent = 'Tap a trail or lift to see its name.';
    this.draw();
    // Keep the "you are here" mark current while the map is up.
    this.timer = window.setInterval(() => this.draw(), 500);
  }

  close(): void {
    this.sheet.hidden = true;
    window.clearInterval(this.timer);
  }

  private draw(): void {
    const { world } = this;
    // Fit the map to the sheet's width and to the height left under the title on a phone.
    const maxWidth = this.sheet.clientWidth - 28;
    const maxHeight = Math.max(200, (this.sheet.parentElement?.clientHeight ?? 800) * 0.6);
    const bounds = boundsOf([...world.trails.map((t) => t.pts), ...world.lifts.map((l) => l.pts), world.places.flatMap((p) => [p.x, p.z])]);
    const view = fitMap(bounds, maxWidth, maxHeight, 120);
    this.view = view;
    const ratio = Math.min(3, window.devicePixelRatio || 1);
    this.canvas.style.width = `${view.width}px`;
    this.canvas.style.height = `${view.height}px`;
    this.canvas.width = Math.round(view.width * ratio);
    this.canvas.height = Math.round(view.height * ratio);
    const ctx = this.canvas.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    ctx.fillStyle = '#5a6f74';
    ctx.fillRect(0, 0, view.width, view.height);

    // Backdrop: the canopy picture, turned so that west is up. One of its pixels covers a block
    // of the world; work out where its corners land and let the canvas do the rest.
    const src = world.source;
    const image = this.backdrop as { width: number; height: number };
    const perPixelX = (src.cols * src.cell) / image.width;
    const perPixelZ = (src.rows * src.cell) / image.height;
    const origin = view.toMap(src.originX - src.cell / 2, src.originZ - src.cell / 2);
    ctx.save();
    ctx.transform(0, perPixelX * view.scale, -perPixelZ * view.scale, 0, origin.u, origin.v);
    ctx.drawImage(this.backdrop, 0, 0);
    ctx.restore();

    const trace = (pts: readonly number[]): void => {
      ctx.beginPath();
      for (let i = 0; i + 1 < pts.length; i += 2) {
        const p = view.toMap(pts[i] as number, pts[i + 1] as number);
        if (i === 0) ctx.moveTo(p.u, p.v);
        else ctx.lineTo(p.u, p.v);
      }
    };
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';

    // Paths through the woods: dotted, under everything else.
    for (const path of world.paths) {
      trace(path.pts);
      ctx.setLineDash([2, 3]);
      ctx.strokeStyle = PATH_COLOUR;
      ctx.lineWidth = this.picked?.path === path.name ? 3 : 1.3;
      ctx.stroke();
    }
    ctx.setLineDash([]);

    // Trails, easiest first so the harder ones sit on top where they cross.
    const order: Difficulty[] = ['easy', 'freeride', 'intermediate', 'advanced', 'expert'];
    for (const difficulty of order) {
      for (const trail of world.trails) {
        if (trail.difficulty !== difficulty || trail.area) continue;
        trace(trail.pts);
        ctx.setLineDash(trail.glade ? [3, 3] : []);
        ctx.strokeStyle = TRAIL_COLOUR[difficulty];
        ctx.lineWidth = this.picked?.trail?.name === trail.name ? 4 : 1.8;
        ctx.stroke();
      }
    }
    ctx.setLineDash([]);

    // Lifts: a straight line with a ring at the bottom station, where you board.
    for (const path of this.lifts) {
      trace(path.lift.pts);
      ctx.strokeStyle = LIFT_COLOUR;
      ctx.lineWidth = this.picked?.lift === path ? 4 : 2;
      ctx.stroke();
      const foot = view.toMap(path.points[0] as number, path.points[2] as number);
      ctx.beginPath();
      ctx.arc(foot.u, foot.v, 3.2, 0, Math.PI * 2);
      ctx.fillStyle = '#fff';
      ctx.fill();
      ctx.lineWidth = 1.6;
      ctx.stroke();
    }

    // Places.
    ctx.font = '600 11px ui-rounded, system-ui, sans-serif';
    ctx.textBaseline = 'middle';
    for (const place of world.places) {
      if (!LABELLED.has(place.id)) continue;
      const p = view.toMap(place.x, place.z);
      const label = place.id === 'depot' ? 'North Creek' : place.id === 'ski-bowl-lodge' ? 'Ski Bowl' : place.name.replace('Gore ', '');
      ctx.fillStyle = '#1f2a3a';
      ctx.fillRect(p.u - 2.5, p.v - 2.5, 5, 5);
      // Kept well inside the edge, which is rounded off at the corners.
      const left = p.u + ctx.measureText(label).width + 26 > view.width;
      ctx.textAlign = left ? 'right' : 'left';
      ctx.lineWidth = 3;
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
      // The Ski Bowl and the town sit almost on top of each other; lift one label clear of the other.
      const rise = place.id === 'ski-bowl-lodge' ? -10 : 0;
      ctx.strokeText(label, p.u + (left ? -6 : 6), p.v + rise);
      ctx.fillText(label, p.u + (left ? -6 : 6), p.v + rise);
    }

    // The town's named places: small cream squares, to be tapped for their names.
    for (const spot of this.spots) {
      const p = view.toMap(spot.x, spot.z);
      const half = this.picked?.mark === spot ? 3.5 : 2;
      ctx.fillStyle = '#f7f1e3';
      ctx.strokeStyle = '#1f2a3a';
      ctx.lineWidth = 1;
      ctx.fillRect(p.u - half, p.v - half, half * 2, half * 2);
      ctx.strokeRect(p.u - half, p.v - half, half * 2, half * 2);
    }

    // Gold diamonds for whoever has something for the player, as over their heads.
    for (const mark of this.marks()) {
      const p = view.toMap(mark.x, mark.z);
      const big = this.picked?.mark?.label === mark.label ? 7 : 5;
      ctx.beginPath();
      ctx.moveTo(p.u, p.v - big);
      ctx.lineTo(p.u + big * 0.72, p.v);
      ctx.lineTo(p.u, p.v + big);
      ctx.lineTo(p.u - big * 0.72, p.v);
      ctx.closePath();
      ctx.fillStyle = '#ffb02e';
      ctx.strokeStyle = '#1f2a3a';
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
    ctx.strokeStyle = '#1f2a3a';
    ctx.lineWidth = 1.6;
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  /** Name the trail or lift nearest a tap. */
  private pick(e: MouseEvent): void {
    const view = this.view;
    if (!view) return;
    const box = this.canvas.getBoundingClientRect();
    const at = view.toWorld(e.clientX - box.left, e.clientY - box.top);
    const reach = TAP_REACH / view.scale;
    let best = reach;
    let found: { trail?: Trail; lift?: LiftPath; path?: string; mark?: MapMark } | null = null;
    for (const path of this.lifts) {
      const d = distToPolyline(at.x, at.z, path.lift.pts);
      if (d < best) {
        best = d;
        found = { lift: path };
      }
    }
    for (const trail of this.world.trails) {
      if (!trail.name || trail.area) continue;
      const d = distToPolyline(at.x, at.z, trail.pts);
      if (d < best) {
        best = d;
        found = { trail };
      }
    }
    // A path is picked only when no trail or lift is as close.
    for (const path of this.world.paths) {
      const d = distToPolyline(at.x, at.z, path.pts);
      if (d < best * 0.6) {
        best = d;
        found = { path: path.name };
      }
    }
    // A named place is picked only by a tap right on it: they stand close together in town.
    let nearest = reach * 0.75;
    for (const spot of this.spots) {
      const d = Math.hypot(spot.x - at.x, spot.z - at.z);
      if (d < nearest) {
        nearest = d;
        found = { mark: spot };
      }
    }
    // A diamond is small, and is what someone tapping near one is after.
    for (const mark of this.marks()) {
      if (Math.hypot(mark.x - at.x, mark.z - at.z) < reach * 1.2) found = { mark };
    }
    this.picked = found;
    if (found?.mark) this.caption.textContent = found.mark.label;
    else if (found?.path) this.caption.textContent = `Path: ${found.path}`;
    else if (found?.lift) this.caption.textContent = `Lift: ${found.lift.lift.name ?? 'unnamed'}`;
    else if (found?.trail) this.caption.textContent = `${DIFFICULTY_MARK[found.trail.difficulty]} ${found.trail.name}${found.trail.glade ? ' (glade)' : ''}`;
    else this.caption.textContent = 'Tap a trail or lift to see its name.';
    this.draw();
  }
}
