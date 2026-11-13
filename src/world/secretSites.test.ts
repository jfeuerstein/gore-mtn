import { describe, expect, it } from 'vitest';
import { GEAR, gearById } from '../game/people';
import { KEYS, SECRETS, secretById } from '../game/secrets';
import { BAND, CAMPER_HAUNTS, PAINTER_HAUNTS, PIP_HAUNTS } from '../game/wanderers';
import { placeAt, secretSites, setting, wildPlaces } from './secretSites';
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

  it('sets the adit into a bank near the mine, well clear of the water, looking out down the slope', () => {
    const adit = at('working-adit');
    const mine = world.spots.find((sp) => sp.id === 'barton-mine');
    if (!adit || !mine) throw new Error('no adit, or no mine');
    expect(Math.hypot(adit.x - mine.x, adit.z - mine.z)).toBeLessThan(90);
    // No water within a good few steps, any way round: it was at a pond's edge, half on the ice.
    for (let k = 0; k < 16; k++) for (const r of [6, 12, 15]) expect(world.openAt(adit.x + Math.sin((k / 16) * Math.PI * 2) * r, adit.z + Math.cos((k / 16) * Math.PI * 2) * r), `${k} at ${r} m`).not.toBe(OPEN_WATER);
    // The ground rises behind it and falls away in front.
    const hf = world.source;
    const front = { x: Math.sin(adit.turn), z: Math.cos(adit.turn) };
    const here = hf.heightAt(adit.x, adit.z);
    expect(hf.heightAt(adit.x - front.x * 5, adit.z - front.z * 5)).toBeGreaterThan(here + 1);
    expect(hf.heightAt(adit.x + front.x * 5, adit.z + front.z * 5)).toBeLessThan(here);
    // And it is not on the brink of a drop: there is somewhere to stand in front of it.
    expect(hf.heightAt(adit.x + front.x * 5, adit.z + front.z * 5)).toBeGreaterThan(here - 3.5);
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

describe('where the things to follow and the people who roam are', () => {
  const set = setting(world);

  it('puts the nest at the water\'s edge, with nothing built beside it', () => {
    const nest = at('nest');
    expect(nest).toBeDefined();
    if (!nest) return;
    expect(world.openAt(nest.x, nest.z)).not.toBe(OPEN_WATER);
    let wet = false;
    for (let a = 0; a < 16; a++) if (world.openAt(nest.x + Math.sin((a / 8) * Math.PI) * 6, nest.z + Math.cos((a / 8) * Math.PI) * 6) === OPEN_WATER) wet = true;
    expect(wet).toBe(true);
    expect(Math.min(...world.buildings.map((b) => Math.hypot(b.x - nest.x, b.z - nest.z)))).toBeGreaterThan(12);
  });

  it('puts the den and the sugar shack in the woods, a walk from a trail', () => {
    for (const id of ['den', 'shack']) {
      const site = at(id);
      expect(site, id).toBeDefined();
      if (!site) continue;
      expect(world.trailDistance(site.x, site.z), id).toBeGreaterThan(60);
      expect(world.openAt(site.x, site.z), id).toBe(0);
    }
  });

  it('puts a ribbon at the top of each unmarked run', () => {
    set.runs.forEach((run, n) => {
      const site = at(`run-${n + 1}`);
      expect(site?.x).toBe(run.pts[0]);
      expect(site?.z).toBe(run.pts[1]);
    });
  });

  it('finds somewhere to stand at every haunt: dry, on the map, off the trails where it can be, and no two of one person\'s in the same place', () => {
    const all: [string, typeof PAINTER_HAUNTS][] = [['nell', PAINTER_HAUNTS], ['ro', CAMPER_HAUNTS], ['pip', PIP_HAUNTS], ...BAND.map((b): [string, typeof PAINTER_HAUNTS] => [b.who, [b.haunt]])];
    for (const [who, haunts] of all) {
      const spots = haunts.map((h) => ({ h, site: placeAt(set, `${who}-${h.id}`, h.where, h.off ?? 0) }));
      for (const { h, site } of spots) {
        expect(site, `${who} at ${h.id}`).not.toBeNull();
        if (!site) continue;
        expect(world.openAt(site.x, site.z), `${who} at ${h.id}`).not.toBe(OPEN_WATER);
        // (Round a lodge there may be nothing but snow that is skied on: behind the Saddle Lodge is still behind the Saddle Lodge.)
        if (!('place' in h.where)) expect(world.onTrail(site.x, site.z), `${who} at ${h.id}`).toBe(false);
        expect(world.source.slopeDegAt(site.x, site.z), `${who} at ${h.id}`).toBeLessThan(22);
      }
      for (const a of spots) for (const b of spots) if (a !== b && a.site && b.site) expect(Math.hypot(a.site.x - b.site.x, a.site.z - b.site.z), `${who}: ${a.h.id} and ${b.h.id}`).toBeGreaterThan(60);
    }
  });
});
