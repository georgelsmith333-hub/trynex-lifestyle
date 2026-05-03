import { Hono } from "hono";
import { sql, desc } from "drizzle-orm";
import { createDb } from "../db";
import { ordersTable } from "../schema";
import type { AppEnv } from "../types";

const app = new Hono<AppEnv>();

app.get("/public-stats", async (c) => {
  try {
    const db = createDb(c.env.DATABASE_URL);

    const BST_OFFSET_MS = 6 * 60 * 60 * 1000;
    const now = new Date();
    const nowBST = new Date(now.getTime() + BST_OFFSET_MS);
    const startOfTodayBST = new Date(
      Date.UTC(nowBST.getUTCFullYear(), nowBST.getUTCMonth(), nowBST.getUTCDate())
    );
    const startOfToday = new Date(startOfTodayBST.getTime() - BST_OFFSET_MS);

    const [todayCountRow] = await db
      .select({ total: sql<number>`count(*)` })
      .from(ordersTable)
      .where(sql`${ordersTable.createdAt} >= ${startOfToday.toISOString()}`);

    const [totalCountRow] = await db
      .select({ total: sql<number>`count(*)` })
      .from(ordersTable);

    const [lastOrderRow] = await db
      .select({ createdAt: ordersTable.createdAt })
      .from(ordersTable)
      .orderBy(desc(ordersTable.createdAt))
      .limit(1);

    const todayOrders = Number(todayCountRow?.total ?? 0);
    const totalOrders = Number(totalCountRow?.total ?? 0);

    let minutesSinceLastOrder: number | null = null;
    if (lastOrderRow?.createdAt) {
      const diff = Date.now() - new Date(lastOrderRow.createdAt).getTime();
      minutesSinceLastOrder = Math.floor(diff / 60000);
    }

    return c.json({ todayOrders, totalOrders, minutesSinceLastOrder });
  } catch (err) {
    console.error("Failed to get public stats", err);
    return c.json({ todayOrders: 0, totalOrders: 0, minutesSinceLastOrder: null });
  }
});

export default app;
