/**
 * Full-database backup sync.
 *
 * Mirrors every table in the active production database (Neon Main) into each
 * configured backup/shard database (Neon Failover, Products shard, Analytics
 * shard, and — if configured — Neon Secondary) so they always reflect the
 * live data, not just whatever they happened to have when first provisioned.
 *
 * Runs on a schedule (see scheduler.ts) and can also be triggered on demand
 * via POST /api/admin/backup/sync-now.
 *
 * Strategy per target:
 *   1. Disable FK checks for the session (session_replication_role = replica)
 *      so table order doesn't matter.
 *   2. TRUNCATE every table except `_migrations`.
 *   3. Copy every row from source -> target, table by table.
 *   4. Re-sync any integer sequences (serial/identity primary keys).
 *
 * This is a full mirror (not an incremental diff), which is appropriate here
 * because these targets are cold-standby/failover copies, not independently
 * written-to databases.
 */

import pg from "pg";
import { logger } from "./logger";

const { Pool } = pg;

export interface BackupTarget {
  id: string;
  label: string;
  envKey: string;
}

export const BACKUP_TARGETS: BackupTarget[] = [
  { id: "neon_failover", label: "Neon Failover", envKey: "DATABASE_FAILOVER" },
  { id: "neon_secondary", label: "Neon Secondary", envKey: "DATABASE_URL_TRYNEX_DB" },
  { id: "neon_products", label: "Products shard", envKey: "DATABASE_PRODUCTS" },
  { id: "neon_analytics", label: "Analytics shard", envKey: "DATABASE_ANALYTICS" },
];

export interface TargetSyncResult {
  id: string;
  label: string;
  status: "ok" | "skipped" | "error";
  tablesCopied?: number;
  rowsCopied?: number;
  message?: string;
  durationMs?: number;
}

async function getTables(pool: pg.Pool): Promise<string[]> {
  const r = await pool.query(
    `SELECT table_name FROM information_schema.tables
     WHERE table_schema = 'public' AND table_name <> '_migrations'
     ORDER BY table_name`,
  );
  return r.rows.map((row: { table_name: string }) => row.table_name);
}

interface ColumnInfo {
  name: string;
  dataType: string;
}

type Queryable = Pick<pg.Pool, "query">;

async function getColumns(pool: Queryable, table: string): Promise<ColumnInfo[]> {
  const r = await pool.query(
    `SELECT column_name, data_type FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = $1
     ORDER BY ordinal_position`,
    [table],
  );
  return r.rows.map((row: { column_name: string; data_type: string }) => ({
    name: row.column_name,
    dataType: row.data_type,
  }));
}

/** node-postgres does not auto-serialize JS objects/arrays for json/jsonb columns. */
function serializeForColumn(value: unknown, dataType: string): unknown {
  if (value === null || value === undefined) return value;
  if ((dataType === "json" || dataType === "jsonb") && typeof value === "object") {
    return JSON.stringify(value);
  }
  return value;
}

/**
 * Adds any columns present on the source table but missing on the target
 * table (schema drift — e.g. a column added directly in production without
 * updating the shared Drizzle schema file). Keeps backups from silently
 * falling behind or failing outright when this happens.
 */
async function healMissingColumns(
  targetClient: pg.PoolClient,
  table: string,
  sourceColumns: ColumnInfo[],
  targetColumnNames: Set<string>,
): Promise<string[]> {
  const added: string[] = [];
  for (const col of sourceColumns) {
    if (targetColumnNames.has(col.name)) continue;
    await targetClient.query(`ALTER TABLE "${table}" ADD COLUMN IF NOT EXISTS "${col.name}" ${col.dataType}`);
    added.push(col.name);
  }
  return added;
}

/**
 * Returns { child: parent } foreign key edges so inserts can happen in
 * parent-before-child order (Neon's managed role can't disable FK checks
 * via session_replication_role, unlike a superuser connection).
 */
async function getForeignKeyEdges(pool: pg.Pool): Promise<Array<{ child: string; parent: string }>> {
  const r = await pool.query(`
    SELECT tc.table_name AS child, ccu.table_name AS parent
    FROM information_schema.table_constraints tc
    JOIN information_schema.constraint_column_usage ccu
      ON tc.constraint_name = ccu.constraint_name AND tc.table_schema = ccu.table_schema
    WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_schema = 'public'
      AND tc.table_name <> ccu.table_name
  `);
  return r.rows;
}

/** Topologically sorts tables so every parent comes before its children. */
function topoSortTables(tables: string[], edges: Array<{ child: string; parent: string }>): string[] {
  const tableSet = new Set(tables);
  const dependsOn = new Map<string, Set<string>>();
  for (const t of tables) dependsOn.set(t, new Set());
  for (const { child, parent } of edges) {
    if (tableSet.has(child) && tableSet.has(parent)) {
      dependsOn.get(child)!.add(parent);
    }
  }

  const result: string[] = [];
  const visited = new Set<string>();
  const visiting = new Set<string>();

  function visit(t: string): void {
    if (visited.has(t)) return;
    if (visiting.has(t)) return; // cycle guard — leave order as-is
    visiting.add(t);
    for (const dep of dependsOn.get(t) ?? []) visit(dep);
    visiting.delete(t);
    visited.add(t);
    result.push(t);
  }

  for (const t of [...tables].sort()) visit(t);
  return result;
}

