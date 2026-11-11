import { describe, expect, it } from 'vitest';
import { loadTestWorld } from '../world/testWorld';
import { daySeed, FIND_PATCH, findsInPatch, HABITATS, habitatAt, MINERALS, MOST_PER_PATCH, pick, specimenSize, type Find, type Ground, type Habitat } from './minerals';

describe('the mineral table', () => {
  it('has a dozen minerals with distinct ids and names', () => {
    expect(MINERALS).toHaveLength(12);
    expect(new Set(MINERALS.map((m) => m.id)).size).toBe(12);
    expect(new Set(MINERALS.map((m) => m.name)).size).toBe(12);
  });

  it('gives every mineral somewhere to be found, a line about it and a hint', () => {
    for (const m of MINERALS) {
      expect(Object.values(m.habitats).some((w) => (w ?? 0) > 0), m.id).toBe(true);
      expect(m.about.length, m.id).toBeGreaterThan(20);
      expect(m.hint.length, m.id).toBeGreaterThan(8);
      expect(m.largest, m.id).toBeGreaterThan(m.size * 1.5);
    }
  });

  it('makes the rare ones rarer than the common ones in every habitat they share', () => {
    const weight = (rarity: string, habitat: Habitat) =>
      MINERALS.filter((m) => m.rarity === rarity).reduce((sum, m) => sum + (m.habitats[habitat] ?? 0), 0);
    for (const h of HABITATS) {
      expect(weight('rare', h), h).toBeLessThan(weight('common', h));
    }
  });

  it('keeps most of the rare ones off the groomed snow, so they take a detour', () => {
    const rare = MINERALS.filter((m) => m.rarity === 'rare');
    expect(rare.filter((m) => !m.habitats.trail).length).toBeGreaterThanOrEqual(3);
    for (const m of rare) expect(m.habitats.trail ?? 0, m.id).toBeLessThan(0.5);
  });
});

describe('pick', () => {
  it('only offers minerals that belong to the habitat', () => {
    for (let roll = 0; roll < 1; roll += 0.01) {
      expect(pick('forest', roll)?.habitats.forest ?? 0).toBeGreaterThan(0);
      expect(pick('rock', roll)?.habitats.rock ?? 0).toBeGreaterThan(0);
    }
  });

  it('follows the weights: garnet is the commonest find on a trail and beside one', () => {
    for (const habitat of ['trail', 'trailside'] as const) {
      const counts = new Map<string, number>();
      for (let i = 0; i < 2000; i++) {
        const id = pick(habitat, i / 2000)?.id ?? '';
        counts.set(id, (counts.get(id) ?? 0) + 1);
      }
      const top = [...counts.entries()].sort((a, b) => b[1] - a[1])[0];
      expect(top?.[0], habitat).toBe('garnet');
      expect(counts.get('gem-garnet') ?? 0, habitat).toBeLessThan(60);
      expect(counts.get('gem-garnet') ?? 0, habitat).toBeGreaterThan(0);
    }
  });
});

describe('specimenSize', () => {
  const garnet = MINERALS[0];
  if (!garnet) throw new Error('no garnet');

  it('is usually near the typical size and never beyond the largest', () => {
    const sizes = Array.from({ length: 1000 }, (_, i) => specimenSize(garnet, i / 1000));
    const median = sizes[500] as number;
    expect(median).toBeGreaterThan(garnet.size * 0.7);
    expect(median).toBeLessThan(garnet.size * 1.6);
    expect(Math.max(...sizes)).toBeLessThanOrEqual(garnet.largest);
    expect(Math.min(...sizes)).toBeGreaterThan(0);
  });

  it('makes a giant a rare thing', () => {
    const big = Array.from({ length: 1000 }, (_, i) => specimenSize(garnet, i / 1000)).filter((s) => s > garnet.largest * 0.5);
    expect(big.length).toBeGreaterThan(0);
    expect(big.length).toBeLessThan(120);
  });
});

