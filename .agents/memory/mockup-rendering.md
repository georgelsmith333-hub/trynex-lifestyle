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

**Drop shadow filter:** Three-layer shadow — ambient (stdDeviation=32, 0.22 opacity), diffuse (14, 0.18), contact (5, 0.14). Filter region extended to `-12% -12% 124% 124%` to avoid clipping large shadows.
