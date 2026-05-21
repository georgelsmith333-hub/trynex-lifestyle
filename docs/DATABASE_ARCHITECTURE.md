# TryNex Database Architecture

**Database:** PostgreSQL (Replit managed / Neon compatible)
**ORM:** Drizzle ORM v0.45
**Migration Runner:** Custom `scripts/migrate.mjs`

---

## Connection

```
DATABASE_URL — set as Replit secret (auto-provisioned)
```

SSL is applied automatically when `DATABASE_URL` contains `sslmode=require`.

---

## Schema Overview

All tables are defined in `lib/db/src/schema/`. The schema is split across:
- `lib/db/src/schema/index.ts` — barrel export
- Individual table files

### Core Tables

| Table | Purpose |
|---|---|
| `products` | Product catalog with images, pricing, stock, variants |
| `categories` | Product categories with slugs and images |
| `orders` | Customer orders with status tracking |
| `order_items` | Line items per order |
| `customers` | Registered customer accounts |
| `admins` | Admin user accounts (hashed passwords, 2FA) |
| `admin_sessions` | Stateful admin sessions (token hash + expiry) |
| `cart_items` | Persistent cart state per session/customer |
| `blog_posts` | Blog/news content with rich text |
| `reviews` | Product reviews and ratings |
| `promo_codes` | Discount/promo code definitions |
| `referrals` | Customer referral program tracking |
| `newsletters` | Newsletter subscriber list |
| `testimonials` | Customer testimonials |
| `hampers` | Gift hamper product bundles |
| `studio_assets` | Design Studio saved assets |
| `design_drafts` | In-progress customer designs |
| `site_settings` | Key/value store for site configuration |
| `order_messages` | Order-specific customer/admin messages |
| `activity_logs` | Admin activity audit log |

### Indexes

Performance indexes created in migration `0011_performance_indexes.sql`:
- Products: `slug`, `category_id`, `featured`, `created_at`
- Orders: `customer_id`, `status`, `created_at`
- Blog posts: `slug`, `published_at`
- Customers: `email`

Social login indexes in `0012_social_login_indexes.sql`:
- Customers: `google_id`, `facebook_id`

---

## Migrations

Location: `lib/db/migrations/`
Runner: `node scripts/migrate.mjs`

All migrations are:
- **Idempotent** — safe to re-run (`IF NOT EXISTS`, `ADD COLUMN IF NOT EXISTS`)
- **Non-destructive** — no `DROP TABLE` or `TRUNCATE` in any migration
- **Tracked** — applied migrations recorded in `_migrations` table

### Migration History

| File | Description |
|---|---|
| 0000_initial_schema.sql | Core tables (products, orders, customers, etc.) |
| 0001_guest_accounts.sql | Guest checkout support |
| 0002_blog_posts.sql | Blog feature |
| 0003_studio_assets_missing.sql | Design Studio storage |
| 0004_admin_activity_logs.sql | Admin audit logging |
| 0005_activity_log_fk.sql | FK constraint fix |
| 0006_admin_2fa_pwreset.sql | 2FA and password reset |
| 0007_add_blog_view_count.sql | Blog analytics |
| 0008_newsletter_subscribers.sql | Newsletter list |
| 0009_design_drafts.sql | Draft design persistence |
| 0010_promo_codes_referrals.sql | Promo code system |
| 0011_performance_indexes.sql | Query performance |
| 0012_social_login_indexes.sql | Social auth indexes |
| 0013_order_messages.sql | Order messaging |
| 0014_color_variants.sql | Product color variants |
| 0015_safe_product_columns.sql | Safe column additions |

---

## Auto-Seeding

On first startup with an empty database, `autoSeed.ts` seeds:
- Sample products (T-shirts, hoodies, mugs, caps)
- Product categories
- 20 sample blog posts
- Default site settings

---

## Backup Strategy

- Daily backups via admin panel (`/admin/backup`)
- Backup API endpoint: `POST /api/admin/backup`
- Backup format: SQL dump stored in R2 / local storage
- Retention: configurable via admin settings

---

## Production Notes

- Never run `drizzle-kit push` directly against production
- Use `scripts/migrate.mjs` (run automatically on server start)
- For production schema changes: add new migration file → deploy → migrations auto-apply on startup
