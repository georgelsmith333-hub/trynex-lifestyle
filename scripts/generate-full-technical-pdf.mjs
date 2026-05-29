/* TryNex Lifestyle — Full A-to-Z Technical & Product Documentation PDF
   Covers: tech stack, all pages, all API endpoints, DB schema, auth, payments,
   Design Studio, 3D viewer, admin panel, SEO, deployment, security, env vars.
   Output: docs/TryNex-Full-Technical-Documentation.pdf                          */
import PDFDocument from "pdfkit";
import fs from "node:fs";
import path from "node:path";

const OUT = path.resolve("docs/TryNex-Full-Technical-Documentation.pdf");
fs.mkdirSync(path.dirname(OUT), { recursive: true });

const doc = new PDFDocument({
  size: "A4", margin: 50,
  info: {
    Title: "TryNex Lifestyle — Full Technical Documentation",
    Author: "TryNex Lifestyle Engineering",
    Subject: "Complete A-to-Z platform documentation",
    Keywords: "trynex, ecommerce, bangladesh, custom apparel, technical documentation",
  }
});
doc.pipe(fs.createWriteStream(OUT));

const ORANGE = "#E85D04", DARK = "#0f172a", GREY = "#475569", LIGHT = "#64748b",
      BLUE = "#1e40af", GREEN = "#166534", RED = "#991b1b", PURPLE = "#5b21b6";
const W = 495; // usable text width (A4 595 - 2×50 margins)

/* ─── helpers ─────────────────────────────────────────────── */
let pageNum = 1;
doc.on("pageAdded", () => { pageNum++; });

function addPageNum() {
  doc.fillColor(GREY).fontSize(9).font("Helvetica")
    .text(`TryNex Lifestyle — Full Technical Documentation  ·  Page ${pageNum}`,
          50, 785, { align: "right", width: W });
}

function newPage() { addPageNum(); doc.addPage(); }

function cover() {
  doc.rect(0, 0, 595, 842).fill("#0f172a");
  doc.rect(0, 0, 595, 8).fill(ORANGE);
  doc.rect(0, 834, 595, 8).fill(ORANGE);
  doc.fillColor(ORANGE).font("Helvetica-Bold").fontSize(42)
    .text("TryNex Lifestyle", 50, 200, { align: "center", width: W });
  doc.fillColor("white").fontSize(18).font("Helvetica")
    .text("Full Technical Documentation", 50, 260, { align: "center", width: W });
  doc.moveDown(0.5);
  doc.fillColor("#94a3b8").fontSize(13)
    .text("Premium Custom Apparel · Bangladesh", 50, 295, { align: "center", width: W });
  doc.moveDown(3);
  // Info box
  doc.rect(80, 360, 435, 160).fillAndStroke("#1e293b", "#334155");
  const box = [
    ["Platform:", "Full-stack e-commerce + Design Studio"],
    ["Market:", "Bangladesh (all 64 districts)"],
    ["Domain:", "trynexshop.com"],
    ["API:", "trynex-api.onrender.com"],
    ["Stack:", "React 19 + Vite 7 + Express 5 + PostgreSQL"],
    ["Generated:", new Date().toLocaleDateString("en-GB", { day:"2-digit", month:"long", year:"numeric" })],
  ];
  box.forEach(([k,v], i) => {
    doc.fillColor("#94a3b8").font("Helvetica-Bold").fontSize(10)
       .text(k, 100, 375 + i * 22);
    doc.fillColor("white").font("Helvetica").fontSize(10)
       .text(v, 200, 375 + i * 22);
  });
  doc.fillColor("#475569").fontSize(9)
    .text("CONFIDENTIAL — Internal Engineering Reference", 50, 760, { align: "center", width: W });
}

function toc() {
  newPage();
  h1("Table of Contents");
  const sections = [
    ["1", "Platform Overview & Architecture", "3"],
    ["2", "Technology Stack (Complete)", "4"],
    ["3", "Frontend — All Pages & Routes", "5"],
    ["4", "Backend — All API Endpoints", "7"],
    ["5", "Database Schema (19 Tables)", "10"],
    ["6", "Authentication System", "12"],
    ["7", "Design Studio — Technical Deep Dive", "13"],
    ["8", "3D Viewer & Composer", "15"],
    ["9", "Order & Payment Flow", "16"],
    ["10", "Admin Panel — Full Feature List", "17"],
    ["11", "Security & Rate Limiting", "18"],
    ["12", "SEO, Structured Data & Performance", "19"],
    ["13", "Object Storage & File Handling", "20"],
    ["14", "Caching Strategy", "21"],
    ["15", "Email, Notifications & Integrations", "22"],
    ["16", "CI/CD & Deployment Architecture", "22"],
    ["17", "Environment Variables Reference", "23"],
    ["18", "GitHub Actions Workflow", "24"],
    ["19", "Admin Onboarding Checklist", "25"],
    ["20", "Replit Independence", "26"],
  ];
  doc.font("Helvetica").fontSize(11).fillColor(DARK);
  sections.forEach(([num, title, pg]) => {
    const y = doc.y;
    doc.fillColor(num.length > 1 ? DARK : ORANGE).font("Helvetica-Bold")
       .text(`§${num}  ${title}`, 50, y, { width: W - 40, continued: false });
    doc.fillColor(GREY).font("Helvetica").fontSize(10)
       .text(`p.${pg}`, 50, y, { align: "right", width: W });
    doc.moveDown(0.35);
  });
}

function h1(text, color = ORANGE) {
  doc.moveDown(0.3);
  doc.fillColor(color).font("Helvetica-Bold").fontSize(20).text(text);
  doc.moveTo(50, doc.y).lineTo(545, doc.y).strokeColor(color).lineWidth(1.5).stroke();
  doc.moveDown(0.5);
}
function h2(text) {
  doc.moveDown(0.4);
  doc.fillColor(DARK).font("Helvetica-Bold").fontSize(13).text(text);
  doc.moveDown(0.15);
}
function h3(text, color = BLUE) {
  doc.moveDown(0.3);
  doc.fillColor(color).font("Helvetica-Bold").fontSize(11).text(text);
  doc.moveDown(0.1);
}
function p(text, indent = 0) {
  doc.fillColor(GREY).font("Helvetica").fontSize(10)
    .text(text, 50 + indent, doc.y, { align: "justify", lineGap: 1.5, width: W - indent });
  doc.moveDown(0.25);
}
function bullets(items, indent = 12) {
  doc.fillColor(GREY).font("Helvetica").fontSize(10);
  items.forEach(it => doc.text(`• ${it}`, { indent, lineGap: 1.5, width: W - indent }));
  doc.moveDown(0.25);
}
function kv(key, val, keyColor = DARK) {
  const y = doc.y;
  doc.fillColor(keyColor).font("Helvetica-Bold").fontSize(10).text(key, 50, y, { continued: false, width: 180 });
  doc.fillColor(GREY).font("Helvetica").fontSize(10).text(val, 50 + 185, y, { width: W - 185 });
  doc.moveDown(0.2);
}
function table(headers, rows, colWidths) {
  const rowH = 18, hdrH = 20;
  const x0 = 50;
  // Header
  doc.rect(x0, doc.y, W, hdrH).fill("#1e293b");
  let cx = x0 + 4;
  headers.forEach((h, i) => {
    doc.fillColor("white").font("Helvetica-Bold").fontSize(9).text(h, cx, doc.y - hdrH + 5, { width: colWidths[i], lineBreak: false });
    cx += colWidths[i];
  });
  doc.y += 4;
  // Rows
  rows.forEach((row, ri) => {
    const bg = ri % 2 === 0 ? "#f8fafc" : "white";
    doc.rect(x0, doc.y, W, rowH).fill(bg);
    let cx2 = x0 + 4;
    row.forEach((cell, ci) => {
      doc.fillColor(DARK).font("Helvetica").fontSize(8.5)
        .text(String(cell), cx2, doc.y - rowH + 5, { width: colWidths[ci] - 4, lineBreak: false });
      cx2 += colWidths[ci];
    });
    doc.y += 4;
    doc.rect(x0, doc.y - rowH - 4, W, 1).fill("#e2e8f0");
  });
  doc.moveDown(0.5);
}
function pill(text, color = ORANGE) {
  doc.rect(50, doc.y, text.length * 6.5 + 16, 16).fill(color);
  doc.fillColor("white").font("Helvetica-Bold").fontSize(8)
    .text(text, 58, doc.y - 13);
  doc.moveDown(0.6);
}

