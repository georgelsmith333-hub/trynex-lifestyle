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

## Pending (blocked on one user action)
1. Add `RENDER_API_KEY` GitHub Actions secret.
2. Run workflow: dry-run, then apply=true → promotes 4th service, deploys, verifies.
3. Copy primary URL from job log into `functions/gateway-config.ts`, commit PR.

## Verify after promotion + deploy
- `POST /api/__probe` (no route) → 404 JSON from primary (proves write path live).
- `GET /api/admin/system/health` → 401 (proves admin reaches primary, not a dead page).
- `GET /api/health/liveness` → `runtimeRole:"primary"`.
- `GET /api/products` and `GET /api/sitemap.xml` → 200 (reads + SEO fixed).
