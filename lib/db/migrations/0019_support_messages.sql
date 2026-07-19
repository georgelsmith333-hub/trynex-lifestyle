CREATE TABLE IF NOT EXISTS support_messages (
  id SERIAL PRIMARY KEY,
  customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  sender_type TEXT NOT NULL,
  sender_name TEXT,
  message TEXT NOT NULL,
  read_by_admin BOOLEAN NOT NULL DEFAULT FALSE,
  read_by_customer BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS support_messages_customer_created_idx
  ON support_messages (customer_id, created_at DESC);

CREATE INDEX IF NOT EXISTS support_messages_unread_admin_idx
  ON support_messages (read_by_admin, created_at DESC);

CREATE INDEX IF NOT EXISTS support_messages_unread_customer_idx
  ON support_messages (customer_id, read_by_customer, created_at DESC);
