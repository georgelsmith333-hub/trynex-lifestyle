-- Add foreign-key constraint from admin_activity_logs.admin_id → admins.id
-- Use ON DELETE SET NULL so log entries are preserved if an admin account is deleted.
-- Guard with DO $$ so re-running this migration on an already-migrated DB is a no-op.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'fk_activity_log_admin'
      AND conrelid = 'admin_activity_logs'::regclass
  ) THEN
    ALTER TABLE admin_activity_logs
      ADD CONSTRAINT fk_activity_log_admin
      FOREIGN KEY (admin_id) REFERENCES admins(id) ON DELETE SET NULL;
  END IF;
END;
$$;
