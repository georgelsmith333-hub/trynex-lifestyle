---
name: Render 4 as primary + multi-route split (2026-08-29)
description: Owner-approved migration to a 4-Render topology — new 4th Render is the sole write primary; reads round-robin across standby-2/standby-3; Render 1 retired (suspended).
---

# Render 4 main migration

## Owner decision (2026-08-29)
- Use the 4th Render service as the **actual main** (sole write authority) from now.
- Split other workloads across the 4 Renders to reduce per-service usage / free-tier limits.
- "No more failing issues" — remove all hardcoded/dead origin fallbacks.

## What was implemented (branch `arena/01a04ad7-trynex-lifestyle`)
- `functions/gateway-config.ts` (root + artifacts copy): authoritative role map
  `PRODUCTION_ORIGINS` (reads = standby-2, standby-3; primary = filled post-promotion).
- `functions/api/[[path]].ts` (root + artifacts copy): role routing — writes/admin/AI →
  primary only; safe reads → round-robin across read origins with bounded failover +
  15s down-skip; OPTIONS at edge; fail-closed 503 with truthful detail; `/sitemap.xml`
  added to safe reads (SEO fix). No hardcoded Render origin anywhere.
- `artifacts/trynex-storefront/functions/_middleware.ts`: removed stale
  `trynex-api.onrender.com` fallback (serves plain SPA if API_URL unset).
- `artifacts/trynex-storefront/functions/api/gateway.test.ts`: 10 tests, all green.
- `.github/workflows/render-orchestrate.yml` + `tools/render-orchestrate.sh`:
  inventory / promote / deploy / verify via Render API. Needs repo secret
  `RENDER_API_KEY` (user must add it — never commit the key).
- `docs/FOUR_RENDER_MULTI_ROUTE_CONTRACT_2026-08-29.md`, handoff updated.

## Pending (2026-08-29 continuation, still blocked on owner access)
PR #55 is MERGED (main = 2985b5d) → the gateway is live and writes now fail CLOSED
with `503 {"detail":"No primary API origin configured"}` until a primary exists.
1. `tools/ci/render-orchestrate.workflow.yml` holds the workflow body (the App cannot
   push `.github/workflows/**`; the Contents API is refused too). Owner pastes it into
   `.github/workflows/render-orchestrate.yml` + adds repo secret `RENDER_API_KEY`.
2. Then: inventory (apply=false) → confirm a 4th TryNex service exists and its
   workspace → apply=true with an explicit `target` → copy the primary URL from the
   job summary into BOTH `functions/gateway-config.ts` copies → PR → merge.
3. Without the key, Path B (owner configures the service in the Render dashboard:
   `TRYNEX_RUNTIME_ROLE=primary`, `SCHEDULER_ENABLED=true`, `BACKUP_SYNC_ENABLED=false`)
   reaches the same end state; Path C (`API_PRIMARY_ORIGIN` env in CF Pages pointing at
   a restored `trynex-api`) is the interim unblock. Full runbook:
   `docs/FOUR_RENDER_MULTI_ROUTE_CONTRACT_2026-08-29.md`.
4. Never "fix" the 503 by re-adding a hardcoded Render host or by sending writes to a
   standby — both were deliberate removals.
5. Sandbox egress is api.github.com-only (curl to api.render.com / *.onrender.com /
   cloudflare.com fails at TLS) — use the web fetcher for live probes, CI for Render API.

## Verify after promotion + deploy
- `POST /api/__probe` (no route) → 404 JSON from primary (proves write path live).
- `GET /api/admin/system/health` → 401 (proves admin reaches primary, not a dead page).
- `GET /api/health/liveness` → `runtimeRole:"primary"`.
- `GET /api/products` and `GET /api/sitemap.xml` → 200 (reads + SEO fixed).
