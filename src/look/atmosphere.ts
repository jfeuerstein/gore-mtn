import * as THREE from 'three/webgpu';
import { makeRng } from '../rng';
import { mixColour, type Palette } from './palette';
import { skyDirection, type SunPosition } from './sun';

/** How far away the sky and the far hills are drawn. Inside the camera's far limit. */
const SKY_RADIUS = 12000;
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
  private readonly dome: THREE.Mesh;
  private readonly disc: THREE.Mesh;
  private readonly plain: THREE.Mesh;
  private readonly ridges: { mesh: THREE.Mesh; heights: number[] }[] = [];
  private readonly a = new THREE.Color();
  private readonly b = new THREE.Color();
  private readonly c = new THREE.Color();

  constructor() {
    this.group.name = 'atmosphere';

    const geo = new THREE.SphereGeometry(1, 32, 16);
    geo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(geo.getAttribute('position').count * 3), 3));
    this.dome = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false, depthWrite: false }));
    this.dome.scale.setScalar(SKY_RADIUS);
    this.dome.renderOrder = -2;
    this.dome.frustumCulled = false;

    this.disc = new THREE.Mesh(new THREE.CircleGeometry(1, 24), new THREE.MeshBasicMaterial({ color: 0xffffff, fog: false, depthWrite: false }));
    this.disc.renderOrder = -1;
    this.disc.frustumCulled = false;
    this.sky.add(this.dome, this.disc);

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

  /** Repaint for a palette and a position of the sun. */
  apply(p: Palette, sun: SunPosition): void {
    // Sky: horizon colour at and below eye level, through the middle colour low in the sky, to the top.
    const top = this.a.setHex(p.skyTop);
    const middle = this.b.setHex(p.skyMiddle);
    const horizon = this.c.setHex(p.skyHorizon);
    const geo = this.dome.geometry;
    const pos = geo.getAttribute('position');
    const colours = geo.getAttribute('color') as THREE.BufferAttribute;
    const out = colours.array as Float32Array;
    for (let i = 0; i < pos.count; i++) {
      const up = Math.min(1, Math.max(0, pos.getY(i)));
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
