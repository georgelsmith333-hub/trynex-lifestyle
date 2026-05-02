import { Hono } from "hono";
import { eq, desc, and, sql } from "drizzle-orm";
import { createDb } from "../db";
import { hamperPackagesTable } from "../schema";
import { requireAdmin } from "../middleware/adminAuth";
import { logActivity, getAdminId } from "../lib/activityLog";
import type { AppEnv } from "../types";

const app = new Hono<AppEnv>();

function mapHamper(h: any) {
  return {
    id: h.id,
    slug: h.slug,
    name: h.name,
    nameBn: h.nameBn,
    description: h.description,
    descriptionBn: h.descriptionBn,
    category: h.category,
    occasion: h.occasion,
    imageUrl: h.imageUrl,
    images: h.images ?? [],
    basePrice: parseFloat(h.basePrice),
    discountPrice: h.discountPrice ? parseFloat(h.discountPrice) : undefined,
    items: h.items ?? [],
    isCustomizable: !!h.isCustomizable,
    active: !!h.active,
    featured: !!h.featured,
    sortOrder: h.sortOrder ?? 0,
    stock: h.stock ?? 100,
    tags: h.tags ?? [],
  };
}

app.get("/hampers", async (c) => {
  try {
    const db = createDb(c.env.DATABASE_URL);
    const rows = await db
      .select()
      .from(hamperPackagesTable)
      .where(eq(hamperPackagesTable.active, true))
      .orderBy(desc(hamperPackagesTable.featured), hamperPackagesTable.sortOrder, desc(hamperPackagesTable.createdAt));
    return c.json({ hampers: rows.map(mapHamper) });
  } catch (err) {
    return c.json({ error: "internal_error", message: "Failed to list hampers" }, 500);
  }
});

app.get("/hampers/:slug", async (c) => {
  try {
    const db = createDb(c.env.DATABASE_URL);
    const idOrSlug = c.req.param("slug");
    const isNumeric = /^\d+$/.test(idOrSlug);
    let row: any;
    if (isNumeric) {
      [row] = await db.select().from(hamperPackagesTable).where(and(eq(hamperPackagesTable.id, parseInt(idOrSlug, 10)), eq(hamperPackagesTable.active, true)));
    }
    if (!row) {
      [row] = await db.select().from(hamperPackagesTable).where(and(eq(hamperPackagesTable.slug, idOrSlug), eq(hamperPackagesTable.active, true)));
    }
    if (!row) return c.json({ error: "not_found", message: "Hamper not found" }, 404);
    return c.json(mapHamper(row));
  } catch (err) {
    return c.json({ error: "internal_error", message: "Failed to get hamper" }, 500);
  }
});

app.get("/admin/hampers", requireAdmin, async (c) => {
  try {
    const db = createDb(c.env.DATABASE_URL);
    const rows = await db.select().from(hamperPackagesTable).orderBy(desc(hamperPackagesTable.createdAt));
    return c.json({ hampers: rows.map(mapHamper) });
  } catch (err) {
    return c.json({ error: "internal_error", message: "Failed to list hampers" }, 500);
  }
});

app.post("/admin/hampers", requireAdmin, async (c) => {
  try {
    const db = createDb(c.env.DATABASE_URL);
    const b = await c.req.json();
    if (!b.slug || !b.name || b.basePrice === undefined) {
      return c.json({ error: "validation_error", message: "slug, name, basePrice required" }, 400);
    }
    const [row] = await db.insert(hamperPackagesTable).values({
      slug: String(b.slug).trim().toLowerCase().replace(/[^a-z0-9-]/g, "-"),
      name: b.name,
      nameBn: b.nameBn || null,
      description: b.description || null,
      descriptionBn: b.descriptionBn || null,
      category: b.category || "general",
      occasion: b.occasion || null,
      imageUrl: b.imageUrl || null,
      images: Array.isArray(b.images) ? b.images : [],
      basePrice: String(b.basePrice),
      discountPrice: b.discountPrice ? String(b.discountPrice) : null,
      items: Array.isArray(b.items) ? b.items : [],
      isCustomizable: !!b.isCustomizable,
      active: b.active !== false,
      featured: !!b.featured,
      sortOrder: Number(b.sortOrder) || 0,
      stock: b.stock !== undefined ? Number(b.stock) : 100,
      tags: Array.isArray(b.tags) ? b.tags : [],
    }).returning();
    logActivity(db, { action: "create", entity: "hamper", entityId: row.id, entityName: row.name, after: row as unknown as Record<string, unknown>, adminId: getAdminId(c) });
    return c.json(mapHamper(row), 201);
  } catch (err: any) {
    if (err.code === "23505") {
      return c.json({ error: "duplicate", message: "Slug already exists" }, 409);
    }
    return c.json({ error: "internal_error", message: "Failed to create hamper" }, 500);
  }
});

