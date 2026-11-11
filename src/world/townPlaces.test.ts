import { describe, expect, it } from 'vitest';
import { loadTestWorld } from './testWorld';
import { PEOPLE } from '../game/people';
import { faceToward, resolveTownPlaces, TOWN_LISTINGS, townPlaceAt, townPlaceFor } from './townPlaces';
import { locate } from './whereabouts';

const world = loadTestWorld();
const places = resolveTownPlaces(world);

describe('faceToward', () => {
  const b = { x: 0, z: 0, w: 20, d: 8, turn: 0 };
  it('keeps a footprint as it is when its front already faces the road', () => {
    expect(faceToward(b, 0, 50)).toEqual({ w: 20, d: 8, turn: 0 });
  });
  it('turns it right round when the road is behind', () => {
    expect(faceToward(b, 0, -50)).toEqual({ w: 20, d: 8, turn: Math.PI });
  });
  it('swaps width and depth when a short side faces the road', () => {
    const east = faceToward(b, 50, 0);
    expect(east.w).toBe(8);
    expect(east.d).toBe(20);
    // Its own +z now points east.
    expect(Math.sin(east.turn)).toBeCloseTo(1);
    const west = faceToward(b, -50, 0);
    expect(Math.sin(west.turn)).toBeCloseTo(-1);
  });
});

describe('the town\'s places', () => {
  it('finds every listed place on the map, each once', () => {
    expect(places.map((p) => p.id).sort()).toEqual(TOWN_LISTINGS.map((l) => l.id).sort());
    const claimed = places.map((p) => p.building).filter((i) => i >= 0);
    expect(new Set(claimed).size).toBe(claimed.length);
  });

  it('faces each toward a road, with its door outside its walls and on the map', () => {
    const hf = world.source;
    for (const p of places) {
      const out = Math.hypot(p.door.x - p.x, p.door.z - p.z);
      expect(out, p.id).toBeGreaterThan(p.d / 2);
      expect(out, p.id).toBeLessThan(p.d / 2 + 6);
      expect(p.door.x, p.id).toBeGreaterThan(hf.minX);
      expect(p.door.x, p.id).toBeLessThan(hf.maxX);
      expect(p.door.z, p.id).toBeGreaterThan(hf.minZ);
      expect(p.door.z, p.id).toBeLessThan(hf.maxZ);
      expect(p.w, p.id).toBeGreaterThanOrEqual(3);
      expect(p.d, p.id).toBeGreaterThanOrEqual(3);
    }
  });

  it('keeps signs short enough to paint', () => {
    for (const l of TOWN_LISTINGS) expect(l.sign.length, l.id).toBeLessThanOrEqual(20);
  });

  it('can be looked up the way people\'s whereabouts name them', () => {
    expect(townPlaceFor(places, 'north-creek-post-office')?.style).toBe('postoffice');
    expect(townPlaceFor(places, 'johnsburg-town-hall')?.style).toBe('hall');
    expect(townPlaceFor(places, 'gore-mt-mineral-shop')?.style).toBe('cabin');
    expect(townPlaceFor(places, 'copperfield-inn')?.style).toBe('inn');
    expect(townPlaceFor(places, 'nowhere')).toBeUndefined();
  });

  it('gives the people of the town a door to stand at', () => {
    const keeps: Record<string, string> = { dot: 'north-creek-post-office', marge: 'copperfield-inn', fenn: 'johnsburg-town-hall', notices: 'johnsburg-town-hall', june: 'cafe', walt: 'deli', mica: 'gore-mt-mineral-shop' };
    for (const [who, where] of Object.entries(keeps)) {
      const person = PEOPLE.find((p) => p.id === who);
      expect(person, who).toBeDefined();
      const at = person && locate(world, person.at);
      expect(at, who).toBeTruthy();
      expect(at && townPlaceAt(places, at.x, at.z)?.id, who).toBe(where);
    }
  });
});
