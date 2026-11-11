import * as THREE from 'three/webgpu';
import { makeRng } from '../rng';
import { mixColour, type Palette } from './palette';
import { skyDirection, type SunPosition } from './sun';
import { isPrinted } from './material';

/** How many bands of colour the sky has from the horizon to overhead, in the print look. */
const SKY_BANDS = 6;
/** How tall each band is, as a share of the way up the dome, and how far up the sky's colours the field above them is taken from. */
const BAND_HEIGHT = 0.055;
const FIELD = 0.55;
/** How far away the sky and the far hills are drawn. Inside the camera's far limit. */
const SKY_RADIUS = 12000;
/** How many stars there are, on a clear night. */
const STARS = 420;
const DEG = Math.PI / 180;
/** Below this the sun gives no light to speak of and the moon takes over. Matches the palette's darkest twilight. */
const MOON_TAKES_OVER = -5 * DEG;
/** The light never comes from lower than this, or shadows would stretch without end. */
const LOWEST_LIGHT = 6 * DEG;

/**
 * Everything about the scene that changes with the time of day and the weather: the sky, the sun
 * or moon, the light, the haze, and the land beyond the mapped mountain. Give it a palette and
 * the sun's position and it repaints itself; it can be called many times a second.
 */
export class Atmosphere {
  /** Sky, sun disc and backdrop. Add to the scene. */
  readonly group = new THREE.Group();
  readonly ambient = new THREE.HemisphereLight(0xffffff, 0x888888, 1);
  readonly light = new THREE.DirectionalLight(0xffffff, 1);
  readonly fog = new THREE.Fog(0xffffff, 100, 6000);
  /** Unit vector toward the light, for placing the shadow-casting light near the player. */
  readonly lightDirection = new THREE.Vector3(0, 1, 0);

  private readonly sky = new THREE.Group();
  private readonly banded: boolean;
  private readonly dome: THREE.Mesh;
  private readonly disc: THREE.Mesh;
  private readonly stars: THREE.Mesh;
  private readonly plain: THREE.Mesh;
  private readonly ridges: { mesh: THREE.Mesh; heights: number[] }[] = [];
  private readonly a = new THREE.Color();
  private readonly b = new THREE.Color();
  private readonly c = new THREE.Color();

