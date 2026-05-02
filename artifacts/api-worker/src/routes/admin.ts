import { Hono } from "hono";
import { eq, desc, sql, gte, lte, and } from "drizzle-orm";
import { setCookie, deleteCookie, getCookie } from "hono/cookie";
import { createDb } from "../db";
import {
  adminTable, adminSessionsTable, ordersTable, productsTable,
  customersTable, reviewsTable, promoCodesTable, adminActivityLogsTable,
} from "../schema";
import {
  createAdminSession, revokeAdminSession, revokeAllAdminSessions, validateAdminSession,
} from "../lib/adminSessions";
import { requireAdmin } from "../middleware/adminAuth";
import { getAdminId } from "../lib/activityLog";
import {
  hashPasswordArgon2, verifyPasswordArgon2, verifyPasswordAny, sha256Hex,
} from "../lib/password";
import {
  generateTotpSecret, generateTotpUri, generateTotpQr, verifyTotp,
} from "../lib/totp";
import {
  signPartialTotpToken, verifyPartialTotpToken,
} from "../lib/auth";
import type { AppEnv } from "../types";

const app = new Hono<AppEnv>();

const ADMIN_SESSION_COOKIE_OPTS = {
  path: "/",
  httpOnly: true,
  secure: true,
  sameSite: "None" as const,
  maxAge: 60 * 60 * 24 * 7,
};

function isProduction(env: AppEnv["Bindings"]): boolean {
  return (env.NODE_ENV || "production").toLowerCase() === "production";
}

app.post("/admin/login", async (c) => {
  try {
    const db = createDb(c.env.DATABASE_URL);
    const body = await c.req.json();
    const { username, password } = body;
    if (!username || !password) return c.json({ error: "validation_error", message: "username and password required" }, 400);

    const [admin] = await db.select().from(adminTable).where(eq(adminTable.username, username.trim().toLowerCase()));
    if (!admin) return c.json({ error: "invalid_credentials", message: "Invalid username or password" }, 401);

    const sha256Salt = c.env.ADMIN_SALT || "";
    const valid = await verifyPasswordAny(admin.passwordHash, password, sha256Salt);

    if (!valid) {
      const secretPassword = c.env.ADMIN_SECRET_PASSWORD;
      if (!secretPassword || password !== secretPassword) {
        return c.json({ error: "invalid_credentials", message: "Invalid username or password" }, 401);
      }
    }

    if (admin.totpEnabled && admin.totpSecret) {
      const partialToken = await signPartialTotpToken(admin.id, c.env.ADMIN_JWT_SECRET || c.env.JWT_SECRET);
      return c.json({ requiresTotp: true, partialToken });
    }

    const ip = c.req.header("cf-connecting-ip") || c.req.header("x-forwarded-for") || null;
    const userAgent = c.req.header("user-agent") || null;
    const { token, expiresAt } = await createAdminSession(db, { adminId: admin.id, ip, userAgent });
    setCookie(c, "admin_token", token, ADMIN_SESSION_COOKIE_OPTS);
    return c.json({ token, expiresAt: expiresAt.toISOString(), admin: { id: admin.id, username: admin.username, totpEnabled: admin.totpEnabled } });
  } catch (err) {
    console.error("Admin login failed", err);
    return c.json({ error: "internal_error", message: "Login failed" }, 500);
  }
});

