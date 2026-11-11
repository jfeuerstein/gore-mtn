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
    'facet': dict(faces=1100, colours=8, smooth=False, palette=None, seal=True),
    'park': dict(faces=1000, colours=6, smooth=False, palette='park', seal=True),
    'smooth': dict(faces=2000, colours=12, smooth=True, palette=None, seal=True),
    # For a shape that was made low-poly and plainly coloured to begin with: little is taken away.
    'toy': dict(faces=1400, colours=10, smooth=False, palette=None, seal=False),
}

# The inks of an old park poster, for animals: earths, greys, two blues, cream and near-black.
# No greens: a dull brown is nearer to a green ink than to a brown one, and no animal here is green.
# What a bird adds to those: the blues of a jay, a red, a yellow, a clean white and a true black.
BIRD_MORE = [(0x3F, 0x6F, 0xC4), (0x8F, 0xB4, 0xE3), (0xC8, 0x40, 0x2D), (0xE3, 0xB0, 0x3F), (0x14, 0x16, 0x1A)]
# And what a plant adds: greens, and the colours of flowers, berries and mushrooms.
PLANT_MORE = [
    (0xA9, 0xC9, 0x8A), (0x6F, 0xA3, 0x5C), (0x3F, 0x7D, 0x54), (0x2A, 0x5F, 0x4A), (0xF2, 0xD1, 0x6B), (0xD9, 0x77, 0x2B),
    (0xE8, 0x8F, 0xB0), (0xC2, 0x4F, 0x86), (0x7A, 0x4F, 0xA3), (0x3D, 0x4F, 0x8F), (0x8F, 0x2F, 0x2A),
]

PARK = [
    (0xF4, 0xEC, 0xD6), (0xE2, 0xC9, 0x9A), (0xC9, 0x8F, 0x4A), (0xA8, 0x5A, 0x32), (0x7A, 0x3F, 0x2A),
    (0x4A, 0x33, 0x26), (0x2A, 0x26, 0x24), (0x9A, 0x7B, 0x5C), (0x5E, 0x66, 0x70), (0x7F, 0xA9, 0xB8),
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


def seal(mesh, fine=140):
    """The same shape as one closed solid: no holes, no loose pieces, nothing inside it.

    A generated model is often a skin with gaps in it, in several pieces, with scraps inside.
    Cut down, the gaps open into holes. So the shape is poured into a block of small cubes
    (`fine` of them to its height), the cubes are joined up and filled, the biggest piece is
    kept, and a new skin is drawn round it. Thin parts come out a little stouter.
    """
    from scipy import ndimage
    from skimage import measure
    pitch = 1.0 / fine
    grid = mesh.voxelized(pitch)
    solid = np.pad(grid.matrix, 4)
    ball = ndimage.generate_binary_structure(3, 1)
    # Close the gaps, fill what is inside, and leave everything one cube stouter, so that a thin leg is not lost.
    solid = ndimage.binary_dilation(solid, ball, iterations=2)
    solid = ndimage.binary_fill_holes(solid)
    solid = ndimage.binary_erosion(solid, ball, iterations=1)
    pieces, count = ndimage.label(solid)
    if count > 1:
        sizes = ndimage.sum(solid, pieces, range(1, count + 1))
        solid = pieces == (int(np.argmax(sizes)) + 1)
    field = ndimage.gaussian_filter(solid.astype(np.float32), 0.9)
    verts, faces, _, _ = measure.marching_cubes(field, 0.5)
    # Back from cubes to the model's own measure.
    origin = np.asarray(grid.transform)[:3, 3] - 4 * pitch
    out = trimesh.Trimesh(vertices=verts * pitch + origin, faces=faces[:, ::-1], process=True)
    trimesh.smoothing.filter_taubin(out, iterations=8)
    return out


def calm(mesh, label, rounds=3):
    """Each face takes the colour most of its neighbours have, so colours lie in patches, not specks."""
    label = label.copy()
    pairs = mesh.face_adjacency
    near = [[] for _ in range(len(mesh.faces))]
    for a, b in pairs:
        near[a].append(b)
        near[b].append(a)
    for _ in range(rounds):
        nxt = label.copy()
        for i, ns in enumerate(near):
            if len(ns) < 2:
                continue
            votes = np.bincount(label[ns])
            best = int(votes.argmax())
            if votes[best] >= 2 and best != label[i]:
                nxt[i] = best
        label = nxt
    return label


def convert(source, look, turn, picture=None, which='animal'):
    spec = LOOKS[look]
    full, colours = load(source)
    if picture:
        colours = like(colours, picture)
    full = stand(full, turn)
    def cut(shape):
        out = shape.simplify_quadric_decimation(face_count=spec['faces']) if len(shape.faces) > spec['faces'] else shape.copy()
        out.remove_unreferenced_vertices()
        return out

    if spec['seal']:
        # A clump of thin things (petals, berries, fronds) does not always survive being cut down:
        # the skin tears. Poured into coarser cubes it comes out stouter and simpler, and does.
        thin = None
        for fine in (140, 100, 72, 52):
            thin = cut(seal(full, fine))
            if thin.is_watertight and len(thin.split(only_watertight=False)) == 1:
                break
        else:
            # Still torn at the coarsest: mend what is left, and say so if that leaves next to nothing.
            import pymeshfix
            v, f = pymeshfix.clean_from_arrays(np.ascontiguousarray(thin.vertices, dtype=np.float64), np.ascontiguousarray(thin.faces, dtype=np.int32))
            thin = trimesh.Trimesh(vertices=v, faces=f, process=True)
            if len(thin.faces) < 200 or thin.extents.max() < 0.5:
                raise SystemExit(f'{source}: the shape did not survive being made solid')
    else:
        thin = cut(full)
    # Each thinned triangle takes the colour of the original where its middle lies.
    _, where = cKDTree(full.triangles_center).query(thin.triangles_center)
    face_colour = colours[where]
    # A handful of colours: the same ones every time the tool is run.
    # A flower has more colours to it than a fox.
    k = min(spec['colours'] + (2 if which == 'plant' else 0), len(np.unique(face_colour.round(), axis=0)))
    centres, label = kmeans2(face_colour, k, minit='++', seed=7)
    if spec['palette'] == 'park':
        inks = np.array(PARK + (BIRD_MORE if which != 'animal' else []) + (PLANT_MORE if which == 'plant' else []), dtype=np.float64)
        far = ((centres[:, None, :] - inks[None, :, :]) ** 2).sum(axis=2)
        # A dark coat is black or brown, not navy, unless it is plainly blue.
        dark = (centres.mean(axis=1) < 95) & (centres[:, 2] - centres[:, 0] < (50 if which == 'animal' else 25))
        blue = inks[:, 2] - inks[:, 0] > 25
        far[np.ix_(dark, blue)] = np.inf
        centres = inks[far.argmin(axis=1)]
    if spec['seal']:
        label = calm(thin, label)
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
    ap.add_argument('--inks', choices=['animal', 'bird', 'plant'], default='animal', help='which inks the park print may use')
    ap.add_argument('--preview')
    args = ap.parse_args()
    data, mesh, cols = convert(args.source, args.look, args.turn, args.like, args.inks)
    with open(args.out, 'w') as f:
        json.dump(data, f, separators=(',', ':'))
    if args.preview:
        preview(mesh, cols, args.preview)
    print(f"{args.out}: {len(data['f']) // 3} triangles, {len(data['p'])} colours")
