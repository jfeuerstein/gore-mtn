import * as THREE from 'three/webgpu';

/**
 * Models made outside the game: a shape generated from a picture, thinned and flattened by
 * tools/models/convert.py into a few hundred triangles of a few flat colours. They are loaded
 * as one small file for each look (`public/models/<look>.json`), every model in it by id, and
 * drawn with the same plain material as everything built from blocks.
 */
export interface ModelFile {
  /** Corner positions, x y z, in thousandths of the model's height; it stands on y = 0 and faces -z. */
  v: number[];
  /** Triangles, three corners each. */
  f: number[];
  /** Each triangle's colour, as a place in `p`. */
  c: number[];
  p: string[];
  /** Shaded smooth, as a soft toy; otherwise every triangle is flat. */
  smooth: boolean;
  /** Drawn with a dark line round it, as a print is. */
  outline: boolean;
}

/** The looks a model can be had in, besides the game's own blocks. */
export const MODEL_LOOKS = ['park'] as const;
export type ModelLook = (typeof MODEL_LOOKS)[number];

/** Every model of one look, by id. Nothing, if the file cannot be had: the blocks are used instead. */
export async function loadModels(look: ModelLook, baseUrl: string): Promise<Record<string, ModelFile>> {
  try {
    const res = await fetch(`${baseUrl}models/${look}.json`);
    return res.ok ? ((await res.json()) as Record<string, ModelFile>) : {};
  } catch {
    return {};
  }
}

/** The inks of things that grow, and what each is under snow: moss and leaves in winter. */
const UNDER_SNOW: Readonly<Record<string, string>> = { '#a9c98a': '#f2f5fa', '#6fa35c': '#f2f5fa', '#4f8a3f': '#d3dae4', '#2f6b4f': '#d3dae4' };

/**
 * A made model's winter self, for one that has none of its own: the same shape with whatever
 * was printed in a green printed in snow. (A den and a shack were modelled twice; a ruin with
 * moss on it only needs its moss snowed over.)
 */
export function snowed(file: ModelFile): ModelFile {
  return { ...file, p: file.p.map((ink) => UNDER_SNOW[ink.toLowerCase()] ?? ink) };
}

/**
 * A model as geometry, stood `height` metres tall.
 * @returns the geometry, and for a look that has one, the shell that is drawn behind it as its outline
 */
export function modelGeometry(file: ModelFile, height: number): { geometry: THREE.BufferGeometry; shell: THREE.BufferGeometry | null } {
  const k = height / 1000;
  const corners = file.v.length / 3;
  const colour = file.p.map((hex) => new THREE.Color(hex));
  // A normal for every corner, from the triangles that meet there: for smooth shading, and for pushing the outline out.
  const normal = new Float32Array(corners * 3);
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const c = new THREE.Vector3();
  const at = (i: number, into: THREE.Vector3): THREE.Vector3 => into.set((file.v[i * 3] as number) * k, (file.v[i * 3 + 1] as number) * k, (file.v[i * 3 + 2] as number) * k);
  for (let t = 0; t < file.f.length; t += 3) {
    const i = file.f[t] as number;
    const j = file.f[t + 1] as number;
    const l = file.f[t + 2] as number;
    at(i, a);
    at(j, b);
    at(l, c);
    // Not made unit length, so that a big triangle counts for more than a small one.
    const n = b.sub(a).cross(c.sub(a));
    for (const corner of [i, j, l]) {
      normal[corner * 3] = (normal[corner * 3] as number) + n.x;
      normal[corner * 3 + 1] = (normal[corner * 3 + 1] as number) + n.y;
      normal[corner * 3 + 2] = (normal[corner * 3 + 2] as number) + n.z;
    }
  }
  for (let i = 0; i < corners; i++) {
    const len = Math.hypot(normal[i * 3] as number, normal[i * 3 + 1] as number, normal[i * 3 + 2] as number) || 1;
    normal[i * 3] = (normal[i * 3] as number) / len;
    normal[i * 3 + 1] = (normal[i * 3 + 1] as number) / len;
    normal[i * 3 + 2] = (normal[i * 3 + 2] as number) / len;
  }
  const positions: number[] = [];
  const normals: number[] = [];
  const colours: number[] = [];
  const shell: number[] = [];
  // How far out the outline stands: a little, against the size of the thing.
  const ink = height * 0.022;
  const second = new THREE.Vector3();
  const third = new THREE.Vector3();
  const face = new THREE.Vector3();
  for (let t = 0; t < file.f.length; t += 3) {
    const tint = colour[file.c[t / 3] as number] ?? colour[0] ?? new THREE.Color(0x888888);
    // A faceted look is lit face by face: each corner of a face carries the way the face looks.
    at(file.f[t] as number, a);
    at(file.f[t + 1] as number, second);
    at(file.f[t + 2] as number, third);
    face.copy(second.sub(a)).cross(third.sub(a)).normalize();
    for (let e = 0; e < 3; e++) {
      const i = file.f[t + e] as number;
      at(i, a);
      positions.push(a.x, a.y, a.z);
      if (file.smooth) normals.push(normal[i * 3] as number, normal[i * 3 + 1] as number, normal[i * 3 + 2] as number);
      else normals.push(face.x, face.y, face.z);
      colours.push(tint.r, tint.g, tint.b);
      if (file.outline) shell.push(a.x + (normal[i * 3] as number) * ink, a.y + (normal[i * 3 + 1] as number) * ink, a.z + (normal[i * 3 + 2] as number) * ink);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colours, 3));
  // A flat-shaded material works its own normals out; a smooth one needs these.
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  let hull: THREE.BufferGeometry | null = null;
  if (file.outline) {
    hull = new THREE.BufferGeometry();
    hull.setAttribute('position', new THREE.Float32BufferAttribute(shell, 3));
    hull.computeBoundingSphere();
  }
  return { geometry, shell: hull };
}

/**
 * Several made models as one: each stood at a place of its own and turned. For things that
 * are set down together and never move apart (a tent and the fire in front of it).
 */
export function joinModels(parts: readonly { file: ModelFile; tall: number; x?: number; y?: number; z?: number; turn?: number }[]): { geometry: THREE.BufferGeometry; shell: THREE.BufferGeometry | null } {
  const made = parts.map((part) => {
    const one = modelGeometry(part.file, part.tall);
    for (const geo of [one.geometry, one.shell]) {
      if (!geo) continue;
      if (part.turn) geo.rotateY(part.turn);
      geo.translate(part.x ?? 0, part.y ?? 0, part.z ?? 0);
    }
    return one;
  });
  const join = (name: string, list: readonly THREE.BufferGeometry[]): THREE.Float32BufferAttribute => {
    const all = new Float32Array(list.reduce((n, geo) => n + geo.getAttribute(name).array.length, 0));
    let at = 0;
    for (const geo of list) {
      all.set(geo.getAttribute(name).array as Float32Array, at);
      at += geo.getAttribute(name).array.length;
    }
    return new THREE.Float32BufferAttribute(all, 3);
  };
  const geometry = new THREE.BufferGeometry();
  for (const name of ['position', 'color', 'normal']) geometry.setAttribute(name, join(name, made.map((m) => m.geometry)));
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  const shells = made.flatMap((m) => (m.shell ? [m.shell] : []));
  let shell: THREE.BufferGeometry | null = null;
  if (shells.length > 0) {
    shell = new THREE.BufferGeometry();
    shell.setAttribute('position', join('position', shells));
    shell.computeBoundingSphere();
  }
  return { geometry, shell };
}
