---
name: TryNex Design Studio feature flags and key constraints
description: Important flags, constants, and constraints in DesignStudio.tsx
---

## Feature flags
- `STUDIO_CUSTOM_COLOR_ENABLED = false` — set to `true` to re-enable the custom color picker HEX input (currently hidden pending UX review)

## Key constants
- `PRODUCT_TAB_ICONS` — Record<string, React.ReactNode> mapping product IDs to inline SVG icons (replaces emoji/icon-font approach for reliability)
- Print zone corner brackets: rendered as 4 `<div>` corner L-shapes in `mockups.tsx` — NOT full border rectangles (cleaner UX)

## File sizes (as of session)
- `DesignStudio.tsx`: 4365 lines — the authoritative version; any version under 2000 lines is broken/incomplete
- `mockups.tsx`: ~713 lines

**Why:** These flags were set intentionally during a design review. Don't re-enable custom color picker without confirming with user.

## Print zone approach
Corner brackets use absolute-positioned divs with border-top+border-left (or appropriate corners) styled in the brand orange color. The print area label "PRINT AREA" appears centered below the zone.
