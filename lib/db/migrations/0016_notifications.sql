-- Add notifications table
CREATE TABLE IF NOT EXISTS "notifications" (
	"id" serial PRIMARY KEY NOT NULL,
	"customer_id" integer NOT NULL,
	"title" text NOT NULL,
	"message" text NOT NULL,
	"type" text DEFAULT 'general' NOT NULL,
	"link" text,
	"read" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);

-- Index for faster lookups by customer
CREATE INDEX IF NOT EXISTS "notifications_customer_id_idx" ON "notifications" ("customer_id");
CREATE INDEX IF NOT EXISTS "notifications_read_idx" ON "notifications" ("read");