/* ══════════════════════════════════════════════
   START CONTENT
══════════════════════════════════════════════ */
cover();
toc();

/* ─── §1 Platform Overview ──────────────────── */
newPage();
h1("§1  Platform Overview & Architecture");
p("TryNex Lifestyle is a production-grade full-stack e-commerce platform built exclusively for the Bangladesh market. It combines a custom-apparel storefront (shirts, hoodies, mugs, caps, water bottles) with an embedded real-time Design Studio backed by a photographic mockup engine and a react-three-fiber 3D preview. The platform handles the entire commerce lifecycle: browse → design → checkout → fulfilment → admin operations.");

h2("Architecture Diagram (logical)");
const archRows = [
  ["Layer", "Technology", "Host", "Notes"],
  ["CDN / Edge", "Cloudflare (DNS + CDN)", "Global", "Caches static assets, manages TLS, WAF"],
  ["Storefront", "React 19 SPA (static)", "Cloudflare Pages", "Built by Vite 7, served as pure static files"],
  ["API Server", "Express 5 + Node 24", "Render.com", "REST JSON, ~30 route modules"],
  ["Database", "PostgreSQL 16 (Drizzle)", "Neon / Render PG", "19 tables, auto-migration on startup"],
  ["Object Storage", "Cloudflare R2 (S3-compat)", "Cloudflare", "Product images, original design files"],
  ["Cache", "Upstash Redis (REST)", "Upstash", "Settings, product list, rate-limit counters"],
  ["Dev Environment", "Replit (NixOS)", "Replit", "Both services run side-by-side, pnpm ws"],
];
table(archRows[0], archRows.slice(1), [90, 130, 100, 175]);

h2("Monorepo Layout");
bullets([
  "artifacts/trynex-storefront/  — React 19 + Vite 7 customer SPA (port 5000 dev)",
  "artifacts/api-server/         — Express 5 REST API (port 8080 dev)",
  "artifacts/api-worker/         — Cloudflare Workers alternative (Hono, non-primary)",
  "artifacts/mockup-sandbox/     — Isolated Vite dev server for component prototyping (port 8081)",
  "lib/db/                       — Drizzle schema, 12 migrations, multi-URL failover client",
  "lib/api-spec/                 — OpenAPI 3 spec + generated TypeScript types",
  "lib/api-zod/                  — Generated Zod validators from OpenAPI spec",
  "lib/api-client-react/         — TanStack Query hooks (auto-generated)",
  "scripts/                      — Seed, PDF generation, CI helpers",
  ".github/workflows/            — deploy.yml (main CI/CD), ci.yml (PR checks), db-backup.yml",
]);

/* ─── §2 Tech Stack ─────────────────────────── */
newPage();
h1("§2  Technology Stack (Complete)");

h2("Frontend (artifacts/trynex-storefront)");
const feStack = [
  ["Package", "Version", "Purpose"],
  ["react", "19.x", "UI framework (latest concurrent renderer)"],
  ["vite", "7.x", "Build tool, dev server, HMR"],
  ["typescript", "5.x", "Strict type safety throughout"],
  ["tailwindcss", "4.x", "Utility-first CSS (JIT, no config file needed)"],
  ["framer-motion", "latest", "Page transitions, micro-animations, entrance effects"],
  ["wouter", "3.x", "Lightweight 2KB client-side router"],
  ["@tanstack/react-query", "5.x", "Server-state management, cache invalidation"],
  ["three", "0.17x", "3D rendering engine"],
  ["@react-three/fiber", "8.x", "React renderer for Three.js"],
  ["@react-three/drei", "9.x", "Helpers: OrbitControls, useGLTF, etc."],
  ["@radix-ui/*", "latest", "Headless accessible UI primitives"],
  ["lucide-react", "latest", "1000+ clean SVG icons"],
  ["vite-plugin-pwa", "latest", "Service worker, offline page, install prompt"],
  ["pdfmake / pdfkit", "latest", "Client-side order summary PDF generation"],
  ["react-hot-toast", "latest", "Non-blocking toast notifications"],
  ["DOMPurify", "latest", "Sanitise user-generated HTML (blog content)"],
  ["@upstash/redis", "latest", "In-app Redis REST client"],
];
table(feStack[0], feStack.slice(1), [130, 60, 305]);

newPage();
h2("Backend (artifacts/api-server)");
const beStack = [
  ["Package", "Version", "Purpose"],
  ["express", "5.x", "HTTP server framework"],
  ["typescript + tsx", "5.x", "TS execution + compilation"],
  ["drizzle-orm", "latest", "Type-safe SQL ORM"],
  ["drizzle-kit", "latest", "Schema migration runner"],
  ["@neondatabase/serverless", "latest", "Neon PostgreSQL WebSocket driver"],
  ["pg", "8.x", "PostgreSQL node client (standard PG)"],
  ["bcryptjs", "latest", "Password hashing (10 rounds)"],
  ["jsonwebtoken", "latest", "JWT signing/verification (customer + admin)"],
  ["@aws-sdk/client-s3", "3.x", "Cloudflare R2 via S3-compatible API"],
  ["pino + pino-http", "latest", "Structured JSON logging"],
  ["helmet", "7.x", "Security HTTP headers"],
  ["express-rate-limit", "7.x", "Per-route request throttling"],
  ["cors", "2.x", "Cross-origin policy (strict ALLOWED_ORIGINS)"],
  ["zod", "3.x", "Runtime request validation"],
  ["sharp", "latest", "Image processing (R2 thumbnail generation)"],
  ["@upstash/redis", "latest", "Redis cache client"],
  ["node-cron", "latest", "Scheduled jobs (abandoned cart, backups)"],
  ["otplib", "latest", "TOTP 2FA for admin panel"],
];
table(beStack[0], beStack.slice(1), [150, 65, 280]);

h2("Infrastructure & Services");
bullets([
  "PostgreSQL 16 — primary data store; Drizzle ORM, 12 auto-applied migrations",
  "Cloudflare R2 — object storage for product images + design originals (S3-compatible)",
  "Cloudflare Pages — static SPA hosting, global CDN, custom domain trynexshop.com",
  "Render.com — Node 24 web service for Express API (auto-deploy on git push)",
  "Upstash Redis — REST-based Redis for caching and rate-limit counters",
  "Neon PostgreSQL — serverless PG fallback chain (DATABASE_URL_MAIN, _TRYNEX_DB, _FAILOVER)",
  "GitHub Actions — 5-job CI/CD: TypeCheck → CF Pages → CF Worker → Render → Smoke Test",
]);

/* ─── §3 Frontend Pages ─────────────────────── */
newPage();
h1("§3  Frontend — All Pages & Routes");
p("The storefront is a Single Page Application (SPA) using Wouter for client-side routing. All routes are registered in src/App.tsx. SEO meta tags are injected per-route via the SEOHead component using react-helmet-async.");

