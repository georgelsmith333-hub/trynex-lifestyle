"""Canonical TryNex mockup matrix — 188 surfaces.

Single source of truth for extractors, the complete mockup system, and
the smart-object PSD/PSB builder. Print zones are specified on a 1024
canvas (the source-kit photography size) and scaled by consumers.
"""

from __future__ import annotations

from typing import Any

# Print zones on the 1024 native canvas (canonical-mockup-spec.ts).
Z1024: dict[str, dict[str, dict[str, int]]] = {
    "tshirt": {
        "front": {"x": 240, "y": 185, "w": 520, "h": 580},
        "back": {"x": 240, "y": 185, "w": 520, "h": 580},
        "left-sleeve": {"x": 175, "y": 175, "w": 650, "h": 650},
        "right-sleeve": {"x": 175, "y": 175, "w": 650, "h": 650},
        "neck-label": {"x": 150, "y": 265, "w": 700, "h": 470},
    },
    "longsleeve": {
        "front": {"x": 312, "y": 222, "w": 376, "h": 404},
        "back": {"x": 292, "y": 195, "w": 416, "h": 458},
        "left-sleeve": {"x": 175, "y": 175, "w": 650, "h": 650},
        "right-sleeve": {"x": 175, "y": 175, "w": 650, "h": 650},
        "neck-label": {"x": 150, "y": 265, "w": 700, "h": 470},
    },
    "hoodie": {
        "front": {"x": 240, "y": 270, "w": 520, "h": 400},
        "back": {"x": 292, "y": 184, "w": 416, "h": 448},
        "left-sleeve": {"x": 175, "y": 175, "w": 650, "h": 650},
        "right-sleeve": {"x": 175, "y": 175, "w": 650, "h": 650},
        "neck-label": {"x": 150, "y": 265, "w": 700, "h": 470},
    },
    "mug": {
        "front": {"x": 165, "y": 220, "w": 475, "h": 580},
        "back": {"x": 384, "y": 220, "w": 451, "h": 580},
        "wrap": {"x": 165, "y": 220, "w": 670, "h": 580},
    },
    "cap": {
        "front": {"x": 240, "y": 260, "w": 540, "h": 320},
        "back": {"x": 285, "y": 270, "w": 430, "h": 230},
    },
    "waterbottle": {
        "front": {"x": 335, "y": 320, "w": 276, "h": 590},
        "back": {"x": 335, "y": 320, "w": 276, "h": 590},
    },
}

FAMILIES: dict[str, dict[str, Any]] = {
    "tshirt": {
        "label": "Unisex T-Shirt",
        "colors": ["white", "black", "navy", "maroon", "olive", "sky-blue", "grey", "red"],
        "views": ["front", "back", "left-sleeve", "right-sleeve", "neck-label"],
        "base_views": ["front", "back"],
    },
    "longsleeve": {
        "label": "Unisex Long Sleeve",
        "colors": [
            "white", "black", "navy", "maroon", "olive", "grey", "red",
            "sky-blue", "burgundy", "forest",
        ],
        "views": ["front", "back", "left-sleeve", "right-sleeve", "neck-label"],
        "base_views": ["front", "back"],
    },
    "hoodie": {
        "label": "Unisex Hoodie",
        "colors": [
            "white", "black", "navy", "grey", "maroon", "olive", "red",
            "sky-blue", "forest", "burgundy",
        ],
        "views": ["front", "back", "left-sleeve", "right-sleeve", "neck-label"],
        "base_views": ["front", "back"],
    },
    "mug": {
        "label": "Ceramic Mug",
        "colors": [
            "white", "black", "navy", "red", "green", "purple", "sky-blue",
            "pink", "maroon", "orange",
        ],
        "views": ["front", "back", "wrap"],
        "base_views": ["front", "back"],
    },
    "cap": {
        "label": "Structured Cap",
        "colors": ["white", "black", "navy", "maroon", "olive", "red", "grey", "forest"],
        "views": ["front", "back"],
        "base_views": ["front", "back"],
    },
    "waterbottle": {
        "label": "Water Bottle - White Sublimation Aluminium",
        "colors": ["white"],  # hash-pinned; extra kit colours are non-canonical
        "views": ["front", "back"],
        "base_views": ["front", "back"],
    },
}

NATIVE = 1024
TARGET_SURFACES = 188


def iter_bases():
    """Yield (family, color, view) for the 94 source-kit masters."""
    for family, spec in FAMILIES.items():
        for color in spec["colors"]:
            for view in spec["base_views"]:
                yield family, color, view


def iter_surfaces():
    """Yield (family, color, view) for all 188 canonical surfaces."""
    for family, spec in FAMILIES.items():
        for color in spec["colors"]:
            for view in spec["views"]:
                yield family, color, view


def base_stem(family: str, color: str, view: str) -> str:
    return f"{family}__{color}__{view}"


def psd_stem(family: str, color: str, view: str) -> str:
    return f"{family}-{color}-{view}"


def count_bases() -> int:
    return sum(1 for _ in iter_bases())


def count_surfaces() -> int:
    return sum(1 for _ in iter_surfaces())


assert count_bases() == 94, count_bases()
assert count_surfaces() == TARGET_SURFACES, count_surfaces()
