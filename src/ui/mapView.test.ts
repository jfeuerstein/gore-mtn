import { describe, expect, it } from 'vitest';
import { loadTestWorld } from '../world/testWorld';
import { boundsOf, fitMap } from './mapView';
import { clampCamera, lookAt, MAX_ZOOM, panBy, sayDistance, wayTo, wholeMap, zoomAbout } from './mapView';

// A mountain 4 km east to west and 2 km north to south, summit at the west end.
const bounds = { minX: -2000, maxX: 2000, minZ: -1000, maxZ: 1000 };

describe('fitMap', () => {
  const map = fitMap(bounds, 400, 1000);

  it('is taller than it is wide, as the mountain is longer east to west', () => {
    expect(map.width).toBeCloseTo(400);
    expect(map.height).toBeCloseTo(800);
    expect(map.scale).toBeCloseTo(0.2);
  });

  it('puts west at the top and north on the right', () => {
    expect(map.toMap(-2000, 0).v).toBeCloseTo(0); // west edge at the top
    expect(map.toMap(2000, 0).v).toBeCloseTo(800); // east edge at the bottom
    expect(map.toMap(0, -1000).u).toBeCloseTo(400); // north edge on the right
    expect(map.toMap(0, 1000).u).toBeCloseTo(0); // south edge on the left
  });

  it('turns map points back into world positions', () => {
    const p = map.toMap(350, -620);
    expect(map.toWorld(p.u, p.v).x).toBeCloseTo(350);
    expect(map.toWorld(p.u, p.v).z).toBeCloseTo(-620);
  });

  it('points an arrow the right way for a heading', () => {
    expect(map.toMapAngle(Math.PI / 2)).toBeCloseTo(0); // facing west: up
    expect(map.toMapAngle(0)).toBeCloseTo(Math.PI / 2); // facing north: right
    expect(map.toMapAngle(-Math.PI / 2)).toBeCloseTo(Math.PI); // facing east: down
  });

  it('is limited by height when the box is short, and leaves room for a margin', () => {
    const short = fitMap(bounds, 400, 400, 0);
    expect(short.height).toBeCloseTo(400);
    expect(short.width).toBeCloseTo(200);
    const padded = fitMap(bounds, 400, 1000, 100);
    expect(padded.toMap(-2000, 1000)).toEqual({ u: padded.scale * 100, v: padded.scale * 100 });
  });
});

describe('boundsOf', () => {
  it('finds the box around flat x, z lists', () => {
    expect(boundsOf([[0, 0, 10, -5], [-3, 8]])).toEqual({ minX: -3, maxX: 10, minZ: -5, maxZ: 8 });
  });
});

describe('the real mountain on the map', () => {
  const world = loadTestWorld();
  const map = fitMap(boundsOf([...world.trails.map((t) => t.pts), ...world.lifts.map((l) => l.pts)]), 374, 600, 150);
  const at = (id: string) => {
    const p = world.places.find((q) => q.id === id);
    if (!p) throw new Error(id);
    return map.toMap(p.x, p.z);
  };

  it('fits an upright phone', () => {
    expect(map.width).toBeLessThanOrEqual(374.01);
    expect(map.height).toBeLessThanOrEqual(600.01);
    expect(map.height).toBeGreaterThan(map.width);
  });

  it('shows the summit above the Saddle Lodge above the Base Lodge', () => {
    expect(at('summit').v).toBeLessThan(at('saddle-lodge').v);
    expect(at('saddle-lodge').v).toBeLessThan(at('base-lodge').v);
  });
});

