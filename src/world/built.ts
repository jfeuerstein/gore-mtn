import * as THREE from 'three/webgpu';
import type { Season } from '../look/season';
import { Buildings } from './buildings';
import { fromLocal } from './footprints';
import { PLACE_FOOTPRINT, PLACE_HEIGHT } from './placeSizes';
import { depotSetting, TRACK_OUT, TRAIN_LENGTH, trainCars, type DepotSetting } from './railway';
import { buildResort } from './resort';
import { buildSnowGuns } from './scenery';
import { buildSignPosts } from './signPosts';
import { buildSigns } from './signs';
import { Smoke } from './smoke';
import { snowGuns } from './snowGuns';
import { alongStreet, HIGH_STREET_HALF, SIDEWALK, streetStrips, type Kerbside, type Strip, type Zone } from './roadways';
import { buildKerbside, buildStreetFurniture } from './streetFurniture';
import { streetSurfaceMesh } from './streetSurface';
import { benches, bridges, streetLamps, viewBenches, welcomeSigns, type Bench } from './streets';
import { planHeight, planHouses } from './houseKinds';
import { Houses } from './houses';
import { TownPlaces, townPlaceHeight } from './townKit';
import { resolveTownPlaces, type TownPlace } from './townPlaces';
import { buildTrain } from './train';
import { trailSignPosts } from './trailSigns';
import { insideBox, type WallBox } from './walls';
import type { World } from './world';
import { buildYards } from './yards';

/**
 * Everything people have built, apart from the lifts: the lodges and huts, North Creek's houses
 * and its named places, the depot and the Snow Train, street lamps and benches, every sign, the
 * snow guns, and the smoke from the chimneys. Put together here so that the game has one thing
 * to add to the scene, one list of walls to walk round, and one thing to tell the hour to.
 */
export class Built {
  readonly group = new THREE.Group();
  /** The places with a name and a look of their own: the inn, the post office, the old mine works. */
  readonly townPlaces: TownPlace[];
  /** Where the depot stands: on the real station's plot, along the rails, with the Snow Train beside it. */
  readonly depot: DepotSetting | null;
  /** Every bench that can be sat on: by the town's doors, and at the lookouts. */
  readonly benches: Bench[];
  /** Everything solid, as boxes: the lodges and huts by their models' footprints, the town by its plots, and the train. */
  readonly walls: WallBox[];
  private readonly buildings: Buildings;
  private readonly town: Houses;
  private readonly named: TownPlaces;
  private readonly smoke: Smoke;
  /** The lengths of road that have a surface of their own, and the cars parked along Main Street. */
  private readonly strips: Strip[];
  private readonly cars: Kerbside[];
  /** The lanes of the car parks at the foot of the mountain. */
  private readonly lots: Strip[];

