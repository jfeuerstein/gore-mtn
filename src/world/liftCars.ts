import * as THREE from 'three/webgpu';
import { carCount, carDistance, LINE_OFFSET, pointAlong, RIDER_DROP, type LiftPath } from './lifts';
import { blocks } from './shapes';
import { lit } from '../look/material';

const STEEL = 0x4d5666;
const SEAT = 0x2f3b4d;
const CABIN = 0xc2412d;
const GLASS = 0x8fa9c4;
const CREAM = 0xf4ead8;

/** A four-seat chair, hung from the cable at its origin, facing -z. The seat is where a rider's hips go. */
function chairGeometry(): THREE.BufferGeometry {
  const seatY = -RIDER_DROP + 0.38;
  return blocks([
    { size: [2.3, 0.1, 0.6], at: [0, seatY, 0.1], colour: SEAT },
    // A low back rail, so the rider's shoulders and hat show above it from behind.
    { size: [2.3, 0.26, 0.09], at: [0, seatY + 0.3, 0.42], colour: SEAT },
    // Hanger: up from the back of the seat, then forward to the grip on the cable.
    { size: [0.1, RIDER_DROP - 1.1, 0.1], at: [0, -(RIDER_DROP - 1.1) / 2 - 0.25, 0.42], colour: STEEL },
    { size: [0.1, 0.1, 0.5], at: [0, -0.25, 0.2], colour: STEEL },
    { size: [0.16, 0.3, 0.16], at: [0, -0.12, 0], colour: STEEL },
    // Footrest bar out in front.
    { size: [2.3, 0.05, 0.05], at: [0, seatY - 0.45, -0.5], colour: STEEL },
    { size: [0.05, 0.5, 0.05], at: [-1.1, seatY - 0.2, -0.35], colour: STEEL, tip: 0.6 },
    { size: [0.05, 0.5, 0.05], at: [1.1, seatY - 0.2, -0.35], colour: STEEL, tip: 0.6 },
  ]);
}

/** A gondola cabin, hung from the cable at its origin. Riders travel inside. */
function cabinGeometry(): THREE.BufferGeometry {
  const floor = -RIDER_DROP - 0.1;
  return blocks([
    { size: [2.2, 0.9, 2.6], at: [0, floor + 0.45, 0], colour: CABIN },
    { size: [2.1, 1.0, 2.5], at: [0, floor + 1.4, 0], colour: GLASS },
    { size: [2.3, 0.25, 2.7], at: [0, floor + 2.02, 0], colour: CREAM },
    { size: [0.14, RIDER_DROP - 2.3, 0.14], at: [0, -(RIDER_DROP - 2.3) / 2 - 0.2, 0], colour: STEEL },
    { size: [0.2, 0.35, 0.5], at: [0, -0.12, 0], colour: STEEL },
  ]);
}

interface Fleet {
  mesh: THREE.InstancedMesh;
  /** Which lift each car belongs to, its slot on that lift, and whether it is going up. */
  cars: { path: LiftPath; slot: number; up: boolean }[];
}

/**
 * The chairs and cabins on every lift: evenly spaced, going up one side of the towers and coming
 * down the other. They move on the lift clock, the same clock a rider moves on, so the chair a
 * rider sits on stays under them all the way up.
 */
export class LiftCars {
  readonly group = new THREE.Group();
  private readonly fleets: Fleet[] = [];
  private readonly m = new THREE.Matrix4();
  private readonly q = new THREE.Quaternion();
  private readonly p = new THREE.Vector3();
  private readonly up = new THREE.Vector3(0, 1, 0);
  private readonly one = new THREE.Vector3(1, 1, 1);
  private readonly none = new THREE.Vector3(0, 0, 0);

  constructor(paths: readonly LiftPath[], castShadow: boolean) {
    this.group.name = 'lift-cars';
    const material = lit({ vertexColors: true, flatShading: true });
    for (const cabins of [false, true]) {
      const cars: Fleet['cars'] = [];
      for (const path of paths) {
        if (path.surface || path.cabins !== cabins) continue;
        for (let slot = 0; slot < carCount(path); slot++) {
          cars.push({ path, slot, up: true }, { path, slot, up: false });
        }
      }
      if (cars.length === 0) continue;
      const mesh = new THREE.InstancedMesh(cabins ? cabinGeometry() : chairGeometry(), material, cars.length);
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      mesh.frustumCulled = false;
      mesh.castShadow = castShadow;
      this.group.add(mesh);
      this.fleets.push({ mesh, cars });
    }
  }

  /** Move every car to where it is at this moment on the lift clock. */
  update(clock: number): void {
    for (const fleet of this.fleets) {
      fleet.cars.forEach((car, i) => {
        const d = carDistance(car.path, car.slot, clock);
        if (d > car.path.length) {
          // Between the ends of the stations: not drawn.
          fleet.mesh.setMatrixAt(i, this.m.compose(this.p.set(0, -1000, 0), this.q.identity(), this.none));
          return;
        }
        // Up-going cars are measured from the bottom; down-coming ones from the top, on the other side.
        const at = pointAlong(car.path, car.up ? d : car.path.length - d);
        const side = car.up ? LINE_OFFSET : -LINE_OFFSET;
        this.p.set(at.x + Math.cos(at.yaw) * side, at.y, at.z - Math.sin(at.yaw) * side);
        this.q.setFromAxisAngle(this.up, car.up ? at.yaw : at.yaw + Math.PI);
        fleet.mesh.setMatrixAt(i, this.m.compose(this.p, this.q, this.one));
      });
      fleet.mesh.instanceMatrix.needsUpdate = true;
    }
  }
}
