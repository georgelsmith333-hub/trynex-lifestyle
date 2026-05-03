import { Hono } from "hono";
import { eq, desc, and, ilike, sql, or, gte } from "drizzle-orm";
import { createDb } from "../db";
import {
  ordersTable,
  productsTable,
  promoCodesTable,
  referralsTable,
  settingsTable,
  customersTable,
} from "../schema";
import { requireAdmin } from "../middleware/adminAuth";
import { logActivity, getAdminId } from "../lib/activityLog";
import { verifyCustomerToken, extractCustomerToken } from "../lib/auth";
import { getVirtualPromo, calcVirtualDiscount } from "../lib/spinPromos";
import type { AppEnv } from "../types";

const app = new Hono<AppEnv>();

function generateOrderNumber(): string {
  const now = new Date();
  const yy = String(now.getFullYear()).slice(2);
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  const rnd = Math.random().toString(36).toUpperCase().slice(2, 7);
  return `TN${yy}${mm}${dd}${rnd}`;
}

function mapOrder(o: any) {
  return {
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
    items: o.items ?? [],
    subtotal: parseFloat(o.subtotal ?? 0),
    shippingCost: parseFloat(o.shippingCost ?? 0),
    total: parseFloat(o.total ?? 0),
    notes: o.notes,
    promoCode: o.promoCode,
    promoDiscount: o.promoDiscount ? parseFloat(o.promoDiscount) : null,
    customerId: o.customerId,
    studioAssetsMissing: o.studioAssetsMissing ?? false,
    createdAt: o.createdAt?.toISOString(),
    updatedAt: o.updatedAt?.toISOString(),
  };
}

async function sendTelegramNotification(
  botToken: string,
  chatId: string,
  message: string,
): Promise<void> {
  try {
    const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
    await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text: message, parse_mode: "HTML" }),
      signal: AbortSignal.timeout(5000),
    });
  } catch (err) {
    console.error("[Telegram] Notification failed:", err);
  }
}

