-- Only explicitly linked recurring maintenance subscriptions belong in billing.
ALTER TABLE agreements ADD COLUMN stripe_mode TEXT NOT NULL DEFAULT 'test' CHECK(stripe_mode IN ('test','live'));
UPDATE agreements SET stripe_mode = 'live' WHERE EXISTS (
  SELECT 1 FROM invoices WHERE invoices.agreement_id = agreements.id AND invoices.mode = 'live'
);
ALTER TABLE invoices ADD COLUMN stripe_subscription_id TEXT NOT NULL DEFAULT '';
ALTER TABLE payments ADD COLUMN agreement_id TEXT REFERENCES agreements(id);
ALTER TABLE payments ADD COLUMN stripe_subscription_id TEXT NOT NULL DEFAULT '';
ALTER TABLE payments ADD COLUMN stripe_invoice_id TEXT NOT NULL DEFAULT '';
CREATE INDEX IF NOT EXISTS invoices_subscription ON invoices(mode,stripe_subscription_id);
CREATE INDEX IF NOT EXISTS payments_subscription ON payments(mode,stripe_subscription_id);
