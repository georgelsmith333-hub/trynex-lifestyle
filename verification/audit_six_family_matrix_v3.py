from pathlib import Path
from collections import deque
import json
import numpy as np
from PIL import Image

ROOT = Path('/home/ubuntu/trynex-release/artifacts/trynex-storefront/public/mockups/source-kit-v3')
OUT = Path('/home/ubuntu/trynex-release/verification/six-family-v3-metrics.json')

families = {
    'tshirt': ['white','black','navy','maroon','olive','sky-blue','grey','red'],
    'longsleeve': ['white','black','navy','maroon','olive','grey','red','sky-blue','burgundy','forest'],
    'hoodie': ['white','black','navy','grey','maroon','olive','red','sky-blue','forest','burgundy'],
    'mug': ['white','black','navy','red','green','purple','sky-blue','pink','maroon','orange'],
    'cap': ['white','black','navy','maroon','olive','red','grey','forest'],
    'waterbottle': ['white','black','navy','forest','sky-blue','red','pink','teal'],
}

def metrics(path: Path):
    a = np.array(Image.open(path).convert('RGBA'))
    rgb = a[:, :, :3].astype(np.int16)
    alpha = a[:, :, 3]
    h, w = alpha.shape
    nz = alpha > 16
    ys, xs = np.where(nz)
    if len(xs) == 0:
        return {'path': str(path), 'nonempty': False}
    border = np.zeros_like(nz)
    border[0, :] = True; border[-1, :] = True; border[:, 0] = True; border[:, -1] = True
    border_opaque = int(np.count_nonzero(nz & border))
    corner_alpha = [int(alpha[y, x]) for y, x in ((0,0),(0,w-1),(h-1,0),(h-1,w-1))]
    near_white = (rgb.min(axis=2) > 232) & ((rgb.max(axis=2) - rgb.min(axis=2)) < 24) & (alpha > 16)
    # Count border-connected near-white pixels as a conservative matte/halo signal.
    seen = np.zeros((h, w), dtype=bool)
    q = deque()
    for x in range(w):
        for y in (0, h-1):
            if near_white[y, x] and not seen[y, x]: seen[y, x] = True; q.append((y, x))
    for y in range(h):
        for x in (0, w-1):
            if near_white[y, x] and not seen[y, x]: seen[y, x] = True; q.append((y, x))
    while q:
        y, x = q.popleft()
        for dy, dx in ((1,0),(-1,0),(0,1),(0,-1)):
            ny, nx = y + dy, x + dx
            if 0 <= ny < h and 0 <= nx < w and near_white[ny, nx] and not seen[ny, nx]:
                seen[ny, nx] = True; q.append((ny, nx))
    halo = int(np.count_nonzero(seen))
    return {
        'path': str(path.relative_to(ROOT)),
        'nonempty': True,
        'width': w, 'height': h,
        'alpha_bounds': [int(xs.min()), int(ys.min()), int(xs.max()), int(ys.max())],
        'alpha_area': int(np.count_nonzero(nz)),
        'alpha_area_ratio': round(float(np.count_nonzero(nz) / (w*h)), 6),
        'border_opaque_pixels': border_opaque,
        'corner_alpha': corner_alpha,
        'border_connected_near_white_pixels': halo,
        'mean_rgb_on_alpha': [round(float(rgb[:, :, i][nz].mean()), 2) for i in range(3)],
    }

rows = []
for family, colors in families.items():
    for color in colors:
        faces = {}
        for face in ('front', 'back'):
            p = ROOT / family / color / f'{face}.png'
            if not p.exists():
                faces[face] = {'missing': True, 'path': str(p)}
            else:
                faces[face] = metrics(p)
        if all('alpha_area' in faces[f] for f in faces):
            fa, ba = faces['front']['alpha_area'], faces['back']['alpha_area']
            faces['area_ratio_back_to_front'] = round(ba / fa, 4) if fa else None
        rows.append({'family': family, 'color': color, 'faces': faces})

summary = {'asset_count': sum(1 for r in rows for f in ('front','back') if not r['faces'][f].get('missing')), 'rows': rows}
OUT.write_text(json.dumps(summary, indent=2))
print(json.dumps({'asset_count': summary['asset_count'], 'rows': len(rows), 'missing_faces': sum(1 for r in rows for f in ('front','back') if r['faces'][f].get('missing')), 'border_opaque_assets': sum(1 for r in rows for f in ('front','back') if r['faces'][f].get('border_opaque_pixels', 0) > 0), 'halo_assets': sum(1 for r in rows for f in ('front','back') if r['faces'][f].get('border_connected_near_white_pixels', 0) > 0)}, indent=2))
