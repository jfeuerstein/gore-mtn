import { describe, expect, it } from 'vitest';
import { blocksSightLine } from './occlusion';

// Player at the origin, camera 16 m to the south and 10 m up, as on an upright phone.
const player = { x: 0, y: 1, z: 0 };
const camera = { x: 0, y: 11, z: 16 };
const tree = (x: number, z: number, y = 0) => ({ x, y, z });

describe('blocksSightLine', () => {
  it('finds a tall tree standing on the line of sight', () => {
    expect(blocksSightLine(player, camera, tree(0, 5), 1.5, 7)).toBe(true);
    expect(blocksSightLine(player, camera, tree(1, 6), 1.5, 7)).toBe(true);
  });

  it('ignores trees off to the side', () => {
    expect(blocksSightLine(player, camera, tree(4, 5), 1.5, 7)).toBe(false);
  });

  it('ignores trees behind the player and behind the camera', () => {
    expect(blocksSightLine(player, camera, tree(0, -5), 1.5, 7)).toBe(false);
    expect(blocksSightLine(player, camera, tree(0, 22), 1.5, 7)).toBe(false);
  });

  it('ignores a tree the line passes over', () => {
    // At z = 12 the sight line is 8.5 m up; a 5 m tree there is below it.
    expect(blocksSightLine(player, camera, tree(0, 12), 1.5, 5)).toBe(false);
    // The same tree on ground 5 m higher (the camera is uphill) does reach the line.
    expect(blocksSightLine(player, camera, tree(0, 12, 5), 1.5, 5)).toBe(true);
  });

  it('leaves alone a tree the player is standing right beside', () => {
    expect(blocksSightLine(player, camera, tree(0.3, 0.2), 1.5, 7)).toBe(false);
  });

  it('copes with the camera directly overhead', () => {
    expect(blocksSightLine(player, { x: 0, y: 20, z: 0 }, tree(0, 1), 1.5, 7)).toBe(false);
  });
});
