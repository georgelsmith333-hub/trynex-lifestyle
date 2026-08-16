from pathlib import Path
from PIL import Image
import numpy as np

ROOT = Path('/home/ubuntu/trynex-release/artifacts/trynex-storefront/public/mockups')
files = [
    'normalized-cutouts/hoodie-forest-back.png',
    'normalized-cutouts/hoodie-grey-back.png',
    'normalized-cutouts/hoodie-black-back.png',
    'normalized-cutouts/longsleeve-forest-back.png',
    'normalized-cutouts/tshirt-olive-back.png',
    'normalized-cutouts/mug-black-back.png',
    'normalized-cutouts/cap-black-back.png',
    'normalized-cutouts/waterbottle-black-back.png',
]
for rel in files:
    p = ROOT / rel
    a = np.array(Image.open(p).convert('RGBA'))
    alpha = a[:,:,3]
    h,w = alpha.shape
    corners = [int(alpha[y,x]) for y,x in ((0,0),(0,w-1),(h-1,0),(h-1,w-1))]
    edge = np.concatenate([alpha[0,:], alpha[-1,:], alpha[:,0], alpha[:,-1]])
    nonzero_edge = int(np.count_nonzero(edge > 16))
    print(rel, 'size=', (w,h), 'bbox=', Image.fromarray(alpha).getbbox(), 'corners=', corners, 'edge_nonzero=', nonzero_edge, 'edge_alpha_max=', int(edge.max()))
