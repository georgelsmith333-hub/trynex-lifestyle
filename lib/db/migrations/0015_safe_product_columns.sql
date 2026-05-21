-- Safe idempotent migration: ensure all expected product JSONB columns exist.
-- These were present in the initial schema (0000) but may be missing on databases
-- that were partially migrated or set up via an alternative path.
-- All statements use ADD COLUMN IF NOT EXISTS so re-running is a no-op.

ALTER TABLE products ADD COLUMN IF NOT EXISTS color_variants JSONB DEFAULT '[]'::jsonb;
ALTER TABLE products ADD COLUMN IF NOT EXISTS tags           JSONB DEFAULT '[]'::jsonb;
ALTER TABLE products ADD COLUMN IF NOT EXISTS images         JSONB DEFAULT '[]'::jsonb;
ALTER TABLE products ADD COLUMN IF NOT EXISTS sizes          JSONB DEFAULT '[]'::jsonb;
ALTER TABLE products ADD COLUMN IF NOT EXISTS colors         JSONB DEFAULT '[]'::jsonb;
