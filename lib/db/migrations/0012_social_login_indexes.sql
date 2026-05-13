-- Migration 0012: Add missing indexes for social login lookups and query optimisation
-- NOTE: no CONCURRENTLY — migration runner wraps each file in a transaction.

-- Customers: google_id and facebook_id are used in WHERE clauses during OAuth login
CREATE INDEX IF NOT EXISTS idx_customers_google_id
  ON customers (google_id)
  WHERE google_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_customers_facebook_id
  ON customers (facebook_id)
  WHERE facebook_id IS NOT NULL;

-- Admin sessions: composite index aids cleanup queries for expired/revoked sessions
CREATE INDEX IF NOT EXISTS idx_admin_sessions_expires_revoked
  ON admin_sessions (expires_at, revoked_at)
  WHERE revoked_at IS NULL;

-- Orders: composite index for customer portal (customer_email ordered by date)
CREATE INDEX IF NOT EXISTS idx_orders_customer_email_created
  ON orders (customer_email, created_at DESC);

-- Products: partial index for featured products listing (very common query)
CREATE INDEX IF NOT EXISTS idx_products_featured_created
  ON products (created_at DESC)
  WHERE featured = true;

-- Blog: composite index for public listing (published + date)
CREATE INDEX IF NOT EXISTS idx_blog_published_created
  ON blog_posts (created_at DESC)
  WHERE published = true;

-- Newsletter: prevent duplicate subscriptions more efficiently
CREATE INDEX IF NOT EXISTS idx_newsletter_email_lower
  ON newsletter_subscribers (lower(email));