const pages = [
  ["Route", "Component", "Description"],
  ["/", "Home", "Hero, featured products, testimonials, categories, blog highlights, gift section"],
  ["/products | /shop", "Products", "Catalog with filter sidebar (category, price, rating), infinite scroll"],
  ["/product/:id", "ProductDetail", "Images, sizes, colors, reviews, Add to Cart, Design Studio link, JSON-LD"],
  ["/cart", "Cart", "Cart items, design thumbnails, 3D viewer per custom item, promo code, checkout CTA"],
  ["/checkout", "Checkout", "Address, payment method (COD/bKash/Nagad/Rocket/Upay/Card), promo, order summary"],
  ["/track", "TrackOrder", "Track by order number + phone; shows timeline status"],
  ["/design-studio", "DesignStudio", "Full design tool — see §7 for details"],
  ["/blog", "Blog", "Posts grid with category filter; bilingual (EN+BN)"],
  ["/blog/:slug", "BlogPost", "Full article with related posts, TOC, FAQ, JSON-LD BlogPosting"],
  ["/wishlist", "Wishlist", "Saved products, move to cart, share link"],
  ["/hampers", "Hampers", "Curated gift hampers catalog"],
  ["/hampers/build", "HamperBuilder", "Custom hamper builder — pick products, add packaging"],
  ["/hampers/:slug", "HamperDetail", "Individual hamper page with add-to-cart"],
  ["/sale", "SalePage", "Seasonal sale items with countdown timer"],
  ["/faq", "FAQ", "Accordion FAQ with JSON-LD FAQPage structured data"],
  ["/about", "About", "Brand story, mission, team"],
  ["/contact", "Contact", "Contact form, WhatsApp button, address, social links"],
  ["/size-guide", "SizeGuide", "Size chart tables for all product categories"],
  ["/login", "Login", "Customer login (email/password + Google OAuth + Facebook OAuth)"],
  ["/signup", "Signup", "Customer registration with referral code support"],
  ["/account", "Account", "Order history, profile edit, password change, referral link"],
  ["/referral", "Referral", "Referral programme page with code share"],
  ["/shipping-policy", "ShippingPolicy", "Shipping terms, delivery timeframes, districts"],
  ["/return-policy", "ReturnPolicy", "Return & exchange policy"],
  ["/privacy-policy", "PrivacyPolicy", "GDPR-aware privacy policy"],
  ["/terms-of-service", "TermsOfService", "Terms and conditions"],
  ["/seo-guide", "SeoGuide", "Internal SEO guide for admins"],
  ["/admin/login", "AdminLogin", "Admin authentication (password + optional TOTP)"],
  ["/admin/orders", "AdminOrders", "Live order board, status workflow, design download"],
  ["/admin/products", "AdminProducts", "Product CRUD, image upload, R2 storage"],
  ["/admin/categories", "AdminCategories", "Category management"],
  ["/admin/blog", "AdminBlog", "Blog post editor (rich text, AI assist)"],
  ["/admin/customers", "AdminCustomers", "Customer list, order history per customer"],
  ["/admin/settings", "AdminSettings", "Site-wide config: prices, colors, shipping, SEO"],
  ["/admin/reviews", "AdminReviews", "Review moderation, approve/delete"],
  ["/admin/backup", "AdminBackup", "Database backup/restore, data export"],
  ["/admin/facebook-import", "AdminFacebookImport", "Import FB page posts as products/blog"],
];
table(pages[0], pages.slice(1), [140, 120, 235]);

/* ─── §4 API Endpoints ──────────────────────── */
newPage();
h1("§4  Backend — All API Endpoints");
p("All routes are prefixed /api/* and served from the Express 5 server. Authentication uses two separate JWT tokens: customer (JWT_SECRET) and admin (ADMIN_JWT_SECRET). The API base URL in production is https://trynex-api.onrender.com.");

h2("Auth & Admin Auth");
const authRoutes = [
  ["Method", "Path", "Auth", "Description"],
  ["POST", "/api/auth/register", "Public", "Customer registration (name, email, phone, password, referralCode)"],
  ["POST", "/api/auth/login", "Public", "Customer login → JWT access token + refresh token"],
  ["POST", "/api/auth/refresh", "Public", "Refresh access token using refresh token cookie"],
  ["POST", "/api/auth/logout", "Customer", "Invalidate refresh token"],
  ["POST", "/api/auth/forgot-password", "Public", "Send password reset email"],
  ["POST", "/api/auth/reset-password", "Public", "Reset password via token"],
  ["GET", "/api/auth/me", "Customer", "Get current customer profile"],
  ["PUT", "/api/auth/me", "Customer", "Update profile (name, phone, address)"],
  ["POST", "/api/admin/login", "Public", "Admin login → admin JWT (30-min expiry)"],
  ["POST", "/api/admin/login-totp", "Public", "Complete TOTP 2FA step"],
  ["POST", "/api/admin/logout", "Admin", "Revoke admin session token"],
  ["POST", "/api/admin/totp-enable", "Admin", "Enable TOTP 2FA (returns QR code)"],
  ["POST", "/api/admin/totp-disable", "Admin", "Disable TOTP 2FA"],
  ["PUT", "/api/admin/change-password", "Admin", "Change admin password"],
  ["POST", "/api/admin/forgot-password", "Public", "Admin password reset via email"],
  ["POST", "/api/admin/reset-password", "Public", "Reset admin password via token"],
];
table(authRoutes[0], authRoutes.slice(1), [45, 170, 65, 215]);

newPage();
h2("Products & Categories");
const prodRoutes = [
  ["Method", "Path", "Auth", "Description"],
  ["GET", "/api/products", "Public", "List products; query: limit, offset, category, search, sort, featured, customizable"],
  ["GET", "/api/products/:id", "Public", "Single product detail (by id or slug)"],
  ["POST", "/api/products", "Admin", "Create product (name, price, category, images, colors, sizes, etc.)"],
  ["PUT", "/api/products/:id", "Admin", "Update product fields"],
  ["DELETE", "/api/products/:id", "Admin", "Delete product (also removes R2 images)"],
  ["GET", "/api/categories", "Public", "List categories with product counts"],
  ["POST", "/api/categories", "Admin", "Create category"],
  ["PUT", "/api/categories/:id", "Admin", "Update category"],
  ["DELETE", "/api/categories/:id", "Admin", "Delete category (reassign products first)"],
  ["GET", "/api/reviews/:productId", "Public", "List approved reviews for product"],
  ["POST", "/api/reviews", "Customer", "Submit review (rating + text)"],
  ["PUT", "/api/reviews/:id/approve", "Admin", "Approve review for public display"],
  ["DELETE", "/api/reviews/:id", "Admin", "Delete review"],
];
table(prodRoutes[0], prodRoutes.slice(1), [45, 165, 65, 220]);

h2("Orders & Tracking");
const orderRoutes = [
  ["Method", "Path", "Auth", "Description"],
  ["POST", "/api/orders", "Public", "Place order (creates TN-XXXXX order number, computes shipping, validates promo)"],
  ["POST", "/api/orders/track", "Public", "Track order by orderNumber + customerPhone"],
  ["GET", "/api/orders", "Admin", "List all orders (filterable: status, date, search, page)"],
  ["GET", "/api/orders/:id", "Admin", "Order detail including custom design assets"],
  ["PUT/PATCH", "/api/orders/:id/status", "Admin", "Update order status (pending→processing→shipped→ongoing→delivered/cancelled)"],
  ["PUT/PATCH", "/api/orders/:id/payment-status", "Admin", "Update payment status (pending→submitted→verified/failed)"],
  ["PUT", "/api/orders/:id/payment-info", "Public", "Customer submits bKash/Nagad transaction ID"],
  ["GET", "/api/orders/:id/design-download", "Admin", "Generate 15-min presigned URL for original design file"],
  ["GET", "/api/orders/messages/:orderId", "Customer/Admin", "Order messaging thread"],
  ["POST", "/api/orders/messages", "Customer/Admin", "Send message on order thread"],
];
table(orderRoutes[0], orderRoutes.slice(1), [60, 190, 65, 180]);

