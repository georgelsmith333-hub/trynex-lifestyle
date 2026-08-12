# TryNex Live Audit — 2026-08-12

## Sources

- Live storefront: https://trynex-lifestyle-shop.pages.dev/design-studio
- Live products API: https://trynex-lifestyle-shop.pages.dev/api/products?limit=100&sort=oldest&live_audit=20260812
- Live health: https://trynex-lifestyle-shop.pages.dev/api/healthz
- Cloudflare Pages project: `trynex-lifestyle-shop`
- Cloudflare latest deployment query: Pages API `GET /accounts/{account_id}/pages/projects/trynex-lifestyle-shop`

## Findings

1. Before the latest push, the live Design Studio visibly rendered the V1 toolbar (Select/Text/Shape/Draw/Eyedropper) even though `main` had a V2 route. This was verified from the live page's interactive elements and screenshot.
2. The live API health response was `{\"status\":\"ok\",\"db\":\"ok\",\"redis\":\"ok\",\"storage\":\"r2\"}`.
3. The live API originally returned 9 products. Cloudflare Pages production `API_URL`, `API_ORIGIN`, and `TRYNEX_API_URL` all point to `https://trynex-api.onrender.com`, whose Render config uses a Render-managed database, not the local Neon shard used by the earlier seed attempt.
4. An authorized production admin login succeeded through `/api/admin/login` using the user-provided project secret, without exposing the token.
5. The live catalog was synchronized through `/api/categories` and `/api/products/bulk`: created missing `long-sleeves` and `water-bottles` categories; imported 60 definitions; every bulk chunk reported success and zero failures.
6. A cache-busted live API query now reports 69 product records (`grep -o '\"id\":'` count), includes `Birthday Celebration Tee`, and includes 10 `Water Bottles` occurrences. The response source is the live Cloudflare API URL above.
7. Commit `4ebe71529` was pushed to `origin/main` with buildable V2 mobile state wiring, checkout optional-string fix, duplicate full-frame mockup mask removal, opaque-photo shadow disablement, and `scripts/sync_live_catalog.mjs`.
8. Local authoritative storefront typecheck and production build passed.
9. Cloudflare Pages deployment for commit `4ebe71529e35626b1694f9b71637e96a1d4810e8` is active at `https://6b5dd9c8.trynex-lifestyle-shop.pages.dev`; at 18:01:39 UTC it was still in `clone_repo` active, with build/deploy idle. Previous production deployment `062a1eec` was commit `9abd97eb` and successful.

## Code root causes fixed in current working tree

- `DesignStudioV2.tsx` referenced `mobileToolOpen` and `setMobileToolOpen` without destructuring them from Zustand, causing production typecheck failure.
- `Checkout.tsx` passed optional `selectedUpazila` to a required prop, causing production typecheck failure.
- `mockups.tsx` rendered undefined `getShadowMask` / `getHighlightMask` duplicate full-frame images and set `allowSilhouetteShadow: true` for opaque 1024x1024 photos, causing ghost/double silhouettes. The duplicate passes were removed and rectangle shadows disabled.

## Remaining verification

Poll Cloudflare deployment `6b5dd9c8-55f1-40a5-8465-5a385076f8fe` until terminal success, then browse the live production site again at `/design-studio` and the products page. Verify V2-specific labels/bottom-sheet behavior, mobile viewport interactions, asset HTTP 200s, and absence of ghost overlays. If deployment fails, read Pages deployment history logs at `/accounts/{account_id}/pages/projects/{project_name}/deployments/{deployment_id}/history/logs`.

## Final visual/product findings after commit c63c643a0

10. Cloudflare Pages deployment `933950b0` for commit `c63c643a0` completed successfully: clone, build, and deploy all succeeded. The live production Design Studio now renders one visible normalized T-shirt inside a valid SVG root; the previous blank canvas was caused by `GarmentSVG` and `FlatZoneSVG` returning `<defs>/<image>/<rect>` fragments directly into an HTML `<div>` rather than a real `<svg>` element.
11. At a real 390×844 viewport, the live page shows an organized toolbar, horizontal color row, visible mockup, and mobile magic-tools FAB with no overlap. Desktop live color click from White to Black changed the selected label and rendered a black T-shirt; Draw tool click activated the Draw pill without navigation or canvas failure.
12. The public products page now displays `All Products 69`, category filters including Long Sleeves and Water Bottles, and visible product cards. The first few new bottle/long-sleeve/cap/mug cards were using `/images/product-placeholder.svg` because their seeded `/assets/products/*.png` filenames did not exist; some hoodie assets were valid. This must be corrected by remapping all 60 new records to the 60 actual files in `public/assets/products` and then re-verifying HTTP 200 images and the public grid.
13. The local asset directory contains exactly 60 files: 10 each for `bottle_`, `cap_`, `hoodie_`, `longsleeve_`, `mug_`, and `tshirt_` prefixes. The goal is one real asset per new product, not placeholders.
