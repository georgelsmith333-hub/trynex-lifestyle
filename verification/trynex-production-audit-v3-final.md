# TryNex Lifestyle Production Audit — v3 Rebuild Status

**Prepared by:** Manus AI  
**Audit window:** 15–16 August 2026 UTC  
**Repository:** `georgelsmith333-hub/trynex-lifestyle`  
**Live host:** [trynex-lifestyle-shop.pages.dev](https://trynex-lifestyle-shop.pages.dev)  
**Latest evidence commit:** `e85328b`  
**Latest deployed application commit:** `d42b27a`  

## Executive assessment

The TryNex platform has now received a source-level smart-mockup rebuild rather than another renderer-only patch. A canonical **source-kit-v3** was generated for the six product families with front/back coverage, transparent alpha validation, checksums, and auditable manifest metadata. The active production Design Studio route was traced to `src/pages/studio/DesignStudioV2.tsx`; previous fixes had been applied to a legacy V1 file and therefore did not affect `/design-studio`. The active V2 route is now corrected to recognize Long Sleeve and Water Bottle aliases, preserve explicit product deep links over cloud/local draft restoration, and delay URL synchronization until initial query parsing has completed.

The rebuilt production branch is deployable: storefront typecheck passed, the remote build-and-check gate passed, the remote security scan passed, and Cloudflare Pages deployed the active V2 correction as production deployment `94d26b2d`. Live checks confirm Long Sleeve, Mug, Water Bottle, and Cap resolve to their correct templates. The Water Bottle homepage and hero links now target the verified `water-bottles` API category, which returns 10 real products. The system should still **not** be described as fully perfect across every color, face, uploaded-design scenario, admin action, OAuth account exchange, or real order transaction until those stateful checks are executed and recorded.

## Current status matrix

| Area | Status | Evidence | Remaining risk |
|---|---|---|---|
| Source-kit-v3 | **Implemented and internally validated** | 108 transparent front/back PNG assets, manifest/checksum validation, six-family contact sheets | Generated source quality still needs complete live all-color/all-face acceptance |
| Active Design Studio route | **Fixed and deployed** | `/design-studio` uses `DesignStudioV2`; explicit Long Sleeve query now resolves correctly | Complete T-shirt/Cap fresh-session visual matrix is still incomplete in the browser harness |
| Long Sleeve | **Live pass** | `product=long-sleeves` normalizes to `product=longsleeve`; complete black Long Sleeve rendered | Validate all colors and back/side faces with uploaded artwork |
| Hoodie | **Improved; source-level artifact remains under observation** | v3 contact sheets and prior live checks show complete product silhouette | Pale edge/underarm pixels must be rejected or corrected if reproduced in a fresh live matrix |
| T-Shirt | **Pending isolated live acceptance** | v3 source and resolver coverage exist | Browser session repeatedly retained another product during attempted route navigation |
| Mug | **Live pass for route and controls** | Correct Coffee Mug template; Left Side, Right Side, and Wrap controls visible | Confirm curved artwork placement and handle exclusion with a real uploaded design |
| Cap | **Live pass for route and silhouette** | Correct Structured Cap template and black cap front rendered | Confirm color matrix and any supported crown print-zone behavior |
| Water Bottle | **Live pass for route and silhouette** | Correct 600ml Aluminium template with ring-cap/carabiner silhouette | Confirm curved artwork mapping, back behavior, and exclusion zone with uploaded content |
| Homepage merchandising | **Corrected and pushed** | Six-family cards use v3 assets; Water Bottle links use `water-bottles` | Final mobile CTA check remains useful |
| Catalog API | **Pass** | 70 total products; 10 Long Sleeves; 10 Water Bottles; page 2 renders 20 products | Legacy external image URLs remain a performance/ownership risk |
| Print-zone default | **Corrected** | Shared Design Store defaults `showPrintZone: false` | Confirm on all responsive breakpoints after a fresh browser load |
| Editor auto-scroll | **Corrected in prior wave** | Forced desktop auto-scroll removed | Test every tool panel with mouse and keyboard interaction |
| Checkout contract | **Read-only contract pass** | Wallet-only visible path, 25% advance, required last four digits, optional proof, single submit action | No confirmed dummy or real order was submitted in this audit |
| Admin payment/order flow | **Not statefully verified** | Source contract and previous audit evidence exist | Requires authenticated dashboard and a test order/payment record |
| Google OAuth | **Origin configuration fixed; exchange not finally verified** | Replacement Web client and live origin configured | Requires one authenticated account-selection test |
| CI/build/security | **Pass** | `e85328b` workflow build-and-check and security-scan passed; `430e35b` also passed | Keep future changes focused |
| Cloudflare deployment | **Pass** | `d42b27a` production deployment completed; `430e35b` active V2 fix deployed as `94d26b2d` | Preview URLs may be Cloudflare Access-gated; canonical host is the public acceptance surface |
| SEO/blog | **Not fully verified** | Routes and SEO components exist | Search Console/crawl evidence is still required |

## Source-kit-v3 rebuild

The rebuild uses a deterministic source-kit builder and separate normalization/extraction tools. The runtime matrix contains six categories: T-shirt, Long Sleeve, Hoodie, Mug, Cap, and Water Bottle. Each category has explicit front/back assets, transparent corners, nonempty alpha bounds, and checksums represented in the v3 manifest. Apparel sources retain product silhouette and protected details instead of layering a second opaque garment image over customer artwork.

The generated contact-sheet review found that the new front silhouettes are substantially more complete than the previous cutouts. Long Sleeve sleeves, cuffs, hems, hoodie sleeves, hood, pocket, and cords remain present. Water Bottle assets retain the requested ring-cap/carabiner shape. Mug assets retain handle-side geometry. The acceptance record also notes that some reconstructed colored backs are visually simpler than the strongest front photography; this is not being hidden behind a claim of perfect PSD/PSB equivalence.

The current implementation is a **PSD/PSB-style runtime contract**, not a binary Photoshop file generator. Its manifest records editable-master paths, faces, zones, masks, dimensions, alpha bounds, and checksums; the browser compositor renders customer layers over transparent product surfaces. If true Photoshop Smart Object files are required for downstream Photoshop editing, that is a separate deliverable and should not be conflated with the browser renderer.

## Root-cause correction for the live Long Sleeve failure

The earlier deep-link fix was applied to `src/pages/DesignStudio.tsx`, but the public `/design-studio` route is mounted by `src/pages/studio/DesignStudioV2.tsx`. Consequently, the live route continued to fall back to Hoodie even though the legacy file contained the correct alias map.

Commit `430e35b` corrected the active V2 component by adding normalized aliases for `long-sleeve`, `long-sleeves`, `longsleeves`, `water-bottle`, `water-bottles`, and `bottle`; preventing cloud/local drafts from replacing an explicit URL product; and guarding URL synchronization until startup parsing is complete. The public production test then resolved `/design-studio?product=long-sleeves` to `?product=longsleeve` and rendered **Unisex Long Sleeve 240GSM Cotton** with a complete black long-sleeve silhouette.

The same active route was checked for Mug, Water Bottle, and Cap. Mug exposed its three side modes, Water Bottle showed the ring-cap silhouette, and Cap showed the structured cap front. A T-shirt attempt in the existing browser harness repeatedly retained a previous product state; therefore T-shirt is conservatively marked pending fresh-session acceptance rather than falsely marked pass.

## Homepage and catalog routing

The homepage category map and hero product grid now route Water Bottle cards to `/products?category=water-bottles`, matching the live backend. The repeatable API audit returned 70 total products, 10 Long Sleeves, and 10 Water Bottles with valid product metadata and canonical image paths. The existing catalog pagination still exposes 50 products on page 1 and 20 products on page 2.

Several older page-2 records still reference external Unsplash or Imgur URLs. This does not invalidate catalog correctness, but it creates avoidable loading, availability, privacy, and cache-control risk. Those assets should be migrated into controlled project storage with explicit dimensions and lazy-loading behavior.

## Checkout, payment, and admin boundaries

The checkout source contract remains aligned with the requested customer flow: bKash, Nagad, and uPay are the visible wallet choices; the customer pays 25% in advance; the remaining balance is cash on delivery; the sender’s last four digits are required; a payment screenshot is optional; and one payment-submission action persists a submitted payment status and evidence note on the order.

This audit did not create a dummy or real order, upload a payment screenshot, confirm an order in the Admin Panel, or perform a live Google account exchange. Those operations mutate customer/order/authentication state and must be executed only with explicit confirmation and, where needed, user takeover. The implementation is therefore contract-verified, not end-to-end transaction-verified.

## Engineering gates

| Gate | Result |
|---|---|
| Storefront typecheck after active V2 fix | Passed |
| `430e35b` build-and-check | Passed |
| `430e35b` security scan | Passed |
| `e85328b` build-and-check | Passed |
| `e85328b` security scan | Passed |
| Cloudflare Pages deployment for active V2 fix | Passed; production deployment `94d26b2d` |
| Local full Vite build | Process terminated during gzip sizing in the sandbox; remote CI completed successfully |
| Source-kit-v3 acceptance checker | Passed for all 108 generated assets |

## Prioritized next wave

1. Run an isolated six-family live visual matrix for T-shirt, Long Sleeve, Hoodie, Mug, Cap, and Water Bottle across every supported color and face. Record screenshots and reject any pale edge, halo, duplicate layer, missing sleeve, incorrect handle, or wrong bottle cap.
2. Upload one controlled non-sensitive test artwork per product family and verify auto-fit, clipping, curvature, protected details, delete controls, export, cart thumbnail, and cross-product draft behavior.
3. Perform one explicitly confirmed disposable checkout order using a non-sensitive test payload, then inspect the order, payment evidence, notification, tracking reference, and Admin Panel status controls.
4. Complete one authenticated Google Sign-In account-selection test and verify `/api/auth/google` session establishment without storing credentials.
5. Self-host legacy catalog images, add intrinsic dimensions and lazy loading, and measure editor/3D bundle loading on mobile and desktop.
6. Verify homepage, catalog, Design Studio, checkout, tracking, admin, and blog routes at mobile and desktop widths, specifically checking header offsets, floating widgets, cursor scrolling, sticky panels, and content cutoff.
7. Validate robots, sitemap, canonical URLs, structured data, and blog indexing with actual crawl/Search Console evidence.

## Repository evidence

- `430e35b` — active Design Studio V2 deep-link and v3 prefetch correction.
- `d42b27a` — homepage Water Bottle merchandising-route correction.
- `e85328b` — live Water Bottle API evidence and rebuilt visual acceptance record.
- `verification/rebuild-visual-acceptance-baseline.md` — detailed source-kit, contact-sheet, live-route, and remaining-risk evidence.
- `verification/check_live_products_api.py` — repeatable catalog API audit.
- `artifacts/trynex-storefront/src/pages/studio/DesignStudioV2.tsx` — active production Design Studio route.
- `artifacts/trynex-storefront/src/pages/design-studio/mockups.tsx` — canonical v3 resolver and render contract.
- `artifacts/trynex-storefront/src/pages/design-studio/smart-mockup-manifest.ts` — v3 manifest schema.
