#!/usr/bin/env python3
"""Build the game world from real data.

Inputs (downloaded once into tools/terrain/cache/, which is gitignored):
  - USGS 3DEP elevation for the Gore Mountain bounding box
  - OpenStreetMap ways for ski trails, lifts, paths, buildings and water

Outputs (committed, in public/world/):
  - height.bin     uint16 little-endian, rows north to south, columns west to east
  - trailmask.bin  uint8, 255 on a ski trail, 0 elsewhere, same grid (what the game logic reads)
  - ground.png     colour of the snow, three texels per grid cell: bright groomed trails, cooler
                   snow under the trees, and a shaded band along each trail edge (what is drawn)
  - world.json     grid metadata, trails, lifts, paths, places

Run:  python3 tools/terrain/build_world.py
Deps: numpy pyproj tifffile imagecodecs pillow
"""
from __future__ import annotations

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

REAL_CELL_M = 10.0  # elevation sample spacing in real metres
H_SCALE = 1 / 3  # real horizontal metres -> game metres
V_SCALE = 1 / 2  # real vertical metres -> game metres (slopes read 1.5x steeper than life)
# A little wider than life, so a trail has room for turns at game speeds.
TRAIL_WIDTH_REAL_M = {"easy": 70, "intermediate": 56, "advanced": 44, "expert": 38, "freeride": 50}
GLADE_WIDTH_REAL_M = 0  # glades keep their trees

GROUND_TEXELS_PER_CELL = 3
TRAIL_RGB = (252, 253, 255)
FOREST_RGB = (176, 189, 212)
EDGE_SHADE_RGB = (139, 155, 186)
EDGE_SHADE_REACH_M = 5.0  # game metres of shade outside a trail edge

DEM_URL = "https://elevation.nationalmap.gov/arcgis/rest/services/3DEPElevation/ImageServer/exportImage"
OSM_URL = "https://api.openstreetmap.org/api/0.6/map"
UTM = "EPSG:26918"  # NAD83 / UTM zone 18N

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
    height_step = 0.01  # one uint16 step = 1 cm of game height
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

    # Ground colour: drawn at twice the final size and shrunk, for smooth trail edges.
    k = GROUND_TEXELS_PER_CELL
    fine = draw_trails(k * 2).resize((cols * k, rows * k), Image.LANCZOS)
    trail = np.asarray(fine, dtype=np.float32) / 255.0
    reach_px = EDGE_SHADE_REACH_M / (cell / k)
    spread = np.asarray(fine.filter(ImageFilter.GaussianBlur(reach_px)), dtype=np.float32) / 255.0
    # Shade is strongest just outside an edge and fades away from it; none on the trail itself.
    shade = np.clip(spread * 2.2, 0, 1) * (1 - trail)
    forest = np.array(FOREST_RGB, dtype=np.float32)
    off_trail = forest + (np.array(EDGE_SHADE_RGB, dtype=np.float32) - forest) * shade[..., None]
    rgb = off_trail + (np.array(TRAIL_RGB, dtype=np.float32) - off_trail) * trail[..., None]
    ground_img = Image.fromarray(np.clip(np.round(rgb), 0, 255).astype(np.uint8), "RGB")

    # --- write -------------------------------------------------------------
    OUT.mkdir(parents=True, exist_ok=True)
    (OUT / "height.bin").write_bytes(quant.astype("<u2").tobytes())
    (OUT / "trailmask.bin").write_bytes(np.asarray(mask_img, dtype=np.uint8).tobytes())
    ground_img.save(OUT / "ground.png", optimize=True)
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
