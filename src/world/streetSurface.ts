import * as THREE from 'three/webgpu';
import type { Season } from '../look/season';
import { buildRoute, routePoint } from './crowd';
import { HIGH_STREET_HALF, SIDEWALK, type Strip } from './roadways';

/**
 * The surface of the streets, laid over the ground: a ploughed road with the snow banked up
 * along it in winter, blacktop the rest of the year, and a sidewalk down each side of Main
 * Street. One mesh, coloured on its vertices. See `roadways.ts` for which roads have one.
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
}

/** What a street is, from one side to the other, this season. */
function section(strip: Strip, season: Season): Edge[] {
  const h = strip.half;
  const winter = season === 'winter';
  // Ploughed and packed: paler where it is left alone, greyer where the wheels run.
  const packed = 0xdde1e8;
  const worn = 0xbfc5cf;
  const tar = season === 'spring' ? 0x4a4e56 : 0x5a5e66;
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
          { off: -SIDEWALK.to, up: LIFT + KERB, colour: walk },
          { off: -SIDEWALK.from + 0.45, up: LIFT + KERB, colour: 0x8f8c84 },
        ];
    edges.push(...left);
  }
  if (winter) {
    edges.push({ off: -h, up: LIFT, colour: packed }, { off: -h * 0.66, up: LIFT, colour: worn }, { off: -h * 0.3, up: LIFT, colour: packed }, { off: h * 0.3, up: LIFT, colour: worn }, { off: h * 0.66, up: LIFT, colour: packed });
  } else if (strip.sidewalks) {
    // A double yellow line down the middle of the high street.
    edges.push({ off: -h, up: LIFT, colour: tar }, { off: -0.16, up: LIFT, colour: 0xd9b441 }, { off: 0.16, up: LIFT, colour: tar });
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
      edges.push({ off: SIDEWALK.from - 0.45, up: LIFT + KERB, colour: walk }, { off: SIDEWALK.to, up: LIFT + KERB, colour: 0 });
    }
  }
  return edges;
}

/** The streets' surfaces as one geometry. */
export function buildStreetSurface(strips: readonly Strip[], heightAt: (x: number, z: number) => number, season: Season): THREE.BufferGeometry {
  const positions: number[] = [];
  const colours: number[] = [];
  const c = new THREE.Color();
  const tri = (a: number[], b: number[], d: number[], colour: number): void => {
    // Whichever way round it comes, a road faces up.
    const ny = ((b[2] as number) - (a[2] as number)) * ((d[0] as number) - (a[0] as number)) - ((b[0] as number) - (a[0] as number)) * ((d[2] as number) - (a[2] as number));
    positions.push(...a, ...(ny >= 0 ? b : d), ...(ny >= 0 ? d : b));
    c.setHex(colour);
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
      rows.push(edges.map((e) => [px + rx * e.off, heightAt(px + rx * e.off, pz + rz * e.off) + e.up, pz + rz * e.off]));
    }
    for (let i = 0; i + 1 < n; i++) {
      for (let j = 0; j + 1 < edges.length; j++) {
        const colour = (edges[j] as Edge).colour;
        const p = (rows[i] as number[][])[j] as number[];
        const q = (rows[i] as number[][])[j + 1] as number[];
        const r = (rows[i + 1] as number[][])[j + 1] as number[];
        const s = (rows[i + 1] as number[][])[j] as number[];
        tri(p, q, r, colour);
        tri(p, r, s, colour);
      }
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colours, 3));
  geo.computeVertexNormals();
  geo.computeBoundingSphere();
  return geo;
}

/** The streets, as a mesh that takes the light and the shadows of what stands along it. */
export function streetSurfaceMesh(strips: readonly Strip[], heightAt: (x: number, z: number) => number, season: Season): THREE.Mesh | null {
  if (strips.length === 0) return null;
  // Drawn as if a hair nearer than it is, so that it never flickers against the ground just under it.
  const mesh = new THREE.Mesh(buildStreetSurface(strips, heightAt, season), new THREE.MeshLambertMaterial({ vertexColors: true, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4 }));
  mesh.name = 'streets';
  mesh.receiveShadow = true;
  mesh.matrixAutoUpdate = false;
  return mesh;
}