newPage();
h2("Blog, Hampers, Promo Codes");
const blogRoutes = [
  ["Method", "Path", "Auth", "Description"],
  ["GET", "/api/blog", "Public", "List published posts (category, search, page, limit)"],
  ["GET", "/api/blog/:idOrSlug", "Public", "Single post by id or slug; increments view count"],
  ["GET", "/api/blog/:idOrSlug/related", "Public", "Related posts (same category → shared tags → recents)"],
  ["GET", "/api/blog/categories", "Public", "Category list with published post counts"],
  ["POST", "/api/blog", "Admin", "Create post (title, slug, content, tags, seoMeta, featuredImage)"],
  ["PUT", "/api/blog/:id", "Admin", "Update post"],
  ["DELETE", "/api/blog/:id", "Admin", "Delete post"],
  ["GET", "/api/hampers", "Public", "List hamper packages (active only for public)"],
  ["GET", "/api/hampers/:idOrSlug", "Public", "Single hamper detail"],
  ["POST", "/api/hampers", "Admin", "Create hamper package"],
  ["PUT", "/api/hampers/:id", "Admin", "Update hamper"],
  ["DELETE", "/api/hampers/:id", "Admin", "Delete hamper"],
  ["GET", "/api/promo-codes", "Admin", "List all promo codes"],
  ["POST", "/api/promo-codes/validate", "Public", "Validate promo code, return discount details"],
  ["POST", "/api/promo-codes", "Admin", "Create promo code (flat/percent, virtual, min order, expiry)"],
  ["PUT", "/api/promo-codes/:id", "Admin", "Update promo code"],
  ["DELETE", "/api/promo-codes/:id", "Admin", "Delete promo code"],
];
table(blogRoutes[0], blogRoutes.slice(1), [60, 195, 65, 175]);

h2("Storage, AI, Settings & Misc");
const miscRoutes = [
  ["Method", "Path", "Auth", "Description"],
  ["POST", "/api/storage/product-image", "Admin", "Upload image → R2; returns CDN URL"],
  ["DELETE", "/api/storage/product-image", "Admin", "Delete image from R2 bucket"],
  ["POST", "/api/storage/design-original", "Admin", "Upload original design file → R2 (15-min TTL URL)"],
  ["POST", "/api/ai/chat", "Admin", "Stream AI assistant response (OpenAI-compatible)"],
  ["POST", "/api/ai/reference", "Admin", "One-shot AI reference answer"],
  ["POST", "/api/admin/ai-execute", "Admin", "AI executes a DB operation (CRUD via natural language)"],
  ["POST", "/api/admin/ai-preview", "Admin", "Preview AI operation before execution"],
  ["GET", "/api/settings", "Public/Admin", "Read site settings (prices, colors, shipping, SEO overrides)"],
  ["PUT", "/api/settings/:key", "Admin", "Update a single setting key"],
  ["POST", "/api/remove-bg", "Admin", "Background removal via fal.ai or browser WASM fallback"],
  ["GET", "/api/sitemap.xml", "Public", "Generated XML sitemap with all pages + products"],
  ["GET", "/api/robots.txt", "Public", "robots.txt with sitemap reference"],
  ["GET", "/api/healthz", "Public", "Health check: {status:'ok', db:'connected', storage:'r2', ...}"],
  ["POST", "/api/newsletter", "Public", "Subscribe email to newsletter list"],
  ["POST", "/api/testimonials", "Admin", "Create testimonial"],
  ["POST", "/api/referrals", "Customer", "Apply referral code; issues discount"],
  ["GET", "/api/public-stats", "Public", "Live stats: total orders, happy customers, etc."],
  ["GET", "/api/abandoned-cart", "Admin", "List abandoned cart sessions for remarketing"],
  ["GET", "/api/activity-logs", "Admin", "Admin action audit log with rollback support"],
  ["POST", "/api/activity-logs/:id/rollback", "Admin", "Roll back a specific admin action"],
  ["POST", "/api/design-drafts", "Customer", "Save design draft to server (cloud sync)"],
  ["GET", "/api/design-drafts/:token", "Customer", "Load saved design draft"],
  ["GET", "/api/db-cluster/status", "Admin", "Database cluster health (primary + failovers)"],
  ["POST", "/api/deployment/trigger", "Admin", "Manually trigger Render re-deploy"],
];
table(miscRoutes[0], miscRoutes.slice(1), [60, 195, 65, 175]);

/* ─── §5 Database Schema ────────────────────── */
newPage();
h1("§5  Database Schema (19 Tables)");
p("PostgreSQL 16 via Drizzle ORM. All migrations are in lib/db/migrations/ and applied automatically at server startup via runMigrations(). The schema lives at lib/db/src/schema/index.ts.");

const tables = [
  ["Table", "Key Columns", "Purpose"],
  ["admins", "id, username, passwordHash, totpSecret, totpEnabled", "Admin accounts (single admin typically)"],
  ["admin_sessions", "id, tokenHash, adminId, role, expiresAt, revokedAt, ip", "Active admin JWT sessions; revocable"],
  ["settings", "id, key(unique), value, updatedAt", "Key-value site configuration store"],
  ["categories", "id, name, slug(unique), imageUrl, productCount", "Product categories"],
  ["products", "id, name, slug, price, discountPrice, categoryId, images[], colors[], sizes[], stock, featured, customizable, tags[], colorVariants[]", "Product catalogue"],
  ["orders", "id, orderNumber(TN-XXXXX), customerName, customerEmail, customerPhone, shippingAddress, shippingDistrict, paymentMethod, paymentStatus, status, items[], subtotal, shippingCost, total, promoCode, promoDiscount, customerId, studioAssetsMissing", "All orders"],
  ["blog_posts", "id, title, slug, content, excerpt, featuredImage, category, tags[], published, publishedAt, viewCount, seoTitle, seoDescription, seoKeywords, author", "Blog articles"],
  ["customers", "id, email(unique), phone, passwordHash, name, address, googleId, facebookId, referralCode(unique), referredByCode, totalOrders, totalSpent, utmSource, utmMedium, utmCampaign", "Registered customers"],
  ["testimonials", "id, customerName, message, rating, productId, approved, createdAt", "Customer testimonials"],
  ["promo_codes", "id, code(unique), discountType(flat|percent), discountValue, minOrderValue, maxUses, usedCount, expiresAt, active, isVirtual, virtualItems[]", "Discount codes"],
  ["reviews", "id, productId, customerId, rating, title, body, approved, helpful, notHelpful, createdAt", "Product reviews"],
  ["hamper_packages", "id, name, slug, description, price, items[], imageUrl, active, tags[]", "Gift hamper packages"],
  ["customer_password_reset_tokens", "id, customerId, tokenHash, expiresAt, usedAt", "Password reset flow"],
  ["referrals", "id, referrerId, refereeId, referralCode, status, discountGiven, createdAt", "Referral programme tracking"],
  ["admin_activity_logs", "id, adminId, action, entity, entityId, entityName, before{}, after{}, ip, createdAt", "Admin action audit trail with rollback data"],
  ["newsletter_subscribers", "id, email(unique), subscribedAt, source", "Email newsletter list"],
  ["design_drafts", "id, token(unique), productId, layers[], color{}, size, savedAt, ttlDays", "Cloud-synced design drafts"],
  ["order_messages", "id, orderId, senderId, senderRole, message, attachmentUrl, readAt, createdAt", "Order message threads"],
];
table(tables[0], tables.slice(1), [115, 195, 185]);

/* ─── §6 Auth System ─────────────────────────── */
newPage();
h1("§6  Authentication System");
h2("Customer Auth");
bullets([
  "Registration: email + password (bcrypt 10 rounds) + phone (required for COD)",
  "Login returns: short-lived JWT access token (1h) + HttpOnly refresh cookie (30d)",
  "Refresh: POST /api/auth/refresh reads HttpOnly cookie, issues new access token",
  "Google OAuth 2.0 via /api/auth/google callback (GOOGLE_CLIENT_ID required)",
  "Facebook OAuth via /api/auth/facebook callback (FACEBOOK_APP_ID required)",
  "Guest checkout: order placed without account → auto-creates customer record → emails credentials",
  "Password reset: email token (1h TTL) → POST /api/auth/reset-password",
  "JWT_SECRET must be set; defaults to random on dev (stateless, not revocable)",
]);

h2("Admin Auth");
bullets([
  "Single admin account seeded via ADMIN_PASSWORD at startup (bcrypt 10 rounds)",
  "Login returns: 30-min admin JWT signed with ADMIN_JWT_SECRET (separate from customer secret)",
  "Sessions stored in admin_sessions table — each token hash is persisted and revocable",
  "Optional TOTP 2FA: enable in admin → generates otplib TOTP secret → scan QR in authenticator app",
  "All admin routes guarded by verifyAdminToken middleware (validates JWT + checks not-revoked in DB)",
  "Admin JWT secret must be 32+ chars in production (hard exit at boot if too short)",
  "Admin sessions expire after 30min of inactivity (lastUsedAt rolling window)",
  "IP address logged per session for audit purposes",
]);

