#!/usr/bin/env python3
"""Build the complete 188-surface TryNex mockup matrix.

Pipeline:
  1. Extract the 94 canonical product-photo PNGs from the source-kit PSDs
     (or reuse dist-mockups/_work/base if already present).
  2. Derive the 94 missing views from those photos:
       apparel  -> left-sleeve, right-sleeve, neck-label (bbox-relative crop)
       mug      -> wrap (front photo, wider print zone)
  3. Write all 188 surfaces to dist-mockups/_work/surfaces/
  4. Upscale a 2048 working set for the smart-object PSD/PSB builder
  5. Write a machine-readable manifest and a contact sheet

Exit status is non-zero unless exactly 188 surfaces exist on disk.
"""

from __future__ import annotations

import hashlib
import json
import sys
from pathlib import Path

from PIL import Image, ImageChops, ImageDraw, ImageFilter, ImageOps

TOOLS = Path(__file__).resolve().parent
if str(TOOLS) not in sys.path:
    sys.path.insert(0, str(TOOLS))

from extract_base_pngs import OUT_DIR as BASE_DIR, extract_canonical_bases  # noqa: E402
from mockup_canonical import (  # noqa: E402
    FAMILIES,
    NATIVE,
    TARGET_SURFACES,
    Z1024,
    base_stem,
    iter_surfaces,
)

REPO = TOOLS.parent
# 1024 surfaces live next to the extracted bases so git does not store the
# authentic 94 twice. The 2048 working set is gitignored.
SURFACES = BASE_DIR
SURFACES_2048 = REPO / "dist-mockups" / "_work" / "surfaces-2048"
MANIFEST = REPO / "dist-mockups" / "_work" / "surfaces-manifest.json"
CONTACT = REPO / "dist-mockups" / "_work" / "contact-sheet-188.png"
CANVAS_HI = 2048

# Bbox-relative isolation windows (0..1 inside the product alpha bbox).
# Tuned against the source-kit product photos so a colour-variant with a
# slightly different silhouette still yields a sleeve / collar crop.
SLEEVE_LEFT = {
    "tshirt": (0.00, 0.10, 0.34, 0.58),
    "hoodie": (0.00, 0.18, 0.30, 0.98),
    "longsleeve": (0.00, 0.08, 0.30, 0.98),
}
SLEEVE_RIGHT = {
    "tshirt": (0.66, 0.10, 1.00, 0.58),
    "hoodie": (0.70, 0.18, 1.00, 0.98),
    "longsleeve": (0.70, 0.08, 1.00, 0.98),
}
NECK = {
    "tshirt": (0.28, 0.00, 0.72, 0.34),
    "hoodie": (0.30, 0.00, 0.70, 0.40),
    "longsleeve": (0.28, 0.00, 0.72, 0.32),
}


