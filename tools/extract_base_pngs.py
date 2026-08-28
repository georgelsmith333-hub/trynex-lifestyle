#!/usr/bin/env python3
"""Extract the 94 canonical product-photo PNGs from the source-kit PSDs.

Reads `attached_assets/trynex-mockup-source-kit/psd/{family}-{color}-{view}.psd`,
pulls the `Product Photo` layer (true alpha cutout, not the flat composite),
and writes `dist-mockups/_work/base/{family}__{color}__{view}.png`.

Non-canonical water-bottle colours in the kit are skipped on purpose.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

from PIL import Image
from psd_tools import PSDImage

TOOLS = Path(__file__).resolve().parent
if str(TOOLS) not in sys.path:
    sys.path.insert(0, str(TOOLS))

from mockup_canonical import (  # noqa: E402
    NATIVE,
    base_stem,
    count_bases,
    iter_bases,
    psd_stem,
)

REPO = TOOLS.parent
PSD_DIR = REPO / "attached_assets" / "trynex-mockup-source-kit" / "psd"
OUT_DIR = REPO / "dist-mockups" / "_work" / "base"


def extract_product_photo(psd_path: Path) -> Image.Image:
    psd = PSDImage.open(psd_path)
    photo = None
    for layer in psd:
        name = (layer.name or "").lower()
        if "product photo" in name:
            photo = layer.topil()
            break
    if photo is None:
        # Last resort: composite minus the solid studio background.
        photo = psd.composite()
    image = photo.convert("RGBA")
    if image.size != (NATIVE, NATIVE):
        image = image.resize((NATIVE, NATIVE), Image.Resampling.LANCZOS)
    alpha = image.getchannel("A")
    if alpha.getbbox() is None:
        raise RuntimeError(f"{psd_path.name}: product photo layer is fully transparent")
    return image


def extract_canonical_bases(out_dir: Path | None = None, force: bool = False) -> list[dict]:
    dest = out_dir or OUT_DIR
    dest.mkdir(parents=True, exist_ok=True)
    rows: list[dict] = []
    missing: list[str] = []
    for family, color, view in iter_bases():
        src = PSD_DIR / f"{psd_stem(family, color, view)}.psd"
        png_name = f"{base_stem(family, color, view)}.png"
        png_path = dest / png_name
        if not src.exists():
            missing.append(str(src.relative_to(REPO)))
            continue
        if png_path.exists() and not force:
            image = Image.open(png_path)
            rows.append(
                {
                    "family": family,
                    "color": color,
                    "view": view,
                    "src": str(src.relative_to(REPO)),
                    "png": str(png_path.relative_to(REPO)),
                    "bytes": png_path.stat().st_size,
                    "size": list(image.size),
                    "reused": True,
                }
            )
            continue
        image = extract_product_photo(src)
        image.save(png_path, format="PNG", optimize=True, compress_level=9)
        rows.append(
            {
                "family": family,
                "color": color,
                "view": view,
                "src": str(src.relative_to(REPO)),
                "png": str(png_path.relative_to(REPO)),
                "bytes": png_path.stat().st_size,
                "size": list(image.size),
                "reused": False,
            }
        )
    if missing:
        raise FileNotFoundError("missing source-kit PSDs:\n  " + "\n  ".join(missing))
    if len(rows) != count_bases():
        raise RuntimeError(f"expected {count_bases()} bases, extracted {len(rows)}")
    manifest = dest / "manifest.json"
    manifest.write_text(json.dumps({"count": len(rows), "surfaces": rows}, indent=2) + "\n")
    return rows


def main() -> int:
    force = "--force" in sys.argv
    rows = extract_canonical_bases(force=force)
    wrote = sum(1 for r in rows if not r["reused"])
    reused = sum(1 for r in rows if r["reused"])
    print(f"bases={len(rows)} wrote={wrote} reused={reused} -> {OUT_DIR}")
    if len(rows) != 94:
        print(f"ERROR: expected 94 bases, got {len(rows)}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
