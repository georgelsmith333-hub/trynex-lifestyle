from pathlib import Path
import json

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
            entry["present_assets"].append(str(path.relative_to(ROOT)))
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
