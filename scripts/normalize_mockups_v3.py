#!/usr/bin/env python3
"""
normalize_mockups_v3.py
========================
Fixes size/position jumps across all product colors by remapping each
normalized photo (and its matching RGBA cutout) so the garment occupies
the SAME region in the 1024×1024 canvas for every color variant.

Algorithm:
1. Read every input photo from the immutable source-kit directory.
2. Use one reviewed silhouette mask per product family/face, kept separately
   from runtime output. Apparel masks are derived from the clean navy source-kit
   photos; curved-product masks come from reviewed alpha templates.
3. Use one explicit target rectangle per product family and face.
4. Remap the source-kit photo and silhouette to that exact rectangle (including
   both axes, so a narrow source cannot render smaller than a wide source).
5. Composite the original photo through that alpha, which strips any embedded
   studio/backdrop pixels outside the product silhouette.
6. Write both the RGB normalized photo and the RGBA cutout.

Requirements: only Pillow (PIL) — no numpy, no scipy.
"""

from __future__ import annotations
import os, sys
from collections import deque
from PIL import Image, ImageChops, ImageFilter

SOURCE_DIR  = "artifacts/trynex-storefront/public/mockups/source-kit"
MASK_DIR    = "scripts/mockup_mask_templates"
NORM_DIR    = "artifacts/trynex-storefront/public/mockups/normalized"
CUTOUT_DIR  = "artifacts/trynex-storefront/public/mockups/normalized-cutouts"
BG_COLOR    = (250, 248, 245)   # warm-white studio background
BG_THRESH   = 18                # max channel deviation to count as background

# ── Color slugs per category (mirrors SOURCE_KIT_COLOR_SLUGS in mockups.tsx) ─
SLUGS: dict[str, list[str]] = {
    "tshirt":      ["white","black","navy","maroon","olive","sky-blue","grey","red"],
    "longsleeve":  ["white","black","navy","maroon","olive","grey","red","sky-blue","burgundy","forest"],
    "hoodie":      ["white","black","navy","grey","maroon","olive","red","sky-blue","forest","burgundy"],
    "mug":         ["white","black","navy","red","green","purple","sky-blue","pink","maroon","orange"],
    "cap":         ["white","black","navy","maroon","olive","red","grey","forest"],
    "waterbottle": ["white","black","navy","forest","sky-blue","red","pink","teal"],
}
# Every source-kit product has a front/back pair. Even curved products use
# their back image in the resolver and cart viewer, so the reproducible
# normalizer must process all six categories on both faces.
HAS_BACK: set[str] = {
    "tshirt", "longsleeve", "hoodie", "mug", "cap", "waterbottle",
}

# The runtime resolver and the 3D billboard use these same frames. Front/back
# deliberately share one target rectangle per product so a face switch cannot
# change the apparent product size or billboard aspect ratio.
TARGET_FRAMES: dict[str, dict[str, tuple[int, int, int, int]]] = {
    "tshirt": {
        "front": (43, 66, 980, 957),
        "back":  (43, 66, 980, 957),
    },
    "longsleeve": {
        "front": (53, 94, 970, 930),
        "back":  (53, 94, 970, 930),
    },
    "hoodie": {
        "front": (54, 43, 970, 980),
        "back":  (54, 43, 970, 980),
    },
    "mug": {
        "front": (143, 192, 881, 829),
        "back":  (143, 192, 881, 829),
    },
    "cap": {
        "front": (162, 184, 862, 839),
        "back":  (162, 184, 862, 839),
    },
    "waterbottle": {
        "front": (351, 78, 673, 944),
        "back":  (351, 78, 673, 944),
    },
}

# ── Helpers ───────────────────────────────────────────────────────────────────

def norm_path(cat: str, color: str, face: str) -> str:
    return os.path.join(NORM_DIR, f"{cat}-{color}-{face}.png")

def source_path(cat: str, color: str, face: str) -> str:
    return os.path.join(SOURCE_DIR, f"{cat}-{color}-{face}.png")


def mask_path(cat: str, face: str) -> str:
    return os.path.join(MASK_DIR, f"{cat}-{face}.png")


