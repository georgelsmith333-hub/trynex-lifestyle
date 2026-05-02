import { Hono } from "hono";
import { eq, sql, desc } from "drizzle-orm";
import { createDb } from "../db";
import { referralsTable } from "../schema";
import { requireAdmin } from "../middleware/adminAuth";
import type { AppEnv } from "../types";

const app = new Hono<AppEnv>();

const REFERRAL_DISCOUNT_PCT = 10;

app.get("/referrals", requireAdmin, async (c) => {
  try {
    const db = createDb(c.env.DATABASE_URL);
    const referrals = await db.select().from(referralsTable).orderBy(desc(referralsTable.createdAt));
    return c.json({ referrals });
  } catch (err) {
    console.error("Failed to list referrals", err);
    return c.json({ error: "internal_error", message: "Failed to list referrals" }, 500);
  }
});

app.post("/referrals", async (c) => {
  try {
    const db = createDb(c.env.DATABASE_URL);
    const body = await c.req.json();
    const { ownerName, ownerEmail, ownerPhone } = body;
    if (!ownerName || !ownerEmail) {
      return c.json({ error: "validation_error", message: "Name and email are required" }, 400);
    }
    const existing = await db.select().from(referralsTable).where(eq(referralsTable.ownerEmail, ownerEmail));
    if (existing.length > 0) {
      return c.json({ referral: existing[0], message: "You already have a referral code!" });
    }
    const referralCode = "TRYNEX" + ownerName.replace(/\s+/g, "").toUpperCase().slice(0, 6) + Math.random().toString(36).slice(2, 5).toUpperCase();
    const [referral] = await db.insert(referralsTable).values({
      referralCode,
      ownerName,
      ownerEmail,
      ownerPhone: ownerPhone || null,
    }).returning();
    return c.json({ referral, message: "Your referral code has been created!" }, 201);
  } catch (err) {
    console.error("Failed to create referral", err);
    return c.json({ error: "internal_error", message: "Failed to create referral" }, 500);
  }
});

app.get("/referrals/check/:code", async (c) => {
  try {
    const db = createDb(c.env.DATABASE_URL);
    const code = c.req.param("code").toUpperCase().trim();
    const [referral] = await db.select().from(referralsTable).where(eq(referralsTable.referralCode, code));
    if (!referral || !referral.active) {
      return c.json({ error: "invalid", message: "Invalid referral code" }, 404);
    }
    return c.json({
      valid: true,
      code: referral.referralCode,
      discountPercent: REFERRAL_DISCOUNT_PCT,
      ownerName: referral.ownerName,
    });
  } catch (err) {
    console.error("Failed to check referral", err);
    return c.json({ error: "internal_error", message: "Failed to check referral" }, 500);
  }
});

app.put("/referrals/:code/use", async (c) => {
  try {
    const db = createDb(c.env.DATABASE_URL);
    const code = c.req.param("code").toUpperCase().trim();
    const body = await c.req.json();
    const { orderTotal } = body;
    await db.update(referralsTable).set({
      usedCount: sql`COALESCE(used_count, 0) + 1`,
      totalEarnings: sql`COALESCE(total_earnings, 0) + ${Math.round((orderTotal || 0) * 0.10)}`,
    }).where(eq(referralsTable.referralCode, code));
    return c.json({ success: true });
  } catch (err) {
    console.error("Failed to use referral", err);
    return c.json({ error: "internal_error", message: "Failed to update referral usage" }, 500);
  }
});

app.get("/referrals/my/:email", async (c) => {
  try {
    const db = createDb(c.env.DATABASE_URL);
    const email = c.req.param("email").toLowerCase().trim();
    const [referral] = await db.select().from(referralsTable).where(eq(referralsTable.ownerEmail, email));
    if (!referral) return c.json({ referral: null });
    return c.json({ referral });
  } catch (err) {
    console.error("Failed to get referral by email", err);
    return c.json({ error: "internal_error", message: "Failed" }, 500);
  }
});

app.delete("/referrals/:id", requireAdmin, async (c) => {
  try {
    const db = createDb(c.env.DATABASE_URL);
    const id = parseInt(c.req.param("id"), 10);
    await db.delete(referralsTable).where(eq(referralsTable.id, id));
    return c.json({ success: true });
  } catch (err) {
    console.error("Failed to delete referral", err);
    return c.json({ error: "internal_error", message: "Failed to delete referral" }, 500);
  }
});

export default app;
