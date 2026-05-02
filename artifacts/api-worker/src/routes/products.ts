import { Hono } from "hono";
import { eq, ilike, or, and, sql, desc } from "drizzle-orm";
import { createDb } from "../db";
import { productsTable, categoriesTable } from "../schema";
import { requireAdmin } from "../middleware/adminAuth";
import { logActivity, getAdminId } from "../lib/activityLog";
import type { AppEnv } from "../types";

const app = new Hono<AppEnv>();

function mapProduct(p: any, categoryName?: string | null) {
  return {
    id: p.id,
    name: p.name,
    slug: p.slug,
    description: p.description,
    price: parseFloat(p.price),
    discountPrice: p.discountPrice ? parseFloat(p.discountPrice) : undefined,
    categoryId: p.categoryId,
    categoryName: categoryName ?? undefined,
    imageUrl: p.imageUrl,
    images: p.images ?? [],
    sizes: p.sizes ?? [],
    colors: p.colors ?? [],
    stock: p.stock,
    featured: p.featured ?? false,
    rating: p.rating ? parseFloat(p.rating) : 0,
    reviewCount: p.reviewCount ?? 0,
    customizable: p.customizable ?? false,
    tags: p.tags ?? [],
  };
}

app.get("/products", async (c) => {
  try {
    const db = createDb(c.env.DATABASE_URL);
    const categoryId = c.req.query("categoryId");
    const search = c.req.query("search");
    const featured = c.req.query("featured");
    const page = c.req.query("page") || "1";
    const limit = c.req.query("limit") || "12";
    const pageNum = parseInt(page, 10);
    const limitNum = parseInt(limit, 10);
    const offset = (pageNum - 1) * limitNum;

    const conditions: any[] = [];
    if (categoryId) conditions.push(eq(productsTable.categoryId, parseInt(categoryId, 10)));
    if (search) {
      const pattern = `%${search}%`;
      conditions.push(
        or(
          ilike(productsTable.name, pattern),
          ilike(productsTable.description, pattern),
          ilike(sql`${productsTable.tags}::text`, pattern),
        )!,
      );
    }
    if (featured === "true") conditions.push(eq(productsTable.featured, true));

    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const [products, countResult] = await Promise.all([
      db.select().from(productsTable).where(where).orderBy(desc(productsTable.createdAt)).limit(limitNum).offset(offset),
      db.select({ count: sql<number>`count(*)` }).from(productsTable).where(where),
    ]);

    const total = Number(countResult[0]?.count ?? 0);
    const catIds = [...new Set(products.map((p) => p.categoryId).filter(Boolean))];
    const categories = catIds.length > 0
      ? await db.select({ id: categoriesTable.id, name: categoriesTable.name }).from(categoriesTable).where(sql`id = ANY(ARRAY[${sql.join(catIds.map((id) => sql`${id}`), sql`, `)}]::int[])`)
      : [];
    const catMap = Object.fromEntries(categories.map((c) => [c.id, c.name]));

    return c.json({
      products: products.map((p) => mapProduct(p, p.categoryId ? catMap[p.categoryId] : null)),
      total,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.ceil(total / limitNum),
    });
  } catch (err) {
    console.error("Failed to list products", err);
    return c.json({ error: "internal_error", message: "Failed to list products" }, 500);
  }
});

app.get("/products/:id", async (c) => {
  try {
    const db = createDb(c.env.DATABASE_URL);
    const idOrSlug = c.req.param("id");
    const isFullyNumeric = /^\d+$/.test(idOrSlug);
    const numericId = isFullyNumeric ? parseInt(idOrSlug, 10) : NaN;
    let product: any;

    if (isFullyNumeric && !isNaN(numericId)) {
      [product] = await db.select().from(productsTable).where(eq(productsTable.id, numericId));
    }
    if (!product) {
      [product] = await db.select().from(productsTable).where(eq(productsTable.slug, idOrSlug));
    }
    if (!product) return c.json({ error: "not_found", message: "Product not found" }, 404);

    let categoryName: string | null = null;
    if (product.categoryId) {
      const [cat] = await db.select({ name: categoriesTable.name }).from(categoriesTable).where(eq(categoriesTable.id, product.categoryId));
      categoryName = cat?.name ?? null;
    }
    return c.json(mapProduct(product, categoryName));
  } catch (err) {
    console.error("Failed to get product", err);
    return c.json({ error: "internal_error", message: "Failed to get product" }, 500);
  }
});

