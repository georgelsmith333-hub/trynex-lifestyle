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
    process.env.DATABASE_URL_MAIN,      // Neon primary — preferred production DB
    process.env.DATABASE_FAILOVER,      // Neon failover — ep-crimson-dawn
    process.env.DATABASE_URL_TRYNEX_DB, // Neon secondary (if configured)
    process.env.DATABASE_PRODUCTS,      // Products shard / cold mirror
    process.env.DATABASE_ANALYTICS,     // Analytics shard / cold mirror
    process.env.DATABASE_URL,           // Replit built-in — last resort
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

const primaryUrl = urls[0];

/* ─── Internal mutable state (switched on failover) ─────────────────────── */
let _activePool: pg.Pool = new Pool({
  connectionString: primaryUrl,
  max: 10,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 10_000,
});

let _activeDb: NodePgDatabase<typeof schema> = drizzle(_activePool, { schema });
let _activeUrl = primaryUrl;

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

/* ─── Probe a single candidate URL (creates and ends its own test pool) ─── */
async function probeCandidate(url: string): Promise<{ ok: boolean; pool?: pg.Pool; error?: string }> {
  const testPool = new Pool({ connectionString: url, max: 1, connectionTimeoutMillis: 10_000 });
  try {
    const schemaOk = await hasSchema(testPool);
    if (schemaOk) return { ok: true, pool: testPool };
    await testPool.end().catch(() => {});
    return { ok: false, error: "missing schema" };
  } catch (err) {
    await testPool.end().catch(() => {});
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

function hostOf(url: string): string {
  return url.split("@").pop()?.split("?")[0] ?? "unknown";
}

/* ─── Switch the active pool to a new URL (thread-safe-ish by design) ───── */
async function switchTo(url: string, pool: pg.Pool): Promise<void> {
  const prev = _activePool;
  _activePool = pool;
  _activeDb = drizzle(_activePool, { schema });
  _activeUrl = url;
  await prev.end().catch(() => {});
}

/* ─── Non-blocking startup probe + failover ─────────────────────────────── */
async function probeAndFailover(): Promise<void> {
  // Always test the primary first. If it is already healthy, keep the existing
  // pool so we do not churn connections on every restart.
  const primaryProbe = await probeCandidate(primaryUrl);
  if (primaryProbe.ok && primaryProbe.pool) {
    await switchTo(primaryUrl, primaryProbe.pool);
    console.info(`[DB] Connected to primary (${hostOf(primaryUrl)})`);
    return;
  }

  // Try fallbacks in priority order.
  for (let i = 1; i < urls.length; i++) {
    const url = urls[i];
    const result = await probeCandidate(url);
    if (result.ok && result.pool) {
      await switchTo(url, result.pool);
      console.warn(
        `[DB] Primary unreachable or empty. Switched to fallback #${i + 1} (${hostOf(url)})`,
      );
      return;
    }
    if (!result.ok) {
      console.warn(`[DB] Fallback #${i + 1} (${hostOf(url)}) not ready: ${result.error}`);
    }
  }

  console.error(
    "[DB] WARNING: All database connection candidates failed at probe time. " +
    "The server will still start — queries will fail until a DB becomes reachable.",
  );
}

/* ─── Periodic re-probe: auto-recover to primary, failover if active dies ─ */
let _reprobeTimer: NodeJS.Timeout | null = null;
let _reprobeIntervalMs = 60_000; // re-evaluate every 60 seconds

async function reprobe(): Promise<void> {
  try {
    // Walk the whole chain from top to bottom and use the first healthy DB.
    // This both: (a) promotes the primary back when it recovers, and
    // (b) demotes to the next fallback if the currently active DB goes down.
    for (let i = 0; i < urls.length; i++) {
      const url = urls[i];
      const result = await probeCandidate(url);
      if (result.ok && result.pool) {
        if (url !== _activeUrl) {
          const prevHost = hostOf(_activeUrl);
          const newHost = hostOf(url);
          const label = i === 0 ? "primary" : `fallback #${i + 1}`;
          await switchTo(url, result.pool);
          console.warn(
            `[DB] Re-probe: switched from ${prevHost} to ${label} (${newHost})`,
          );
        } else {
          await result.pool.end().catch(() => {});
        }
        return;
      }
    }
  } catch {
    // Ignore individual probe errors — the next tick will retry.
  }
}

function startReprobeTimer(): void {
  if (_reprobeTimer) return;
  _reprobeTimer = setInterval(() => {
    reprobe().catch(() => {});
  }, _reprobeIntervalMs);
  _reprobeTimer.unref();
}

/**
 * Manually trigger a re-probe of the whole database chain. Useful in tests
 * and admin endpoints that want to force a failover check.
 */
export async function probeDatabaseChain(): Promise<{ activeUrl: string; index: number }> {
  await reprobe();
  return { activeUrl: _activeUrl, index: urls.indexOf(_activeUrl) };
}

// Exported promise — await this before running migrations or seeding
// so the correct database is active before any schema queries run.
export const dbReady: Promise<void> = probeAndFailover()
  .then(() => {
    startReprobeTimer();
  })
  .catch(() => {
    // Even if the initial probe fails, start the timer so we recover later.
    startReprobeTimer();
  });

/* ─── DB health helper (used by /api/health/auth) ───────────────────────── */
export async function getActiveDbUrl(): Promise<string> {
  return _activeUrl;
}

export * from "./schema";
