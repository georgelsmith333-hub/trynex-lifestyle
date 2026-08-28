-- Checkout retries 502/503/504. Without a unique idempotency key a successful
-- POST followed by a gateway timeout would create a second order and decrement
-- stock twice. NULL keys remain allowed for legacy/admin-created rows.
ALTER TABLE orders ADD COLUMN IF NOT EXISTS idempotency_key text;
CREATE UNIQUE INDEX IF NOT EXISTS orders_idempotency_key_uidx
  ON orders (idempotency_key)
  WHERE idempotency_key IS NOT NULL;
