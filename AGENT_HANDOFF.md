# TryNex Lifestyle — Agent Handoff

This is the durable, shareable context for the TryNex Lifestyle project. Read it
after `AGENTS.md` and before planning or editing. Keep it updated after meaningful
work. Never put secret values in this file.

## Project identity

TryNex Lifestyle is a Bangladesh-focused print-on-demand commerce platform for
custom T-shirts, hoodies, mugs, caps, long sleeves, and water bottles. It includes
a customer storefront, browser Design Studio, admin back office, API server,
mobile app, promotional experience, and brand-system artifact.

## Read-first files

1. `AGENTS.md` — mandatory Agent operating rules
2. `AGENT_HANDOFF.md` — this durable project context
3. `replit.md` — architecture, workflows, product behavior, and gotchas
4. The relevant current source files and tests for the user's request

## Current product surfaces

- Customer storefront and admin panel: `artifacts/trynex-storefront`
- API server: `artifacts/api-server`
- Mobile app: `artifacts/trynex-mobile`
- Promo experience: `artifacts/trynex-promo`
- Brand system: `artifacts/trynex-brand-system`
- Shared API contract and generated clients: `lib/api-spec`, `lib/api-client-react`,
  and `lib/api-zod`
- Database schema and migrations: `lib/db`

## Existing work to preserve

- The storefront is the public TryNex Lifestyle commerce experience.
- The Design Studio supports precise 2D editing and realistic 3D/final rendering.
- Curved products use the 3D preview by default while flat apparel uses the 2D
  view by default.
- Product switching re-fits artwork to the target product's print zone.
- Shipping, payment, customer contact, admin settings, and other customer-facing
  values are settings-driven where documented in `replit.md` and memory.
- The API server is compiled before restart; editing API source alone does not
  hot-reload the running server.
- Existing authentication, admin session, database failover, backup, storage,
  rate limiting, and security behavior must be preserved unless the user
  explicitly requests a change.

## Working protocol for every new request

1. Read the current user request and identify the exact requested outcome.
2. Read the first-priority files listed above.
3. Inspect the relevant current implementation; do not rely only on this summary.
4. In the first response, confirm the three required files were read and clearly
   report completed work, the previous stopping point, remaining work, blockers,
   the proposed plan, preserved behavior, verification, and safe parallel work.
5. Submit a plan before editing.
6. Identify all related paths, including API/client, desktop/mobile, admin/customer,
   persisted/runtime, and old/new or before/after behavior.
7. Implement only the approved scope.
8. If independent work is parallelized, reconcile it before completion.
9. Run the relevant verification, rebuilding/restarting services when required.
10. Update this file with durable results, decisions, and remaining work.
11. Submit a completion note before closing or a status handoff when pausing,
    blocking, or transferring the work.

## Current open work

The approved Design Studio V2 reliability pass is complete and has been pushed
through the GitHub-connected external rollout. The public `/design-studio` route is
the active V2 implementation; `/design-studio-v1` and `/design-studio-v2`
are compatibility aliases to that route. The source-kit/runtime mockup audit
now validates the editable manifest as well as public assets.

The genuine six-family PSD/PSB Smart Mockup workstream is complete for its
quarantine structural gate. The remaining release work is controlled visual and
runtime acceptance of all 188 surfaces; production promotion is intentionally
blocked until that evidence is available.

## Latest local commerce and mockup reliability checkpoint (2026-09-03)

