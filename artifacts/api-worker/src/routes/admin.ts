import { Hono } from "hono";
import { eq, desc, sql, and, isNull, gt, lt, gte } from "drizzle-orm";
import { setCookie, getCookie, deleteCookie } from "hono/cookie";
import { createDb } from "../db";
import {
  adminTable,
  adminSessionsTable,
  ordersTable,
  productsTable,
  customersTable,
  blogPostsTable,
  settingsTable,
} from "../schema";
import {
  hashPassword,
  verifyPasswordArgon2,
  verifyPasswordAny,
  sha256Hex,
} from "../lib/password";
import {
  createAdminSession,
  revokeAdminSession,
  revokeAllAdminSessions,
  ADMIN_SESSION_TTL_MS,
} from "../lib/adminSessions";
import { generateTotpSecret, generateTotpUri, generateTotpQr, verifyTotp } from "../lib/totp";
import {
  signPartialTotpToken,
  verifyPartialTotpToken,
} from "../lib/auth";
import { requireAdmin } from "../middleware/adminAuth";
import { logActivity, getAdminId } from "../lib/activityLog";
import type { AppEnv } from "../types";

const app = new Hono<AppEnv>();

const ADMIN_COOKIE_OPTS = {
  httpOnly: true,
  secure: true,
  path: "/",
  maxAge: 7 * 24 * 60 * 60,
} as const;

function sameSiteForEnv(env: AppEnv["Bindings"]): "None" | "Lax" {
  return env.NODE_ENV === "production" ? "None" : "Lax";
}

app.post("/admin/login", async (c) => {
  try {
    const db = createDb(c.env.DATABASE_URL);
    const body = await c.req.json();
    const { username, password } = body;
    if (!username || !password) {
      return c.json({ error: "validation_error", message: "username and password are required" }, 400);
    }
    const [admin] = await db.select().from(adminTable).where(eq(adminTable.username, username.trim().toLowerCase()));
    if (!admin) {
      return c.json({ error: "invalid_credentials", message: "Invalid username or password" }, 401);
    }
    const salt = c.env.ADMIN_SALT || "";
    const valid = await verifyPasswordAny(admin.passwordHash, password, salt);
    if (!valid) {
      return c.json({ error: "invalid_credentials", message: "Invalid username or password" }, 401);
    }
    if (admin.totpEnabled && admin.totpSecret) {
      const partial = await signPartialTotpToken(admin.id, c.env.ADMIN_JWT_SECRET || c.env.JWT_SECRET);
      // Return both field names: requiresTotp (storefront format) + requires2FA (legacy)
      return c.json({ requiresTotp: true, requires2FA: true, partialToken: partial }, 200);
    }
    const userAgent = c.req.header("user-agent") || "";
    const ip = c.req.header("cf-connecting-ip") || c.req.header("x-forwarded-for") || "";
    const { token, expiresAt } = await createAdminSession(db, { adminId: admin.id, userAgent, ip });
    setCookie(c, "admin_token", token, { ...ADMIN_COOKIE_OPTS, sameSite: sameSiteForEnv(c.env) });
    return c.json({
      success: true,
      token,
      expiresAt: expiresAt.toISOString(),
      admin: { id: admin.id, username: admin.username, totpEnabled: admin.totpEnabled },
    });
  } catch (err) {
    console.error("Admin login error", err);
    return c.json({ error: "internal_error", message: "Login failed" }, 500);
  }
});

app.post("/admin/login/2fa", async (c) => {
  try {
    const db = createDb(c.env.DATABASE_URL);
    const body = await c.req.json();
    const { partialToken, totpCode } = body;
    if (!partialToken || !totpCode) {
      return c.json({ error: "validation_error", message: "partialToken and totpCode are required" }, 400);
    }
    const partialPayload = await verifyPartialTotpToken(partialToken, c.env.ADMIN_JWT_SECRET || c.env.JWT_SECRET);
    if (!partialPayload) {
      return c.json({ error: "invalid_partial_token", message: "Invalid or expired partial session. Please start the login again." }, 401);
    }
    const [admin] = await db.select().from(adminTable).where(eq(adminTable.id, partialPayload.adminId));
    if (!admin || !admin.totpEnabled || !admin.totpSecret) {
      return c.json({ error: "not_found", message: "Admin not found or 2FA not enabled" }, 404);
    }
    const isValid = await verifyTotp(String(totpCode).replace(/\s/g, ""), admin.totpSecret);
    if (!isValid) {
      return c.json({ error: "invalid_totp", message: "Invalid or expired 2FA code. Please try again." }, 401);
    }
    const userAgent = c.req.header("user-agent") || "";
    const ip = c.req.header("cf-connecting-ip") || c.req.header("x-forwarded-for") || "";
    const { token, expiresAt } = await createAdminSession(db, { adminId: admin.id, userAgent, ip });
    setCookie(c, "admin_token", token, { ...ADMIN_COOKIE_OPTS, sameSite: sameSiteForEnv(c.env) });
    return c.json({
      success: true,
      token,
      expiresAt: expiresAt.toISOString(),
      admin: { id: admin.id, username: admin.username, totpEnabled: admin.totpEnabled },
    });
  } catch (err) {
    console.error("Admin 2FA error", err);
    return c.json({ error: "internal_error", message: "2FA verification failed" }, 500);
  }
});

