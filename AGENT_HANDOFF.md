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

The TryNex Design Studio audit is in progress. The public `/design-studio` route
is V1; `/design-studio-v1` is its compatibility alias and `/design-studio-v2`
remains an explicit comparison/rollback route. The source-kit/runtime mockup
audit now validates the editable manifest as well as public assets.

## Required status at every handoff

Every Agent must keep the following status fields current before ending a chat,
pausing work, or transferring the project.

### Active workstream — 4-Render main promotion

```text
Status: in progress — agent work complete to the access boundary; PR #57 ready (checks
  green); owner needs 2 GitHub UI steps before the agent can create/promote the 4th Render
Last completed: Confirmed PR #55 is merged (main = 2985b5d) and re-derived the live
  truth: safe reads + /sitemap.xml are 200 through the gateway; every write/admin/auth
  route answers the designed fail-closed 503 "No primary API origin configured",
  because PRODUCTION_ORIGINS.primary is still empty and API_PRIMARY_ORIGIN is not set
  in Cloudflare Pages. Restored the missing orchestrator workflow body at
  tools/ci/render-orchestrate.workflow.yml, rewrote the promotion runbook
  (docs/FOUR_RENDER_MULTI_ROUTE_CONTRACT_2026-08-29.md) with three owner paths, and
  re-annotated both gateway-config copies. Gateway tests re-run locally: 10/10 green.
Stopped at: Promotion itself. The agent sandbox can only reach api.github.com
  (api.render.com, *.onrender.com and Cloudflare are TLS-blocked), and the agent's
  GitHub App is refused on .github/workflows/** (git push and Contents API both 403),
  so no CI run can be created until the workflow file exists.
Files/areas changed: tools/render-orchestrate.sh (create/promote/verify/selftest modes +
  single-writer guard), tools/ci/render-orchestrate.workflow.yml (mode inputs, selftest gate),
  docs/FOUR_RENDER_MULTI_ROUTE_CONTRACT_2026-08-29.md (runbook + mode table),
  functions/gateway-config.ts and artifacts/trynex-storefront/functions/gateway-config.ts
  (comments only, still byte-identical), render.yaml (warning header only — it is NOT the live
  contract and its Render Postgres must never be provisioned),
  artifacts/trynex-mobile/lib/apiBase.ts (new) + lib/api.ts + app/_layout.tsx + .env.production
  (mobile API base now has ONE resolver that can no longer land on the parked trynexshop.com
  or a retired Render host), .agents/memory/render-4-main-migration.md, AGENT_HANDOFF.md.
  No gateway routing behavior was changed.
Remaining work: Path A/B/C in the contract doc — one of them must complete before the
  primary URL can be committed; then commit primary into both config copies, PR, merge,
  run the verification checklist.
Blocker: Owner action needed — (A) add repo secret RENDER_API_KEY **and** create
  .github/workflows/render-orchestrate.yml from tools/ci/render-orchestrate.workflow.yml.
  Those two steps are the ENTIRE remaining ask for path A: the orchestrator now has a
  `create` mode, so the agent itself can create the 4th service, deploy it as primary,
  probe it and commit the URL. Or (B) owner configures the 4th service in the Render
  dashboard and hands the agent its public URL, or (C) interim API_PRIMARY_ORIGIN in
  Cloudflare Pages pointing at a restored trynex-api to bring writes back today.
  Unverified premise for A/B: that a 4th TryNex Render service exists at all — no prior
  session ever completed a Render API inventory (the supplied keys returned HTTP 400 on
  2026-08-20; only a second-workspace key validated on 2026-08-21).
Next safe action: Owner picks A, B or C (see the contract doc). Nothing further can be
  promoted without one of those three. Do NOT invent a primary URL and do NOT re-add a
  hardcoded Render host to "fix" the 503 — the fail-closed answer is the safety net.
  Owner approved and PR #56 (workflow body + runbook) was MERGED as 7d9cb2a.
Verification: Offline orchestrator selftest 18/18 passing (`bash tools/render-orchestrate.sh
  selftest`) — payload contract, PORT drop, role forcing, no-duplicate keys, both nested and
  flat shapes, secret-value masking, secret-file detection, role parsing. Mobile resolver
  unit-checked offline (esbuild transpile + 17 assertions). PR #57 CI: build-and-check,
  security-scan, active-app verification and the Cloudflare Pages build all PASS (only the
  stale `Workers Builds: trynex-liestyle` project fails, as on every PR since #45).
  Live probes via the web fetcher on 2026-08-29:
  GET /sitemap.xml -> 200 (SEO fix live); GET /api/admin/system/health -> 503
  "No primary API origin configured" (fail-closed, as designed);
  GET /api/health/liveness -> 503 while standby-2 serves Render's cold-start page
  (free-tier spin-up, not a code defect); trynex-api-standby-3 also returned 503.
  Sandbox egress test: api.github.com 200; api.render.com / render.com / cloudflare.com
  blocked. git push of a workflow file rejected with "refusing to allow a GitHub App to
  create or update workflow ... without `workflows` permission"; gh Contents API 403.
```

