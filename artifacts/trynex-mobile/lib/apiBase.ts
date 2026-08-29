/**
 * Single source of truth for the mobile API base URL.
 *
 * The API is only reachable through the Cloudflare Pages gateway, which applies the
 * 4-Render role routing (writes/admin/AI → primary; safe public reads → read
 * standbys). A client must never be pointed at a Render host directly: that is how
 * the "suspended service" outage became invisible, and a standby answers mutations
 * with `standby_read_only` anyway. See
 * `docs/FOUR_RENDER_MULTI_ROUTE_CONTRACT_2026-08-29.md`.
 *
 * Before: `lib/api.ts` fell back to the live Pages origin while `app/_layout.tsx`
 * fell back to `trynexshop.com` — and that domain has been parked at the registrar
 * since 2026-08-29, so the two clients disagreed and one of them was broken.
 * After: both resolve through this module. When the custom domain is re-pointed at
 * Cloudflare Pages and verified, change `PRODUCTION_ORIGIN` here and nowhere else.
 */

/** Canonical public origin (Cloudflare Pages: static app + /api gateway). */
export const PRODUCTION_ORIGIN = "https://trynex-lifestyle-shop.pages.dev";

/** Hosts that must never win, even when stale config/env still names them. */
const RETIRED_HOSTS = new Set([
  "trynex-api.onrender.com", // Render 1 — suspended, retired from routing
  "trynex-api-standby-2.onrender.com", // read-only standby; rejects writes
  "trynex-api-standby-3.onrender.com", // read-only standby; rejects writes
  "trynexshop.com", // parked at the registrar as of 2026-08-29
  "www.trynexshop.com",
]);

/**
 * Resolve the API base URL. Precedence:
 *   1. an explicit, non-retired `EXPO_PUBLIC_DOMAIN` (dev tunnels / preview deploys)
 *   2. the canonical Pages origin
 * An empty, missing, retired, or already-pages value all land on the Pages origin.
 */
export function resolveApiBaseUrl(envDomain?: string): string {
  const raw = (envDomain ?? process.env.EXPO_PUBLIC_DOMAIN ?? "").trim();
  if (!raw) return PRODUCTION_ORIGIN;
  const host = raw
    .replace(/^https?:\/\//i, "")
    .replace(/\/+$/, "")
    .toLowerCase();
  if (!host || RETIRED_HOSTS.has(host) || host === PRODUCTION_ORIGIN.replace(/^https:\/\//, "")) {
    return PRODUCTION_ORIGIN;
  }
  return `https://${host}`;
}
