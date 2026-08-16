# TryNex Smart Mockup Rebuild — Acceptance Baseline

## User-supplied visual acceptance

The supplied contact sheets are the acceptance reference for a **clean, complete, product-accurate blank source**. Each family must preserve the actual product shape and details while providing consistent front and back views: short-sleeve T-shirt, Long Sleeve, Hoodie, Mug, Cap, and the key-ring/carabiner Water Bottle. The source must have a true transparent background, no checkerboard baked into pixels, no pale wedges, no duplicate silhouette, no clipped sleeve/hood/body, and no artificial white bloom. User artwork must be a separate layer clipped to the correct print zone.

The supplied hoodie comparison establishes the expected behavior: the design may appear on the front or back, while the hood, drawstrings, cuffs, kangaroo pocket, hem, and complete sleeve silhouette remain intact above or outside the artwork. The live screenshot baseline shows the current black hoodie still has a pale/jagged underarm edge artifact, so it is not accepted as final.

## Source audit findings

1. The active resolver in `src/pages/design-studio/mockups.tsx` constructs every cutout path as `/mockups/source-kit-v2/<category>/<color>/<face>.png?v=smart-v2`.
2. The source-kit-v2 tree currently has **front-only assets**: 8 T-shirt, 10 Long Sleeve, 10 Hoodie, 10 Mug, 8 Cap, and 8 Water Bottle fronts. The generated back path is missing for all expected pairs.
3. Existing `normalized-cutouts` contain transparent front/back assets for all six families, but they are not copied or referenced consistently by the v2 resolver. This is a wiring gap, not merely a coordinate issue.
4. The active source-kit fronts are true RGBA cutouts with zero-alpha corners and stable family-specific alpha bounds. The black hoodie `front.png` is byte-identical to `front-clean-alpha-v2.png`, while the separate `normalized-cutouts/black-hoodie-front-cutout-real.png` has a different, tighter alpha bound. Multiple competing hoodie variants exist and must be reduced to one canonical runtime source.
5. `GarmentSVG` intentionally renders only `cutoutSrc`, which correctly prevents duplicate opaque-photo layers, but its missing back paths and competing source variants prevent a complete front/back product contract.
6. `ProductViewer3D.tsx`, `composer.ts`, the admin mockup route, and catalog/home components must all consume the same source-kit manifest and face/zone mapping; otherwise the editor, export, 3D, cart, and admin can disagree.

## Required pass criteria

| Area | Acceptance condition |
|---|---|
| Source assets | One canonical transparent source per family/color/face; no missing resolver paths; no baked backgrounds or checkerboard pixels |
| Apparel | Full body and sleeves; no pale wedges, cutoff cuffs, split underarms, ghost layers, or changed product shape |
| Hoodie | Hood, drawstrings, kangaroo pocket, cuffs, hem, and sleeves remain intact; artwork starts below cords and ends above pocket |
| Long Sleeve | Both sleeves and cuffs remain complete; no cutoff arms or white triangular gaps |
| Mug | Front/left and back/right face mappings differ correctly; handle and rim stay outside the print zone; wrap mode follows curvature |
| Water Bottle | Exact ring-cap/carabinier product retained; artwork only on straight body; cap/loop/shoulder/base stay protected |
| Cap | Crown artwork stays inside front panel; brim, seams, rear opening, and strap stay protected |
| Editor | Upload/text/emoji/QR/AI layers auto-fit, select, open Layers, remain editable, and expose delete/hide/lock/reorder controls |
| Export/3D/admin | Same layer array and manifest contract produce consistent preview, PNG/cart thumbnail, 3D texture, and admin preview |
| Responsive UI | No header cutoff, fixed-widget overlap, collapsed sections, or mouse-wheel/scroll traps at desktop or mobile widths |

## Rebuild rule

Do not claim PSD/PSB parity from a flattened PNG. The implementation must use an auditable manifest with `sourceKitKey`, `editableMasterPath`, `baseSrc`, `cutoutSrc`, normalized frame, face, color, print zone, detail masks, curvature, and `preserveDetailsAboveArtwork`. The browser runtime may use PNG/WebP, but the manifest must explicitly track the PSD/PSB master metadata and every surface must resolve through the same contract.

## v3 contact-sheet visual findings — first pass