async function syncOneTarget(
  sourceUrl: string,
  target: BackupTarget,
): Promise<TargetSyncResult> {
  const start = Date.now();
  const targetUrl = process.env[target.envKey];

  if (!targetUrl || targetUrl.trim().length === 0) {
    return { id: target.id, label: target.label, status: "skipped", message: `${target.envKey} not configured` };
  }

  const sourcePool = new Pool({ connectionString: sourceUrl, max: 2, connectionTimeoutMillis: 10_000 });
  const targetPool = new Pool({ connectionString: targetUrl, max: 2, connectionTimeoutMillis: 10_000 });

  try {
    const sourceTables = await getTables(sourcePool);
    const targetTables = new Set(await getTables(targetPool));
    const sharedTables = sourceTables.filter((t) => targetTables.has(t));
    const edges = await getForeignKeyEdges(sourcePool);
    const tables = topoSortTables(sharedTables, edges);

    const client = await targetPool.connect();
    let rowsCopied = 0;
    try {
      await client.query("BEGIN");

      // Managed Neon roles can't disable FK checks, so truncate every shared
      // table in a single statement with CASCADE — order doesn't matter here
      // because they're all being cleared together in one DDL statement.
      if (tables.length > 0) {
        const tableList = tables.map((t) => `"${t}"`).join(", ");
        await client.query(`TRUNCATE TABLE ${tableList} CASCADE`);
      }

      // Insert in parent-before-child order so FK constraints are satisfied.
      // Rows are batched (100 per statement) to minimize network round-trips
      // to the remote Neon endpoints, which matters when there are hundreds
      // of rows across many tables.
      const BATCH_SIZE = 100;
      const healedColumns: Record<string, string[]> = {};
      for (const table of tables) {
        const columns = await getColumns(sourcePool, table);
        if (columns.length === 0) continue;

        const targetColumns = await getColumns(client, table);
        const targetColumnNames = new Set(targetColumns.map((c) => c.name));
        const added = await healMissingColumns(client, table, columns, targetColumnNames);
        if (added.length > 0) healedColumns[table] = added;

        const { rows } = await sourcePool.query(`SELECT * FROM "${table}"`);
        if (rows.length === 0) continue;

        const colList = columns.map((c) => `"${c.name}"`).join(", ");

        for (let i = 0; i < rows.length; i += BATCH_SIZE) {
          const batch = rows.slice(i, i + BATCH_SIZE);
          const values: unknown[] = [];
          const valueGroups: string[] = [];
          for (const row of batch) {
            const rowStart = values.length;
            for (const c of columns) values.push(serializeForColumn(row[c.name], c.dataType));
            const placeholders = columns.map((_, j) => `$${rowStart + j + 1}`).join(", ");
            valueGroups.push(`(${placeholders})`);
          }
          const insertSql = `INSERT INTO "${table}" (${colList}) VALUES ${valueGroups.join(", ")}`;
          await client.query(insertSql, values);
          rowsCopied += batch.length;
        }

        // Best-effort sequence resync for integer primary keys named "id"
        try {
          await client.query(
            `SELECT setval(pg_get_serial_sequence($1, 'id'), COALESCE((SELECT MAX(id) FROM "${table}"), 1))`,
            [table],
          );
        } catch {
          // Table has no serial "id" sequence (e.g. uuid PK) — safe to ignore
        }
      }

      await client.query("COMMIT");
    } catch (err) {
      await client.query("ROLLBACK").catch(() => {});
      throw err;
    } finally {
      client.release();
    }

    const durationMs = Date.now() - start;
    logger.info(
      { target: target.label, tables: tables.length, rows: rowsCopied, durationMs },
      "[backupSync] Target synced",
    );
    return { id: target.id, label: target.label, status: "ok", tablesCopied: tables.length, rowsCopied, durationMs };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.warn({ target: target.label, err: message }, "[backupSync] Target sync failed");
    return { id: target.id, label: target.label, status: "error", message, durationMs: Date.now() - start };
  } finally {
    await sourcePool.end().catch(() => {});
    await targetPool.end().catch(() => {});
  }
}

/**
 * Mirrors the live Neon Main database into every configured backup target.
 * Safe to call repeatedly (e.g. on a schedule) — always does a full replace.
 */
export async function runBackupSync(): Promise<TargetSyncResult[]> {
  const sourceUrl = process.env.DATABASE_URL_MAIN || process.env.DATABASE_URL;
  if (!sourceUrl) {
    logger.warn("[backupSync] No source database configured — skipping sync");
    return [];
  }

  const results: TargetSyncResult[] = [];
  for (const target of BACKUP_TARGETS) {
    const result = await syncOneTarget(sourceUrl, target);
    results.push(result);
  }
  return results;
}
