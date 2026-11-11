#!/usr/bin/env python3
"""Cut a sheet of patches into its patches.

  cut-sheet.py sheet.png out-dir cols size '["id", ...]'

Each patch is whatever stands alone on the bare sheet. They are read as a grid: rows by how
they fall down the sheet, columns by where they sit across it, so a sheet that came back a
patch or a row short still gives every patch it has its right name. Prints, as JSON, the ids
that were not on the sheet.
"""
import json
import sys

import numpy as np
from PIL import Image
from scipy import ndimage

sheet, out, cols, size, ids = sys.argv[1], sys.argv[2], int(sys.argv[3]), int(sys.argv[4]), json.loads(sys.argv[5])
im = Image.open(sheet).convert('RGBA')
pixels = np.asarray(im)
alpha = pixels[:, :, 3] > 40
labels, count = ndimage.label(alpha)
boxes = ndimage.find_objects(labels)
sizes = ndimage.sum(alpha, labels, range(1, count + 1))
# A patch is big: anything much smaller than the usual one is a stray thread, and anything
# much bigger is two that touch, which are left out and asked for again.
usual = np.median([s for s in sizes if s > sizes.max() * 0.35])
found = [i for i in range(count) if 0.6 * usual < sizes[i] < 1.5 * usual]
mid = lambda i, axis: (boxes[i][axis].start + boxes[i][axis].stop) / 2
tall = np.median([boxes[i][0].stop - boxes[i][0].start for i in found])

# Rows: a new one wherever the next patch down starts well below the last.
found.sort(key=lambda i: mid(i, 0))
rows = []
for i in found:
    if rows and mid(i, 0) - np.mean([mid(j, 0) for j in rows[-1]]) < tall / 2:
        rows[-1].append(i)
    else:
        rows.append([i])

placed = {}
for r, row in enumerate(rows):
    for i in row:
        c = min(cols - 1, int(mid(i, 1) * cols / alpha.shape[1]))
        if (r, c) in placed:
            sys.exit(f'two patches in row {r + 1}, column {c + 1} of {sheet}')
        placed[(r, c)] = i

missing = []
for n, name in enumerate(ids):
    i = placed.get((n // cols, n % cols))
    if i is None:
        missing.append(name)
        continue
    ys, xs = boxes[i]
    side = max(ys.stop - ys.start, xs.stop - xs.start) + 12
    cy, cx = (ys.start + ys.stop) // 2, (xs.start + xs.stop) // 2
    # Only this patch: anything else that strays into its square is left out.
    one = pixels.copy()
    one[labels != i + 1] = 0
    tile = Image.fromarray(one).crop((cx - side // 2, cy - side // 2, cx - side // 2 + side, cy - side // 2 + side))
    tile.resize((size, size), Image.LANCZOS).save(f'{out}/{name}.webp', 'WEBP', quality=86, method=6)
print(json.dumps(missing))
