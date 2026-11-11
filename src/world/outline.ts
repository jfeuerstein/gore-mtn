import * as THREE from 'three/webgpu';
import { OUTLINE, rim } from '../look/print';

/**
 * A shape with its outline: the same geometry with a dark rim added round it (`rim` in
 * `look/print.ts`), as one geometry, so that the outline costs triangles but no draw call. For
 * anything drawn one-sided with its colours on its corners: a tree, a stone, a part of a figure.
 *
 * @param width how far the rim stands out, in the geometry's own units
 * @param from the first corner to give a rim to: what comes before it (a trunk, say) is left bare
 * @returns a new geometry; the one given is not changed
 */
export function outlined(geometry: THREE.BufferGeometry, width: number, from = 0): THREE.BufferGeometry {
  const flat = geometry.index ? geometry.toNonIndexed() : geometry;
  const at = flat.getAttribute('position');
  const colour = flat.getAttribute('color');
  const count = at.count;
  const round = rim((at.array as Float32Array).subarray(from * 3, count * 3), width);
  const extra = round.length / 3;
  const positions = new Float32Array((count + extra) * 3);
  positions.set((at.array as Float32Array).subarray(0, count * 3));
  positions.set(round, count * 3);
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const ink = new THREE.Color(OUTLINE);
  const colours = new Float32Array((count + extra) * 3);
  if (colour) colours.set((colour.array as Float32Array).subarray(0, count * 3));
  else colours.fill(1, 0, count * 3);
  for (let i = count; i < count + extra; i++) colours.set([ink.r, ink.g, ink.b], i * 3);
  out.setAttribute('color', new THREE.BufferAttribute(colours, 3));
  const uv = flat.getAttribute('uv');
  if (uv) {
    const uvs = new Float32Array((count + extra) * 2);
    uvs.set((uv.array as Float32Array).subarray(0, count * 2));
    out.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  }
  // A way of facing for every face, the rim's included: the print's light falls on faces, not on corners.
  out.computeVertexNormals();
  out.computeBoundingBox();
  out.computeBoundingSphere();
  out.userData = { ...geometry.userData };
  return out;
}

/** A geometry with every colour on it turned into one flat colour per face, taken from the face's first corner. */
export function flatColoured(geometry: THREE.BufferGeometry, ink: (hex: number) => number): THREE.BufferGeometry {
  const flat = geometry.index ? geometry.toNonIndexed() : geometry;
  const colour = flat.getAttribute('color');
  if (!colour) return flat;
  const c = new THREE.Color();
  for (let t = 0; t + 2 < colour.count; t += 3) {
    // The middle of the three, so that a face shaded from dark to light takes a tone between.
    c.setRGB((colour.getX(t) + colour.getX(t + 1) + colour.getX(t + 2)) / 3, (colour.getY(t) + colour.getY(t + 1) + colour.getY(t + 2)) / 3, (colour.getZ(t) + colour.getZ(t + 1) + colour.getZ(t + 2)) / 3);
    c.setHex(ink(c.getHex()));
    for (let k = 0; k < 3; k++) colour.setXYZ(t + k, c.r, c.g, c.b);
  }
  colour.needsUpdate = true;
  return flat;
}