app.post("/admin/logout", requireAdmin, async (c) => {
  try {
    const db = createDb(c.env.DATABASE_URL);
    const bearer = c.req.header("authorization")?.replace("Bearer ", "");
    const cookieToken = getCookie(c, "admin_token");
    const token = bearer ?? cookieToken ?? "";
    if (token) await revokeAdminSession(db, token);
    deleteCookie(c, "admin_token", { path: "/" });
    return c.json({ success: true });
  } catch (err) {
    return c.json({ error: "internal_error", message: "Logout failed" }, 500);
  }
});

app.get("/admin/me", requireAdmin, async (c) => {
  try {
    const db = createDb(c.env.DATABASE_URL);
    const session = c.get("adminSession")!;
    if (!session.adminId) {
      return c.json({ admin: { id: null, username: "system", authenticated: true }, authenticated: true });
    }
    const [admin] = await db.select().from(adminTable).where(eq(adminTable.id, session.adminId));
    if (!admin) return c.json({ error: "not_found" }, 404);
    // Wrap in { admin: {...} } to match the Express server format the storefront expects.
    return c.json({
      admin: { id: admin.id, username: admin.username, totpEnabled: admin.totpEnabled, authenticated: true },
      authenticated: true,
    });
  } catch (err) {
    return c.json({ error: "internal_error", message: "Failed to get admin info" }, 500);
  }
});

// Alias: storefront calls /admin/login-totp; CF Worker natively has /admin/login/2fa
app.post("/admin/login-totp", async (c) => {
  try {
    const db = createDb(c.env.DATABASE_URL);
    const body = await c.req.json();
    const { partialToken, totpCode } = body;
    if (!partialToken || !totpCode) {
      return c.json({ error: "validation_error", message: "partialToken and totpCode are required" }, 400);
    }
    const partialPayload = await verifyPartialTotpToken(partialToken, c.env.ADMIN_JWT_SECRET || c.env.JWT_SECRET);
    if (!partialPayload) {
      return c.json({ error: "invalid_partial_token", message: "Invalid or expired partial session." }, 401);
    }
    const [admin] = await db.select().from(adminTable).where(eq(adminTable.id, partialPayload.adminId));
    if (!admin || !admin.totpEnabled || !admin.totpSecret) {
      return c.json({ error: "not_found", message: "Admin not found or 2FA not enabled" }, 404);
    }
    const isValid = await verifyTotp(String(totpCode).replace(/\s/g, ""), admin.totpSecret);
    if (!isValid) {
      return c.json({ error: "invalid_totp", message: "Invalid or expired 2FA code." }, 401);
    }
    const userAgent = c.req.header("user-agent") || "";
    const ip = c.req.header("cf-connecting-ip") || c.req.header("x-forwarded-for") || "";
    const { token, expiresAt } = await createAdminSession(db, { adminId: admin.id, userAgent, ip });
    setCookie(c, "admin_token", token, { ...ADMIN_COOKIE_OPTS, sameSite: sameSiteForEnv(c.env) });
    return c.json({ success: true, token, expiresAt: expiresAt.toISOString(), admin: { id: admin.id, username: admin.username, totpEnabled: admin.totpEnabled } });
  } catch (err) {
    return c.json({ error: "internal_error", message: "2FA verification failed" }, 500);
  }
});

