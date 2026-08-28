# TryNex Smart-Object Mockup Masters

Layered Photoshop masters for all 6 products. Every master contains a **real
smart object** — not a named placeholder layer — and is emitted as both
`.psd` (Photoshop Document, version 1) and `.psb` (Large Document, version 2)
at **2048×2048**.

## How to use

1. Open a `.psd` or `.psb` in Photoshop.
2. In the Layers panel, **double-click the thumbnail** of
   `ARTWORK — double-click to edit your design`.
3. The embedded 1024×1024 design canvas opens. Paste your artwork, **File > Save**, close.
4. Your artwork now appears on the product, positioned over the print zone.

## Layer stack (top → bottom)

| Layer | Purpose |
|---|---|
| `Print Zone Guide — toggle visibility` | Dashed rectangle showing the safe print area (hidden) |
| `ARTWORK — double-click to edit your design` | **The smart object.** Edit this. |
| `Product Photo — <color> — <view>` | The blank product render |
| `Studio Background — Warm White` | Solid backdrop |

## Making the artwork follow fabric folds

1. Select the `ARTWORK` layer.
2. `Filter > Distort > Displace`
3. Horizontal scale `10`, Vertical scale `10`
4. Choose the `-DISPLACEMENT.psd` file that sits beside this master.
5. Set blend mode to **Multiply** for light garments so fabric texture shows
   through; **Normal** for dark garments.

## Coverage — 188 canonical surfaces

| Family | Colours | Views | Surfaces |
|---|---:|---|---:|
| tshirt | 8 | front, back, left-sleeve, right-sleeve, neck-label | 40 |
| longsleeve | 10 | front, back, left-sleeve, right-sleeve, neck-label | 50 |
| hoodie | 10 | front, back, left-sleeve, right-sleeve, neck-label | 50 |
| mug | 10 | front, back, wrap | 30 |
| cap | 8 | front, back | 16 |
| waterbottle | 1 | front, back | 2 |
| **Total** | | | **188** |

Water bottle is a single white sublimation-coated aluminium blank. Extra
colours in the source-kit are non-canonical and are not shipped.

94 of the 188 surfaces are product-photo layers extracted from the source-kit
PSDs (`authentic-preserved`). The other 94 (sleeves, neck labels, mug wraps)
are derived from those photos (`generated-master` / `derived-wrap-from-front`).

## Shipped 2048 set (29 zip parts, each < 90 MiB)

The full 188-surface 2048 PSD + PSB + displacement set **is in git**, split
under `dist-mockups/packages/2048/` so every file stays below GitHub's 100 MB
limit. See that folder's README and `index.json`.

```bash
mkdir -p dist-mockups/masters
for z in dist-mockups/packages/2048/trynex-*-2048-smartobject-part*.zip; do
  unzip -n "$z" -d dist-mockups/masters
done
```

The `trynex-*-smartobject-mockups.zip` archives beside this file are the
previous 1024×1024 94-surface drop (front/back only).

Rebuild from source if needed:

```bash
python3 tools/extract_base_pngs.py
python3 tools/build_complete_mockup_system.py   # must print surfaces=188
python3 tools/make-displacement-maps.py dist-mockups/_work/base dist-mockups/_work/displace
cd tools && npm install && cd ..
node tools/build-smartobject-mockups.mjs        # CANVAS=2048, writes .psd and .psb
python3 tools/pack_masters_under_100mb.py --all
```

## Verification

```bash
python3 tools/build_complete_mockup_system.py   # surfaces=188
node -e "import('./tools/build-smartobject-mockups.mjs').then(m => console.log(m.CANVAS, m.countCanonical()))"
# -> 2048 188
```

Every generated master is 2048×2048, 8-bit RGB, with exactly one smart-object
layer. PSD files start `8BPS\x00\x01`; PSB files start `8BPS\x00\x02`.
