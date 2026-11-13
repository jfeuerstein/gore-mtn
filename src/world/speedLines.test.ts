import * as THREE from 'three/webgpu';
import { describe, expect, it } from 'vitest';
import { SKI } from '../player/skiPhysics';
import { linesFor, LINES_FROM, LINES_FULL, SpeedLines } from './speedLines';

describe('speed lines', () => {
  it('are not there at a walk or while poling, and are all out at full speed', () => {
    expect(linesFor(0)).toBe(0);
    // Poling along the flat is not fast: the lines are for the hill.
    expect(linesFor(SKI.poleMaxSpeed)).toBe(0);
    expect(linesFor(LINES_FROM)).toBe(0);
    expect(linesFor(LINES_FULL)).toBe(1);
    expect(linesFor(99)).toBe(1);
  });

  it('gather steadily in between', () => {
    let last = 0;
    for (let v = LINES_FROM; v <= LINES_FULL; v += 0.5) {
      expect(linesFor(v)).toBeGreaterThanOrEqual(last);
      last = linesFor(v);
    }
    expect(linesFor((LINES_FROM + LINES_FULL) / 2)).toBeCloseTo(0.5, 5);
  });
});

describe('the streaks themselves', () => {
  it('are never more than a sliver, from the first frame each is out, through turns and after being carried away', () => {
    const lines = new SpeedLines();
    const camera = new THREE.Vector3(-1800, 990, 1100);
    const velocity = new THREE.Vector3();
    const m = new THREE.Matrix4();
    const scale = new THREE.Vector3();
    let widest = 0;
    let most = 0;
    for (let frame = 0; frame < 900; frame++) {
      // Down a steep trail, gathering speed, weaving; and once, carried right across the mountain.
      const heading = Math.sin(frame / 40) * 0.9;
      const speed = Math.min(24, 8 + frame * 0.05);
      velocity.set(Math.sin(heading), -0.35, -Math.cos(heading)).normalize().multiplyScalar(speed);
      if (frame === 600) camera.set(2100, 30, -1800);
      camera.addScaledVector(velocity, 1 / 60);
      lines.update(1 / 60, camera, velocity);
      most = Math.max(most, lines.mesh.count);
      for (let i = 0; i < lines.mesh.count; i++) {
        lines.mesh.getMatrixAt(i, m);
        scale.setFromMatrixScale(m);
        widest = Math.max(widest, scale.x, scale.y);
      }
    }
    expect(most).toBeGreaterThan(40);
    // A tenth of a metre at the very most: one that was sized by where it had been was metres thick for a frame.
    expect(widest).toBeLessThan(0.11);
  });
});

