import { describe, expect, it } from 'vitest';
import { loadTestWorld } from './testWorld';
import { trailSignPosts } from './trailSigns';

const world = loadTestWorld();
const posts = trailSignPosts(world.trails, world.lifts, (x, z) => world.source.heightAt(x, z), (x, z) => world.onTrail(x, z));
const boards = posts.flatMap((p) => p.boards);

describe('the signs on the mountain', () => {
  it('names every named trail once, and every lift', () => {
    const names = new Set(world.trails.filter((t) => t.name && !t.area).map((t) => t.name as string));
    const trailBoards = boards.filter((b) => b.difficulty !== 'lift');
    expect(trailBoards.length).toBe(names.size);
    for (const name of names) expect(trailBoards.some((b) => b.text.endsWith(name.toUpperCase())), name).toBe(true);
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
      expect(p.boards.length).toBeLessThanOrEqual(5);
    }
    const near = posts.filter((p) => p.boards[0]?.difficulty !== 'lift' && world.trailDistance(p.x, p.z) < 45);
    expect(near.length).toBeGreaterThan(posts.filter((p) => p.boards[0]?.difficulty !== 'lift').length * 0.9);
  });

  it('shares a post where trails set off together', () => {
    expect(posts.some((p) => p.boards.length >= 2)).toBe(true);
  });

  it('keeps names short enough to paint', () => {
    for (const b of boards) expect(b.text.length, b.text).toBeLessThanOrEqual(34);
  });
});
