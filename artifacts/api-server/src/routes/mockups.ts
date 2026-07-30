import { Router, type Request, type Response } from "express";
import { db, mockupsTable } from "@workspace/db";
import { eq, desc, asc, ilike, and, or, sql } from "drizzle-orm";
import { requireAdmin } from "../middlewares/adminAuth";

const router = Router();

function isValidImageUrl(value: unknown): value is string {
  if (typeof value !== "string" || value.trim().length < 1) return false;
  if (value.startsWith("/")) return true;
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

function parseOptionalPositiveInt(value: unknown): number | null | undefined {
  if (value === undefined) return undefined;
  if (value === null || value === "") return null;
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : undefined;
}

router.get("/admin/mockups", requireAdmin, async (req: Request, res: Response) => {
  try {
    const { q, productId, tag, active } = req.query;
    let query = db.select().from(mockupsTable).orderBy(asc(mockupsTable.sortOrder), desc(mockupsTable.createdAt));

    const conditions: any[] = [];
    if (q && typeof q === "string") {
      conditions.push(ilike(mockupsTable.name, `%${q}%`));
    }
    if (productId) {
      conditions.push(eq(mockupsTable.productId, parseInt(productId as string, 10)));
    }
    if (active !== undefined) {
      conditions.push(eq(mockupsTable.isActive, active === "true"));
    }

    const rows = conditions.length > 0
      ? await db.select().from(mockupsTable).where(and(...conditions)).orderBy(asc(mockupsTable.sortOrder), desc(mockupsTable.createdAt))
      : await db.select().from(mockupsTable).orderBy(asc(mockupsTable.sortOrder), desc(mockupsTable.createdAt));

    res.json(rows);
  } catch (err) {
    req.log.error({ err }, "Failed to list mockups");
    res.status(500).json({ error: "internal_error", message: "Failed to list mockups" });
  }
});

router.post("/admin/mockups", requireAdmin, async (req: Request, res: Response) => {
  try {
    const { name, description, productId, productName, imageUrl, thumbUrl, tags, isActive, sortOrder } = req.body;
    const parsedProductId = parseOptionalPositiveInt(productId);
    const parsedSortOrder = parseOptionalPositiveInt(sortOrder);
    if (typeof name !== "string" || !name.trim() || !isValidImageUrl(imageUrl)) {
      res.status(400).json({ error: "validation_error", message: "name and imageUrl are required" });
      return;
    }
    if ((productId !== undefined && parsedProductId === undefined) || (sortOrder !== undefined && parsedSortOrder === undefined)) {
      res.status(400).json({ error: "validation_error", message: "productId and sortOrder must be non-negative integers" });
      return;
    }
    if (thumbUrl !== undefined && thumbUrl !== null && !isValidImageUrl(thumbUrl)) {
      res.status(400).json({ error: "validation_error", message: "thumbUrl must be a valid URL or local path" });
      return;
    }
    const [row] = await db.insert(mockupsTable).values({
      name: name.trim(),
      description: description ?? null,
      productId: parsedProductId ?? null,
      productName: productName ?? null,
      imageUrl,
      thumbUrl: thumbUrl ?? null,
      tags: Array.isArray(tags) ? tags : [],
      isActive: isActive !== false,
      sortOrder: parsedSortOrder ?? 0,
    }).returning();
    res.status(201).json(row);
  } catch (err) {
    req.log.error({ err }, "Failed to create mockup");
    res.status(500).json({ error: "internal_error", message: "Failed to create mockup" });
  }
});

router.patch("/admin/mockups/:id", requireAdmin, async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id as string, 10);
    if (!Number.isFinite(id)) {
      res.status(400).json({ error: "validation_error", message: "Invalid id" });
      return;
    }
    const { name, description, productId, productName, imageUrl, thumbUrl, tags, isActive, sortOrder } = req.body;
    const update: Partial<typeof mockupsTable.$inferInsert> = { updatedAt: new Date() };
    if (name !== undefined) {
      if (typeof name !== "string" || !name.trim()) {
        res.status(400).json({ error: "validation_error", message: "name must be a non-empty string" });
        return;
      }
      update.name = name.trim();
    }
    if (description !== undefined) update.description = description;
    if (productId !== undefined) {
      const parsed = parseOptionalPositiveInt(productId);
      if (parsed === undefined) {
        res.status(400).json({ error: "validation_error", message: "productId must be a non-negative integer or null" });
        return;
      }
      update.productId = parsed;
    }
    if (productName !== undefined) update.productName = productName;
    if (imageUrl !== undefined) {
      if (!isValidImageUrl(imageUrl)) {
        res.status(400).json({ error: "validation_error", message: "imageUrl must be a valid URL or local path" });
        return;
      }
      update.imageUrl = imageUrl;
    }
    if (thumbUrl !== undefined) {
      if (thumbUrl !== null && !isValidImageUrl(thumbUrl)) {
        res.status(400).json({ error: "validation_error", message: "thumbUrl must be a valid URL or local path" });
        return;
      }
      update.thumbUrl = thumbUrl;
    }
    if (tags !== undefined) update.tags = Array.isArray(tags) ? tags : [];
    if (isActive !== undefined) update.isActive = isActive;
    if (sortOrder !== undefined) {
      const parsed = parseOptionalPositiveInt(sortOrder);
      if (parsed === undefined || parsed === null) {
        res.status(400).json({ error: "validation_error", message: "sortOrder must be a non-negative integer" });
        return;
      }
      update.sortOrder = parsed;
    }

    const [row] = await db.update(mockupsTable).set(update).where(eq(mockupsTable.id, id)).returning();
    if (!row) {
      res.status(404).json({ error: "not_found", message: "Mockup not found" });
      return;
    }
    res.json(row);
  } catch (err) {
    req.log.error({ err }, "Failed to update mockup");
    res.status(500).json({ error: "internal_error", message: "Failed to update mockup" });
  }
});

router.delete("/admin/mockups/:id", requireAdmin, async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id as string, 10);
    if (!Number.isFinite(id)) {
      res.status(400).json({ error: "validation_error", message: "Invalid id" });
      return;
    }
    const [row] = await db.delete(mockupsTable).where(eq(mockupsTable.id, id)).returning();
    if (!row) {
      res.status(404).json({ error: "not_found", message: "Mockup not found" });
      return;
    }
    res.json({ success: true });
  } catch (err) {
    req.log.error({ err }, "Failed to delete mockup");
    res.status(500).json({ error: "internal_error", message: "Failed to delete mockup" });
  }
});

router.post("/admin/mockups/reorder", requireAdmin, async (req: Request, res: Response) => {
  try {
    const { order } = req.body;
    if (!Array.isArray(order)) {
      res.status(400).json({ error: "validation_error", message: "order must be an array of {id, sortOrder}" });
      return;
    }
    await Promise.all(
      order.map(({ id, sortOrder }: { id: number; sortOrder: number }) =>
        db.update(mockupsTable).set({ sortOrder, updatedAt: new Date() }).where(eq(mockupsTable.id, id))
      )
    );
    res.json({ success: true });
  } catch (err) {
    req.log.error({ err }, "Failed to reorder mockups");
    res.status(500).json({ error: "internal_error", message: "Failed to reorder mockups" });
  }
});

export default router;
