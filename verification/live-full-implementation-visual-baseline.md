# Live full-implementation visual baseline

Checked 2026-08-15 against `https://trynex-lifestyle-shop.pages.dev`.

## Route

`/studio` is a live 404. The storefront’s working Design Studio route is `/design-studio`.

## Design Studio baseline

The live `/design-studio` page loads the editor with a white Unisex T-Shirt, front face, color swatches, apparel face tabs, print-zone toggle, texture toggle, export control, tool tabs, garment sizes, and a center `Upload Image` CTA. The center CTA is visible before any layer exists, as expected. The active editor also shows an orange upload control in the right tool panel and a second upload tab control; this must be rechecked after adding a layer to verify that the center CTA disappears globally and the Layers tab opens automatically.

The live screenshot showed the white garment silhouette and its print-zone boundary without a visible duplicate full-frame garment layer. Remaining matrix work is to repeat this on dark apparel, mug front/back, cap, and ring-cap bottle variants, then add a real test image and inspect clipping/curvature.


## Product-picker visual evidence

Opening the product picker on the live editor displays all six families with canonical preview paths: Unisex T-Shirt, Unisex Long Sleeve, Unisex Hoodie, Coffee Mug, Structured Cap, and Water Bottle. The bottle preview visibly uses the ring-style cap. The picker is visually usable, but the first coordinate click targeted the product picker rather than the Text toolbar because dynamic element indices changed; no customer data was changed.

The following live test still needs to target the Text tool or upload a local fixture and then verify that the center CTA disappears and Layers becomes active after insertion.


## Text insertion acceptance

On the live `/design-studio` route, selecting Text and clicking the shirt canvas created a real text layer. The live UI then showed `Layers 1`, the Text editor opened automatically, and the center canvas `Upload Image` CTA disappeared. The page displayed `Saved` during the insertion flow. This requirement passes visually for text insertion.


## Hoodie visual acceptance

The live product picker selected `Unisex Hoodie 320GSM Fleece` and preserved the existing text layer (`Layers 1`) while automatically returning to the editor. The white hoodie preview visibly retained the hood, both drawstrings, cuffs, hem, and kangaroo pocket. No duplicate full-frame garment silhouette or white bloom was evident in the live screenshot. Dark hoodie swatches are available for the next color-specific check.


## Black hoodie visual acceptance

The live hoodie selector changed the garment to Black while retaining `Layers 1`. The black source is a complete hoodie silhouette with visible hood, drawstrings, sleeve edges, kangaroo pocket, and hem. The screenshot did not show a duplicate bright garment layer, white bloom, or a second ghost silhouette. This high-risk dark hoodie color passes the current visual check; additional dark colors and curved products remain to be checked.

## Expanded live audit: Track and Design Studio

The live Track Order page at `/track` loads with the heading, two required fields, Track Order button, footer trust cards, and no immediate collapsed-body error at desktop width. The unfinished-design draft widget overlaps the lower-left footer/tracking content and must be repositioned or made non-obstructive on small screens.

## Checkout and payment contract audit — 2026-08-16

Opening `/checkout` with an empty persistent cart safely redirects to `/cart` and shows the empty-bag state; no order or payment data was changed. The checkout source confirms that only configured wallet methods (`bKash`, `Nagad`, and `uPay`) are exposed in the visible selector, while the unsupported bank/card/COD branches are not included in the customer-facing method list. The default payment mode is forced to **25% advance**, and the order request records the remaining balance as cash on delivery.

The gateway UI contains one copy button for the configured merchant number, one required `Sender Number — Last 4 Digits` field, an optional JPG/PNG/WebP payment screenshot upload, and one `I've Sent the Payment` submission action. The backend `PUT /api/orders/:id/payment-info` requires exactly four wallet digits, appends method/last-four/proof evidence to order notes, sets `paymentStatus: submitted`, and emits a customer notification when applicable. A real order submission and payment proof upload remain intentionally unperformed because that is a state-changing transaction requiring explicit confirmation.

The live Design Studio currently opens as `?product=hoodie` with a restored cloud draft and one layer. The final cache-busted rollback screenshot after `cc31a46` restores the prior stable black hoodie appearance; the failed alpha filter is no longer active, and the hoodie retains its hood, cords, pocket, sleeves, and hem. A small pale side-edge/underarm artifact remains visible, so the source-kit normalization and full six-product matrix are still not production-perfect. This confirms the smart-mockup rebuild is not yet visually complete in production even though the v2 resolver is deployed. The editor still exposes Upload Image in the right panel while Layers shows one restored layer; that is acceptable for the right-panel control but the center CTA/layer state must be tested after clearing or inserting a layer. The live color selector exposes many apparel colors, so a full matrix remains required.

## Live catalog and Long Sleeves acceptance — 2026-08-16

The live `/products` route reports **70 total products** and visibly exposes `Previous`, page `1`, page `2`, and `Next`; the first view reports 50 products, so the 51–70 remainder is reachable through pagination controls. The catalog page provides category filters for Caps, Custom Orders, Hoodies, Long Sleeves, Mugs, T-Shirts, and Water Bottles.

Selecting **Long Sleeves** loads a dedicated collection with **10 products**, all with image URLs under `/assets/products/longsleeve_*.png`, product names, pricing, ratings, wishlist, quick-view, and add-to-cart controls. The category result therefore passes the slug/filter acceptance at the live route. A separate live visual check of page 2 and mobile layout remains advisable.

## Live catalog page-2 acceptance — 2026-08-16

The live `/products?page=2` route renders **20 products** and retains the pagination controls. The remaining cards include names, prices, product links, and image URLs. Most canonical catalog images use `/assets/products/...`; several legacy items use external `images.unsplash.com` or `i.imgur.com` URLs. Those external assets are a documented performance and availability risk even though page 2 is reachable and the cards render.

## Live Pages-proxy product API acceptance — 2026-08-16

A read-only request through `https://trynex-lifestyle-shop.pages.dev/api/products` returned HTTP-success JSON with `total: 70`; requesting `category=long-sleeves` returned `total: 10`, `categoryName: Long Sleeves`, and canonical `/assets/products/longsleeve_*.png` image paths. The API contract also exposes product sizes, colors, stock, variants, rating, and customization flags. With `limit=100`, the API reports `totalPages: 1`; the UI’s page-1/page-2 split is therefore a storefront presentation layer rather than an API pagination defect.

## Live hoodie edge-guard acceptance — 2026-08-16

After green CI for `07f0563`, the deployed black hoodie at `/design-studio?product=hoodie` showed a materially reduced pale outer duplicate compared with the prior screenshot: the broad gray side wedge is clipped away and there is one visible hoodie layer. However, the outer arm and underarm contours remain visibly jagged and the source still needs a dark-pixel alpha cleanup before this product can be marked production-perfect. The live page also confirmed the draft-restored state and the central Upload Image CTA behavior remains present only while the design layer state is not empty or has a restored layer.