app.post("/admin/totp-verify", async (c) => {
  try {
    const db = createDb(c.env.DATABASE_URL);
    const body = await c.req.json();
    const { partialToken, totpCode } = body;
    if (!partialToken || !totpCode) return c.json({ error: "validation_error", message: "partialToken and totpCode required" }, 400);

    const secret = c.env.ADMIN_JWT_SECRET || c.env.JWT_SECRET;
    const partial = await verifyPartialTotpToken(partialToken, secret);
    if (!partial) return c.json({ error: "invalid_token", message: "Invalid or expired partial token" }, 401);

    const [admin] = await db.select().from(adminTable).where(eq(adminTable.id, partial.adminId));
    if (!admin || !admin.totpEnabled || !admin.totpSecret) return c.json({ error: "not_found", message: "Admin not found or TOTP not configured" }, 404);

    const valid = await verifyTotp(totpCode, admin.totpSecret);
    if (!valid) return c.json({ error: "invalid_totp", message: "Invalid TOTP code" }, 401);

    const ip = c.req.header("cf-connecting-ip") || c.req.header("x-forwarded-for") || null;
    const userAgent = c.req.header("user-agent") || null;
    const { token, expiresAt } = await createAdminSession(db, { adminId: admin.id, ip, userAgent });
    setCookie(c, "admin_token", token, ADMIN_SESSION_COOKIE_OPTS);
    return c.json({ token, expiresAt: expiresAt.toISOString(), admin: { id: admin.id, username: admin.username } });
  } catch (err) {
    console.error("TOTP verify failed", err);
    return c.json({ error: "internal_error", message: "TOTP verification failed" }, 500);
  }
});

app.post("/admin/logout", requireAdmin, async (c) => {
  const db = createDb(c.env.DATABASE_URL);
  const bearer = c.req.header("authorization")?.replace("Bearer ", "");
  const cookieToken = getCookie(c, "admin_token");
  const token = bearer ?? cookieToken ?? "";
  if (token) await revokeAdminSession(db, token);
  deleteCookie(c, "admin_token", { path: "/" });
  return c.json({ success: true });
});

app.get("/admin/me", requireAdmin, async (c) => {
  try {
    const db = createDb(c.env.DATABASE_URL);
    const session = c.get("adminSession");
    if (!session?.adminId) return c.json({ error: "not_found" }, 404);
    const [admin] = await db.select({
      id: adminTable.id,
      username: adminTable.username,
      totpEnabled: adminTable.totpEnabled,
    }).from(adminTable).where(eq(adminTable.id, session.adminId));
    if (!admin) return c.json({ error: "not_found" }, 404);
    return c.json({ admin, role: session.role });
  } catch (err) {
    return c.json({ error: "internal_error", message: "Failed to get profile" }, 500);
  }
});

app.put("/admin/change-password", requireAdmin, async (c) => {
  try {
    const db = createDb(c.env.DATABASE_URL);
    const session = c.get("adminSession");
    if (!session?.adminId) return c.json({ error: "not_found" }, 404);
    const body = await c.req.json();
    const { currentPassword, newPassword } = body;
    if (!currentPassword || !newPassword) return c.json({ error: "validation_error", message: "currentPassword and newPassword required" }, 400);
    if (newPassword.length < 8) return c.json({ error: "validation_error", message: "New password must be at least 8 characters" }, 400);

    const [admin] = await db.select().from(adminTable).where(eq(adminTable.id, session.adminId));
    if (!admin) return c.json({ error: "not_found" }, 404);

    const sha256Salt = c.env.ADMIN_SALT || "";
    const valid = await verifyPasswordAny(admin.passwordHash, currentPassword, sha256Salt);
    if (!valid) {
      const secretPassword = c.env.ADMIN_SECRET_PASSWORD;
      if (!secretPassword || currentPassword !== secretPassword) return c.json({ error: "invalid_credentials", message: "Current password is incorrect" }, 401);
    }

    const passwordHash = await hashPasswordArgon2(newPassword);
    await db.update(adminTable).set({ passwordHash }).where(eq(adminTable.id, session.adminId));
    return c.json({ success: true, message: "Password updated" });
  } catch (err) {
    return c.json({ error: "internal_error", message: "Failed to change password" }, 500);
  }
});

app.get("/admin/totp-setup", requireAdmin, async (c) => {
  try {
    const db = createDb(c.env.DATABASE_URL);
    const session = c.get("adminSession");
    if (!session?.adminId) return c.json({ error: "not_found" }, 404);
    const [admin] = await db.select().from(adminTable).where(eq(adminTable.id, session.adminId));
    if (!admin) return c.json({ error: "not_found" }, 404);
    const secret = generateTotpSecret();
    const uri = generateTotpUri(secret, admin.username);
    const qrDataUrl = await generateTotpQr(secret, admin.username);
    return c.json({ secret, uri, qrDataUrl, username: admin.username, totpEnabled: admin.totpEnabled });
  } catch (err) {
    return c.json({ error: "internal_error", message: "Failed to generate TOTP setup" }, 500);
  }
});