```text
Status: complete for the verified local commerce/dependency scope; Smart v9 production promotion remains fail-closed
Last completed: Aligned web/mobile/API payment contracts, made payment evidence contact-authorized and retry-safe, added server-side bank evidence validation, normalized payment methods and direct tracking responses, normalized persisted legacy site-name values at the public settings boundary, upgraded the vulnerable Orval/Tiptap dependency chains, and reconciled the obsolete 202-surface validator to the active 188-surface Smart v9 gate.
Stopped at: After rebuilding and restarting the API workflow, running the full test/typecheck/build suite, completing non-mutating proxied smoke checks, rendering and visually inspecting all 12 audit-PDF pages, and verifying the compatibility validator.
Files/areas changed: API order/payment/settings/message routes, API email and seeded copy, mobile checkout/API wrapper/app branding, storefront checkout/settings/studio copy, generated API clients, dependency manifests/lockfile, mockup validator/docs, audit PDF tooling, and this handoff.
Remaining work: None for the verified local commerce/dependency scope. Authenticated browser review and controlled visual/runtime acceptance of all 188 Smart v9 surfaces are still required before any production mockup promotion.
Blocker: The artifact preview registry cannot resolve this checkout for screenshot capture; the previous handoff also records that browser-use is unavailable. Local Redis credentials remain rejected, while the documented fallback is operating.
Next safe action: Review the authenticated Checkout, Account messages, and Design Studio routes in a real browser. Keep Smart v9 staged until visual/runtime evidence is accepted; do not create test orders during review.
Verification: `pnpm audit --audit-level=moderate` reports 0 advisories; API tests 6 files/26 tests and storefront tests 22 files/76 tests passed; API/storefront/mobile/full-workspace typechecks passed; storefront production build and mobile Expo web export passed; 188/188 active Smart v9 validation passed; the legacy validator delegates successfully; API rebuilt and the managed workflow restarted cleanly; proxied liveness/readiness/products/categories/settings/blog/sitemap/robots returned expected 200 responses; `/api/settings` now returns `Trynext Lifestyle` despite the legacy persisted value; invalid order/payment-info/message probes rejected without creating records; all 12 audit-PDF pages rendered and were visually inspected; no order or payment data was mutated; `git diff --check` passed. Screenshot attempt failed with "Artifact not found: trynex-storefront".
```

### Redis and readiness note

Redis is an optional, disposable cache. PostgreSQL remains the source of truth for
products, orders, settings, and other persistent data. The configured Upstash Redis
provider currently rejects its credentials, so the API uses its documented
process-local in-memory cache fallback with TTLs; a process restart clears that
cache but does not remove database data. `/api/healthz` may therefore report
`degraded` with `redis: "error"`, while `/api/health/readiness` can still report
`status: "ok"` because readiness checks the database required to serve requests.

## Current continuation checkpoint (2026-09-01)

```text
Status: in progress — local runtime resolver repaired and ready for visual review
Last completed: Activated the tracked 188-surface smart-v9 candidate for exact
  runtime matches, preserved the reviewed PSD-derived T-shirt front/back bases,
  and kept ambiguous Hoodie/Long Sleeve catalog shades on their reviewed
  color-specific source-matrix assets instead of mapping them to the wrong hue.
Stopped at: After a clean workflow restart and direct proxied asset checks.
Files/areas changed: Design Studio mockup resolver and the two related source
  matrix test files.
Remaining work: Perform a real browser visual review of the Customize/Design
  Studio flow and, if required, regenerate a product-color-aligned v9 candidate
  for the currently unmatched Hoodie/Long Sleeve shades before production
  promotion.
Blocker: The artifact preview registry cannot resolve this checkout for a
  screenshot; direct proxy checks are available and passing.
Next safe action: Review the Customize route with the 188 staged assets, then
  approve or regenerate only the unmatched product-color surfaces.
Verification: Storefront tests 22 files/76 tests passed; storefront typecheck,
  full workspace typecheck, production build, workflow restart, git diff check,
  and representative v9/source-matrix/PSD asset requests passed. Screenshot
  capture was unavailable because the artifact was not found in the registry.
```

## Current handoff (2026-09-02)

