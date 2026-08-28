#!/usr/bin/env python3
"""Pack dist-mockups/masters/<family> into zip parts, each strictly under 95 MB.

GitHub rejects files >= 100 MB. 95 MB leaves headroom for zip overhead.

Usage:
  python3 tools/pack_masters_under_100mb.py [family ...]
  python3 tools/pack_masters_under_100mb.py --all
"""

from __future__ import annotations

import json
import sys
import zipfile
from pathlib import Path

REPO = Path(__file__).resolve().parents[1]
MASTERS = REPO / "dist-mockups" / "masters"
OUT = REPO / "dist-mockups" / "packages" / "2048"
MAX_BYTES = 90 * 1024 * 1024  # 90 MiB — GitHub rejects >= 100 MiB


def pack_family(family: str) -> list[dict]:
    src = MASTERS / family
    if not src.is_dir():
        raise FileNotFoundError(src)
    files = sorted(p for p in src.iterdir() if p.is_file())
    if not files:
        raise RuntimeError(f"no files in {src}")

    OUT.mkdir(parents=True, exist_ok=True)
    parts: list[list[Path]] = [[]]
    running = 0
    for path in files:
        size = path.stat().st_size
        if size >= MAX_BYTES:
            raise RuntimeError(f"{path.name} is {size} bytes (>= 95 MB) — cannot pack")
        if parts[-1] and running + size > MAX_BYTES:
            parts.append([])
            running = 0
        parts[-1].append(path)
        running += size

    records = []
    width = max(2, len(str(len(parts))))
    for i, group in enumerate(parts, start=1):
        name = f"trynex-{family}-2048-smartobject-part{i:0{width}d}.zip"
        dest = OUT / name
        with zipfile.ZipFile(dest, "w", compression=zipfile.ZIP_STORED) as zf:
            # STORE: PSD/PSB are already compressed; deflate wastes CPU and
            # rarely shrinks them. Stored size == sum of members + headers.
            for path in group:
                zf.write(path, arcname=f"{family}/{path.name}")
        zsize = dest.stat().st_size
        if zsize >= 100 * 1024 * 1024:
            dest.unlink()
            raise RuntimeError(f"{dest.name} is {zsize} bytes — GitHub would reject it")
        records.append(
            {
                "zip": str(dest.relative_to(REPO)),
                "family": family,
                "part": i,
                "parts": len(parts),
                "bytes": zsize,
                "files": [f"{family}/{p.name}" for p in group],
                "fileCount": len(group),
            }
        )
        print(f"  {dest.name}  {zsize/1024/1024:.1f} MB  {len(group)} files")
    return records


def main() -> int:
    args = [a for a in sys.argv[1:] if a != "--all"]
    families = args or (
        ["tshirt", "longsleeve", "hoodie", "mug", "cap", "waterbottle"]
        if "--all" in sys.argv[1:]
        else None
    )
    if not families:
        print("usage: pack_masters_under_100mb.py [--all] [family ...]", file=sys.stderr)
        return 2
    all_records = []
    for family in families:
        print(f"packing {family}")
        all_records.extend(pack_family(family))
    index = OUT / "index.json"
    existing = []
    if index.exists():
        existing = json.loads(index.read_text()).get("packages", [])
        existing = [r for r in existing if r["family"] not in families]
    payload = {
        "schema": "trynex-2048-smartobject-packages/v1",
        "maxBytesPerZip": MAX_BYTES,
        "packageCount": len(existing) + len(all_records),
        "packages": existing + all_records,
    }
    index.write_text(json.dumps(payload, indent=2) + "\n")
    print(f"index={index.relative_to(REPO)} packages={payload['packageCount']}")
    over = [r for r in all_records if r["bytes"] >= 100 * 1024 * 1024]
    return 1 if over else 0


if __name__ == "__main__":
    raise SystemExit(main())
