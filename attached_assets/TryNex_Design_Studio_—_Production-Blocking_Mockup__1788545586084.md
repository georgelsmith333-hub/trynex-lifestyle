# TryNex Design Studio — Production-Blocking Mockup Repair Brief

## Mission

Treat the uploaded-artwork failure in the TryNex Design Studio as a **production-blocking rendering architecture defect**, not a styling issue. Rebuild the mockup pipeline so uploaded artwork behaves like it was inserted into the correct PSD/PSB Smart Object.

The result must preserve each product’s actual lighting, folds, highlights, shadows, texture, alpha silhouette, protected physical details, calibrated print zone, and surface curvature. The same deterministic result must be used by the live Studio canvas, 3D preview, live preview, cart thumbnail, exported PNG, checkout/order thumbnail, and order/admin payload.

Do not report completion based only on compilation, asset presence, or manifest validators. A real uploaded-artwork visual test is mandatory.

## Repository and safety

Continue from the existing repository at:

```text
/home/ubuntu/trynex-lifestyle
```

First run:

```bash
git status --short --branch
```

Record the branch and all existing uncommitted work. Do not re-clone, reset, clean, discard, or overwrite existing work without reviewing it first. Do not make unrelated changes to commerce, checkout, pricing, navigation, or account behavior.

The current live target is:

```text
https://trynex-lifestyle-shop.pages.dev
```

## Relevant implementation areas

Inspect all call sites and consumers, especially:

```text
artifacts/trynex-storefront/src/pages/design-studio/composer.ts
artifacts/trynex-storefront/src/pages/studio/DesignStudioV2.tsx
artifacts/trynex-storefront/src/pages/design-studio/mockups.tsx
artifacts/trynex-storefront/src/pages/design-studio/smart-mockup-manifest.ts
```

Also inspect and run the existing tooling:

```text
scripts/audit_mockup_assets.py
scripts/audit_trynex_mockups.py
scripts/extract_psd_layers.py
scripts/generate_trynex_mockup_psds.py
scripts/inspect_mockup_masks.py
scripts/inspect_psd.py
scripts/rebuild_apparel_from_psd_v5.py
scripts/render_apparel_psd_previews.py
scripts/validate-mockup-matrix.mjs
tools/build-smartobject-mockups.mjs
tools/build_smart_source_kits.py
tools/build_source_kit_v3.py
tools/make-displacement-maps.py
verification/validate_source_kit_v3.py
verification/audit_six_family_matrix_v3.py
```

Fix stale documentation or validation references, including any documented `tools/` path that should point to `scripts/`.

## Findings already established

### 1. The current implementation is an approximation

The current compositor paints customer artwork directly onto Canvas after clipping to an approximate print-zone path. It includes procedural fabric grain, generic strip-based curvature for some mug/cap/bottle surfaces, optional PSD material effect images, and source-luminance smart-shading fallback.

This is not a verified PSD/PSB Smart Object rendering pipeline.

Browser code cannot execute Photoshop Smart Objects natively. PSD/PSB masters must remain the authoritative provenance source, while browser-safe, reproducibly extracted masks, geometry, and metadata become the runtime contract.

### 2. The resolver mixes incompatible asset generations

The existing/live resolver can select a mixture of:

- `smart-v4`
- `source-matrix-v3` / `source-matrix-v4`
- `waterbottle-v11`
- partial source-kit and smart-v8/smart-v9 manifest paths

T-shirt, mug, and cap have smart-v4 references; long-sleeve and hoodie have source-matrix photo references; the water bottle uses a v11 candidate. Some branches mark assets as opaque photos while other code assumes transparent source-kit cutouts.

Eliminate this ambiguity. Every supported family, colour, face, and surface must resolve to exactly one approved, versioned source-kit manifest. No stale smart-v4 fallback may silently override an approved source-kit result.

### 3. Live asset alpha inspection confirmed contract violations

The deployed site was inspected at the Design Studio route. Representative runtime results:

| Runtime asset | Observed result | Consequence |
|---|---|---|
| `smart-v4/tshirt/white/front.png` | 1024×1024 RGBA, alpha range 0–255 | Transparent cutout-like contract |
| `smart-v4/mug/white/front.png` | 1024×1024 RGBA, alpha range 0–255 | Transparent cutout-like contract |
| `source-matrix-v4/longsleeve/white/front.jpg` | 1600×1400, alpha 255 everywhere | Opaque full-frame photo; cannot use cutout tint path |
| `waterbottle-v11/white/front.png` | 1024×1024, alpha 255 everywhere | Opaque full-frame image; cannot use transparent-cutout path |
| `source-matrix-v4/hoodie/white/front.jpg` | Invalid/missing response observed | Must fail closed, not fall back silently |
| `smart-v9/tshirt/white/front.png` | Invalid/missing response observed | Must fail closed, not fall back silently |
| `source-kit-v3/cutouts/tshirt-white-front.png` | Invalid/missing response observed in live deployment | Must verify deployment and manifest paths |

