import { Router, type Request, type Response } from "express";
import { db, mockupsTable } from "@workspace/db";
import { eq, desc, asc, ilike, and, or, sql } from "drizzle-orm";
import { requireAdmin } from "../middlewares/adminAuth";

const router = Router();

/**
 * The Design Studio is source-kit driven: customer-facing mockups live in the
 * storefront's normalized asset catalog, while the mockups table stores
 * administrator-uploaded overrides. Keep both sources visible in admin so an
 * empty table cannot masquerade as an empty storefront.
 */
type CanonicalCategory = "tshirt" | "longsleeve" | "hoodie" | "mug" | "cap" | "waterbottle";

type CanonicalVariant = { category: CanonicalCategory; productName: string; color: string };

const CANONICAL_COLORS: Record<CanonicalCategory, readonly string[]> = {
  tshirt: ["white", "black", "navy", "maroon", "olive", "sky-blue", "grey", "red"],
  longsleeve: ["white", "black", "navy", "maroon", "olive", "grey", "red", "sky-blue", "burgundy", "forest"],
  hoodie: ["white", "black", "navy", "grey", "maroon", "olive", "red", "sky-blue", "forest", "burgundy"],
  mug: ["white", "black", "navy", "red", "green", "purple", "sky-blue", "pink", "maroon", "orange"],
  cap: ["white", "black", "navy", "maroon", "olive", "red", "grey", "forest"],
  // White sublimation-coated aluminium blank; do not synthesize colored-body variants.
  waterbottle: ["white"],
};

const CANONICAL_VIEWS: Record<CanonicalCategory, readonly string[]> = {
  tshirt: ["front", "back", "left-sleeve", "right-sleeve", "neck-label"],
  longsleeve: ["front", "back", "left-sleeve", "right-sleeve", "neck-label"],
  hoodie: ["front", "back", "left-sleeve", "right-sleeve", "neck-label"],
  mug: ["front", "back", "wrap"],
  cap: ["front", "back"],
  waterbottle: ["front", "back"],
};

const PRODUCT_NAMES: Record<CanonicalCategory, string> = {
  tshirt: "Unisex T-Shirt", longsleeve: "Unisex Long Sleeve", hoodie: "Unisex Hoodie",
  mug: "Coffee Mug", cap: "Structured Cap", waterbottle: "Water Bottle — White Sublimation Aluminium",
};

const CANONICAL_VARIANTS: CanonicalVariant[] = (Object.keys(CANONICAL_COLORS) as CanonicalCategory[]).flatMap((category) =>
  CANONICAL_COLORS[category].map((color) => ({ category, productName: PRODUCT_NAMES[category], color }))
);

function canonicalMockups() {
  let id = -1;
  return CANONICAL_VARIANTS.flatMap((variant) => CANONICAL_VIEWS[variant.category].map((face) => ({
    id: id--,
    name: `${variant.productName} — ${variant.color} — ${face}`,
    description: "Canonical source-kit mockup used by the Design Studio",
    productId: null,
    productName: variant.productName,
    imageUrl: `/mockups/smart-v4/${variant.category}/${variant.color}/${face}.png?v=smart-v4`,
    thumbUrl: null,
    tags: ["source-kit", variant.category, variant.color, face],
    isActive: true,
    sortOrder: Math.abs(id),
    masterFileUrl: null,
    masterFileName: null,
    masterFileMime: null,
    masterFileSize: null,
    masterFileSha256: null,
    sourceKitKey: `${variant.category}/${variant.color}/${face}`,
    face,
    color: variant.color,
    manifestJson: {
      schema: "trynex-photoreal-mockup-manifest/v1",
      assetPath: `/mockups/smart-v4/${variant.category}/${variant.color}/${face}.png`,
      sourceKitKey: `${variant.category}:${variant.color}:${face}`,
      masterStatus: "verified-source-package",
      masterStorageStatus: "not-uploaded",
    },
    ingestionStatus: "ready",
    ingestionError: null,
    createdAt: new Date(0).toISOString(),
    updatedAt: new Date(0).toISOString(),
    isCanonical: true,
  })));
}

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

const MASTER_MIMES = new Set([
  "image/vnd.adobe.photoshop",
  "application/vnd.adobe.photoshop",
  "image/x-photoshop",
]);
const INGESTION_STATUSES = new Set(["preview-only", "pending", "ready", "failed"]);

function isValidMasterUrl(value: unknown): value is string {
  return value === undefined || value === null || isValidImageUrl(value);
}

function isValidOptionalInt(value: unknown): boolean {
  return value === undefined || value === null || (Number.isInteger(value) && Number(value) >= 0);
}

function parseOptionalPositiveInt(value: unknown): number | null | undefined {
  if (value === undefined) return undefined;
  if (value === null || value === "") return null;
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : undefined;
}

