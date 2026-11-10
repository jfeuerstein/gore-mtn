#!/usr/bin/env python3
"""Build the game world from real data.

Inputs (downloaded once into tools/terrain/cache/, which is gitignored):
  - USGS 3DEP elevation for the Gore Mountain bounding box
  - OpenStreetMap ways for ski trails, lifts, paths, buildings and water

Outputs (committed, in public/world/):
  - height.bin.gz    uint16 little-endian heights, rows north to south, columns west to east,
                     stored as differences from the sample to the west (see pack_heights) and gzipped
  - trailmask.bin.gz uint8, 255 on a ski trail, 0 elsewhere, same grid, gzipped (what game logic reads)
  - ground.png       colour of the snow up close, two texels per grid cell: bright groomed trails,
                     cooler snow under the trees, a shaded band along each trail edge, bare rock
  - canopy.png       colour of the mountain from afar, where trees are not drawn one by one: the
                     forest as a dark mass with the trails cut through it
  - world.json     grid metadata, trails, lifts, paths, places

Run:  python3 tools/terrain/build_world.py
Deps: numpy pyproj tifffile imagecodecs pillow
"""
from __future__ import annotations

import gzip
import json
import sys
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
from pathlib import Path

import numpy as np
import tifffile
from PIL import Image, ImageDraw, ImageFilter
from pyproj import Transformer

ROOT = Path(__file__).resolve().parents[2]
CACHE = Path(__file__).resolve().parent / "cache"
OUT = ROOT / "public" / "world"

# Bounding box (lon/lat) covering the ski area, the summit, the Ski Bowl and North Creek.
WEST, SOUTH, EAST, NORTH = -74.062, 43.660, -73.980, 43.706

REAL_CELL_M = 4.0  # elevation sample spacing in real metres
H_SCALE = 1 / 1.2  # real horizontal metres -> game metres: the mountain is close to life size
V_SCALE = 1.25  # real vertical metres -> game metres (slopes read 1.5x steeper than life)
# A little wider than life, so a trail has room for turns at game speeds.
TRAIL_WIDTH_REAL_M = {"easy": 62, "intermediate": 50, "advanced": 40, "expert": 34, "freeride": 45}
GLADE_WIDTH_REAL_M = 0  # glades keep their trees

GROUND_TEXELS_PER_CELL = 2
TRAIL_RGB = (252, 253, 255)
FOREST_RGB = (176, 189, 212)
EDGE_SHADE_RGB = (139, 155, 186)
EDGE_SHADE_REACH_M = 9.0  # game metres of shade outside a trail edge
ROCK_RGB = (104, 110, 128)
ROCK_SLOPE_DEG = (48, 60)  # snow gives way to bare rock between these slopes, off the trails
CANOPY_CELLS_PER_TEXEL = 2
CANOPY_RGB = (86, 108, 112)  # snowy firs seen from far away
CANOPY_TRAIL_RGB = (240, 244, 251)

DEM_URL = "https://elevation.nationalmap.gov/arcgis/rest/services/3DEPElevation/ImageServer/exportImage"
OSM_URL = "https://api.openstreetmap.org/api/0.6/map"
UTM = "EPSG:26918"  # NAD83 / UTM zone 18N

# Plain misspellings in the map data, corrected here until they are fixed at the source.
NAME_FIXES = {"Straigh Brook Quad": "Straight Brook Quad"}

PLACE_NAMES = {
    "Base Lodge": "base-lodge",
    "Saddle Lodge": "saddle-lodge",
    "Warming Hut": "warming-hut",
    "Gore Mountain Lodge": "gore-mountain-lodge",
    "Joe Minder Lodge": "ski-bowl-lodge",
    "North Creek Depot Museum": "depot",
}


def fetch(url: str, dest: Path) -> Path:
    if dest.exists() and dest.stat().st_size > 0:
        return dest
    dest.parent.mkdir(parents=True, exist_ok=True)
    print(f"downloading {dest.name} ...", file=sys.stderr)
    req = urllib.request.Request(url, headers={"User-Agent": "terrain-build-script"})
    with urllib.request.urlopen(req, timeout=180) as r:
        dest.write_bytes(r.read())
    return dest


