---
name: Mockup rendering approach
description: How Design Studio GarmentSVG renders product photos and applies color
---

## Current approach (simplified realistic rendering)

GarmentSVG uses real cutout PNGs with a minimal 3-step SVG tint filter. All artificial simulation layers were removed after user feedback that they looked "fake/disturbing".

**Photo selection:**
- Near-black hex (lum < 12%) → dark cutout PNG (`black-*-front/back-cutout.png`)
- Light/white hex (lum > 0.92) → white cutout PNG, no tint
- All other colors → white cutout PNG + `garment-tint` filter applied

**Tint filter (3-step):**
```xml
<feFlood floodColor={tintHex} result="flood" />
<feBlend in="flood" in2="SourceGraphic" mode="multiply" result="tinted" />
<feComposite in="tinted" in2="SourceAlpha" operator="in" />
```
White pixels → target color; shadow/crease pixels darken naturally; transparent areas stay transparent. No background contamination because of the final `feComposite in2="SourceAlpha"` clip step.

**Static filter IDs:** `garment-shadow` and `garment-tint` — no rotating IDs needed since only one GarmentSVG is active at a time in DesignStudio.

**Background:** `#EFEFED` (clean off-white)

**Drop shadow:** `feDropShadow dx=0 dy=5 stdDeviation=10 floodColor=rgba(0,0,0,0.13)`

**Removed (fake-looking effects user disliked):**
- `feTurbulence` fabric grain overlay on design layers
- `feDisplacementMap` cylinder distortion (`cyl-wrap-img`)
- Cylinder edge shadow gradient (`cyl-edge-shadow`)
- Rotating filter IDs via `nextFilterId()` / `useMemo`
- `fabricBase` CSS filter on image layers (fake ink simulation)
- Garment-aware `designBlend` multiply mode on text/image layers
- Old complex 5-step tint chain
- `useMixBlend` code path (was always `false` anyway)

**Design layers:** Render with `filter: userAdj` (user brightness/contrast/saturation only) — no blend mode override.

**Hoodie cutouts:** Use `-new` versions (`white-hoodie-front-cutout-new.png`, `white-hoodie-back-cutout-new.png`) — these are 1000×1000 and correctly aligned.

**Longsleeve dark variants:** `black-longsleeve-front/back-cutout.png` generated via ImageMagick and registered in `BASE_BY_CATEGORY`.

**Why:** Real product photos already have natural lighting and texture baked in. Less is more — simpler rendering = more realistic result.
