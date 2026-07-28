# TryNex generated mockup source kit

This folder contains the generated 1024×1024 preview and editable PSD source
for every currently supported TryNex product color and view.

## Coverage

- 6 products
- 54 catalog colors
- 2 views per color
- 108 PSD documents
- 108 matching PNG previews

`manifest.json` is the source of truth for product IDs, color hex values,
view labels, calibrated print zones, and the source strategy used for each
document.

## PSD layer contract

Every PSD is a raster-layered Photoshop document with these layers, from
bottom to top:

1. `Studio Background — Warm White`
2. `Product Photo — <color> — <view>`
3. `Print Zone Mask — <view> — toggle visibility` (hidden by default)
4. `Artwork — Place Design Here` (blank, editable raster layer)
5. `Placement Guide — <view> — toggle visibility` (hidden by default)

The documents are intentionally kept separate from the current
`/public/mockups` fallback assets. They can be reviewed or wired into the
Design Studio without risking the existing customer-facing mockup pipeline.

The source photographs are 1024px, so this is a web/mockup source kit rather
than a 300dpi print-production master. Replace the product photo layer with
higher-resolution photography later while keeping the layer names and manifest
contract unchanged. The kit is kept in `attached_assets` rather than the
public runtime folder so the storefront does not ship the editable PSD sources
to customers.
