#!/usr/bin/env python3
"""Turn a generated 3D model (GLB, with a picture wrapped round it) into one the game can draw.

    python3 tools/models/convert.py in.glb out.json --look facet [--like picture.jpg] [--turn 180] [--preview out.png]

The game draws everything with flat colours on plain materials, a few hundred triangles each,
and no picture files. A generated model is none of those things: thousands of triangles, a
texture with the light baked into it, and whichever way up and round it happened to come out.
So this:

  1. stands it up on the ground, a unit tall, facing -z (after `--turn` degrees about upright);
  2. thins it to a few hundred triangles;
  3. gives each triangle one colour, read off the original's picture where the triangle lies;
  4. cuts those colours down to a handful, which takes the baked light out and gives the look.

Looks:
  facet   about 1100 flat triangles in eight colours of the model's own.
  park    about 900 triangles in six colours, each moved to the nearest ink of a park-poster
          palette; the game draws these with a dark outline, like a print.
  smooth  about 2000 triangles in twelve colours, to be shaded smooth: a soft toy.

Needs trimesh, fast-simplification, scipy and Pillow.
"""
import argparse
import json
import math

import numpy as np
import trimesh
from scipy.cluster.vq import kmeans2
from scipy.spatial import cKDTree

LOOKS = {
    'facet': dict(faces=1100, colours=8, smooth=False, palette=None),
    'park': dict(faces=900, colours=6, smooth=False, palette='park'),
    'smooth': dict(faces=2000, colours=12, smooth=True, palette=None),
}

# The inks of an old park poster: a few earths, two greens, two blues, cream and near-black.
PARK = [
    (0xF4, 0xEC, 0xD6), (0xE2, 0xC9, 0x9A), (0xC9, 0x8F, 0x4A), (0xA8, 0x5A, 0x32), (0x7A, 0x3F, 0x2A),
    (0x4A, 0x33, 0x26), (0x2A, 0x26, 0x24), (0x6F, 0x8A, 0x5A), (0x2F, 0x5A, 0x44), (0x7F, 0xA9, 0xB8),
    (0x2B, 0x4A, 0x5E), (0x8A, 0x8F, 0x96), (0xD9, 0xA4, 0x41), (0xB5, 0x3A, 0x2A), (0xFA, 0xFA, 0xF6),
]


def load(path):
    """The model as one mesh, with a colour for every face read from its picture."""
    scene = trimesh.load(path, force='scene')
    mesh = scene.to_geometry() if hasattr(scene, 'to_geometry') else scene.dump(concatenate=True)
    colour = mesh.visual.to_color() if hasattr(mesh.visual, 'to_color') else mesh.visual
    vertex = np.asarray(colour.vertex_colors)[:, :3].astype(np.float64)
    faces = vertex[mesh.faces].mean(axis=1)
    return trimesh.Trimesh(vertices=mesh.vertices, faces=mesh.faces, process=False), faces


def like(colours, picture):
    """The model's colours, graded to those of the picture it was made from.

    The picture wrapped round a generated model comes out duller and darker than the picture it
    was made from. This moves the spread of the model's colours onto the spread of the picture's
    (the thing in it, not the plain background round it), channel by channel.
    """
    from PIL import Image
    im = np.asarray(Image.open(picture).convert('RGB').resize((256, 256))).astype(np.float64)
    ground = np.median(np.concatenate([im[0], im[-1], im[:, 0], im[:, -1]]), axis=0)
    thing = im[np.abs(im - ground).sum(axis=2) > 60]
    if len(thing) < 500:
        return colours
    out = (colours - colours.mean(axis=0)) / (colours.std(axis=0) + 1e-6) * thing.std(axis=0) + thing.mean(axis=0)
    return np.clip(out, 0, 255)


