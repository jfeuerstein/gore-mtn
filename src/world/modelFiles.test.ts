import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { ModelFile } from './modelFiles';

const read = (look: string): Record<string, ModelFile> => JSON.parse(readFileSync(new URL(`../../public/models/${look}.json`, import.meta.url), 'utf8')) as Record<string, ModelFile>;

/** How many edges of a model are not shared by exactly two faces, and how many separate pieces it is in. */
function soundness(m: ModelFile): { open: number; pieces: number } {
  const corners = Math.max(...m.f) + 1;
  const edges = new Map<number, number>();
  const group = Array.from({ length: corners }, (_, i) => i);
  const find = (i: number): number => {
    while (group[i] !== i) i = group[i] = group[group[i] as number] as number;
    return i;
  };
  for (let i = 0; i < m.f.length; i += 3) {
    const tri = [m.f[i] as number, m.f[i + 1] as number, m.f[i + 2] as number];
    for (let k = 0; k < 3; k++) {
      const a = tri[k] as number;
      const b = tri[(k + 1) % 3] as number;
      const key = Math.min(a, b) * corners + Math.max(a, b);
      edges.set(key, (edges.get(key) ?? 0) + 1);
      group[find(a)] = find(b);
    }
  }
  const used = new Set(m.f);
  return { open: [...edges.values()].filter((n) => n !== 2).length, pieces: new Set([...used].map(find)).size };
}

// The models are made by tools/models/make-models.mjs. A generated shape is a skin with gaps
// in it until the converter makes one solid of it; these fail if that step is ever lost.
describe('made models', () => {
  for (const look of ['facet', 'park', 'smooth']) {
    it(`has no holes and no loose pieces in the ${look} look`, () => {
      const models = read(look);
      expect(Object.keys(models).length).toBeGreaterThanOrEqual(16);
      for (const [id, m] of Object.entries(models)) {
        expect(soundness(m), id).toEqual({ open: 0, pieces: 1 });
        expect(m.f.length / 3, id).toBeLessThanOrEqual(2000);
        expect(m.c.length, id).toBe(m.f.length / 3);
      }
    });
  }
});
