# TryNex Lifestyle — Complete Issue Audit & Fix Log

**Date:** May 8, 2026  
**Status:** All items resolved unless marked ⏳

---

## ISSUE 1 — Admin Panel: Order Design Images Not Showing ✅ FIXED

### What was broken
When a customer places a custom studio order (T-shirt or Mug with a designed canvas), the admin Orders panel showed a blank/broken image thumbnail instead of the customer's design.

### Root cause
`saveMockupImage()` in `objectStorage.ts` saved the design image to local disk but returned the wrong URL path:  
```
Returned:  /objects/mockup-uuid.png         ← wrong (hits Vite dev server, 404)
Correct:   /api/storage/objects/mockup-uuid.png  ← right (proxied to API server)
```
The `<img src={imageUrl}>` in AdminOrders was trying to load from the frontend origin with no `/api/storage` prefix, resulting in a 404 on every custom order.

### Fix applied
`artifacts/api-server/src/lib/objectStorage.ts` — Line 374:
```diff
- return `/objects/${entityId}`;
+ return `/api/storage/objects/${entityId}`;
```

### Affected file
- `artifacts/api-server/src/lib/objectStorage.ts`

---

## ISSUE 2 — 3D Mug: Design Misaligned in Single-Side Mode ✅ FIXED

### What was broken
When a user added a design to the mug in single-side mode (the default), the 3D preview showed the design shifted ~5% to the left of where it appeared in the 2D design canvas. The design looked centred in 2D but off-centre in 3D.

### Root cause
`MugBody` in `garment3d.tsx` applied a texture offset of `-0.05` for single-side mode:
```javascript
wrapTex.offset.set(-0.05, 0.009); // ← wrong, shifts design left
```

The `useMugWrapTexture` in `ProductViewer3D.tsx` composes the front design into the LEFT HALF of a 2048×768 canvas (pixels 0–1024). With `repeat.set(0.5, 1)`, the correct centre of the front design maps to:
- `UV.u = 0.5` → `sample = 0.5 × 0.5 + offset = 0.25 + offset`  
- The canvas centre of the front design is at `x=512 = u_tex=0.25`
- Correct offset = **0.0** (not -0.05)

The `-0.05` shifted the display window so UV.u=0.5 sampled at canvas x=409 instead of x=512.  
The vertical `0.009` offset also caused a slight upward shift with no purpose.

### Fix applied
`artifacts/trynex-storefront/src/components/garment3d.tsx`:
```diff
- wrapTex.offset.set(-0.05, 0.009);
+ wrapTex.offset.set(0.0, 0.0);
```

### Affected file
- `artifacts/trynex-storefront/src/components/garment3d.tsx`

---

## ISSUE 3 — Background Removal: Rate Limit Blocked In-Browser Free Fallback ✅ FIXED

### What was broken
Background removal is implemented as:
1. **Step 1 (server):** POST `/api/remove-bg` → uses remove.bg API key → paid, limited
2. **Step 2 (browser):** `@imgly/background-removal` WASM model → completely free and unlimited

The original code checked the **rate limit BEFORE checking if an API key exists**. So users without an API key (most installs) could only attempt BG removal 10 times per hour before the server returned `429 Too Many Requests`, which fell through to the browser fallback (Step 2) but with confusing UX.

### Fix applied
`artifacts/api-server/src/routes/removeBg.ts` — **Check API key FIRST**:
- If no API key → return `503` immediately → client instantly switches to free in-browser AI
- Rate limit (raised from 10/hr → 60/hr) only applies when a real remove.bg key is present and server calls are being made (which cost money)

### Net result
Without a remove.bg API key: background removal works **completely free and unlimited** via the in-browser WASM model (first run ~30 MB download, then cached in IndexedDB).  
With a remove.bg API key: server-side processing with 60 calls/hour rate limit.

### Affected file
- `artifacts/api-server/src/routes/removeBg.ts`

---

## ISSUE 4 — AI Studio: Rate Limits Too Low ✅ FIXED

### What was broken
The AI image generation and chat endpoints had very conservative rate limits causing frequent "too many requests" errors for active users.

### Old vs New limits

| Endpoint | Old limit | New limit |
|---|---|---|
| Image generation | 20 req/min | 100 req/min |
| Reference image upload | 30 req/min | 120 req/min |
| AI chat | 30 req/min | 120 req/min |

### Affected file
- `artifacts/api-server/src/routes/ai.ts`

---

## ISSUE 5 — Newsletter: No IP Rate Limiting or Admin Management ✅ FIXED