app.post("/products", requireAdmin, async (c) => {
  try {
    const db = createDb(c.env.DATABASE_URL);
    const body = await c.req.json();
    const { name, slug, description, price, discountPrice, categoryId, imageUrl, images, sizes, colors, stock, featured, customizable, tags } = body;
    if (!name || !slug || price === undefined || stock === undefined) {
      return c.json({ error: "validation_error", message: "name, slug, price, stock are required" }, 400);
    }
    const [product] = await db.insert(productsTable).values({
      name, slug, description,
      price: price.toString(),
      discountPrice: discountPrice?.toString(),
      categoryId,
      imageUrl, images, sizes, colors,
      stock, featured, customizable, tags,
    }).returning();

    if (categoryId) {
      await db.execute(sql`UPDATE categories SET product_count = product_count + 1 WHERE id = ${categoryId}`);
    }

    logActivity(db, { action: "create", entity: "product", entityId: product.id, entityName: product.name, after: product as unknown as Record<string, unknown>, adminId: getAdminId(c) });
    return c.json(mapProduct(product), 201);
  } catch (err) {
    console.error("Failed to create product", err);
    return c.json({ error: "internal_error", message: "Failed to create product" }, 500);
  }
});

app.put("/products/:id", requireAdmin, async (c) => {
  try {
    const db = createDb(c.env.DATABASE_URL);
    const id = parseInt(c.req.param("id"), 10);
    const body = await c.req.json();
    const { name, slug, description, price, discountPrice, categoryId, imageUrl, images, sizes, colors, stock, featured, customizable, tags } = body;

    const [existing] = await db.select().from(productsTable).where(eq(productsTable.id, id));
    if (!existing) return c.json({ error: "not_found", message: "Product not found" }, 404);
    const oldCategoryId = existing.categoryId;

    const updateData: any = { updatedAt: new Date() };
    if (name !== undefined) updateData.name = name;
    if (slug !== undefined) updateData.slug = slug;
    if (description !== undefined) updateData.description = description;
    if (price !== undefined) updateData.price = price.toString();
    if (discountPrice !== undefined) updateData.discountPrice = discountPrice?.toString() ?? null;
    if (categoryId !== undefined) updateData.categoryId = categoryId;
    if (imageUrl !== undefined) updateData.imageUrl = imageUrl;
    if (images !== undefined) updateData.images = images;
    if (sizes !== undefined) updateData.sizes = sizes;
    if (colors !== undefined) updateData.colors = colors;
    if (stock !== undefined) updateData.stock = stock;
    if (featured !== undefined) updateData.featured = featured;
    if (customizable !== undefined) updateData.customizable = customizable;
    if (tags !== undefined) updateData.tags = tags;

    const [product] = await db.update(productsTable).set(updateData).where(eq(productsTable.id, id)).returning();

    const newCategoryId = categoryId !== undefined ? categoryId : oldCategoryId;
    if (oldCategoryId !== newCategoryId) {
      if (oldCategoryId) {
        await db.execute(sql`UPDATE categories SET product_count = GREATEST(product_count - 1, 0) WHERE id = ${oldCategoryId}`);
      }
      if (newCategoryId) {
        await db.execute(sql`UPDATE categories SET product_count = product_count + 1 WHERE id = ${newCategoryId}`);
      }
    }

    logActivity(db, { action: "update", entity: "product", entityId: id, entityName: product.name, before: existing as unknown as Record<string, unknown>, after: product as unknown as Record<string, unknown>, adminId: getAdminId(c) });
    return c.json(mapProduct(product));
  } catch (err) {
    console.error("Failed to update product", err);
    return c.json({ error: "internal_error", message: "Failed to update product" }, 500);
  }
});

