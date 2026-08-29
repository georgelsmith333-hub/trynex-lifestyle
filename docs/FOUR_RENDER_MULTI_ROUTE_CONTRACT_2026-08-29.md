# TryNex 4-Render Multi-Route Contract

**Date:** 2026-08-29
**Status:** Code implemented and tested; primary URL is wired via
`functions/gateway-config.ts` after the Render orchestrator promotes the 4th service.

## Topology

| Slot | Render service | Role env | Workload | Notes |
|---|---|---|---|---|
| PRIMARY (new) | 4th Render service (discovered by `tools/render-orchestrate.sh`) | `TRYNEX_RUNTIME_ROLE=primary` | ALL mutations: checkout/orders, admin (login, settings, products), auth, AI generate, scheduler owner | Sole write authority; gateway NEVER replays mutations |
| READ-1 | `trynex-api-standby-2` | `standby` | Safe public reads: products, categories, mockups, public-stats, blog, testimonials, settings, health, sitemap.xml | Round-robin; server-side rejects writes (`standby_read_only`) |
| READ-2 | `trynex-api-standby-3` | `dr` | Same safe public reads | Round-robin; server-side rejects writes |
| RETIRED | `trynex-api` (Render 1) | old `primary` | — | Suspended by Render (5GB bandwidth allowance). NOT routed to. Re-add to reads ONLY after restored + re-roled standby + verified |

Legacy `trynex-api.onrender.com` is no longer referenced by any production code
or gateway default — see the fixed stale claims below.

## Gateway routing (`functions/api/[[path]].ts` + `functions/gateway-config.ts`)

- **Writes / admin / auth / AI** → PRIMARY only (first configured primary origin).
  No replay after ambiguous timeout; idempotency keys preserved.
- **Safe public reads** → READ origins in round-robin (load splitting), bounded
  failover on 502/503/504/network errors, 15s down-skip after 2 consecutive
  failures, primary is the LAST read candidate only if all reads fail.
- **OPTIONS** answered at the edge. Cookies stripped for anonymous safe reads;
  Authorization-bearing requests stay pinned to primary.
- **Fail closed:** if a role has no origin (config empty and no env override),
  the gateway returns 503 JSON with a truthful `detail` — never a hardcoded
  Render host.
- **Sitemap is a safe read** — `/api/sitemap.xml` no longer lands on a dead
  primary (fixes the SEO regression found 2026-08-29).

### Origin precedence

1. `API_PRIMARY_ORIGIN` / `API_READ_ORIGINS` (CF Pages env, optional overrides)
2. Committed `PRODUCTION_ORIGINS` in `functions/gateway-config.ts` (authoritative default)
3. Legacy `API_ORIGINS` (reads only — writes never fall back to it, because the
   legacy list historically contained the suspended service)

## Promoting the 4th service (one command)

1. Repo Settings → Secrets and variables → Actions → **New repository secret**
   `RENDER_API_KEY` = the Render API key (never commit it).
2. Actions → "Render orchestrator (4th main)" → Run workflow:
   - first run with **apply = false** for inventory (verify the 4th service is newest/healthy);
   - then run with **apply = true** — the tool copies env/secrets from
     `trynex-api` onto the 4th service, forces `TRYNEX_RUNTIME_ROLE=primary`,
     `SCHEDULER_ENABLED` (mirrors old primary), `BACKUP_SYNC_ENABLED=false`,
     triggers a deploy, waits, and probes readiness + sitemap.
3. Copy the `### RENDER_SUMMARY_JSON` primary URL from the job log into
   `functions/gateway-config.ts` → `PRODUCTION_ORIGINS.primary`, commit + PR.

The GitHub runner has full internet access; the sandbox cannot reach
`api.render.com`, which is why the tool runs in CI.

## Stale claims fixed on 2026-08-29

- `CRITICAL_FINDINGS.md` claimed the hardcoded Render fallback was removed.
  It was still present in `functions/api/[[path]].ts` (default origin) and
  `_middleware.ts` (line ~272). Both are now removed; the gateway fails closed.
- `docs/THREE_RENDER_*` is superseded by this contract.

## Safety invariants (unchanged from the three-render contract)

- Standby/DR services reject mutations server-side (`standby_read_only`).
- No mutation is ever replayed to a standby.
- Schedulers/backup sync stay disabled on standbys.
- No secrets in GitHub/source/this doc — only public URLs and env keys.