### What was broken
- Anyone could subscribe unlimited times from the same IP (spam/abuse)
- Admin had no way to view, filter, or delete subscribers
- No duplicate IP detection for abuse monitoring

### Fix applied

**Backend (`artifacts/api-server/src/routes/newsletter.ts`):**
- Max 3 subscriptions per IP per 24 hours  
- `GET /api/newsletter/subscribers` now returns `ipCount` and `duplicateIp` fields per subscriber
- `DELETE /api/newsletter/subscribers/:id` — delete individual subscriber
- `DELETE /api/newsletter/subscribers/bulk-by-ip` — bulk delete all entries from a suspected spam IP

**Frontend (`artifacts/trynex-storefront/src/pages/admin/AdminNewsletter.tsx`):**
- Full admin page at `/admin/newsletter`
- Stats dashboard (total, this week, today, unique IPs)
- Duplicate IP warnings highlighted in orange
- Search and filter
- Individual and bulk-by-IP delete with confirmation dialogs
- CSV export of full list

### Affected files
- `artifacts/api-server/src/routes/newsletter.ts`
- `artifacts/trynex-storefront/src/pages/admin/AdminNewsletter.tsx` (new)
- `artifacts/trynex-storefront/src/App.tsx` (route added)
- `artifacts/trynex-storefront/src/components/layout/AdminLayout.tsx` (sidebar link added)

---

## ISSUE 6 — Admin AI Assistant: Not Powerful Enough for Store Management ✅ FIXED

### What was missing
The AI assistant only had 4 generic presets (Blog, Product Description, Ad Copy, Design Ideas) and a minimal system prompt with no business context.

### Fix applied

**System prompt (`artifacts/api-server/src/routes/ai.ts`):**
Upgraded to a full store-manager context covering: BDT pricing, payment methods (bKash/Nagad/Rocket/COD), 64-district delivery, Bangladesh festival calendar, A/B testing guidelines, SEO for blog posts, bilingual English/Bangla responses.

**Preset prompts expanded from 4 → 8:**

| Preset | What it generates |
|---|---|
| Blog Post | 700+ word SEO-optimized article + meta description |
| Product Description | 3 variants (short/medium/long) |
| Ad Copy | 3 Facebook/Instagram variations (playful / aspirational / urgency) |
| Design Ideas | 12 culturally-relevant design concepts with color palettes |
| **Growth Strategy** | 30-day plan to grow sales 40% |
| **Promo Strategy** | 3-month festival promo calendar with codes |
| **Email Campaign** | 5-email welcome sequence |
| **Customer Reply** | 5 bilingual (EN+BD) customer service templates |

**Models available:** GPT-4o (Best), GPT-4o Mini, Mistral Large, Llama 3.3 — all free via Pollinations.ai

### Affected files
- `artifacts/api-server/src/routes/ai.ts`
- `artifacts/trynex-storefront/src/components/AdminAIAssistant.tsx`

---

## REMAINING / KNOWN ITEMS

### GitHub sync
After the platform auto-commits, run:
```bash
bash push-to-github.sh
```

### Water bottle 3D alignment
The water bottle uses `useBottleWrapTexture` with `offset.set(0.25, 0)` which correctly centres the design on the front (+Z face) using the same 2048-wide canvas layout as the mug. No fix needed — verify visually.

### 3D mug wrap mode
Full 360° wrap mode uses `repeat.set(1,1)` + `offset.set(0.25,0)` on a 2048×768 canvas where front=[0–1024] and back=[1024–2048]. This is architecturally correct. The bug was only in single-side mode (Issue 2 above, now fixed).

### remove.bg API key (optional)
If you want server-side (faster) background removal, add the key in Admin → Settings → `Remove.bg API Key`. Without it, the system automatically uses the free in-browser AI model.

---

## SUMMARY TABLE

| # | Issue | File(s) Changed | Status |
|---|---|---|---|
| 1 | Admin order images not showing | `objectStorage.ts` | ✅ Fixed |
| 2 | 3D mug design misaligned | `garment3d.tsx` | ✅ Fixed |
| 3 | BG removal blocked by rate limit | `removeBg.ts` | ✅ Fixed |
| 4 | AI rate limits too low | `ai.ts` | ✅ Fixed |
| 5 | Newsletter no IP control or admin | `newsletter.ts`, `AdminNewsletter.tsx` | ✅ Fixed |
| 6 | Admin AI not useful for store ops | `ai.ts`, `AdminAIAssistant.tsx` | ✅ Fixed |
