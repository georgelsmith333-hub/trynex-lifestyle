from pathlib import Path
from PIL import Image

root = Path('/home/ubuntu/trynex-lifestyle/artifacts/trynex-storefront/public')
paths = [
    'mockups/source-kit-v3/tshirt/white/front.png', 'mockups/source-kit-v3/tshirt/white/back.png',
    'mockups/source-kit-v3/longsleeve/white/front.png', 'mockups/source-kit-v3/longsleeve/white/back.png',
    'mockups/canonical/hoodie/white/front.png', 'mockups/canonical/hoodie/white/back.png',
    'mockups/source-kit-v3/hoodie/white/front.png', 'mockups/source-kit-v3/hoodie/white/back.png',
    'mockups/source-kit-v3/mug/white/front.png', 'mockups/source-kit-v3/mug/white/back.png',
    'mockups/source-kit-v3/cap/white/front.png', 'mockups/source-kit-v3/cap/white/back.png',
    'mockups/source-kit-v3/waterbottle/white/front.png', 'mockups/source-kit-v3/waterbottle/white/back.png',
]
for rel in paths:
    p = root / rel
    try:
        im = Image.open(p).convert('RGBA')
        alpha = im.getchannel('A')
        amin, amax = alpha.getextrema()
        colors = im.getcolors(maxcolors=2_000_000)
        checker = sum(1 for count, rgba in (colors or []) if rgba[:3] in {(204,204,204),(255,255,255)})
        print(f'{rel}\tsize={im.size}\talpha={amin}-{amax}\twhite-checker-pixels={checker}')
    except Exception as exc:
        print(f'{rel}\tERROR={exc}')
