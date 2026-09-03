# Controlled customer, admin, and Smart v9 review — 2026-09-03

## Decision

**Smart v9 production promotion: NOT APPROVED.**

Owner approval was not granted for any surface. The required authenticated browser
session was not available in this checkout, the browser-use CLI is not installed,
and the artifact preview registry cannot resolve `trynex-storefront`. Therefore
all 188 staged surfaces are explicitly **rejected for promotion pending evidence**,
not rejected as a claim about their visual quality.

The staged release remains fail-closed:

- `dist-mockups/staging/smart-v1/release-manifest.json` remains
  `status: structurally-verified`.
- `visualApproval` remains `false`.
- All 188 manifest entries remain `reviewStatus: structurally-verified`.
- The current reviewed runtime resolver remains active; `acceptedSmartV9Release`
  is not activated in `mockups.tsx`.

## Evidence available in this checkout

### Browser and application

- The managed `Start application` workflow restarted successfully.
- Vite served the SPA shell with HTTP 200 for `/`, `/checkout`, `/account`,
  `/design-studio`, `/admin/orders`, `/admin/settings`, and `/admin/messages`.
- `GET /api/settings` returned the settings-owned public settings payload.
- The artifact screenshot attempt failed with `Artifact not found: trynex-storefront`.
- `browser-use --doctor` could not run because `browser-use` is not installed.
- No authenticated customer or admin session was available. Consequently, no
  visual acceptance is claimed for Checkout, Account/messages, admin Orders,
  admin Settings, or Design Studio.

### Non-mutating checkout, messages, and admin checks

- Invalid `POST /api/orders` returned HTTP 400 validation errors and did not
  create an order.
- Invalid message submission returned the expected validation error and did not
  create a message.
- Protected admin session access returned HTTP 401.
- The admin orders path was not used as acceptance evidence because the API does
  not register `/api/admin/orders` as a direct route; the storefront page's
  authenticated client path remains the relevant contract.
- Checkout reads payment destinations and shipping values from the settings
  payload (`bkashNumber`, `nagadNumber`, `upayNumber`, bank account fields,
  `shippingCost`, and `freeShippingThreshold`). Admin Settings loads and saves
  the same payment fields through the authenticated settings API. No setting was
  changed during this review.

### Smart v9 matrix comparison

| Family | Surfaces | Colors | Views |
| --- | ---: | --- | --- |
| T-shirt | 40 | black, grey, maroon, navy, olive, red, sky-blue, white | front/back/left-sleeve/right-sleeve/neck-label |
| Long sleeve | 50 | black, burgundy, forest, grey, maroon, navy, olive, red, sky-blue, white | front/back/left-sleeve/right-sleeve/neck-label |
| Hoodie | 50 | black, burgundy, forest, grey, maroon, navy, olive, red, sky-blue, white | front/back/left-sleeve/right-sleeve/neck-label |
| Mug | 30 | black, green, maroon, navy, orange, pink, purple, red, sky-blue, white | front/back/wrap |
| Cap | 16 | black, forest, grey, maroon, navy, olive, red, white | front/back |
| White water bottle | 2 | white | front/back |
| **Total** | **188** |  |  |

The active validator reports `188/188` candidate assets and `status: ok`.
All 188 staged preview files match their manifest `previewChecksum`. The public
`smart-v9` runtime tree has all 188 expected files; 186 match the staged previews
byte-for-byte.

The two intentional comparison exceptions are the hash-pinned, authentic
water-bottle faces:

- `waterbottle:white:front`
- `waterbottle:white:back`

For both, the staged manifest/base preview checksum matches the staged source
preview, while the public runtime file matches the separately pinned authentic
water-bottle hashes used by `smart-v9-release.ts`. This is a release-boundary
discrepancy requiring owner review; it is not safe to normalize by silently
overwriting either source.

## Surface decision record

The complete surface set is the `surfaces` array in
`dist-mockups/staging/smart-v1/release-manifest.json` (`surfaceCount: 188`).
This review assigns the following decision to **each of those 188 exact keys**:

> **REJECTED FOR PROMOTION — authenticated browser evidence and owner visual
> approval are missing.**

No surface received owner approval. No surface was promoted, and no runtime
resolver or manifest approval flag was changed.

## Required next evidence

1. Open a real browser with an existing authenticated customer session and
   review Checkout, Account/messages, and representative Design Studio families,
   colors, and front/back/side/wrap views without submitting an order or payment.
2. Open a real browser with an existing authenticated admin session and review
   Orders, Settings, and message paths; verify displayed payment destinations
   still come from settings.
3. Compare all 188 staged surfaces against the reviewed runtime in that browser,
   record explicit owner approval or per-surface rejection, resolve the
   water-bottle hash discrepancy, and only then consider setting
   `visualApproval=true` and activating Smart v9.