def sha256(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as fh:
        for chunk in iter(lambda: fh.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def isolate_region(
    base: Image.Image,
    rel: tuple[float, float, float, float],
    canvas: int = NATIVE,
    scale_fit: float = 0.82,
) -> Image.Image:
    """Crop a bbox-relative window, keep product alpha, center on a square canvas."""
    image = base.convert("RGBA")
    alpha = image.getchannel("A")
    bbox = alpha.getbbox()
    if bbox is None:
        raise RuntimeError("empty product alpha")
    bx0, by0, bx1, by1 = bbox
    bw, bh = bx1 - bx0, by1 - by0
    x0, y0, x1, y1 = rel
    rx0 = int(bx0 + x0 * bw)
    ry0 = int(by0 + y0 * bh)
    rx1 = int(bx0 + x1 * bw)
    ry1 = int(by0 + y1 * bh)
    mask = Image.new("L", image.size, 0)
    ImageDraw.Draw(mask).rectangle((rx0, ry0, rx1, ry1), fill=255)
    mask = mask.filter(ImageFilter.GaussianBlur(1.15))
    panel = image.copy()
    panel.putalpha(ImageChops.multiply(alpha, mask))
    crop_box = panel.getchannel("A").getbbox()
    if crop_box is None:
        raise RuntimeError(f"empty region {rel}")
    panel = panel.crop(crop_box)
    out = Image.new("RGBA", (canvas, canvas), (0, 0, 0, 0))
    pw, ph = panel.size
    scale = min(scale_fit * canvas / max(1, pw), scale_fit * canvas / max(1, ph))
    size = (max(1, round(pw * scale)), max(1, round(ph * scale)))
    panel = panel.resize(size, Image.Resampling.LANCZOS)
    out.alpha_composite(panel, ((canvas - size[0]) // 2, (canvas - size[1]) // 2))
    return out


def derive_view(family: str, view: str, front: Image.Image, back: Image.Image | None) -> Image.Image:
    if view == "left-sleeve":
        return isolate_region(front, SLEEVE_LEFT[family])
    if view == "right-sleeve":
        try:
            return isolate_region(front, SLEEVE_RIGHT[family])
        except RuntimeError:
            return ImageOps.mirror(isolate_region(front, SLEEVE_LEFT[family]))
    if view == "neck-label":
        return isolate_region(front, NECK[family], scale_fit=0.78)
    if view == "wrap":
        # Wrap is a print-zone distinction on the same mug photograph.
        # Front is handle-right; that is the canonical wrap working view.
        return front.convert("RGBA")
    raise ValueError(f"no deriver for {family}/{view}")


def save_png(image: Image.Image, path: Path, *, optimize: bool = False, compress: int = 6) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    image.save(path, format="PNG", optimize=optimize, compress_level=compress)


def upscale(image: Image.Image, size: int = CANVAS_HI) -> Image.Image:
    if image.size == (size, size):
        return image
    return image.resize((size, size), Image.Resampling.LANCZOS)


def contact_sheet(paths: list[Path], dest: Path, thumb: int = 96, pad: int = 4, cols: int = 14) -> None:
    if not paths:
        return
    rows = (len(paths) + cols - 1) // cols
    sheet = Image.new("RGBA", (cols * (thumb + pad) + pad, rows * (thumb + pad) + pad), (18, 18, 22, 255))
    for i, path in enumerate(paths):
        im = Image.open(path).convert("RGBA")
        im.thumbnail((thumb, thumb), Image.Resampling.LANCZOS)
        bg = Image.new("RGBA", (thumb, thumb), (32, 32, 38, 255))
        bg.alpha_composite(im, ((thumb - im.width) // 2, (thumb - im.height) // 2))
        x = pad + (i % cols) * (thumb + pad)
        y = pad + (i // cols) * (thumb + pad)
        sheet.alpha_composite(bg, (x, y))
    dest.parent.mkdir(parents=True, exist_ok=True)
    sheet.convert("RGB").save(dest, format="PNG", optimize=True)


def build(force_extract: bool = False) -> dict:
    bases = extract_canonical_bases(force=force_extract)
    if len(bases) != 94:
        raise RuntimeError(f"base extract produced {len(bases)}, expected 94")

    SURFACES.mkdir(parents=True, exist_ok=True)
    SURFACES_2048.mkdir(parents=True, exist_ok=True)

    # Index extracted bases by (family, color, view)
    base_index: dict[tuple[str, str, str], Path] = {
        (r["family"], r["color"], r["view"]): REPO / r["png"] for r in bases
    }

    rows: list[dict] = []
    for family, color, view in iter_surfaces():
        spec = FAMILIES[family]
        is_base = view in spec["base_views"]
        dest = SURFACES / f"{base_stem(family, color, view)}.png"
        dest_hi = SURFACES_2048 / dest.name

        if is_base:
            src = base_index[(family, color, view)]
            image = Image.open(src).convert("RGBA")
            provenance = "authentic-preserved"
            generated_by = "extract-product-photo-layer"
        else:
            front = Image.open(base_index[(family, color, "front")]).convert("RGBA")
            back_path = base_index.get((family, color, "back"))
            back = Image.open(back_path).convert("RGBA") if back_path else None
            image = derive_view(family, view, front, back)
            provenance = (
                "derived-wrap-from-front" if view == "wrap" else "generated-master"
            )
            generated_by = f"bbox-isolate:{view}"

        if not is_base:
            save_png(image, dest, compress=6)
        if not dest_hi.exists():
            save_png(upscale(image), dest_hi, compress=1)
        alpha = image.getchannel("A")
        rows.append(
            {
                "family": family,
                "color": color,
                "view": view,
                "key": f"{family}/{color}/{view}",
                "png": str(dest.relative_to(REPO)),
                "png2048": str(dest_hi.relative_to(REPO)),
                "printZone1024": Z1024[family][view],
                "provenance": provenance,
                "generatedBy": generated_by,
                "sha256": sha256(dest),
                "bytes": dest.stat().st_size,
                "alphaBBox": list(alpha.getbbox() or (0, 0, 0, 0)),
                "size": list(image.size),
            }
        )

    if len(rows) != TARGET_SURFACES:
        raise RuntimeError(f"built {len(rows)} surfaces, expected {TARGET_SURFACES}")

    # Verify every expected file exists and is a real 1024 RGBA PNG.
    missing = []
    for family, color, view in iter_surfaces():
        path = SURFACES / f"{base_stem(family, color, view)}.png"
        if not path.exists() or path.stat().st_size == 0:
            missing.append(path.name)
            continue
        with Image.open(path) as im:
            if im.size != (NATIVE, NATIVE):
                missing.append(f"{path.name}:size={im.size}")
    if missing:
        raise RuntimeError(f"surface verification failed: {missing[:12]}")

    summary = {
        "schema": "trynex-complete-mockup/v1",
        "surfaceCount": len(rows),
        "baseCount": 94,
        "derivedCount": len(rows) - 94,
        "canvas": {"width": NATIVE, "height": NATIVE},
        "canvasHi": {"width": CANVAS_HI, "height": CANVAS_HI},
        "families": {
            family: {
                "colors": spec["colors"],
                "views": spec["views"],
                "count": len(spec["colors"]) * len(spec["views"]),
            }
            for family, spec in FAMILIES.items()
        },
        "surfaces": rows,
    }
    MANIFEST.parent.mkdir(parents=True, exist_ok=True)
    MANIFEST.write_text(json.dumps(summary, indent=2) + "\n")
    contact_sheet([SURFACES / f"{base_stem(*s)}.png" for s in iter_surfaces()], CONTACT)
    return summary


def main() -> int:
    force = "--force" in sys.argv
    try:
        summary = build(force_extract=force)
    except Exception as exc:  # noqa: BLE001
        print(f"ERROR: {exc}", file=sys.stderr)
        return 1
    print(
        f"surfaces={summary['surfaceCount']} "
        f"bases={summary['baseCount']} "
        f"derived={summary['derivedCount']} "
        f"-> {SURFACES}"
    )
    print(f"manifest={MANIFEST.relative_to(REPO)}")
    print(f"contact={CONTACT.relative_to(REPO)}")
    if summary["surfaceCount"] != TARGET_SURFACES:
        print(
            f"ERROR: expected {TARGET_SURFACES} surfaces, got {summary['surfaceCount']}",
            file=sys.stderr,
        )
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
