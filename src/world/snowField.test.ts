import * as THREE from 'three/webgpu';
import { describe, expect, it } from 'vitest';
import { SnowField, type SnowGround } from './snowField';

/** A slope with a road across it at z = 20 to 24, where no snow lies. */
const hill: SnowGround = {
  heightAt: (x, z) => 100 - z * 0.2 + x * 0.05,
  depthAt: (_x, z) => (z > 20 && z < 24 ? 0 : 0.3),
  colourAt: (_x, _z, into) => void into.setRGB(0.8, 0.85, 0.9),
};
const none = (): never[] => [];

describe('the snow that lies in a layer', () => {
  it('lies as deep as the ground says, and not on the road', () => {
    const field = new SnowField(hill);
    field.follow(0, 0, none);
    expect(field.depthAt(0, 0)).toBeCloseTo(0.3, 2);
    expect(field.topAt(3, -4)).toBeCloseTo(0.3, 2);
    expect(field.topAt(0, 22)).toBe(0);
    // It comes up from the road's edge and is not a step there.
    expect(field.topAt(0, 19.6)).toBeGreaterThan(0);
    expect(field.topAt(0, 19.6)).toBeLessThan(0.3);
  });

  it('is nothing until it is laid, outside itself, and once it is cleared', () => {
    const field = new SnowField(hill);
    expect(field.topAt(0, 0)).toBe(0);
    field.follow(0, 0, none);
    expect(field.topAt(200, 0)).toBe(0);
    field.clear();
    expect(field.topAt(0, 0)).toBe(0);
    expect(field.mesh.visible).toBe(false);
  });

  it('is pushed down where somebody goes through it, and heaped beside', () => {
    const field = new SnowField(hill);
    field.follow(0, 0, none);
    for (let x = -5; x <= 5; x += 0.2) field.tread(x, 0, 0.4, 0.5);
    field.update();
    // The floor of the trough, all along it; its side coming up; the lip, higher than the snow lay; and beyond, untouched.
    for (const x of [-4, -1, 0, 2.5, 4]) expect(field.topAt(x, 0)).toBeLessThan(0.06);
    expect(field.topAt(0, 0.66)).toBeGreaterThan(field.topAt(0, 0));
    expect(field.topAt(0, 1.15)).toBeGreaterThan(0.31);
    expect(field.topAt(0, 3)).toBeCloseTo(0.3, 2);
    // How deep it lay is not forgotten.
    expect(field.depthAt(0, 0)).toBeCloseTo(0.3, 2);
  });

  it('does not join one trough to the next across a gap', () => {
    const field = new SnowField(hill);
    field.follow(0, 0, none);
    field.tread(-6, 0, 0.4, 0.5);
    field.lift();
    field.tread(6, 0, 0.4, 0.5);
    expect(field.topAt(0, 0)).toBeCloseTo(0.3, 2);
  });

  it('keeps a trough where it was cut when it moves on', () => {
    const field = new SnowField(hill);
    field.follow(0, 0, none);
    for (let x = -3; x <= 3; x += 0.2) field.tread(x, 0, 0.4, 0.5);
    let moves = 0;
    // Off down the hill and across it, a third of a metre a frame.
    for (let step = 1; step <= 60; step++) if (field.follow(step * 0.25, -step * 0.3, none)) moves++;
    expect(moves).toBeGreaterThan(2);
    expect(field.topAt(0, 0)).toBeLessThan(0.06);
    expect(field.topAt(2, 0)).toBeLessThan(0.06);
    expect(field.topAt(0, 3)).toBeCloseTo(0.3, 2);
    // What has come into the field is as the ground says: snow, and the road.
    expect(field.topAt(15, -18)).toBeCloseTo(0.3, 2);
    // And every point is where it says it is, at the height of the snow there.
    const at = field.mesh.geometry.getAttribute('position');
    for (let i = 0; i < at.count; i += 97) {
      const x = at.getX(i);
      const z = at.getZ(i);
      // On its own top where the snow lies; well under the ground where none does (the road), and at the field's edge.
      const y = at.getY(i) - hill.heightAt(x, z);
      if (field.depthAt(x, z) >= 0.05 && field.topAt(x, z) >= 0.02) expect(y).toBeCloseTo(field.topAt(x, z), 3);
      else expect(y).toBeLessThan(field.topAt(x, z) + 0.001);
      if (field.depthAt(x, z) === 0) expect(y).toBeLessThan(-0.25);
    }
  });

  it('starts afresh when the player is carried right away', () => {
    const field = new SnowField(hill);
    field.follow(0, 0, none);
    field.tread(0, 0, 0.4, 0.5);
    expect(field.follow(500, 0, none)).toBe(true);
    field.follow(0, 0, none);
    expect(field.topAt(0, 0)).toBeCloseTo(0.3, 2);
  });

  it('leaves what is lying on the ground uncovered', () => {
    const field = new SnowField(hill);
    field.follow(0, 0, () => [{ x: 4, z: 4, r: 0.8 }]);
    expect(field.topAt(4, 4)).toBeLessThan(0.02);
    expect(field.topAt(4, 6)).toBeCloseTo(0.3, 2);
    field.uncover([{ x: -4, z: 4, r: 0.8 }]);
    expect(field.topAt(-4, 4)).toBeLessThan(0.02);
  });

  it('sends the graphics card everything it has changed, however the frames fall: what is drawn is what is there', () => {
    const field = new SnowField(hill);
    const names = ['position', 'normal', 'color'] as const;
    // What the graphics card holds, kept as the renderer keeps it: the whole of an attribute when no part is named,
    // and otherwise only the parts that are named, after which the names are forgotten.
    const card = new Map<string, Float32Array>();
    const versions = new Map<string, number>();
    const render = (): void => {
      for (const name of names) {
        const attribute = field.mesh.geometry.getAttribute(name) as THREE.BufferAttribute;
        if (versions.get(name) === attribute.version) continue;
        versions.set(name, attribute.version);
        const array = attribute.array as Float32Array;
        // (The first time, the buffer is made from the whole of it, whatever is named.)
        const first = !card.has(name);
        const held = card.get(name) ?? new Float32Array(array.length);
        card.set(name, held);
        if (first || attribute.updateRanges.length === 0) held.set(array);
        else for (const range of attribute.updateRanges) held.set(array.subarray(range.start, range.start + range.count), range.start);
        attribute.clearUpdateRanges();
      }
    };
    const same = (): boolean => names.every((name) => {
      const array = (field.mesh.geometry.getAttribute(name) as THREE.BufferAttribute).array as Float32Array;
      const held = card.get(name) as Float32Array;
      for (let i = 0; i < array.length; i++) if (array[i] !== held[i]) return false;
      return true;
    });
    // A long run down and across the hill, treading snow every frame, as a skier does: the sheet moves under them many times.
    let moves = 0;
    for (let frame = 0; frame < 400; frame++) {
      const x = frame * 0.3;
      const z = -frame * 0.22;
      if (field.follow(x, z, none)) moves++;
      field.tread(x, z, 0.5, 0.5);
      field.update();
      // Now and then a frame is not drawn at all (a sheet is up over the picture): nothing may be lost by that.
      if (frame % 17 !== 5) {
        render();
        expect(same(), `frame ${frame}`).toBe(true);
      }
    }
    expect(moves).toBeGreaterThan(20);
  });
});