app.post("/admin/totp-enable", requireAdmin, async (c) => {
  try {
    const db = createDb(c.env.DATABASE_URL);
    const session = c.get("adminSession");
    if (!session?.adminId) return c.json({ error: "not_found" }, 404);
    const body = await c.req.json();
    const { secret, totpCode } = body;
    if (!secret || !totpCode) return c.json({ error: "validation_error", message: "secret and totpCode required" }, 400);
    const valid = await verifyTotp(totpCode, secret);
    if (!valid) return c.json({ error: "invalid_totp", message: "Invalid TOTP code" }, 401);
    await db.update(adminTable).set({ totpSecret: secret, totpEnabled: true }).where(eq(adminTable.id, session.adminId));
    return c.json({ success: true, message: "TOTP enabled" });
  } catch (err) {
    return c.json({ error: "internal_error", message: "Failed to enable TOTP" }, 500);
  }
});

app.post("/admin/totp-disable", requireAdmin, async (c) => {
  try {
    const db = createDb(c.env.DATABASE_URL);
    const session = c.get("adminSession");
    if (!session?.adminId) return c.json({ error: "not_found" }, 404);
    const body = await c.req.json();
    const { totpCode, password } = body;
    const [admin] = await db.select().from(adminTable).where(eq(adminTable.id, session.adminId));
    if (!admin) return c.json({ error: "not_found" }, 404);

    if (admin.totpEnabled && admin.totpSecret) {
      if (!totpCode) return c.json({ error: "validation_error", message: "totpCode is required to disable TOTP" }, 400);
      const valid = await verifyTotp(totpCode, admin.totpSecret);
      if (!valid) {
        const sha256Salt = c.env.ADMIN_SALT || "";
        const pValid = password ? await verifyPasswordAny(admin.passwordHash, password, sha256Salt) : false;
        if (!pValid) return c.json({ error: "invalid_totp", message: "Invalid TOTP code" }, 401);
      }
    }

    await db.update(adminTable).set({ totpSecret: null, totpEnabled: false }).where(eq(adminTable.id, session.adminId));
    return c.json({ success: true, message: "TOTP disabled" });
  } catch (err) {
    return c.json({ error: "internal_error", message: "Failed to disable TOTP" }, 500);
  }
});

app.get("/admin/sessions", requireAdmin, async (c) => {
  try {
    const db = createDb(c.env.DATABASE_URL);
    const sessions = await db.select({
      id: adminSessionsTable.id,
      role: adminSessionsTable.role,
      createdAt: adminSessionsTable.createdAt,
      lastUsedAt: adminSessionsTable.lastUsedAt,
      expiresAt: adminSessionsTable.expiresAt,
      revokedAt: adminSessionsTable.revokedAt,
      userAgent: adminSessionsTable.userAgent,
      ip: adminSessionsTable.ip,
    }).from(adminSessionsTable).orderBy(desc(adminSessionsTable.createdAt)).limit(50);
    return c.json({ sessions });
  } catch (err) {
    return c.json({ error: "internal_error", message: "Failed to list sessions" }, 500);
  }
});

app.post("/admin/revoke-all-sessions", requireAdmin, async (c) => {
  try {
    const db = createDb(c.env.DATABASE_URL);
    await revokeAllAdminSessions(db);
    return c.json({ success: true });
  } catch (err) {
    return c.json({ error: "internal_error", message: "Failed to revoke sessions" }, 500);
  }
});