async function sendMetaCAPIEvent(
  env: AppEnv["Bindings"],
  eventData: {
    eventName: string;
    orderNumber: string;
    total: number;
    currency: string;
    items: any[];
    customerEmail?: string;
    customerPhone?: string;
  },
): Promise<void> {
  try {
    const db = createDb(env.DATABASE_URL);
    const [tokenRow] = await db.select().from(settingsTable).where(eq(settingsTable.key, "metaCapiToken"));
    const [pixelRow] = await db.select().from(settingsTable).where(eq(settingsTable.key, "facebookPixelId"));
    const capiToken = tokenRow?.value?.trim();
    const pixelId = pixelRow?.value?.trim();
    if (!capiToken || !pixelId) return;

    const hashPhone = async (phone: string) => {
      const cleaned = phone.replace(/\D/g, "");
      const bd = cleaned.startsWith("880") ? cleaned : `880${cleaned.replace(/^0/, "")}`;
      const data = new TextEncoder().encode(bd);
      const hash = await crypto.subtle.digest("SHA-256", data);
      return Array.from(new Uint8Array(hash)).map((b) => b.toString(16).padStart(2, "0")).join("");
    };

    const hashEmail = async (email: string) => {
      const data = new TextEncoder().encode(email.toLowerCase().trim());
      const hash = await crypto.subtle.digest("SHA-256", data);
      return Array.from(new Uint8Array(hash)).map((b) => b.toString(16).padStart(2, "0")).join("");
    };

    const userData: Record<string, string> = {};
    if (eventData.customerEmail) userData.em = await hashEmail(eventData.customerEmail);
    if (eventData.customerPhone) userData.ph = await hashPhone(eventData.customerPhone);

    const payload = {
      data: [{
        event_name: eventData.eventName,
        event_time: Math.floor(Date.now() / 1000),
        action_source: "website",
        user_data: userData,
        custom_data: {
          order_id: eventData.orderNumber,
          value: eventData.total,
          currency: eventData.currency,
          num_items: eventData.items.length,
          content_ids: eventData.items.map((item: any) => String(item.productId || item.id || "")).filter(Boolean),
          content_type: "product",
          contents: eventData.items.map((item: any) => ({
            id: String(item.productId || item.id || ""),
            quantity: item.quantity || 1,
            item_price: parseFloat(String(item.price || 0)),
          })),
        },
      }],
    };

    await fetch(`https://graph.facebook.com/v18.0/${pixelId}/events?access_token=${capiToken}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(5000),
    });
  } catch (err) {
    console.error("[Meta CAPI] Failed to send event:", err);
  }
}

async function moveStudioOriginals(
  studioItems: any[],
  orderNumber: string,
  env: AppEnv["Bindings"],
): Promise<{ assetsMissing: boolean }> {
  let assetsMissing = false;
  for (let itemIdx = 0; itemIdx < studioItems.length; itemIdx++) {
    const item = studioItems[itemIdx];
    let assets: Array<{ objectPath: string; filename: string; assetType: string }> = [];
    try {
      const noteRaw = item.note || item.customNote || item.studioData || "";
      if (noteRaw) {
        const parsed = typeof noteRaw === "string" ? JSON.parse(noteRaw) : noteRaw;
        if (Array.isArray(parsed?.assets)) assets = parsed.assets;
        else if (parsed?.objectPath) assets = [parsed];
      }
    } catch { }
    if (assets.length === 0) continue;

    for (const asset of assets) {
      try {
        if (!asset?.objectPath) { assetsMissing = true; continue; }
        const srcKey = asset.objectPath.replace(/^\//, "");
        const obj = await env.R2.get(srcKey);
        if (!obj) { assetsMissing = true; continue; }

        const ext = asset.filename?.split(".").pop() || "jpg";
        const destFilename = asset.filename || `asset-${itemIdx}.${ext}`;
        const destKey = `uploads/orders/${orderNumber}/${itemIdx}/${destFilename}`;

        await env.R2.put(destKey, await obj.arrayBuffer(), {
          httpMetadata: { contentType: obj.httpMetadata?.contentType || "image/jpeg" },
        });
        await env.R2.delete(srcKey);
      } catch (err) {
        console.error("[studio] Failed to move asset", err);
        assetsMissing = true;
      }
    }
  }
  return { assetsMissing };
}

async function applyPromoToOrder(
  db: ReturnType<typeof createDb>,
  promoCode: string | undefined,
  subtotal: number,
  shippingCost: number,
  customerEmail: string,
): Promise<{
  discount: number;
  freeShipping: boolean;
  promoId?: number;
  isReferral?: boolean;
  referralId?: number;
}> {
  if (!promoCode) return { discount: 0, freeShipping: false };

  const virtual = getVirtualPromo(promoCode);
  if (virtual) {
    if (virtual.minOrderAmount && subtotal < virtual.minOrderAmount) return { discount: 0, freeShipping: false };
    const { discount, freeShipping } = calcVirtualDiscount(virtual, subtotal, shippingCost);
    return { discount, freeShipping };
  }

  const upperCode = promoCode.toUpperCase().trim();
  const [promo] = await db.select().from(promoCodesTable).where(eq(promoCodesTable.code, upperCode));
  if (promo && promo.active) {
    const minOrder = parseFloat(promo.minOrderAmount || "0");
    if (subtotal < minOrder) return { discount: 0, freeShipping: false };
    if (promo.expiresAt && new Date(promo.expiresAt) < new Date()) return { discount: 0, freeShipping: false };
    if (promo.maxUses && promo.maxUses > 0 && (promo.usedCount || 0) >= promo.maxUses) return { discount: 0, freeShipping: false };
    let discount = 0;
    if (promo.discountType === "percentage") {
      discount = Math.round(subtotal * parseFloat(promo.discountValue) / 100);
    } else {
      discount = parseFloat(promo.discountValue);
    }
    return { discount, freeShipping: false, promoId: promo.id };
  }

  const [referral] = await db.select().from(referralsTable).where(eq(referralsTable.referralCode, upperCode));
  if (referral && referral.active) {
    if (referral.ownerEmail?.toLowerCase().trim() === customerEmail?.toLowerCase().trim()) {
      return { discount: 0, freeShipping: false };
    }
    const discount = Math.round(subtotal * 0.10);
    return { discount, freeShipping: false, isReferral: true, referralId: referral.id };
  }

  return { discount: 0, freeShipping: false };
}

app.get("/orders", requireAdmin, async (c) => {
  try {
    const db = createDb(c.env.DATABASE_URL);
    const page = c.req.query("page") || "1";
    const limit = c.req.query("limit") || "20";
    const status = c.req.query("status");
    const search = c.req.query("search");
    const paymentStatus = c.req.query("paymentStatus");
    const dateFrom = c.req.query("dateFrom");

    const pageNum = Math.max(1, parseInt(page, 10));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10)));
    const offset = (pageNum - 1) * limitNum;

    const conditions: any[] = [];
    if (status) conditions.push(eq(ordersTable.status, status));
    if (paymentStatus) conditions.push(eq(ordersTable.paymentStatus, paymentStatus));
    if (search) {
      conditions.push(or(
        ilike(ordersTable.customerName, `%${search}%`),
        ilike(ordersTable.orderNumber, `%${search}%`),
        ilike(ordersTable.customerEmail, `%${search}%`),
        ilike(ordersTable.customerPhone, `%${search}%`),
      )!);
    }
    if (dateFrom) conditions.push(gte(ordersTable.createdAt, new Date(dateFrom)));
    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const [orders, countResult] = await Promise.all([
      db.select().from(ordersTable).where(where).orderBy(desc(ordersTable.createdAt)).limit(limitNum).offset(offset),
      db.select({ count: sql<number>`count(*)` }).from(ordersTable).where(where),
    ]);

    return c.json({
      orders: orders.map(mapOrder),
      total: Number(countResult[0]?.count ?? 0),
      page: pageNum,
      limit: limitNum,
      totalPages: Math.ceil(Number(countResult[0]?.count ?? 0) / limitNum),
    });
  } catch (err) {
    console.error("Failed to list orders", err);
    return c.json({ error: "internal_error", message: "Failed to list orders" }, 500);
  }
});

app.get("/orders/:id", async (c) => {
  try {
    const db = createDb(c.env.DATABASE_URL);
    const idOrNumber = c.req.param("id");

    const token = extractCustomerToken(c);
    let customerId: number | null = null;
    if (token) {
      const payload = await verifyCustomerToken(token, c.env.JWT_SECRET);
      if (payload) customerId = payload.id;
    }

    let order: any;
    if (/^\d+$/.test(idOrNumber)) {
      [order] = await db.select().from(ordersTable).where(eq(ordersTable.id, parseInt(idOrNumber, 10)));
    } else {
      [order] = await db.select().from(ordersTable).where(eq(ordersTable.orderNumber, idOrNumber));
    }

    if (!order) return c.json({ error: "not_found", message: "Order not found" }, 404);

    const isAdmin = !!(c.req.header("authorization") || getCookie_raw(c, "admin_token"));
    if (!isAdmin && customerId !== null && order.customerId !== customerId) {
      return c.json({ error: "forbidden", message: "Access denied" }, 403);
    }

    return c.json(mapOrder(order));
  } catch (err) {
    console.error("Failed to get order", err);
    return c.json({ error: "internal_error", message: "Failed to get order" }, 500);
  }
});

function getCookie_raw(c: any, name: string): string | null {
  const header = c.req.header("cookie") || "";
  const parts = header.split(";").map((p: string) => p.trim());
  for (const part of parts) {
    const [k, ...v] = part.split("=");
    if (k.trim() === name) return v.join("=").trim();
  }
  return null;
}

app.get("/orders/customer/me", async (c) => {
  try {
    const db = createDb(c.env.DATABASE_URL);
    const token = extractCustomerToken(c);
    if (!token) return c.json({ error: "unauthorized" }, 401);
    const payload = await verifyCustomerToken(token, c.env.JWT_SECRET);
    if (!payload) return c.json({ error: "unauthorized" }, 401);

    const orders = await db
      .select()
      .from(ordersTable)
      .where(eq(ordersTable.customerId, payload.id))
      .orderBy(desc(ordersTable.createdAt));

    return c.json({ orders: orders.map(mapOrder) });
  } catch (err) {
    console.error("Failed to get customer orders", err);
    return c.json({ error: "internal_error", message: "Failed to get orders" }, 500);
  }
});

// POST /orders/track — identity-verified tracking (primary endpoint used by the storefront)
// Requires orderNumber + email OR phone to prevent order enumeration.
app.post("/orders/track", async (c) => {
  try {
    const db = createDb(c.env.DATABASE_URL);
    const body = await c.req.json();
    const { orderNumber, email, phone } = body as { orderNumber?: string; email?: string; phone?: string };

    if (!orderNumber) {
      return c.json({ error: "validation_error", message: "orderNumber is required" }, 400);
    }

    const identifier = (email || "").trim().toLowerCase();
    const phoneClean = (phone || "").replace(/\D/g, "").slice(-10);
    if (!identifier && !phoneClean) {
      return c.json({ error: "validation_error", message: "email or phone is required" }, 400);
    }

    const orderNum = orderNumber.toUpperCase().trim();
    let order: typeof ordersTable.$inferSelect | undefined;

    if (identifier) {
      const rows = await db.select().from(ordersTable).where(
        and(eq(ordersTable.orderNumber, orderNum), eq(ordersTable.customerEmail, identifier)),
      );
      order = rows[0];
    }

    if (!order && phoneClean) {
      const [candidate] = await db.select().from(ordersTable).where(eq(ordersTable.orderNumber, orderNum));
      if (candidate) {
        const storedPhone = (candidate.customerPhone || "").replace(/\D/g, "").slice(-10);
        if (storedPhone === phoneClean) order = candidate;
      }
    }

    if (!order) {
      return c.json({ error: "not_found", message: "Order not found. Check your order number and contact details." }, 404);
    }

    return c.json(mapOrder(order));
  } catch (err) {
    console.error("Failed to track order", err instanceof Error ? err.message : String(err));
    return c.json({ error: "internal_error", message: "Failed to track order" }, 500);
  }
});

// GET /orders/track/:orderNumber — identity-verified tracking via query params (keeps backward compat)
// Requires ?email= OR ?phone= to prevent order enumeration by number alone.
app.get("/orders/track/:orderNumber", async (c) => {
  try {
    const db = createDb(c.env.DATABASE_URL);
    const orderNumber = c.req.param("orderNumber").toUpperCase().trim();
    const email = (c.req.query("email") || "").trim().toLowerCase();
    const phone = (c.req.query("phone") || "").replace(/\D/g, "").slice(-10);

    if (!email && !phone) {
      return c.json({ error: "validation_error", message: "email or phone query param is required" }, 400);
    }

    let order: typeof ordersTable.$inferSelect | undefined;

    if (email) {
      const rows = await db.select().from(ordersTable).where(
        and(eq(ordersTable.orderNumber, orderNumber), eq(ordersTable.customerEmail, email)),
      );
      order = rows[0];
    }

    if (!order && phone) {
      const [candidate] = await db.select().from(ordersTable).where(eq(ordersTable.orderNumber, orderNumber));
      if (candidate) {
        const storedPhone = (candidate.customerPhone || "").replace(/\D/g, "").slice(-10);
        if (storedPhone === phone) order = candidate;
      }
    }

    if (!order) return c.json({ error: "not_found", message: "Order not found. Check your order number and contact details." }, 404);

    return c.json(mapOrder(order));
  } catch (err) {
    console.error("Failed to track order", err instanceof Error ? err.message : String(err));
    return c.json({ error: "internal_error", message: "Failed to track order" }, 500);
  }
});

app.post("/orders", async (c) => {
  try {
    const db = createDb(c.env.DATABASE_URL);
    const body = await c.req.json();

    const {
      customerName, customerEmail, customerPhone,
      shippingAddress, shippingCity, shippingDistrict,
      paymentMethod, items, notes,
      promoCode, customerId: bodyCustomerId,
      utmSource, utmMedium, utmCampaign,
    } = body;

    if (!customerName || !customerEmail || !customerPhone || !shippingAddress || !paymentMethod || !items?.length) {
      return c.json({ error: "validation_error", message: "Missing required order fields" }, 400);
    }

    const ALLOWED_PAYMENT_METHODS = ["bkash", "nagad", "rocket", "cod", "bank_transfer", "card"];
    if (!ALLOWED_PAYMENT_METHODS.includes(paymentMethod)) {
      return c.json({ error: "validation_error", message: "Invalid payment method" }, 400);
    }

    const token = extractCustomerToken(c);
    let resolvedCustomerId: number | null = bodyCustomerId ?? null;
    if (token && !resolvedCustomerId) {
      const payload = await verifyCustomerToken(token, c.env.JWT_SECRET);
      if (payload) resolvedCustomerId = payload.id;
    }

    const settingsRows = await db.select().from(settingsTable);
    const settingsMap: Record<string, string | null> = {};
    for (const row of settingsRows) settingsMap[row.key] = row.value;

    const configShippingCost = parseFloat(settingsMap["shippingCost"] ?? "100");
    const freeShippingThreshold = parseFloat(settingsMap["freeShippingThreshold"] ?? "1500");

    let subtotal = 0;
    const validatedItems: any[] = [];
    for (const item of items) {
      if (!item.name || item.price === undefined || !item.quantity) {
        return c.json({ error: "validation_error", message: "Each item needs name, price, and quantity" }, 400);
      }
      const itemTotal = parseFloat(String(item.price)) * parseInt(String(item.quantity), 10);
      subtotal += itemTotal;
      validatedItems.push({ ...item, price: parseFloat(String(item.price)), quantity: parseInt(String(item.quantity), 10) });
    }

    let promoDiscount = 0;
    let freeShippingFromPromo = false;
    let promoId: number | undefined;
    let isReferral = false;
    let referralId: number | undefined;

    if (promoCode) {
      const promoResult = await applyPromoToOrder(db, promoCode, subtotal, configShippingCost, customerEmail);
      promoDiscount = promoResult.discount;
      freeShippingFromPromo = promoResult.freeShipping;
      promoId = promoResult.promoId;
      isReferral = !!promoResult.isReferral;
      referralId = promoResult.referralId;
    }

    const effectiveSubtotal = Math.max(0, subtotal - promoDiscount);
    const baseShipping = freeShippingFromPromo ? 0 : (subtotal >= freeShippingThreshold ? 0 : configShippingCost);
    const total = effectiveSubtotal + baseShipping;

    const orderNumber = generateOrderNumber();

    const orderData: any = {
      orderNumber,
      customerName: customerName.trim(),
      customerEmail: customerEmail.toLowerCase().trim(),
      customerPhone: customerPhone.trim(),
      shippingAddress: shippingAddress.trim(),
      shippingCity: shippingCity?.trim() ?? null,
      shippingDistrict: shippingDistrict?.trim() ?? null,
      paymentMethod,
      paymentStatus: paymentMethod === "cod" ? "pending" : "pending",
      status: "pending",
      items: validatedItems,
      subtotal: String(subtotal),
      shippingCost: String(baseShipping),
      total: String(total),
      notes: notes?.trim() ?? null,
      promoCode: promoCode?.toUpperCase().trim() ?? null,
      promoDiscount: promoDiscount > 0 ? String(promoDiscount) : null,
      customerId: resolvedCustomerId,
    };

    const [order] = await db.insert(ordersTable).values(orderData).returning();

    if (promoId) {
      await db.update(promoCodesTable).set({ usedCount: sql`COALESCE(used_count, 0) + 1` }).where(eq(promoCodesTable.id, promoId)).catch(() => {});
    }

    if (referralId) {
      const referralEarning = Math.round(total * 0.10);
      await db.update(referralsTable).set({
        usedCount: sql`COALESCE(used_count, 0) + 1`,
        totalEarnings: sql`COALESCE(total_earnings, 0) + ${referralEarning}`,
      }).where(eq(referralsTable.id, referralId)).catch(() => {});
    }

    for (const item of validatedItems) {
      if (item.productId && typeof item.quantity === "number" && item.quantity > 0) {
        await db.execute(sql`UPDATE products SET stock = GREATEST(stock - ${item.quantity}, 0) WHERE id = ${item.productId}`).catch(() => {});
      }
    }

    const studioItems = validatedItems.filter((it) => it.type === "studio" || it.isStudio || it.studioData);
    let studioAssetsMissing = false;
    if (studioItems.length > 0) {
      const { assetsMissing } = await moveStudioOriginals(studioItems, orderNumber, c.env);
      studioAssetsMissing = assetsMissing;
      if (studioAssetsMissing) {
        await db.update(ordersTable).set({ studioAssetsMissing: true }).where(eq(ordersTable.id, order.id)).catch(() => {});
      }
    }

    const tgToken = c.env.TELEGRAM_BOT_TOKEN;
    const tgChat = c.env.TELEGRAM_CHAT_ID;
    if (tgToken && tgChat) {
      const itemsList = validatedItems.slice(0, 3).map((it) => `• ${it.name} x${it.quantity}`).join("\n");
      const msg =
        `🛍️ <b>NEW ORDER #${orderNumber}</b>\n` +
        `👤 Customer: ${customerName}\n` +
        `📞 Phone: ${customerPhone}\n` +
        `💳 Payment: ${paymentMethod.toUpperCase()}\n` +
        `💰 Total: ৳${total.toFixed(0)}\n` +
        `📦 Items:\n${itemsList}${validatedItems.length > 3 ? `\n   ... +${validatedItems.length - 3} more` : ""}\n` +
        `🏙️ City: ${shippingCity || "N/A"}\n` +
        (promoCode ? `🎟️ Promo: ${promoCode} (-৳${promoDiscount})\n` : "");
      sendTelegramNotification(tgToken, tgChat, msg).catch(() => {});
    }

    sendMetaCAPIEvent(c.env, {
      eventName: "Purchase",
      orderNumber,
      total,
      currency: "BDT",
      items: validatedItems,
      customerEmail: customerEmail,
      customerPhone: customerPhone,
    }).catch(() => {});

    return c.json({
      ...mapOrder({ ...order, studioAssetsMissing }),
      studioAssetsMissing,
    }, 201);
  } catch (err) {
    console.error("Failed to create order", err);
    return c.json({ error: "internal_error", message: "Failed to place order" }, 500);
  }
});

