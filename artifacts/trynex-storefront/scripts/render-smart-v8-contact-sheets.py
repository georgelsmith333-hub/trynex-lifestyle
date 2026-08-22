from pathlib import Path
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent.parent
SOURCE = ROOT / "public" / "mockups" / "smart-v8"
OUT = ROOT / "review" / "smart-v8-contact-sheets"
OUT.mkdir(parents=True, exist_ok=True)

for family_dir in sorted(path for path in SOURCE.iterdir() if path.is_dir()):
    files = sorted(family_dir.rglob("*.png"))
    if not files:
        continue
    cell_w, cell_h, label_h, cols = 160, 180, 24, 5
    rows = (len(files) + cols - 1) // cols
    sheet = Image.new("RGB", (cols * cell_w, rows * (cell_h + label_h)), "#f7f5f1")
    draw = ImageDraw.Draw(sheet)
    for index, path in enumerate(files):
        image = Image.open(path).convert("RGBA")
        image.thumbnail((cell_w - 20, cell_h - 20))
        thumb = Image.new("RGBA", (cell_w, cell_h), "#ffffff")
        thumb.alpha_composite(image, ((cell_w - image.width) // 2, (cell_h - image.height) // 2))
        x = (index % cols) * cell_w
        y = (index // cols) * (cell_h + label_h)
        sheet.paste(thumb.convert("RGB"), (x, y))
        draw.text((x + 6, y + cell_h + 5), f"{path.parent.name}/{path.stem}", fill="#292524")
    sheet.save(OUT / f"{family_dir.name}.png")
    print(family_dir.name, len(files))
