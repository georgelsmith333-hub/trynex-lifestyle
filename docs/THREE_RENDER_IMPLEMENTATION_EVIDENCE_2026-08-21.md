# TryNex Three-Render Implementation Evidence

**Branch:** `hardening/three-render-implementation-2026-08-21`  
**Commits:** `ef27b0b3`, `5abc1f4c`, `b51c855d` — implementation hardening, evidence, and Render API contract notes  
**Scope:** Render 2 additive standby created and verified; Render 1 preserved; Render 3 and public Cloudflare failover not configured.

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
| Render 2 creation and deployment | **VERIFIED** | Additive service `srv-da3lhbrbc2fs73aa5opg` is live at `https://trynex-api-standby-2.onrender.com` on the tested branch; no database resource was created. |
| Render 3 creation | **BLOCKED** | Same workspace/account access limitation; no third workspace credentials or visible session are available. |
| Live Neon role mapping | **PARTIALLY VERIFIED** | Four bindings are known from source, but live database identity, row counts, and transfer usage were not available through the current connectors. |
| Live Cloudflare API gateway deployment | **NOT DEPLOYED** | The gateway is committed locally only; production Pages still uses the old single-origin proxy. |
| Live failover tests | **BLOCKED** | Require three reachable Render origins and a deployed Pages gateway. |
| Live customer journey through Cloudflare | **BLOCKED** | Production Cloudflare still points to the suspended Render 1; public failover has not been deployed. Direct Render 2 health/catalog checks passed. |

## Required next action

Render 2 configuration and direct verification are complete. The next implementation action requiring external account access is Render 3 creation/configuration in a genuinely separate workspace. Public Cloudflare failover remains intentionally disabled until Render 3 is available and both standby origins have passed their independent gates. No new databases or production writers are part of the next step.

Render 2 is now live and verified. Readiness returned HTTP 200 with `db=true`, `runtimeRole=standby`, `schedulerEnabled=false`, and `backupSyncEnabled=false`. Liveness returned HTTP 200. `GET /api/products` returned HTTP 200 with 70 total products, page 1 of 6, 12 products per page, and a 6,073-byte response. `GET /api/mockups` returned HTTP 200 with an empty list, which is a catalog-data observation requiring later mockup-route verification rather than a resilience failure. A harmless `POST /api/orders` probe returned HTTP 503 with `standby_read_only`; no order was created. The first deployment failed only because the service was initially created without the required database environment. After the protected Render 1 application contract and standby overrides were applied, the targeted redeploy built successfully and the service reported live at `https://trynex-api-standby-2.onrender.com`.

## Render 2 provisioning update

The user supplied a second-workspace credential and explicitly authorized starting Render 2. The credential validated read-only against the Render API and identified the separate workspace `tea-d7n82jegvqtc73angelg` (`it's workspace`). Its inventory contained one unrelated service, `va-api`; that service was not modified. An additive service named `trynex-api-standby-2` was created in the second workspace from the tested branch `hardening/three-render-implementation-2026-08-21`, using the Free plan, Oregon region, one instance, and `/api/health/readiness` as the health path. The service ID is `srv-da3lhbrbc2fs73aa5opg`, deployment ID `dep-da3lhc3bc2fs73aa5plg`, and public URL is `https://trynex-api-standby-2.onrender.com`.

The new service currently has an empty environment-variable inventory, so it is not yet a verified usable standby. Applying environment variables safely requires the Render 1 production variable contract and secret values through protected access; no secret has been guessed, copied into source control, or written to logs. The Render 1 environment page was later loaded successfully in the authenticated browser. It confirmed the workspace is suspended after the 5 GB free-bandwidth allowance was exhausted and exposed the environment-variable editor with masked values. Visible non-secret keys include `ADMIN_JWT_SECRET`, `ADMIN_PASSWORD`, `ADMIN_SECRET_PASSWORD`, `ALLOW_DB_SCHEMA_REPAIR`, `ALLOWED_ORIGINS`, `API_BASE_URL`, `API_PUBLIC_URL`, `API_URL`, `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_KEYS_TOKEN`, `CORS_ORIGIN`, `DATABASE_ANALYTICS`, and `DATABASE_FAILOVER`. The values remained masked and were not copied. The environment export menu was opened, but the browser download history did not show a downloaded `.env` file; therefore no Render 1 secret file was obtained or transferred. A later return to the same page again produced a blank browser view after the initial page navigation, so the protected export route is unreliable in this session. A controlled DOM check confirmed the environment table was present, but the `Download .env` submenu item was not open; no secret value was read or accessed. A same-session read-only fetch to Render’s environment API returned HTTP 401 with zero keys, confirming that the dashboard session does not provide an API credential usable for protected environment transfer. A controlled page-side export was then triggered without reading the file contents, and the browser download history confirmed `trynex-api.env` was downloaded. The file was handled only as a protected temporary secret source, then removed after the Render 2 update; it was not committed, logged, or attached.
