---
name: Water bottle mockup calibration
description: User's actual product image (white aluminum carabiner bottle) used as the Design Studio mockup base.
---

## Image
Source: user-provided JPG of white 600ml aluminium bottle with carabiner clip and black cap.
Stored at: `artifacts/trynex-storefront/public/mockups/white-waterbottle-front.png` (transparent PNG, 1600×1600)
Also: `white-waterbottle-cutout.png` (same file, same path, both updated)

## Content bounds (from ImageMagick trim)
x=521, y=79, w=536, h=1436 within 1600×1600
In 1000-unit space: x=[326,660] centre≈493, y=[49,947]

## Print zone (WATERBOTTLE_PZ)
`{ x: 348, y: 278, w: 290, h: 575 }`
- Starts just below shoulder (y=278 ≈ 28% of 1000)
- Ends above base (y=853 ≈ 85% of 1000)
- Centred on bottle body (centre x=493)

## Colour tinting
No `darkFront` image for waterbottle — all colours including black use white PNG + SVG multiply-tint.
Black (#1C1917 lum≈0.01): isNearBlack=true but no darkFront → falls through to white+tint (near-black result correct).