app.delete("/products/:id", requireAdmin, async (c) => {
  try {
    const db = createDb(c.env.DATABASE_URL);
    const id = parseInt(c.req.param("id"), 10);
    const [beforeSnapshot] = await db.select().from(productsTable).where(eq(productsTable.id, id));
    const [product] = await db.delete(productsTable).where(eq(productsTable.id, id)).returning();
    if (!product) return c.json({ error: "not_found", message: "Product not found" }, 404);
    if (product.categoryId) {
      await db.execute(sql`UPDATE categories SET product_count = GREATEST(product_count - 1, 0) WHERE id = ${product.categoryId}`);
    }
    logActivity(db, { action: "delete", entity: "product", entityId: id, entityName: product.name, before: (beforeSnapshot ?? product) as unknown as Record<string, unknown>, adminId: getAdminId(c) });
    return c.body(null, 204);
  } catch (err) {
    console.error("Failed to delete product", err);
    return c.json({ error: "internal_error", message: "Failed to delete product" }, 500);
  }
});

app.post("/products/bulk", requireAdmin, async (c) => {
  try {
    const db = createDb(c.env.DATABASE_URL);
    const body = await c.req.json();
    const { products: bulkProducts } = body;
    if (!Array.isArray(bulkProducts) || bulkProducts.length === 0) {
      return c.json({ error: "validation_error", message: "products array is required" }, 400);
    }
    if (bulkProducts.length > 200) {
      return c.json({ error: "validation_error", message: "Maximum 200 products per upload" }, 400);
    }
    const results: { success: number; failed: number; errors: string[] } = { success: 0, failed: 0, errors: [] };
    for (let i = 0; i < bulkProducts.length; i++) {
      const p = bulkProducts[i];
      try {
        if (!p.name || !p.slug || p.price === undefined) {
          results.failed++;
          results.errors.push(`Row ${i + 1}: name, slug, price are required`);
          continue;
        }
        const [product] = await db.insert(productsTable).values({
          name: String(p.name).trim(),
          slug: String(p.slug).trim(),
          description: p.description || null,
          price: String(p.price),
          discountPrice: p.discountPrice ? String(p.discountPrice) : null,
          categoryId: p.categoryId ? parseInt(String(p.categoryId), 10) : null,
          imageUrl: p.imageUrl || null,
          images: [],
          sizes: Array.isArray(p.sizes) ? p.sizes : (p.sizes ? String(p.sizes).split(/[,;]/).map((s: string) => s.trim()).filter(Boolean) : []),
          colors: Array.isArray(p.colors) ? p.colors : (p.colors ? String(p.colors).split(/[,;]/).map((s: string) => s.trim()).filter(Boolean) : []),
          stock: parseInt(String(p.stock || 0), 10),
          featured: p.featured === true || p.featured === "true",
          customizable: p.customizable === true || p.customizable === "true",
          tags: [],
        }).returning();
        if (product.categoryId) {
          await db.execute(sql`UPDATE categories SET product_count = product_count + 1 WHERE id = ${product.categoryId}`);
        }
        results.success++;
      } catch (err: any) {
        results.failed++;
        results.errors.push(`Row ${i + 1} (${p.name || "unknown"}): ${err.message?.includes("unique") ? "duplicate slug" : "database error"}`);
      }
    }
    return c.json(results, 201);
  } catch (err) {
    console.error("Failed to bulk create products", err);
    return c.json({ error: "internal_error", message: "Bulk upload failed" }, 500);
  }
});

app.patch("/admin/products/:id/featured", requireAdmin, async (c) => {
  try {
    const db = createDb(c.env.DATABASE_URL);
    const id = parseInt(c.req.param("id"), 10);
    const body = await c.req.json();
    const { featured } = body;
    if (typeof featured !== "boolean") {
      return c.json({ error: "validation_error", message: "featured must be a boolean" }, 400);
    }
    const [updated] = await db.update(productsTable)
      .set({ featured, updatedAt: new Date() })
      .where(eq(productsTable.id, id))
      .returning();
    if (!updated) return c.json({ error: "not_found", message: "Product not found" }, 404);
    return c.json({ id: updated.id, featured: updated.featured });
  } catch (err) {
    console.error("Failed to toggle product featured flag", err);
    return c.json({ error: "internal_error", message: "Failed to toggle featured" }, 500);
  }
});

export default app;
