"""Compatibility entry point for the canonical mockup release check.

The former Python implementation validated the retired smart-v4 tree, the
obsolete 202-surface matrix, and color heuristics that do not apply to the
current staged smart-v9 release. Keep this filename usable for existing
runbooks, but delegate to the single active validator so the repository has
one release contract.
"""

from __future__ import annotations

import subprocess
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
ACTIVE_VALIDATOR = ROOT / "scripts" / "validate-mockup-matrix.mjs"

print("Delegating canonical mockup validation to the active 188-surface Smart v9 gate.")
result = subprocess.run(["node", str(ACTIVE_VALIDATOR)], cwd=ROOT, check=False)
raise SystemExit(result.returncode)