import { Hono } from "hono";
import { eq, desc, and, gte, lte, ilike, sql } from "drizzle-orm";
import { createDb } from "../db";
import {
  adminActivityLogsTable, adminTable,
  productsTable, blogPostsTable, categoriesTable, ordersTable,
  hamperPackagesTable, promoCodesTable, reviewsTable, settingsTable, customersTable,
} from "../schema";
import { requireAdmin } from "../middleware/adminAuth";
import { logActivity, getAdminId } from "../lib/activityLog";
import type { AppEnv } from "../types";

const app = new Hono<AppEnv>();

app.get("/admin/activity-logs", requireAdmin, async (c) => {
  try {
    const db = createDb(c.env.DATABASE_URL);
    const page = c.req.query("page") || "1";
    const limit = c.req.query("limit") || "20";
    const action = c.req.query("action");
    const entity = c.req.query("entity");
    const search = c.req.query("search");
    const dateFrom = c.req.query("dateFrom");
    const dateTo = c.req.query("dateTo");

    const pageNum = Math.max(1, parseInt(page, 10));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10)));
    const offset = (pageNum - 1) * limitNum;

    const endDate = dateTo ? new Date(dateTo) : null;
    if (endDate) endDate.setHours(23, 59, 59, 999);

    const where = and(
      action ? eq(adminActivityLogsTable.action, action) : undefined,
      entity ? eq(adminActivityLogsTable.entity, entity) : undefined,
      search ? ilike(adminActivityLogsTable.entityName, `%${search}%`) : undefined,
      dateFrom ? gte(adminActivityLogsTable.createdAt, new Date(dateFrom)) : undefined,
      endDate ? lte(adminActivityLogsTable.createdAt, endDate) : undefined,
    );

    const [rows, countResult] = await Promise.all([
      db.select({
        id: adminActivityLogsTable.id,
        adminId: adminActivityLogsTable.adminId,
        adminName: adminTable.username,
        action: adminActivityLogsTable.action,
        entity: adminActivityLogsTable.entity,
        entityId: adminActivityLogsTable.entityId,
        entityName: adminActivityLogsTable.entityName,
        before: adminActivityLogsTable.before,
        after: adminActivityLogsTable.after,
        createdAt: adminActivityLogsTable.createdAt,
      })
      .from(adminActivityLogsTable)
      .leftJoin(adminTable, eq(adminActivityLogsTable.adminId, adminTable.id))
      .where(where)
      .orderBy(desc(adminActivityLogsTable.createdAt))
      .limit(limitNum)
      .offset(offset),
      db.select({ count: sql<number>`count(*)` }).from(adminActivityLogsTable).where(where),
    ]);

    return c.json({
      logs: rows,
      total: Number(countResult[0]?.count ?? 0),
      page: pageNum,
      limit: limitNum,
      totalPages: Math.ceil(Number(countResult[0]?.count ?? 0) / limitNum),
    });
  } catch (err) {
    console.error("Failed to list activity logs", err);
    return c.json({ error: "internal_error", message: "Failed to list activity logs" }, 500);
  }
});