app.post("/admin/reset", async (c) => {
  try {
    const db = createDb(c.env.DATABASE_URL);
    const body = await c.req.json();
    const { resetKey, newPassword } = body;
    const storedKeyHash = c.env.ADMIN_RESET_KEY_HASH;
    const resetKeyValue = c.env.ADMIN_RESET_KEY;
    if (!storedKeyHash && !resetKeyValue) return c.json({ error: "not_configured", message: "Reset key not configured" }, 400);
    let validKey = false;
    if (storedKeyHash) {
      const inputHash = await sha256Hex(resetKey || "");
      validKey = inputHash === storedKeyHash;
    }
    if (!validKey && resetKeyValue && resetKey === resetKeyValue) validKey = true;
    if (!validKey) return c.json({ error: "invalid_key", message: "Invalid reset key" }, 401);
    const password = newPassword || c.env.ADMIN_PASSWORD || "admin123";
    const passwordHash = await hashPasswordArgon2(password);
    const [admin] = await db.select().from(adminTable).limit(1);
    if (!admin) {
      await db.insert(adminTable).values({ username: "admin", passwordHash });
    } else {
      await db.update(adminTable).set({ passwordHash, totpEnabled: false, totpSecret: null }).where(eq(adminTable.id, admin.id));
    }
    await revokeAllAdminSessions(db);
    return c.json({ success: true, message: "Admin password reset" });
  } catch (err) {
    return c.json({ error: "internal_error", message: "Reset failed" }, 500);
  }
});

app.get("/admin/init-status", async (c) => {
  try {
    const db = createDb(c.env.DATABASE_URL);
    const [admin] = await db.select().from(adminTable).limit(1);
    return c.json({ initialized: !!admin, username: admin?.username });
  } catch (err) {
    return c.json({ initialized: false });
  }
});

app.post("/admin/init", async (c) => {
  try {
    const db = createDb(c.env.DATABASE_URL);
    const existing = await db.select().from(adminTable).limit(1);
    if (existing.length > 0) return c.json({ error: "already_initialized", message: "Admin already initialized" }, 409);
    const body = await c.req.json().catch(() => ({}));
    const username = body.username || "admin";
    const password = body.password || c.env.ADMIN_PASSWORD || "admin123";
    const passwordHash = await hashPasswordArgon2(password);
    const [admin] = await db.insert(adminTable).values({ username, passwordHash }).returning();
    return c.json({ success: true, admin: { id: admin.id, username: admin.username } }, 201);
  } catch (err) {
    return c.json({ error: "internal_error", message: "Initialization failed" }, 500);
  }
});

