# TryNex visual audit — 2026-08-14

## Production state

The latest GitHub commit is `8250330` (`fix: select database with historical order data`). Cloudflare Pages reports success for the frontend deployment, but GitHub CI is failing in `build-and-check`, `security-scan`, and Workers Builds. Render has accepted the backend commit but is still in `update_in_progress`.

## Design Studio observations

The live Design Studio opens with the canonical Unisex T-Shirt product and exposes six product categories: T-Shirt, Long Sleeve, Hoodie, Mug, Cap, and Water Bottle. The product picker shows source previews for all six categories. The default white T-shirt preview is visibly low-contrast and washed out in the screenshot: fabric folds and the printable area are difficult to distinguish, and the mockup appears almost ghosted against the pale canvas. This is consistent with the hardcoded curved-surface overlay and smart-shading pipeline in `src/pages/design-studio/composer.ts`, which currently adds a 22% white center overlay plus edge darkening and a screen highlight pass.

The product picker itself renders six entries and uses the expected asset paths (`tshirt_1.png`, `longsleeve_1.png`, `hoodie_1.png`, `mug_1.png`, `cap_1.png`, and `bottle_1.png`). Further visual checks are required for each product, color, face, print zone, and 3D preview before changing the source contract.

## CI findings

GitHub check failures for commit `8250330` include TypeScript errors where `@workspace/db` exports such as `ordersTable`, `productsTable`, `settingsTable`, `reviewsTable`, and `mockupsTable` are reported missing, despite those symbols existing in `lib/db/src/schema/index.ts` and being re-exported by `lib/db/src/index.ts`. This indicates a workspace build/type-resolution or stale incremental metadata problem rather than missing schema declarations. The security scan fails on eight high vulnerabilities, including `fast-uri` and other transitive packages, despite overrides being present in `pnpm-workspace.yaml`; lockfile resolution and the audit gate require verification.

## Next audit targets

Inspect each picker product and key color variants visually, compare 2D and 3D paths, verify print-zone geometry, then fix only confirmed rendering defects. Remove generated TypeScript incremental artifacts before committing. Fix CI resolution and security-gate failures before the next production deployment.

## Additional visual findings

The Hoodie view confirms the same issue as the T-shirt: the white garment is very low contrast, with a pale washed-out body and bright highlight areas that flatten the folds. The print-zone rectangle is visible, but the garment itself is not presented with a clear, natural photographic separation from the white editor background.

The product selector reliably exposes the six expected products and category filters. The source thumbnails are visibly inconsistent: the T-shirt and Long Sleeve previews are very pale; the Hoodie has a bright central wash; the mug, cap, and bottle thumbnails use a different visual treatment. The six thumbnails are available, but consistent lighting and product-specific rendering still need verification rather than assuming the catalog is visually coherent.

## Bottle audit obstruction

Selecting the bottle from the open product picker did not switch the Design Studio from the Hoodie in the observed state. Instead, an unexpected cart-retention popup appeared over the product selector, showing an existing bottle product in the cart. Pressing Escape did not dismiss the popup. This is a real production usability defect: the cart overlay can block product selection and prevent a clean visual audit or editing flow. The bottle’s actual editor rendering still requires a separate direct route/reload after the popup is fixed or bypassed.

## Confirmed interaction defects

The cart popup can be dismissed only through its hidden button text (`I'll come back later`), not via Escape. After dismissal, navigating directly to `?product=bottle` was normalized back to `/design-studio` and reopened the default T-shirt, so the product deep-link is not honored for the bottle route. This means product-specific visual verification and user redirection are incomplete in production.

The white garment rendering still shows a pale, over-bright fabric treatment with a weak separation from the editor background. The current source code confirms two independent causes: `drawImageCurved` applies a fixed white overlay and edge shadows, while `composeGarmentMockup` adds a screen highlight mask. Both need to be reduced or made material-specific rather than stacking globally.

## Mug visual audit

The Mug route works through the in-app picker and correctly changes the editor to `Coffee Mug · Left Side` with Left Side, Right Side, and Wrap faces. The mug preview is materially clearer than the white apparel views: the ceramic body, handle, and orange dashed print zone are distinguishable. However, the mockup still uses a pale/grey treatment and the print-zone boundary appears as a simple rectangular crop around the mug body, so the wrap/side exclusion geometry needs source-level verification before release.

## Cap visual audit

The Cap route works through the picker and renders a distinct cap silhouette with an orange rectangular print zone. The white cap is clearer than the apparel views but still shows a grey haze over the crown; the print zone does not visibly follow the crown’s curved perspective and appears as a flat rectangle. This is a confirmed product-specific print-zone/rendering mismatch, not merely a subjective lighting concern.

## Bottle visual audit

The in-app picker successfully changes to `Water Bottle · Front` and shows the intended 600ml aluminium bottle silhouette with a black loop cap and a tall centered printable rectangle. This is the correct product shape, but the bottle body is extremely pale and the orange print-zone rectangle does not communicate the curved side exclusion areas or top/bottom no-print regions. The bottle needs a product-specific exclusion mask/overlay rather than a generic rectangular zone, and the white/grey lighting should be reduced so the bottle edge and surface remain readable.