Status: ready for review — the shared admin shell, Products workspace, and
Settings workspace have been redesigned in place; Smart Object production
promotion remains fail-closed.
Last completed: Applied the approved operator-console redesign while preserving
the existing admin shell routes and settings/product fields. Added responsive
navigation and accessibility affordances, catalogue KPIs and filters, clearer
product create/edit/delete feedback, gallery and cloud-image handling,
structured variants, color availability, CSV import, AI descriptions, duplicate
slug protection, grouped settings navigation, dirty/saving/saved states, and a
sticky settings save action. Reconciled the product API so color availability
round-trips, sale prices can be cleared, and duplicate slugs return a useful
conflict response.
Stopped at: After a clean API/storefront typecheck and production build,
focused API tests, managed workflow restart, public proxied smoke checks, and
preservation checks confirming no existing admin route or registered form field
was removed. A fresh browser screenshot could not be captured because this
checkout is absent from the artifact registry and the browser-use CLI is
unavailable.
Files/areas changed: `artifacts/trynex-storefront/src/components/layout/AdminLayout.tsx`,
`artifacts/trynex-storefront/src/pages/admin/AdminProducts.tsx`,
`artifacts/trynex-storefront/src/pages/admin/AdminSettings.tsx`,
`artifacts/trynex-storefront/src/index.css`, and
`artifacts/api-server/src/routes/products.ts`.
Remaining work: Extend the same approved interaction language to the remaining
admin screens if the owner wants the full panel rewritten; perform controlled
browser/runtime visual comparison and explicit visual acceptance for all 188
Smart Object surfaces before promoting any runtime derivatives or manifest
data. Authenticated admin-health success is not claimed without a safe existing
session or in-process credential path.
Blocker: Artifact screenshot registry and browser-use are unavailable in this
checkout. Upstash Redis is degraded because the environment rejects its
credentials, while the documented fallback is healthy. Replit's dependency
scanner fails with `OSV_SCAN_FAILED` because its `osv` executable is absent;
the local `pnpm audit` is clean and the lockfile contains no upstream
`image-size` package.
Next safe action: Review the redesigned Products and Settings screens with a
real authenticated browser session, then continue the remaining admin-screen
redesign only as an explicitly approved follow-up. Keep
`masterStatus: manifest-only` / `structurally-verified` until Smart Object
visual/runtime evidence is complete.
Verification: Smart Object release gate 188/188 passed; PSD reopen audit
188/188 passed at 1024x1024 8-bit with one non-empty embedded Smart Object and
composite per file; canonical matrix 188/188 passed; contact sheets reviewed;
focused API tests 6 files/26 tests passed; storefront and API typechecks passed;
storefront production build passed; workflow restart, healthz, products,
categories, settings, and unauthenticated admin 401 checks passed; git diff
check passed. The redesigned admin screens retain all previously registered
product/settings fields and all current admin menu routes. The artifact
registry could not capture a fresh screenshot.

## Latest admin continuation checkpoint (2026-09-02)

```text
Status: ready for review — focused admin operations hardening is complete
Last completed: Extended the existing admin interaction language to Categories,
  Reviews, Promo Codes, and Newsletter without changing their API contracts.
  Added searchable category filtering and catalogue KPIs, review queue KPIs and
  rating summary, promo-code validation/error recovery and operational KPIs, and
  newsletter refresh/error states plus formula-injection-safe CSV export.
Stopped at: After a clean full typecheck, storefront production build, API test
  run, Smart Object matrix validation, managed workflow restart, and proxied
  public/protected smoke checks.
Files/areas changed: `artifacts/trynex-storefront/src/pages/admin/AdminCategories.tsx`,
  `AdminReviews.tsx`, `AdminPromoCodes.tsx`, and `AdminNewsletter.tsx`.
Remaining work: Review these screens with a real authenticated browser session;
  continue the same treatment on lower-priority operational screens only if the
  owner wants the full panel standardized. Smart Object production promotion is
  still blocked on controlled visual/runtime acceptance of all 188 surfaces.
Blocker: The artifact registry cannot resolve this checkout for screenshots, so
  visual acceptance is unavailable here. Replit deployment is not yet published
  and requires the owner to use the Publish action.
Next safe action: Push the verified source to GitHub main, then publish this
  project from Replit after reviewing the authenticated admin and staged mockups.
Verification: Full workspace typecheck passed; storefront typecheck and
  production build passed; API tests 6 files/26 tests passed; Smart Object
  canonical matrix and 188/188 candidate validation passed; workflow restarted
  cleanly; healthz/products/categories/settings returned 200; unauthenticated
  admin checks returned 401; git diff --check passed. The proxied
  `/api/admin/orders` probe was not used as evidence because that path is not
  registered; no source change was made for it.
```

## Latest admin operations checkpoint (2026-09-02)