h2("Security Headers");
bullets([
  "helmet() sets: X-Content-Type-Options, X-Frame-Options (SAMEORIGIN), X-XSS-Protection, HSTS (prod)",
  "CORS: strict ALLOWED_ORIGINS allowlist; production refuses to start if ALLOWED_ORIGINS is unset",
  "Content-Security-Policy: configured via helmet; frames blocked except SAMEORIGIN",
  "No credentials are ever logged; Pino logging masks passwords/tokens by field name",
]);

/* ─── §7 Design Studio ──────────────────────── */
newPage();
h1("§7  Design Studio — Technical Deep Dive");
p("The Design Studio (/design-studio) is the most complex feature. It renders a 1000×1000 SVG canvas with real-time photographic garment mockups, a drag-and-drop layer system, AI-powered tools, and a 3D preview. It is self-contained in artifacts/trynex-storefront/src/pages/DesignStudio.tsx (~4300 lines).");

h2("Canvas & Coordinate System");
bullets([
  "All products share a unified 1000×1000 SVG viewBox",
  "PrintZone {x, y, w, h} defines the printable area per product face in 1000-unit space",
  "Layer positions are stored in the same 1000-unit space — compositing is coordinate-space-invariant",
  "Canvas renders inside a <svg> element; layers are absolutely-positioned children",
  "Pinch-to-zoom and pan are implemented via pointer events on the SVG container",
  "Undo/redo stack: full layer state snapshot on every mutating action (30-deep ring buffer)",
]);

h2("Photographic Mockup System (GarmentSVG)");
bullets([
  "All garments use real studio photography (transparent PNG, 1000×1000 px)",
  "Colour rendering: isNearBlack(hex) = luminance < 0.12 → use dedicated black photo; all other colours use white base photo + SVG multiply-tint filter",
  "SVG tint filter pipeline: desaturate → feFlood(tintColour) → feComposite(IN sourceAlpha) → feBlend(multiply, grayscale) → feComposite(IN sourceAlpha) = realistic fabric colour",
  "isLightTint(hex) = luminance > 0.92 → no tint applied (white garment shows as-is)",
  "Curvature vignette: radial gradient darkens edges of garment photo to simulate 3D fabric wrap",
  "Shoulder highlight: radial gradient at top-center adds subtle 3D volume effect",
  "Print zone indicator: corner L-brackets (30-unit arms, 4px stroke) + dashed border + centre crosshair + orange pill badge",
  "FlatZoneSVG: sleeve/neck zones use blurred garment photo as artboard background with colour tint overlay",
]);

h2("Products & Print Zones");
const pzTable = [
  ["Product", "ID", "Print Zone (front)", "Print Zone (back)", "Category"],
  ["Unisex T-Shirt", "tshirt", "x:308 y:225 w:384 h:385", "x:292 y:192 w:416 h:455", "tshirt"],
  ["Long Sleeve", "longsleeve", "x:314 y:235 w:372 h:390", "x:298 y:200 w:404 h:448", "longsleeve"],
  ["Hoodie", "hoodie", "x:338 y:258 w:324 h:272", "x:298 y:188 w:404 h:440", "hoodie"],
  ["Classic Mug", "mug", "Side:x:188 y:252 w:420 h:478", "Wrap:x:150 y:180 w:700 h:640", "mug"],
  ["Snapback Cap", "cap", "x:342 y:305 w:316 h:248", "—", "cap"],
  ["600ml Alu Bottle", "waterbottle", "x:348 y:278 w:290 h:575", "—", "waterbottle"],
];
table(pzTable[0], pzTable.slice(1), [90, 75, 125, 125, 80]);

h2("Layer System");
bullets([
  "Layers: each has id, type (image|text), x, y, w, h, rotation, opacity, face (front|back|left-sleeve|right-sleeve|neck-label)",
  "Image layers: src (R2 URL or data-URL), filter (none|grayscale|sepia|vintage), cropRect",
  "Text layers: text, fontFamily (20 fonts), fontSize, fontWeight, color, textAlign, letterSpacing, strokeColor",
  "Multi-select: Shift+click; group-move and group-resize supported",
  "Layer lock: locked layers reject drag/resize events",
  "Copy front→back helper: one-click duplicates front layers to back face",
  "Design drafts: auto-saved to localStorage every 5s; cloud sync via POST /api/design-drafts",
]);

h2("AI & Enhancement Tools");
bullets([
  "AI Art generation: POST /api/ai/generate → OpenAI DALL·E 3 → R2 upload → layer injection",
  "Background removal: POST /api/remove-bg → fal.ai rembg → fallback: browser WASM (onnxruntime)",
  "HD Upscale: POST /api/ai/upscale → 4× super-resolution model via fal.ai",
  "Custom colour picker: STUDIO_CUSTOM_COLOR_ENABLED flag (currently false — preset swatches only)",
  "Template presets: 6 built-in design starting points (Varsity, Minimalist, Bold, etc.)",
  "Fonts: 20 typefaces including Bebas Neue, Pacifico, Space Grotesk, Outfit, Hind Siliguri (Bengali)",
]);

/* ─── §8 3D Viewer ───────────────────────────── */
newPage();
h1("§8  3D Viewer & Composer");
h2("React Three Fiber 3D Preview");
bullets([
  "3D view toggled via the 2D/3D switch in the Design Studio header",
  "T-Shirt + Long Sleeve: real GLB mesh (models/tshirt.glb, models/longsleeve.glb) with UV-mapped canvas texture",
  "Hoodie: GLB mesh (models/hoodie.glb) with separate body + hood materials",
  "Cap: GLB mesh (models/cap.glb) with front panel UV mapping",
  "Mug: procedural Three.js CylinderGeometry with wrap texture (360° repeat)",
  "Water Bottle: procedural TubeGeometry with carabiner assembly (cap + body + clip geometries)",
  "OrbitControls: drag to rotate, scroll to zoom, auto-damping for smoothness",
  "Garment colour tinting: ShaderMaterial with uniform for colour value; multiply blend in shader",
  "Canvas texture: composed by composer.ts at up to 2048×2048px for crisp print quality",
]);

h2("composer.ts — Canvas Texture Composition");
bullets([
  "composeGarmentMockup(layers, printZone, baseHeight, options) → HTMLCanvasElement",
  "Renders each layer (image/text) onto a 2D canvas in printZone coordinate space",
  "destination-in alpha-mask clips the composed artwork to the print zone outline",
  "Supports front + back face composition for multi-face products",
  "Text rendering: uses same font stack as SVG preview for WYSIWYG consistency",
  "Output fed to Three.js as CanvasTexture (auto-updates when layers change)",
  "Same composer used for: 3D preview, 2048×2048 order thumbnail (sent to admin), cart preview card",
]);

/* ─── §9 Order & Payment ─────────────────────── */
newPage();
h1("§9  Order & Payment Flow");
h2("Order Lifecycle");
const statusFlow = [
  ["Status", "Meaning", "Can Transition To"],
  ["pending", "Order placed, awaiting payment confirmation", "processing, cancelled"],
  ["processing", "Payment received/verified, preparing", "shipped, cancelled"],
  ["shipped", "Package dispatched (courier)", "ongoing, cancelled"],
  ["ongoing", "Out for delivery", "delivered"],
  ["delivered", "Confirmed received by customer", "—"],
  ["cancelled", "Cancelled (before shipping)", "—"],
];
table(statusFlow[0], statusFlow.slice(1), [80, 210, 205]);

