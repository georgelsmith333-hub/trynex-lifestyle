---
name: Mockup rendering quirks
description: How the design studio SVG mockup renderer works and what fixes were needed
---

**Cylinder products (mug/waterbottle) — always use cutout PNG:**
`white-mug-front.png` and `white-waterbottle-front.png` have opaque white backgrounds. The drop shadow filter wraps the entire 1000×1000 square instead of the product outline, making them invisible on the studio background. Fix: `isCylUnderImageSrc` check in `imageSrc` IIFE forces `frontCutout` for light/white colors on cylinder products.

**Why:** Without the cutout, the mug looks like an invisible rectangle. The cutout PNG has a transparent background so the studio color shows through and the shadow wraps the mug shape.

**How to apply:** Any new cylinder product category (e.g., can, tumbler) must have a cutout PNG and the category must be added to the `isCylUnderImageSrc` check in `mockups.tsx`.

**Studio background:** Must be `#c9c4bc` (warm medium gray). The old `#edeae6` was too close to white, making white garments invisible. The `FlatZoneSVG` background should be `#c8c3bc` for consistency.

**Cylinder gradient stops:** Gradients must fade to zero BEFORE the mug print zone left edge (x=188 = 18.8%). Currently set to fade at 17%. If mug print zones change, keep the fade point safely inside 0-17%.

**Drop shadow filter:** Reduced to two-layer — ambient (stdDeviation=20, 0.14 opacity), contact (8, 0.09 opacity). Filter region `-8% -8% 116% 116%`. Was previously three-layer at 0.22/0.18/0.14 which was too harsh.

**Long sleeve excluded from useMixBlend:**
`white-longsleeve-front.png` has a warm studio background (not pure white). With `mixBlendMode:multiply` on the `#c9c4bc` canvas, the background tints brownish. Fix: `product.category !== "longsleeve"` in `useMixBlend` condition — longsleeve always uses the cutout PNG directly.

**Black apparel uses dark CUTOUT (not full dark photo):**
Previous behaviour: black tshirt/hoodie used `black-tshirt-front.png` (full photo with white background), causing shadow to wrap the rectangular image boundary (inconsistent with all other colours which show garment-shaped shadows). Fix: `(isApparel && useBlackPhoto)` added to the imageSrc cutout-selection condition — black apparel now uses `black-tshirt-front-cutout.png` / `black-hoodie-front-cutout.png` (transparent background), so the drop-shadow filter always traces the garment silhouette.

**Hoodie cutout quality:**
Use `white-hoodie-front-cutout.png` (606KB, OLD) NOT `white-hoodie-front-cutout-new.png` (240KB, -new suffix). The -new file is lower quality/resolution. Back cutout: same — use the non-new version.

**isApparel must precede useMixBlend:**
`isApparel` const must be declared BEFORE `useMixBlend` in the GarmentSVG component body. Reordering causes a TDZ (Temporal Dead Zone) reference error at runtime.
