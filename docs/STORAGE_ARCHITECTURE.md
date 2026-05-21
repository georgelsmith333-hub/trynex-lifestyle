# TryNex Storage Architecture

**Primary:** Cloudflare R2 (S3-compatible object storage)
**Fallback:** Local filesystem (`./uploads/`)
**CDN:** Cloudflare public bucket (`pub-0ef16878c2c34942b4c318420d1db86d.r2.dev`)

---

## Backend Detection

The `ObjectStorageService` class in `artifacts/api-server/src/lib/objectStorage.ts` auto-detects the active backend on startup:

1. **R2** — active when `R2_ACCOUNT_ID` + `R2_ACCESS_KEY_ID` + `R2_SECRET_ACCESS_KEY` + `R2_BUCKET` are set
2. **S3** — active when `S3_ACCESS_KEY_ID` + `S3_SECRET_ACCESS_KEY` + `S3_BUCKET` are set
3. **Local** — default fallback, stores files at `LOCAL_STORAGE_PATH` (default: `./uploads/`)

Current active backend is logged at server startup.

---

## R2 Configuration

| Variable | Value | Notes |
|---|---|---|
| `R2_ACCOUNT_ID` | `060a0f28c7f62affa5ac09be3b1dd1a9` | Cloudflare account |
| `R2_BUCKET` | `trynex` | Bucket name |
| `R2_ENDPOINT` | `https://060a0f28c7f62affa5ac09be3b1dd1a9.r2.cloudflarestorage.com` | S3-compatible endpoint |
| `R2_PUBLIC_BASE_URL` | `https://pub-0ef16878c2c34942b4c318420d1db86d.r2.dev` | Public CDN URL |
| `R2_ACCESS_KEY_ID` | *(secret)* | Set in Replit secrets |
| `R2_SECRET_ACCESS_KEY` | *(secret)* | Set in Replit secrets |

---

## Folder Structure in R2

```
trynex/
├── products/          # Product images uploaded via admin
│   └── {id}-{timestamp}.{ext}
├── categories/        # Category images
│   └── {slug}-{timestamp}.{ext}
├── blog/              # Blog post cover images
│   └── {slug}-{timestamp}.{ext}
├── designs/           # Design Studio saved designs (customer uploads)
│   └── design-{uuid}.{ext}
├── mockups/           # Generated product mockup thumbnails
│   └── mockup-{uuid}.png
├── exports/           # Customer design exports (ZIP/PNG)
│   └── export-{uuid}.zip
├── backups/           # Database backups
│   └── backup-{date}.sql
└── temp/              # Temporary upload staging
    └── {uuid}.{ext}
```

---

## Static Public Assets (served by Vite/CDN)

Located in `artifacts/trynex-storefront/public/`:

```
public/
├── mockups/           # 2D garment cutout PNGs for Design Studio
│   ├── white-tshirt-front.png
│   ├── white-tshirt-back.png
│   ├── black-tshirt-front.png
│   ├── black-tshirt-back.png
│   ├── white-hoodie-front.png
│   ├── white-hoodie-back.png
│   ├── black-hoodie-front.png
│   ├── black-hoodie-back.png
│   ├── white-longsleeve-front.png
│   ├── white-longsleeve-back.png
│   ├── white-mug-front.png
│   ├── black-mug-front.png
│   ├── white-cap-front.png
│   └── black-cap-front.png
├── models/            # 3D GLB models for Design Studio
│   ├── tshirt.glb
│   ├── hoodie.glb
│   ├── longsleeve.glb
│   ├── mug.glb
│   └── cap.glb
├── images/            # Category and homepage images
│   ├── cat-tshirt.png
│   ├── cat-hoodie.png
│   ├── cat-cap.png
│   ├── cat-mug.png
│   ├── hero-bg.png
│   ├── pattern.png
│   └── product-placeholder.svg  ← Added in this audit
├── products/          # Static demo product images
└── manifest.json      # PWA manifest
```

---

## URL Resolution

Use `resolveImageUrl(url)` from `src/lib/utils.ts` for consistent URL handling:

```ts
import { resolveImageUrl } from "@/lib/utils";

// Examples:
resolveImageUrl("https://r2.dev/...")          // → external URL as-is
resolveImageUrl("/api/storage/objects/abc")    // → prepends API base in production
resolveImageUrl("/mockups/white-tshirt.png")   // → local public asset
resolveImageUrl(null)                          // → /images/product-placeholder.svg
```

---

## Lifecycle & Retention

| Asset Type | Retention | Notes |
|---|---|---|
| Product images | Permanent | Deleted only when product deleted via admin |
| Design exports | 30 days | Scheduler cleans up old exports |
| Temp uploads | 24 hours | Scheduler purges orphaned temp files |
| Database backups | 30 days (last 30) | Configurable in admin settings |
| Design drafts | 90 days inactive | Scheduler purges old drafts |

---

## Local Storage Fallback

When running without R2 credentials (development/Replit):
- Files stored at `artifacts/api-server/uploads/`
- Served via `GET /api/storage/objects/:id`
- **Not persistent** on stateless deployments (Render, Cloudflare Workers)
- Suitable for development only — configure R2 for production
