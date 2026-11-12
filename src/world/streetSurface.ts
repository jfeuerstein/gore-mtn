import * as THREE from 'three/webgpu';
import type { Season } from '../look/season';
import { buildRoute, routePoint } from './crowd';
import { HIGH_STREET_HALF, SIDEWALK, type Strip } from './roadways';

/**
 * The surface of the streets, laid over the ground: a ploughed road with the snow banked up
 * along it in winter, blacktop the rest of the year, and a sidewalk down each side of Main
 * Street, its slabs marked, and places to park marked off along the kerbs. One mesh, coloured
 * on its vertices. See `roadways.ts` for which roads have one.
 */

/** How far above the ground the roadway lies, in metres: enough to clear the ground between its own points, and no more, since feet stand on the ground. */
const LIFT = 0.09;
/** A sidewalk stands a little above its street. */
const KERB = 0.07;

interface Edge {
  /** Metres to the right of the middle of the road. */
  off: number;
  /** Metres above the ground. */
  up: number;
  /** The colour of the surface from this edge to the next. */
  colour: number;
  /** What is marked on it from this edge to the next: the joints between a sidewalk's slabs, or the lines between parking places. */
  marks?: 'slabs' | 'bays';
}

/** How wide the lane along each kerb of the high street is that cars park in, in metres. */
const PARKING = 2.3;
/** The paint the parking places are marked in. */
const PAINT = 0xe6e2d6;
/** The marks repeat this often along a street, in metres: four slabs of sidewalk, one parking place. */
const MARK_EVERY = 6.4;

let marked: { tar: number; texture: THREE.Texture } | null = null;

/**
 * The marks on a street, as a small texture that only varies along it and multiplies the
 * colour under it, as the boards on a wall do: plain down its first third, a hard line across
 * at every joint of a sidewalk down its second, and down its third the blacktop's own colour
 * (over a face painted the colour of road paint) with one bar of the paint left showing, which
 * is the line between two parking places. Null where there is no canvas to draw it on.
 */
function streetMarks(tar: number): THREE.Texture | null {
  if (marked && marked.tar === tar) return marked.texture;
  if (typeof document === 'undefined') return null;
  const canvas = document.createElement('canvas');
  // As wide as three times its height, so that each third is still its own when the texture is
  // read small, far down the street: narrower, the thirds ran into one another there.
  const third = 256;
  canvas.width = third * 3;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, third * 3, 256);
  // Slabs: a joint every quarter of the way.
  ctx.fillStyle = 'rgb(176, 176, 176)';
  for (let k = 0; k < 4; k++) ctx.fillRect(third, k * 64, third, 3);
  // Bays: what turns the paint into blacktop, worked out in light and not in the numbers a colour is written in.
  const paint = new THREE.Color(PAINT);
  const black = new THREE.Color(tar);
  const turn = new THREE.Color().setRGB(black.r / paint.r, black.g / paint.g, black.b / paint.b);
  ctx.fillStyle = `#${turn.getHexString()}`;
  ctx.fillRect(third * 2, 0, third, 256);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(third * 2, 0, third, 5);
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  // Far off, the lines must run together into one flat tone, not flicker against the pixels.
  texture.generateMipmaps = true;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  marked = { tar, texture };
  return texture;
}

/** The blacktop's colour in a season. */
const tarOf = (season: Season): number => (season === 'spring' ? 0x4a4e56 : 0x5a5e66);

/** What a street is, from one side to the other, this season. */
function section(strip: Strip, season: Season): Edge[] {
  const h = strip.half;
  const winter = season === 'winter';
  // Ploughed and packed: paler where it is left alone, greyer where the wheels run.
  const packed = 0xdde1e8;
  const worn = 0xbfc5cf;
  const tar = tarOf(season);
  const edges: Edge[] = [];
  if (strip.sidewalks) {
    const walk = winter ? 0xcfd4dc : 0xb9b5ab;
    // The sidewalk, then (in winter) the bank the plough leaves, then the road, and the same again on the other side.
    const left: Edge[] = winter
      ? [
          { off: -SIDEWALK.to, up: LIFT + KERB, colour: walk },
          { off: -SIDEWALK.from, up: LIFT + KERB, colour: 0xf2f5fa },
          { off: -(SIDEWALK.from + HIGH_STREET_HALF) / 2, up: LIFT + 0.5, colour: 0xe9edf3 },
        ]
      : [
          { off: -SIDEWALK.to, up: LIFT + KERB, colour: walk, marks: 'slabs' },
          { off: -SIDEWALK.from + 0.45, up: LIFT + KERB, colour: 0x8f8c84 },
        ];
    edges.push(...left);
  }
  if (winter) {
    edges.push({ off: -h, up: LIFT, colour: packed }, { off: -h * 0.66, up: LIFT, colour: worn }, { off: -h * 0.3, up: LIFT, colour: packed }, { off: h * 0.3, up: LIFT, colour: worn }, { off: h * 0.66, up: LIFT, colour: packed });
  } else if (strip.sidewalks) {
    // A double yellow line down the middle of the high street.
    // And a lane to park in along each kerb, marked off in places.
    edges.push({ off: -h, up: LIFT, colour: PAINT, marks: 'bays' }, { off: -h + PARKING, up: LIFT, colour: tar }, { off: -0.16, up: LIFT, colour: 0xd9b441 }, { off: 0.16, up: LIFT, colour: tar }, { off: h - PARKING, up: LIFT, colour: PAINT, marks: 'bays' });
  } else {
    edges.push({ off: -h, up: LIFT, colour: tar }, { off: 0, up: LIFT, colour: tar });
  }
  edges.push({ off: h, up: LIFT, colour: 0 });
  if (strip.sidewalks) {
    const walk = winter ? 0xcfd4dc : 0xb9b5ab;
    const last = edges[edges.length - 1] as Edge;
    if (winter) {
      last.colour = 0xe9edf3;
      edges.push({ off: (SIDEWALK.from + HIGH_STREET_HALF) / 2, up: LIFT + 0.5, colour: 0xf2f5fa }, { off: SIDEWALK.from, up: LIFT + KERB, colour: walk }, { off: SIDEWALK.to, up: LIFT + KERB, colour: 0 });
    } else {
      last.colour = 0x8f8c84;
      edges.push({ off: SIDEWALK.from - 0.45, up: LIFT + KERB, colour: walk, marks: 'slabs' }, { off: SIDEWALK.to, up: LIFT + KERB, colour: 0 });
    }
  }
  return edges;
}

