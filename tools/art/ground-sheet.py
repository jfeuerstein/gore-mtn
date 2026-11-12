#!/usr/bin/env python3
"""Lay out the sheets of marks that are printed on the ground.

  ground-sheet.py cache-dir out-dir

For each kind of mark there is a painted sheet of separate black shapes on white
(make-ground.mjs). The shapes are cut out, and scattered over a square that repeats: each
somewhere in its own square of a grid, so they are evenly spread and never crowded, turned
and sized at random, and carried round to the other side where one runs off an edge. The
result is one grey picture a kind, white where there is a mark, which the game prints in
the season's inks. The same every time it is run.
"""
import sys

import numpy as np
from PIL import Image
from scipy import ndimage

SIZE = 1024
# How much ground a sheet covers before it repeats, in metres: the game's MARK_REPEAT.
REPEAT = 16.0
PX = SIZE / REPEAT

# For each kind: how long a mark is on the ground, in metres; how many squares the grid has
# each way and the share of them that get a mark; how far a mark may be turned, in degrees;
# and how many marks stand together.
KINDS = {
    'leaves': dict(long=(0.3, 0.5), squares=13, keep=0.8, turn=180, together=(1, 1)),
    'tufts': dict(long=(0.38, 0.6), squares=10, keep=0.7, turn=180, together=(1, 1)),
    'flowers': dict(long=(0.16, 0.27), squares=9, keep=0.65, turn=180, together=(2, 4)),
    'ferns': dict(long=(0.5, 0.8), squares=9, keep=0.65, turn=180, together=(1, 1)),
    # A cone is as long as it is broad, and would come out far bigger than a twig of the same length: `stout` shrinks what is.
    'twigs': dict(long=(0.45, 0.8), squares=8, keep=0.6, turn=180, together=(1, 1), stout=0.5),
    'pebbles': dict(long=(0.14, 0.32), squares=10, keep=0.6, turn=180, together=(1, 3)),
    # Strokes lie east and west, as the groomer's lines and the wind's do on this mountain.
    # Thin and few: a field of snow is nearly all snow. `flat` presses a stroke thinner than it was painted.
    'strokes': dict(long=(0.55, 1.1), squares=9, keep=0.7, turn=6, together=(1, 1), flat=0.5),
}


def shapes(path):
    """The separate shapes on a painted sheet, each as a picture of its own: white on black."""
    ink = np.asarray(Image.open(path).convert('L')) < 110
    # Bits that belong together (a stroke's bristles, a sprig's leaves) are a little apart: join what nearly touches.
    joined, count = ndimage.label(ndimage.binary_dilation(ink, iterations=5))
    boxes = ndimage.find_objects(joined)
    areas = ndimage.sum(ink, joined, range(1, count + 1))
    usual = np.median([a for a in areas if a > areas.max() * 0.1])
    found = []
    for i, box in enumerate(boxes):
        ys, xs = box
        # Not what runs off the sheet, nor a speck, nor two that have run together.
        if ys.start <= 1 or xs.start <= 1 or ys.stop >= ink.shape[0] - 1 or xs.stop >= ink.shape[1] - 1:
            continue
        if not 0.3 * usual < areas[i] < 2.6 * usual:
            continue
        part = ink[box] & (joined[box] == i + 1)
        found.append(Image.fromarray((part * 255).astype(np.uint8)))
    return found


def lay(kind, stamps, rng):
    spec = KINDS[kind]
    sheet = np.zeros((SIZE, SIZE), dtype=np.uint8)

    def put(stamp, cx, cy):
        long = rng.uniform(*spec['long']) * PX
        if max(stamp.size) < 1.6 * min(stamp.size):
            long *= spec.get('stout', 1)
        if 'flat' in spec:
            stamp = stamp.resize((stamp.size[0], max(1, round(stamp.size[1] * spec['flat']))), Image.LANCZOS)
        turned = stamp.rotate(rng.uniform(-spec['turn'], spec['turn']), expand=True, resample=Image.BICUBIC)
        if rng.random() < 0.5:
            turned = turned.transpose(Image.FLIP_LEFT_RIGHT)
        box = turned.getbbox()
        if not box:
            return
        turned = turned.crop(box)
        scale = long / max(turned.size)
        small = np.asarray(turned.resize((max(1, round(turned.size[0] * scale)), max(1, round(turned.size[1] * scale))), Image.LANCZOS))
        h, w = small.shape
        ys = (np.arange(h) + int(round(cy - h / 2))) % SIZE
        xs = (np.arange(w) + int(round(cx - w / 2))) % SIZE
        sheet[np.ix_(ys, xs)] = np.maximum(sheet[np.ix_(ys, xs)], small)

    cell = SIZE / spec['squares']
    for j in range(spec['squares']):
        for i in range(spec['squares']):
            x = (i + rng.uniform(0.15, 0.85)) * cell
            y = (j + rng.uniform(0.15, 0.85)) * cell
            if rng.random() >= spec['keep']:
                continue
            many = rng.integers(spec['together'][0], spec['together'][1] + 1)
            for n in range(many):
                spread = 0 if many == 1 else spec['long'][1] * PX * 1.1
                put(stamps[rng.integers(len(stamps))], x + rng.uniform(-spread, spread), y + rng.uniform(-spread, spread) * (0.35 if kind == 'strokes' else 1))
    return sheet


def main():
    cache, out = sys.argv[1], sys.argv[2]
    import os
    os.makedirs(out, exist_ok=True)
    for seed, kind in enumerate(KINDS):
        stamps = shapes(f'{cache}/{kind}.webp')
        if len(stamps) < 6:
            sys.exit(f'{kind}: only {len(stamps)} shapes could be cut from its sheet; make it again with --redo {kind} --bump 2')
        sheet = lay(kind, stamps, np.random.default_rng(1000 + seed))
        Image.fromarray(sheet).save(f'{out}/{kind}.png', optimize=True)
        print(f'{kind}: {len(stamps)} shapes, {100 * (sheet > 127).mean():.1f}% inked')


main()