Measure every enabled asset with actual bytes, dimensions, alpha extrema, corner pixels, alpha bounding box, and fringe/premultiplication checks. Never trust variable names or comments.

### 4. The deployed compositor uses generic fallback shading

The deployed bundle contains a Canvas 2D compositor that:

- paints a base image;
- can perform a full-frame multiply/destination-in tint sequence;
- clips layers to a print-zone path;
- applies source-luminance-derived multiply/screen shading;
- uses family-level fallback geometry/curvature.

Do not use a single generic source-luminance multiply/screen pass as the final Smart Object solution. Do not redraw an opaque garment photo over the design. Earlier full-frame multiply passes caused ghost silhouettes, duplicate shadows, pale wedges, and washed white surfaces; preserve that learning.

### 5. The live stack has structurally separate rendering paths

The live bundle contains separate paths for Studio canvas, SVG/image presentation, 3D preview, cart thumbnail, and export. The cart thumbnail path uses a fixed `outSize: 400`, while the editor canvas uses its live dimensions.

Unify these consumers around one serialized design state and one shared deterministic compositor. Resolution may differ for interactive preview versus export, but geometry, masks, source-kit key, compositing order, and transforms must be identical.

### 6. Existing source-kit labels are not visual proof

A representative manifest exists at:

```text
artifacts/trynex-storefront/public/mockups/source-kit-v3/manifests/tshirt-white-front.json
```

It declares `trynex-smart-mockup/v3`, sourceKitKey, product category/colour/face, cutout asset, editable PSD master, 1024×1024 size, alpha bbox, and `masterStatus: manifest-only`.

Do not interpret `manifest-only`, `verified`, or asset availability as visual acceptance. Validate actual composites.

## Required source-kit contract

For every enabled family/colour/face/surface, define a versioned manifest containing:

1. Product family, colour, face/surface, and unique source-kit key.
2. Approved source asset and explicit alpha mode: `opaque-photo` or `transparent-cutout`.
3. Normalized dimensions and alpha bounding box.
4. Calibrated printable-area clip mask.
5. Exclusion mask for non-printable regions.
6. Shadow/fold map derived from PSD/PSB or documented source-photo derivation.
7. Highlight map derived from PSD/PSB or documented source-photo derivation.
8. Fine texture/grain map where materially relevant.
9. Protected-detail/occlusion mask above customer art.
10. Calibrated displacement map, mesh, or geometry parameters where needed.
11. Print-zone geometry, aspect-ratio rules, margins, seams, and safe areas.
12. Allowed blend modes and per-mask opacities.
13. PSD/PSB master path, source provenance, master hash, derived-asset hashes, revision, and approval status.
14. Runtime asset paths that are browser-safe and deployment-valid.

Use explicit TypeScript types so opaque photos cannot accidentally enter the transparent-cutout tint/shading path.

## Required compositor architecture

Rebuild around offscreen layers; do not merely add more `drawImage` calls to the current direct renderer.

Required order:

1. Resolve one approved source-kit manifest for the selected family, colour, face, and surface.
2. Load the correctly normalized base product source once.
3. Preserve its alpha contract exactly. Tint only transparent cutouts and only inside product alpha. Never tint exact-colour opaque photos.
4. Rasterize all customer artwork into a transparent offscreen artwork canvas in product space.
5. Preserve uploaded alpha, aspect ratio, transforms, and sufficient intermediate resolution.
6. Apply calibrated per-surface warp/displacement/mesh while drawing artwork.
7. Clip artwork with the real printable mask and exclusion mask.
8. Apply sourced shadow/fold information using multiply only inside the artwork/ink region.
9. Apply sourced highlights using an approved calibrated blend only inside the artwork/ink region.
10. Apply texture only where approved and without fabricating global noise as the primary realism mechanism.
11. Apply protected-detail occlusion above artwork: drawstrings, pockets, seams, collars, cuffs, cap brim/crown seams/rear strap, mug rim/handle/base, bottle lid/shoulder/carbineer/rounded base, and other physical details.
12. Composite the base exactly once. Never draw a full-frame garment again above the final art.
13. Preserve final base alpha and avoid halos, rectangular artwork boundaries, dark blocks, background tint, ghost garments, duplicate shadows, pale wedges, and washed whites.

## Surface-specific geometry requirements

- **T-shirt, hoodie, long sleeve:** use per-surface calibrated print masks and displacement where folds materially affect the design. A documented flat treatment is acceptable only where the source and print placement genuinely support it.
- **Mug:** use calibrated cylindrical/perspective mapping for the printable body. Exclude handle, rim, and base. Support front/back/wrap behavior consistently.
- **Water bottle:** use calibrated cylindrical mapping for the printable body. Exclude lid, shoulder, carabiner, and rounded base. Avoid pinching or uneven edge compression.
- **Cap:** use calibrated panel/dome mapping. Respect crown seams and exclude brim, rear strap, and other physical details.
- **Neck label and sleeves:** use their own print zones, masks, transforms, and applicable occlusion rules. Do not reuse the front rectangle.

