# Design Studio Verification Notes

Date: 2026-08-13 (sandbox current session)

## Findings

- The initial production preview loaded the V3 Design Studio with all six tool buttons, print-zone controls, product/face tabs, color controls, upload panel, layer panel, and PNG export action visible without overlap at the tested desktop viewport.
- Selecting Draw and clicking the canvas originally exposed React error #185 / maximum update depth exceeded. Root cause was the Layers tab using `useCurrentFaceLayers()`, whose Zustand selector returned a fresh filtered array on every snapshot. The panel now uses a primitive face-layer count selector, preventing the loop. The resize effect was also narrowed from the whole Zustand store object to the stable `setIsMobile` action.
- After the selector fix, selecting Draw and clicking the canvas stayed stable, switched to the Layers tab, created a visible `Pen stroke` layer, showed `1 on this face`, and exposed the shape/stroke controls. This proves the tool is no longer state-only.
- The compositor now accepts image, text, shape, and line/polyline layers. Shape and Draw layers are preserved in garment previews, printable textures, PNG export, cart thumbnails, and 3D texture signatures.
- The redundant whole-garment multiply overlay was removed from smart mockup composition. Only clipped luminosity shadow/highlight masks remain, which avoids the previously reported double/ghost silhouette.

## Browser Evidence

- Initial desktop screenshot: `/home/ubuntu/screenshots/5173-i22w2iw1m7jd2s8_2026-08-12_19-26-42_8108.webp`
- React #185 reproduction screenshot: `/home/ubuntu/screenshots/5173-i22w2iw1m7jd2s8_2026-08-12_19-31-59_1663.webp`
- Successful Draw-layer screenshot: `/home/ubuntu/screenshots/5173-i22w2iw1m7jd2s8_2026-08-12_19-33-13_9777.webp`

## Build Checks

- `pnpm typecheck`: passing after the compositor, Draw, selector, and shading fixes.
- `pnpm build`: passing before the final tap-stroke fallback; rerun before commit/deploy.

## Final Production Smoke Test

The rebuilt production preview restored the saved pen layer on reload without an error. Activating Draw and tapping the canvas created a second visible Pen stroke, changed the Layers badge from 1 to 2, and opened the line’s fill/stroke controls without React #185. Clicking PNG then showed the success toast `PNG exported! High-res PNG saved to your downloads.` with the two shape layers present. This validates the end-to-end editor state, persistence, and export path at the tested desktop viewport.
