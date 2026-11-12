import * as THREE from 'three/webgpu';

const { Fn, texture, vec2, float, smoothstep } = THREE.TSL;

/** How far apart the nine readings of the shadow are taken, in pixels of the shadow's own picture. */
const SPREAD = 1.4;

/**
 * A shadow as a print has it: one flat tone with a clean edge. three.js's own shadow has a
 * soft edge made by reading the shadow's picture at a few places that are different for
 * every pixel of the screen, which gives a band of grain between light and shade. Here the
 * picture is read at the same nine places round each pixel, which gives an even slope from
 * light to shade, and the slope is cut at its middle: lit on one side, shaded on the other,
 * and the line between them a smooth one that does not follow the shadow picture's pixels.
 *
 * The other of the game's two shaders of its own (the ground's is the first). It is given to
 * the sun's shadow as its `filterNode`, which three.js calls in place of its own filter.
 */
export function printShadow(mapSize: number): unknown {
  const texel = 1 / mapSize;
  return Fn(({ depthTexture, shadowCoord }: { depthTexture: THREE.Texture; shadowCoord: THREE.Node<'vec3'> }) => {
    const at = (dx: number, dy: number) =>
      texture(depthTexture, shadowCoord.xy.add(vec2(dx * texel * SPREAD, dy * texel * SPREAD))).compare(shadowCoord.z);
    const readings = [];
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) readings.push(at(dx, dy));
    // A reading comes back as a colour; its first part is the answer: 1 lit, 0 in shade.
    const lit = readings.reduce((sum, reading) => sum.add(reading.x), float(0) as THREE.Node<'float'>);
    return smoothstep(0.44, 0.56, lit.div(9));
  });
}
