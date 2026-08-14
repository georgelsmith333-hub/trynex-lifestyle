# Live TryNex audit findings — 2026-08-14

Sources inspected:

- Production API health: https://trynex-api.onrender.com/api/healthz
- Production storefront: https://trynex-lifestyle-shop.pages.dev/
- Production catalog page 1: https://trynex-lifestyle-shop.pages.dev/products
- Production catalog page 2: https://trynex-lifestyle-shop.pages.dev/products?page=2

## Verified live behavior

The production API health endpoint returned `{"status":"ok","db":"ok","redis":"ok","storage":"r2"}`.

The production storefront loaded with the 25% advance banner, bKash/Nagad/uPay display, product imagery, and a populated homepage.

The live catalog returned 70 total products. Page 1 displayed 50 products and page 2 displayed 20 distinct products, with working `Previous 1 2 Next` controls. Live product images were generally present, but page-two `Premium Pullover Hoodie` still used `/images/product-placeholder.svg`, so image completeness is not yet perfect.

The live catalog contains multiple category labels: Caps, Custom Orders, Hoodies, Long Sleeves, Mugs, T-Shirts, and Water Bottles.

## Observed live gaps

The local development storefront initially showed 0 products because its Vite proxy targets `localhost:8082` but no local `DATABASE_URL` is present, so the local API could not start. This is an environment limitation but prevents local end-to-end testing unless a safe development database is provided.

The active local Design Studio opened as the older Unisex T-Shirt editor with generic XS through XXXL sizing. The browser audit did not yet verify all six product-specific mockups, variant selection, upload/delete/replace, export, cart handoff, and mobile behavior.

The live production catalog showed many established product prices such as mugs at ৳349/৳399/৳449 and T-shirts from ৳499/৳599, which are not the new custom Design Studio variant prices. Product-detail and Design Studio variant contract propagation still requires live verification after migration/deployment.

The live abandoned-cart reminder appeared over the catalog when a cart item was present. The current browser storage showed a cart item and `spin_modal_shown_v2`, but no explicit abandoned-cart dismissal key before dismissal testing. This needs a production reload test after the current persistence code is deployed.

GitHub CI for commit `2fc677c` was still `in_progress` at the time of the audit. Older commits through `da8e2fe` were successful.
