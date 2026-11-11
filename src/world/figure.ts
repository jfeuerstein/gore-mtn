import * as THREE from 'three/webgpu';
import type { Pose } from '../player/pose';
import { Skier, type Outfit } from '../player/skier';

/**
 * A figure in an outfit, held in one pose, as one geometry. The player's figure is a dozen
 * jointed parts, each drawn separately; someone who holds one pose can be all of those parts
 * fixed in place and joined, which draws in a single call and can be instanced.
 * @param gear what they have on their feet: skis and poles, a bike, or nothing
 * @param flatFeet soles level whatever the legs do, as on skis or hanging from a chair
 */
export function figureGeometry(outfit: Outfit, pose: Pose, gear: 'none' | 'skis' | 'bike' = 'none', flatFeet = false): THREE.BufferGeometry {
  const skier = new Skier(false, outfit);
  skier.setSkis(gear === 'skis');
  skier.setBike(gear === 'bike');
  skier.pose(pose, flatFeet);
  skier.root.updateMatrixWorld(true);
  const positions: number[] = [];
  const normals: number[] = [];
  const colours: number[] = [];
  skier.root.traverse((o) => {
    if (!(o instanceof THREE.Mesh) || !o.visible) return;
    // Skis, poles and the bike are there but hidden unless worn; a hidden parent hides its parts.
    for (let up: THREE.Object3D | null = o; up; up = up.parent) if (!up.visible) return;
    const geo = (o.geometry as THREE.BufferGeometry).index ? (o.geometry as THREE.BufferGeometry).toNonIndexed() : (o.geometry as THREE.BufferGeometry).clone();
    geo.applyMatrix4(o.matrixWorld);
    const colour = (o.material as THREE.MeshLambertMaterial).color;
    // A part of the figure that has been joined up wears its colours on its vertices.
    const own = geo.getAttribute('color');
    const p = geo.getAttribute('position');
    const n = geo.getAttribute('normal');
    for (let i = 0; i < p.count; i++) {
      positions.push(p.getX(i), p.getY(i), p.getZ(i));
      normals.push(n.getX(i), n.getY(i), n.getZ(i));
      if (own) colours.push(own.getX(i), own.getY(i), own.getZ(i));
      else colours.push(colour.r, colour.g, colour.b);
    }
  });
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  out.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  out.setAttribute('color', new THREE.Float32BufferAttribute(colours, 3));
  out.computeBoundingSphere();
  return out;
}