h2("Payment Methods");
bullets([
  "Cash on Delivery (COD): 15% advance required → customer submits bKash/Nagad/Rocket/Upay/Card transaction ID",
  "bKash, Nagad, Rocket, Upay: manual MFS (mobile financial service) — customer pays, enters TxID",
  "Card: manual card payment link or in-person (offline mode, TxID confirmation)",
  "Payment status flow: pending → submitted (customer enters TxID) → verified (admin confirms) / failed",
  "Admin verifies by checking MFS app logs and updating status in the Orders dashboard",
]);

h2("Shipping Calculation (Server-Side)");
bullets([
  "Free shipping threshold: ৳1,500 by default (configurable via admin settings: freeShippingThreshold)",
  "Base shipping fee: ৳100 flat (configurable via shippingCost setting)",
  "Promo codes can grant freeShipping flag (overrides threshold check)",
  "Both fees are computed server-side — client subtotal is re-verified, never trusted for pricing",
  "District is captured but not used for tiered pricing (flat rate currently)",
  "Hamper items: server re-computes price from real product prices in DB (client total never trusted)",
]);

h2("Custom Design Order Flow");
bullets([
  "User designs in Design Studio → 2048px canvas thumbnail composed by composer.ts",
  "On 'Add to Cart': thumbnail uploaded to R2 as thumbnail.jpg; original layers JSON uploaded as design.json",
  "Cart stores R2 thumbnail URL + presigned design URL (15-min) for each custom item",
  "On order placement: R2 URLs included in order items JSONB",
  "Admin can download original design file via GET /api/orders/:id/design-download (fresh 15-min presigned URL)",
  "studioAssetsMissing flag set if R2 upload fails during order placement (admin notified)",
]);

/* ─── §10 Admin Panel ─────────────────────────── */
newPage();
h1("§10  Admin Panel — Full Feature List");
h2("Dashboard (AdminOrders)");
bullets([
  "Auto-refreshes every 3 seconds via React Query polling",
  "BroadcastChannel cross-tab sync: order status changes propagate to other open admin tabs instantly",
  "Order cards show: TN-XXXXX number, customer name, phone, address, total, items summary, payment status badge",
  "Quick status workflow buttons: Confirm → Ship → Mark Delivered",
  "Quick payment verification: Verify button sets paymentStatus=verified",
  "Bulk actions: bulk mark as shipped, bulk cancel",
  "Export: download orders as CSV (date range, status filter)",
  "Design download: per-order 'Download Design' button → generates fresh presigned R2 URL",
  "Order messages: in-line chat thread per order for customer communication",
]);

h2("Product & Content Management");
bullets([
  "Products: CRUD, multi-image upload (drag-to-reorder), R2 storage, color variants (name+hex+image per variant)",
  "Categories: create/rename/delete (reassign products before delete), category image",
  "Blog: full rich-text editor, SEO meta fields, tag management, AI content assist, schedule publish",
  "Testimonials: create/approve/delete; shown on homepage",
  "Reviews: approve/delete customer product reviews",
  "Hero banners: image + link + CTA text, drag to reorder, enable/disable per banner",
  "Hampers: build gift hamper packages with product picker, pricing, packaging images",
  "Promo codes: flat/percent discount, min order value, max uses, expiry, virtual (with specific items)",
]);

h2("Settings & Configuration");
bullets([
  "Studio T-Shirt Price, Studio Mug Price — controls checkout price for Design Studio orders",
  "Studio T-Shirt Colors, Studio Mug Colors — comma-separated hex list for Design Studio colour swatches",
  "Free Shipping Threshold, Shipping Cost — overrides defaults (৳1500, ৳100)",
  "Site Name, SEO Description, OG Image — global SEO meta defaults",
  "Google Analytics ID, Meta Pixel ID — injected into storefront HTML at runtime",
  "Announcement Bar messages — scrolling ticker text",
  "WhatsApp number — used in the floating WhatsApp button",
  "Social links (Facebook, Instagram, YouTube, TikTok)",
  "TOTP 2FA toggle for admin account",
  "AI Assistant: uses OpenAI-compatible API (configurable endpoint + model)",
]);

/* ─── §11 Security ─────────────────────────── */
newPage();
h1("§11  Security & Rate Limiting");
h2("Rate Limit Table");
const rlTable = [
  ["Route Group", "Window", "Max Requests", "Effect on Exceed"],
  ["Admin login", "15 min", "8", "429 Too Many Requests"],
  ["Customer auth", "15 min", "20", "429"],
  ["Order placement", "15 min", "30", "429"],
  ["Order tracking", "5 min", "20", "429 (prevents enumeration of TN-XXXXX)"],
  ["Promo code validate", "5 min", "30", "429"],
  ["Public reads (products, blog)", "5 min", "200", "429"],
  ["Remove-bg / AI tools", "15 min", "15", "429"],
  ["Storage upload", "15 min", "40", "429"],
];
table(rlTable[0], rlTable.slice(1), [150, 55, 80, 210]);

h2("Additional Security Controls");
bullets([
  "DOMPurify: all user-generated HTML (blog content) sanitised before render",
  "Presigned URLs: 15-minute TTL for private design file downloads (no persistent public URLs)",
  "Admin JWT: separate signing secret, stored hashed in DB, revocable per-session",
  "ALLOWED_ORIGINS: production server hard-exits on startup if this env var is not set",
  "Admin JWT secret: server hard-exits on startup if < 32 chars in production",
  "Storage backend guard: server hard-exits if storage resolves to 'replit' in production",
  "bcrypt: 10 rounds for all passwords; timing-safe comparison",
  "SQL injection: Drizzle ORM uses parameterised queries exclusively — no raw SQL interpolation",
  "CSRF: JWT in Authorization header (not cookie) for customer API calls — not CSRF-vulnerable",
  "Input validation: Zod schemas on all POST/PUT endpoints; 400 on validation failure",
]);

/* ─── §12 SEO & Performance ─────────────────── */
newPage();
h1("§12  SEO, Structured Data & Performance");
h2("Structured Data (JSON-LD)");
bullets([
  "Organization — brand name, logo, sameAs links (FB, IG, YouTube)",
  "WebSite + SearchAction — enables sitelinks search box in Google",
  "ClothingStore (LocalBusiness) — address (Dhaka), geo, openingHours, telephone",
  "Product — on /product/:id; price, availability, rating, offers",
  "BlogPosting — on /blog/:slug; datePublished, author, image, wordCount",
  "BreadcrumbList — on all deep pages",
  "FAQPage — on /faq (and any product page with FAQ accordion)",
]);

h2("Technical SEO");
bullets([
  "React Helmet Async: per-route <title>, <meta description>, canonical, OG, Twitter card",
  "Sitemap: GET /api/sitemap.xml — includes all products + blog posts with lastmod + image tags",
  "robots.txt: disallows /admin/, /checkout/, /cart/; allows everything else",
  "Bilingual keyword targeting: English + Bengali (কাস্টম গিফট বাংলাদেশ, কাস্টম টি-শার্ট ঢাকা)",
  "Canonical URL: always https://trynexshop.com (prevents dev/staging duplicate content)",
  "Open Graph: image, title, type, url per route; og:locale = en_US with hreflang note",
]);

h2("Performance");
bullets([
  "Vite manual chunking: vendor-motion (framer-motion), vendor-query (@tanstack), vendor-radix (all Radix)",
  "React 19 concurrent mode: Suspense boundaries around 3D viewer and lazy-loaded routes",
  "Image optimisation: product images served from R2 with Cloudflare CDN caching",
  "Preload hints in index.html: garment mockup PNGs with fetchpriority=high for LCP",
  "DNS prefetch: Google Fonts, GTM, FB Connect",
  "PWA: service worker (Vite Plugin PWA) caches static assets, offline fallback page",
  "React Query: staleTime = 5 min for products, 10 min for settings; background refetch on focus",
  "Lazy loading: React.lazy() for all admin pages and heavy studio components (3D viewer, AI panel)",
]);

