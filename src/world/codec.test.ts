import { describe, expect, it } from 'vitest';
import { isGzip, unpackHeights } from './codec';

describe('unpackHeights', () => {
  it('rebuilds heights from west-to-east differences', () => {
    // Heights:  10 12 11      Stored: 10  2 -1
    //           13 13 20              3   0  7
    const packed = new Uint16Array([10, 2, 65535, 3, 0, 7]);
    expect([...unpackHeights(packed, 3, 2)]).toEqual([10, 12, 11, 13, 13, 20]);
  });

  it('wraps differences at 65536', () => {
    expect([...unpackHeights(new Uint16Array([65000, 1000]), 2, 1)]).toEqual([65000, 464]);
  });

  it('rejects data of the wrong size', () => {
    expect(() => unpackHeights(new Uint16Array(5), 3, 2)).toThrow();
  });
});

describe('isGzip', () => {
  it('recognises the gzip signature', () => {
    expect(isGzip(new Uint8Array([0x1f, 0x8b, 8, 0]))).toBe(true);
    expect(isGzip(new Uint8Array([0, 1, 2, 3]))).toBe(false);
  });
});
