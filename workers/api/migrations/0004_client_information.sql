ALTER TABLE clients ADD COLUMN first_name TEXT NOT NULL DEFAULT '';
ALTER TABLE clients ADD COLUMN last_name TEXT NOT NULL DEFAULT '';
ALTER TABLE agreements ADD COLUMN stripe_status TEXT NOT NULL DEFAULT '';
ALTER TABLE agreements ADD COLUMN stripe_next_payment_at TEXT;
ALTER TABLE agreements ADD COLUMN stripe_schedule_note TEXT NOT NULL DEFAULT '';
ALTER TABLE agreements ADD COLUMN stripe_synced_at TEXT;