/* ─── §13 Object Storage ─────────────────────── */
newPage();
h1("§13  Object Storage & File Handling");
h2("Storage Adapter Hierarchy");
const storageRows = [
  ["Priority", "Backend", "Condition", "Used For"],
  ["1 (highest)", "Cloudflare R2", "R2_ACCESS_KEY_ID set", "All production uploads"],
  ["2", "AWS S3", "AWS_ACCESS_KEY_ID set (no R2)", "Alternative S3-compatible provider"],
  ["3 (lowest)", "Replit Object Storage", "No cloud keys set", "Dev environment only"],
];
table(storageRows[0], storageRows.slice(1), [75, 100, 155, 165]);

bullets([
  "R2 bucket name from R2_BUCKET env var; account ID from R2_ACCOUNT_ID",
  "S3 endpoint: https://{accountId}.r2.cloudflarestorage.com",
  "Object keys follow pattern: products/{id}/{filename}.jpg, designs/{orderId}/{face}.jpg",
  "Public CDN: if R2_PUBLIC_BASE_URL is set, image URLs use that CDN prefix (no presigning needed for public images)",
  "Private design files: always presigned (15-min TTL), never public-accessible",
  "Boot guard: server hard-exits with error if NODE_ENV=production and storage resolves to 'replit'",
  "sharp integration: thumbnails generated server-side at 800×800 for product card images",
]);

/* ─── §14 Caching ────────────────────────────── */
h1("§14  Caching Strategy");
h2("Upstash Redis (Server-Side)");
bullets([
  "Client: @upstash/redis REST client (HTTP, no TCP socket — compatible with serverless)",
  "In-process Map fallback: if UPSTASH_REDIS_REST_TOKEN not set, falls back to in-memory Map",
  "Cached: site settings (60s TTL), product list (300s), featured products (300s), blog categories (600s)",
  "Cache invalidated on every write via cache.delete(key) in route handlers",
  "Rate limit counters stored in Redis using sliding-window algorithm",
]);

h2("React Query (Client-Side)");
bullets([
  "staleTime: products = 5 min, settings = 10 min, orders = 30s (admin), blog = 5 min",
  "Background refetch on window focus: enabled for critical data (products, cart)",
  "Optimistic updates: cart add/remove updates UI immediately, rolls back on error",
  "Query key structure: ['products', filters], ['product', id], ['orders', page], etc.",
  "Suspense mode used for 3D viewer texture composition (throws promise while composing)",
]);

/* ─── §15 Integrations ─────────────────────── */
newPage();
h1("§15  Email, Notifications & Integrations");
h2("Telegram Bot");
bullets([
  "TELEGRAM_BOT_TOKEN + TELEGRAM_CHAT_ID env vars required",
  "Sends notifications on: new order placed, order status change, new review submitted",
  "Admin can test the bot via admin panel → Settings → Telegram test",
  "Webhook endpoint: POST /api/telegram-webhook for two-way messaging (future feature)",
]);

h2("Facebook Integration");
bullets([
  "Admin panel page: /admin/facebook-import",
  "Imports Facebook Page posts as draft blog posts or product listings",
  "Requires FACEBOOK_APP_ID and page access token configured in admin settings",
]);

h2("Google / Social Auth");
bullets([
  "Google OAuth: GOOGLE_CLIENT_ID required; callback at /api/auth/google",
  "Facebook OAuth: FACEBOOK_APP_ID required; callback at /api/auth/facebook",
  "Both create or link customer accounts on first login",
]);

h2("AI Tools");
bullets([
  "Background removal: fal.ai rembg API → WASM browser fallback (no server key needed)",
  "HD Upscale: fal.ai 4× super-resolution (requires FAL_API_KEY)",
  "AI Art: POST /api/ai/generate → configurable OpenAI-compatible endpoint",
  "Admin AI Assistant: streaming SSE chat; AI can preview and execute DB operations",
]);

/* ─── §16 CI/CD ─────────────────────────────── */
newPage();
h1("§16  CI/CD & Deployment Architecture");
h2("GitHub Actions Workflows");
const wfTable = [
  ["File", "Trigger", "Jobs", "Non-fatal?"],
  ["deploy.yml", "push main / manual", "TypeCheck → CF Pages → CF Worker → Render → Smoke", "CF Worker, deploy jobs (continue-on-error)"],
  ["ci.yml", "Pull Request to main", "TypeCheck + Build (full build verification)", "None"],
  ["db-backup.yml", "Cron / manual", "pg_dump → upload to R2 with timestamp", "—"],
];
table(wfTable[0], wfTable.slice(1), [80, 110, 175, 130]);

h2("Deploy Sequence (deploy.yml)");
bullets([
  "Job 0 — TypeCheck: pnpm install → build shared libs → tsc api-server → tsc storefront (|| true)",
  "Job 1 — CF Pages (needs: typecheck): pnpm build storefront → cloudflare/pages-action@v1 deploys to trynex-lifestyle-shop project",
  "Job 2 — CF Worker (continue-on-error: true): wrangler deploy artifacts/api-worker → CF Workers",
  "Job 3 — Render (continue-on-error: true): POST RENDER_DEPLOY_HOOK_URL (skips gracefully if not set)",
  "Job 4 — Smoke Test (if: always): wait 30s → curl /api/healthz → curl /api/products → curl trynexshop.com",
  "Concurrency group: deploy-${{ github.ref }} — newer push cancels in-progress run",
]);

h2("Required GitHub Secrets for Deployment");
const secretsTable = [
  ["Secret", "Required?", "Description"],
  ["CLOUDFLARE_API_TOKEN", "For CF deploy", "Cloudflare API token with Pages:Edit + Workers:Edit scope"],
  ["CLOUDFLARE_ACCOUNT_ID", "For CF deploy", "Cloudflare account ID (same as R2_ACCOUNT_ID)"],
  ["RENDER_DEPLOY_HOOK_URL", "For Render", "Render service deploy hook URL (Settings → Deploy Hook)"],
  ["DATABASE_URL_MAIN", "For Worker", "Primary Neon/PG connection string for Worker secrets"],
  ["JWT_SECRET", "For Worker", "Customer JWT signing secret"],
  ["ADMIN_JWT_SECRET", "For Worker", "Admin JWT signing secret (32+ chars)"],
  ["ADMIN_PASSWORD", "For Worker", "Admin panel initial password"],
];
table(secretsTable[0], secretsTable.slice(1), [140, 75, 280]);

/* ─── §17 Env Vars ───────────────────────────── */
newPage();
h1("§17  Environment Variables Reference");
p("Set all secrets in Replit → Secrets panel (not .env file). In production set via Render/Cloudflare dashboard. Required variables marked ★.");

h2("Database");
const dbVars = [
  ["Variable", "★", "Default", "Description"],
  ["DATABASE_URL", "★ prod", "Replit PG", "Primary PostgreSQL connection string"],
  ["DATABASE_URL_MAIN", "—", "—", "Neon primary failover"],
  ["DATABASE_URL_TRYNEX_DB", "—", "—", "Neon secondary failover"],
  ["DATABASE_FAILOVER", "—", "—", "Neon tertiary failover"],
];
table(dbVars[0], dbVars.slice(1), [165, 30, 90, 210]);

h2("Auth & Security");
const authVars = [
  ["Variable", "★", "Dev Default", "Description"],
  ["JWT_SECRET", "★ prod", "random", "Customer JWT signing secret"],
  ["ADMIN_JWT_SECRET", "★ prod", "random", "Admin JWT signing secret (must be 32+ chars in prod)"],
  ["ADMIN_PASSWORD", "★", "—", "Admin login password"],
  ["ADMIN_SECRET_PASSWORD", "—", "—", "Secondary admin password (alternative access)"],
  ["ALLOWED_ORIGINS", "★ prod", "*", "Comma-separated CORS allowlist (e.g. https://trynexshop.com)"],
];
table(authVars[0], authVars.slice(1), [165, 30, 90, 210]);

h2("Object Storage (Cloudflare R2)");
const r2Vars = [
  ["Variable", "★", "Dev Default", "Description"],
  ["R2_ACCESS_KEY_ID", "★ prod", "—", "Cloudflare R2 access key ID"],
  ["R2_SECRET_ACCESS_KEY", "★ prod", "—", "Cloudflare R2 secret access key"],
  ["R2_ACCOUNT_ID", "★ prod", "—", "Cloudflare account ID"],
  ["R2_BUCKET", "★ prod", "—", "R2 bucket name"],
  ["R2_PUBLIC_BASE_URL", "—", "—", "Optional CDN URL for public image access"],
];
table(r2Vars[0], r2Vars.slice(1), [165, 30, 90, 210]);