app.post("/admin/activity-logs/:id/rollback", requireAdmin, async (c) => {
  try {
    const db = createDb(c.env.DATABASE_URL);
    const logId = parseInt(c.req.param("id"), 10);
    if (isNaN(logId)) return c.json({ error: "validation_error", message: "Invalid log ID" }, 400);

    const [entry] = await db.select().from(adminActivityLogsTable).where(eq(adminActivityLogsTable.id, logId));
    if (!entry) return c.json({ error: "not_found", message: "Log entry not found" }, 404);
    if (!["update", "delete"].includes(entry.action)) {
      return c.json({ error: "not_rollbackable", message: `Cannot roll back a '${entry.action}' action.` }, 400);
    }
    const before = entry.before as Record<string, unknown> | null;
    if (!before) return c.json({ error: "no_snapshot", message: "No before-snapshot available for this entry" }, 400);

    const entityId = entry.entityId ? parseInt(entry.entityId, 10) : null;
    const adminId = getAdminId(c);
    const entity = entry.entity;

    function stripMeta(data: Record<string, unknown>) {
      const { id: _id, createdAt: _ca, updatedAt: _ua, ...rest } = data as Record<string, unknown>;
      return rest;
    }

    let rollbackResult: unknown = null;

    if (entity === "product") {
      if (!entityId) throw new Error("Missing entity ID");
      if (entry.action === "delete") {
        [rollbackResult] = await db.insert(productsTable).values({ ...stripMeta(before), id: entityId } as any).onConflictDoUpdate({ target: productsTable.id, set: stripMeta(before) as any }).returning();
      } else {
        [rollbackResult] = await db.update(productsTable).set({ ...stripMeta(before), updatedAt: new Date() } as any).where(eq(productsTable.id, entityId)).returning();
      }
    } else if (entity === "blog") {
      if (!entityId) throw new Error("Missing entity ID");
      if (entry.action === "delete") {
        [rollbackResult] = await db.insert(blogPostsTable).values({ ...stripMeta(before), id: entityId } as any).onConflictDoUpdate({ target: blogPostsTable.id, set: stripMeta(before) as any }).returning();
      } else {
        [rollbackResult] = await db.update(blogPostsTable).set({ ...stripMeta(before), updatedAt: new Date() } as any).where(eq(blogPostsTable.id, entityId)).returning();
      }
    } else if (entity === "category") {
      if (!entityId) throw new Error("Missing entity ID");
      if (entry.action === "delete") {
        [rollbackResult] = await db.insert(categoriesTable).values({ ...stripMeta(before), id: entityId } as any).onConflictDoUpdate({ target: categoriesTable.id, set: stripMeta(before) as any }).returning();
      } else {
        [rollbackResult] = await db.update(categoriesTable).set(stripMeta(before) as any).where(eq(categoriesTable.id, entityId)).returning();
      }
    } else if (entity === "order") {
      if (!entityId) throw new Error("Missing entity ID");
      [rollbackResult] = await db.update(ordersTable).set({ ...stripMeta(before), updatedAt: new Date() } as any).where(eq(ordersTable.id, entityId)).returning();
    } else if (entity === "hamper") {
      if (!entityId) throw new Error("Missing entity ID");
      if (entry.action === "delete") {
        [rollbackResult] = await db.insert(hamperPackagesTable).values({ ...stripMeta(before), id: entityId } as any).onConflictDoUpdate({ target: hamperPackagesTable.id, set: stripMeta(before) as any }).returning();
      } else {
        [rollbackResult] = await db.update(hamperPackagesTable).set({ ...stripMeta(before), updatedAt: new Date() } as any).where(eq(hamperPackagesTable.id, entityId)).returning();
      }
    } else if (entity === "promo") {
      if (!entityId) throw new Error("Missing entity ID");
      if (entry.action === "delete") {
        [rollbackResult] = await db.insert(promoCodesTable).values({ ...stripMeta(before), id: entityId } as any).onConflictDoUpdate({ target: promoCodesTable.id, set: stripMeta(before) as any }).returning();
      } else {
        [rollbackResult] = await db.update(promoCodesTable).set({ ...stripMeta(before), updatedAt: new Date() } as any).where(eq(promoCodesTable.id, entityId)).returning();
      }
    } else if (entity === "review") {
      if (!entityId) throw new Error("Missing entity ID");
      if (entry.action === "delete") {
        [rollbackResult] = await db.insert(reviewsTable).values({ ...stripMeta(before), id: entityId } as any).onConflictDoUpdate({ target: reviewsTable.id, set: stripMeta(before) as any }).returning();
      } else {
        [rollbackResult] = await db.update(reviewsTable).set(stripMeta(before) as any).where(eq(reviewsTable.id, entityId)).returning();
      }
    } else if (entity === "setting") {
      const updates: Array<{ key: string; value: string | null }> = [];
      for (const [key, value] of Object.entries(before)) {
        const dbValue = value === null || value === undefined ? null : String(value);
        await db.insert(settingsTable).values({ key, value: dbValue }).onConflictDoUpdate({ target: settingsTable.key, set: { value: dbValue, updatedAt: new Date() } });
        updates.push({ key, value: dbValue });
      }
      rollbackResult = updates;
    } else if (entity === "customer") {
      if (!entityId) throw new Error("Missing entity ID");
      if (entry.action === "delete") {
        [rollbackResult] = await db.insert(customersTable).values({ ...stripMeta(before), id: entityId } as any).onConflictDoUpdate({ target: customersTable.id, set: stripMeta(before) as any }).returning();
      } else {
        [rollbackResult] = await db.update(customersTable).set({ ...stripMeta(before), updatedAt: new Date() } as any).where(eq(customersTable.id, entityId)).returning();
      }
    } else {
      return c.json({ error: "unsupported_entity", message: `Rollback not supported for entity type '${entity}'` }, 400);
    }

    await logActivity(db, {
      action: "rollback",
      entity: entry.entity,
      entityId: entry.entityId ?? 0,
      entityName: entry.entityName ?? "",
      before: entry.after as Record<string, unknown> | null,
      after: before,
      adminId,
    });

    return c.json({ success: true, rolledBack: rollbackResult });
  } catch (err) {
    console.error("Rollback failed", err);
    return c.json({ error: "internal_error", message: "Rollback failed" }, 500);
  }
});

export default app;