app.post("/admin/change-password", requireAdmin, async (c) => {
  try {
    const db = createDb(c.env.DATABASE_URL);
    const session = c.get("adminSession")!;
    if (!session.adminId) return c.json({ error: "forbidden", message: "No admin account to update" }, 403);
    const body = await c.req.json();
    const { currentPassword, newPassword } = body;
    if (!currentPassword || !newPassword) {
      return c.json({ error: "validation_error", message: "currentPassword and newPassword are required" }, 400);
    }
    if (newPassword.length < 8) {
      return c.json({ error: "validation_error", message: "New password must be at least 8 characters" }, 400);
    }
    const [admin] = await db.select().from(adminTable).where(eq(adminTable.id, session.adminId));
    if (!admin) return c.json({ error: "not_found" }, 404);
    const salt = c.env.ADMIN_SALT || "";
    const valid = await verifyPasswordAny(admin.passwordHash, currentPassword, salt);
    if (!valid) {
      return c.json({ error: "invalid_credentials", message: "Current password is incorrect" }, 400);
    }
    const newHash = await hashPassword(newPassword);
    await db.update(adminTable).set({ passwordHash: newHash }).where(eq(adminTable.id, session.adminId));
    return c.json({ success: true });
  } catch (err) {
    return c.json({ error: "internal_error", message: "Failed to change password" }, 500);
  }
});

app.get("/admin/totp/setup", requireAdmin, async (c) => {
  try {
    const db = createDb(c.env.DATABASE_URL);
    const session = c.get("adminSession")!;
    if (!session.adminId) return c.json({ error: "forbidden" }, 403);
    const [admin] = await db.select().from(adminTable).where(eq(adminTable.id, session.adminId));
    if (!admin) return c.json({ error: "not_found" }, 404);
    const secret = generateTotpSecret();
    const uri = generateTotpUri(secret, admin.username);
    const qrDataUrl = await generateTotpQr(secret, admin.username);
    await db.update(adminTable).set({ totpSecret: secret, totpEnabled: false }).where(eq(adminTable.id, admin.id));
    return c.json({ secret, uri, qrDataUrl, totpEnabled: admin.totpEnabled });
  } catch (err) {
    return c.json({ error: "internal_error", message: "Failed to setup TOTP" }, 500);
  }
});

app.post("/admin/totp/enable", requireAdmin, async (c) => {
  try {
    const db = createDb(c.env.DATABASE_URL);
    const session = c.get("adminSession")!;
    if (!session.adminId) return c.json({ error: "forbidden" }, 403);
    const body = await c.req.json();
    const { code } = body;
    if (!code) return c.json({ error: "validation_error", message: "TOTP code is required" }, 400);
    const [admin] = await db.select().from(adminTable).where(eq(adminTable.id, session.adminId));
    if (!admin?.totpSecret) {
      return c.json({ error: "not_setup", message: "TOTP not set up. Please request a new setup QR code." }, 400);
    }
    const isValid = await verifyTotp(String(code).replace(/\s/g, ""), admin.totpSecret);
    if (!isValid) {
      return c.json({ error: "invalid_code", message: "Invalid verification code. Please check your authenticator app." }, 400);
    }
    await db.update(adminTable).set({ totpEnabled: true }).where(eq(adminTable.id, admin.id));
    await revokeAllAdminSessions(db);
    return c.json({ success: true, message: "2FA enabled. All existing sessions have been revoked. Please log in again." });
  } catch (err) {
    return c.json({ error: "internal_error", message: "Failed to enable TOTP" }, 500);
  }
});

app.post("/admin/totp/disable", requireAdmin, async (c) => {
  try {
    const db = createDb(c.env.DATABASE_URL);
    const session = c.get("adminSession")!;
    if (!session.adminId) return c.json({ error: "forbidden" }, 403);
    const body = await c.req.json();
    const { code } = body;
    if (!code) return c.json({ error: "validation_error", message: "TOTP code required to disable 2FA" }, 400);
    const [admin] = await db.select().from(adminTable).where(eq(adminTable.id, session.adminId));
    if (!admin) return c.json({ error: "not_found" }, 404);
    if (!admin.totpEnabled || !admin.totpSecret) {
      return c.json({ error: "not_enabled", message: "2FA is not currently enabled" }, 400);
    }
    const isValid = await verifyTotp(String(code).replace(/\s/g, ""), admin.totpSecret);
    if (!isValid) {
      return c.json({ error: "invalid_code", message: "Invalid verification code. Please check your authenticator app." }, 400);
    }
    await db.update(adminTable).set({ totpEnabled: false, totpSecret: null }).where(eq(adminTable.id, admin.id));
    await revokeAllAdminSessions(db);
    return c.json({ success: true, message: "2FA disabled. Please log in again." });
  } catch (err) {
    return c.json({ error: "internal_error", message: "Failed to disable TOTP" }, 500);
  }
});