def cutout_path(cat: str, color: str, face: str) -> str:
    return os.path.join(CUTOUT_DIR, f"{cat}-{color}-{face}.png")


def detect_bounds(img: Image.Image) -> tuple[int,int,int,int]:
    """Fast garment-bounds detection using PIL channel maths."""
    rgb = img.convert("RGB")
    bg  = Image.new("RGB", rgb.size, BG_COLOR)
    diff = ImageChops.difference(rgb, bg)
    r, g, b = diff.split()
    # Binary mask: pixel is non-background if ANY channel differs by > BG_THRESH
    mask = Image.new("L", rgb.size, 0)
    for ch in (r, g, b):
        mask = ImageChops.lighter(mask, ch.point(lambda p: 255 if p > BG_THRESH else 0))
    # Small dilation to close single-pixel gaps at fabric texture noise
    mask = mask.filter(ImageFilter.MaxFilter(5))
    bb = mask.getbbox()
    return bb if bb else (0, 0, img.width, img.height)


def remap_clean_photo(
    photo: Image.Image,
    cutout: Image.Image,
    src_bb: tuple,
    dst_bb: tuple,
) -> Image.Image:
    """Place a photo through its alpha silhouette on the stable target frame.

    The output is intentionally RGB for 2D/export/cart consumers, but the
    background is rebuilt from BG_COLOR rather than copied from the source.
    This is what removes dark backdrop shapes that previously survived behind
    black garments.
    """
    sx0,sy0,sx1,sy1 = src_bb
    dx0,dy0,dx1,dy1 = dst_bb
    dw, dh = max(1, dx1-dx0), max(1, dy1-dy0)
    photo_crop = photo.convert("RGB").crop(src_bb).resize((dw, dh), Image.LANCZOS)
    alpha_crop = cutout.convert("RGBA").crop(src_bb).getchannel("A").resize((dw, dh), Image.LANCZOS)
    canvas = Image.new("RGB", (1024, 1024), BG_COLOR)
    canvas.paste(photo_crop, (dx0, dy0), alpha_crop)
    return canvas


def alpha_photo(
    photo: Image.Image,
    alpha: Image.Image,
) -> Image.Image:
    """Build an RGBA photo from a clean silhouette mask.

    This intentionally ignores legacy normalized-cutout files. Some of those
    derivatives were made from contaminated masks and contain opaque blobs
    over the product. The reviewed alpha template is the geometry reference;
    the selected color photo supplies the visible pixels.
    """
    rgba = photo.convert("RGBA")
    rgba.putalpha(alpha.convert("L"))
    return rgba


def remap_rgba(src: Image.Image, src_bb: tuple, dst_bb: tuple) -> Image.Image:
    """Remap the alpha silhouette into the exact stable target rectangle."""
    sx0,sy0,sx1,sy1 = src_bb
    dx0,dy0,dx1,dy1 = dst_bb
    dw, dh = max(1, dx1-dx0), max(1, dy1-dy0)
    garment = src.convert("RGBA").crop(src_bb).resize((dw, dh), Image.LANCZOS)
    canvas = Image.new("RGBA", (1024, 1024), (0, 0, 0, 0))
    # paste with mask so alpha is honoured
    canvas.paste(garment, (dx0, dy0), garment)
    return canvas


def fast_cutout_from_rgb(rgb_img: Image.Image) -> Image.Image:
    """Generate an RGBA cutout by flood-filling connected background from edges."""
    rgba = rgb_img.convert("RGBA")
    pix  = rgba.load()
    W, H = rgba.size

    visited = bytearray(W * H)
    q: deque[tuple[int,int]] = deque()

    def is_bg(x: int, y: int) -> bool:
        r, g, b, _ = pix[x, y]
        return max(abs(r - BG_COLOR[0]),
                   abs(g - BG_COLOR[1]),
                   abs(b - BG_COLOR[2])) < BG_THRESH + 4   # slightly lenient at edges

    # Seed from all four edges
    for x in range(W):
        for y in (0, H-1):
            idx = y * W + x
            if not visited[idx] and is_bg(x, y):
                visited[idx] = 1
                q.append((x, y))
    for y in range(1, H-1):
        for x in (0, W-1):
            idx = y * W + x
            if not visited[idx] and is_bg(x, y):
                visited[idx] = 1
                q.append((x, y))

    while q:
        x, y = q.popleft()
        r, g, b, _ = pix[x, y]
        pix[x, y] = (r, g, b, 0)
        for dx, dy in ((-1,0),(1,0),(0,-1),(0,1)):
            nx, ny = x+dx, y+dy
            if 0 <= nx < W and 0 <= ny < H:
                idx = ny * W + nx
                if not visited[idx] and is_bg(nx, ny):
                    visited[idx] = 1
                    q.append((nx, ny))

    return rgba


