# TryNex Lifestyle

Bangladesh e-commerce platform for premium custom apparel — T-shirts, Hoodies, Mugs, Caps. Features a Design Studio with AI generation, 3D mockup preview, background removal, and full admin panel.

## Run & Operate

```bash
# Start everything (frontend + API + DB)
bash start.sh          # or use the "Start application" workflow in Replit

# TypeScript check
cd artifacts/trynex-storefront && pnpm tsc --noEmit
cd artifacts/api-server && pnpm tsc --noEmit

# Push to GitHub (run after agent auto-commits)
bash push-to-github.sh
```

Required env vars: `DATABASE_URL` (PostgreSQL), `ADMIN_PASSWORD`, `GITHUB_PERSONAL_ACCESS_TOKEN`
Optional: `REMOVE_BG_API_KEY`, `GOOGLE_CLIENT_ID`, `REPLIT_DEV_DOMAIN` (auto-set by Replit)

## Stack

- **Frontend**: React 18 + Vite 5, Tailwind CSS, Framer Motion, Three.js/R3F (3D), Wouter routing
- **Backend**: Node.js + Express, Drizzle ORM, PostgreSQL (Neon)
- **Monorepo**: pnpm workspaces (`artifacts/trynex-storefront`, `artifacts/api-server`, `artifacts/api-client-react`)
- **AI**: Pollinations.ai (free, no key) for image generation; remove.bg for background removal

## Where things live

- `artifacts/trynex-storefront/src/pages/DesignStudio.tsx` — main studio (layers, AI, bg-removal, flip/opacity)
- `artifacts/trynex-storefront/src/pages/design-studio/` — composer, mockups, garment 3D
- `artifacts/trynex-storefront/src/pages/admin/` — all admin panel pages
- `artifacts/api-server/src/routes/` — all API routes (settings, AI, orders, bg-removal)
- `artifacts/api-server/src/lib/autoSeed.ts` — DB seeding / default promo codes
- `artifacts/trynex-storefront/index.html` — entry point with boot splash & watchdog

## Architecture decisions

- **Monorepo with shared API client**: `api-client-react` package auto-generated from server types, giving type-safe hooks across the stack
- **Pollinations.ai proxy**: All AI generation goes server-side (`/api/ai/generate`) to avoid CORS and enable fallback logic (flux-kontext → flux)
- **Per-product design layers**: DesignStudio keeps a `perProductLayersRef` map so each garment type has independent layers; uploads propagate to all products
- **Composer dual-use**: `composer.ts` is shared between the realtime 3D texture and the cart snapshot — supports opacity, rotation, flipH, flipV
- **Boot splash watchdog**: `index.html` has a self-healing mechanism — if React doesn't mount in 18s, it unregisters SWs + reloads with cache-buster

## Product

- Custom apparel Design Studio: upload, AI art generation (Pollinations free), text, background removal, 3D preview, flip/opacity controls
- Full e-commerce: products, categories, cart, checkout (bKash/Nagad/COD), order tracking
- Admin panel: products (AI description writer), orders, settings (all 6 garment type prices + color palettes), promo codes, blog, SEO, analytics
- Bangladesh-specific: BDT currency, 64-district delivery, bKash/Nagad/Rocket payment fields

## User preferences

- No auto-select after image upload or AI generation (borders stay hidden until user taps)
- Print zone border minimal (1.5px dashed, 50% opacity), hidden when layers exist and none selected
- Images uploaded as reference for AI editing go through server proxy to avoid CORS
- TypeScript strict mode; no `any` unless unavoidable
- Push to GitHub after every verified batch of changes (use `bash push-to-github.sh`)

## Gotchas

- `REPLIT_DEV_DOMAIN` must be set (auto-set by Replit) for AI reference image URLs to be reachable by Pollinations
- Admin token stored in `sessionStorage` (not localStorage) — won't persist across browser restarts by design
- The `pnpm tsc --noEmit` check must pass before any GitHub push
- After agent task ends, platform auto-commits; run `bash push-to-github.sh` to sync to GitHub

## Pointers

- Vite config: `artifacts/trynex-storefront/vite.config.ts`
- DB schema: `artifacts/api-server/src/schema.ts` (or wherever drizzle schema lives)
- Settings API: `artifacts/api-server/src/routes/settings.ts`
