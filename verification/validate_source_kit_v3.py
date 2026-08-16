from pathlib import Path
from PIL import Image
import json, hashlib
ROOT=Path('/home/ubuntu/trynex-release/artifacts/trynex-storefront/public/mockups/source-kit-v3')
errors=[]; rows=[]
for p in sorted(ROOT.glob('*/*/*.png')):
    family,color,face=p.relative_to(ROOT).parts
    with Image.open(p) as im:
        rgba=im.convert('RGBA'); alpha=rgba.getchannel('A'); bbox=alpha.getbbox()
        corners=[alpha.getpixel(pt) for pt in [(0,0),(rgba.width-1,0),(0,rgba.height-1),(rgba.width-1,rgba.height-1)]]
        if rgba.size != (1024,1024): errors.append(f'{p}: size {rgba.size}')
        if not bbox: errors.append(f'{p}: empty alpha')
        if any(v != 0 for v in corners): errors.append(f'{p}: opaque corner {corners}')
    m=ROOT/'manifests'/f'{family}-{color}-{face[:-4]}.json'
    if not m.exists(): errors.append(f'{p}: missing manifest')
    else:
        data=json.loads(m.read_text())
        if data.get('schema') != 'trynex-smart-mockup/v3': errors.append(f'{m}: schema {data.get("schema")}')
        if data.get('sha256') != hashlib.sha256(p.read_bytes()).hexdigest(): errors.append(f'{m}: checksum mismatch')
        rows.append(data)
index=json.loads((ROOT/'manifest-index.json').read_text())
if index.get('assetCount') != len(rows): errors.append(f'index assetCount={index.get("assetCount")} rows={len(rows)}')
print(json.dumps({'pngCount':len(list(ROOT.glob("*/*/*.png"))),'manifestRows':len(rows),'errors':errors[:30],'errorCount':len(errors),'categories':sorted({r['category'] for r in rows})},indent=2))
raise SystemExit(1 if errors else 0)
