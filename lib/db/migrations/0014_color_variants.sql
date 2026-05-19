ALTER TABLE products ADD COLUMN IF NOT EXISTS color_variants JSONB DEFAULT '[]'::jsonb;