app.patch("/orders/:id/status", requireAdmin, async (c) => {
  try {
    const db = createDb(c.env.DATABASE_URL);
    const id = parseInt(c.req.param("id"), 10);
    const body = await c.req.json();
    const { status } = body;
    const VALID_STATUSES = ["pending", "confirmed", "processing", "shipped", "ongoing", "delivered", "cancelled"];
    if (!status || !VALID_STATUSES.includes(status)) {
      return c.json({ error: "validation_error", message: `status must be one of: ${VALID_STATUSES.join(", ")}` }, 400);
    }
    const [beforeSnap] = await db.select().from(ordersTable).where(eq(ordersTable.id, id));
    const [order] = await db.update(ordersTable).set({ status, updatedAt: new Date() }).where(eq(ordersTable.id, id)).returning();
    if (!order) return c.json({ error: "not_found", message: "Order not found" }, 404);
    logActivity(db, { action: "update", entity: "order", entityId: id, entityName: `#${order.orderNumber}`, before: (beforeSnap ?? null) as unknown as Record<string, unknown>, after: { status } as Record<string, unknown>, adminId: getAdminId(c) });
    return c.json(mapOrder(order));
  } catch (err) {
    console.error("Failed to update order status", err);
    return c.json({ error: "internal_error", message: "Failed to update order status" }, 500);
  }
});

