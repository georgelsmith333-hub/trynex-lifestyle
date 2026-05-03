import { Hono } from "hono";
import { eq, desc, sql, and, isNull, gt, lt, lte, gte } from "drizzle-orm";
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

// ─── Local types ─────────────────────────────────────────────────────────────
type OrderRow = typeof ordersTable.$inferSelect;

interface OrderItem {
  productId?: string;
  productName?: string;
  productImage?: string;
  quantity?: number;
  price?: string | number;
  [key: string]: unknown;
}

interface WeeklyRow {
  day: string;
  revenue: string | number;
  orders: string | number;
}

interface TopProductRow {
  id: string | number | null;
  name: string | null;
  imageUrl: string | null;
  totalSold: string | number | null;
}

interface TelegramChat {
  id: number;
  type: string;
  title?: string;
  first_name?: string;
  last_name?: string;
}

interface TelegramApiResponse {
  ok: boolean;
  description?: string;
  result?: Array<{
    message?: { chat?: TelegramChat; date?: number };
    channel_post?: { chat?: TelegramChat; date?: number };
  }>;
}

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
    await revokeAllAdminSessions(db);
    return c.json({ success: true, message: "Admin password reset. Please log in with your new password." });
  } catch (err) {
    console.error("reset-password error:", err);
    return c.json({ error: "internal_error", message: "Password reset failed" }, 500);
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

    const [
      totalResult,
      pendingResult,
      processingResult,
      shippedResult,
      deliveredResult,
      totalRevenueResult,
      todayRevenueResult,
      totalProductsResult,
      lowStockResult,
    ] = await Promise.all([
      db.select({ count: sql<number>`count(*)` }).from(ordersTable),
      db.select({ count: sql<number>`count(*)` }).from(ordersTable).where(eq(ordersTable.status, "pending")),
      db.select({ count: sql<number>`count(*)` }).from(ordersTable).where(eq(ordersTable.status, "processing")),
      db.select({ count: sql<number>`count(*)` }).from(ordersTable).where(eq(ordersTable.status, "shipped")),
      db.select({ count: sql<number>`count(*)` }).from(ordersTable).where(eq(ordersTable.status, "delivered")),
      db.select({ total: sql<number>`COALESCE(SUM(total::numeric), 0)` }).from(ordersTable),
      db.select({ total: sql<number>`COALESCE(SUM(total::numeric), 0)` }).from(ordersTable).where(sql`created_at::date = CURRENT_DATE`),
      db.select({ count: sql<number>`count(*)` }).from(productsTable),
      db.select({ count: sql<number>`count(*)` }).from(productsTable).where(lte(productsTable.stock, 5)),
    ]);

    const recentOrdersRaw = await db.select().from(ordersTable).orderBy(desc(ordersTable.createdAt)).limit(5);

    const mapOrder = (o: OrderRow) => ({
      id: o.id,
      orderNumber: o.orderNumber,
      customerName: o.customerName,
      customerEmail: o.customerEmail,
      customerPhone: o.customerPhone,
      shippingAddress: o.shippingAddress,
      shippingCity: o.shippingCity,
      shippingDistrict: o.shippingDistrict,
      paymentMethod: o.paymentMethod,
      paymentStatus: o.paymentStatus,
      status: o.status,
      items: (Array.isArray(o.items) ? (o.items as OrderItem[]) : []).map((item, idx) => ({ id: idx + 1, ...item })),
      subtotal: parseFloat(String(o.subtotal)),
      shippingCost: parseFloat(String(o.shippingCost ?? "0")),
      total: parseFloat(String(o.total)),
      notes: o.notes,
      createdAt: o.createdAt?.toISOString(),
      updatedAt: o.updatedAt?.toISOString(),
    });

    const [weeklyRevenueData, paymentMethodData, topProductsData] = await Promise.all([
      db.execute(sql`
        SELECT TO_CHAR(created_at, 'Dy') AS day, COALESCE(SUM(total::numeric), 0) AS revenue, COUNT(*) AS orders
        FROM orders
        WHERE created_at >= NOW() - INTERVAL '7 days'
        GROUP BY TO_CHAR(created_at, 'Dy'), DATE(created_at)
        ORDER BY DATE(created_at)
      `),
      db.select({ method: ordersTable.paymentMethod, count: sql<number>`COUNT(*)` })
        .from(ordersTable).groupBy(ordersTable.paymentMethod),
      db.execute(sql`
        SELECT item->>'productId' AS id, item->>'productName' AS name, item->>'productImage' AS "imageUrl",
               COALESCE(SUM((item->>'quantity')::int), 0) AS "totalSold"
        FROM orders, jsonb_array_elements(items) AS item
        GROUP BY item->>'productId', item->>'productName', item->>'productImage'
        ORDER BY "totalSold" DESC LIMIT 5
      `),
    ]);

    const totalPaymentOrders = paymentMethodData.reduce((s, p) => s + Number(p.count), 0);
    const paymentColors: Record<string, string> = { bkash: "#e2136e", nagad: "#f7941d", cod: "#16a34a", rocket: "#8b2291" };
    const paymentLabels: Record<string, string> = { bkash: "bKash", nagad: "Nagad", cod: "COD", rocket: "Rocket" };
    const paymentDistribution = paymentMethodData.map((p) => ({
      name: paymentLabels[p.method] || p.method,
      value: totalPaymentOrders > 0 ? Math.round((Number(p.count) / totalPaymentOrders) * 100) : 0,
      color: paymentColors[p.method] || "#6b7280",
    }));

    const weeklyRows = ((weeklyRevenueData as unknown as { rows?: WeeklyRow[] }).rows
      ?? weeklyRevenueData as unknown as WeeklyRow[]);
    const weeklyData = weeklyRows.map((w) => ({
      day: w.day,
      revenue: Number(w.revenue),
      orders: Number(w.orders),
    }));

    const topRows = ((topProductsData as unknown as { rows?: TopProductRow[] }).rows
      ?? topProductsData as unknown as TopProductRow[]);
    const topProducts = topRows.map((p) => ({
      id: Number(p.id),
      name: String(p.name ?? ""),
      imageUrl: String(p.imageUrl ?? ""),
      totalSold: Number(p.totalSold ?? 0),
    }));

    return c.json({
      totalOrders: Number(totalResult[0]?.count ?? 0),
      pendingOrders: Number(pendingResult[0]?.count ?? 0),
      processingOrders: Number(processingResult[0]?.count ?? 0),
      shippedOrders: Number(shippedResult[0]?.count ?? 0),
      deliveredOrders: Number(deliveredResult[0]?.count ?? 0),
      totalRevenue: Number(totalRevenueResult[0]?.total ?? 0),
      todayRevenue: Number(todayRevenueResult[0]?.total ?? 0),
      totalProducts: Number(totalProductsResult[0]?.count ?? 0),
      lowStockProducts: Number(lowStockResult[0]?.count ?? 0),
      recentOrders: recentOrdersRaw.map(mapOrder),
      weeklyData,
      paymentDistribution,
      topProducts,
    });
  } catch (err) {
    console.error("Admin stats error", err);
    return c.json({ error: "internal_error", message: "Failed to get stats" }, 500);
  }
});

