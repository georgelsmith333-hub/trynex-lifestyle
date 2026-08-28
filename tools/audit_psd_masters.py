#!/usr/bin/env python3
"""
Real structural audit of the TryNex mockup source-kit PSD masters.

Answers the questions that actually matter for a smart-object mockup pipeline:
  * Is the document 1024x1024 8-bit RGB/RGBA sRGB?
  * How many layers, and are they NAMED (not Layer 0 / Layer 1)?
  * Is there a genuine SMART OBJECT layer (the design placement target)?
  * Is the artwork/placement layer present and is it a smart object?
  * Does the document carry a flat composite preview we can render?

Usage:
    python3 tools/audit_psd_masters.py [source-kit-root] [--json out.json]
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

from psd_tools import PSDImage
from psd_tools.api.layers import Group, SmartObjectLayer

REPO_ROOT = Path(__file__).resolve().parents[1]
DEFAULT_KIT = REPO_ROOT / "attached_assets" / "trynex-mockup-source-kit"

# Layer names that indicate a design-placement target.
ARTWORK_HINTS = ("artwork", "place design", "your design", "smart object", "design here")


def is_container(layer) -> bool:
    # PSDImage is the document root and also behaves as a layer container,
    # but it is not an instance of Group -- checking for __iter__ covers both.
    return isinstance(layer, Group) or (hasattr(layer, "__iter__") and hasattr(layer, "__len__"))


def walk(layer, depth=0, seen=None):
    yield depth, layer
    if not is_container(layer):
        return
    if seen is None:
        seen = set()
    if id(layer) in seen:
        return
    seen.add(id(layer))
    for child in layer:
        yield from walk(child, depth + 1, seen)


def audit_doc(path: Path) -> dict:
    rec: dict = {"file": path.name}
    try:
        psd = PSDImage.open(path)
    except Exception as exc:  # noqa: BLE001
        rec["error"] = f"open failed: {type(exc).__name__}: {exc}"
        return rec

    rec["width"], rec["height"] = psd.width, psd.height
    rec["channels"] = psd.channels
    rec["bit_depth"] = psd.depth
    rec["color_mode"] = str(psd.color_mode)
    rec["has_composite_preview"] = bool(getattr(psd, "has_preview", lambda: False)())

    layers = list(walk(psd))
    rec["layer_count"] = len(layers)

    names: list[str] = []
    smart_objects: list[str] = []
    artwork_layers: list[str] = []
    generic_names = 0

    for _depth, lyr in layers:
        name = (lyr.name or "").strip()
        names.append(name)
        low = name.lower()
        if low.startswith("layer ") and low[6:].strip().isdigit():
            generic_names += 1
        if isinstance(lyr, SmartObjectLayer):
            smart_objects.append(name)
            rec.setdefault("smart_object_kinds", {})[name] = lyr.kind
        if any(h in low for h in ARTWORK_HINTS):
            artwork_layers.append(name)

    rec["smart_object_count"] = len(smart_objects)
    rec["smart_objects"] = smart_objects
    rec["artwork_layers"] = artwork_layers
    rec["generic_layer_names"] = generic_names
    rec["top_level_layers"] = [l.name for l in psd]
    rec["layer_names"] = names[:40]
    return rec


def main() -> int:
    argv = sys.argv[1:]
    json_out: Path | None = None
    if "--json" in argv:
        json_out = Path(argv[argv.index("--json") + 1])
        argv = argv[: argv.index("--json")] + argv[argv.index("--json") + 2 :]
    kit = Path(argv[0]) if argv else DEFAULT_KIT
    psd_dir = kit / "psd"
    files = sorted([*psd_dir.glob("*.psd"), *psd_dir.glob("*.psb")])
    if not files:
        print(f"no PSD/PSB found under {psd_dir}", file=sys.stderr)
        return 2

    results = [audit_doc(f) for f in files]

    ok = [r for r in results if "error" not in r]
    bad = [r for r in results if "error" in r]

    print(f"Scanned {len(results)} master documents under {psd_dir}")
    print(f"  openable      : {len(ok)}")
    print(f"  unreadable    : {len(bad)}")
    if bad:
        for r in bad[:10]:
            print(f"    ! {r['file']}: {r['error']}")

    def field(key, default=None):
        return {r.get(key, default) for r in ok}

    print(f"  dimensions    : {sorted(field(('width', 'height') and 'width'))} x "
          f"{sorted(field('height'))}")
    print(f"  bit depth     : {sorted(field('bit_depth'))}")
    print(f"  color modes   : {sorted(str(m) for m in field('color_mode'))}")
    print(f"  composite prv : {sorted(field('has_composite_preview'))}")
    lc = [r["layer_count"] for r in ok]
    print(f"  layers/doc    : min={min(lc)} max={max(lc)} avg={sum(lc)/len(lc):.1f}")
    so = [r["smart_object_count"] for r in ok]
    print(f"  smart objects : min={min(so)} max={max(so)} "
          f"docs_with_0={sum(1 for x in so if x == 0)}")
    gen = [r["generic_layer_names"] for r in ok]
    print(f"  generic names : docs_with_generic={sum(1 for x in gen if x > 0)} "
          f"total={sum(gen)}")

    no_art = [r["file"] for r in ok if not r["artwork_layers"]]
    print(f"  artwork layer : present={len(ok) - len(no_art)} missing={len(no_art)}")
    for f in no_art[:15]:
        print(f"    ! no artwork layer: {f}")

    if json_out:
        json_out.write_text(json.dumps(results, indent=2, default=str))
        print(f"\nwrote {json_out}")

    print("\n--- sample: tshirt-white-front ---")
    for r in ok:
        if r["file"] == "tshirt-white-front.psd":
            print(json.dumps(r, indent=2, default=str))
            break
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
