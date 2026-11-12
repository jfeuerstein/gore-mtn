import * as THREE from 'three/webgpu';
import { GROUND_MARKS, MARK_KINDS, MARK_REPEAT, MARK_SIZE, markSheet, type Mark } from '../look/groundMarks';
import { litBy } from '../look/material';
import type { Season } from '../look/season';
import { MOST_INKS, type Weights } from '../look/worldLook';

const { Fn, If, texture, uv, positionWorld, uniform, vec2, vec3, vec4, float, mix, smoothstep, dot } = THREE.TSL;

/** A tile of ground drawn from the weights of its inks: its material, and what to let go of when the camera has left. */
export interface GroundTile {
  material: THREE.Material;
  dispose(): void;
}

/**
 * How the ground near the camera is drawn. A picture of the ground has pixels, and from a few
 * metres up they show, however the picture is made. So this is the one material in the game
 * with a shader of its own. For every pixel of the screen it reads how much each of the
 * season's inks weighs there (two small textures to a tile, from `weigh` in `worldLook.ts`),
 * takes the heaviest, and so draws an edge between two inks as a clean curve at any distance.
 * Then it prints the season's marks over that ink (`groundMarks.ts`): one sheet of them,
 * repeated over the ground by where a pixel is in the world.
 *
 * `inkAt` in `worldLook.ts` is the same sum in plain numbers, with tests.
 *
 * It is written in three.js's shading language, which becomes WGSL for WebGPU and GLSL for
 * WebGL 2, so both draw it alike; but the tools here can only show the second.
 */
export class GroundLook {
  /** The colour of the light on the ground, as the plain ground material's colour is. */
  private readonly tint = uniform(new THREE.Color(0xffffff));
  private readonly sheet: THREE.DataTexture | null;
  /** For each ink of the order: its colour, and its marks. */
  private readonly inks: { colour: THREE.Color; marks: readonly Mark[] }[];

  /**
   * @param order every ink of the ground's picture, the commonest first (`inkOrder`)
   * @param marks whether the season's marks are printed on it, or the inks left plain
   */
  constructor(season: Season, order: readonly number[], marks: boolean) {
    this.inks = order.slice(0, MOST_INKS).map((ink) => ({ colour: new THREE.Color(ink), marks: marks ? (GROUND_MARKS[season][ink] ?? []) : [] }));
    if (marks && this.inks.some((ink) => ink.marks.length > 0)) {
      this.sheet = new THREE.DataTexture(markSheet(), MARK_SIZE, MARK_SIZE, THREE.RGBAFormat);
      this.sheet.wrapS = this.sheet.wrapT = THREE.RepeatWrapping;
      this.sheet.magFilter = THREE.LinearFilter;
      // Far off, a mark is less than a pixel: the sheet is read smaller and smaller, and the marks fade out of it.
      this.sheet.minFilter = THREE.LinearMipmapLinearFilter;
      this.sheet.generateMipmaps = true;
      this.sheet.anisotropy = 4;
      this.sheet.needsUpdate = true;
    } else this.sheet = null;
  }

  /** Tint the ground, for the time of day and the weather. */
  setTint(hex: number): void {
    (this.tint.value as THREE.Color).setHex(hex);
  }

  /**
   * The material for one tile.
   * @param weights the tile's inks, weighed
   * @param u0 where the tile's first and last points lie in the picture of the whole ground, from 0 to 1, across and down
   */
  tile(weights: Weights, u0: number, v0: number, u1: number, v1: number): GroundTile {
    const { across, down } = weights;
    const data = (bytes: Uint8Array): THREE.DataTexture => {
      const t = new THREE.DataTexture(bytes, across, down, THREE.RGBAFormat);
      // Read between the points: that is what makes an edge a curve.
      t.magFilter = THREE.LinearFilter;
      t.minFilter = THREE.LinearFilter;
      t.generateMipmaps = false;
      t.needsUpdate = true;
      return t;
    };
    const a = data(weights.a);
    const b = data(weights.b);
    // The tile's corners carry their place in the whole picture, counted up from the bottom. This
    // brings a place to its place among the tile's points, the first and last of which are on its edges.
    const su = (across - 1) / across / (u1 - u0);
    const sv = (down - 1) / down / (v1 - v0);
    const scale = uniform(new THREE.Vector2(su, -sv));
    const offset = uniform(new THREE.Vector2(0.5 / across - u0 * su, 0.5 / down + (1 - v0) * sv));
    const { inks, sheet, tint } = this;
    const rgb = (c: THREE.Color) => vec3(c.r, c.g, c.b);
    /** Which channel of the sheet a mark is in, as a vector to pick it out with. */
    const pick = (mark: Mark | undefined) => {
      const k = mark ? MARK_KINDS.indexOf(mark.kind) : -1;
      return vec4(k === 0 ? 1 : 0, k === 1 ? 1 : 0, k === 2 ? 1 : 0, k === 3 ? 1 : 0);
    };
    const markInk = (mark: Mark | undefined) => rgb(new THREE.Color(mark ? mark.ink : 0));
    const colour = Fn(() => {
      const at = uv().mul(scale).add(offset);
      const wa = texture(a, at);
      const wb = texture(b, at);
      const weight = [wa.x, wa.y, wa.z, wa.w, wb.x, wb.y, wb.z, wb.w];
      // The first ink weighs whatever the others leave.
      const first = inks[0] as (typeof inks)[number];
      const most = float(1).sub(wa.x).sub(wa.y).sub(wa.z).sub(wa.w).sub(wb.x).sub(wb.y).sub(wb.z).sub(wb.w).toVar();
      const ink = rgb(first.colour).toVar();
      const kind1 = pick(first.marks[0]).toVar();
      const ink1 = markInk(first.marks[0]).toVar();
      const kind2 = pick(first.marks[1]).toVar();
      const ink2 = markInk(first.marks[1]).toVar();
      for (let k = 1; k < inks.length; k++) {
        const one = inks[k] as (typeof inks)[number];
        const w = weight[k - 1] as (typeof weight)[number];
        If(w.greaterThan(most), () => {
          most.assign(w);
          ink.assign(rgb(one.colour));
          if (sheet) {
            kind1.assign(pick(one.marks[0]));
            ink1.assign(markInk(one.marks[0]));
            kind2.assign(pick(one.marks[1]));
            ink2.assign(markInk(one.marks[1]));
          }
        });
      }
      if (sheet) {
        // The sheet lies over the ground by where a pixel is in the world; a second time turned and
        // a different size, so that two kinds of mark on one ink do not keep step.
        const p = positionWorld.xz.div(MARK_REPEAT);
        const one = texture(sheet, p);
        const two = texture(sheet, vec2(p.y.negate(), p.x).mul(1.31).add(vec2(0.37, 0.61)));
        ink.assign(mix(ink, ink1, smoothstep(0.4, 0.6, dot(one, kind1))));
        ink.assign(mix(ink, ink2, smoothstep(0.4, 0.6, dot(two, kind2))));
      }
      return ink.mul(tint);
    });
    // Double-sided so the skirts show whichever way they face.
    const material = litBy(colour(), { side: THREE.DoubleSide });
    return {
      material,
      dispose: () => {
        a.dispose();
        b.dispose();
        material.dispose();
      },
    };
  }
}
