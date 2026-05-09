import { Router, type IRouter } from "express";
import { requireAdmin } from "../middlewares/adminAuth";
import {
  db,
  productsTable,
  ordersTable,
  promoCodesTable,
  categoriesTable,
} from "@workspace/db";
import { eq, ilike } from "drizzle-orm";
import { logActivity, getAdminId } from "../lib/activityLog";
import { logger } from "../lib/logger";

const router: IRouter = Router();

const POLLIN_TEXT_URL = "https://text.pollinations.ai/openai";

const COMMAND_PARSER_SYSTEM = `You are a strict JSON command parser for TryNex Lifestyle admin panel.
Parse the natural language admin command into ONE of these JSON action objects.
Return ONLY valid JSON — no markdown, no explanation, no code fences.

Supported actions:
1. { "action": "create_product", "name": string, "price": number, "category"?: string, "description"?: string }
2. { "action": "update_order_status", "orderId": number, "status": "pending"|"processing"|"shipped"|"delivered"|"cancelled" }
3. { "action": "create_promo_code", "code": string, "discountType": "percentage"|"fixed", "discountValue": number, "minOrder"?: number, "expiresAt"?: "YYYY-MM-DD"|null, "maxUses"?: number }
4. { "action": "delete_promo_code", "code": string }
5. { "action": "feature_product", "name": string, "featured": boolean }
6. { "action": "update_product_price", "name": string, "price": number }
7. { "action": "unknown", "reason": string }

Rules:
- BDT prices: extract number only (e.g. "৳899" → 899, "1200 taka" → 1200, "tk 500" → 500)
- "ship"/"shipping" → "shipped"; "deliver" → "delivered"; "cancel" → "cancelled"; "process" → "processing"
- "remove"/"delete" promo → delete_promo_code
- "highlight"/"promote"/"make featured" → feature_product with featured: true
- "unfeature"/"remove from featured" → feature_product with featured: false
- orderId must be a plain number extracted from text like "order 145", "#145", "order number 145"
- Return ONLY a JSON object.`;

async function parseCommandWithAI(command: string): Promise<Record<string, unknown>> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20_000);
  try {
    const r = await fetch(POLLIN_TEXT_URL, {
      method: "POST",
      signal: controller.signal,
      headers: { "Content-Type": "application/json", "User-Agent": "TryNex-Admin/2.0" },
      body: JSON.stringify({
        model: "openai-large",
        messages: [
          { role: "system", content: COMMAND_PARSER_SYSTEM },
          { role: "user", content: command },
        ],
        stream: false,
        private: true,
        seed: Math.floor(Math.random() * 99999),
      }),
    });
    clearTimeout(timeout);
    if (!r.ok) throw new Error(`AI parse service returned ${r.status}`);
    const data = await r.json() as { choices?: Array<{ message?: { content?: string } }> };
    const raw = (data?.choices?.[0]?.message?.content ?? "").trim();
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("No JSON found in AI response");
    return JSON.parse(jsonMatch[0]);
  } catch (err) {
    clearTimeout(timeout);
    throw err;
  }
}

