from pathlib import Path
import json

try:
    from PIL import Image
except ImportError:
    Image = None

ROOT = Path(__file__).resolve().parents[1]
PUBLIC = ROOT / "artifacts" / "trynex-storefront" / "public"

families = {
    "tshirt": ["front", "back", "left-sleeve", "right-sleeve", "neck-label"],
    "longsleeve": ["front", "back", "left-sleeve", "right-sleeve", "neck-label"],
    "hoodie": ["front", "back", "left-sleeve", "right-sleeve", "neck-label"],
    "mug": ["front", "back", "wrap"],
    "cap": ["front", "back"],
    "waterbottle": ["front", "back"],
}

report = {"families": {}, "errors": [], "editable_master_status": {}}
for family, views in families.items():
    entry = {"required_views": views, "present_assets": [], "missing_assets": []}
    for view in views:
        # Canonical runtime assets are expected under canonical/<family>/<color>/<view>.png.
        # White is the source geometry; CSS/material tinting may derive other colors only
        # after the same silhouette has been validated.
        path = PUBLIC / "mockups" / "canonical" / family / "white" / f"{view}.png"
        if path.exists() and path.stat().st_size > 0:
            rel = str(path.relative_to(ROOT))
            entry["present_assets"].append(rel)
            if Image is not None:
                try:
                    im = Image.open(path).convert("RGBA")
                    sample_points = [(0, 0), (32, 0), (64, 0), (0, 32), (32, 32), (64, 32), (0, 64), (32, 64), (64, 64)]
                    corner = [im.getpixel((x, y))[:3] for x, y in sample_points if x < im.width and y < im.height]
                    neutral = [rgb for rgb in corner if max(rgb) - min(rgb) <= 6]
                    alternating = len(neutral) >= 6 and len({rgb[0] for rgb in neutral}) >= 2
                    if im.getchannel("A").getextrema() == (255, 255) and alternating:
                        entry.setdefault("invalid_assets", []).append({"path": rel, "reason": "baked-checkerboard-background"})
                        report["errors"].append(f"{family}/{view}: baked checkerboard background")
                except Exception as exc:
                    report["errors"].append(f"{family}/{view}: unreadable image ({exc})")
        else:
            entry["missing_assets"].append(str(path.relative_to(ROOT)))
    report["families"][family] = entry
    report["editable_master_status"][family] = "manifest-only"
    if entry["missing_assets"]:
        report["errors"].append(f"{family}: missing {len(entry['missing_assets'])} canonical runtime assets")

# Guard against accidentally activating generation artifacts with known background-removal defects.
for p in (PUBLIC / "mockups" / "canonical").rglob("*.png"):
    if any(token in p.name.lower() for token in ("artifact", "failed", "raw")):
        report["errors"].append(f"quarantined-looking asset in canonical tree: {p.relative_to(ROOT)}")

print(json.dumps(report, indent=2))
raise SystemExit(1 if report["errors"] else 0)
