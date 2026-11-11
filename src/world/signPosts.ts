import * as THREE from 'three/webgpu';
import { blocks, type Block } from './shapes';
import type { SignSpec } from './signs';
import { BOARD_COLOURS, BOARD_HEIGHT, BOARD_STEP, LOWEST_BOARD, type SignPost } from './trailSigns';
import { lit } from '../look/material';

/**
 * The posts that the mountain's signs hang on, as one mesh, and the boards to paint for them.
 * A few hundred triangles for the whole mountain, so they are all built at once like the lift towers.
 */
export function buildSignPosts(posts: readonly SignPost[], heightAt: (x: number, z: number) => number, castShadow: boolean): { mesh: THREE.Mesh; signs: SignSpec[] } {
  const list: Block[] = [];
  const signs: SignSpec[] = [];
  for (const post of posts) {
    const ground = heightAt(post.x, post.z);
    const lift = post.boards[0]?.difficulty === 'lift';
    // A lift's name hangs higher, on a stouter post, to be read from across the snow.
    const lowest = lift ? 2.6 : LOWEST_BOARD;
    const height = lowest + post.boards.length * BOARD_STEP + 0.1;
    const thick = lift ? 0.22 : 0.14;
    const width = lift ? 4.4 : 3.2;
    const tall = lift ? 0.8 : BOARD_HEIGHT;
    // Two posts, one at each end of the boards. Local x runs along the boards.
    const cos = Math.cos(post.turn);
    const sin = Math.sin(post.turn);
    for (const side of [-1, 1]) {
      const px = post.x + cos * side * (width / 2 + thick / 2);
      const pz = post.z - sin * side * (width / 2 + thick / 2);
      list.push({ size: [thick, height + 1.2, thick], at: [px, Math.min(ground, heightAt(px, pz)) + height / 2 - 0.6, pz], colour: 0x6b4a32, turn: post.turn });
    }
    post.boards.forEach((board, i) => {
      const y = ground + lowest + (post.boards.length - 1 - i) * BOARD_STEP + BOARD_HEIGHT / 2;
      // The wood the paint is on.
      list.push({ size: [width, tall, 0.06], at: [post.x, y, post.z], colour: 0x3a2e26, turn: post.turn });
      signs.push({ text: board.text, x: post.x, y, z: post.z, turn: post.turn, height: tall, maxWidth: width, width, ...BOARD_COLOURS[board.difficulty], twoSided: true });
    });
  }
  const mesh = new THREE.Mesh(blocks(list), lit({ vertexColors: true, flatShading: true }));
  mesh.name = 'sign-posts';
  mesh.castShadow = castShadow;
  mesh.matrixAutoUpdate = false;
  return { mesh, signs };
}