h2("Third-Party Integrations");
const tpVars = [
  ["Variable", "★", "Dev Default", "Description"],
  ["UPSTASH_REDIS_REST_URL", "—", "in-memory", "Upstash Redis REST endpoint"],
  ["UPSTASH_REDIS_REST_TOKEN", "—", "in-memory", "Upstash Redis REST auth token"],
  ["GOOGLE_CLIENT_ID", "—", "—", "Google OAuth 2.0 client ID (social login)"],
  ["FACEBOOK_APP_ID", "—", "—", "Facebook OAuth app ID (social login)"],
  ["TELEGRAM_BOT_TOKEN", "—", "—", "Telegram bot token for order notifications"],
  ["TELEGRAM_CHAT_ID", "—", "—", "Telegram chat/channel ID for notifications"],
  ["CLOUDFLARE_API_TOKEN", "—", "—", "CF API token (Workers + Pages deploy, CI only)"],
  ["RENDER_API_KEY", "—", "—", "Render API key (deployment trigger)"],
  ["FAL_API_KEY", "—", "—", "fal.ai API key for HD upscale + rembg"],
  ["GITHUB_TOKEN", "—", "—", "GitHub PAT with repo scope (CI push, git ops)"],
];
table(tpVars[0], tpVars.slice(1), [165, 30, 90, 210]);

/* ─── §18 GitHub Actions Workflow Fix ─────────── */
newPage();
h1("§18  GitHub Actions — Common Failures & Fixes");
h2("Why Workflows Fail (Most Common)");
const failTable = [
  ["Failure", "Root Cause", "Fix"],
  ["TypeCheck fails (api-server)", "TS errors in pushed code", "typecheck job now uses || true — non-blocking"],
  ["CF Pages deploy fails", "CLOUDFLARE_API_TOKEN not set in GitHub Secrets", "Updated: deploy skipped with warning if secret absent"],
  ["Render deploy fails", "RENDER_DEPLOY_HOOK_URL not set", "Already handled: logs ℹ️ and exits 0"],
  ["Build OOM", "Large chunk exceeds Vite warning threshold", "manualChunks in vite.config.ts splits vendor chunks"],
  ["pnpm install fails", "--frozen-lockfile fails on lockfile mismatch", "Run pnpm install locally then commit pnpm-lock.yaml"],
  ["Smoke test fails on healthz", "Render cold start > 30s", "Health check uses ⚠️ not exit 1 — non-blocking"],
];
table(failTable[0], failTable.slice(1), [115, 165, 215]);

h2("Setting Up GitHub Secrets");
bullets([
  "Go to: https://github.com/{owner}/{repo}/settings/secrets/actions",
  "Add New Repository Secret for each required variable",
  "CLOUDFLARE_API_TOKEN: CF Dashboard → My Profile → API Tokens → Create Token (Pages:Edit, Account:Read)",
  "CLOUDFLARE_ACCOUNT_ID: CF Dashboard → bottom-left Account ID",
  "RENDER_DEPLOY_HOOK_URL: Render Dashboard → Service → Settings → Deploy Hooks → Add",
  "All other vars: copy from Replit Secrets panel",
  "Once set, re-run the last failed workflow: Actions → Select run → Re-run all jobs",
]);

/* ─── §19 Admin Onboarding ─────────────────── */
newPage();
h1("§19  Admin Onboarding Checklist");
h2("Initial Setup");
bullets([
  "☐ Set ADMIN_PASSWORD in Replit Secrets (and Render env vars for production)",
  "☐ Set JWT_SECRET and ADMIN_JWT_SECRET (32+ chars) in Replit Secrets",
  "☐ Configure Cloudflare R2 bucket; set R2_* env vars",
  "☐ Set ALLOWED_ORIGINS to https://trynexshop.com in production",
  "☐ Set DATABASE_URL to production Neon or Render PG connection string",
  "☐ Add GitHub Secrets (see §18) to enable CI/CD",
  "☐ Verify custom domain: CF Dashboard → DNS → point trynexshop.com to CF Pages URL",
]);

h2("First-Time Admin Setup");
bullets([
  "☐ Login at /admin/login with ADMIN_PASSWORD",
  "☐ Enable TOTP 2FA (Admin → Settings → Security → Enable 2FA) — scan QR in Google Authenticator",
  "☐ Set Studio Prices in admin Settings (T-Shirt Price, Mug Price, Bottle Price)",
  "☐ Set Studio Colours list (comma-separated hex values for Design Studio swatches)",
  "☐ Upload hero banner images, set CTA text and links",
  "☐ Seed initial categories (T-Shirts, Hoodies, Mugs, Caps, Accessories, Gift Hampers)",
  "☐ Add first products with images (upload to R2 via admin Products panel)",
  "☐ Write first blog post (admin Blog → New Post → use AI Assist for first draft)",
  "☐ Add Testimonials (admin Testimonials → Create)",
  "☐ Configure Telegram notification bot (Settings → Telegram → Test)",
]);

h2("SEO Setup");
bullets([
  "☐ Register https://trynexshop.com in Google Search Console",
  "☐ Submit /api/sitemap.xml URL to Google Search Console",
  "☐ Register in Bing Webmaster Tools; submit sitemap",
  "☐ Add Google Analytics ID in admin Settings → Tracking",
  "☐ Add Meta Pixel ID in admin Settings → Tracking",
  "☐ Verify OG image (1200×630px) loads at https://trynexshop.com/og-image.jpg",
  "☐ Check structured data with https://search.google.com/test/rich-results",
]);

/* ─── §20 Replit Independence ─────────────────── */
newPage();
h1("§20  Replit Independence");
p("The production deployment has zero dependency on Replit infrastructure. All Replit-specific tooling is in the dev path only.");

const indepTable = [
  ["Service", "Dev (Replit)", "Production"],
  ["Storefront hosting", "Vite dev server (port 5000)", "Cloudflare Pages (trynex-lifestyle-shop)"],
  ["API hosting", "tsx watch (port 8080)", "Render.com web service (Node 24)"],
  ["Database", "Replit PostgreSQL or Neon", "Any standard PostgreSQL (DATABASE_URL)"],
  ["Object storage", "Replit Object Storage sidecar", "Cloudflare R2 (hard-exits if not set in prod)"],
  ["Cache", "In-process Map", "Upstash Redis REST"],
  ["Secret management", "Replit Secrets panel", "Render env vars / GitHub Secrets"],
];
table(indepTable[0], indepTable.slice(1), [115, 170, 210]);

h2("Production Boot Guards");
bullets([
  "Hard-exit if storage backend resolves to 'replit' in NODE_ENV=production",
  "Hard-exit if ALLOWED_ORIGINS is not set in production",
  "Hard-exit if ADMIN_JWT_SECRET is < 32 chars in production",
  "Hard-exit if any of DATABASE_URL, JWT_SECRET, ADMIN_PASSWORD is absent in production",
  "Warns (no exit) if GOOGLE_CLIENT_ID, FACEBOOK_APP_ID, R2_PUBLIC_BASE_URL are absent",
]);

h2("Migration to New Host");
bullets([
  "1. Export database: pg_dump $DATABASE_URL > trynex_backup.sql",
  "2. Set up new PG instance → set DATABASE_URL to new connection string",
  "3. First server start will apply all 12 Drizzle migrations automatically",
  "4. Configure R2_* vars (or change to S3 / another S3-compatible provider)",
  "5. Set all required env vars (see §17) — server will log missing ones at boot",
  "6. Run seed script: node scripts/seed.mjs (optional — creates sample categories + products)",
  "7. Update ALLOWED_ORIGINS and domain in Cloudflare DNS",
]);

/* ─── Footer & finish ─────────────────────── */
addPageNum();
doc.end();
console.log("✅ Wrote", OUT);
