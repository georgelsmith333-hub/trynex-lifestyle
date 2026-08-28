# Production failover and A–Z test matrix

**Branch:** `arena/01a04968-trynex-lifestyle`  
**Date:** 2026-08-29

Checkout, payments, inventory, and failover claims use the evidence labels from `docs/CURRENT_PRODUCTION_TRUTH.md`. A green `vitest` run is **LOCALLY VERIFIED**, not production-verified.

| ID | Scenario | Expected | Evidence |
|---|---|---|---|
| A1 | Public `GET /api/products` | 70-product catalog from R2 (failover R3) | **VERIFIED** on live R2/R3/Pages before this branch. Gateway change **UNTESTED** on live Pages until this Function deploys. |
| A2 | Public `GET /api/categories` | Same catalog families | **VERIFIED** live Pages before this branch |
| A3 | Homepage offer cards | HTTP 200, products render | **VERIFIED** live Pages |
| A4 | HTML 200 from a cold Render splash | Gateway retries next origin | **LOCALLY VERIFIED** (`gateway.test.ts`) |
| A5 | R1 skipped on reads | No fetch to `trynex-api.onrender.com` | **LOCALLY VERIFIED**. Live Pages revision **UNTESTED** |
| A6 | R1 recovery reads | Only when `API_RECOVERY_ENABLED=true` | **LOCALLY VERIFIED**. Must stay unset in production |
| B1 | `POST /api/orders` origin | R2 only, never R3, never R1 | **LOCALLY VERIFIED**. Live still pinned to R1 until Pages deploys this Function |
| B2 | Writer 503 is not retried to R3 | Single write attempt | **LOCALLY VERIFIED** |
| B3 | Checkout 3× retry | Same `Idempotency-Key`; unique column prevents double order | **LOCALLY VERIFIED** (client source + helper tests). **UNTESTED** until API migration runs on R2 |
| B4 | R2 `standby` role | `503 standby_read_only` | **VERIFIED** live today. Writes stay blocked until dashboard `TRYNEX_RUNTIME_ROLE=promoted` on R2 **only** |
| B5 | R3 `dr` role | Mutations rejected | **VERIFIED** live |
| C1 | Scheduler on standby/DR | Does not start even if `SCHEDULER_ENABLED` is copied | **LOCALLY VERIFIED** |
| C2 | Backup sync | 409 / no-op unless writer + `BACKUP_SYNC_ENABLED===true` | **LOCALLY VERIFIED**. Flag must stay false |
| D1 | Account unread poll | 30s | **LOCALLY VERIFIED** |
| D2 | Track order poll | 30s | **LOCALLY VERIFIED** |
| D3 | Viewer heartbeat | 90s PUT | **LOCALLY VERIFIED** |
| E1 | Correlation id | `X-Correlation-Id` on gateway + API | **LOCALLY VERIFIED** gateway; API **UNTESTED** live |
| F1 | Place order (bKash 25%) | One order, one stock decrement, payment gateway step | **UNTESTED** — blocked until R2 is promoted **and** Pages Function is this commit |
| F2 | Track order | Existing track contract | **UNTESTED** against R2 writer |
| F3 | Admin order list | Sees the new order | **UNTESTED** |
| F4 | Design Studio v9 | Photoreal mockups, bottle hashes unchanged | **PARTIAL** this branch; live Pages still `main` |
| G1 | Promote R3 because R2 503 | Must **not** happen | Policy in gateway (writes never fail over). **UNTESTED** live |
| G2 | Auto-resume R1 on quota reset | Must **not** happen | Gateway ignores R1 unless explicit flags. Operator must not resume |

## Operator sequence (not automatic)

1. Deploy this API commit to **existing** R2 and R3 (same commit, different roles). Do not create services.
2. Confirm R2/R3 `GET /api/healthz` and `GET /api/products?limit=2` still return the 70-product catalog.
3. Set **R2 only** `TRYNEX_RUNTIME_ROLE=promoted`. Leave R3 `dr`. Leave `BACKUP_SYNC_ENABLED` unset/false.
4. Deploy this Pages Function. Confirm `X-TryNex-Origin: trynex-api-standby-2.onrender.com` on a test `POST` (or a harmless OPTIONS/health through the Function).
5. Place **one** real or staff checkout. Confirm a single `orders` row and no R3 write logs.
6. Only then call F1–F3 **production verified**.