# ── Main ──────────────────────────────────────────────────────────────────────

print("="*60)
print("PASS 1 — Validate source-kit inputs and reviewed alpha templates")
print("="*60)

source_files: list[str] = []
missing: list[str] = []
mask_files: list[str] = []

for cat, slugs in SLUGS.items():
    faces = ["front","back"] if cat in HAS_BACK else ["front"]
    for face in faces:
        for color in slugs:
            p = source_path(cat, color, face)
            if not os.path.exists(p):
                missing.append(p)
            else:
                source_files.append(p)
        print(f"  {cat}/{face}: checked {len(slugs)} source-kit photos; target={TARGET_FRAMES[cat][face]}")
        mask = mask_path(cat, face)
        if not os.path.exists(mask):
            missing.append(mask)
        else:
            mask_files.append(mask)

if missing:
    print("\nMissing source-kit inputs:", file=sys.stderr)
    for p in missing:
        print(f"  {p}", file=sys.stderr)
    raise SystemExit(1)

bad_masks: list[str] = []
for p in mask_files:
    mask = Image.open(p).convert("L")
    if mask.size != (1024, 1024) or not mask.getbbox():
        bad_masks.append(p)
if bad_masks:
    print("\nInvalid alpha templates:", file=sys.stderr)
    for p in bad_masks:
        print(f"  {p}", file=sys.stderr)
    raise SystemExit(1)

print(f"\nValidated {len(source_files)} immutable source-kit photos and {len(mask_files)} alpha templates")

print()
print("="*60)
print("PASS 2 — Remap photos to stable target frames + regenerate cutouts")
print("="*60)

done = 0
errors = 0

for cat, slugs in SLUGS.items():
    faces = ["front","back"] if cat in HAS_BACK else ["front"]
    for face in faces:
        dst_bb = TARGET_FRAMES.get(cat, {}).get(face)
        if not dst_bb:
            continue
        # Reviewed alpha templates are the only geometry reference. They are
        # stored separately from runtime output so reruns cannot recursively
        # normalize an already-normalized image or inherit contaminated pixels.
        reference_path = mask_path(cat, face)
        reference_alpha = Image.open(reference_path).convert("L")
        reference_bb = reference_alpha.point(lambda p: 255 if p > 20 else 0).getbbox()
        if not reference_bb:
            print(f"  EMPTY reference mask {reference_path}")
            continue
        for color in slugs:
            source_ = source_path(cat, color, face)
            np_  = norm_path(cat, color, face)
            cp_  = cutout_path(cat, color, face)
            try:
                # ── Use the clean white geometry, never a legacy cutout ────
                rgb_src = Image.open(source_).convert("RGB")
                source_bb = reference_bb
                reference_mask = Image.new("RGBA", (1024, 1024), (0, 0, 0, 0))
                reference_mask.putalpha(reference_alpha)
                cutout_source = alpha_photo(rgb_src, reference_alpha)
                cutout_out = remap_rgba(cutout_source, source_bb, dst_bb)

                # ── Rebuild RGB photo through alpha (no backdrop ghosts) ───
                rgb_out = remap_clean_photo(rgb_src, reference_mask, source_bb, dst_bb)
                rgb_out.save(np_, "PNG")
                cutout_out.save(cp_, "PNG")

                done += 1
                if done % 10 == 0:
                    print(f"  ... {done} files processed")
            except Exception as exc:
                errors += 1
                print(f"  ERROR {cat}-{color}-{face}: {exc}", file=sys.stderr)

print(f"\nDone: {done} remapped, {errors} errors")
