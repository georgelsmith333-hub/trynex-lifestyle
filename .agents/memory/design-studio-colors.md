---
name: Design Studio color system
description: How garment colours are rendered in the Design Studio SVG canvas — critical threshold decision.
---

## Rule
Only colours with luminance < 0.12 (near-black, e.g. #1a1a1a) should use the dedicated black garment photo.
All other non-white colours (Navy #1e3a5f lum≈0.21, Maroon #7f1d1d lum≈0.11 — wait, maroon is above 0.12, Red, Olive, Sky Blue, Grey) stay on the WHITE base photo and get their hue applied by the SVG `multiply` tint filter in `GarmentSVG`.

## Two functions in mockups.tsx
- `isLightTint(hex)`: luminance > 0.92 → colour is near-white → no tint needed
- `isNearBlack(hex)`: luminance < 0.12 → colour is near-black → use black garment photo

## Why
The old code used `isDark = !isLightTint` (any luminance ≤ 0.92) to select the dark photo — which included Navy, Maroon, Olive, Red, Sky Blue, Grey. They all rendered as black garments because `darkFront` photo is jet black.

## How to apply
In `GarmentSVG`: use `useBlackPhoto = isNearBlack(tintHex)` for photo selection, use `isDark = !isLightTint(tintHex)` for SVG tint application.
`hasRealDarkImage` must use `useBlackPhoto`, not `isDark`.

## SVG tint filter (mockups.tsx)
desaturate → flood tint colour → composite IN sourceAlpha → multiply with grey → composite IN sourceGraphic
Result: multiply(tint_colour, grayscale_value) = realistic fabric shading.
Works for all transparent-background PNGs (tshirt, hoodie, mug, cap, waterbottle).