app.get("/admin/customers", requireAdmin, async (c) => {
  try {
    const db = createDb(c.env.DATABASE_URL);
    const allOrders = await db.select().from(ordersTable).orderBy(desc(ordersTable.createdAt));

    const customerMap = new Map<string, {
      name: string; email: string; phone: string; district: string; city: string; address: string;
      totalOrders: number; totalSpent: number; firstOrder: string; lastOrder: string;
      paymentMethods: string[]; statuses: string[];
    }>();

    for (const o of allOrders) {
      const key = o.customerPhone || o.customerEmail;
      const existing = customerMap.get(key);
      if (existing) {
        existing.totalOrders += 1;
        existing.totalSpent += parseFloat(String(o.total));
        const oIso = o.createdAt?.toISOString() ?? "";
        if (oIso && oIso < existing.firstOrder) existing.firstOrder = oIso;
        if (oIso && oIso > existing.lastOrder) existing.lastOrder = oIso;
        if (!existing.paymentMethods.includes(o.paymentMethod)) existing.paymentMethods.push(o.paymentMethod);
        if (!existing.statuses.includes(o.status)) existing.statuses.push(o.status);
      } else {
        const oIso = o.createdAt?.toISOString() ?? "";
        customerMap.set(key, {
          name: o.customerName, email: o.customerEmail, phone: o.customerPhone,
          district: o.shippingDistrict || "", city: o.shippingCity || "", address: o.shippingAddress || "",
          totalOrders: 1, totalSpent: parseFloat(String(o.total)),
          firstOrder: oIso, lastOrder: oIso,
          paymentMethods: [o.paymentMethod], statuses: [o.status],
        });
      }
    }

    const customers = Array.from(customerMap.values()).sort(
      (a, b) => new Date(b.lastOrder).getTime() - new Date(a.lastOrder).getTime()
    );

    const districtCounts: Record<string, number> = {};
    for (const cust of customers) {
      if (cust.district) districtCounts[cust.district] = (districtCounts[cust.district] || 0) + 1;
    }
    const topDistricts = Object.entries(districtCounts)
      .sort((a, b) => b[1] - a[1]).slice(0, 10)
      .map(([district, count]) => ({ district, count }));

    return c.json({ totalCustomers: customers.length, totalOrders: allOrders.length, customers, topDistricts });
  } catch (err) {
    return c.json({ error: "internal_error", message: "Failed to list customers" }, 500);
  }
});

