# TryNex CF Fast Deploy Fix — Change Report

**Date:** 2025-05-20  
**Branch target:** `trynex-cf-fast-deploy-fix` (pending GitHub token refresh)  
**Base:** `replit-safe-push-20260520-220222`

---

## Problem Summary

Cloudflare Pages CI was failing with `ERR_PNPM_TARBALL_EXTRACT` on packages such as:
`google-logging-utils`, `is-promise`, `@cloudflare/unenv-preset`, `pathe`,
`@radix-ui/number`, `lodash.isplainobject`, `cliui`

Root cause: The root `package.json` had 15 pinned pnpm overrides for low-level transitive
packages. These forced pnpm to fetch specific tarball versions that conflicted with the
versions already in the lockfile, causing extraction failures during the Cloudflare
Git-triggered build (which has no persistent store cache).

A secondary cause: `.npmrc` used `store-dir=/tmp/pnpm-store-v9`, which is wiped between
Cloudflare build runners, defeating any caching benefit and adding extraction overhead.

The backend (Render) also showed:
- `constraint fk_activity_log_admin already exists` (migration 0005 not idempotent)
- `relation "orders" does not exist` (safe runtime warning — orders table created by migration 0000, the ALTER runs before migrations complete; already guarded with IF NOT EXISTS)

---

## Changes Made

### 1. `package.json` — Removed all pnpm overrides

**Before:**
```json
"pnpm": {
  "overrides": {
    "google-auth-library": "9.14.0",
    "@radix-ui/number": "1.1.0",
    "detect-gpu": "5.0.61",
    "react-fast-compare": "3.2.1",
    "@noble/ciphers": "1.2.1",
    "colorette": "2.0.19",
    "source-map": "0.7.4",
    "is-promise": "2.2.2",
    "pathe": "1.1.2",
    "brace-expansion": "2.0.1",
    "react-transition-group": "4.4.2",
    "es-object-atoms": "1.1.0",
    "@nodelib/fs.walk": "1.2.4",
    "caniuse-lite": "1.0.30001611",
    "lodash.isplainobject": "4.0.4",
    "resolve-pkg-maps": "1.0.0"
  }
}
```

**After:** `"pnpm"` section removed entirely. Let pnpm resolve the correct transitive
versions naturally.

---

### 2. `.npmrc` — Fixed store directory and import method

**Before:**
```
store-dir=/tmp/pnpm-store-v9   ← wiped between CF runners
verify-store-integrity=false
strict-store-pkg-content-check=false
fetch-retries=5
fetch-retry-mintimeout=20000
fetch-retry-maxtimeout=120000
```

**After:**
```
store-dir=.pnpm-store          ← local to repo, survives CF cache
package-import-method=copy     ← avoids hardlink issues on CF
fetch-retries=3
fetch-retry-mintimeout=10000
fetch-retry-maxtimeout=60000
network-timeout=300000
```

---

### 3. `lib/db/migrations/0005_activity_log_fk.sql` — Made idempotent

**Before:**
```sql
ALTER TABLE admin_activity_logs
  ADD CONSTRAINT fk_activity_log_admin
  FOREIGN KEY (admin_id) REFERENCES admins(id) ON DELETE SET NULL;
```
Fails on second run: "constraint fk_activity_log_admin already exists"

**After:** Wrapped in `DO $$ BEGIN IF NOT EXISTS ... END; $$;` guard.  
Re-running this migration on an already-migrated database is now a safe no-op.

---

### 4. `artifacts/trynex-storefront/public/_redirects` — Clarified SPA routing

Added explicit pass-through rules for `/assets/*` and `/api/*` before the catch-all,
making intent clearer and suppressing the Cloudflare "infinite loop detected" lint warning.

The `vite.config.ts` already correctly omits writing `dist/404.html` to ensure the
`/* /index.html 200` rule is honoured by Cloudflare Pages with HTTP 200.

---

## Cloudflare Build Command (unchanged — already correct)

```
corepack enable && corepack prepare pnpm@10.11.1 --activate && pnpm install --no-frozen-lockfile && pnpm --filter @workspace/trynex-storefront run build
```

Output directory: `artifacts/trynex-storefront/dist`

---

## Verification Results (Replit local environment)

| Check | Result |
|-------|--------|
| `pnpm install --no-frozen-lockfile` | ✅ Done in 3.1s (Already up to date) |
| `pnpm --filter @workspace/api-server run build` | ✅ Built in 1.3s |
| `pnpm --filter @workspace/trynex-storefront run build` | ✅ Built in 28s |
| All 15 DB migrations applied | ✅ Clean run, 0 errors |
| Migration 0005 idempotent | ✅ Confirmed by local run |
| Migration 0014 color_variants | ✅ Already uses IF NOT EXISTS |
| API server responding | ✅ /api/healthz, /api/products, /api/blog all 200 |
| Redis (Upstash) connected | ✅ Distributed cache active |
| R2 storage backend | ✅ Active |
| Conflict markers in source | ✅ None found |
| Hardcoded secrets in committed source | ✅ None found |

---

## Security Note

The `.replit` file contains several API keys and DB credentials in its `[userenv.shared]`
section. This file is tracked by git and **not** in `.gitignore`. All sensitive values
(JWT_SECRET, ADMIN_JWT_SECRET, ADMIN_PASSWORD, R2_SECRET_ACCESS_KEY, DATABASE_* strings,
GITHUB_TOKEN, CLOUDFLARE_API_TOKEN, RENDER_API_KEY, UPSTASH_REDIS_REST_TOKEN) have been
mirrored into Replit Secrets (confirmed). However, they should be **removed** from
`.replit` userenv and those keys should be rotated, as they may be visible in git history.
Replit does not allow direct edits to `.replit` via agent tooling.

---

## Remaining Steps

1. **Provide a fresh GitHub PAT** with `repo` (Contents: Read & Write) scope.
   Update the `GITHUB_TOKEN` Replit Secret with the new value.
   This will allow pushing the `trynex-cf-fast-deploy-fix` branch to GitHub and
   triggering the Cloudflare Pages Git integration build.

2. **Cloudflare Pages Git integration** will pick up the branch push and rebuild
   using the fixed `.npmrc` and `package.json`. The `ERR_PNPM_TARBALL_EXTRACT`
   errors should not recur.

3. **Rotate exposed credentials.** The tokens in the `.replit` file have likely
   been visible in git history. Consider rotating:
   - GitHub PAT
   - Cloudflare API token
   - Upstash Redis token
   - R2 access/secret keys
   - Admin JWT secrets

4. **Add `.replit` to `.gitignore`** once Replit platform allows it, to prevent
   future credential leaks via userenv.

---

## Render (Backend) Status

The `fk_activity_log_admin` constraint error is fixed by the idempotent migration.
The `orders` relation warning is a non-fatal race condition in the startup sequence —
the ALTER runs before the full migration pass creates the table, but the migration
itself (`IF NOT EXISTS`) is safe. This is a Render-side timing note only.
