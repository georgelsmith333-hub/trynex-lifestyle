# TryNex Three-Render Implementation Evidence

**Branch:** `hardening/three-render-implementation-2026-08-21`  
**Commit:** `ef27b0b3` — `feat(reliability): harden three-render standby routing and resource ownership`  
**Scope:** Local, reversible implementation preparation. No Render 2/3 service has been created or configured.

## Verified locally

| Gate | Status | Evidence |
|---|---|---|
| Isolated source branch | **VERIFIED** | Branch created from verified `main`; working tree was clean after commit. |
| API TypeScript build | **VERIFIED** | `pnpm exec tsc -b lib/db artifacts/api-server --force` passed. |
| API production bundle | **VERIFIED** | `pnpm --filter @workspace/api-server build` passed; output `dist/index.mjs` generated. |
| API tests | **VERIFIED** | 4 test files, 14 tests passed, including runtime-role policy tests. |
| Storefront typecheck | **VERIFIED** | `pnpm --filter @workspace/trynex-storefront typecheck` passed. |
| Storefront production build | **VERIFIED** | Build passed; existing large-chunk warning and approximately 342 MiB service-worker precache remain. |
| Pages gateway typecheck | **VERIFIED** | Dedicated TypeScript gate passed against a minimal Pages runtime declaration. |
| Pages gateway behavior | **VERIFIED** | 3 regression tests passed: safe-read failover, mutation non-replay, and edge CORS preflight. |
| Standby write protection | **VERIFIED** | `standby` and `dr` roles reject POST/PUT/PATCH/DELETE; primary and explicitly promoted roles remain writable in the pure policy tests. |
| Full mirror protection | **VERIFIED LOCALLY** | Scheduled backup sync is disabled unless `BACKUP_SYNC_ENABLED=true`; manual sync returns a controlled conflict response while disabled. |
| Health role visibility | **VERIFIED IN SOURCE** | Health and readiness responses include non-secret runtime role and scheduler/backup flags. |

## Local changes in the commit

The API now has a runtime-role guard. Render 2 and Render 3 can be deployed with `TRYNEX_RUNTIME_ROLE=standby` or `dr` and will reject direct mutations even if a caller bypasses Cloudflare. Render 1 preserves primary behavior by default; explicit promotion uses `TRYNEX_RUNTIME_ROLE=promoted` and remains an operator-controlled action.

The in-process scheduler can be disabled with `SCHEDULER_ENABLED=false`, which is required on passive standby services. The legacy full-database mirror is disabled unless `BACKUP_SYNC_ENABLED=true`, preventing the known 30-minute four-target full-copy workload from silently multiplying across three services. The mirror has not yet been replaced by a measured incremental system; therefore the flag must remain false until that separate design is implemented and tested.

The Pages gateway accepts an ordered `API_ORIGINS` list, handles CORS preflight at the edge, fails over only allowlisted unauthenticated public reads after bounded retryable failures, adds short public cache headers and Cache API storage for safe GETs, and never replays mutations to secondary or tertiary origins.

## Blocked or not yet verified

| Gate | Status | Reason |
|---|---|---|
| Render 1 live recovery | **BLOCKED** | Current Render dashboard/browser session returned a blank page; the service remains known to be suspended from the prior audit. |
| Render 2 creation | **BLOCKED** | The second Render workspace is not currently observable in the authenticated session; supplied Render API credentials previously returned HTTP 400. |
| Render 3 creation | **BLOCKED** | Same workspace/account access limitation; no third workspace credentials or visible session are available. |
| Live Neon role mapping | **PARTIALLY VERIFIED** | Four bindings are known from source, but live database identity, row counts, and transfer usage were not available through the current connectors. |
| Live Cloudflare API gateway deployment | **NOT DEPLOYED** | The gateway is committed locally only; production Pages still uses the old single-origin proxy. |
| Live failover tests | **BLOCKED** | Require three reachable Render origins and a deployed Pages gateway. |
| Live customer journey | **BLOCKED** | Production API currently returns 503 while Render 1 is suspended. |

## Required next action

The next implementation action requiring external account access is to create/configure Render 2 and Render 3 in genuinely separate workspaces using the same tested commit and the environment contract. That action must not begin until the two additional workspaces are accessible in the authenticated session or valid account-level access is available. No new databases or production writers are part of the next step.
