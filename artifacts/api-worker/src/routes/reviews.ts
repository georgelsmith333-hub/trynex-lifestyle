import { Hono } from "hono";
import { eq, and, desc } from "drizzle-orm";
import { createDb } from "../db";
import { reviewsTable, productsTable, ordersTable } from "../schema";
import { requireAdmin } from "../middleware/adminAuth";
import { logActivity, getAdminId } from "../lib/activityLog";
import type { AppEnv } from "../types";

const app = new Hono<AppEnv>();

app.get("/reviews/:productId", async (c) => {
  try {
    const db = createDb(c.env.DATABASE_URL);
    const productId = parseInt(c.req.param("productId"), 10);
    const reviews = await db.select().from(reviewsTable)
      .where(and(eq(reviewsTable.productId, productId), eq(reviewsTable.approved, true)))
      .orderBy(desc(reviewsTable.createdAt));

    const stats = reviews.reduce((acc, r) => {
      acc.total++;
      acc.sum += r.rating;
      acc.distribution[r.rating] = (acc.distribution[r.rating] || 0) + 1;
      return acc;
    }, { total: 0, sum: 0, distribution: {} as Record<number, number> });

    return c.json({
      reviews,
      stats: {
        total: stats.total,
        average: stats.total > 0 ? Math.round((stats.sum / stats.total) * 10) / 10 : 0,
        distribution: stats.distribution,
      },
    });
  } catch (err) {
    console.error("Failed to get reviews", err);
    return c.json({ error: "internal_error", message: "Failed to get reviews" }, 500);
  }
});

app.post("/reviews", async (c) => {
  try {
    const db = createDb(c.env.DATABASE_URL);
    const body = await c.req.json();
    const { productId, customerName, customerEmail, rating, text } = body;

    if (!productId || !customerName || !customerEmail || !rating) {
      return c.json({ error: "validation_error", message: "productId, name, email, rating required" }, 400);
    }
    if (rating < 1 || rating > 5) {
      return c.json({ error: "validation_error", message: "Rating must be between 1 and 5" }, 400);
    }

    const existingReview = await db.select().from(reviewsTable)
      .where(and(eq(reviewsTable.productId, productId), eq(reviewsTable.customerEmail, customerEmail)));
    if (existingReview.length > 0) {
      return c.json({ error: "duplicate", message: "You have already reviewed this product" }, 409);
    }

    const [review] = await db.insert(reviewsTable).values({
      productId,
      customerName,
      customerEmail,
      rating,
      body: text || "",
      approved: false,
    }).returning();

    return c.json({ ...review, message: "Review submitted! It will appear after approval." }, 201);
  } catch (err) {
    console.error("Failed to create review", err);
    return c.json({ error: "internal_error", message: "Failed to submit review" }, 500);
  }
});

app.get("/admin/reviews", requireAdmin, async (c) => {
  try {
    const db = createDb(c.env.DATABASE_URL);
    const reviews = await db.select().from(reviewsTable).orderBy(desc(reviewsTable.createdAt));
    return c.json({ reviews });
  } catch (err) {
    console.error("Failed to list all reviews", err);
    return c.json({ error: "internal_error", message: "Failed to list reviews" }, 500);
  }
});

app.put("/admin/reviews/:id/approve", requireAdmin, async (c) => {
  try {
    const db = createDb(c.env.DATABASE_URL);
    const id = parseInt(c.req.param("id"), 10);
    const [beforeSnap] = await db.select().from(reviewsTable).where(eq(reviewsTable.id, id));
    const [review] = await db.update(reviewsTable)
      .set({ approved: true })
      .where(eq(reviewsTable.id, id))
      .returning();
    if (!review) return c.json({ error: "not_found", message: "Review not found" }, 404);

    const approvedReviews = await db.select().from(reviewsTable)
      .where(and(eq(reviewsTable.productId, review.productId), eq(reviewsTable.approved, true)));
    const avgRating = approvedReviews.reduce((sum, r) => sum + r.rating, 0) / approvedReviews.length;
    await db.update(productsTable).set({
      rating: avgRating.toFixed(2),
      reviewCount: approvedReviews.length,
    }).where(eq(productsTable.id, review.productId));

    logActivity(db, { action: "update", entity: "review", entityId: id, entityName: `Review by ${review.customerName}`, before: (beforeSnap ?? null) as unknown as Record<string, unknown>, after: review as unknown as Record<string, unknown>, adminId: getAdminId(c) });
    return c.json(review);
  } catch (err) {
    console.error("Failed to approve review", err);
    return c.json({ error: "internal_error", message: "Failed to approve review" }, 500);
  }
});

app.delete("/admin/reviews/:id", requireAdmin, async (c) => {
  try {
    const db = createDb(c.env.DATABASE_URL);
    const id = parseInt(c.req.param("id"), 10);
    const [beforeSnap] = await db.select().from(reviewsTable).where(eq(reviewsTable.id, id));
    await db.delete(reviewsTable).where(eq(reviewsTable.id, id));
    if (beforeSnap) logActivity(db, { action: "delete", entity: "review", entityId: id, entityName: `Review by ${beforeSnap.customerName}`, before: beforeSnap as unknown as Record<string, unknown>, adminId: getAdminId(c) });
    return c.json({ success: true });
  } catch (err) {
    console.error("Failed to delete review", err);
    return c.json({ error: "internal_error", message: "Failed to delete review" }, 500);
  }
});

export default app;
