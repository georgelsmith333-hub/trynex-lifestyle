---
name: DB backup sync engine
description: Full-mirror backup sync from Neon Main to Failover/Products/Analytics shards — gotchas with node-pg and schema drift
---

The backup sync (`artifacts/api-server/src/lib/dbBackupSync.ts`) copies every row from Neon Main into each configured backup/shard target on a schedule and on demand (`POST /api/admin/backup/sync-now`).

Two non-obvious issues hit when first building this:

1. **node-postgres does not auto-serialize JS objects for `json`/`jsonb` columns** when passed as query parameters — must `JSON.stringify()` them manually per-column based on `information_schema.columns.data_type`, or inserts fail with "invalid input syntax for type json".

2. **Schema drift**: Main can have columns (e.g. `orders.utm_source/utm_medium/utm_campaign`) that were added directly via SQL and were never added to the shared Drizzle schema file (`lib/db/src/schema/index.ts`). Targets provisioned via `drizzle-kit push` from that schema file will be missing those columns and inserts will fail with "column X does not exist".

**Why:** these targets are cold-standby mirrors provisioned independently of the app's schema file, so they can silently fall out of sync with real production structure, not just data.

**How to apply:** the sync engine self-heals column drift — before inserting into each table it diffs source vs. target columns and runs `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` for anything missing, using the source's `data_type`. This means schema drift never blocks a backup again, but it does NOT update the actual Drizzle schema file — if you notice healed columns in logs, also add them to `lib/db/src/schema/index.ts` so the drift doesn't keep silently growing.

Performance: batch inserts in groups of 100 rows via multi-row `VALUES (...), (...)` rather than row-by-row — row-by-row across ~600 rows × multiple remote Neon targets was slow enough to exceed a 120s script timeout.
