import { adminActivityLogsTable } from "../schema";
import type { DB } from "../db";
import type { Context } from "hono";
import type { AppEnv } from "../types";

export type ActivityAction = "create" | "update" | "delete" | "rollback";
export type ActivityEntity =
  | "product" | "order" | "blog" | "category"
  | "setting" | "hamper" | "promo" | "review" | "customer";

export async function logActivity(
  db: DB,
  opts: {
    action: ActivityAction;
    entity: ActivityEntity | string;
    entityId: string | number;
    entityName: string;
    before?: Record<string, unknown> | null;
    after?: Record<string, unknown> | null;
    adminId?: number | null;
  },
): Promise<void> {
  try {
    await db.insert(adminActivityLogsTable).values({
      adminId: opts.adminId ?? null,
      action: opts.action,
      entity: opts.entity,
      entityId: String(opts.entityId),
      entityName: opts.entityName,
      before: opts.before ?? null,
      after: opts.after ?? null,
    });
  } catch (err) {
    console.error("[activity-log] Failed to insert activity log", err);
  }
}

export function getAdminId(c: Context<AppEnv>): number | null {
  return c.get("adminSession")?.adminId ?? null;
}
