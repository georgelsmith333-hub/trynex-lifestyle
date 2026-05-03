import { Hono } from "hono";
import { eq, sql } from "drizzle-orm";
import { createDb } from "../db";
import { promoCodesTable, referralsTable, settingsTable } from "../schema";
import { requireAdmin } from "../middleware/adminAuth";
import { getVirtualPromo, calcVirtualDiscount } from "../lib/spinPromos";
import { logActivity, getAdminId } from "../lib/activityLog";
import { z } from "zod";
import type { AppEnv } from "../types";

const app = new Hono<AppEnv>();

const PromoCreateSchema = z.object({
  code: z.string().min(1).max(50).regex(/^[A-Z0-9_-]+$/i),
  discountType: z.enum(["percentage", "fixed"]).optional(),
  discountValue: z.number({ required_error: "discountValue is required" }).positive(),
  minOrderAmount: z.number().nonnegative().optional(),
  maxUses: z.number().int().nonnegative().optional(),
  expiresAt: z.string().datetime({ offset: true }).optional().nullable(),
});

const PromoUpdateSchema = z.object({
  active: z.boolean().optional(),
  discountType: z.enum(["percentage", "fixed"]).optional(),
  discountValue: z.number().positive().optional(),
  minOrderAmount: z.number().nonnegative().optional(),
  maxUses: z.number().int().nonnegative().optional(),
  expiresAt: z.string().datetime({ offset: true }).optional().nullable(),
});

const exitIntentCooldowns = new Map<string, number>();
const EXIT_INTENT_COOLDOWN_MS = 10 * 60 * 1000;

function isExitIntentRateLimited(ip: string): boolean {
  const last = exitIntentCooldowns.get(ip);
  if (last && Date.now() - last < EXIT_INTENT_COOLDOWN_MS) return true;
  exitIntentCooldowns.set(ip, Date.now());
  if (exitIntentCooldowns.size > 5000) {
    const cutoff = Date.now() - EXIT_INTENT_COOLDOWN_MS;
    for (const [k, v] of exitIntentCooldowns) { if (v < cutoff) exitIntentCooldowns.delete(k); }
  }
  return false;
}

app.get("/promo-codes", requireAdmin, async (c) => {
  try {
    const db = createDb(c.env.DATABASE_URL);
    const codes = await db.select().from(promoCodesTable).orderBy(promoCodesTable.createdAt);
    return c.json({ promoCodes: codes });
  } catch (err) {
    return c.json({ error: "internal_error", message: "Failed to list promo codes" }, 500);
  }
});

app.post("/promo-codes", requireAdmin, async (c) => {
  try {
    const db = createDb(c.env.DATABASE_URL);
    const body = await c.req.json();
    const parsed = PromoCreateSchema.safeParse(body);
    if (!parsed.success) {
      return c.json({ error: "validation_error", message: parsed.error.errors.map((e) => e.message).join("; ") }, 400);
    }
    const { code, discountType, discountValue, minOrderAmount, maxUses, expiresAt } = parsed.data;
    const [promo] = await db.insert(promoCodesTable).values({
      code: code.toUpperCase().trim(),
      discountType: discountType ?? "percentage",
      discountValue: String(discountValue),
      minOrderAmount: minOrderAmount != null ? String(minOrderAmount) : "0",
      maxUses: maxUses ?? 0,
      expiresAt: expiresAt ? new Date(expiresAt) : null,
    }).returning();
    logActivity(db, { action: "create", entity: "promo", entityId: promo.id, entityName: promo.code, after: promo as unknown as Record<string, unknown>, adminId: getAdminId(c) });
    return c.json(promo, 201);
  } catch (err: any) {
    if (err?.code === "23505") {
      return c.json({ error: "duplicate", message: "Promo code already exists" }, 409);
    }
    return c.json({ error: "internal_error", message: "Failed to create promo code" }, 500);
  }
});

