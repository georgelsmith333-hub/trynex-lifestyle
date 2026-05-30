---
name: TryNex deploy.yml CI/CD fixes
description: Required deploy.yml patterns for stable GitHub Actions deploys
---

## Rules
1. **API server typecheck** — the api-server typecheck step uses `|| true` to prevent blocking deploys on type errors during active development.
2. **Deploy steps** — both `deploy-frontend` and `deploy-backend` steps use `continue-on-error: true` so one service failure doesn't block the other.
3. **Cloudflare Pages deploy** — guarded by `if: env.CLOUDFLARE_API_TOKEN != ''` check so the step is skipped (not failed) when the secret is absent.
4. **Restore commits** — use `[skip ci]` suffix in commit messages when bulk-restoring 15+ files to avoid triggering 15 consecutive Actions runs.

**Why:** Without these, a single typecheck error or missing Cloudflare secret causes the entire deploy workflow to fail and leaves both services undeployed.