describe('looking round the map', () => {
  const bounds = { minX: -1000, maxX: 1000, minZ: -500, maxZ: 500 };
  const W = 300;
  const H = 600;

  it('shows the whole mountain at zoom 1, as the fitted map does', () => {
    const view = lookAt(bounds, W, H, wholeMap(bounds));
    // West (low x) is up, north (low z) is to the right.
    expect(view.toMap(-1000, 0).v).toBeCloseTo(0);
    expect(view.toMap(1000, 0).v).toBeCloseTo(H);
    expect(view.toMap(0, -500).u).toBeCloseTo(W);
    expect(view.toMap(0, 500).u).toBeCloseTo(0);
  });

  it('goes there and back', () => {
    const view = lookAt(bounds, W, H, { zoom: 3.5, x: 220, z: -140 });
    const p = view.toMap(-300, 75);
    const back = view.toWorld(p.u, p.v);
    expect(back.x).toBeCloseTo(-300);
    expect(back.z).toBeCloseTo(75);
  });

  it('keeps what is under the finger where it is while zooming', () => {
    const camera = { zoom: 2, x: 100, z: 50 };
    const held = lookAt(bounds, W, H, camera).toWorld(200, 150);
    const closer = zoomAbout(bounds, W, H, camera, 200, 150, 1.8);
    expect(closer.zoom).toBeCloseTo(3.6);
    const now = lookAt(bounds, W, H, closer).toMap(held.x, held.z);
    expect(now.u).toBeCloseTo(200);
    expect(now.v).toBeCloseTo(150);
  });

  it('never zooms out past the whole mountain or in past the limit', () => {
    expect(zoomAbout(bounds, W, H, wholeMap(bounds), 10, 10, 0.2)).toEqual(wholeMap(bounds));
    expect(zoomAbout(bounds, W, H, { zoom: MAX_ZOOM, x: 0, z: 0 }, 150, 300, 4).zoom).toBe(MAX_ZOOM);
  });

  it('slides with the finger, and stops at the edge of the map', () => {
    const camera = { zoom: 4, x: 0, z: 0 };
    const moved = panBy(bounds, W, H, camera, 30, -60);
    const scale = lookAt(bounds, W, H, camera).scale;
    // A finger moving right drags the map right: the window now looks further left (south, higher z).
    expect(moved.z).toBeCloseTo(30 / scale);
    expect(moved.x).toBeCloseTo(60 / scale);
    const far = panBy(bounds, W, H, camera, -100000, 100000);
    const view = lookAt(bounds, W, H, far);
    expect(view.toWorld(W, 0).z).toBeCloseTo(-500);
    expect(view.toWorld(0, 0).x).toBeCloseTo(-1000);
    // At zoom 1 there is nowhere to slide to.
    expect(clampCamera(bounds, W, H, { zoom: 1, x: 900, z: 400 })).toEqual(wholeMap(bounds));
  });

  it('can be slid out to a town that lies beyond the trails the map is fitted to', () => {
    const reach = { minX: -1000, maxX: 1600, minZ: -900, maxZ: 500 };
    const town = clampCamera(bounds, W, H, { zoom: 6, x: 1300, z: -700 }, 0, reach);
    expect(town.x).toBeCloseTo(1300);
    expect(town.z).toBeCloseTo(-700);
    // Without it, the window stops at the last trail.
    expect(clampCamera(bounds, W, H, { zoom: 6, x: 1300, z: -700 }).x).toBeLessThan(1000);
    // And the window still stops at the edge of the world.
    expect(lookAt(bounds, W, H, panBy(bounds, W, H, town, 0, -100000, 0, reach)).toWorld(0, H).x).toBeCloseTo(1600);
  });

  it('says how far off something is and which way to turn', () => {
    // Facing north; the thing is due west: a quarter turn to the left.
    const west = wayTo({ x: 0, z: 0, yaw: 0 }, { x: -100, z: 0 });
    expect(west.metres).toBeCloseTo(100);
    expect(west.turn).toBeCloseTo(Math.PI / 2);
    // Facing west; the thing is due north: a quarter turn to the right.
    expect(wayTo({ x: 0, z: 0, yaw: Math.PI / 2 }, { x: 0, z: -50 }).turn).toBeCloseTo(-Math.PI / 2);
    // Dead ahead.
    expect(wayTo({ x: 5, z: 5, yaw: 0 }, { x: 5, z: -20 }).turn).toBeCloseTo(0);
  });

  it('says distances in feet and miles', () => {
    expect(sayDistance(2)).toBe('10 ft');
    expect(sayDistance(100)).toBe('330 ft');
    expect(sayDistance(1609.34)).toBe('1.0 mi');
  });
});
