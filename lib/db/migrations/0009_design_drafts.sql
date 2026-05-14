CREATE TABLE IF NOT EXISTS design_drafts (
  id SERIAL PRIMARY KEY,
  customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  payload JSONB NOT NULL,
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  CONSTRAINT design_drafts_customer_unique UNIQUE (customer_id)
);