```text
Status: ready for review — focused admin operations hardening is complete
Last completed: Reconciled the unfinished order mutation loading state and
  date-aware cache updates, then standardized retryable load errors, visible
  pending states, accessible labels, and explicit destructive confirmations
  across orders, activity logs, backup/schema repair, deployment/system actions,
  Facebook import/guide, hampers, mockups, referrals, roles, SEO, and security.
  Existing routes, API contracts, permissions, registered fields, and Smart
  Object fail-closed behavior were preserved.
Stopped at: After the final storefront typecheck, workflow restart, and runtime
  smoke verification; production promotion and publishing were not attempted.
Files/areas changed: `artifacts/trynex-storefront/src/pages/admin/` files
  `AdminActivityLog.tsx`, `AdminBackup.tsx`, `AdminDeployment.tsx`,
  `AdminFacebookGuide.tsx`, `AdminFacebookImport.tsx`, `AdminHampers.tsx`,
  `AdminMockups.tsx`, `AdminOrders.tsx`, `AdminReferrals.tsx`, `AdminRoles.tsx`,
  `AdminSEO.tsx`, and `AdminSecurity.tsx`.
Remaining work: Review the changed admin screens with a real authenticated
  browser session. Lower-priority screens such as AI Developer, Designer, Page
  Builder, Database Cluster, Tech Stack, Secrets, Customers, and Login still
  need a dedicated visual pass if the owner wants every admin route to share
  the same interaction language. Smart Object production promotion still
  requires controlled visual/runtime acceptance of all 188 surfaces.
Blocker: This checkout is absent from the artifact preview registry and the
  browser-use CLI is unavailable, so authenticated visual acceptance cannot be
  claimed. Local Redis credentials remain rejected; the documented fallback is
  operating. The dependency scanner still lacks its `osv` executable.
Next safe action: Review the authenticated admin routes and staged Smart Object
  surfaces, then either approve this batch for delivery or scope the remaining
  lower-priority admin screens as a separate pass. Keep staged mockups
  `manifest-only` / `structurally-verified` until visual/runtime evidence is
  complete.
Verification: Full workspace typecheck passed; storefront production build
  passed; API tests (6 files/26 tests) passed; storefront tests (22 files/76
  tests) passed; Smart Object matrix and 188/188 candidate validators passed;
  the managed workflow restarted cleanly; proxied health, products, and
  settings checks returned 200; `git diff --check` passed. The untracked
  credential-bearing attached note remains excluded from release changes.
```

## Latest local studio reliability pass (2026-09-01)

```text
Status: complete — external rollout is live; GitHub checks are still processing
Last completed: Hardened V2 draft recovery, deterministic in-browser image
  auto-fix, export/cart failure handling, original-asset preservation, active
  face geometry for generated layers, and product-zone-aware switching. Added
  undo/redo coverage for direct layer edits and product-aware history frames.
Stopped at: After pushing the verified source to GitHub main and confirming both
  public Pages and Render hosts return healthy application/API responses.
Files/areas changed: Design Studio V2 state/history and panels, product switcher,
  generated sticker/QR placement, and React type compatibility in sibling
  preview/design-system artifacts.
Remaining work: The six-family Smart Mockup implementation is now the active
  workstream. The revised spec requires representative proof masters,
  quarantined full-matrix generation, staged runtime comparison, and controlled
  production promotion.
Blocker: None for the approved studio reliability scope. Replit publishing is
  intentionally out of scope; local Redis credentials are degraded but the
  documented fallback is operating.
Next safe action: After the revised spec gate, implement and validate one
  representative real Smart Object master per family in staging before
  generating the complete 188-surface release.
Verification: Storefront typecheck and 76 tests passed; API typecheck passed;
  full workspace typecheck passed; storefront production build passed; the
  managed workflow restarted cleanly; local healthz/products/settings/robots/
  sitemap and invalid-order checks returned expected responses. The artifact
  registry and browser-use CLI were unavailable for a screenshot capture.
```

## Required status at every handoff

Every Agent must keep the following status fields current before ending a chat,
pausing work, or transferring the project.

### Active workstream — 4-Render main promotion