  constructor() {
    this.group.name = 'atmosphere';

    // In the print look the sky is bands of flat colour: every face of the dome is one colour, not a blend of its corners.
    this.banded = isPrinted();
    const geo = this.banded ? new THREE.SphereGeometry(1, 32, 48).toNonIndexed() : new THREE.SphereGeometry(1, 32, 16);
    geo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(geo.getAttribute('position').count * 3), 3));
    this.dome = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false, depthWrite: false }));
    this.dome.scale.setScalar(SKY_RADIUS);
    this.dome.renderOrder = -2;
    this.dome.frustumCulled = false;

    this.disc = new THREE.Mesh(new THREE.CircleGeometry(1, 24), new THREE.MeshBasicMaterial({ color: 0xffffff, fog: false, depthWrite: false }));
    this.disc.renderOrder = -1;
    this.disc.frustumCulled = false;
    // Stars: a few hundred small diamonds set in the upper sky, the same ones every night.
    const starRng = makeRng(1878);
    const corners: number[] = [];
    const d = new THREE.Vector3();
    const across = new THREE.Vector3();
    const upward = new THREE.Vector3();
    const point = new THREE.Vector3();
    for (let i = 0; i < STARS; i++) {
      // Spread evenly over the dome above the far hills.
      const height = 0.14 + starRng() * 0.86;
      const round = starRng() * Math.PI * 2;
      const flat = Math.sqrt(1 - height * height);
      d.set(Math.cos(round) * flat, height, Math.sin(round) * flat);
      across.set(-d.z, 0, d.x).normalize();
      upward.crossVectors(d, across);
      // Most are faint. A few are bright enough to steer by.
      const size = (starRng() < 0.12 ? 0.0034 : 0.0015) * (0.7 + starRng() * 0.6);
      const at = (ax: number, ay: number): void => {
        point.copy(d).addScaledVector(across, ax * size).addScaledVector(upward, ay * size);
        corners.push(point.x, point.y, point.z);
      };
      at(0, 1);
      at(-1, 0);
      at(0, -1);
      at(0, 1);
      at(0, -1);
      at(1, 0);
    }
    const starGeo = new THREE.BufferGeometry();
    starGeo.setAttribute('position', new THREE.Float32BufferAttribute(corners, 3));
    this.stars = new THREE.Mesh(starGeo, new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide, fog: false, depthWrite: false }));
    this.stars.scale.setScalar(SKY_RADIUS * 0.99);
    this.stars.renderOrder = -1.5;
    this.stars.frustumCulled = false;
    this.stars.visible = false;
    this.sky.add(this.dome, this.stars, this.disc);

    // Land beyond the mapped mountain, so the world does not stop at the edge of the data.
    this.plain = new THREE.Mesh(new THREE.CircleGeometry(SKY_RADIUS, 48), new THREE.MeshBasicMaterial({ color: 0xffffff }));
    this.plain.rotation.x = -Math.PI / 2;
    this.plain.position.y = -6;

    // Two rows of far hills: jagged low-poly walls round the world. They are drawn without fog and
    // fade by hand from the haze colour at the foot to their own colour at the crest.
    const rng = makeRng(46);
    for (const row of [
      { radius: 8200, low: 120, high: 560 },
      { radius: 10800, low: 220, high: 820 },
    ]) {
      const SEGMENTS = 72;
      const heights: number[] = [];
      for (let i = 0; i < SEGMENTS; i++) {
        const angle = (i / SEGMENTS) * Math.PI * 2;
        const swell = 0.5 + 0.5 * Math.sin(angle * 3 + row.radius) * Math.cos(angle * 5 + 1.3);
        heights.push(row.low + (row.high - row.low) * (0.35 * swell + 0.65 * rng() * swell + 0.1 * rng()));
      }
      const positions: number[] = [];
      for (let i = 0; i < SEGMENTS; i++) {
        const a0 = (i / SEGMENTS) * Math.PI * 2;
        const a1 = ((i + 1) / SEGMENTS) * Math.PI * 2;
        const h0 = heights[i] as number;
        const h1 = heights[(i + 1) % SEGMENTS] as number;
        const x0 = Math.cos(a0) * row.radius;
        const z0 = Math.sin(a0) * row.radius;
        const x1 = Math.cos(a1) * row.radius;
        const z1 = Math.sin(a1) * row.radius;
        // Foot, foot, crest; foot, crest, crest. paint() relies on this order.
        positions.push(x0, -6, z0, x1, -6, z1, x0, h0, z0, x1, -6, z1, x1, h1, z1, x0, h0, z0);
      }
      const ridgeGeo = new THREE.BufferGeometry();
      ridgeGeo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
      ridgeGeo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(positions.length), 3));
      const mesh = new THREE.Mesh(ridgeGeo, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide, fog: false }));
      mesh.frustumCulled = false;
      this.ridges.push({ mesh, heights });
    }
    this.group.add(this.sky, this.plain, ...this.ridges.map((r) => r.mesh));
  }

  /** Keep the sky centred on the camera. Call every frame. */
  follow(camera: THREE.Vector3): void {
    this.sky.position.copy(camera);
  }

  /**
   * Repaint for a palette and a position of the sun.
   * @param starlight how far the stars are out, 0..1: none by day or under cloud
   */
  apply(p: Palette, sun: SunPosition, starlight = 0): void {
    // Sky: horizon colour at and below eye level, through the middle colour low in the sky, to the top.
    const top = this.a.setHex(p.skyTop);
    const middle = this.b.setHex(p.skyMiddle);
    const horizon = this.c.setHex(p.skyHorizon);
    const geo = this.dome.geometry;
    const pos = geo.getAttribute('position');
    const colours = geo.getAttribute('color') as THREE.BufferAttribute;
    const out = colours.array as Float32Array;
    for (let i = 0; i < pos.count; i++) {
      let up = Math.min(1, Math.max(0, pos.getY(i)));
      if (this.banded) {
        // The height of the face this corner belongs to, cut into bands.
        const first = i - (i % 3);
        // By its lowest corner, which both faces of a panel of the dome share: so a band ends along a level line.
        const mid = Math.min(pos.getY(first), pos.getY(first + 1), pos.getY(first + 2));
        // Bands low down, where they lie level, and one flat field above them.
        up = (Math.min(SKY_BANDS, Math.floor(Math.max(0, mid) / BAND_HEIGHT)) / SKY_BANDS) * FIELD;
      }
      let from = horizon;
      let to = middle;
      let t = up / 0.22;
      if (up >= 0.22) {
        from = middle;
        to = top;
        t = Math.min(1, (up - 0.22) / 0.5);
      }
      out[i * 3] = from.r + (to.r - from.r) * t;
      out[i * 3 + 1] = from.g + (to.g - from.g) * t;
      out[i * 3 + 2] = from.b + (to.b - from.b) * t;
    }
    colours.needsUpdate = true;

    // Sun by day, and once it is well down, a moon across the sky from it.
    const moonUp = sun.elevation < MOON_TAKES_OVER;
    const elevation = moonUp ? 38 * DEG : sun.elevation;
    const azimuth = moonUp ? sun.azimuth + Math.PI : sun.azimuth;
    const seen = skyDirection(elevation, azimuth);
    this.disc.position.set(seen[0], seen[1], seen[2]).multiplyScalar(SKY_RADIUS * 0.98);
    this.disc.lookAt(this.sky.position);
    this.disc.scale.setScalar(p.discSize * SKY_RADIUS);
    // The disc fades by taking on the colour of the sky behind it, which needs no transparency.
    (this.disc.material as THREE.MeshBasicMaterial).color.setHex(mixColour(p.skyMiddle, p.discColour, p.discShown));
    this.disc.visible = p.discShown > 0.03 && seen[1] > -0.02;

    // Stars come out as the sky darkens, by taking their colour from the sky and then leaving it:
    // like the disc, they need no transparency.
    this.stars.visible = starlight > 0.04;
    (this.stars.material as THREE.MeshBasicMaterial).color.setHex(mixColour(p.skyTop, 0xfff4dc, Math.min(1, starlight)));

    const lit = skyDirection(Math.max(elevation, LOWEST_LIGHT), azimuth);
    this.lightDirection.set(lit[0], lit[1], lit[2]);
    this.light.color.setHex(p.lightColour);
    this.light.intensity = p.lightIntensity;
    this.ambient.color.setHex(p.ambientSky);
    this.ambient.groundColor.setHex(p.ambientGround);
    this.ambient.intensity = p.ambientIntensity;

    this.fog.color.setHex(p.fogColour);
    this.fog.near = p.fogNear;
    this.fog.far = p.fogFar;

    (this.plain.material as THREE.MeshBasicMaterial).color.setHex(p.plain);
    const haze = this.a.setHex(p.fogColour);
    [p.ridgeNear, p.ridgeFar].forEach((hex, row) => {
      const ridge = this.ridges[row];
      if (!ridge) return;
      const crest = this.b.setHex(hex);
      const attr = ridge.mesh.geometry.getAttribute('color') as THREE.BufferAttribute;
      const arr = attr.array as Float32Array;
      // Per segment: foot, foot, crest, foot, crest, crest.
      const CREST = [false, false, true, false, true, true];
      for (let v = 0; v < arr.length / 3; v++) {
        const colour = CREST[v % 6] ? crest : haze;
        arr[v * 3] = colour.r;
        arr[v * 3 + 1] = colour.g;
        arr[v * 3 + 2] = colour.b;
      }
      attr.needsUpdate = true;
    });
  }
}
