from __future__ import annotations

import json
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
PUBLIC = ROOT / "artifacts" / "trynex-storefront" / "public"
SMART = PUBLIC / "mockups" / "smart-v4"

families = {
    "tshirt": {"colors": ["white", "black", "navy", "maroon", "olive", "sky-blue", "grey", "red"], "views": ["front", "back", "left-sleeve", "right-sleeve", "neck-label"]},
    "longsleeve": {"colors": ["white", "black", "navy", "maroon", "olive", "grey", "red", "sky-blue", "burgundy", "forest"], "views": ["front", "back", "left-sleeve", "right-sleeve", "neck-label"]},
    "hoodie": {"colors": ["white", "black", "navy", "grey", "maroon", "olive", "red", "sky-blue", "forest", "burgundy"], "views": ["front", "back", "left-sleeve", "right-sleeve", "neck-label"]},
    "mug": {"colors": ["white", "black", "navy", "red", "green", "purple", "sky-blue", "pink", "maroon", "orange"], "views": ["front", "back", "wrap"]},
    "cap": {"colors": ["white", "black", "navy", "maroon", "olive", "red", "grey", "forest"], "views": ["front", "back"]},
    "waterbottle": {"colors": ["white", "black", "navy", "forest", "sky-blue", "red", "pink", "teal"], "views": ["front", "back"]},
}

report = {"root": str(SMART.relative_to(ROOT)), "families": {}, "errors": [], "legacy_removed": not (PUBLIC / "mockups" / "canonical").exists()}
seen = {}
for family, config in families.items():
    entry = {"required": 0, "present": 0, "missing": [], "invalid": []}
    for color in config["colors"]:
        for view in config["views"]:
            entry["required"] += 1
            path = SMART / family / color / f"{view}.png"
            key = f"{family}:{color}:{view}"
            if not path.exists() or path.stat().st_size == 0:
                entry["missing"].append(str(path.relative_to(ROOT)))
                continue
            entry["present"] += 1
            if key in seen:
                report["errors"].append(f"duplicate key: {key}")
            seen[key] = str(path.relative_to(ROOT))
            try:
                im = Image.open(path).convert("RGBA")
                if im.size != (1024, 1024):
                    entry["invalid"].append({"path": str(path.relative_to(ROOT)), "reason": f"bad-size:{im.size}"})
                a_min, a_max = im.getchannel("A").getextrema()
                if a_max == 255 and a_min == 255:
                    entry["invalid"].append({"path": str(path.relative_to(ROOT)), "reason": "fully-opaque-background"})
                sample = [im.getpixel((x, y))[:3] for x, y in [(0, 0), (32, 32), (64, 64), (960, 32), (992, 64)] if x < im.width and y < im.height]
                magenta = sum(1 for r, g, b in sample if r > 150 and b > 100 and g < 120)
                green = sum(1 for r, g, b in sample if g > 140 and g > r * 1.5 and g > b * 1.3)
                if magenta or green:
                    entry["invalid"].append({"path": str(path.relative_to(ROOT)), "reason": "chroma-key-artifact"})
            except Exception as exc:
                entry["invalid"].append({"path": str(path.relative_to(ROOT)), "reason": f"unreadable:{exc}"})
    if entry["missing"]:
        report["errors"].append(f"{family}: missing {len(entry['missing'])} smart-v4 assets")
    if entry["invalid"]:
        report["errors"].extend(f"{family}: {item['path']} {item['reason']}" for item in entry["invalid"])
    report["families"][family] = entry

if not report["legacy_removed"]:
    report["errors"].append("legacy canonical asset tree still exists")
report["total_required"] = sum(item["required"] for item in report["families"].values())
report["total_present"] = sum(item["present"] for item in report["families"].values())
print(json.dumps(report, indent=2))
raise SystemExit(1 if report["errors"] else 0)