/* ═══════════════════════════════════════════════════════
   POST /api/admin/ai-execute
   Execute a natural-language admin command
═══════════════════════════════════════════════════════ */
router.post("/admin/ai-execute", requireAdmin, async (req, res) => {
  const { command } = req.body as { command?: string };
  if (!command?.trim()) {
    return res.status(400).json({ error: "command is required" });
  }

  let parsed: Record<string, unknown>;
  try {
    parsed = await parseCommandWithAI(command.trim());
  } catch (err) {
    logger.warn({ err, command }, "[ai-execute] parse failed");
    return res.status(502).json({
      error: "Could not parse command — AI service temporarily unavailable. Please try again.",
    });
  }

  const action = parsed.action as string;
  const adminId = getAdminId(req);

  try {
    switch (action) {
      /* ─── Create Product ─────────────────────── */
      case "create_product": {
        const name = String(parsed.name ?? "").trim();
        const price = Number(parsed.price);
        if (!name) return res.status(400).json({ error: "Could not extract product name from command." });
        if (!price || price <= 0) return res.status(400).json({ error: "Could not extract a valid price from command." });

        let categoryId: number | null = null;
        const catName = String(parsed.category ?? "").trim();
        if (catName) {
          const cats = await db.select().from(categoriesTable)
            .where(ilike(categoriesTable.name, `%${catName}%`)).limit(1);
          if (cats.length > 0) categoryId = cats[0].id;
        }

        const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 80)
          + "-" + Date.now();

        const [product] = await db.insert(productsTable).values({
          name,
          slug,
          price: String(price),
          description: String(parsed.description ?? `${name} — premium quality custom apparel from TryNex Lifestyle.`),
          imageUrl: "/placeholder-product.jpg",
          categoryId,
          stock: 50,
          featured: false,
          customizable: true,
          sizes: ["S", "M", "L", "XL", "XXL"],
          colors: ["Black", "White", "Navy"],
          tags: [],
          images: [],
          rating: "4.9",
        }).returning();

        await logActivity({
          adminId, action: "create", entity: "product",
          entityId: String(product.id), entityName: product.name,
          after: product as unknown as Record<string, unknown>,
        });

        return res.json({
          success: true,
          action: "create_product",
          description: `Created product **"${product.name}"** priced at ৳${price}`,
          data: { id: product.id, name: product.name, price },
          undoInfo: { type: "delete_product", productId: product.id, productName: product.name },
        });
      }

      /* ─── Update Order Status ────────────────── */
      case "update_order_status": {
        const orderId = Number(parsed.orderId);
        const status = String(parsed.status ?? "").trim();
        const validStatuses = ["pending", "processing", "shipped", "delivered", "cancelled"];
        if (!orderId || orderId <= 0) return res.status(400).json({ error: "Could not extract order ID from command." });
        if (!validStatuses.includes(status)) return res.status(400).json({ error: `Invalid status "${status}". Use: ${validStatuses.join(", ")}` });

        const existing = await db.select().from(ordersTable).where(eq(ordersTable.id, orderId)).limit(1);
        if (!existing.length) return res.status(404).json({ error: `Order #${orderId} not found.` });

        const before = existing[0];
        const [updated] = await db.update(ordersTable)
          .set({ status } as Record<string, string>)
          .where(eq(ordersTable.id, orderId))
          .returning();

        await logActivity({
          adminId, action: "update", entity: "order",
          entityId: String(orderId), entityName: `Order #${orderId}`,
          before: before as unknown as Record<string, unknown>,
          after: updated as unknown as Record<string, unknown>,
        });

        return res.json({
          success: true,
          action: "update_order_status",
          description: `Order **#${orderId}** status changed from _${before.status}_ → **${status}**`,
          data: { orderId, oldStatus: before.status, newStatus: status },
          undoInfo: { type: "update_order_status", orderId, previousStatus: before.status },
        });
      }

      /* ─── Create Promo Code ──────────────────── */
      case "create_promo_code": {
        const code = String(parsed.code ?? "").toUpperCase().trim().replace(/\s+/g, "");
        const discountType = String(parsed.discountType ?? "percentage") as "percentage" | "fixed";
        const discountValue = Number(parsed.discountValue);
        if (!code) return res.status(400).json({ error: "Could not extract promo code from command." });
        if (!discountValue || discountValue <= 0) return res.status(400).json({ error: "Could not extract discount value from command." });

        const [promo] = await db.insert(promoCodesTable).values({
          code,
          discountType,
          discountValue: String(discountValue),
          minOrderAmount: parsed.minOrder ? String(parsed.minOrder) : "0",
          maxUses: parsed.maxUses ? Number(parsed.maxUses) : 0,
          expiresAt: parsed.expiresAt ? new Date(parsed.expiresAt as string) : null,
          active: true,
          usedCount: 0,
        }).returning();

        await logActivity({
          adminId, action: "create", entity: "promo_code",
          entityId: String(promo.id), entityName: promo.code,
          after: promo as unknown as Record<string, unknown>,
        });

        const discountLabel = discountType === "percentage" ? `${discountValue}% off` : `৳${discountValue} off`;
        return res.json({
          success: true,
          action: "create_promo_code",
          description: `Created promo code **${code}** — ${discountLabel}`,
          data: { id: promo.id, code, discountType, discountValue },
          undoInfo: { type: "delete_promo_id", promoId: promo.id, code },
        });
      }

      /* ─── Delete Promo Code ──────────────────── */
      case "delete_promo_code": {
        const code = String(parsed.code ?? "").toUpperCase().trim();
        if (!code) return res.status(400).json({ error: "Could not extract promo code from command." });

        const existing = await db.select().from(promoCodesTable)
          .where(eq(promoCodesTable.code, code)).limit(1);
        if (!existing.length) return res.status(404).json({ error: `Promo code "${code}" not found.` });

        await db.delete(promoCodesTable).where(eq(promoCodesTable.code, code));
        await logActivity({
          adminId, action: "delete", entity: "promo_code",
          entityId: String(existing[0].id), entityName: code,
          before: existing[0] as unknown as Record<string, unknown>,
        });

        return res.json({
          success: true,
          action: "delete_promo_code",
          description: `Deleted promo code **${code}**`,
          data: { code },
          undoInfo: { type: "restore_promo", data: existing[0] },
        });
      }

      /* ─── Feature / Unfeature Product ───────── */
      case "feature_product": {
        const name = String(parsed.name ?? "").trim();
        const featured = Boolean(parsed.featured);
        if (!name) return res.status(400).json({ error: "Could not extract product name from command." });

        const existing = await db.select().from(productsTable)
          .where(ilike(productsTable.name, `%${name}%`)).limit(1);
        if (!existing.length) return res.status(404).json({ error: `No product matching "${name}" found.` });

        const [updated] = await db.update(productsTable)
          .set({ featured })
          .where(eq(productsTable.id, existing[0].id))
          .returning();

        await logActivity({
          adminId, action: "update", entity: "product",
          entityId: String(updated.id), entityName: updated.name,
          before: existing[0] as unknown as Record<string, unknown>,
          after: updated as unknown as Record<string, unknown>,
        });

        return res.json({
          success: true,
          action: "feature_product",
          description: `**"${updated.name}"** is now ${featured ? "✨ featured" : "removed from featured"}`,
          data: { id: updated.id, name: updated.name, featured },
          undoInfo: { type: "feature_product", productId: updated.id, productName: updated.name, featured: !featured },
        });
      }

      /* ─── Update Product Price ───────────────── */
      case "update_product_price": {
        const name = String(parsed.name ?? "").trim();
        const price = Number(parsed.price);
        if (!name) return res.status(400).json({ error: "Could not extract product name from command." });
        if (!price || price <= 0) return res.status(400).json({ error: "Could not extract a valid price from command." });

        const existing = await db.select().from(productsTable)
          .where(ilike(productsTable.name, `%${name}%`)).limit(1);
        if (!existing.length) return res.status(404).json({ error: `No product matching "${name}" found.` });

        const prevPrice = existing[0].price;
        const [updated] = await db.update(productsTable)
          .set({ price: String(price) })
          .where(eq(productsTable.id, existing[0].id))
          .returning();

        await logActivity({
          adminId, action: "update", entity: "product",
          entityId: String(updated.id), entityName: updated.name,
          before: existing[0] as unknown as Record<string, unknown>,
          after: updated as unknown as Record<string, unknown>,
        });

        return res.json({
          success: true,
          action: "update_product_price",
          description: `**"${updated.name}"** price updated ৳${prevPrice} → **৳${price}**`,
          data: { id: updated.id, name: updated.name, oldPrice: prevPrice, newPrice: price },
          undoInfo: { type: "update_product_price", productId: updated.id, productName: updated.name, previousPrice: prevPrice },
        });
      }

      /* ─── Unknown ────────────────────────────── */
      case "unknown":
        return res.status(400).json({
          error: "Command not understood",
          details: String(parsed.reason ?? "Please rephrase your command."),
          suggestions: [
            "Create a product called [name] at ৳[price]",
            "Update order #[id] to shipped",
            "Create promo code [CODE] for [X]% off",
            "Feature the product [name]",
            "Update price of [product name] to ৳[price]",
            "Delete promo code [CODE]",
          ],
        });

      default:
        return res.status(400).json({ error: `Unrecognised action "${action}"` });
    }
  } catch (err) {
    logger.error({ err, action, command }, "[ai-execute] execution failed");
    const msg = err instanceof Error ? err.message : "Internal error";
    if (msg.includes("23505")) {
      return res.status(409).json({ error: "A promo code with that name already exists." });
    }
    return res.status(500).json({ error: "Execution failed", details: msg });
  }
});

