PRAGMA foreign_keys = ON;
CREATE TABLE IF NOT EXISTS clients (
  id TEXT PRIMARY KEY, name TEXT NOT NULL, email TEXT NOT NULL DEFAULT '',
  phone TEXT NOT NULL DEFAULT '', status TEXT NOT NULL DEFAULT 'active', notes TEXT NOT NULL DEFAULT '',
  stripe_test_id TEXT UNIQUE, stripe_live_id TEXT UNIQUE,
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL, version INTEGER NOT NULL DEFAULT 1
);
CREATE TABLE IF NOT EXISTS contacts (
  id TEXT PRIMARY KEY, client_id TEXT NOT NULL REFERENCES clients(id), name TEXT NOT NULL,
  email TEXT NOT NULL DEFAULT '', phone TEXT NOT NULL DEFAULT '', role TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL, version INTEGER NOT NULL DEFAULT 1
);
CREATE TABLE IF NOT EXISTS sites (
  id TEXT PRIMARY KEY, client_id TEXT NOT NULL REFERENCES clients(id), name TEXT NOT NULL,
  public_url TEXT NOT NULL, cms_url TEXT NOT NULL DEFAULT '', project_path TEXT NOT NULL DEFAULT '',
  repository_url TEXT NOT NULL DEFAULT '', hosting_url TEXT NOT NULL DEFAULT '',
  domain_due TEXT NOT NULL DEFAULT '', backup_verified_at TEXT NOT NULL DEFAULT '',
  state TEXT NOT NULL DEFAULT 'development', expected_text TEXT NOT NULL DEFAULT '',
  monitor_enabled INTEGER NOT NULL DEFAULT 0, cms_status_url TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL, version INTEGER NOT NULL DEFAULT 1
);
CREATE TABLE IF NOT EXISTS agreements (
  id TEXT PRIMARY KEY, client_id TEXT NOT NULL REFERENCES clients(id), title TEXT NOT NULL,
  amount INTEGER NOT NULL DEFAULT 0 CHECK(amount >= 0), currency TEXT NOT NULL DEFAULT 'eur',
  cadence TEXT NOT NULL DEFAULT 'monthly', due_date TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'active', stripe_subscription_id TEXT NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1
);
CREATE TABLE IF NOT EXISTS agreement_sites (
  agreement_id TEXT NOT NULL REFERENCES agreements(id), site_id TEXT NOT NULL REFERENCES sites(id),
  PRIMARY KEY(agreement_id, site_id)
);
CREATE TABLE IF NOT EXISTS invoices (
  id TEXT PRIMARY KEY, client_id TEXT NOT NULL REFERENCES clients(id), agreement_id TEXT REFERENCES agreements(id),
  stripe_id TEXT NOT NULL, mode TEXT NOT NULL, number TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '', amount_due INTEGER NOT NULL, amount_paid INTEGER NOT NULL,
  amount_remaining INTEGER NOT NULL, currency TEXT NOT NULL, status TEXT NOT NULL,
  due_at TEXT, paid_at TEXT, period_start TEXT, period_end TEXT, hosted_url TEXT NOT NULL DEFAULT '',
  synced_at TEXT NOT NULL, UNIQUE(mode, stripe_id)
);
CREATE TABLE IF NOT EXISTS payments (
  id TEXT PRIMARY KEY, client_id TEXT NOT NULL REFERENCES clients(id), stripe_id TEXT NOT NULL,
  mode TEXT NOT NULL, description TEXT NOT NULL DEFAULT '', amount INTEGER NOT NULL,
  refunded INTEGER NOT NULL DEFAULT 0, currency TEXT NOT NULL, status TEXT NOT NULL,
  paid_at TEXT, receipt_url TEXT NOT NULL DEFAULT '', disputed INTEGER NOT NULL DEFAULT 0,
  synced_at TEXT NOT NULL, UNIQUE(mode, stripe_id)
);
CREATE TABLE IF NOT EXISTS webhook_events (
  id TEXT PRIMARY KEY, type TEXT NOT NULL, mode TEXT NOT NULL, status TEXT NOT NULL,
  received_at TEXT NOT NULL, processed_at TEXT
);
CREATE TABLE IF NOT EXISTS jobs (
  id TEXT PRIMARY KEY, lease_until INTEGER NOT NULL DEFAULT 0, last_success_at TEXT,
  last_attempt_at TEXT, error TEXT, cursor TEXT NOT NULL DEFAULT ''
);
CREATE TABLE IF NOT EXISTS health_checks (
  id TEXT PRIMARY KEY, site_id TEXT NOT NULL REFERENCES sites(id), kind TEXT NOT NULL,
  status TEXT NOT NULL, http_status INTEGER, latency_ms INTEGER, message TEXT NOT NULL DEFAULT '',
  checked_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS health_site_time ON health_checks(site_id, kind, checked_at DESC);
CREATE TABLE IF NOT EXISTS incidents (
  id TEXT PRIMARY KEY, site_id TEXT NOT NULL REFERENCES sites(id), kind TEXT NOT NULL,
  opened_at TEXT NOT NULL, resolved_at TEXT, message TEXT NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS one_open_incident ON incidents(site_id, kind) WHERE resolved_at IS NULL;
CREATE TABLE IF NOT EXISTS tasks (
  id TEXT PRIMARY KEY, client_id TEXT REFERENCES clients(id), site_id TEXT REFERENCES sites(id),
  title TEXT NOT NULL, notes TEXT NOT NULL DEFAULT '', due_date TEXT NOT NULL DEFAULT '',
  priority TEXT NOT NULL DEFAULT 'normal', status TEXT NOT NULL DEFAULT 'open',
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL, version INTEGER NOT NULL DEFAULT 1
);
CREATE TABLE IF NOT EXISTS orders (
  id TEXT PRIMARY KEY, client_id TEXT REFERENCES clients(id), title TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'new', amount INTEGER NOT NULL DEFAULT 0 CHECK(amount >= 0),
  currency TEXT NOT NULL DEFAULT 'eur', source TEXT NOT NULL DEFAULT '', notes TEXT NOT NULL DEFAULT '',
  due_date TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1
);
CREATE TABLE IF NOT EXISTS calls (
  id TEXT PRIMARY KEY, client_id TEXT REFERENCES clients(id), title TEXT NOT NULL,
  scheduled_at TEXT NOT NULL DEFAULT '', status TEXT NOT NULL DEFAULT 'planned',
  notes TEXT NOT NULL DEFAULT '', next_action TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL, version INTEGER NOT NULL DEFAULT 1
);
CREATE TABLE IF NOT EXISTS campaigns (
  id TEXT PRIMARY KEY, title TEXT NOT NULL, channel TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'planned', budget INTEGER NOT NULL DEFAULT 0 CHECK(budget >= 0),
  currency TEXT NOT NULL DEFAULT 'eur', start_date TEXT NOT NULL DEFAULT '',
  end_date TEXT NOT NULL DEFAULT '', notes TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL, version INTEGER NOT NULL DEFAULT 1
);
CREATE TABLE IF NOT EXISTS settings (
  id TEXT PRIMARY KEY CHECK(id = 'business'), name TEXT NOT NULL DEFAULT 'Website Products',
  email TEXT NOT NULL DEFAULT '', currency TEXT NOT NULL DEFAULT 'eur',
  timezone TEXT NOT NULL DEFAULT 'Europe/Skopje', updated_at TEXT NOT NULL, version INTEGER NOT NULL DEFAULT 1
);
CREATE TABLE IF NOT EXISTS activity (
  id TEXT PRIMARY KEY, actor TEXT NOT NULL, action TEXT NOT NULL, entity TEXT NOT NULL,
  entity_id TEXT NOT NULL, summary TEXT NOT NULL, created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS activity_time ON activity(created_at DESC);
-- Used only to make optimistic update checks atomic within a D1 batch.
CREATE TABLE IF NOT EXISTS platform_update_guard (value INTEGER NOT NULL CHECK(value = 1));