### Paused workstream — mockup master layer system

```text
Status: blocked — design decision required (mockup master layer system)
Last completed: Direct binary audit of all 108 PSD/PSB masters in attached_assets/trynex-mockup-source-kit/psd using psd-tools 1.18.0. Findings written to MOCKUP_MASTER_AUDIT_2026-08-28.md and committed (8ee94e1). Re-runnable auditor added at tools/audit_psd_masters.py.
Stopped at: After publishing the audit and pushing the session branch. No master has been rebuilt; no smart-v9 candidate exists.
Files/areas changed: MOCKUP_MASTER_AUDIT_2026-08-28.md (new), tools/audit_psd_masters.py (new), audit/psd-composites/*.png (6 renders), and this handoff. No product or runtime code was modified.
Remaining work: Decide the mockup layer strategy, then rebuild the 94 missing canonical surfaces. See "Mockup rebuild decision" below.
Blocker: There is no smart-object system to repair — none of the 108 masters contains a smart object, and the "Artwork — Place Design Here" layer is a fully transparent empty pixel layer. psd-tools can READ smart objects but cannot author them, and no Photoshop/GIMP/Inkscape binary exists in the shell. Building genuine smart-object masters therefore requires either an external Photoshop step by the owner or a deliberate move to a documented image+geometry pipeline.
Next safe action: Get the owner's decision on the three options in "Mockup rebuild decision" before writing any asset or runtime code. Meanwhile PR #45 (mobile Spin & Win) is complete, green, and awaiting merge authorization.
Verification: 108/108 masters opened cleanly; all 1024x1024 8-bit RGB 4-channel; 6 layers each; 0 smart objects in all 108; artwork layer measured 0/1048576 non-zero alpha pixels; colour variants measured at luminance correlation ~0.0 against the white master; coverage arithmetic 188 needed vs 94 canonical present. Composite renders committed for visual confirmation.
```

## Mockup rebuild decision (open — owner must choose)

The previous chat attempted to build a PSD/PSB smart-object system. The audit
proved no such system exists in the assets. Three honest paths forward:

  A. True smart-object masters — owner authors/commissions real layered PSD
     masters in Photoshop with live smart objects + displacement. Highest
     fidelity, slowest, needs work outside this sandbox.
  B. Image + geometry pipeline — abandon the PSD claim, ship verified flat
     renders plus a per-surface geometry model (print zone, warp mesh, shadow
     map) that the composer already partly supports. Achievable in-sandbox;
     must stop describing the system as "PSD/PSB smart object".
  C. Hybrid — keep PSDs as editable source-of-truth for the 94 that exist,
     generate the missing 94 as geometry-driven renders.

Blocked facts that constrain all three options:
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
- `tools/render-orchestrate.sh` gained a `create` mode (the owner asked the AGENT to create
  the 4th service), plus `promote`/`verify`/`selftest`, a single-live-writer guard, secret-file
  detection, value masking and `CREATE_SHAPE`/`CREATE_EXTRA_JSON` escape hatches. Because the
  sandbox egress allowlist blocks `api.render.com` (verified: only api.github.com/pypi pass;
  example.com and Cloudflare fail), this can only run on a GitHub runner.
- Mobile routing now resolves through `artifacts/trynex-mobile/lib/apiBase.ts`: `lib/api.ts` and
  `app/_layout.tsx` used to disagree (one fell back to the live Pages origin, the other to the
  now-parked `trynexshop.com`), so one mobile client was silently pointed at a parking page.
  `.env.production` no longer names the retired Render host. Share/website text still says
  `trynexshop.com` on purpose — fix the DNS instead of the copy (open item below).
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
