# TryNex Smart-Object Mockup Masters

Layered Photoshop masters for all 6 products. Every master contains a **real
smart object** — not a named placeholder layer.

## How to use

1. Open a `.psd` in Photoshop.
2. In the Layers panel, **double-click the thumbnail** of
   `ARTWORK — double-click to edit your design`.
3. The embedded design canvas opens. Paste your artwork, **File > Save**, close.
4. Your artwork now appears on the product, positioned over the print zone.

## Layer stack (top → bottom)

| Layer | Purpose |
|---|---|
| `Print Zone Guide — toggle visibility` | Dashed rectangle showing the safe print area (hidden) |
| `ARTWORK — double-click to edit your design` | **The smart object.** Edit this. |
| `Displacement Map — reference copy` | Grayscale fold map (hidden) |
| `Product Photo — <color> — <view>` | The blank product render |
| `Studio Background — Warm White` | Solid backdrop |

## Making the artwork follow fabric folds

The smart object is positioned and scaled to the print zone but rendered flat.
To make it drape over folds:

1. Select the `ARTWORK` layer.
2. `Filter > Distort > Displace`
3. Horizontal scale `10`, Vertical scale `10`
4. Choose the `-DISPLACEMENT.psd` file that sits beside this master.
5. Set blend mode to **Multiply** for light garments so fabric texture shows
   through; **Normal** for dark garments.

## Contents

| Family | Colours | Views (front/back) | Surfaces |
|---|---:|---:|---:|
| tshirt | 8 | 2 | 16 |
| longsleeve | 10 | 2 | 20 |
| hoodie | 10 | 2 | 20 |
| mug | 10 | 2 | 20 |
| cap | 8 | 2 | 16 |
| waterbottle | 1 | 2 | 2 |
| **Total** | | | **94** |

Each surface ships as two files: the master `.psd` and a matching
`-DISPLACEMENT.psd`. All are 1024×1024, 8-bit RGB.

## Honest coverage note

The full product contract defines **188** canonical surfaces. These 94 cover
every surface for which real base imagery exists. **94 are still missing**:
`left-sleeve`, `right-sleeve` and `neck-label` for all three apparel families
(84), plus `wrap` for all 10 mug colours (10). Those need genuine photography —
they were not fabricated here.

## Verification

Every one of the 94 masters was mechanically verified: exactly one smart-object
layer, GUID-linked to an embedded valid PNG payload, correct 1024×1024 canvas.
Re-run with `python3 tools/audit_psd_masters.py` and
`node tools/build-smartobject-mockups.mjs`.
