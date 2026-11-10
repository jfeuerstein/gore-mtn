import { describe, expect, it } from 'vitest';
import { DEFAULTS, parseConfig, withParams } from './config';
import { makeRng } from './rng';

describe('parseConfig', () => {
  it('uses defaults for an empty query', () => {
    expect(parseConfig('')).toEqual(DEFAULTS);
  });

  it('reads options and clamps them to sane ranges', () => {
    const c = parseConfig('?renderer=webgl&trees=20000&dpr=9&shadows=0&stride=0&at=summit&pos=12.5,-3&yaw=1.5');
    expect(c.renderer).toBe('webgl');
    expect(c.trees).toBe(20000);
    expect(c.dpr).toBe(3);
    expect(c.shadows).toBe(false);
    expect(parseConfig('?shadows=1').shadows).toBe(true);
    expect(c.stride).toBe(1);
    expect(c.at).toBe('summit');
    expect(c.pos).toEqual({ x: 12.5, z: -3 });
    expect(c.yaw).toBe(1.5);
    expect(c.pitch).toBeNull();
    expect(c.zoom).toBe(1);
    expect(parseConfig('?zoom=1.3').zoom).toBe(1.3);
    expect(parseConfig('?zoom=99').zoom).toBe(3);
  });

  it('ignores junk values', () => {
    const c = parseConfig('?trees=lots&pos=here&renderer=vulkan');
    expect(c.trees).toBe(DEFAULTS.trees);
    expect(c.pos).toBeNull();
    expect(c.renderer).toBe('webgpu');
  });
});

describe('look', () => {
  it('comes from the address first, then from what was remembered, then the default', () => {
    expect(parseConfig('?look=golden', { look: 'snowfall' }).look).toBe('golden');
    expect(parseConfig('', { look: 'snowfall' }).look).toBe('snowfall');
    expect(parseConfig('').look).toBe(DEFAULTS.look);
  });

  it('ignores a look that does not exist', () => {
    expect(parseConfig('?look=neon').look).toBe(DEFAULTS.look);
    expect(parseConfig('', { look: 'gone' }).look).toBe(DEFAULTS.look);
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