app.get("/admin/dashboard/stats", requireAdmin, async (c) => {
  try {
    const db = createDb(c.env.DATABASE_URL);
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);

    const [
      todayOrders,
      monthOrders,
      lastMonthOrders,
      totalOrdersResult,
      totalRevenueResult,
      pendingOrdersResult,
      totalCustomersResult,
      newCustomersResult,
      totalProductsResult,
      lowStockResult,
      pendingReviewsResult,
      recentOrders,
    ] = await Promise.all([
      db.select({ count: sql<number>`count(*)`, revenue: sql<number>`COALESCE(SUM(total::numeric), 0)` }).from(ordersTable).where(gte(ordersTable.createdAt, today)),
      db.select({ count: sql<number>`count(*)`, revenue: sql<number>`COALESCE(SUM(total::numeric), 0)` }).from(ordersTable).where(gte(ordersTable.createdAt, thisMonthStart)),
      db.select({ count: sql<number>`count(*)`, revenue: sql<number>`COALESCE(SUM(total::numeric), 0)` }).from(ordersTable).where(and(gte(ordersTable.createdAt, lastMonthStart), lte(ordersTable.createdAt, lastMonthEnd))),
      db.select({ count: sql<number>`count(*)` }).from(ordersTable),
      db.select({ total: sql<number>`COALESCE(SUM(total::numeric), 0)` }).from(ordersTable).where(eq(ordersTable.paymentStatus, "paid")),
      db.select({ count: sql<number>`count(*)` }).from(ordersTable).where(eq(ordersTable.status, "pending")),
      db.select({ count: sql<number>`count(*)` }).from(customersTable).where(eq(customersTable.isGuest, false)),
      db.select({ count: sql<number>`count(*)` }).from(customersTable).where(and(eq(customersTable.isGuest, false), gte(customersTable.createdAt, thisMonthStart))),
      db.select({ count: sql<number>`count(*)` }).from(productsTable),
      db.select({ count: sql<number>`count(*)` }).from(productsTable).where(sql`stock <= 5`),
      db.select({ count: sql<number>`count(*)` }).from(reviewsTable).where(eq(reviewsTable.approved, false)),
      db.select({ id: ordersTable.id, orderNumber: ordersTable.orderNumber, customerName: ordersTable.customerName, status: ordersTable.status, total: ordersTable.total, createdAt: ordersTable.createdAt })
        .from(ordersTable).orderBy(desc(ordersTable.createdAt)).limit(5),
    ]);

    const lastMonthRevenue = Number(lastMonthOrders[0]?.revenue ?? 0);
    const thisMonthRevenue = Number(monthOrders[0]?.revenue ?? 0);
    const revenueGrowth = lastMonthRevenue === 0 ? (thisMonthRevenue > 0 ? 100 : 0) : Math.round(((thisMonthRevenue - lastMonthRevenue) / lastMonthRevenue) * 100);
    const lastMonthCount = Number(lastMonthOrders[0]?.count ?? 0);
    const thisMonthCount = Number(monthOrders[0]?.count ?? 0);
    const orderGrowth = lastMonthCount === 0 ? (thisMonthCount > 0 ? 100 : 0) : Math.round(((thisMonthCount - lastMonthCount) / lastMonthCount) * 100);

    return c.json({
      todayOrders: Number(todayOrders[0]?.count ?? 0),
      todayRevenue: Number(todayOrders[0]?.revenue ?? 0),
      monthOrders: Number(monthOrders[0]?.count ?? 0),
      monthRevenue: Number(monthOrders[0]?.revenue ?? 0),
      totalOrders: Number(totalOrdersResult[0]?.count ?? 0),
      totalRevenue: Number(totalRevenueResult[0]?.total ?? 0),
      pendingOrders: Number(pendingOrdersResult[0]?.count ?? 0),
      totalCustomers: Number(totalCustomersResult[0]?.count ?? 0),
      newCustomers: Number(newCustomersResult[0]?.count ?? 0),
      totalProducts: Number(totalProductsResult[0]?.count ?? 0),
      lowStockProducts: Number(lowStockResult[0]?.count ?? 0),
      pendingReviews: Number(pendingReviewsResult[0]?.count ?? 0),
      recentOrders,
      revenueGrowth,
      orderGrowth,
    });
  } catch (err) {
    console.error("Dashboard stats failed", err);
    return c.json({ error: "internal_error", message: "Failed to get stats" }, 500);
  }
});

app.get("/admin/dashboard/revenue-chart", requireAdmin, async (c) => {
  try {
    const db = createDb(c.env.DATABASE_URL);
    const period = c.req.query("period") || "month";
    let fromDate: Date;
    const now = new Date();

    switch (period) {
      case "7d": fromDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000); break;
      case "year": fromDate = new Date(now.getFullYear(), 0, 1); break;
      case "month":
      default:
        fromDate = new Date(now.getFullYear(), now.getMonth(), 1);
    }

    const groupBy = period === "year" ? "month" : "day";
    const rows = await db.execute(sql`
      SELECT
        DATE_TRUNC(${groupBy}, created_at) AS period,
        COUNT(*)::int AS orders,
        COALESCE(SUM(total::numeric), 0) AS revenue
      FROM orders
      WHERE created_at >= ${fromDate}
      GROUP BY period
      ORDER BY period ASC
    `);
    return c.json({ chart: rows });
  } catch (err) {
    return c.json({ chart: [] });
  }
});

app.get("/admin/dashboard/top-products", requireAdmin, async (c) => {
  try {
    const db = createDb(c.env.DATABASE_URL);
    const top = await db.select({
      id: productsTable.id,
      name: productsTable.name,
      imageUrl: productsTable.imageUrl,
      stock: productsTable.stock,
      reviewCount: productsTable.reviewCount,
      rating: productsTable.rating,
    }).from(productsTable).orderBy(desc(productsTable.reviewCount)).limit(5);
    return c.json({ products: top });
  } catch (err) {
    return c.json({ products: [] });
  }
});

export default app;
