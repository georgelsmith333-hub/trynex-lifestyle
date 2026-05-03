import { Router, type IRouter } from "express";
import { db, newsletterSubscribersTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import { requireAdmin } from "../middlewares/adminAuth";
import { logger } from "../lib/logger";

const router: IRouter = Router();

router.post("/newsletter/subscribe", async (req, res) => {
  try {
    const { email, source = "footer" } = req.body as { email?: string; source?: string };
    if (!email || typeof email !== "string" || !email.includes("@")) {
      res.status(400).json({ error: "invalid_email", message: "Please provide a valid email address." });
      return;
    }
    const clean = email.trim().toLowerCase().slice(0, 254);
    const ip = (req.ip || req.headers["x-forwarded-for"]?.toString() || "").slice(0, 64) || null;

    const existing = await db
      .select({ id: newsletterSubscribersTable.id })
      .from(newsletterSubscribersTable)
      .where(eq(newsletterSubscribersTable.email, clean))
      .limit(1);

    if (existing.length > 0) {
      res.json({ ok: true, message: "You're already subscribed — welcome back!" });
      return;
    }

    await db.insert(newsletterSubscribersTable).values({
      email: clean,
      source: (source || "footer").slice(0, 64),
      ip,
    });

    res.json({ ok: true, message: "Subscribed! Watch your inbox for exclusive deals." });
  } catch (err) {
    req.log.error({ err }, "[newsletter] subscribe error");
    res.status(500).json({ error: "internal", message: "Failed to subscribe. Please try again." });
  }
});

router.get("/newsletter/subscribers", requireAdmin, async (req, res) => {
  try {
    const rows = await db
      .select()
      .from(newsletterSubscribersTable)
      .orderBy(sql`${newsletterSubscribersTable.createdAt} DESC`)
      .limit(500);
    res.json({ subscribers: rows, total: rows.length });
  } catch (err) {
    res.status(500).json({ error: "internal" });
  }
});

router.delete("/newsletter/subscribers/:id", requireAdmin, async (req, res) => {
  try {
    const id = parseInt(String(req.params.id), 10);
    if (isNaN(id)) {
      res.status(400).json({ error: "invalid_id", message: "Invalid subscriber id" });
      return;
    }
    await db.delete(newsletterSubscribersTable).where(eq(newsletterSubscribersTable.id, id));
    res.json({ success: true });
  } catch (err) {
    logger.error({ err }, "[newsletter] delete subscriber error");
    res.status(500).json({ error: "internal", message: "Failed to delete subscriber" });
  }
});

export default router;
