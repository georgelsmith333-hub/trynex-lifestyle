/**
 * Upstash Redis client with graceful in-process fallback.
 *
 * If UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN are both set, all
 * cache ops go through the Upstash Redis REST API — which survives Render
 * restarts and is shared across any future horizontal instances.
 *
 * If either env var is missing the module falls back to a plain in-process
 * Map so the server still works without Redis configured (dev, CI, etc.).
 *
 * Usage:
 *   import { redisCacheGet, redisCacheSet, redisCacheDel } from "./redis";
 *
 *   const cached = await redisCacheGet<MyType>("my-key");
 *   if (!cached) {
 *     const data = await expensiveQuery();
 *     await redisCacheSet("my-key", data, 60);   // TTL in seconds
 *   }
 *   await redisCacheDel("my-key");               // on write/invalidation
 */

import { logger } from "./logger";

// ── Types ──────────────────────────────────────────────────────────────────

interface RedisClient {
  get: <T>(key: string) => Promise<T | null>;
  set: (key: string, value: unknown, opts: { ex: number }) => Promise<unknown>;
  del: (...keys: string[]) => Promise<unknown>;
}

// ── Client initialisation ──────────────────────────────────────────────────

let _redis: RedisClient | null = null;

/** True once we've confirmed Redis is reachable (used for startup log). */
let _verified = false;

async function getClient(): Promise<RedisClient | null> {
  if (_redis) return _redis;

  const url   = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!url || !token) {
    return null;
  }

  try {
    const { Redis } = await import("@upstash/redis");
    const client = new Redis({ url, token });

    // Verify connectivity once on first use.
    if (!_verified) {
      await client.set("_trynex_health", "1", { ex: 10 });
      _verified = true;
      logger.info("[redis] Upstash Redis connected — distributed cache active");
    }

    _redis = client as unknown as RedisClient;
    return _redis;
  } catch (err) {
    logger.warn({ err }, "[redis] Failed to connect to Upstash Redis — falling back to in-process cache");
    return null;
  }
}

// ── In-process fallback ────────────────────────────────────────────────────

interface FallbackEntry { value: unknown; expiresAt: number }
const _fallback = new Map<string, FallbackEntry>();

function fallbackGet<T>(key: string): T | null {
  const entry = _fallback.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) { _fallback.delete(key); return null; }
  return entry.value as T;
}

function fallbackSet(key: string, value: unknown, ttlSeconds: number): void {
  _fallback.set(key, { value, expiresAt: Date.now() + ttlSeconds * 1000 });
}

function fallbackDel(...keys: string[]): void {
  for (const k of keys) _fallback.delete(k);
}

// ── Public helpers ─────────────────────────────────────────────────────────

export async function redisCacheGet<T>(key: string): Promise<T | null> {
  try {
    const client = await getClient();
    if (client) return await client.get<T>(key);
    return fallbackGet<T>(key);
  } catch (err) {
    logger.warn({ err, key }, "[redis] GET failed — using fallback");
    return fallbackGet<T>(key);
  }
}

export async function redisCacheSet(key: string, value: unknown, ttlSeconds: number): Promise<void> {
  try {
    const client = await getClient();
    if (client) {
      await client.set(key, value, { ex: ttlSeconds });
      return;
    }
  } catch (err) {
    logger.warn({ err, key }, "[redis] SET failed — using fallback");
  }
  fallbackSet(key, value, ttlSeconds);
}

export async function redisCacheDel(...keys: string[]): Promise<void> {
  try {
    const client = await getClient();
    if (client) {
      await client.del(...keys);
      return;
    }
  } catch (err) {
    logger.warn({ err, keys }, "[redis] DEL failed — using fallback");
  }
  fallbackDel(...keys);
}