  /**
   * @param heightAt the height of the ground
   * @param roof the colour of the roofs this season: snow, or shingle
   * @param textured whether walls and roofs wear their courses of boards and shingles
   */
  constructor(
    private readonly world: World,
    heightAt: (x: number, z: number) => number,
    season: Season,
    roof: number,
    shadows: boolean,
    textured = true,
  ) {
    this.group.name = 'built';
    const townPlaces = (this.townPlaces = resolveTownPlaces(world));
    const depot = (this.depot = depotSetting(world));
    const styled = new Set([...townPlaces.map((p) => p.building), depot?.building ?? -1]);

    const placeSettings: Record<string, { x: number; y: number; z: number; turn: number }> = depot ? { depot: { ...depot, y: heightAt(depot.x, depot.z) } } : {};
    this.buildings = new Buildings(world.places, shadows, roof, placeSettings, textured);
    // Every building without a look of its own is one of the town's plain houses.
    // ...and is built for what it is: a home of one kind or another, a shed, a shop on Main Street.
    const plain = planHouses(world.buildings, world.roads, world.places, heightAt, styled);
    this.town = new Houses(plain, shadows, roof, season, textured);
    const train = buildTrain(trainCars(world), heightAt, roof);
    if (placeSettings.depot) {
      // The station's name board, under the eaves on the platform side.
      const board = fromLocal(placeSettings.depot, 0, 7.6);
      train.signs.push({ text: 'NORTH CREEK', ...board, y: placeSettings.depot.y - 0.8 + 4.15, turn: placeSettings.depot.turn, height: 0.85, maxWidth: 6.8, width: 6.8, board: '#f5f2ea', ink: '#22304a', twoSided: true });
    }
    // Lamps down Main Street, a bench by the doors, a welcome at each end of town, and whatever
    // stands outside the lodges: all joined into the named places' two meshes.
    this.benches = [...benches(townPlaces), ...viewBenches(world)];
    const street = buildStreetFurniture(streetLamps(world), this.benches, welcomeSigns(world), heightAt, bridges(world));

    // The streets themselves: a surface over the ground where people live and park, with a
    // sidewalk down each side of Main Street in town.
    const at = (id: string): { x: number; z: number } | undefined => world.places.find((p) => p.id === id);
    const zones: Zone[] = [
      ...(at('depot') ? [{ ...(at('depot') as { x: number; z: number }), reach: 800, town: true }] : []),
      ...(at('base-lodge') ? [{ ...(at('base-lodge') as { x: number; z: number }), reach: 430 }] : []),
      ...(at('ski-bowl-lodge') ? [{ ...(at('ski-bowl-lodge') as { x: number; z: number }), reach: 260 }] : []),
    ];
    this.strips = streetStrips(world.roads, zones);
    const surface = streetSurfaceMesh(this.strips, heightAt, season);
    if (surface) this.group.add(surface);
    // What stands along the kerb: cars parked on both sides, poles and their wires down one, a
    // hydrant now and then. Nothing stands inside a building.
    const solid: WallBox[] = [...plain, ...townPlaces].map((b) => ({ x: b.x, z: b.z, w: b.w, d: b.d, turn: b.turn }));
    const free = (x: number, z: number): boolean => !solid.some((b) => insideBox(x, z, b, 1.2));
    const kerbCars = [...alongStreet(this.strips, 7.5, HIGH_STREET_HALF - 0.95, 0.2, free), ...alongStreet(this.strips, 7.5, -(HIGH_STREET_HALF - 0.95), 0.17, free, 3)];
    // And in the car parks at the foot of the mountain, nose in to the lanes: the nearest
    // spaces to the lodge fill first.
    const lodge = at('base-lodge');
    this.lots = this.strips.filter((strip) => !strip.sidewalks && strip.half < 2.5 && lodge !== undefined && Math.hypot((strip.pts[0] as number) - lodge.x, (strip.pts[1] as number) - lodge.z) < 440);
    const lot = (side: number): Kerbside[] => alongStreet(this.strips, 3, side * 4.9, 0.5, free, side, (strip) => this.lots.includes(strip));
    const parked = lodge
      ? [...lot(1), ...lot(-1)]
          .map((c) => ({ ...c, turn: c.turn + Math.PI / 2 }))
          // Full by the lodge, thinning out toward the far end of the lots.
          .filter((c) => c.roll < 1.1 - Math.hypot(c.x - lodge.x, c.z - lodge.z) / 300)
          .sort((a, b) => Math.hypot(a.x - lodge.x, a.z - lodge.z) - Math.hypot(b.x - lodge.x, b.z - lodge.z))
          .slice(0, 90)
      : [];
    this.cars = [...kerbCars, ...parked];
    const resort = buildResort(world.places, world.lifts, heightAt, season);
    const hall = townPlaces.find((p) => p.id === 'johnsburg-town-hall');
    const kerb = buildKerbside(
      this.cars,
      alongStreet(this.strips, 36, -(SIDEWALK.to + 0.5), 1, free),
      alongStreet(this.strips, 110, SIDEWALK.from + 0.3, 1, free, 20),
      // The town's tree stands out in front of the town hall, to one side of its door.
      hall ? { x: hall.door.x + Math.cos(hall.turn) * 8, z: hall.door.z - Math.sin(hall.turn) * 8 } : null,
      heightAt,
      season,
    );
    this.named = new TownPlaces(townPlaces, shadows, roof, season, {
      walls: [...train.walls, ...street.walls, ...kerb.walls, ...resort.walls, ...buildYards(world.places, season, heightAt)],
      panes: [...train.panes, ...street.panes, ...kerb.panes, ...resort.panes],
      signs: [...train.signs, ...street.signs, ...resort.signs],
    }, textured);
    this.group.add(this.buildings.group, this.town.group, this.named.group);

    // While there is snow to make, the guns stand along the wide trails.
    if (season === 'winter' || season === 'spring') {
      this.group.add(buildSnowGuns(snowGuns(world.trails, (x, z) => world.onTrail(x, z)), heightAt, shadows));
    }
    // Smoke from the chimneys that are lit, and steam from the engine.
    this.smoke = new Smoke([...this.named.flues, ...(season === 'summer' ? [] : this.buildings.flues), ...resort.fires.map((f) => ({ ...f, size: 0.8 })), ...train.flues]);
    this.group.add(this.smoke.mesh);

    // Signs: the town's shopfronts, a board at the top of every trail and a name at the foot of
    // every lift. All of them are painted onto one sheet, a moment after the rest, once the
    // lettering has loaded.
    const signPosts = buildSignPosts(trailSignPosts(world.trails, world.lifts, heightAt, (x, z) => world.onTrail(x, z)), heightAt, shadows);
    this.group.add(signPosts.mesh);
    void buildSigns([...this.named.signs, ...this.buildings.signs, ...this.town.signs, ...signPosts.signs]).then((mesh) => {
      if (mesh) this.group.add(mesh);
    });

    this.walls = [
      ...world.places.flatMap((p): WallBox[] => {
        const size = PLACE_FOOTPRINT[p.id];
        const set = placeSettings[p.id];
        return size ? [{ x: set?.x ?? p.x, z: set?.z ?? p.z, w: size[0], d: size[1], turn: set?.turn ?? 0, top: (set?.y ?? p.y) + (PLACE_HEIGHT[p.id] ?? 8) }] : [];
      }),
      // Terraces and yurts are solid too.
      ...this.buildings.solid,
      // The train is as solid as a house.
      ...(depot?.rails ? [{ ...fromLocal(depot, 0, TRACK_OUT), w: TRAIN_LENGTH + 0.6, d: 3.1, turn: depot.turn, top: heightAt(depot.x, depot.z) + 5 } satisfies WallBox] : []),
      ...plain.map((b): WallBox => ({ x: b.x, z: b.z, w: b.w, d: b.d, turn: b.turn, top: b.y + planHeight(b) })),
      // A parked car is in the way, like anything else.
      ...this.cars.map((c): WallBox => ({ x: c.x, z: c.z, w: 1.9, d: 4.4, turn: c.turn })),
      ...townPlaces.map((p): WallBox => ({ x: p.x, z: p.z, w: p.w, d: p.d, turn: p.turn, top: p.y + townPlaceHeight(p.style, p.w, p.d) })),
    ];
  }