router.get("/mockups", async (req: Request, res: Response) => {
  try {
    const rows = await db.select({
      id: mockupsTable.id,
      name: mockupsTable.name,
      productName: mockupsTable.productName,
      imageUrl: mockupsTable.imageUrl,
      thumbUrl: mockupsTable.thumbUrl,
      tags: mockupsTable.tags,
      isActive: mockupsTable.isActive,
      updatedAt: mockupsTable.updatedAt,
      sourceKitKey: mockupsTable.sourceKitKey,
      face: mockupsTable.face,
      color: mockupsTable.color,
      ingestionStatus: mockupsTable.ingestionStatus,
    }).from(mockupsTable).where(eq(mockupsTable.isActive, true)).orderBy(asc(mockupsTable.sortOrder), desc(mockupsTable.updatedAt));

    // Public Design Studio consumers need a complete canonical matrix even
    // when no administrator-uploaded override rows have been ingested yet.
    // Keep valid DB overrides first, then fill only missing source-kit keys
    // with the same smart-v4 assets used by the storefront resolver.
    const existingKeys = new Set(rows.map((row) => row.sourceKitKey).filter((key): key is string => Boolean(key)));
    const canonicalFallback = canonicalMockups().filter((row) => !existingKeys.has(row.sourceKitKey));
    res.json([...rows, ...canonicalFallback]);
  } catch (err) {
    req.log.error({ err }, "Failed to list public mockup overrides");
    res.status(500).json({ error: "internal_error", message: "Failed to list mockups" });
  }
});

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

    const canonical = canonicalMockups().filter((row) => {
      if (q && typeof q === "string" && !row.name.toLowerCase().includes(q.toLowerCase())) return false;
      if (active !== undefined && active !== "true") return false;
      return true;
    });
    res.json([...rows, ...canonical]);
  } catch (err) {
    req.log.error({ err }, "Failed to list mockups");
    res.status(500).json({ error: "internal_error", message: "Failed to list mockups" });
  }
});

router.post("/admin/mockups", requireAdmin, async (req: Request, res: Response) => {
  try {
    const {
      name, description, productId, productName, imageUrl, thumbUrl, tags, isActive, sortOrder,
      masterFileUrl, masterFileName, masterFileMime, masterFileSize, masterFileSha256,
      sourceKitKey, face, color, manifestJson, ingestionStatus, ingestionError,
    } = req.body;
    const parsedProductId = parseOptionalPositiveInt(productId);
    const parsedSortOrder = parseOptionalPositiveInt(sortOrder);
    const parsedMasterFileSize = parseOptionalPositiveInt(masterFileSize);
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
    if (!isValidMasterUrl(masterFileUrl)) {
      res.status(400).json({ error: "validation_error", message: "masterFileUrl must be a valid URL or local path" });
      return;
    }
    if (masterFileMime !== undefined && masterFileMime !== null && !MASTER_MIMES.has(String(masterFileMime))) {
      res.status(400).json({ error: "validation_error", message: "masterFileMime must be a PSD or PSB MIME type" });
      return;
    }
    if (!isValidOptionalInt(parsedMasterFileSize)) {
      res.status(400).json({ error: "validation_error", message: "masterFileSize must be a non-negative integer" });
      return;
    }
    if (ingestionStatus !== undefined && !INGESTION_STATUSES.has(String(ingestionStatus))) {
      res.status(400).json({ error: "validation_error", message: "invalid ingestionStatus" });
      return;
    }
    const [row] = await db.insert(mockupsTable).values({
      name: name.trim(),
      description: description ?? null,
      productId: parsedProductId ?? null,
      productName: productName ?? null,
      imageUrl,
      thumbUrl: thumbUrl ?? null,
      masterFileUrl: masterFileUrl ?? null,
      masterFileName: masterFileName ?? null,
      masterFileMime: masterFileMime ?? null,
      masterFileSize: parsedMasterFileSize ?? null,
      masterFileSha256: masterFileSha256 ?? null,
      sourceKitKey: sourceKitKey ?? null,
      face: face ?? null,
      color: color ?? null,
      manifestJson: manifestJson ?? null,
      ingestionStatus: ingestionStatus ?? (masterFileUrl ? "pending" : "preview-only"),
      ingestionError: ingestionError ?? null,
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
    const {
      name, description, productId, productName, imageUrl, thumbUrl, tags, isActive, sortOrder,
      masterFileUrl, masterFileName, masterFileMime, masterFileSize, masterFileSha256,
      sourceKitKey, face, color, manifestJson, ingestionStatus, ingestionError,
    } = req.body;
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
    if (masterFileUrl !== undefined) {
      if (!isValidMasterUrl(masterFileUrl)) {
        res.status(400).json({ error: "validation_error", message: "masterFileUrl must be a valid URL or local path" });
        return;
      }
      update.masterFileUrl = masterFileUrl;
    }
    if (masterFileName !== undefined) update.masterFileName = masterFileName;
    if (masterFileMime !== undefined) {
      if (masterFileMime !== null && !MASTER_MIMES.has(String(masterFileMime))) {
        res.status(400).json({ error: "validation_error", message: "masterFileMime must be a PSD or PSB MIME type" });
        return;
      }
      update.masterFileMime = masterFileMime;
    }
    if (masterFileSize !== undefined) {
      const parsed = parseOptionalPositiveInt(masterFileSize);
      if (!isValidOptionalInt(parsed)) {
        res.status(400).json({ error: "validation_error", message: "masterFileSize must be a non-negative integer" });
        return;
      }
      update.masterFileSize = parsed ?? null;
    }
    if (masterFileSha256 !== undefined) update.masterFileSha256 = masterFileSha256;
    if (sourceKitKey !== undefined) update.sourceKitKey = sourceKitKey;
    if (face !== undefined) update.face = face;
    if (color !== undefined) update.color = color;
    if (manifestJson !== undefined) update.manifestJson = manifestJson;
    if (ingestionStatus !== undefined) {
      if (!INGESTION_STATUSES.has(String(ingestionStatus))) {
        res.status(400).json({ error: "validation_error", message: "invalid ingestionStatus" });
        return;
      }
      update.ingestionStatus = ingestionStatus;
    }
    if (ingestionError !== undefined) update.ingestionError = ingestionError;
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
