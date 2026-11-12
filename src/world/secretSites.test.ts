import { describe, expect, it } from 'vitest';
import { GEAR, gearById } from '../game/people';
import { KEYS, SECRETS, secretById } from '../game/secrets';
import { secretSites, wildPlaces } from './secretSites';
import { loadTestWorld } from './testWorld';
import { distToPolyline } from './trails';
import { OPEN_WATER } from './world';

const world = loadTestWorld();
const sites = secretSites(world);
const at = (id: string) => sites.find((s) => s.id === id);

describe('where the secrets stand', () => {
  it('finds a place on the real mountain for every one of them', () => {
    for (const secret of SECRETS) expect(at(secret.id), secret.id).toBeDefined();
  });

  it('stands them on dry ground, on the map, and not on top of one another', () => {
    for (const s of sites) {
      expect(world.openAt(s.x, s.z), s.id).not.toBe(OPEN_WATER);
      expect(s.x).toBeGreaterThan(world.source.minX);
      expect(s.x).toBeLessThan(world.source.maxX);
      for (const o of sites) if (o !== s && !(s.id.startsWith('room-') || o.id.startsWith('room-'))) expect(Math.hypot(o.x - s.x, o.z - s.z), `${s.id} and ${o.id}`).toBeGreaterThan(5);
    }
  });

  it('puts each plaque beside its own trail, and on no other', () => {
    for (const secret of SECRETS.filter((s) => s.kind === 'plaque')) {
      const site = at(secret.id);
      if (!site) continue;
      const own = Math.min(...world.trails.filter((t) => t.name === secret.name && !t.area).map((t) => distToPolyline(site.x, site.z, t.pts)));
      expect(own, secret.name).toBeLessThan(40);
    }
  });

  it('keeps the wild places wild: deep in the woods, and far from each other', () => {
    const wilds = wildPlaces(world, 4);
    expect(wilds.length).toBeGreaterThanOrEqual(2);
    for (const p of wilds) {
      expect(world.trailDistance(p.x, p.z)).toBeGreaterThan(160);
      // A walk, not an expedition.
      expect(world.trailDistance(p.x, p.z)).toBeLessThan(600);
      expect(world.openAt(p.x, p.z)).toBe(0);
      for (const q of wilds) if (q !== p) expect(Math.hypot(q.x - p.x, q.z - p.z)).toBeGreaterThan(400);
    }
  });
});

describe('what the secrets hand over', () => {
  it('only gives things there are, and each thing once', () => {
    const given = SECRETS.flatMap((s) => (s.gear ? [s.gear] : []));
    for (const id of given) expect(gearById(id), id).toBeDefined();
    expect(new Set(given).size).toBe(given.length);
    expect(GEAR.length).toBeGreaterThan(50);
  });

  it('has a key lying somewhere for every locked room, and a room for every key that has turned up', () => {
    const lying = SECRETS.flatMap((s) => (s.key ? [s.key] : []));
    for (const room of SECRETS.filter((s) => s.kind === 'room')) {
      expect(room.needs, room.id).toBeDefined();
      expect(KEYS[room.needs as string], room.id).toBeDefined();
      expect(room.locked, room.id).toBeTruthy();
      expect(room.art, room.id).toBeTruthy();
    }
    for (const key of lying) expect(SECRETS.some((s) => s.needs === key), key).toBe(true);
    expect(secretById('bell')?.kind).toBe('bell');
  });
});
