import { describe, expect, it } from 'vitest';
import { DEFAULTS, parseConfig, withParams } from './config';
import { makeRng } from './rng';

describe('parseConfig', () => {
  it('uses defaults for an empty query', () => {
    expect(parseConfig('')).toEqual(DEFAULTS);
  });

  it('reads options and clamps them to sane ranges', () => {
    const c = parseConfig('?renderer=webgl&trees=40000&dpr=9&shadows=1&stride=0&at=summit&pos=12.5,-3&yaw=1.5');
    expect(c.renderer).toBe('webgl');
    expect(c.trees).toBe(40000);
    expect(c.dpr).toBe(3);
    expect(c.shadows).toBe(true);
    expect(c.stride).toBe(1);
    expect(c.at).toBe('summit');
    expect(c.pos).toEqual({ x: 12.5, z: -3 });
    expect(c.yaw).toBe(1.5);
    expect(c.pitch).toBeNull();
  });

  it('ignores junk values', () => {
    const c = parseConfig('?trees=lots&pos=here&renderer=vulkan');
    expect(c.trees).toBe(DEFAULTS.trees);
    expect(c.pos).toBeNull();
    expect(c.renderer).toBe('webgpu');
  });
});

describe('withParams', () => {
  it('sets, replaces and removes options', () => {
    expect(withParams('?trees=5000', { trees: '20000' })).toBe('?trees=20000');
    expect(withParams('?trees=5000&dpr=1', { trees: null })).toBe('?dpr=1');
    expect(withParams('?trees=5000', { trees: null })).toBe('');
  });
});

describe('makeRng', () => {
  it('repeats exactly for the same seed and stays within 0..1', () => {
    const a = makeRng(42);
    const b = makeRng(42);
    const seq = Array.from({ length: 200 }, () => a());
    expect(seq).toEqual(Array.from({ length: 200 }, () => b()));
    expect(seq.every((v) => v >= 0 && v < 1)).toBe(true);
    expect(makeRng(43)()).not.toBe(seq[0]);
  });
});
