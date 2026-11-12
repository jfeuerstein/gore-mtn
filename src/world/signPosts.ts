import * as THREE from 'three/webgpu';
import { blocks, type Block } from './shapes';
import type { SignSpec } from './signs';
import { BOARD_HEIGHT, BOARD_INK, BOARD_PAPER, BOARD_STEP, LOWEST_BOARD, MARK_PANEL, type SignPost } from './trailSigns';
import { lit } from '../look/material';

/**
 * The posts that the mountain's signs hang on, as one mesh, and the boards to paint for them.
 * A few hundred triangles for the whole mountain, so they are all built at once like the lift towers.
 *
 * A trail's sign is two timber posts with its name on a plank between them and, standing on
 * top, a square panel that carries its mark large: the thing read from across the snow. Trails
 * that share a post each have a plank, and a panel for every different mark among them.
 */
export function buildSignPosts(posts: readonly SignPost[], heightAt: (x: number, z: number) => number, castShadow: boolean): { mesh: THREE.Mesh; signs: SignSpec[] } {
  const list: Block[] = [];
  const signs: SignSpec[] = [];
  const TIMBER = 0x6b4a32;
  const BACKING = 0x3a2e26;
  for (const post of posts) {
    const ground = heightAt(post.x, post.z);
    const lift = post.boards[0]?.difficulty === 'lift';
    // A lift's name hangs higher, on a stouter post, to be read from across the snow.
    const lowest = lift ? 2.6 : LOWEST_BOARD;
    const thick = lift ? 0.24 : 0.2;
    const width = lift ? 4.8 : 4.0;
    const tall = lift ? 0.9 : BOARD_HEIGHT;
    const planksTop = lowest + (post.boards.length - 1) * BOARD_STEP + tall;
    // The marks to show on top: one panel for each different mark, in the order the planks are in.
    const marks = lift ? [] : [...new Set(post.boards.map((b) => b.difficulty))];
    // Two posts, one at each end of the planks. Local x runs along the planks.
    const cos = Math.cos(post.turn);
    const sin = Math.sin(post.turn);
    for (const side of [-1, 1]) {
      const px = post.x + cos * side * (width / 2 + thick / 2);
      const pz = post.z - sin * side * (width / 2 + thick / 2);
      list.push({ size: [thick, planksTop + 0.1 + 1.2, thick], at: [px, Math.min(ground, heightAt(px, pz)) + (planksTop + 0.1) / 2 - 0.6, pz], colour: TIMBER, turn: post.turn });
    }
    post.boards.forEach((board, i) => {
      const y = ground + lowest + (post.boards.length - 1 - i) * BOARD_STEP + tall / 2;
      // The wood the paint is on.
      list.push({ size: [width, tall, 0.07], at: [post.x, y, post.z], colour: BACKING, turn: post.turn });
      signs.push({ text: board.text, mark: board.difficulty, x: post.x, y, z: post.z, turn: post.turn, height: tall, maxWidth: width, width, board: BOARD_PAPER, ink: BOARD_INK, twoSided: true });
    });
    // The marks, each on a square panel of its own, side by side on a rail across the top.
    if (marks.length) {
      const y = ground + planksTop + 0.12 + MARK_PANEL / 2;
      list.push({ size: [width + thick * 2, 0.12, 0.12], at: [post.x, ground + planksTop + 0.06, post.z], colour: TIMBER, turn: post.turn });
      marks.forEach((mark, i) => {
        const lx = (i - (marks.length - 1) / 2) * (MARK_PANEL + 0.12);
        const x = post.x + cos * lx;
        const z = post.z - sin * lx;
        list.push({ size: [MARK_PANEL, MARK_PANEL, 0.07], at: [x, y, z], colour: BACKING, turn: post.turn });
        signs.push({ text: '', mark, x, y, z, turn: post.turn, height: MARK_PANEL, maxWidth: MARK_PANEL, width: MARK_PANEL, board: BOARD_PAPER, ink: BOARD_INK, twoSided: true });
      });
    }
  }
  const mesh = new THREE.Mesh(blocks(list), lit({ vertexColors: true, flatShading: true }));
  mesh.name = 'sign-posts';
  mesh.castShadow = castShadow;
  mesh.matrixAutoUpdate = false;
  return { mesh, signs };
}
