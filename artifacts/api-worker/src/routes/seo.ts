import { Hono } from "hono";
import { eq } from "drizzle-orm";
import { createDb } from "../db";
import { settingsTable } from "../schema";
import { requireAdmin } from "../middleware/adminAuth";
import type { AppEnv } from "../types";

const app = new Hono<AppEnv>();

async function getSetting(db: ReturnType<typeof createDb>, key: string): Promise<string | null> {
  const [row] = await db.select().from(settingsTable).where(eq(settingsTable.key, key)).limit(1);
  return row?.value ?? null;
}

async function setSetting(db: ReturnType<typeof createDb>, key: string, value: string): Promise<void> {
  await db.insert(settingsTable).values({ key, value })
    .onConflictDoUpdate({ target: settingsTable.key, set: { value, updatedAt: new Date() } });
}

app.get("/admin/seo/gsc-config", requireAdmin, async (c) => {
  try {
    const db = createDb(c.env.DATABASE_URL);
    const [emailRow] = await db.select().from(settingsTable).where(eq(settingsTable.key, "seoGscServiceAccountEmail")).limit(1);
    const [keyRow] = await db.select().from(settingsTable).where(eq(settingsTable.key, "seoGscServiceAccountKey")).limit(1);
    return c.json({
      configured: !!(emailRow?.value || keyRow?.value),
      serviceAccountEmail: emailRow?.value || null,
      hasKey: !!(keyRow?.value),
    });
  } catch (err) {
    console.error("GET /admin/seo/gsc-config failed", err);
    return c.json({ message: "Failed to get GSC config" }, 500);
  }
});

app.put("/admin/seo/gsc-config", requireAdmin, async (c) => {
  try {
    const db = createDb(c.env.DATABASE_URL);
    const body = await c.req.json();
    const { serviceAccountEmail, serviceAccountJson } = body;

    if (serviceAccountEmail !== undefined) {
      await setSetting(db, "seoGscServiceAccountEmail", serviceAccountEmail.trim());
    }

    if (serviceAccountJson !== undefined) {
      try {
        const parsed = JSON.parse(serviceAccountJson);
        if (parsed.client_email && !serviceAccountEmail) {
          await setSetting(db, "seoGscServiceAccountEmail", parsed.client_email);
        }
        await setSetting(db, "seoGscServiceAccountKey", serviceAccountJson);
      } catch {
        return c.json({ message: "Invalid JSON for service account key" }, 400);
      }
    }

    return c.json({ success: true });
  } catch (err) {
    console.error("PUT /admin/seo/gsc-config failed", err);
    return c.json({ message: "Failed to save GSC config" }, 500);
  }
});

app.delete("/admin/seo/gsc-config", requireAdmin, async (c) => {
  try {
    const db = createDb(c.env.DATABASE_URL);
    await db.delete(settingsTable).where(eq(settingsTable.key, "seoGscServiceAccountEmail"));
    await db.delete(settingsTable).where(eq(settingsTable.key, "seoGscServiceAccountKey"));
    return c.json({ success: true });
  } catch (err) {
    console.error("DELETE /admin/seo/gsc-config failed", err);
    return c.json({ message: "Failed to remove GSC config" }, 500);
  }
});

export default app;