app.patch("/orders/:id/payment-status", requireAdmin, async (c) => {
  try {
    const db = createDb(c.env.DATABASE_URL);
    const id = parseInt(c.req.param("id"), 10);
    const body = await c.req.json();
    const { paymentStatus } = body;
    const VALID = ["pending", "paid", "failed", "refunded", "submitted", "verified", "wrong", "cod", "not_paid"];
    if (!paymentStatus || !VALID.includes(paymentStatus)) {
      return c.json({ error: "validation_error", message: `paymentStatus must be one of: ${VALID.join(", ")}` }, 400);
    }
    const [order] = await db.update(ordersTable).set({ paymentStatus, updatedAt: new Date() }).where(eq(ordersTable.id, id)).returning();
    if (!order) return c.json({ error: "not_found", message: "Order not found" }, 404);
    return c.json(mapOrder(order));
  } catch (err) {
    console.error("Failed to update payment status", err);
    return c.json({ error: "internal_error", message: "Failed to update payment status" }, 500);
  }
});

app.put("/orders/:id", requireAdmin, async (c) => {
  try {
    const db = createDb(c.env.DATABASE_URL);
    const id = parseInt(c.req.param("id"), 10);
    const body = await c.req.json();
    const ALLOWED_FIELDS = [
      "customerName", "customerEmail", "customerPhone",
      "shippingAddress", "shippingCity", "shippingDistrict",
      "status", "paymentStatus", "paymentMethod",
      "items", "subtotal", "shippingCost", "total",
      "notes", "promoCode", "promoDiscount",
    ];
    const updates: Record<string, unknown> = { updatedAt: new Date() };
    for (const field of ALLOWED_FIELDS) {
      if (body[field] !== undefined) updates[field] = body[field];
    }
    if (updates.subtotal !== undefined) updates.subtotal = String(updates.subtotal);
    if (updates.shippingCost !== undefined) updates.shippingCost = String(updates.shippingCost);
    if (updates.total !== undefined) updates.total = String(updates.total);
    if (updates.promoDiscount !== undefined) updates.promoDiscount = updates.promoDiscount ? String(updates.promoDiscount) : null;

    const [beforeSnap] = await db.select().from(ordersTable).where(eq(ordersTable.id, id));
    const [order] = await db.update(ordersTable).set(updates).where(eq(ordersTable.id, id)).returning();
    if (!order) return c.json({ error: "not_found", message: "Order not found" }, 404);
    logActivity(db, { action: "update", entity: "order", entityId: id, entityName: `#${order.orderNumber}`, before: (beforeSnap ?? null) as unknown as Record<string, unknown>, after: updates as Record<string, unknown>, adminId: getAdminId(c) });
    return c.json(mapOrder(order));
  } catch (err) {
    console.error("Failed to update order", err);
    return c.json({ error: "internal_error", message: "Failed to update order" }, 500);
  }
});

app.delete("/orders/:id", requireAdmin, async (c) => {
  try {
    const db = createDb(c.env.DATABASE_URL);
    const id = parseInt(c.req.param("id"), 10);
    const [beforeSnap] = await db.select().from(ordersTable).where(eq(ordersTable.id, id));
    const [order] = await db.delete(ordersTable).where(eq(ordersTable.id, id)).returning();
    if (!order) return c.json({ error: "not_found", message: "Order not found" }, 404);
    logActivity(db, { action: "delete", entity: "order", entityId: id, entityName: `#${order.orderNumber}`, before: (beforeSnap ?? order) as unknown as Record<string, unknown>, adminId: getAdminId(c) });
    return c.json({ success: true });
  } catch (err) {
    console.error("Failed to delete order", err);
    return c.json({ error: "internal_error", message: "Failed to delete order" }, 500);
  }
});

export default app;
