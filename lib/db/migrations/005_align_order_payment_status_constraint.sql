-- Align the database contract with the admin order workflow.
-- Historical orders may use verified or wrong while payment is being reviewed.
ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_payment_status_check;
ALTER TABLE orders
  ADD CONSTRAINT orders_payment_status_check
  CHECK (payment_status IN ('pending', 'submitted', 'verified', 'paid', 'not_paid', 'wrong', 'refunded'));