/** The streets' surfaces as one geometry. */
export function buildStreetSurface(strips: readonly Strip[], heightAt: (x: number, z: number) => number, season: Season): THREE.BufferGeometry {
  const positions: number[] = [];
  const colours: number[] = [];
  const uvs: number[] = [];
  const c = new THREE.Color();
  /** A corner is its place and, last, how far along the street it is. */
  const tri = (a: number[], b: number[], d: number[], edge: Edge): void => {
    // Whichever way round it comes, a road faces up.
    const ny = ((b[2] as number) - (a[2] as number)) * ((d[0] as number) - (a[0] as number)) - ((b[0] as number) - (a[0] as number)) * ((d[2] as number) - (a[2] as number));
    // Which third of the marks this face reads from, across; and how far along the street, down.
    const u = edge.marks === 'slabs' ? 0.5 : edge.marks === 'bays' ? 5 / 6 : 1 / 6;
    for (const corner of [a, ny >= 0 ? b : d, ny >= 0 ? d : b]) {
      positions.push(corner[0] as number, corner[1] as number, corner[2] as number);
      uvs.push(u, (corner[3] as number) / MARK_EVERY);
    }
    c.setHex(edge.colour);
    for (let i = 0; i < 3; i++) colours.push(c.r, c.g, c.b);
  };
  for (const strip of strips) {
    const edges = section(strip, season);
    const route = buildRoute(strip.pts);
    const n = strip.pts.length / 2;
    // Each cross-section: a point for every edge, on the ground.
    const rows: number[][][] = [];
    for (let i = 0; i < n; i++) {
      const d = route.at[i] as number;
      const a = routePoint(route, d - 2);
      const b = routePoint(route, d + 2);
      const len = Math.hypot(b.x - a.x, b.z - a.z) || 1;
      // To the right of the way the road runs.
      const rx = -(b.z - a.z) / len;
      const rz = (b.x - a.x) / len;
      const px = strip.pts[i * 2] as number;
      const pz = strip.pts[i * 2 + 1] as number;
      rows.push(edges.map((e) => [px + rx * e.off, heightAt(px + rx * e.off, pz + rz * e.off) + e.up, pz + rz * e.off, d]));
    }
    for (let i = 0; i + 1 < n; i++) {
      for (let j = 0; j + 1 < edges.length; j++) {
        const edge = edges[j] as Edge;
        const p = (rows[i] as number[][])[j] as number[];
        const q = (rows[i] as number[][])[j + 1] as number[];
        const r = (rows[i + 1] as number[][])[j + 1] as number[];
        const s = (rows[i + 1] as number[][])[j] as number[];
        tri(p, q, r, edge);
        tri(p, r, s, edge);
      }
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colours, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.computeVertexNormals();
  geo.computeBoundingSphere();
  return geo;
}

/** The streets, as a mesh that takes the light and the shadows of what stands along it. */
export function streetSurfaceMesh(strips: readonly Strip[], heightAt: (x: number, z: number) => number, season: Season): THREE.Mesh | null {
  if (strips.length === 0) return null;
  // Drawn as if a hair nearer than it is, so that it never flickers against the ground just under it.
  const mesh = new THREE.Mesh(buildStreetSurface(strips, heightAt, season), new THREE.MeshLambertMaterial({ vertexColors: true, map: streetMarks(tarOf(season)), polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4 }));
  mesh.name = 'streets';
  mesh.receiveShadow = true;
  mesh.matrixAutoUpdate = false;
  return mesh;
}