```text
Status: complete for the external production rollout
Last completed: Published the verified release to GitHub main through a clean
  history that excludes credential-bearing attachments. The active Render service
  auto-deployed commit ca1c202 and reached live status. Cloudflare Pages now
  routes the gateway to the primary Render service, whose health reports DB
  healthy, Redis healthy:primary, R2 storage, primary runtime, and scheduler on.
Stopped at: No runtime blocker remains for the approved CF Pages + Render +
  Upstash scope. Cloudflare's management API token returns Invalid API Token,
  but the Pages GitHub deployment and live gateway are functioning.
Files/areas changed: customer-facing URL references, API CORS defaults, Telegram
  summary URL, mobile production routing safeguards, operational audit scripts,
  docs/SOURCE_OF_TRUTH.md, API Redis/product caching and gateway budget handling,
  storefront homepage payload/image normalization, and this handoff. The attached
  credential-bearing text file and current evidence screenshots are excluded from
  the release history.
Remaining work: None for the external production rollout. The mockup master-layer
  decision remains paused as documented below.
Blocker: None for live storefront/API traffic. Do not copy credentials from
  attachments or re-add a retired domain.
Next safe action: Monitor the active Render service and Pages gateway. Replace
  only CLOUDFLARE_API_TOKEN through the secure Secrets UI before future Cloudflare
  API management, if needed.
Verification: See the latest external production verification below. Local app
  and API checks, typechecks, tests, workflow restart, and git diff --check passed.
  readiness, public stats, sitemap, and robots routes returned 200. Live headers
still show the older standby gateway because the latest local release has not
reached GitHub. Fresh local API checks and application build passed. A fresh
browser screenshot could not be captured because this checkout is absent from the
artifact preview registry and the browser-use CLI is unavailable.
```

### Active workstream — mockup master layer system

```text
Status: in progress — approved genuine Smart Object rebuild
Last completed: Direct binary audit of all 108 PSD/PSB masters in attached_assets/trynex-mockup-source-kit/psd using psd-tools 1.18.0. Findings written to MOCKUP_MASTER_AUDIT_2026-08-28.md and committed (8ee94e1). Re-runnable auditor added at tools/audit_psd_masters.py.
Stopped at: After the approved design was written. No new master or runtime asset has been released yet.
Files/areas changed: The audit and auditor remain the baseline; the approved specification is at `docs/superpowers/specs/2026-09-01-six-family-psd-smart-mockup-design.md`, and `AGENTS.md` now records the system inputs, outputs, and fail-closed rules.
Remaining work: Build and validate the 188 canonical surfaces, including genuine embedded Smart Objects, reviewed missing faces, runtime manifest integration, and browser/PSD composite comparisons.
Blocker: None for starting the implementation. The writer must prove a real Smart Object round trip; if a free writer cannot produce a document that `psd-tools` reopens as a Smart Object, stop and repair the writer path rather than shipping another raster kit.
Next safe action: Build one representative surface for each family, run the structural auditor, and review composites before expanding to all 188 surfaces.
Verification: 108/108 masters opened cleanly; all 1024x1024 8-bit RGB 4-channel; 6 layers each; 0 smart objects in all 108; artwork layer measured 0/1048576 non-zero alpha pixels; colour variants measured at luminance correlation ~0.0 against the white master; coverage arithmetic 188 needed vs 94 canonical present. Composite renders committed for visual confirmation.
```

## Mockup rebuild decision (approved — staged implementation)

The previous chat attempted to build a PSD/PSB smart-object system. The audit
proved no such system exists in the assets. The owner has now approved:

  Rebuild genuine Smart Object masters from the existing source photos,
  cutouts, masks, and geometry assets, while using the same manifest to drive
  the local realtime browser compositor. Build representatives first, quarantine
  the full matrix, and promote to production only after all written gates pass.

The approved approach retains these constraints:
  - 94 of 188 canonical surfaces have no master at all (see audit §3).
  - Water bottle is hash-pinned and single-colour; the kit's 14 extra bottle
     colours are non-canonical and must not ship.
  - smart-v9 gate requires 188 surfaces, each visually accepted with real
     provenance. Copying smart-v4 into smart-v9 cannot pass it.
  - No fallback is permitted: partial shipping blocks release, by contract.

## Latest audit checkpoint