app.get("/admin/guest-customers", requireAdmin, async (c) => {
  try {
    const db = createDb(c.env.DATABASE_URL);
    const guests = await db.select().from(customersTable)
      .where(eq(customersTable.isGuest, true))
      .orderBy(desc(customersTable.createdAt));

    const enriched = await Promise.all(guests.map(async (g) => {
      const orders = await db.select().from(ordersTable)
        .where(eq(ordersTable.customerEmail, g.email))
        .orderBy(desc(ordersTable.createdAt));
      const totalSpent = orders.reduce((s, o) => s + parseFloat(String(o.total)), 0);
      const last = orders[0];
      const username = g.email.includes("@") ? g.email.split("@")[0] : g.email;
      return {
        id: g.id,
        guestSequence: g.guestSequence ?? null,
        username,
        name: g.name,
        email: g.email,
        phone: g.phone,
        createdAt: g.createdAt?.toISOString(),
        totalOrders: orders.length,
        totalSpent,
        lastOrderAt: last?.createdAt?.toISOString() || null,
        lastOrderNumber: last?.orderNumber || null,
        lastOrderStatus: last?.status || null,
        shippingDistrict: last?.shippingDistrict || null,
        shippingCity: last?.shippingCity || null,
        shippingAddress: last?.shippingAddress || null,
      };
    }));

    return c.json({
      totalGuests: enriched.length,
      withOrders: enriched.filter((g) => g.totalOrders > 0).length,
      guests: enriched,
    });
  } catch (err) {
    return c.json({ error: "internal_error", message: "Failed to load guest customers" }, 500);
  }
});

app.post("/admin/guest-customers/:id/convert", requireAdmin, async (c) => {
  try {
    const db = createDb(c.env.DATABASE_URL);
    const id = Number(c.req.param("id"));
    if (!Number.isFinite(id)) return c.json({ error: "validation_error", message: "Invalid id" }, 400);
    const body = await c.req.json();
    const { email, password, name } = body as { email?: string; password?: string; name?: string };
    if (!email || !password) return c.json({ error: "validation_error", message: "email and password are required" }, 400);
    if (password.length < 6) return c.json({ error: "validation_error", message: "Password must be at least 6 characters" }, 400);
    const emailLc = email.toLowerCase().trim();
    const [existing] = await db.select().from(customersTable).where(eq(customersTable.id, id)).limit(1);
    if (!existing) return c.json({ error: "not_found", message: "Customer not found" }, 404);
    if (!existing.isGuest) return c.json({ error: "bad_request", message: "Only guest accounts can be converted from this endpoint" }, 400);
    const [taken] = await db.select().from(customersTable).where(eq(customersTable.email, emailLc)).limit(1);
    if (taken && taken.id !== id) return c.json({ error: "conflict", message: "An account with this email already exists" }, 409);
    await db.update(ordersTable).set({ customerEmail: emailLc, customerId: id }).where(eq(ordersTable.customerEmail, existing.email));
    const passwordHash = await hashPassword(password);
    const [updated] = await db.update(customersTable).set({
      email: emailLc,
      passwordHash,
      isGuest: false,
      verified: true,
      updatedAt: new Date(),
      name: name?.trim() || undefined,
    }).where(eq(customersTable.id, id)).returning();
    if (!updated) return c.json({ error: "not_found", message: "Customer not found" }, 404);
    logActivity(db, { action: "update", entity: "customer", entityId: id, entityName: updated.name ?? updated.email, before: existing as unknown as Record<string, unknown>, after: updated as unknown as Record<string, unknown>, adminId: getAdminId(c) });
    return c.json({ success: true, customer: { id: updated.id, name: updated.name, email: updated.email, isGuest: updated.isGuest } });
  } catch (err: unknown) {
    if ((err as { code?: string })?.code === "23505") return c.json({ error: "conflict", message: "An account with this email already exists" }, 409);
    return c.json({ error: "internal_error", message: "Failed to convert guest account" }, 500);
  }
});

app.delete("/admin/guest-customers/:id", requireAdmin, async (c) => {
  try {
    const db = createDb(c.env.DATABASE_URL);
    const id = Number(c.req.param("id"));
    if (!Number.isFinite(id)) return c.json({ error: "validation_error", message: "Invalid id" }, 400);
    const [existing] = await db.select().from(customersTable).where(eq(customersTable.id, id)).limit(1);
    if (!existing) return c.json({ error: "not_found", message: "Customer not found" }, 404);
    if (!existing.isGuest) return c.json({ error: "bad_request", message: "Refusing to delete a non-guest account from this endpoint" }, 400);
    await db.delete(customersTable).where(eq(customersTable.id, id));
    logActivity(db, { action: "delete", entity: "customer", entityId: id, entityName: existing.name ?? existing.email, before: existing as unknown as Record<string, unknown>, adminId: getAdminId(c) });
    return c.json({ success: true });
  } catch (err) {
    return c.json({ error: "internal_error", message: "Failed to delete guest customer" }, 500);
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
  } catch (err: unknown) {
    if ((err as { code?: string })?.code === "23505") {
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
    const data = await res.json() as TelegramApiResponse;
    if (!data.ok) {
      return c.json({ error: "telegram_error", message: data.description || "Telegram API error" }, 502);
    }
    const updates = data.result ?? [];
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
    const data = await res.json() as TelegramApiResponse;
    if (!data.ok) {
      return c.json({ error: "telegram_error", message: data.description || "Failed to send message" }, 502);
    }
    return c.json({ success: true, message: "Test message sent to your Telegram." });
  } catch (err) {
    return c.json({ error: "fetch_error", message: String(err) }, 500);
  }
});

export default app;