app.post("/admin/reset-password", async (c) => {
  try {
    const db = createDb(c.env.DATABASE_URL);
    const body = await c.req.json();
    const { resetKey, newPassword } = body;
    if (!resetKey || !newPassword) {
      return c.json({ error: "validation_error", message: "resetKey and newPassword are required" }, 400);
    }
    if (newPassword.length < 8) {
      return c.json({ error: "validation_error", message: "Password must be at least 8 characters" }, 400);
    }
    // Check reset key: first try env-var SHA256 hash, then fall back to DB argon2 hash.
    const expectedKeyHash = c.env.ADMIN_RESET_KEY_HASH;
    let keyValid = false;
    if (expectedKeyHash) {
      const inputHash = await sha256Hex(resetKey);
      keyValid = inputHash === expectedKeyHash;
    } else {
      // Fall back to DB-stored argon2 hash (settings key = "adminResetKeyHash")
      const [setting] = await db.select({ value: settingsTable.value })
        .from(settingsTable)
        .where(eq(settingsTable.key, "adminResetKeyHash"))
        .limit(1);
      const storedHash: string | null | undefined = setting?.value;
      if (!storedHash) {
        return c.json({ error: "not_configured", message: "Password reset is not configured" }, 503);
      }
      keyValid = await verifyPasswordArgon2(storedHash, resetKey);
    }
    if (!keyValid) {
      return c.json({ error: "invalid_key", message: "Invalid reset key" }, 401);
    }
    const [admin] = await db.select().from(adminTable).limit(1);
    if (!admin) {
      return c.json({ error: "no_admin", message: "No admin account found" }, 404);
    }
    let newHash: string;
    try {
      newHash = await hashPassword(newPassword);
    } catch (hashErr) {
      console.error("hashPassword failed:", hashErr);
      return c.json({ error: "hash_error", message: "Password hashing failed. Try again." }, 500);
    }
    await db.update(adminTable)
      .set({ passwordHash: newHash, totpEnabled: false, totpSecret: null })
      .where(eq(adminTable.id, admin.id));
    await revokeAllAdminSessions(db).catch(() => {});
    return c.json({ success: true, message: "Admin password reset. Please log in with your new password." });
  } catch (err) {
    console.error("reset-password error:", err);
    return c.json({ error: "internal_error", message: "Password reset failed", detail: String(err) }, 500);
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
    }).from(adminSessionsTable)
      .where(and(isNull(adminSessionsTable.revokedAt), gt(adminSessionsTable.expiresAt, new Date())))
      .orderBy(desc(adminSessionsTable.lastUsedAt));
    return c.json({ sessions });
  } catch (err) {
    return c.json({ error: "internal_error", message: "Failed to list sessions" }, 500);
  }
});

app.post("/admin/sessions/revoke-all", requireAdmin, async (c) => {
  try {
    const db = createDb(c.env.DATABASE_URL);
    await revokeAllAdminSessions(db);
    deleteCookie(c, "admin_token", { path: "/" });
    return c.json({ success: true, message: "All sessions revoked." });
  } catch (err) {
    return c.json({ error: "internal_error", message: "Failed to revoke sessions" }, 500);
  }
});

