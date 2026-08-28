# Current Production Truth — TryNex Lifestyle

**Recorded:** 2026-08-29 (Asia/Dhaka)  
**Repo HEAD when recorded:** `arena/01a04968-trynex-lifestyle` (recovery commits on this branch after `2f4e597`)  
**Live storefront/API deploy:** Cloudflare Pages + Render still served `main` `a95903b` at last check.

This document is the operator source of truth for **what is live**, **what this branch implements**, and **what remains blocked**. Compile success, localhost, and `healthz 200` are **not** production-ready.

Evidence labels used below:

| Label | Meaning |
|---|---|
| **VERIFIED** | Observed on a live URL or dashboard in this restoration |
| **LOCALLY VERIFIED** | Proven by repo tests or local inspection only |
| **PARTIAL** | Code or config exists; live proof is incomplete |
| **UNTESTED** | Not exercised end-to-end |
| **BLOCKED credentials** | Sandbox/provider TLS or missing dashboard access |
| **BLOCKED provider** | Quota, suspend, or vendor limit |

Secrets must stay in Render / Cloudflare / Neon dashboards. This file names variables only.

---

## 1. The three existing Render services (do not create a fourth)

| Slot | Service | Service ID | Public origin | Plan | Live role (healthz) | Status |
|---|---|---|---|---|---|---|
| R1 recovery | `trynex-api` | `srv-d7b774mdqaus73carp70` | `https://trynex-api.onrender.com` | Free / Hobby | n/a (suspended) | **VERIFIED** owner-suspended 2026-08-18 18:32 (Monthly Quota Exceeded). Keep config/history. Do **not** resume, delete, or auto-promote when quota resets. |
| R2 live writer (target) | `trynex-api-standby-2` | `srv-da3lhbrbc2fs73aa5opg` | `https://trynex-api-standby-2.onrender.com` | Free | `runtimeRole: standby` | **VERIFIED** Live, DB/Redis/R2 ok, catalog 70 products. Mutations currently `503 standby_read_only`. Deployed commit `a95903b`. |
| R3 standby / DR | `trynex-api-standby-3` | `srv-da3luurm8hqs73cbt460` | `https://trynex-api-standby-3.onrender.com` | Free | `runtimeRole: dr` | **VERIFIED** Live, same 70-product catalog. Mutations `503 standby_read_only`. Scheduler/backup off. |

No new Render web service, Neon project, R2 bucket, or queue is part of this architecture.

---

## 2. Approved runtime contract (this branch)

| Concern | R1 `trynex-api` | R2 `trynex-api-standby-2` | R3 `trynex-api-standby-3` |
|---|---|---|---|
| Purpose | Recovery only | **Canonical writer** after health + catalog + API verification | Production-ready **standby / DR** |
| `TRYNEX_RUNTIME_ROLE` | `primary` (unused until deliberate recovery) | `promoted` (or `primary`) **only after verification** | `dr` or `standby` |
| Mutations (orders, payments, inventory, refunds, admin writes, webhooks) | Off the live path | **Only writer** | Rejected (`standby_read_only`) |
| Scheduler / cron with side effects | Off | On **only** when role is `primary`/`promoted` and `SCHEDULER_ENABLED` is not `false` | Off (role-gated even if env is wrong) |
| `BACKUP_SYNC_ENABLED` | **false** | **false** | **false** |
| Cloudflare reads | Skipped unless `API_RECOVERY_ENABLED=true` | First | Failover second |
| Cloudflare writes | Never, unless operator sets `API_WRITE_ORIGIN` | **Pinned** | Never |

Promotion is **never** automatic on a failed health probe or on R1 quota reset.

---

## 3. What is live today vs what this branch changes