def stand(mesh, turn):
    """On the ground, a unit tall, in the middle, turned to face -z."""
    v = mesh.vertices.copy()
    a = math.radians(turn)
    c, s = math.cos(a), math.sin(a)
    x, z = v[:, 0] * c + v[:, 2] * s, -v[:, 0] * s + v[:, 2] * c
    v[:, 0], v[:, 2] = x, z
    lo, hi = v.min(axis=0), v.max(axis=0)
    v[:, 0] -= (lo[0] + hi[0]) / 2
    v[:, 2] -= (lo[2] + hi[2]) / 2
    v[:, 1] -= lo[1]
    v /= (hi[1] - lo[1])
    mesh.vertices = v
    return mesh


def convert(source, look, turn, picture=None):
    spec = LOOKS[look]
    full, colours = load(source)
    if picture:
        colours = like(colours, picture)
    full = stand(full, turn)
    thin = full.simplify_quadric_decimation(face_count=spec['faces']) if len(full.faces) > spec['faces'] else full.copy()
    thin.remove_unreferenced_vertices()
    # Each thinned triangle takes the colour of the original where its middle lies.
    _, where = cKDTree(full.triangles_center).query(thin.triangles_center)
    face_colour = colours[where]
    # A handful of colours: the same ones every time the tool is run.
    k = min(spec['colours'], len(np.unique(face_colour.round(), axis=0)))
    centres, label = kmeans2(face_colour, k, minit='++', seed=7)
    if spec['palette'] == 'park':
        inks = np.array(PARK, dtype=np.float64)
        centres = inks[((centres[:, None, :] - inks[None, :, :]) ** 2).sum(axis=2).argmin(axis=1)]
    palette = ['#%02x%02x%02x' % tuple(int(round(min(255, max(0, c)))) for c in centre) for centre in centres]
    return {
        # In thousandths of the model's height.
        'v': np.round(thin.vertices * 1000).astype(int).flatten().tolist(),
        'f': thin.faces.flatten().tolist(),
        'c': label.astype(int).tolist(),
        'p': palette,
        'smooth': spec['smooth'],
        'outline': look == 'park',
    }, thin, centres[label]


def preview(mesh, colours, path):
    """A side view and a view from above, to see which way it faces: -z is to the left and up."""
    from PIL import Image, ImageDraw
    size = 360
    im = Image.new('RGB', (size * 2, size), (255, 253, 247))
    draw = ImageDraw.Draw(im)
    tri = mesh.triangles
    n = mesh.face_normals
    for panel, (ax, ay, depth, flip) in enumerate([(2, 1, 0, True), (0, 2, 1, False)]):
        order = np.argsort(tri[:, :, depth].mean(axis=1))
        for i in order:
            shade = 0.6 + 0.4 * abs(n[i][depth])
            pts = []
            for p in tri[i]:
                u = (p[ax] + 0.75) / 1.5 * size
                w = (1 - p[ay]) * size * 0.9 + size * 0.05 if flip else (p[ay] + 0.75) / 1.5 * size
                pts.append((panel * size + u, w))
            draw.polygon(pts, fill=tuple(int(c * shade) for c in colours[i]))
    draw.text((6, 4), 'side: front (-z) should be at the LEFT', fill=(0, 0, 0))
    draw.text((size + 6, 4), 'from above: front (-z) should be at the TOP', fill=(0, 0, 0))
    im.save(path)


if __name__ == '__main__':
    ap = argparse.ArgumentParser()
    ap.add_argument('source')
    ap.add_argument('out')
    ap.add_argument('--look', choices=list(LOOKS), default='facet')
    ap.add_argument('--turn', type=float, default=180, help='degrees about upright; generated models come facing +z, so half a turn by default')
    ap.add_argument('--like', help='the picture the model was made from, to grade its colours to')
    ap.add_argument('--preview')
    args = ap.parse_args()
    data, mesh, cols = convert(args.source, args.look, args.turn, args.like)
    with open(args.out, 'w') as f:
        json.dump(data, f, separators=(',', ':'))
    if args.preview:
        preview(mesh, cols, args.preview)
    print(f"{args.out}: {len(data['f']) // 3} triangles, {len(data['p'])} colours")
