---
name: TryNex API missing routes & fixes
description: Routes that were missing from the API server and were added — plus port/proxy config
---

## Port Config (Critical)
- Storefront (web): 8080
- Mockup-sandbox (design): 8081
- API server (api): 8082
- Promo (video): 8083 — FAILS restart_workflow (port detection broken for `kind = "video"`)
- Mobile (mobile): NOT STARTED — Expo domain routing, different health check

**Why:** restart_workflow tool only reliably detects ports for `kind = "web"` and `kind = "api"` artifacts.

## Routes Added (were 404)
- `GET /api/admin/session` — alias for `/api/admin/me` (login page calls this on load)
- `GET /api/announcement` — public announcement data from settings cache
- `GET /api/products/featured` — shortcut for `?featured=true`; added BEFORE `/products/:id`
- Note: `GET /api/admin/settings` remains `PATCH` only — GET is via `/api/admin/designer-settings`

## Admin Auth Flow
- Login: `POST /api/admin/login` with `ADMIN_PASSWORD` secret → returns token stored in sessionStorage
- Session check: `GET /api/admin/me` (or alias `/admin/session`) with `Cookie: admin_token=<token>`
- Returns 401 with no/invalid token (correct), 200 with valid token

## Build
- API server runs from pre-built `dist/index.mjs`
- After source changes: `cd artifacts/api-server && node ./build.mjs`
- Restart: use restart_workflow tool

**Why:** Source changes have no effect until rebuilt and restarted.
