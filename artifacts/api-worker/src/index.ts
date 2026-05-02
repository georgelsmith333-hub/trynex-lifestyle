import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import type { AppEnv } from "./types";

import categoriesRoutes from "./routes/categories";
import testimonialsRoutes from "./routes/testimonials";
import referralsRoutes from "./routes/referrals";
import newsletterRoutes from "./routes/newsletter";
import publicStatsRoutes from "./routes/publicStats";
import sitemapRoutes from "./routes/sitemap";
import seoRoutes from "./routes/seo";
import productsRoutes from "./routes/products";
import hampersRoutes from "./routes/hampers";
import reviewsRoutes from "./routes/reviews";
import promoCodesRoutes from "./routes/promoCodes";
import removeBgRoutes from "./routes/removeBg";
import blogRoutes from "./routes/blog";
import settingsRoutes from "./routes/settings";
import storageRoutes from "./routes/storage";
import activityLogRoutes from "./routes/activityLog";
import authRoutes from "./routes/auth";
import adminRoutes from "./routes/admin";
import ordersRoutes from "./routes/orders";

const app = new Hono<AppEnv>();

app.use("*", async (c, next) => {
  const allowedRaw = c.env.ALLOWED_ORIGINS;
  const allowedOrigins = allowedRaw
    ? allowedRaw.split(",").map((o) => o.trim()).filter(Boolean)
    : ["https://trynexshop.com", "https://admin.trynexshop.com"];

  const origin = c.req.header("origin") || "";
  const isAllowed = allowedOrigins.length === 0 || allowedOrigins.includes(origin) || allowedOrigins.includes("*");

  return cors({
    origin: isAllowed ? origin : allowedOrigins[0],
    allowHeaders: ["Content-Type", "Authorization", "X-Requested-With", "Cache-Control"],
    allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    exposeHeaders: ["Content-Length", "X-Request-Id"],
    maxAge: 600,
    credentials: true,
  })(c, next);
});

if (typeof process === "undefined" || process.env?.NODE_ENV !== "production") {
  app.use("*", logger());
}

app.get("/health", (c) => c.json({ status: "ok", ts: new Date().toISOString() }));
app.get("/api/health", (c) => c.json({ status: "ok", ts: new Date().toISOString() }));

const api = new Hono<AppEnv>().basePath("/api");

api.route("", categoriesRoutes);
api.route("", testimonialsRoutes);
api.route("", referralsRoutes);
api.route("", newsletterRoutes);
api.route("", publicStatsRoutes);
api.route("", seoRoutes);
api.route("", productsRoutes);
api.route("", hampersRoutes);
api.route("", reviewsRoutes);
api.route("", promoCodesRoutes);
api.route("", removeBgRoutes);
api.route("", blogRoutes);
api.route("", settingsRoutes);
api.route("", storageRoutes);
api.route("", activityLogRoutes);
api.route("", authRoutes);
api.route("", adminRoutes);
api.route("", ordersRoutes);

app.route("", sitemapRoutes);
app.route("", api);

app.notFound((c) => c.json({ error: "not_found", path: c.req.path }, 404));

app.onError((err, c) => {
  console.error("[Worker Error]", err);
  return c.json({ error: "internal_error", message: "An unexpected error occurred" }, 500);
});

export default app;