- Confirmed strengths: settings-driven commerce, multi-surface product catalog,
  high-fidelity photo mockups, 2D/3D Design Studio, draft autosave, product
  switching with print-zone refit, API caching/rate limits/CSRF protection,
  dynamic sitemap, and mobile loading/error states.
- Highest-priority findings: icon-only navigation controls need accessible names;
  mobile sticky actions need a shared stacking context; image dimensions need
  reserved layout space; 25% advance payment needs to be visible beside buying
  actions; the Design Studio needs a clearer guided workflow and quality gate;
  mobile checkout keyboard handling needs verification; production security
  must never expose development reset/bypass behavior.
- Visual direction recommended for approval: a premium "Dhaka Color Spectrum"
  system—warm white and ink foundations with controlled orange, indigo, teal,
  Bangladesh green, and violet accents—using multicolor for product/category
  meaning and moments of delight, not as uncontrolled decoration.
- Audit evidence: `audit/live-trynexshop-home.png`,
  `audit/live-trynexshop-products.png`, and
  `audit/live-trynexshop-design-studio.png`.

## Latest local follow-up pass (2026-09-01)

```text
Status: complete — external production rollout verified
Last completed: Added the Design Studio first-use guide and print-quality gate,
published the verified source release to GitHub main using a clean history, and
confirmed the active Render service deployed commit ca1c202. Cloudflare Pages
now routes to the Render primary. Production health reports DB healthy, Redis
healthy:primary, R2 storage, primary runtime, and scheduler enabled.
Stopped at: No runtime blocker remains for the approved CF Pages + Render +
Upstash scope. Cloudflare's management API token returns Invalid API Token, but
the GitHub-connected Pages deployment and live gateway are functioning.
Files/areas changed: Design Studio quality workflow and guidance, homepage image
layout, mobile checkout spacing, API/gateway reliability, deployment routing,
and operational handoff. Credential-bearing attachments, screenshots, PDFs, and
cache output were excluded from the release.
Remaining work: None for external production. The mockup master-layer decision
remains paused as documented below. Rotate CLOUDFLARE_API_TOKEN only if future
automated Cloudflare API administration is needed.
Blocker: None for live storefront/API traffic. Replit publishing is intentionally
out of scope. Do not copy credentials from attachments or re-add a retired
domain.
Next safe action: Monitor the active Render service and Pages gateway. Replace
only CLOUDFLARE_API_TOKEN through the secure Secrets UI before future Cloudflare
API management, if needed.
Verification: GitHub main is ca1c202; Render deploy
dep-dab1mv68bjmc7380ovk0 is live on that commit. Both Pages and Render returned
200 for healthz, liveness, readiness, products, settings, robots.txt, and
sitemap.xml. Invalid POST /api/orders returned the expected 400 validation
response without creating an order. Pages health reported runtimeRole=primary,
redis_detail=healthy:primary, and schedulerEnabled=true. Storefront tests (21
files, 71 tests), API tests (5 files, 20 tests), typechecks, workflow restart,
browser logs, and git diff --check passed. The artifact registry could not
capture a screenshot of the external Pages deployment.
```

## Latest external production verification (2026-09-01)

The external production rollout is complete for the approved Cloudflare Pages +
Render + Upstash scope. GitHub `main` is `ca1c202`; Render deploy
`dep-dab1mv68bjmc7380ovk0` is live on that commit; and the active service is
`trynex-lifestyle-main-render`. Cloudflare Pages now routes the gateway to the
Render primary, whose health reports `runtimeRole=primary`,
`redis_detail=healthy:primary`, and `schedulerEnabled=true`.

Both `https://trynex-lifestyle-shop.pages.dev` and
`https://trynex-lifestyle-main-render.onrender.com` returned 200 for healthz,
liveness, readiness, products, settings, robots.txt, and sitemap.xml. Invalid
`POST /api/orders` returned the expected 400 validation response without creating
an order. The legacy Render service is suspended and is not routed.

The current Cloudflare management token returns `Invalid API Token`; this does
not affect the already-working GitHub-connected Pages deployment. Replit
publishing is intentionally out of scope for this project. The mockup
master-layer decision remains paused as documented below.

## Latest live health check (2026-08-29)

