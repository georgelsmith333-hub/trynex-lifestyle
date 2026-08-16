from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT=Path('/home/ubuntu/trynex-release/artifacts/trynex-storefront/public/mockups/source-kit-v3')
OUT=Path('/home/ubuntu/trynex-release/verification/v3-contact-sheets')
OUT.mkdir(parents=True, exist_ok=True)
font=ImageFont.load_default()
for family in sorted(p.name for p in ROOT.iterdir() if p.is_dir() and p.name != 'manifests'):
    colors=sorted(p.name for p in (ROOT/family).iterdir() if p.is_dir())
    tile_w,tile_h=220,250
    cols=4
    rows=(len(colors)*2 + cols-1)//cols
    sheet=Image.new('RGB',(cols*tile_w,rows*tile_h),(245,245,242))
    draw=ImageDraw.Draw(sheet)
    for i,color in enumerate(colors):
        for j,face in enumerate(('front','back')):
            idx=i*2+j
            x=(idx%cols)*tile_w; y=(idx//cols)*tile_h
            im=Image.open(ROOT/family/color/f'{face}.png').convert('RGBA')
            im.thumbnail((200,195),Image.Resampling.LANCZOS)
            px=x+(tile_w-im.width)//2; py=y+8
            sheet.paste(im,(px,py),im)
            draw.text((x+8,y+211),f'{family}/{color}/{face}',fill=(30,30,30),font=font)
    sheet.save(OUT/f'{family}-v3-front-back.png',optimize=True)
print(f'created {len(list(OUT.glob("*.png")))} contact sheets in {OUT}')