app.post("/promo-codes/validate", async (c) => {
  try {
    const db = createDb(c.env.DATABASE_URL);
    const body = await c.req.json();
    const { code, orderTotal, customerEmail } = body;
    if (!code) return c.json({ error: "validation_error", message: "code is required" }, 400);

    const virtual = getVirtualPromo(code);
    if (virtual) {
      const subtotal = Number(orderTotal) || 0;
      if (virtual.minOrderAmount && subtotal < virtual.minOrderAmount) {
        return c.json({ error: "min_order", message: `Minimum order of ৳${virtual.minOrderAmount} required for this code` }, 400);
      }
      const { discount, freeShipping } = calcVirtualDiscount(virtual, subtotal, 0);
      return c.json({ valid: true, code: virtual.code, discountType: virtual.discountType, discountValue: virtual.discountValue, discount, freeShipping, message: virtual.message });
    }

    const [promo] = await db.select().from(promoCodesTable).where(eq(promoCodesTable.code, code.toUpperCase().trim()));
    if (!promo) {
      const [referral] = await db.select().from(referralsTable).where(eq(referralsTable.referralCode, code.toUpperCase().trim()));
      if (referral && referral.active) {
        if (customerEmail && referral.ownerEmail && customerEmail.toLowerCase().trim() === referral.ownerEmail.toLowerCase().trim()) {
          return c.json({ error: "self_referral", message: "You cannot use your own referral code" }, 400);
        }
        const discountPct = 10;
        const discount = Math.round((orderTotal || 0) * discountPct / 100);
        return c.json({ valid: true, code: referral.referralCode, discountType: "percentage", discountValue: discountPct, discount, isReferral: true, referralId: referral.id, message: `${discountPct}% referral discount applied!` });
      }
      return c.json({ error: "invalid_code", message: "This promo code is not valid" }, 404);
    }

    if (!promo.active) return c.json({ error: "inactive", message: "This promo code is no longer active" }, 400);
    if (promo.expiresAt && new Date(promo.expiresAt) < new Date()) return c.json({ error: "expired", message: "This promo code has expired" }, 400);
    if (promo.maxUses && promo.maxUses > 0 && (promo.usedCount || 0) >= promo.maxUses) return c.json({ error: "max_uses", message: "This promo code has reached its usage limit" }, 400);

    const minOrder = parseFloat(promo.minOrderAmount || "0");
    if (orderTotal && orderTotal < minOrder) {
      return c.json({ error: "min_order", message: `Minimum order of ৳${minOrder} required for this code` }, 400);
    }

    let discount = 0;
    if (promo.discountType === "percentage") {
      discount = Math.round((orderTotal || 0) * parseFloat(promo.discountValue) / 100);
    } else {
      discount = parseFloat(promo.discountValue);
    }

    return c.json({
      valid: true,
      code: promo.code,
      discountType: promo.discountType,
      discountValue: parseFloat(promo.discountValue),
      discount,
      message: promo.discountType === "percentage" ? `${promo.discountValue}% off applied!` : `৳${promo.discountValue} off applied!`,
    });
  } catch (err) {
    return c.json({ error: "internal_error", message: "Validation failed" }, 500);
  }
});

app.put("/promo-codes/:id/use", async (c) => {
  try {
    const db = createDb(c.env.DATABASE_URL);
    const id = parseInt(c.req.param("id"), 10);
    await db.update(promoCodesTable).set({ usedCount: sql`COALESCE(used_count, 0) + 1` }).where(eq(promoCodesTable.id, id));
    return c.json({ success: true });
  } catch (err) {
    return c.json({ error: "internal_error", message: "Failed to update promo usage" }, 500);
  }
});

