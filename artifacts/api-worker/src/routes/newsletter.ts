import { Hono } from "hono";
import { eq, desc } from "drizzle-orm";
import { createDb } from "../db";
import { newsletterSubscribersTable } from "../schema";
import { requireAdmin } from "../middleware/adminAuth";
import type { AppEnv } from "../types";

const app = new Hono<AppEnv>();

app.post("/newsletter/subscribe", async (c) => {
  try {
    const db = createDb(c.env.DATABASE_URL);
    const body = await c.req.json();
    const { email, source } = body;
    if (!email || typeof email !== "string" || !email.includes("@")) {
      return c.json({ error: "validation_error", message: "Valid email is required" }, 400);
    }
    const emailLc = email.toLowerCase().trim();
    const ip = c.req.header("cf-connecting-ip") || c.req.header("x-forwarded-for") || null;
    await db.insert(newsletterSubscribersTable).values({
      email: emailLc,
      source: source || "footer",
      ip,
    });
    return c.json({ success: true, message: "Subscribed successfully!" });
  } catch (err: any) {
    if (err?.code === "23505" || String(err?.message).includes("unique")) {
      return c.json({ success: true, message: "Already subscribed!" });
    }
    console.error("Newsletter subscribe failed", err);
    return c.json({ error: "internal_error", message: "Subscription failed" }, 500);
  }
});

app.get("/admin/newsletter/subscribers", requireAdmin, async (c) => {
  try {
    const db = createDb(c.env.DATABASE_URL);
    const subscribers = await db
      .select()
      .from(newsletterSubscribersTable)
      .orderBy(desc(newsletterSubscribersTable.createdAt));
    return c.json({ subscribers, total: subscribers.length });
  } catch (err) {
    console.error("Failed to list newsletter subscribers", err);
    return c.json({ error: "internal_error", message: "Failed to list subscribers" }, 500);
  }
});

app.delete("/admin/newsletter/subscribers/:id", requireAdmin, async (c) => {
  try {
    const db = createDb(c.env.DATABASE_URL);
    const id = parseInt(c.req.param("id"), 10);
    await db.delete(newsletterSubscribersTable).where(eq(newsletterSubscribersTable.id, id));
    return c.json({ success: true });
  } catch (err) {
    console.error("Failed to delete subscriber", err);
    return c.json({ error: "internal_error", message: "Failed to delete subscriber" }, 500);
  }
});

export default app;