The generated hoodie and Long Sleeve matrices confirm that the clean front cutouts largely preserve complete sleeves, hems, hoods, cuffs, and product alpha. However, most non-white colored back assets are flat color silhouettes with little or no fabric shading, seams, hood structure, or fold detail. The black/white back sources retain more detail, but the colored back rows are not production-acceptable as realistic smart mockups. The correct next fix is deterministic luminance-preserving recoloring from a detailed canonical back cutout, not another generic silhouette clip or duplicate layer.

## v3 contact-sheet visual findings — second pass

The Mug matrix has correct mirrored handle geometry for front/back, but colored faces are flatter than the white/black references and need restrained luminance preservation. Cap backs contain real rear-opening/strap detail, although their shadow/edge treatment is inconsistent with the front cutouts and should be normalized without removing protected details. Water Bottle fronts and backs retain the required upright aluminium body with loop/carabiner silhouette, but several colored/white backs have bright edge halos around the shoulder and loop; alpha-edge cleanup is required before acceptance. These findings confirm that source-level normalization must include both recoloring and alpha-fringe cleanup, not only path rewiring.

## v3 contact-sheet visual findings — final apparel pass

After rebuilding the matrix in the correct order and extracting original normalized photographic backs, all hoodie and Long Sleeve rows retain complete silhouettes, sleeves, cuffs, hems, and stable framing. The former missing-back/flat-source wiring defect is removed from the runtime matrix. The black and white special cutouts are the strongest references; colored backs now have authentic product contours and restrained shading, but remain less detailed than the colored front studio photos because the available source backs themselves are simpler. No new generic silhouette clip or duplicate layer was introduced. This is a materially improved source contract, but live six-family acceptance must still verify artwork rendering on the deployed build.

## Live deep-link check

A cache-busted navigation to `/design-studio?product=long-sleeves&release=3da3cff` currently resolves in the live browser to `/design-studio?product=hoodie`. The rendered page shows the Hoodie editor and a cloud-restored draft. This is recorded as a deployment/acceptance failure for the current live revision, not marked fixed until the 3da3cff build is deployed and the route remains Long Sleeve after initialization.

## Live V2 deep-link acceptance

Cloudflare deployed commit `430e35b` as production deployment `94d26b2d`. The public route `/design-studio?product=long-sleeves&release=430e35b` now normalizes to `?product=longsleeve`, renders **Unisex Long Sleeve 240GSM Cotton**, and shows a complete black Long Sleeve with both sleeves and cuffs visible. The previous live Hoodie fallback was traced to the active `src/pages/studio/DesignStudioV2.tsx` route—not the legacy V1 file—and was corrected with alias normalization, explicit-query precedence over draft restoration, and deferred URL synchronization.

## Live product-family acceptance

The deployed `430e35b` build was also checked on `/design-studio?product=mug` and `/design-studio?product=water-bottles`. Mug resolves to **Coffee Mug 11oz Ceramic** with distinct Left Side, Right Side, and Wrap controls. Water Bottle resolves to **Water Bottle 600ml Aluminium** and visibly retains the required ring-cap/carabiner silhouette. Both routes expose the v3 editor controls and clean canvas state without the earlier Hoodie fallback.

## Remaining live matrix note

After the Water Bottle check, an attempted navigation to `/design-studio?product=tshirt&release=430e35b` remained at `?product=waterbottle` in the existing browser session. Console inspection confirmed the URL and rendered button both remained Water Bottle. This is recorded as a browser/session navigation anomaly and requires a fresh navigation/session or automated route-level matrix check before T-shirt and Cap are marked as live-accepted; they are not being falsely marked complete.

## Cap and T-shirt live matrix status

The live Cap route resolves correctly to **Structured Cap Cotton Twill** and renders the black cap front. A same-session T-shirt navigation unexpectedly remained on the prior Water Bottle state, while Cap navigation succeeded immediately afterward. This suggests a browser/session or route-transition inconsistency rather than a universal alias failure, but T-shirt is conservatively left as pending isolated-session acceptance until verified independently.

## Isolated browser harness limitation

A fresh-session attempt and forced `window.location.href` navigation for T-shirt still returned the existing Cap page in the browser harness. The resulting page source and screenshot consistently report `?product=cap`. This prevents a reliable visual T-shirt acceptance claim through the current browser session; the code-level resolver and generated v3 contact sheet remain the source of truth until a separate browser context or automated Playwright run is available.
