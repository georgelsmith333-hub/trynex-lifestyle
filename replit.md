# TryNex Lifestyle — Replit Project

## Overview
Full-stack e-commerce platform for TryNex Lifestyle, a Bangladesh-based custom apparel and lifestyle brand. Features a 3D Design Studio for real-time product customisation.

## Tech Stack
- **Frontend:** React 19 + Vite 7 + TypeScript + Tailwind CSS v4 + Framer Motion + wouter
- **3D Engine:** Three.js + React Three Fiber + Drei
- **Backend:** Express 5 + TypeScript (Node 24)
- **Database:** PostgreSQL via Drizzle ORM (Replit PostgreSQL primary, Neon failovers)
- **Cache:** Upstash Redis REST (in-process Map fallback)
- **Storage:** Cloudflare R2 (S3-compatible)
- **Monorepo:** pnpm workspaces

## Project Structure
```
artifacts/
  trynex-storefront/   # React storefront + admin panel (port 5000)
  api-server/          # Express API (port 8080)
  api-worker/          # Cloudflare Worker alternative (Hono)
  mockup-sandbox/      # Isolated UI dev environment (port 8081)
lib/
  db/                  # Drizzle schema, migrations, multi-URL failover client
  api-spec/            # OpenAPI spec + generated types
  api-zod/             # Generated Zod validators
  api-client-react/    # TanStack Query hooks
scripts/               # Seed, PDF, CI helpers
```

## Running the App
The `Start application` workflow starts both services:
- API server: `PORT=8080 pnpm --filter @workspace/api-server run dev`
- Storefront: `PORT=5000 pnpm --filter @workspace/trynex-storefront run dev`

Vite proxies all `/api/*` requests to `localhost:8080`, so no CORS issues in development.

## Key Environment Variables
Set in Replit secrets (not env vars) for security:
- `JWT_SECRET` / `ADMIN_JWT_SECRET` — token signing
- `ADMIN_PASSWORD` / `ADMIN_SECRET_PASSWORD` — admin panel access
- `R2_ACCESS_KEY_ID` / `R2_SECRET_ACCESS_KEY` — Cloudflare R2 storage
- `DATABASE_URL_MAIN` / `DATABASE_URL_TRYNEX_DB` / `DATABASE_FAILOVER` — Neon DBs
- `UPSTASH_REDIS_REST_TOKEN` — Redis cache
- `CLOUDFLARE_API_TOKEN` / `RENDER_API_KEY` / `GITHUB_TOKEN` — deployment

## Database Strategy
- **Primary:** Replit PostgreSQL (DATABASE_URL — auto-provisioned)
- **Failover chain:** DATABASE_URL_MAIN → DATABASE_URL_TRYNEX_DB → DATABASE_FAILOVER
- All 12 migrations run automatically at startup via `runMigrations()`
- Never shard transactional data (orders/users/products all on primary)

## Admin Panel
Visit `/admin/login` — use the ADMIN_PASSWORD secret to log in.

## User Preferences
- Keep the pnpm monorepo structure intact
- Never expose secrets in code or env var files
- Use TypeScript strict mode throughout
- Follow existing file structure conventions