app.get("/admin/stats", requireAdmin, async (c) => {
  try {
    const db = createDb(c.env.DATABASE_URL);
    const period = c.req.query("period") || "30";
    const daysAgo = parseInt(period, 10) || 30;
    const since = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000);

    const [
      totalOrdersResult,
      pendingOrdersResult,
      recentOrdersResult,
      totalRevenueResult,
      recentRevenueResult,
      totalCustomersResult,
      newCustomersResult,
      totalProductsResult,
      lowStockResult,
      totalBlogResult,
    ] = await Promise.all([
      db.select({ count: sql<number>`count(*)` }).from(ordersTable),
      db.select({ count: sql<number>`count(*)` }).from(ordersTable).where(eq(ordersTable.status, "pending")),
      db.select({ count: sql<number>`count(*)` }).from(ordersTable).where(gte(ordersTable.createdAt, since)),
      db.select({ sum: sql<string>`COALESCE(sum(total::numeric), 0)` }).from(ordersTable).where(eq(ordersTable.paymentStatus, "paid")),
      db.select({ sum: sql<string>`COALESCE(sum(total::numeric), 0)` }).from(ordersTable).where(and(eq(ordersTable.paymentStatus, "paid"), gte(ordersTable.createdAt, since))),
      db.select({ count: sql<number>`count(*)` }).from(customersTable).where(eq(customersTable.isGuest, false)),
      db.select({ count: sql<number>`count(*)` }).from(customersTable).where(and(eq(customersTable.isGuest, false), gte(customersTable.createdAt, since))),
      db.select({ count: sql<number>`count(*)` }).from(productsTable),
      db.select({ count: sql<number>`count(*)` }).from(productsTable).where(lt(productsTable.stock, 10)),
      db.select({ count: sql<number>`count(*)` }).from(blogPostsTable),
    ]);

    const recentOrders = await db.select({
      id: ordersTable.id,
      orderNumber: ordersTable.orderNumber,
      customerName: ordersTable.customerName,
      total: ordersTable.total,
      status: ordersTable.status,
      paymentMethod: ordersTable.paymentMethod,
      createdAt: ordersTable.createdAt,
    }).from(ordersTable).orderBy(desc(ordersTable.createdAt)).limit(10);

    const ordersByStatus = await db.select({
      status: ordersTable.status,
      count: sql<number>`count(*)`,
    }).from(ordersTable).groupBy(ordersTable.status);

    const revenueByDay = await db.execute(sql`
      SELECT date_trunc('day', created_at)::date AS date,
             SUM(total::numeric) AS revenue,
             COUNT(*) AS orders
      FROM orders
      WHERE created_at >= ${since}
        AND payment_status = 'paid'
      GROUP BY 1
      ORDER BY 1 ASC
    `);

    return c.json({
      totals: {
        orders: Number(totalOrdersResult[0]?.count ?? 0),
        pendingOrders: Number(pendingOrdersResult[0]?.count ?? 0),
        recentOrders: Number(recentOrdersResult[0]?.count ?? 0),
        revenue: parseFloat(totalRevenueResult[0]?.sum ?? "0"),
        recentRevenue: parseFloat(recentRevenueResult[0]?.sum ?? "0"),
        customers: Number(totalCustomersResult[0]?.count ?? 0),
        newCustomers: Number(newCustomersResult[0]?.count ?? 0),
        products: Number(totalProductsResult[0]?.count ?? 0),
        lowStockProducts: Number(lowStockResult[0]?.count ?? 0),
        blogPosts: Number(totalBlogResult[0]?.count ?? 0),
      },
      recentOrders: recentOrders.map((o) => ({ ...o, total: parseFloat(String(o.total)) })),
      ordersByStatus: ordersByStatus.map((r) => ({ status: r.status, count: Number(r.count) })),
      revenueByDay: (revenueByDay.rows ?? revenueByDay).map((r: any) => ({ date: r.date, revenue: parseFloat(r.revenue ?? 0), orders: Number(r.orders) })),
      period: daysAgo,
    });
  } catch (err) {
    console.error("Admin stats error", err);
    return c.json({ error: "internal_error", message: "Failed to get stats" }, 500);
  }
});

app.get("/admin/customers", requireAdmin, async (c) => {
  try {
    const db = createDb(c.env.DATABASE_URL);
    const page = c.req.query("page") || "1";
    const limit = c.req.query("limit") || "20";
    const search = c.req.query("search") || "";
    const pageNum = parseInt(page, 10);
    const limitNum = parseInt(limit, 10);
    const offset = (pageNum - 1) * limitNum;
    const where = search
      ? sql`(name ILIKE ${"%" + search + "%"} OR email ILIKE ${"%" + search + "%"} OR phone ILIKE ${"%" + search + "%"})`
      : undefined;
    const [customers, countResult] = await Promise.all([
      db.select({ id: customersTable.id, name: customersTable.name, email: customersTable.email, phone: customersTable.phone, avatar: customersTable.avatar, isGuest: customersTable.isGuest, googleId: sql<boolean>`CASE WHEN ${customersTable.googleId} IS NOT NULL THEN true ELSE false END`, facebookId: sql<boolean>`CASE WHEN ${customersTable.facebookId} IS NOT NULL THEN true ELSE false END`, createdAt: customersTable.createdAt }).from(customersTable).where(where).orderBy(desc(customersTable.createdAt)).limit(limitNum).offset(offset),
      db.select({ count: sql<number>`count(*)` }).from(customersTable).where(where),
    ]);
    return c.json({
      customers,
      total: Number(countResult[0]?.count ?? 0),
      page: pageNum,
      limit: limitNum,
    });
  } catch (err) {
    return c.json({ error: "internal_error", message: "Failed to list customers" }, 500);
  }
});