describe('habitatAt', () => {
  const ground = (d: number, slope: number): Ground => ({ trailDistance: () => d, slopeDegAt: () => slope });
  it('knows the groomed snow, the strip beside it, rock where it is steep, and forest far away', () => {
    expect(habitatAt(ground(0, 10), 0, 0)).toBe('trail');
    expect(habitatAt(ground(0, 50), 0, 0)).toBe('trail');
    expect(habitatAt(ground(1, 10), 0, 0)).toBeNull();
    expect(habitatAt(ground(4, 10), 0, 0)).toBe('trailside');
    expect(habitatAt(ground(30, 10), 0, 0)).toBeNull();
    expect(habitatAt(ground(30, 50), 0, 0)).toBe('rock');
    expect(habitatAt(ground(120, 10), 0, 0)).toBe('forest');
  });
});

describe('the old garnet workings', () => {
  const ground = (mine: number): Ground => ({ trailDistance: () => 100, slopeDegAt: () => 10, mineDistance: () => mine });
  it('are their own kind of ground, rich in garnet and its gem', () => {
    expect(habitatAt(ground(50), 0, 0)).toBe('mine');
    expect(habitatAt(ground(500), 0, 0)).toBe('forest');
    expect(habitatAt({ trailDistance: () => 100, slopeDegAt: () => 10 }, 0, 0)).toBe('forest');
    const counts = new Map<string, number>();
    for (let i = 0; i < 2000; i++) {
      const id = pick('mine', i / 2000)?.id ?? '';
      counts.set(id, (counts.get(id) ?? 0) + 1);
    }
    expect((counts.get('garnet') ?? 0) / 2000).toBeGreaterThan(0.5);
    expect((counts.get('gem-garnet') ?? 0) / 2000).toBeGreaterThan(0.05);
  });

  it('turn up big garnets far oftener than the trails do', () => {
    const world = loadTestWorld();
    const quarry = world.spots.find((s) => s.id === 'garnet-quarry');
    if (!quarry) throw new Error('no quarry');
    const mined: Ground = {
      trailDistance: (x, z) => world.trailDistance(x, z),
      slopeDegAt: (x, z) => world.source.slopeDegAt(x, z),
      mineDistance: (x, z) => Math.hypot(x - quarry.x, z - quarry.z),
    };
    const col = Math.floor((quarry.x - world.source.minX) / FIND_PATCH);
    const row = Math.floor((quarry.z - world.source.minZ) / FIND_PATCH);
    let garnets = 0;
    let big = 0;
    for (let day = 1; day <= 30; day++) {
      for (let dc = -1; dc <= 1; dc++) {
        for (let dr = -1; dr <= 1; dr++) {
          for (const f of findsInPatch(mined, col + dc, row + dr, daySeed(`2026-12-${String(day).padStart(2, '0')}`), world.source.minX, world.source.minZ)) {
            if (habitatAt(mined, f.x, f.z) !== 'mine' || f.mineral.id !== 'garnet') continue;
            garnets++;
            if (f.size >= 15) big++;
          }
        }
      }
    }
    // Several a day at the quarry, and a big one every few days.
    expect(garnets / 30).toBeGreaterThan(3);
    expect(big).toBeGreaterThan(8);
  });
});

