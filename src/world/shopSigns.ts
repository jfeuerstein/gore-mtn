import * as THREE from 'three/webgpu';
import { SHOP_SIGN_ART, SHOP_SIGN_COLS } from './shopSignArt';

/**
 * The picture signs that hang out over shop doors: a boot for the outfitters, a loaf for the
 * bakery. Each is a small board end-on to the street, so it can be read from along the sidewalk,
 * with its picture on both faces. The pictures are painted by the art tools onto one sheet
 * (`public/art/shop-signs.webp`); all the signs are one mesh that wears it.
 */
export interface Hanging {
  /** What the shop's board says: which picture it gets. */
  text: string;
  /** The middle of the hanging board. */
  x: number;
  y: number;
  z: number;
  /** The turn of the building it hangs from: the board lies in the plane that runs out from its front. */
  turn: number;
}

/** How big the picture is on its board, in metres. */
const SIZE = 0.86;

/** True if there is a picture for a sign. */
export const hasShopPicture = (text: string): boolean => SHOP_SIGN_ART.includes(text);

/** The signs as one mesh, once their sheet has loaded. Nothing is added if it cannot be had. */
export async function buildHangingSigns(hangs: readonly Hanging[]): Promise<THREE.Mesh | null> {
  const shown = hangs.filter((h) => hasShopPicture(h.text));
  if (shown.length === 0) return null;
  let sheet: THREE.Texture;
  try {
    sheet = await new THREE.TextureLoader().loadAsync(`${import.meta.env.BASE_URL}art/shop-signs.webp`);
  } catch {
    return null;
  }
  sheet.colorSpace = THREE.SRGBColorSpace;
  sheet.anisotropy = 4;
  const rows = Math.ceil(SHOP_SIGN_ART.length / SHOP_SIGN_COLS);
  const positions: number[] = [];
  const normals: number[] = [];
  const uvs: number[] = [];
  for (const h of shown) {
    const cell = SHOP_SIGN_ART.indexOf(h.text);
    const u0 = (cell % SHOP_SIGN_COLS) / SHOP_SIGN_COLS;
    const u1 = u0 + 1 / SHOP_SIGN_COLS;
    const v1 = 1 - Math.floor(cell / SHOP_SIGN_COLS) / rows;
    const v0 = v1 - 1 / rows;
    const cos = Math.cos(h.turn);
    const sin = Math.sin(h.turn);
    // Out from the building's front is its own +z; the board's two faces look along its own x.
    for (const face of [1, -1]) {
      const at = (along: number, up: number): [number, number, number] => {
        const lx = face * 0.045;
        const lz = along * (SIZE / 2);
        return [h.x + lx * cos + lz * sin, h.y + up * (SIZE / 2), h.z - lx * sin + lz * cos];
      };
      // Seen from the side it faces, the picture reads the right way round.
      const a = at(face, -1);
      const b = at(-face, -1);
      const c = at(-face, 1);
      const d = at(face, 1);
      positions.push(...a, ...b, ...c, ...a, ...c, ...d);
      uvs.push(u0, v0, u1, v0, u1, v1, u0, v0, u1, v1, u0, v1);
      for (let i = 0; i < 6; i++) normals.push(face * cos, 0, -face * sin);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.computeBoundingSphere();
  const mesh = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ map: sheet }));
  mesh.name = 'shop-signs';
  mesh.matrixAutoUpdate = false;
  return mesh;
}