Do not use one generic strip warp for every curved product.

## Required unified data flow

The serialized design must include:

- product family and product ID;
- colour and face/surface;
- source-kit key and manifest revision;
- artwork layer IDs, source image references, alpha, position, scale, rotation, and transforms;
- text/shape/QR layers as applicable;
- renderer version;
- final render dimensions and approved render metadata.

The same state and compositor must drive:

- Studio editing canvas;
- 3D preview texture;
- live preview;
- add-to-cart image;
- cart thumbnail;
- exported PNG;
- checkout/order thumbnail;
- order/admin payload.

Store the source-kit key, manifest revision, product, colour, face, artwork transform/layer data, and final approved render metadata with cart/order records.

## Fail-closed behavior

If any required source, mask, displacement map, occlusion layer, or manifest entry is missing, invalid, mismatched, or unapproved:

- show a clear actionable non-production preview warning;
- do not silently fall back to smart-v4, a generic family asset, a guessed rectangle, or a global shading effect;
- disable final export/add-to-cart for that surface until the asset is approved, unless the business explicitly accepts a documented disabled-surface state.

If a family cannot reach acceptable quality, disable custom upload for that family/surface rather than shipping a visibly broken result.

## Required automated tests

Add focused tests that cover:

1. Every enabled family/colour/face resolves to an approved matching manifest.
2. No stale smart-v4 path can override the selected approved source-kit path.
3. Release-matrix completeness across all six families and all enabled colours/faces/surfaces.
4. Manifest rejection for missing masks, unsupported alpha modes, invalid geometry, wrong source-kit keys, invalid hashes, and incomplete matrices.
5. Opaque source is never tinted or sent through transparent-cutout shading.
6. Transparent source retains transparency outside the product after tint/composition.
7. Full garment base is drawn exactly once.
8. Shadow, highlight, texture, and occlusion passes are clipped to the approved artwork region.
9. Protected physical details remain visible above uploaded artwork.
10. Artwork cannot appear on hoodie drawstrings/pocket, cap brim, mug handle/rim, bottle lid/shoulder, or other excluded regions.
11. Aspect ratio and transforms remain stable when switching product, colour, face, and surface.
12. Preview, cart, and export use the same serialized design geometry and source-kit revision.
13. Missing/invalid assets produce visible actionable failure states.
14. Oversized, unsupported, corrupt, remote/CORS-blocked, transparent, and highly opaque uploads are handled safely.
15. Surface switching, fast colour/product switching, undo/redo, and render-pending export/cart actions do not create stale or corrupted snapshots.

## Visual validation requirements

Generate reproducible before/after contact sheets or equivalent evidence. At minimum test:

- T-shirt white and dark colour;
- hoodie;
- long sleeve;
- mug;
- cap;
- water bottle;
- all enabled colours and applicable faces/surfaces, ideally the complete active matrix (reported previously as 188 surfaces if still current).

Use two uploaded assets:

1. Diagnostic artwork containing a checkerboard/grid, thin lines, RGB colour bars, black/white text, semi-transparent shapes, and a white border.
2. A photographic PNG with transparency.

Inspect every result for:

- folds and highlights affecting ink realistically;
- no rectangular artwork boundary;
- no missing or doubled garment shadow;
- no green cast, unexpected tint, or washed white source;
- no alpha fringe/halo;
- correct placement and safe margins;
- protected physical details above artwork;
- sensible curvature without buckling or edge collapse;
- matching Studio, 3D preview, cart, and export output;
- acceptable interactive performance and asynchronous high-resolution export behavior.

A passing typecheck or asset validator is not sufficient. The review must include a real uploaded-artwork render and saved visual artifacts.

## Required final report

Return a severity-ranked report separating:

1. Asset defects.
2. Alpha/mask defects.
3. Resolver/source-selection defects.
4. Compositor defects.
5. Cross-consumer inconsistencies.
6. Remaining asset gaps or disabled surfaces.

Include:

- exact files changed;
- source-kit and manifest revisions;
- reproducible extraction/derivation commands;
- corrected validation commands;
- automated test results;
- visual contact sheets/screenshots;
- release checklist and exact pass criteria;
- recommendation: production-ready, conditionally ready with disabled surfaces, or not ready.

Be honest about any surface that cannot achieve true PSD-equivalent quality because its master or source asset is insufficient.

## Release gate

Do not release or call this complete until:

- every enabled surface resolves to an approved manifest;
- alpha semantics are explicit and validated;
- no incompatible fallback remains;
- compositor output is unified across Studio, preview, cart, export, and order/admin;
- required tests pass;
- real uploaded-artwork visual evidence has been reviewed;
- any unfit surface is disabled with a clear business-facing reason.