describe('finds on the real mountain', () => {
  const world = loadTestWorld();
  const hf = world.source;
  const ground: Ground = { trailDistance: (x, z) => world.trailDistance(x, z), slopeDegAt: (x, z) => hf.slopeDegAt(x, z) };
  const cols = Math.ceil(hf.width / FIND_PATCH);
  const rows = Math.ceil(hf.depth / FIND_PATCH);
  const all = (day: string): Find[] => {
    const out: Find[] = [];
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) out.push(...findsInPatch(ground, c, r, daySeed(day), hf.minX, hf.minZ));
    return out;
  };
  const today = all('2026-11-10');

  it('are the same all day and different the next', () => {
    expect(all('2026-11-10').map((f) => f.id + f.mineral.id)).toEqual(today.map((f) => f.id + f.mineral.id));
    const tomorrow = all('2026-11-11');
    const same = tomorrow.filter((f, i) => today[i] && Math.hypot(f.x - (today[i] as Find).x, f.z - (today[i] as Find).z) < 1).length;
    expect(same).toBeLessThan(today.length * 0.05);
  });

  it('lie on the mountain, in ground of a kind their mineral belongs to, and never crowd a patch', () => {
    const perPatch = new Map<string, number>();
    for (const f of today) {
      const habitat = habitatAt(ground, f.x, f.z);
      expect(habitat, f.id).not.toBeNull();
      expect(f.mineral.habitats[habitat as Habitat] ?? 0, `${f.mineral.id} in ${habitat}`).toBeGreaterThan(0);
      expect(f.x).toBeGreaterThanOrEqual(hf.minX);
      expect(f.x).toBeLessThanOrEqual(hf.maxX + FIND_PATCH);
      const patch = f.id.split(':').slice(0, 2).join(':');
      perPatch.set(patch, (perPatch.get(patch) ?? 0) + 1);
    }
    expect(Math.max(...perPatch.values())).toBeLessThanOrEqual(MOST_PER_PATCH);
  });

  it('are met on the groomed snow: a skier passes one within a swerve every hundred metres or so', () => {
    const onTrail = today.filter((f) => habitatAt(ground, f.x, f.z) === 'trail');
    // Walk every trail's centre line and count the stones lying within 15 m of it.
    let length = 0;
    const met = new Set<string>();
    for (const t of world.trails.filter((q) => !q.area && !q.glade)) {
      for (let i = 0; i + 3 < t.pts.length; i += 2) {
        const [ax, az, bx, bz] = [t.pts[i], t.pts[i + 1], t.pts[i + 2], t.pts[i + 3]] as [number, number, number, number];
        const seg = Math.hypot(bx - ax, bz - az);
        length += seg;
        for (const f of onTrail) {
          if (met.has(f.id)) continue;
          const k = Math.min(1, Math.max(0, ((f.x - ax) * (bx - ax) + (f.z - az) * (bz - az)) / (seg * seg || 1)));
          if (Math.hypot(f.x - (ax + (bx - ax) * k), f.z - (az + (bz - az) * k)) < 15) met.add(f.id);
        }
      }
    }
    const spacing = length / met.size;
    expect(spacing, `${met.size} stones within a swerve over ${Math.round(length)} m of trail; ${onTrail.length} on trails in all`).toBeGreaterThan(50);
    expect(spacing).toBeLessThan(160);
  });

  it('are plentiful beside the trails: a find every hundred metres or two of skiing', () => {
    const trailside = today.filter((f) => habitatAt(ground, f.x, f.z) === 'trailside');
    const trailLength = world.trails.filter((t) => !t.area).reduce((sum, t) => {
      let len = 0;
      for (let i = 0; i + 3 < t.pts.length; i += 2) len += Math.hypot((t.pts[i + 2] as number) - (t.pts[i] as number), (t.pts[i + 3] as number) - (t.pts[i + 1] as number));
      return sum + len;
    }, 0);
    const spacing = trailLength / trailside.length;
    expect(spacing, `${trailside.length} trailside finds over ${Math.round(trailLength)} m of trail`).toBeGreaterThan(70);
    expect(spacing).toBeLessThan(220);
  });

  it('include every mineral somewhere on the mountain on a typical day, rare ones least', () => {
    const counts = new Map<string, number>();
    for (const f of today) counts.set(f.mineral.id, (counts.get(f.mineral.id) ?? 0) + 1);
    for (const m of MINERALS) expect(counts.get(m.id) ?? 0, m.name).toBeGreaterThan(0);
    expect(counts.get('gem-garnet') ?? 0).toBeLessThan((counts.get('garnet') ?? 0) / 4);
    expect(today.length).toBeLessThan(3200);
  });

  it.runIf(process.env.FIND_REPORT)('reports how many of each (for tuning)', () => {
    const by = new Map<string, number>();
    const habitats = new Map<string, number>();
    for (const f of today) {
      by.set(f.mineral.name, (by.get(f.mineral.name) ?? 0) + 1);
      const h = habitatAt(ground, f.x, f.z) ?? 'none';
      habitats.set(h, (habitats.get(h) ?? 0) + 1);
    }
    process.stderr.write(`${today.length} finds ${JSON.stringify([...habitats])} ${JSON.stringify([...by].sort((a, b) => b[1] - a[1]))}\n`);
  });
});
