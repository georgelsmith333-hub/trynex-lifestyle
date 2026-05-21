#!/usr/bin/env node
/**
 * Standalone non-interactive migration runner.
 *
 * Reads every *.sql file in lib/db/migrations/ in sorted order, tracks which
 * ones have been applied in a `_migrations` table, and applies any that are
 * pending. All statements are safe to re-run (idempotent guards in each file).
 *
 * Usage:
 *   node scripts/migrate.mjs
 *
 * Requires DATABASE_URL to be set.
 */

import pg from "pg";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const { Client } = pg;
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const MIGRATIONS_DIR = path.join(ROOT, "lib", "db", "migrations");

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error("ERROR: DATABASE_URL is not set.");
  process.exit(1);
}

const client = new Client({
  connectionString: databaseUrl,
  connectionTimeoutMillis: 15_000,
  ssl: databaseUrl.includes("sslmode=require") ? { rejectUnauthorized: false } : false,
});

try {
  await client.connect();
  console.log("[migrate] Connected to database.");

  await client.query(`
    CREATE TABLE IF NOT EXISTS _migrations (
      name TEXT PRIMARY KEY,
      applied_at TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `);

  const appliedRes = await client.query("SELECT name FROM _migrations");
  const applied = new Set(appliedRes.rows.map((r) => r.name));

  const files = fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  let count = 0;
  for (const file of files) {
    if (applied.has(file)) {
      console.log(`[migrate] skip  ${file} (already applied)`);
      continue;
    }
    const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), "utf8");
    console.log(`[migrate] apply ${file}`);
    await client.query("BEGIN");
    try {
      await client.query(sql);
      await client.query("INSERT INTO _migrations (name) VALUES ($1)", [file]);
      await client.query("COMMIT");
      count++;
    } catch (err) {
      await client.query("ROLLBACK");
      console.error(`[migrate] FAILED ${file}: ${err.message}`);
      throw err;
    }
  }

  console.log(`[migrate] Done — ${count} new migration(s) applied, ${files.length} total.`);
} finally {
  await client.end().catch(() => {});
}