app.get("/admin/check", async (c) => {
  try {
    const db = createDb(c.env.DATABASE_URL);
    const [admin] = await db.select({ id: adminTable.id }).from(adminTable).limit(1);
    return c.json({ hasAdmin: !!admin });
  } catch (err) {
    return c.json({ hasAdmin: false });
  }
});

app.post("/admin/setup", async (c) => {
  try {
    const db = createDb(c.env.DATABASE_URL);
    const [existing] = await db.select({ id: adminTable.id }).from(adminTable).limit(1);
    if (existing) {
      return c.json({ error: "already_setup", message: "Admin account already exists" }, 409);
    }
    const body = await c.req.json();
    const { username, password, setupKey } = body;

    const expectedKey = c.env.ADMIN_RESET_KEY_HASH;
    if (expectedKey) {
      if (!setupKey) return c.json({ error: "key_required", message: "Setup key is required" }, 401);
      const hash = await sha256Hex(setupKey);
      if (hash !== expectedKey) return c.json({ error: "invalid_key", message: "Invalid setup key" }, 401);
    }

    if (!username || !password) {
      return c.json({ error: "validation_error", message: "username and password are required" }, 400);
    }
    if (password.length < 8) {
      return c.json({ error: "validation_error", message: "Password must be at least 8 characters" }, 400);
    }
    const passwordHash = await hashPassword(password);
    const [admin] = await db.insert(adminTable).values({
      username: username.toLowerCase().trim(),
      passwordHash,
    }).returning();
    return c.json({ success: true, id: admin.id, username: admin.username }, 201);
  } catch (err: any) {
    if (err?.code === "23505") {
      return c.json({ error: "duplicate", message: "Username already exists" }, 409);
    }
    return c.json({ error: "internal_error", message: "Failed to create admin account" }, 500);
  }
});

app.get("/admin/telegram/setup", requireAdmin, async (c) => {
  const token = c.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    return c.json({ error: "not_configured", message: "TELEGRAM_BOT_TOKEN secret is not set on the Worker." }, 400);
  }
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/getUpdates?limit=10&timeout=0`, {
      signal: AbortSignal.timeout(8000),
    });
    const data: any = await res.json();
    if (!data.ok) {
      return c.json({ error: "telegram_error", message: data.description || "Telegram API error" }, 502);
    }
    const updates: any[] = data.result || [];
    const chatIds: { id: number; type: string; name: string; date: number }[] = [];
    const seen = new Set<number>();
    for (const u of updates) {
      const chat = u.message?.chat || u.channel_post?.chat;
      if (chat && !seen.has(chat.id)) {
        seen.add(chat.id);
        chatIds.push({
          id: chat.id,
          type: chat.type,
          name: chat.title || `${chat.first_name || ""} ${chat.last_name || ""}`.trim(),
          date: u.message?.date || u.channel_post?.date || 0,
        });
      }
    }
    const chatIdConfigured = !!c.env.TELEGRAM_CHAT_ID;
    return c.json({
      bot_token_set: true,
      chat_id_configured: chatIdConfigured,
      current_chat_id: chatIdConfigured ? c.env.TELEGRAM_CHAT_ID : null,
      recent_chats: chatIds,
      instructions: chatIdConfigured
        ? "Telegram is fully configured. Notifications are active."
        : "Send any message (e.g. /start) to @TryNex_Lifestyle_bot, then copy the chat id from recent_chats and set it as the TELEGRAM_CHAT_ID Worker secret.",
    });
  } catch (err) {
    return c.json({ error: "fetch_error", message: String(err) }, 500);
  }
});

app.post("/admin/telegram/test", requireAdmin, async (c) => {
  const token = c.env.TELEGRAM_BOT_TOKEN;
  const chatId = c.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) {
    return c.json({ error: "not_configured", message: "TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID must both be set." }, 400);
  }
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: "✅ <b>TryNex Lifestyle</b>\n\nTelegram notifications are working! You will receive new order alerts here.",
        parse_mode: "HTML",
      }),
      signal: AbortSignal.timeout(8000),
    });
    const data: any = await res.json();
    if (!data.ok) {
      return c.json({ error: "telegram_error", message: data.description || "Failed to send message" }, 502);
    }
    return c.json({ success: true, message: "Test message sent to your Telegram." });
  } catch (err) {
    return c.json({ error: "fetch_error", message: String(err) }, 500);
  }
});

export default app;
