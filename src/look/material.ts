import * as THREE from 'three/webgpu';

/**
 * How things are lit. As the game was made, light falls off smoothly as a face turns from the
 * sun. In the print look it falls in steps instead, so that every face is one of a few flat
 * tones, with a hard edge between light and shade, as on a screen-printed poster.
 *
 * Everything that is lit asks `lit()` for its material, so the whole scene changes together.
 * The print's material is three.js's own toon material: a plain one, with nothing of ours in
 * its shader, so that WebGPU and WebGL draw it alike.
 */
let printed = false;
let steps: THREE.DataTexture | null = null;

/**
 * The tones a printed face may take, from facing away from the sun to facing it. Half of them
 * are shade; the lit half climbs in six small steps, the first of them just before a face turns
 * to the sun. Small, because the sun is low in winter and level ground then sits near a step:
 * a big one breaks a flat field into patches, and a slope into splinters.
 */
export const PRINT_TONES: readonly number[] = [0, 0, 0, 0, 0, 0, 0, 0.14, 0.3, 0.3, 0.48, 0.48, 0.66, 0.66, 0.82, 0.95];

/** Say, before anything is built, whether the scene is printed. */
export function usePrint(on: boolean): void {
  printed = on;
}

export function isPrinted(): boolean {
  return printed;
}

function tones(): THREE.DataTexture {
  if (!steps) {
    const data = new Uint8Array(PRINT_TONES.length * 4);
    PRINT_TONES.forEach((t, i) => data.set([Math.round(t * 255), Math.round(t * 255), Math.round(t * 255), 255], i * 4));
    steps = new THREE.DataTexture(data, PRINT_TONES.length, 1, THREE.RGBAFormat);
    // No blending between one tone and the next: that is the whole point.
    steps.minFilter = THREE.NearestFilter;
    steps.magFilter = THREE.NearestFilter;
    steps.generateMipmaps = false;
    steps.needsUpdate = true;
  }
  return steps;
}

/** A material for something the sun lights: smooth as ever, or in the print's steps. */
export function lit(params: THREE.MeshLambertMaterialParameters = {}): THREE.MeshLambertMaterial {
  if (!printed) return new THREE.MeshLambertMaterial(params);
  // The two take the same settings and are used the same way from here on.
  // The toon material has no flat shading of its own: a shape that wants facets brings a normal for each face.
  const { flatShading: _flat, ...rest } = params;
  return new THREE.MeshToonMaterial({ ...(rest as THREE.MeshToonMaterialParameters), gradientMap: tones() }) as unknown as THREE.MeshLambertMaterial;
}
