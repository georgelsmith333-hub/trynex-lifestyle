---
name: DesignStudio desktop drag fix
description: The useGesture drag config had pointer:{touch:true} which broke all mouse drag on desktop. Fix and wheel-zoom pattern documented here.
---

## The Bug
`useGesture` in DesignStudio.tsx had `drag: { filterTaps: true, pointer: { touch: true }, threshold: 1 }`.
`pointer: { touch: true }` restricts drag events to touch-only — breaking mouse drag entirely on desktop.

## The Fix
Changed to `drag: { filterTaps: true, threshold: 1, pointer: { buttons: [1] } }`.
`pointer: { buttons: [1] }` = left mouse button only; still works with touch.

**Why:** The original config was probably added to prevent accidental drag on desktop, but it overcorrected — no mouse interaction worked at all.

**How to apply:** Any time `useGesture` drag is touch-only, this is the fix. Do NOT use `pointer: { touch: true }` unless you genuinely want to exclude mouse events.

## Desktop Wheel Zoom Pattern
Added `handleCanvasWheel` on the canvas SVG `onWheel` prop:
- Guard `deltaY === 0` (no-op for zero delta, common on trackpads)
- Wheel over a layer (without Ctrl) → scale that layer; debounced `commitLayers` (350ms) for undo history
- Wheel on empty canvas (or Ctrl+Wheel) → zoom canvas viewport (canvasZoomRef, canvasPanRef)
- Clamped: layer scale 0.05–8, canvas zoom 0.4–4
- Reset pan when zoom ≤ 1