/* ═══════════════════════════════════════════════════════
   POST /api/admin/ai-undo
   Undo a previous AI execution using undoInfo returned by ai-execute
═══════════════════════════════════════════════════════ */
router.post("/admin/ai-undo", requireAdmin, async (req, res) => {
  const { undoInfo } = req.body as { undoInfo: Record<string, unknown> };
  if (!undoInfo?.type) return res.status(400).json({ error: "undoInfo.type is required" });

  const adminId = getAdminId(req);

  try {
    switch (undoInfo.type) {
      case "delete_product": {
        const productId = Number(undoInfo.productId);
        await db.delete(productsTable).where(eq(productsTable.id, productId));
        await logActivity({
          adminId, action: "delete", entity: "product",
          entityId: String(productId), entityName: String(undoInfo.productName ?? productId),
          before: { id: productId } as Record<string, unknown>,
        });
        return res.json({ success: true, description: `Product "${undoInfo.productName}" creation undone` });
      }

      case "update_order_status": {
        const orderId = Number(undoInfo.orderId);
        const prevStatus = String(undoInfo.previousStatus);
        await db.update(ordersTable)
          .set({ status: prevStatus } as Record<string, string>)
          .where(eq(ordersTable.id, orderId));
        return res.json({ success: true, description: `Order #${orderId} restored to "${prevStatus}"` });
      }

      case "delete_promo_id": {
        const promoId = Number(undoInfo.promoId);
        await db.delete(promoCodesTable).where(eq(promoCodesTable.id, promoId));
        return res.json({ success: true, description: `Promo code "${undoInfo.code}" creation undone` });
      }

      case "restore_promo": {
        const data = undoInfo.data as Record<string, unknown>;
        await db.insert(promoCodesTable).values({
          code: data.code as string,
          discountType: data.discountType as "percentage" | "fixed",
          discountValue: data.discountValue as string,
          minOrderAmount: (data.minOrderAmount as string) ?? "0",
          maxUses: Number(data.maxUses ?? 0),
          expiresAt: data.expiresAt ? new Date(data.expiresAt as string) : null,
          active: Boolean(data.active ?? data.isActive ?? true),
          usedCount: Number(data.usedCount ?? 0),
        }).onConflictDoNothing();
        return res.json({ success: true, description: `Promo code "${data.code}" restored` });
      }

      case "feature_product": {
        const productId = Number(undoInfo.productId);
        const featured = Boolean(undoInfo.featured);
        await db.update(productsTable).set({ featured }).where(eq(productsTable.id, productId));
        return res.json({ success: true, description: `"${undoInfo.productName}" featured status reverted` });
      }

      case "update_product_price": {
        const productId = Number(undoInfo.productId);
        const prevPrice = String(undoInfo.previousPrice);
        await db.update(productsTable).set({ price: prevPrice }).where(eq(productsTable.id, productId));
        return res.json({ success: true, description: `"${undoInfo.productName}" price reverted to ৳${prevPrice}` });
      }

      default:
        return res.status(400).json({ error: `Unknown undo type: ${undoInfo.type}` });
    }
  } catch (err) {
    logger.error({ err, undoInfo }, "[ai-undo] failed");
    return res.status(500).json({ error: "Undo failed", details: err instanceof Error ? err.message : "Internal error" });
  }
});

export default router;
