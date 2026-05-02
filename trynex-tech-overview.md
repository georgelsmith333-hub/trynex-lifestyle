# TryNex Lifestyle — Tech Stack & Platform Overview
  **Generated:** 02 May 2026 · Bangladesh E-Commerce Platform · trynexshop.com

  ---

  ## System Architecture

  TryNex is a full-stack **pnpm monorepo** with React storefront, Express API, PostgreSQL, and Cloudflare R2 storage, deployed on Render.com.

  | Layer | Technology | Purpose |
  |-------|-----------|---------|
  | Frontend | React 19 + Vite 7 + TypeScript | SPA with HMR, code splitting, PWA |
  | Styling | Tailwind CSS v4 + Framer Motion | Utility-first + animations |
  | 3D Engine | React Three Fiber + Three.js + Drei | Design Studio 3D preview |
  | HTTP Client | TanStack Query v5 | Server state & caching |
  | Routing | wouter | Lightweight client-side routing |
  | API Server | Express 5 + Node.js + TypeScript | 18+ route modules |
  | ORM | Drizzle ORM | Type-safe PostgreSQL queries |
  | Database | PostgreSQL | 12 tables, non-destructive migrations |
  | Auth | JWT (admin) + Google OAuth | sessionStorage token + HttpOnly cookie |
  | Rich Text | Tiptap v2 | Blog editor in admin panel |
  | Storage | Cloudflare R2 | Design assets, order files, image uploads |
  | Deployment | Render.com | Auto-deploy from GitHub main |

  ---

  ## Monorepo Packages

  ```
  /artifacts
    /trynex-storefront    → React frontend (port 5000)
    /api-server           → Express backend (port 8080)
    /mockup-sandbox       → Component preview server
    /db                   → Drizzle schema & migrations (shared)
  ```

  ---

  ## Database Tables (12 total)

  **Core:** admins, settings, categories, products, orders, customers  
  **Features:** blog_posts, testimonials, promo_codes, reviews, referrals, hamper_packages

  ---

  ## Design Studio Products

  | Product | Category | Zones |
  |---------|----------|-------|
  | Unisex T-Shirt (230GSM Cotton) | tshirt | Front, Back, L.Sleeve, R.Sleeve, Neck Label |
  | Unisex Hoodie (320GSM Fleece) | hoodie | Front, Back, L.Sleeve, R.Sleeve |
  | Long Sleeve (240GSM Cotton) | longsleeve | Front, Back, L.Sleeve, R.Sleeve |
  | Structured Cap | cap | Front |
  | Coffee Mug 11oz Ceramic | mug | Left Side, Right Side, Full Wrap (360°) |
  | Water Bottle 600ml Stainless | waterbottle | Front |

  **Editor features:** Image upload, AI art generation, text layers, image adjustments, layer order/visibility, undo/redo, alignment tools, auto-draft save, realtime 3D preview (WebGL2)

  ---

  ## Key URLs

  | URL | Page |
  |-----|------|
  | / | Home |
  | /shop | Product Catalogue |
  | /design-studio | Custom Design Studio |
  | /cart, /checkout | Cart & Checkout |
  | /track-order | Order Tracking |
  | /blog, /gift-hampers | Blog & Hampers |
  | /admin | Admin Dashboard |
  | /admin/products, /orders, /blog | Admin CRUD |
  | /admin/deployment | GitHub Push & Deploy |

  ---

  ## Key API Endpoints

  | Method | Endpoint | Purpose |
  |--------|----------|---------|
  | POST | /api/admin/login | Admin auth → JWT |
  | GET | /api/products | All products |
  | POST | /api/orders | Place order |
  | GET | /api/orders/:tracking | Track order |
  | POST | /api/admin/deployment/push | Git commit + push |
  | POST | /api/ai/generate | AI image generation |
  | POST | /api/remove-bg/process | Background removal |
  | GET | /sitemap.xml | Dynamic XML sitemap |

  ---

  ## Required Environment Variables (Render.com)

  | Variable | Purpose |
  |----------|---------|
  | DATABASE_URL | PostgreSQL connection string |
  | JWT_SECRET | Customer JWT signing |
  | ADMIN_JWT_SECRET | Admin JWT (must differ from JWT_SECRET) |
  | ADMIN_PASSWORD | Admin login password |
  | ALLOWED_ORIGINS | CORS whitelist (comma-separated) |
  | R2_ACCOUNT_ID | Cloudflare R2 account |
  | R2_ACCESS_KEY_ID | R2 access key |
  | R2_SECRET_ACCESS_KEY | R2 secret key |
  | R2_BUCKET | R2 bucket name |
  | R2_PUBLIC_BASE_URL | CDN URL for R2 assets |
  | GOOGLE_CLIENT_ID | Optional: Google One-Tap |

  ---

  ## Security Architecture

  - **Admin Auth:** JWT in sessionStorage (auto-clears on tab close) + HttpOnly Secure cookie dual defence
  - **Rate Limiting:** Auth, admin login, orders, reviews, promo codes, tracking endpoints
  - **CORS:** Whitelist via ALLOWED_ORIGINS — production refuses to start without it
  - **Input Validation:** Zod schema on all API request bodies
  - **SQL Safety:** Drizzle ORM parameterised queries (no raw SQL interpolation)
  - **File Uploads:** Type + size validation (max 10MB, images only)
  - **Git secrets check:** No hardcoded credentials found in source code ✅

  ---

  ## SEO Features

  - Canonical domain: https://trynexshop.com
  - Auto-generated canonical URLs, hreflang (en-BD + x-default)
  - JSON-LD structured data (Product, Blog, FAQ, BreadcrumbList)
  - Dynamic sitemap.xml + robots.txt
  - Google Search Console verification (DB-driven)
  - Open Graph + Twitter Card meta tags

  ---

  ## Post-Deployment Checklist

  1. Submit https://trynexshop.com/sitemap.xml in Google Search Console
  2. Submit sitemap in Bing Webmaster Tools
  3. Verify all Render env vars are set
  4. Test admin login at /admin
  5. Place a test order — verify checkout and tracking
  6. Test Design Studio: upload image, switch products, add to cart

  ---

  ## Important Notes

  - **Never auto-seed:** autoSeedIfEmpty() only runs on empty DBs — existing data is never overwritten
  - **Render free tier:** Server sleeps after 15 min inactivity — first request may take ~30s
  - **R2 storage:** Design images and order assets stored in Cloudflare R2, not on server filesystem
  - **Migrations are safe:** Always CREATE TABLE IF NOT EXISTS / ADD COLUMN IF NOT EXISTS
  - **Flash sale timer:** Runs on BST (UTC+6) — resets at midnight and noon automatically

  ---

  *TryNex Lifestyle · trynexshop.com · Internal Use Only*
  