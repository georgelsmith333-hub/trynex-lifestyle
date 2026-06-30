---
name: Mockup rendering approach
description: How Design Studio GarmentSVG renders product photos and applies color
---

## Current approach

GarmentSVG uses real garment photos with SVG-native feBlend multiply for colored garments.

**Photo selection:**
- Near-black hex (lum < 12%) → dedicated dark photo (`darkFront`/`darkFrontCutout`)
- Light/white hex (lum > 0.92) → full white garment PHOTO with drop shadow, no tint
- All other colors → white garment FULL PHOTO + `feBlend multiply` filter + silhouette mask

**Colored garment rendering (the correct approach):**

Apply `filter` and `mask` DIRECTLY on the `<image>` element (NOT a separate `<rect>`).
SVG guarantees: filter runs first, mask second. No isolation context issues.

```tsx
// In <defs>:
<filter id="garment-color-tint" x="0%" y="0%" width="100%" height="100%" colorInterpolationFilters="sRGB">
  <feFlood floodColor={tintHex} result="flood" />
  <feBlend in="flood" in2="SourceGraphic" mode="multiply" />
</filter>
<mask id="garment-silhouette">
  <image href={cutoutMaskSrc} x={0} y={0} width={1000} height={1000} preserveAspectRatio="xMidYMid meet"/>
</mask>

// Garment image:
<image
  href={basePhotoSrc}        // full white garment photo (has natural depth/shadows)
  mask="url(#garment-silhouette)"     // clips to garment silhouette
  filter="url(#garment-color-tint)"  // multiplies tint color with photo
/>
```

Result: white photo pixels × tint = tint color; shadow pixels × tint = darker tint → photorealistic depth.

**CRITICAL — Do NOT use CSS `mix-blend-mode: multiply` on a `<rect>` in SVG.**
The `<g filter="url(#...)">` wrapper around the base image creates an isolated compositing
context. Any `mix-blend-mode` on a sibling `<rect>` blends against that isolated context,
NOT the raw photo pixels — making colored garments appear completely flat/opaque.

**Mug right side:**
Wrap inside `<g transform="translate(1000,0) scale(-1,1)">`. SVG evaluates the mask
in the TRANSFORMED coordinate space, so the same `#garment-silhouette` mask works
correctly for both left and right side views — no separate flipped mask needed.

**Background:** `#EFEFED` (clean off-white)
**Drop shadow:** `feDropShadow dx=0 dy=5 stdDeviation=12 floodColor=rgba(0,0,0,0.18)`
**Hoodie cutouts:** Use `-new` versions (`white-hoodie-front-cutout-new.png`, `white-hoodie-back-cutout-new.png`)
**Longsleeve dark variants:** `black-longsleeve-front/back-cutout.png`

**Why:** CSS mix-blend-mode in SVG is broken whenever a parent has a `filter` attribute — the
filter creates an isolated compositing layer. SVG-native feBlend on the element itself bypasses
this completely and is guaranteed cross-browser.
