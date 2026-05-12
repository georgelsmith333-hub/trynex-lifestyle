import { Router, type IRouter } from "express";
import { db, ordersTable } from "@workspace/db";
import { sql, desc, gte } from "drizzle-orm";
import { logger } from "../lib/logger";

const router: IRouter = Router();

// ── In-process TTL cache (60 seconds) ────────────────────────────────────────
// public-stats hits the DB 3 times per request. Every page-load on the
// storefront calls this endpoint. Without a cache, even modest traffic
// causes significant Neon transfer waste.
const TTL_MS = 60_000;
let statsCache: { data: Record<string, unknown>; expiresAt: number } | null = null;

async function fetchStats() {
  const now = new Date();
  const BST_OFFSET_MS = 6 * 60 * 60 * 1000;
  const nowBST = new Date(now.getTime() + BST_OFFSET_MS);
  const startOfTodayBST = new Date(
    Date.UTC(nowBST.getUTCFullYear(), nowBST.getUTCMonth(), nowBST.getUTCDate())
  );
  const startOfToday = new Date(startOfTodayBST.getTime() - BST_OFFSET_MS);

  const [todayCountRow] = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(ordersTable)
    .where(gte(ordersTable.createdAt, startOfToday));

  const [totalCountRow] = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(ordersTable);

  const [lastOrderRow] = await db
    .select({ createdAt: ordersTable.createdAt })
    .from(ordersTable)
    .orderBy(desc(ordersTable.createdAt))
    .limit(1);

  const todayOrders = todayCountRow?.total ?? 0;
  const totalOrders = totalCountRow?.total ?? 0;

  let minutesSinceLastOrder: number | null = null;
  if (lastOrderRow?.createdAt) {
    const diff = Date.now() - new Date(lastOrderRow.createdAt).getTime();
    minutesSinceLastOrder = Math.floor(diff / 60000);
  }

  return { todayOrders, totalOrders, minutesSinceLastOrder };
}

router.get("/public-stats", async (_req, res) => {
  try {
    const now = Date.now();
    if (!statsCache || now > statsCache.expiresAt) {
      const data = await fetchStats();
      statsCache = { data, expiresAt: now + TTL_MS };
    }
    res.json(statsCache.data);
  } catch (err) {
    logger.warn({ err }, "Failed to get public stats");
    if (statsCache) {
      res.json(statsCache.data);
    } else {
      res.json({ todayOrders: 0, totalOrders: 0, minutesSinceLastOrder: null });
    }
  }
});

export default router;