  /** True close to a lodge or a named place, or in front of its door: where trees should stand back. */
  near(x: number, z: number): boolean {
    // Nothing grows in front of a bench that was put there for the view.
    for (const b of this.benches) {
      if (!b.view) continue;
      const ahead = (x - b.x) * Math.sin(b.turn) + (z - b.z) * Math.cos(b.turn);
      const aside = (x - b.x) * Math.cos(b.turn) - (z - b.z) * Math.sin(b.turn);
      if (ahead > -5 && ahead < 60 && Math.abs(aside) < 7 + ahead * 0.35) return true;
    }
    // Nor in Main Street, nor on its sidewalks; nor in a car park, where the cars stand either side of each lane.
    for (const strip of this.strips) {
      const reach = strip.sidewalks ? 12.5 : this.lots.includes(strip) ? 10 : 0;
      if (reach === 0) continue;
      for (let i = 0; i + 1 < strip.pts.length; i += 6) if (Math.abs((strip.pts[i] as number) - x) < reach && Math.abs((strip.pts[i + 1] as number) - z) < reach && Math.hypot((strip.pts[i] as number) - x, (strip.pts[i + 1] as number) - z) < reach) return true;
    }
    return (
      this.world.places.some((p) => Math.hypot(p.x - x, p.z - z) < (p.id === 'base-lodge' ? 78 : p.id === 'summit' ? 30 : 38)) ||
      this.townPlaces.some((p) => Math.hypot(p.x - x, p.z - z) < Math.max(p.w, p.d) / 2 + 7 || Math.hypot(p.door.x - x, p.door.z - z) < 11)
    );
  }

  /** How lit the windows and lamps are, 0 by day and 1 after dark. Smoke pales by day and dims at night. */
  setLamps(amount: number): void {
    this.buildings.setLamps(amount);
    this.town.setLamps(amount);
    this.named.setLamps(amount);
    this.smoke.setDaylight(1 - amount);
  }

  /**
   * Move what moves: the smoke.
   * @param time seconds, on any steady clock
   * @param x where the player is, since only smoke nearby is drawn
   */
  update(time: number, x: number, z: number): void {
    this.smoke.update(time, x, z);
  }
}