| Surface | Live (`main` `a95903b`) | This branch | Evidence |
|---|---|---|---|
| Public catalog | 70 products via Pages `/api/products` | Unchanged catalog contract | **VERIFIED** Pages + R2 + R3 returned the same first SKUs (Birthday Celebration Tee id 80, Tactical Military Grade Canteen id 79) |
| Homepage | 200, offer cards render | Unchanged | **VERIFIED** |
| Design Studio | Production still `main`; photoreal v9 is on this branch | Keep bottle hashes `19591c09…` / `f3214733…` | **PARTIAL** — v9 is in this branch, not proven on Pages `main` |
| Gateway reads | Skip R1; R2 then R3 | Same, plus HTML-200 treated as retryable, correlation ids | **LOCALLY VERIFIED** after tests; **UNTESTED** on live Pages until this commit is on Pages |
| Gateway writes | Pinned to **suspended R1** | Pinned to **R2 only**; never round-robin POST; R1 only via explicit `API_WRITE_ORIGIN` | Live writes **not production-verified**. Checkout against R1 is expected to 502/503 |
| R2 mutations | Rejected (`standby`) | Allowed only after dashboard `TRYNEX_RUNTIME_ROLE=promoted` | **BLOCKED provider** until operator env change. Sandbox TLS to `api.render.com` has been unreliable |
| Order idempotency | None. Checkout retries POST `/api/orders` 3× on 502/503/504 | `Idempotency-Key` + unique `orders.idempotency_key` | **LOCALLY VERIFIED** by tests; **UNTESTED** in production until API deploy + migration |
| 30‑min full Neon TRUNCATE mirror | Code present (`dbBackupSync.ts`, 4 targets) | Still disabled unless `BACKUP_SYNC_ENABLED===true` (must stay false) | Live R2/R3 `backupSyncEnabled: false` **VERIFIED**. Historical 5 GB Hobby burn **UNTESTED** (byte split not measured; Render API TLS blocked) |
| Duplicate schedulers | Scheduler off on R2/R3 (`SCHEDULER_ENABLED=false`) | Also role-gated so a mis-set env cannot start jobs on DR | Live flags **VERIFIED**; role gate **LOCALLY VERIFIED** |

---

## 4. Bandwidth / 5 GB Hobby cap

Leading **code** suspect remains the 30‑minute full-database TRUNCATE+INSERT mirror onto four Neon targets (`DATABASE_FAILOVER`, `DATABASE_URL_TRYNEX_DB`, `DATABASE_PRODUCTS`, `DATABASE_ANALYTICS`).

| Check | Result |
|---|---|
| Mirror running on live R2? | **VERIFIED no** (`backupSyncEnabled: false`) |
| Mirror running on live R3? | **VERIFIED no** |
| Admin `POST /admin/backup/sync-now` | Already 409 unless flag is true |
| Exact historical byte split that exhausted R1 | **UNTESTED** / **BLOCKED credentials** (Render metrics API) |
| Other chatty clients | Account unread 8s, account chat 5s, track 12s, viewer PUT 30s, navbar 30s, homepage stats 60s — reduced on this branch |

Do **not** set `BACKUP_SYNC_ENABLED=true`. Do **not** keep-alive ping standbys on a new cron without an explicit ask.

---

## 5. Operator actions this sandbox cannot finish

These are **dashboard** steps. They are not implied-done by a git push.

1. **R2 only:** set `TRYNEX_RUNTIME_ROLE=promoted` (or `primary`) **after** this API commit is actually running on `trynex-api-standby-2` (healthz must show the new role **and** `mutationsAllowed: true`). Until then, gateway writes to R2 will 503.
2. **R3:** leave `TRYNEX_RUNTIME_ROLE=dr` (or `standby`). Confirm `SCHEDULER_ENABLED=false`, `BACKUP_SYNC_ENABLED=false`.
3. **R1:** leave suspended. Do not resume. Do not point Cloudflare writes here. Optional later: `API_RECOVERY_ENABLED=true` on Pages **only** for a deliberate recovery window.
4. **Cloudflare Pages:** deploy this branch’s Function (`artifacts/trynex-storefront/functions/api/[[path]].ts`) so live `/api/*` pins writes to R2. Optional env: `API_WRITE_ORIGIN=https://trynex-api-standby-2.onrender.com`. Do not set `API_RECOVERY_ENABLED` by default.
5. **Neon:** no new project. Do not clone secrets into git. Additive `idempotency_key` migration runs on API boot (`006_add_order_idempotency_key.sql`).
6. **Rotate** any API tokens that were pasted into chat. Never commit them.

---

## 6. Failure policy

- Never round-robin `POST`/`PUT`/`PATCH`/`DELETE`.
- Never auto-promote R3 or R1 because R2 returned 503.
- If a write times out after the origin may have succeeded, replay **only** with the same `Idempotency-Key`.
- HTML `200` from a cold Render boot page is a **retryable read failure**, not a successful catalog payload.
- Do not treat `tsc`, `vitest`, or `healthz 200` as “checkout works”.
