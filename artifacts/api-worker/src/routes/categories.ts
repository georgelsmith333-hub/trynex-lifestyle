import { Hono } from "hono";
import { eq, sql } from "drizzle-orm";
import { createDb } from "../db";
import { categoriesTable, productsTable } from "../schema";
import { requireAdmin } from "../middleware/adminAuth";
import { logActivity, getAdminId } from "../lib/activityLog";
import type { AppEnv } from "../types";

const app = new Hono<AppEnv>();

function mapCategory(c: typeof categoriesTable.$inferSelect) {
  return {
    id: c.id,
    name: c.name,
    slug: c.slug,
    description: c.description,
    imageUrl: c.imageUrl,
    productCount: c.productCount ?? 0,
  };
}

app.get("/categories", async (c) => {
  try {
    const db = createDb(c.env.DATABASE_URL);
    const rows = await db.select().from(categoriesTable).orderBy(categoriesTable.name);
    return c.json({ categories: rows.map(mapCategory) });
  } catch (err) {
    console.error("Failed to list categories", err);
    return c.json({ error: "internal_error", message: "Failed to list categories" }, 500);
  }
});

app.post("/categories", requireAdmin, async (c) => {
  try {
    const db = createDb(c.env.DATABASE_URL);
    const body = await c.req.json();
    const { name, slug, description, imageUrl } = body;
    if (!name || !slug) {
      return c.json({ error: "validation_error", message: "name and slug are required" }, 400);
    }
    const [category] = await db.insert(categoriesTable).values({ name, slug, description, imageUrl }).returning();
    logActivity(db, { action: "create", entity: "category", entityId: category.id, entityName: category.name, after: category as unknown as Record<string, unknown>, adminId: getAdminId(c) });
    return c.json(mapCategory(category), 201);
  } catch (err) {
    console.error("Failed to create category", err);
    return c.json({ error: "internal_error", message: "Failed to create category" }, 500);
  }
});

app.put("/categories/:id", requireAdmin, async (c) => {
  try {
    const db = createDb(c.env.DATABASE_URL);
    const id = parseInt(c.req.param("id"), 10);
    if (Number.isNaN(id)) return c.json({ error: "validation_error", message: "Invalid id" }, 400);
    const body = await c.req.json();
    const { name, slug, description, imageUrl } = body;
    const [beforeSnapshot] = await db.select().from(categoriesTable).where(eq(categoriesTable.id, id));
    const updateData: Record<string, unknown> = {};
    if (name !== undefined) updateData.name = name;
    if (slug !== undefined) updateData.slug = slug;
    if (description !== undefined) updateData.description = description;
    if (imageUrl !== undefined) updateData.imageUrl = imageUrl;
    if (Object.keys(updateData).length === 0) {
      return c.json({ error: "validation_error", message: "No fields to update" }, 400);
    }
    const [category] = await db.update(categoriesTable).set(updateData).where(eq(categoriesTable.id, id)).returning();
    if (!category) return c.json({ error: "not_found", message: "Category not found" }, 404);
    logActivity(db, { action: "update", entity: "category", entityId: id, entityName: category.name, before: (beforeSnapshot ?? null) as unknown as Record<string, unknown>, after: category as unknown as Record<string, unknown>, adminId: getAdminId(c) });
    return c.json(mapCategory(category));
  } catch (err) {
    console.error("Failed to update category", err);
    return c.json({ error: "internal_error", message: "Failed to update category" }, 500);
  }
});

app.delete("/categories/:id", requireAdmin, async (c) => {
  try {
    const db = createDb(c.env.DATABASE_URL);
    const id = parseInt(c.req.param("id"), 10);
    if (Number.isNaN(id)) return c.json({ error: "validation_error", message: "Invalid id" }, 400);
    const [{ count }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(productsTable)
      .where(eq(productsTable.categoryId, id));
    if (Number(count) > 0) {
      return c.json({
        error: "category_in_use",
        message: `Cannot delete category — ${count} product(s) are still linked to it.`,
        productCount: Number(count),
      }, 409);
    }
    const [beforeSnap] = await db.select().from(categoriesTable).where(eq(categoriesTable.id, id));
    const [category] = await db.delete(categoriesTable).where(eq(categoriesTable.id, id)).returning();
    if (!category) return c.json({ error: "not_found", message: "Category not found" }, 404);
    logActivity(db, { action: "delete", entity: "category", entityId: id, entityName: category.name, before: (beforeSnap ?? category) as unknown as Record<string, unknown>, adminId: getAdminId(c) });
    return c.body(null, 204);
  } catch (err) {
    console.error("Failed to delete category", err);
    return c.json({ error: "internal_error", message: "Failed to delete category" }, 500);
  }
});

export default app;
