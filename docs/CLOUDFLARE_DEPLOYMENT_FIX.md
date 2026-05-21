# Cloudflare Deployment Fix

## Production Project

**Project name:** `trynex-lifestyle-shop`

---

## Correct Build Settings (Cloudflare Pages Dashboard)

| Setting | Value |
|---|---|
| **Build command** | `corepack enable && pnpm install --no-frozen-lockfile --config.verify-store-integrity=false --config.strict-store-pkg-content-check=false && pnpm --filter @workspace/trynex-storefront run build` |
| **Build output directory** | `artifacts/trynex-storefront/dist` |
| **Root directory** | `/` |

---

## Duplicate Worker Project — Action Required

The repo also triggers a Cloudflare Worker deploy for the **old/duplicate project `trynex-liestyle`** (note the typo in the name). This project runs:

```
npx wrangler versions upload
```

This command fails because there is no standalone Worker entry point at the repo root. This is a Pages project, not a Worker.

### Fix (choose one)

1. **Disable Git deployments** for `trynex-liestyle` in the Cloudflare dashboard → Workers & Pages → `trynex-liestyle` → Settings → Builds & deployments → Disable automatic deployments.
2. **Remove the deploy command** from `trynex-liestyle` so it no longer triggers on push.
3. **Delete the duplicate project** `trynex-liestyle` entirely if no production domains are attached to it.

> **Important:** Do NOT delete or disable `trynex-lifestyle-shop`. That is the correct production project.

---

## Production Domains

Both domains must be attached **only** to `trynex-lifestyle-shop`:

| Domain | Target |
|---|---|
| `trynexshop.com` | `trynex-lifestyle-shop.pages.dev` |
| `www.trynexshop.com` | Redirect → `https://trynexshop.com` |

Verify in Cloudflare dashboard → `trynex-lifestyle-shop` → Custom domains.

---

## Backend (Render)

The Render backend at `https://trynex-api.onrender.com` is separate and unaffected by these Cloudflare changes. The Cloudflare Pages Functions proxy (`functions/api/[[route]].js`) forwards all `/api/*` requests there via `TRYNEX_API_URL`.

---

## Root `wrangler.toml` Explanation

The root `wrangler.toml` is a **Pages-only** config file:

```toml
name = "trynex-lifestyle-shop"
compatibility_date = "2026-05-21"
pages_build_output_dir = "artifacts/trynex-storefront/dist"
```

It does **not** define a Worker `main` entry point, because this is a Pages deployment, not a standalone Worker deployment. The `wrangler versions upload` command from the duplicate `trynex-liestyle` project is invalid for this config.

The separate `artifacts/api-worker/wrangler.toml` defines the Hono-based API Worker (`trynex-api-worker`) and must only be deployed independently if needed.
