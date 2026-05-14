-- ─────────────────────────────────────────────────────────────────────────────
-- 0011: Performance indexes for all hot query paths
-- ─────────────────────────────────────────────────────────────────────────────

-- orders: admin list (by status, date) + customer lookup + order number search
CREATE INDEX IF NOT EXISTS idx_orders_status
  ON orders (status);

CREATE INDEX IF NOT EXISTS idx_orders_created_at_desc
  ON orders (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_orders_customer_id
  ON orders (customer_id)
  WHERE customer_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_orders_customer_email
  ON orders (customer_email);

CREATE INDEX IF NOT EXISTS idx_orders_status_created
  ON orders (status, created_at DESC);

-- products: category filter + featured listing + search
CREATE INDEX IF NOT EXISTS idx_products_category_id
  ON products (category_id)
  WHERE category_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_products_featured
  ON products (featured)
  WHERE featured = true;

CREATE INDEX IF NOT EXISTS idx_products_created_at_desc
  ON products (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_products_category_created
  ON products (category_id, created_at DESC);

-- blog_posts: public listing (published) + featured + category filter
CREATE INDEX IF NOT EXISTS idx_blog_posts_published
  ON blog_posts (published)
  WHERE published = true;

CREATE INDEX IF NOT EXISTS idx_blog_posts_published_created
  ON blog_posts (published, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_blog_posts_category
  ON blog_posts (category)
  WHERE published = true;

CREATE INDEX IF NOT EXISTS idx_blog_posts_featured
  ON blog_posts (featured)
  WHERE featured = true AND published = true;

-- admin_sessions: token lookup + expiry sweep
CREATE INDEX IF NOT EXISTS idx_admin_sessions_expires_at
  ON admin_sessions (expires_at);

CREATE INDEX IF NOT EXISTS idx_admin_sessions_admin_id
  ON admin_sessions (admin_id)
  WHERE admin_id IS NOT NULL;

-- reviews: product reviews listing + approval queue
CREATE INDEX IF NOT EXISTS idx_reviews_product_id
  ON reviews (product_id);

CREATE INDEX IF NOT EXISTS idx_reviews_product_approved
  ON reviews (product_id, approved);

CREATE INDEX IF NOT EXISTS idx_reviews_approved_created
  ON reviews (approved, created_at DESC);

-- customers: login lookup (email unique idx already exists but add phone)
CREATE INDEX IF NOT EXISTS idx_customers_phone
  ON customers (phone)
  WHERE phone IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_customers_created_at_desc
  ON customers (created_at DESC);

-- newsletter_subscribers: dedup check
CREATE INDEX IF NOT EXISTS idx_newsletter_email
  ON newsletter_subscribers (email);

-- hamper_packages: featured + active listing
CREATE INDEX IF NOT EXISTS idx_hampers_active_featured
  ON hamper_packages (active, featured)
  WHERE active = true;

CREATE INDEX IF NOT EXISTS idx_hampers_sort_order
  ON hamper_packages (sort_order);

-- admin_activity_logs: admin audit trail
CREATE INDEX IF NOT EXISTS idx_activity_logs_admin_id
  ON admin_activity_logs (admin_id)
  WHERE admin_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_activity_logs_created_at_desc
  ON admin_activity_logs (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_activity_logs_entity
  ON admin_activity_logs (entity, entity_id);

-- design_drafts: already has unique on customer_id — no additional index needed
-- promo_codes: code is unique (already indexed). Add active filter index.
CREATE INDEX IF NOT EXISTS idx_promo_codes_active
  ON promo_codes (active, code)
  WHERE active = true;

-- referrals: already unique on referral_code. Add owner lookup.
CREATE INDEX IF NOT EXISTS idx_referrals_owner_email
  ON referrals (owner_email);

-- testimonials: active sort
CREATE INDEX IF NOT EXISTS idx_testimonials_active_sort
  ON testimonials (active, sort_order)
  WHERE active = true;
