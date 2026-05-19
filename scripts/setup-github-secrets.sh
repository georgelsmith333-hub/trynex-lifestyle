#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# setup-github-secrets.sh
#
# Sets all required GitHub Actions secrets for the TryNex deployment pipeline.
# Run this ONCE after cloning/importing the repo.
#
# Requirements:
#   - GitHub CLI (gh) installed and authenticated: gh auth login
#   - GITHUB_PERSONAL_ACCESS_TOKEN env var set (or gh already logged in)
#   - All secret values set as local env vars before running this script
#
# Usage:
#   export CLOUDFLARE_ACCOUNT_ID=<your-cf-account-id>
#   export CLOUDFLARE_API_TOKEN=<your-cf-api-token>
#   export DATABASE_URL_MAIN="REDACTED_SECRET"
#   # ... set all vars below ...
#   bash scripts/setup-github-secrets.sh
# ─────────────────────────────────────────────────────────────────────────────

set -euo pipefail

REPO="$(gh repo view --json nameWithOwner -q .nameWithOwner 2>/dev/null || echo '')"
if [ -z "$REPO" ]; then
  echo "❌ Could not detect GitHub repo. Run: gh auth login"
  exit 1
fi

echo "🔐 Setting GitHub Actions secrets for: $REPO"
echo ""

set_secret() {
  local name="$1"
  local value="${!name:-}"
  if [ -z "$value" ]; then
    echo "⚠️  $name — NOT SET (skipping)"
    return
  fi
  echo -n "  $name ... "
  echo "$value" | gh secret set "$name" --repo "$REPO"
  echo "✅"
}

# ── Cloudflare ────────────────────────────────────────────────────────────────
set_secret CLOUDFLARE_API_TOKEN
set_secret CLOUDFLARE_ACCOUNT_ID

# ── Render ────────────────────────────────────────────────────────────────────
set_secret RENDER_DEPLOY_HOOK_URL    # Get from Render dashboard → Service → Settings → Deploy Hook

# ── Neon Databases ───────────────────────────────────────────────────────────
set_secret DATABASE_URL_MAIN         # Primary Neon connection string
set_secret DATABASE_URL_TRYNEX_DB   # Secondary Neon
set_secret DATABASE_FAILOVER        # Failover Neon

# ── Auth ─────────────────────────────────────────────────────────────────────
set_secret JWT_SECRET
set_secret ADMIN_JWT_SECRET
set_secret ADMIN_PASSWORD

# ── Cloudflare Worker secrets (pushed during deploy) ─────────────────────────
set_secret WORKER_DATABASE_URL      # Same as DATABASE_URL_MAIN for CF Worker

echo ""
echo "✅ Done. Verify at: https://github.com/$REPO/settings/secrets/actions"
echo ""
echo "ℹ️  Find CLOUDFLARE_ACCOUNT_ID in your Cloudflare dashboard → right sidebar"
echo "ℹ️  Get RENDER_DEPLOY_HOOK_URL from: Render dashboard → trynex-api → Settings → Deploy Hooks"