app.patch("/promo-codes/:id", requireAdmin, async (c) => {
  try {
    const db = createDb(c.env.DATABASE_URL);
    const id = parseInt(c.req.param("id"), 10);
    if (isNaN(id)) return c.json({ error: "validation_error", message: "Invalid id" }, 400);
    const body = await c.req.json();
    const parsed = PromoUpdateSchema.safeParse(body);
    if (!parsed.success) {
      return c.json({ error: "validation_error", message: parsed.error.errors.map((e) => e.message).join("; ") }, 400);
    }
    const { active, discountType, discountValue, minOrderAmount, maxUses, expiresAt } = parsed.data;
    const updates: Record<string, unknown> = {};
    if (active !== undefined) updates.active = active;
    if (discountType !== undefined) updates.discountType = discountType;
    if (discountValue !== undefined) updates.discountValue = String(discountValue);
    if (minOrderAmount !== undefined) updates.minOrderAmount = String(minOrderAmount);
    if (maxUses !== undefined) updates.maxUses = maxUses;
    if (expiresAt !== undefined) updates.expiresAt = expiresAt ? new Date(expiresAt) : null;
    if (Object.keys(updates).length === 0) {
      return c.json({ error: "validation_error", message: "No fields to update" }, 400);
    }
    const [before] = await db.select().from(promoCodesTable).where(eq(promoCodesTable.id, id));
    if (!before) return c.json({ error: "not_found", message: "Promo code not found" }, 404);
    const [updated] = await db.update(promoCodesTable).set(updates).where(eq(promoCodesTable.id, id)).returning();
    logActivity(db, { action: "update", entity: "promo", entityId: id, entityName: updated.code, before: before as unknown as Record<string, unknown>, after: updated as unknown as Record<string, unknown>, adminId: getAdminId(c) });
    return c.json(updated);
  } catch (err) {
    return c.json({ error: "internal_error", message: "Failed to update promo code" }, 500);
  }
});

app.delete("/promo-codes/:id", requireAdmin, async (c) => {
  try {
    const db = createDb(c.env.DATABASE_URL);
    const id = parseInt(c.req.param("id"), 10);
    const [beforeSnap] = await db.select().from(promoCodesTable).where(eq(promoCodesTable.id, id));
    await db.delete(promoCodesTable).where(eq(promoCodesTable.id, id));
    if (beforeSnap) logActivity(db, { action: "delete", entity: "promo", entityId: id, entityName: beforeSnap.code, before: beforeSnap as unknown as Record<string, unknown>, adminId: getAdminId(c) });
    return c.json({ success: true });
  } catch (err) {
    return c.json({ error: "internal_error", message: "Failed to delete promo code" }, 500);
  }
});

app.post("/promo-codes/exit-intent", async (c) => {
  try {
    const db = createDb(c.env.DATABASE_URL);
    const body = await c.req.json();
    const { contact } = body;
    if (!contact || typeof contact !== "string" || contact.trim().length < 3) {
      return c.json({ error: "validation_error", message: "Contact (phone or email) is required" }, 400);
    }

    const clientIp = c.req.header("cf-connecting-ip") || c.req.header("x-forwarded-for") || "unknown";
    if (isExitIntentRateLimited(clientIp)) {
      return c.json({ error: "rate_limited", message: "Please wait before requesting another promo code" }, 429);
    }

    const allSettings = await db.select().from(settingsTable);
    const map = Object.fromEntries(allSettings.map((s) => [s.key, s.value]));

    const promoEnabled = (map["exitIntentPromoEnabled"] ?? "true") !== "false";
    const baseCode = (map["exitIntentPromoCode"] ?? "").trim().toUpperCase();
    const discountStr = (map["exitIntentPromoDiscount"] ?? "10%").trim();

    if (!promoEnabled || !baseCode) {
      return c.json({ error: "not_available", message: "Exit-intent promo not configured" }, 404);
    }

    const suffix = Math.random().toString(36).toUpperCase().slice(2, 6);
    const singleUseCode = `${baseCode}${suffix}`;
    const discountValue = parseFloat(discountStr.replace("%", "")) || 10;
    const expiry = new Date(Date.now() + 24 * 60 * 60 * 1000);

    const [promo] = await db.insert(promoCodesTable).values({
      code: singleUseCode,
      discountType: "percentage",
      discountValue: String(discountValue),
      minOrderAmount: "0",
      maxUses: 1,
      expiresAt: expiry,
    }).returning();

    return c.json({ code: promo.code, discount: discountStr, expiresAt: expiry.toISOString() }, 201);
  } catch (err) {
    return c.json({ error: "internal_error", message: "Failed to generate promo code" }, 500);
  }
});

export default app;