def pack_heights(q: np.ndarray) -> bytes:
    """Store each height as its difference from the sample to its west; the first sample of a row
    as its difference from the first sample of the row above. Neighbouring heights are close, so
    the differences are small numbers that compress several times better than the heights do.
    Differences wrap around at 65536; src/world/codec.ts undoes this."""
    d = q.astype(np.int64)
    out = np.empty_like(d)
    out[:, 1:] = d[:, 1:] - d[:, :-1]
    out[1:, 0] = d[1:, 0] - d[:-1, 0]
    out[0, 0] = d[0, 0]
    return (out % 65536).astype("<u2").tobytes()


def main() -> None:
    to_utm = Transformer.from_crs("EPSG:4326", UTM, always_xy=True)
    xs, ys = to_utm.transform([WEST, EAST, WEST, EAST], [SOUTH, SOUTH, NORTH, NORTH])
    e0 = np.floor(min(xs) / REAL_CELL_M) * REAL_CELL_M
    e1 = np.ceil(max(xs) / REAL_CELL_M) * REAL_CELL_M
    n0 = np.floor(min(ys) / REAL_CELL_M) * REAL_CELL_M
    n1 = np.ceil(max(ys) / REAL_CELL_M) * REAL_CELL_M
    # Samples sit on cell corners, so the grid has one more sample than cells.
    cols = int(round((e1 - e0) / REAL_CELL_M)) + 1
    rows = int(round((n1 - n0) / REAL_CELL_M)) + 1

    # --- elevation -------------------------------------------------------
    half = REAL_CELL_M / 2
    query = urllib.parse.urlencode(
        {
            "bbox": f"{e0 - half},{n0 - half},{e1 + half},{n1 + half}",
            "bboxSR": 26918,
            "imageSR": 26918,
            "size": f"{cols},{rows}",
            "format": "tiff",
            "pixelType": "F32",
            "interpolation": "RSP_BilinearInterpolation",
            "f": "image",
        }
    )
    dem_path = fetch(f"{DEM_URL}?{query}", CACHE / f"dem_{cols}x{rows}.tif")
    elev = tifffile.imread(dem_path).astype(np.float64)
    if elev.shape != (rows, cols):
        raise SystemExit(f"unexpected DEM shape {elev.shape}, wanted {(rows, cols)}")
    if not np.isfinite(elev).all() or elev.min() < -100:
        raise SystemExit("DEM contains no-data cells")

    elev_min = float(np.floor(elev.min()))
    game_h = (elev - elev_min) * V_SCALE
    height_step = 0.02  # one uint16 step = 2 cm of game height
    quant = np.round(game_h / height_step)
    if quant.max() > 65535:
        raise SystemExit("height range overflows uint16")

    cell = REAL_CELL_M * H_SCALE
    width = (cols - 1) * cell
    depth = (rows - 1) * cell
    ec, nc = (e0 + e1) / 2, (n0 + n1) / 2

    def to_game(lon: float, lat: float) -> tuple[float, float]:
        e, n = to_utm.transform(lon, lat)
        return (e - ec) * H_SCALE, -(n - nc) * H_SCALE  # +x east, +z south

    def to_px(x: float, z: float) -> tuple[float, float]:
        return (x + width / 2) / cell, (z + depth / 2) / cell

    def ground(x: float, z: float) -> float:
        px, pz = to_px(x, z)
        c = int(min(max(round(px), 0), cols - 1))
        r = int(min(max(round(pz), 0), rows - 1))
        return float(game_h[r, c])

    # --- OpenStreetMap ----------------------------------------------------
    osm_path = fetch(f"{OSM_URL}?bbox={WEST},{SOUTH},{EAST},{NORTH}", CACHE / "gore.osm")
    root = ET.parse(osm_path).getroot()
    nodes = {n.get("id"): (float(n.get("lon")), float(n.get("lat"))) for n in root.iter("node")}

    trails, lifts, paths, places, water = [], [], [], [], []
    # Groomed trails as shapes in grid units, drawn later at whatever resolution is needed.
    strokes: list[tuple[str, list[tuple[float, float]], float]] = []

    def inside(p: tuple[float, float]) -> bool:
        return abs(p[0]) <= width / 2 and abs(p[1]) <= depth / 2

    for way in root.iter("way"):
        tags = {t.get("k"): t.get("v") for t in way.findall("tag")}
        ll = [nodes[nd.get("ref")] for nd in way.findall("nd") if nd.get("ref") in nodes]
        if len(ll) < 2:
            continue
        pts = [to_game(lon, lat) for lon, lat in ll]
        if not any(inside(p) for p in pts):
            continue
        flat = [round(v, 1) for p in pts for v in p]
        name = tags.get("name") or tags.get("piste:name")
        name = NAME_FIXES.get(name, name)
        closed = way.findall("nd")[0].get("ref") == way.findall("nd")[-1].get("ref")

        if tags.get("piste:type") == "downhill":
            difficulty = tags.get("piste:difficulty") or "intermediate"
            glade = "glade" in (name or "").lower() or tags.get("piste:grooming") == "backcountry"
            real_w = GLADE_WIDTH_REAL_M if glade else TRAIL_WIDTH_REAL_M.get(difficulty, 40)
            px = [to_px(*p) for p in pts]
            if closed and tags.get("area") == "yes":
                strokes.append(("area", px, 0.0))
            elif real_w > 0:
                strokes.append(("line", px, real_w / REAL_CELL_M))
            trails.append(
                {
                    "name": name,
                    "difficulty": difficulty,
                    "glade": glade,
                    "area": bool(closed and tags.get("area") == "yes"),
                    "width": round(real_w * H_SCALE, 1),
                    "pts": flat,
                }
            )
        elif "aerialway" in tags:
            lifts.append({"name": name, "kind": tags["aerialway"], "pts": flat})
        elif tags.get("highway") in ("path", "footway") and name:
            paths.append({"name": name, "pts": flat})
        elif tags.get("waterway") in ("river", "stream") and name:
            water.append({"name": name, "kind": tags["waterway"], "pts": flat})
        elif "building" in tags and name in PLACE_NAMES:
            x = sum(p[0] for p in pts) / len(pts)
            z = sum(p[1] for p in pts) / len(pts)
            places.append({"id": PLACE_NAMES[name], "name": name, "x": round(x, 1), "z": round(z, 1)})

    # Highest point in the grid is the Gore summit.
    r, c = np.unravel_index(int(np.argmax(game_h)), game_h.shape)
    places.append(
        {"id": "summit", "name": "Gore Summit", "x": round(c * cell - width / 2, 1), "z": round(r * cell - depth / 2, 1)}
    )
    seen: dict[str, int] = {}
    for p in sorted(places, key=lambda p: (p["id"], p["x"])):
        p["y"] = round(ground(p["x"], p["z"]), 1)
        seen[p["id"]] = seen.get(p["id"], 0) + 1
        if seen[p["id"]] > 1:
            p["id"] = f'{p["id"]}-{seen[p["id"]]}'

    # Lift lines run bottom to top in the output regardless of how they were mapped.
    for lift in lifts:
        p = lift["pts"]
        if ground(p[0], p[1]) > ground(p[-2], p[-1]):
            pairs = [p[i : i + 2] for i in range(0, len(p), 2)][::-1]
            lift["pts"] = [v for pair in pairs for v in pair]
    # Trails run top to bottom.
    for trail in trails:
        p = trail["pts"]
        if not trail["area"] and ground(p[0], p[1]) < ground(p[-2], p[-1]):
            pairs = [p[i : i + 2] for i in range(0, len(p), 2)][::-1]
            trail["pts"] = [v for pair in pairs for v in pair]

    def draw_trails(scale: int) -> Image.Image:
        """Rasterise the groomed trails with `scale` pixels per grid cell."""
        img = Image.new("L", (cols * scale, rows * scale), 0)
        draw = ImageDraw.Draw(img)
        for kind, px, w in strokes:
            # Samples sit at pixel centres, so a grid coordinate g lands at (g + 0.5) * scale.
            pts = [((x + 0.5) * scale, (y + 0.5) * scale) for x, y in px]
            if kind == "area":
                draw.polygon(pts, fill=255)
                continue
            width = max(1, round(w * scale))
            draw.line(pts, fill=255, width=width, joint="curve")
            r = width / 2
            for cx, cy in pts:
                draw.ellipse((cx - r, cy - r, cx + r, cy + r), fill=255)
        return img

    mask_img = draw_trails(1)

    # How much bare rock shows at each sample, 0..1, from the steepness of the game terrain.
    gz_, gx_ = np.gradient(game_h, cell)
    slope_deg = np.degrees(np.arctan(np.hypot(gx_, gz_)))
    rock = np.clip((slope_deg - ROCK_SLOPE_DEG[0]) / (ROCK_SLOPE_DEG[1] - ROCK_SLOPE_DEG[0]), 0, 1)
    rock_img = Image.fromarray((rock * 255).astype(np.uint8), "L")

    def colour(size: tuple[int, int], trail_rgb, forest_rgb, shade_reach_px: float) -> Image.Image:
        """Paint the mountain at `size`: trails, forest (optionally shaded along trail edges), rock."""
        # Trails are drawn at four times the grid and shrunk, for smooth edges.
        fine = draw_trails(4).resize(size, Image.LANCZOS)
        trail = np.asarray(fine, dtype=np.float32)[..., None] / 255.0
        off_trail = np.broadcast_to(np.array(forest_rgb, dtype=np.float32), (size[1], size[0], 3)).copy()
        if shade_reach_px > 0:
            spread = np.asarray(fine.filter(ImageFilter.GaussianBlur(shade_reach_px)), dtype=np.float32)[..., None] / 255.0
            # Shade is strongest just outside an edge and fades away from it.
            off_trail += (np.array(EDGE_SHADE_RGB, dtype=np.float32) - off_trail) * np.clip(spread * 2.2, 0, 1)
        bare = np.asarray(rock_img.resize(size, Image.BILINEAR), dtype=np.float32)[..., None] / 255.0
        off_trail += (np.array(ROCK_RGB, dtype=np.float32) - off_trail) * bare
        rgb = off_trail + (np.array(trail_rgb, dtype=np.float32) - off_trail) * trail
        return Image.fromarray(np.clip(np.round(rgb), 0, 255).astype(np.uint8), "RGB")

    k = GROUND_TEXELS_PER_CELL
    ground_img = colour((cols * k, rows * k), TRAIL_RGB, FOREST_RGB, EDGE_SHADE_REACH_M / (cell / k))
    canopy_size = (-(-cols // CANOPY_CELLS_PER_TEXEL), -(-rows // CANOPY_CELLS_PER_TEXEL))
    canopy_img = colour(canopy_size, CANOPY_TRAIL_RGB, CANOPY_RGB, 0)

    # --- write -------------------------------------------------------------
    OUT.mkdir(parents=True, exist_ok=True)
    for stale in ("height.bin", "trailmask.bin"):
        (OUT / stale).unlink(missing_ok=True)
    (OUT / "height.bin.gz").write_bytes(gzip.compress(pack_heights(quant.astype(np.uint16)), 9, mtime=0))
    (OUT / "trailmask.bin.gz").write_bytes(gzip.compress(np.asarray(mask_img, dtype=np.uint8).tobytes(), 9, mtime=0))
    ground_img.save(OUT / "ground.png", optimize=True)
    canopy_img.save(OUT / "canopy.png", optimize=True)
    world = {
        "grid": {
            "cols": cols,
            "rows": rows,
            "cell": cell,
            "heightStep": height_step,
            "width": width,
            "depth": depth,
        },
        "real": {
            "crs": UTM,
            "centerEasting": ec,
            "centerNorthing": nc,
            "hScale": H_SCALE,
            "vScale": V_SCALE,
            "elevMinM": elev_min,
            "elevMaxM": round(float(elev.max()), 1),
        },
        "places": sorted(places, key=lambda p: p["id"]),
        "lifts": sorted(lifts, key=lambda l: str(l["name"])),
        "trails": sorted(trails, key=lambda t: (str(t["name"]), len(t["pts"]))),
        "paths": sorted(paths, key=lambda t: (str(t["name"]), len(t["pts"]))),
        "water": sorted(water, key=lambda t: (str(t["name"]), len(t["pts"]))),
        "attribution": "Elevation: USGS 3DEP (public domain). Map data (c) OpenStreetMap contributors, ODbL.",
    }
    (OUT / "world.json").write_text(json.dumps(world, separators=(",", ":")))

    named = sorted({t["name"] for t in trails if t["name"]})
    print(f"grid {cols}x{rows}, cell {cell} m, world {width:.0f} x {depth:.0f} m")
    print(f"elevation {elev.min():.0f}-{elev.max():.0f} m real, relief {game_h.max():.0f} m in game")
    print(f"{len(named)} named trails, {len(lifts)} lifts, {len(paths)} paths, {len(places)} places")
    print("places:", ", ".join(f"{p['id']}@y={p['y']}" for p in world["places"]))


if __name__ == "__main__":
    main()