See `.agents/memory/live-health-check-2026-08-29.md` for evidence. Summary:
- `https://trynex-lifestyle-shop.pages.dev/` is ONLINE and current with `main`
  (a95903b). Homepage, products, Design Studio, robots.txt, 404/SPA routing OK.
- API reads healthy via standby origin: health OK, DB `db:true` (~60ms),
  `/api/products` returns 70 products, `/api/public-stats` 78 orders.
- **Primary API origin is SUSPENDED** (`trynex-api.onrender.com` → Render
  "Service Suspended"). Because the gateway never failovers mutations, checkout
  and all writes are currently broken; admin/system health also hits the
  suspended primary. Owner must restore/replace the primary Render service or
  repoint CF Pages `API_ORIGINS`.
- **`/sitemap.xml` is not in `SAFE_PUBLIC_PREFIXES`**, so it cannot fail over —
  Google currently receives a suspended page for the sitemap (SEO regression).
- **`trynexshop.com` DNS is parked at Namecheap** (NS =
  `ns1/ns2.lander.d.parity.domains`; A = parking IPs; site shows a Namecheap
  parking page). Custom domain no longer points to Cloudflare Pages.
- `trynex-shop-pages.dev` does not resolve — the real hostname is
  `trynex-lifestyle-shop.pages.dev`.
- CRITICAL_FINDINGS.md claims the proxy has no hardcoded Render fallback, but
  `functions/api/[[path]].ts` still sets `DEFAULT_ORIGIN = trynex-api.onrender.com`
  (and `_middleware.ts` line 272) — that stale claim caused this diagnosis to be
  missed.

## 4-Render main migration (2026-08-29 — gateway LIVE, promotion blocked on owner access)

Owner decision: the 4th Render service becomes the ACTUAL MAIN (sole write
authority); reads split round-robin across `trynex-api-standby-2` /
`trynex-api-standby-3`; Render 1 (`trynex-api`) is retired (still suspended).
Implemented and **merged** — PR #55 landed as `2985b5d`, all GitHub checks green
(CI build+typecheck+lint+audit, active-app verification, Cloudflare Pages build).

- `functions/gateway-config.ts` + rewritten `functions/api/[[path]].ts` (root AND
  artifacts copy, kept byte-identical): role-based multi-route gateway — writes/admin/AI
  → primary only; safe public reads → round-robin + failover + down-skip;
  `/sitemap.xml` is now a safe read (SEO fix); **no hardcoded Render origin
  anywhere**; fails closed with a truthful 503.
- `_middleware.ts`: stale `trynex-api.onrender.com` fallback removed.
- Gateway tests: 10/10 green — re-verified on 2026-08-29 in this sandbox by running
  `vitest run` against the copied `functions/api/gateway.test.ts` (deps installed with
  npm in a scratch dir, since the monorepo store is not provisioned here).
- `tools/render-orchestrate.sh`: Render API inventory/promote/deploy/verify.
- `.github/workflows/render-orchestrate.yml`: **could never be committed** — GitHub
  refuses workflow writes from the agent's App, so PR #55 shipped the script without
  its runner. The workflow body is now versioned at
  `tools/ci/render-orchestrate.workflow.yml` for the owner to paste into
  `.github/workflows/render-orchestrate.yml`.
- Docs: `docs/FOUR_RENDER_MULTI_ROUTE_CONTRACT_2026-08-29.md` now carries the full
  promotion runbook (Path A CI / Path B Render dashboard / Path C interim restore),
  the post-wiring verification checklist, and the rollback note.