app.put("/admin/hampers/:id", requireAdmin, async (c) => {
  try {
    const db = createDb(c.env.DATABASE_URL);
    const id = parseInt(c.req.param("id"), 10);
    const b = await c.req.json();
    const updates: any = { updatedAt: new Date() };
    if (b.slug !== undefined) updates.slug = String(b.slug).trim().toLowerCase().replace(/[^a-z0-9-]/g, "-");
    if (b.name !== undefined) updates.name = b.name;
    if (b.nameBn !== undefined) updates.nameBn = b.nameBn;
    if (b.description !== undefined) updates.description = b.description;
    if (b.descriptionBn !== undefined) updates.descriptionBn = b.descriptionBn;
    if (b.category !== undefined) updates.category = b.category;
    if (b.occasion !== undefined) updates.occasion = b.occasion;
    if (b.imageUrl !== undefined) updates.imageUrl = b.imageUrl;
    if (b.images !== undefined) updates.images = Array.isArray(b.images) ? b.images : [];
    if (b.basePrice !== undefined) updates.basePrice = String(b.basePrice);
    if (b.discountPrice !== undefined) updates.discountPrice = b.discountPrice ? String(b.discountPrice) : null;
    if (b.items !== undefined) updates.items = Array.isArray(b.items) ? b.items : [];
    if (b.isCustomizable !== undefined) updates.isCustomizable = !!b.isCustomizable;
    if (b.active !== undefined) updates.active = !!b.active;
    if (b.featured !== undefined) updates.featured = !!b.featured;
    if (b.sortOrder !== undefined) updates.sortOrder = Number(b.sortOrder) || 0;
    if (b.stock !== undefined) updates.stock = Number(b.stock);
    if (b.tags !== undefined) updates.tags = Array.isArray(b.tags) ? b.tags : [];
    const [beforeSnap] = await db.select().from(hamperPackagesTable).where(eq(hamperPackagesTable.id, id));
    const [row] = await db.update(hamperPackagesTable).set(updates).where(eq(hamperPackagesTable.id, id)).returning();
    if (!row) return c.json({ error: "not_found" }, 404);
    logActivity(db, { action: "update", entity: "hamper", entityId: id, entityName: row.name, before: (beforeSnap ?? null) as unknown as Record<string, unknown>, after: row as unknown as Record<string, unknown>, adminId: getAdminId(c) });
    return c.json(mapHamper(row));
  } catch (err) {
    return c.json({ error: "internal_error", message: "Failed to update hamper" }, 500);
  }
});

app.delete("/admin/hampers/:id", requireAdmin, async (c) => {
  try {
    const db = createDb(c.env.DATABASE_URL);
    const id = parseInt(c.req.param("id"), 10);
    const [beforeSnap] = await db.select().from(hamperPackagesTable).where(eq(hamperPackagesTable.id, id));
    await db.delete(hamperPackagesTable).where(eq(hamperPackagesTable.id, id));
    if (beforeSnap) logActivity(db, { action: "delete", entity: "hamper", entityId: id, entityName: beforeSnap.name, before: beforeSnap as unknown as Record<string, unknown>, adminId: getAdminId(c) });
    return c.json({ ok: true });
  } catch (err) {
    return c.json({ error: "internal_error", message: "Failed to delete hamper" }, 500);
  }
});

export default app;
