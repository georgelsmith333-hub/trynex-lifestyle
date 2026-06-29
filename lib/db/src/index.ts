/**
 * Resilient PostgreSQL connection with automatic failover.
 *
 * Priority order for connection URLs:
 *   1. DATABASE_URL_MAIN     (Neon primary — ep-proud-hill) ← preferred when set
 *   2. DATABASE_FAILOVER     (Neon failover — ep-crimson-dawn) ← second Neon instance
 *   3. DATABASE_URL_TRYNEX_DB (Neon secondary)
 *   4. DATABASE_URL          (Replit built-in — local dev last resort)
 *
 * The probe validates that a connection both connects AND has the expected schema
 * (by checking for the `products` table). This prevents falling back to an empty
 * local DB when Neon is reachable but slow to wake up.
 *
 * The module probes all URLs at startup (non-blocking) and switches
 * transparently to the first reachable one. All callers use the same
 * `db` and `pool` exports — no changes required elsewhere.
 */

import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";

const { Pool } = pg;

/* ─── Candidate URL resolution ───────────────────────────────────────────── */
function getCandidateUrls(): string[] {
  const candidates = [
    process.env.DATABASE_URL_MAIN,     // Neon primary — preferred production DB
    process.env.DATABASE_FAILOVER,     // Neon failover — ep-crimson-dawn (has schema)
    process.env.DATABASE_URL_TRYNEX_DB, // Neon secondary
    process.env.DATABASE_URL,          // Replit built-in — local dev last resort
  ].filter((url): url is string => typeof url === "string" && url.trim().length > 0);

  // Preserve insertion order, deduplicate
  return [...new Set(candidates)];
}

const urls = getCandidateUrls();

if (urls.length === 0) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

/* ─── Internal mutable state (switched on failover) ─────────────────────── */
let _activePool: pg.Pool = new Pool({
  connectionString: urls[0],
  max: 10,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 10_000,
});

let _activeDb: NodePgDatabase<typeof schema> = drizzle(_activePool, { schema });
let _activeUrl = urls[0];

/* ─── Transparent proxies (callers see a stable reference) ──────────────── */
export const pool = new Proxy({} as pg.Pool, {
  get(_target, prop) {
    return (_activePool as unknown as Record<string | symbol, unknown>)[prop];
  },
});

export const db = new Proxy({} as NodePgDatabase<typeof schema>, {
  get(_target, prop) {
    return (_activeDb as unknown as Record<string | symbol, unknown>)[prop];
  },
});

/* ─── Schema validation helper ───────────────────────────────────────────── */
/**
 * Returns true if this pool can connect AND the database has the expected
 * schema (products table exists). This prevents falling back to an empty
 * local database when Neon is reachable but the local DB has no tables.
 */
async function hasSchema(testPool: pg.Pool): Promise<boolean> {
  const client = await testPool.connect();
  try {
    const result = await client.query(
      "SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='products' LIMIT 1"
    );
    return result.rowCount !== null && result.rowCount > 0;
  } finally {
    client.release();
  }
}

/* ─── Non-blocking startup probe + failover ─────────────────────────────── */
async function probeAndFailover(): Promise<void> {
  for (let i = 0; i < urls.length; i++) {
    const url = urls[i];
    const testPool =
      i === 0
        ? _activePool
        : new Pool({ connectionString: url, max: 1, connectionTimeoutMillis: 10_000 });

    try {
      const schemaOk = await hasSchema(testPool);

      if (!schemaOk && i < urls.length - 1) {
        // This DB connects but has no schema — try the next candidate
        const host = url.split("@").pop()?.split("?")[0] ?? "unknown";
        console.warn(
          `[DB] Candidate #${i + 1} (${host}) has no schema — trying next candidate`,
        );
        if (i > 0) await testPool.end().catch(() => {});
        continue;
      }

      if (i > 0) {
        // Primary is down or empty — switch to this fallback permanently
        const prev = _activePool;
        _activePool = testPool;
        _activeDb = drizzle(_activePool, { schema });
        _activeUrl = url;
        await prev.end().catch(() => {});

        const host = url.split("@").pop()?.split("?")[0] ?? "unknown";
        console.warn(
          `[DB] Primary unreachable or empty. Switched to fallback #${i + 1} (${host})`,
        );
      } else {
        const host = url.split("@").pop()?.split("?")[0] ?? "unknown";
        console.info(`[DB] Connected to primary (${host})`);
      }

      return; // Found a working connection
    } catch {
      if (i > 0) await testPool.end().catch(() => {});
      // else leave _activePool in place (it may recover)
    }
  }

  console.error(
    "[DB] WARNING: All database connection candidates failed at probe time. " +
    "The server will still start — queries will fail until a DB becomes reachable.",
  );
}

// Exported promise — await this before running migrations or seeding
// so the correct database is active before any schema queries run.
export const dbReady: Promise<void> = probeAndFailover().catch(() => {});

/* ─── DB health helper (used by /api/health/auth) ───────────────────────── */
export async function getActiveDbUrl(): Promise<string> {
  return _activeUrl;
}

export * from "./schema";