- Known pre-existing noise: "Workers Builds: trynex-liestyle" fails on every PR
  (also #45/#54) — stale/typo'd CF Workers project, NOT the Pages deploy; ignore
  or clean up in CF dashboard.

### Live consequence of the unfinished promotion

Because `PRODUCTION_ORIGINS.primary` is empty and no `API_PRIMARY_ORIGIN` is set in
Cloudflare Pages, **every mutation is refused by design**: checkout/order placement,
admin login and settings, Spin & Win settlement, AI generation, and
`GET /api/admin/system/health` all answer `503 {"detail":"No primary API origin
configured"}`. Reads (`/api/products`, `/api/public-stats`, `/sitemap.xml`) work. This
is not a new outage — writes were already dead while `trynex-api` is suspended — but
the gateway now says so truthfully instead of leaking a dead host, and the fix is the
promotion, not a fallback.

Second consequence: both read origins are free-tier Render services, so a cold
visitor can still get a 503 while Render serves its "Application loading" spin-up
page (observed 2026-08-29 on `trynex-api-standby-2`). The gateway's 15 s down-skip
bounds it; a dedicated cold-start retry policy is an open idea, deliberately NOT
implemented without approval.

### Blocker (owner step, exactly one path required)

- **Path A** — add repo secret `RENDER_API_KEY`, then create
  `.github/workflows/render-orchestrate.yml` from
  `tools/ci/render-orchestrate.workflow.yml`. The agent then runs `apply=false`
  (inventory), confirms a 4th TryNex service actually exists and which workspace it is
  in, runs `apply=true` with an explicit `target`, and commits the returned primary URL.
- **Path B** — no CI and no key: the owner creates/copies the 4th Render service in the
  dashboard, sets `TRYNEX_RUNTIME_ROLE=primary`, `SCHEDULER_ENABLED=true`,
  `BACKUP_SYNC_ENABLED=false`, deploys `main`, and gives the agent the public URL to
  commit. Exactly one service may hold the primary role at a time.
- **Path C** — interim: restore `trynex-api` and set
  `API_PRIMARY_ORIGIN=https://trynex-api.onrender.com` in Cloudflare Pages to bring
  writes back while A or B completes; clear it immediately after the promotion.

Unverified premise that all three paths inherit: no session has ever completed a Render
API inventory, and the 2026-08-20 keys returned HTTP 400, so the existence and naming of
a 4th TryNex service is still an assumption until the inventory (Path A step 3) or the
owner (Path B) confirms it. A 4th service inside the **same** workspace also adds no new
5 GB bandwidth allowance — see `docs/RESOURCE_QUOTA_AUDIT_2026-08-20.md`.

## Completed handoff setup

The project now contains a mandatory Agent operating protocol in `AGENTS.md`,
with a pointer from `replit.md`. It requires first-reading the project context,
preserving existing work, planning before edits, updating related before/after
paths together, safely coordinating parallel work, verifying results, and
updating this handoff before completion.

The strong startup command is now prominently included in `AGENTS.md`,
`AGENT_HANDOFF.md`, and `replit.md`. Replit Agent automatically reads
`replit.md`, so the command is available in the original project and in
copies/Remixes that include the project README.

This protocol is file-based and will be included when the project is copied or
Remixed. A Remix still starts a new private Agent conversation; the original
chat itself is not transferred. The durable context that has been written into
these project files is what the next Agent can read.

## Approved plans and decisions

The project owner has approved this handoff protocol:

- Future Agents must read the project context first.
- The exact default instruction must be treated as the first operating request
  in every new or Remixed Agent chat.
- Every new chat must clearly report where work was left off and what remains
  before proposing or starting implementation.
- User instructions and newer explicit decisions remain authoritative.
- Existing work must be preserved and related before/after paths updated together.
- Plans must be submitted before implementation.
- Independent parallel work is allowed only with clear boundaries and a final
  reconciliation.
- A completion or pause/blocked handoff summary and updated handoff are required
  before closing.

## Best startup command for the next Agent

> **START HERE — do not edit anything yet.** Read `AGENTS.md`,
> `AGENT_HANDOFF.md`, and `replit.md` first. Then inspect the current project
> state and respond with these headings: **Completed**, **Last stopping point**,
> **Remaining work**, **Blockers**, **Plan**, **Existing behavior to preserve**,
> **Verification**, and **Safe parallel work**. Submit the plan before editing.
> Preserve all working features, update related before/after paths together,
> keep the handoff current while working, reconcile and verify parallel work,
> and finish with the exact **Status**, **Last completed**, **Stopped at**,
> **Files/areas changed**, **Remaining work**, **Blocker**, **Next safe action**,
> and **Verification** in `AGENT_HANDOFF.md`. If work stops early, provide the
> same handoff instead of leaving the next Agent to infer anything from chat.
