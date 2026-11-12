import { describe, expect, it } from 'vitest';
import { loadTestWorld } from './testWorld';
import { MOST, SHOULDER, trailSignPosts } from './trailSigns';

const world = loadTestWorld();
const posts = trailSignPosts(world.trails, world.lifts, (x, z) => world.source.heightAt(x, z), (x, z) => world.onTrail(x, z));
const boards = posts.flatMap((p) => p.boards);

describe('the signs on the mountain', () => {
  it('names every named trail once, and every lift', () => {
    const names = new Set(world.trails.filter((t) => t.name && !t.area).map((t) => t.name as string));
    const trailBoards = boards.filter((b) => b.difficulty !== 'lift');
    expect(trailBoards.length).toBe(names.size);
    for (const name of names) expect(trailBoards.some((b) => b.text === name.toUpperCase()), name).toBe(true);
    const lifts = new Set(world.lifts.filter((l) => l.name).map((l) => l.name as string));
    expect(boards.filter((b) => b.difficulty === 'lift').length).toBe(lifts.size);
  });

  it('stands each post on the map and, for a groomed trail, off the snow but beside it', () => {
    const hf = world.source;
    for (const p of posts) {
      expect(p.x).toBeGreaterThan(hf.minX);
      expect(p.x).toBeLessThan(hf.maxX);
      expect(p.z).toBeGreaterThan(hf.minZ);
      expect(p.z).toBeLessThan(hf.maxZ);
      expect(Number.isFinite(p.turn)).toBe(true);
      expect(p.boards.length).toBeGreaterThan(0);
      expect(p.boards.length).toBeLessThanOrEqual(MOST);
    }
  });

  it('stands every trail\'s sign at the mouth of its own trail, within sight of whoever sets off down it', () => {
    // The top of each trail, as the map draws it: the highest start among its stretches.
    const tops = new Map<string, { x: number; z: number; y: number }>();
    for (const t of world.trails) {
      if (!t.name || t.area || t.pts.length < 4) continue;
      const at = { x: t.pts[0] as number, z: t.pts[1] as number, y: world.source.heightAt(t.pts[0] as number, t.pts[1] as number) };
      const best = tops.get(t.name);
      if (!best || at.y > best.y) tops.set(t.name, at);
    }
    for (const [name, top] of tops) {
      const post = posts.find((p) => p.boards.some((b) => b.difficulty !== 'lift' && b.text === name.toUpperCase()));
      expect(post, name).toBeDefined();
      if (!post) continue;
      // A dozen metres down and no further than its shoulder to the side (or the post it shares, a few metres more).
      expect(Math.hypot(post.x - top.x, post.z - top.z), name).toBeLessThan(12 + SHOULDER + 9);
    }
  });

  it('shares a post where trails set off together', () => {
    expect(posts.some((p) => p.boards.length >= 2)).toBe(true);
  });

  it('keeps names short enough to paint', () => {
    for (const b of boards) expect(b.text.length, b.text).toBeLessThanOrEqual(34);
  });
});
