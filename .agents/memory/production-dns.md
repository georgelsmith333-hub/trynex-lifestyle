---
name: TryNex production DNS setup
description: How trynexshop.com DNS is configured and what the correct production setup is
---

**Current (broken) setup:**
`trynexshop.com` CNAME → `trynex-lifestyle-shop.pages.dev` (Cloudflare Pages, proxied=true)

CF Pages serves the static frontend. All `/api/*` calls hit CF Pages which returns HTML (the SPA index.html), not JSON. This breaks admin login, checkout, and all dynamic features.

**Why it's broken:** CF Pages doesn't have an API. The frontend's `VITE_API_BASE_URL=""` means same-origin API calls — but "same origin" is CF Pages, not the Replit API server.

**Correct permanent setup:**
1. Deploy to Replit Autoscale (both storefront + API server are registered in `artifact.toml`)
2. Update Cloudflare DNS CNAME for `trynexshop.com` from `trynex-lifestyle-shop.pages.dev` to the Replit Autoscale URL: `trynex-businesvs-dev-5-june-d-junelajunelaest--braintrackitsol.replit.app`
3. Set `proxied=true` (orange cloud) — Replit Autoscale accepts custom domain proxying
4. Do the same for `www.trynexshop.com` (record id=39a84089ea4f48f36376b354f8e40243)
5. Update `ALLOWED_ORIGINS` env var for production: `https://trynexshop.com,https://www.trynexshop.com`

**Why dev domain doesn't work with CF DNS:**
CF sends `Host: trynexshop.com` to the backend. Replit dev containers route by subdomain (UUID), not by Host header, so the request isn't routed correctly. Only Autoscale (with registered custom domain) handles this correctly.

**CF Zone info:**
- Zone ID: `0c7e4e40e3bfc5bf0a74dd9f570df635`  
- Root CNAME record ID: `6f56919d55f5ae4a58d88a136a4c29bc`
- www CNAME record ID: `39a84089ea4f48f36376b354f8e40243`
- DNS token has DNS:Edit permission (NOT Pages:Edit)
