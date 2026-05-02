import { Hono } from "hono";
import { sql, eq } from "drizzle-orm";
import { createDb } from "../db";
import { productsTable, ordersTable, customersTable, reviewsTable } from "../schema";
import type { AppEnv } from "../types";

const app = new Hono<AppEnv>();

app.get("/public/stats", async (c) => {
  try {
    const db = createDb(c.env.DATABASE_URL);
    const [
      productCount,
      orderCount,
      customerCount,
      reviewCount,
    ] = await Promise.all([
      db.select({ count: sql<number>`count(*)` }).from(productsTable),
      db.select({ count: sql<number>`count(*)` }).from(ordersTable),
      db.select({ count: sql<number>`count(*)` }).from(customersTable),
      db.select({ count: sql<number>`count(*)` }).from(reviewsTable).where(eq(reviewsTable.approved, true)),
    ]);
    return c.json({
      totalProducts: Number(productCount[0]?.count ?? 0),
      totalOrders: Number(orderCount[0]?.count ?? 0),
      totalCustomers: Number(customerCount[0]?.count ?? 0),
      totalReviews: Number(reviewCount[0]?.count ?? 0),
    });
  } catch (err) {
    console.error("Failed to get public stats", err);
    return c.json({ error: "internal_error", message: "Failed to get stats" }, 500);
  }
});

export default app;
