ALTER TABLE settings ADD COLUMN country TEXT NOT NULL DEFAULT 'North Macedonia';
UPDATE settings SET currency = 'usd', timezone = 'Europe/Skopje',
  updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), version = version + 1
  WHERE currency != 'usd' OR timezone != 'Europe/Skopje';

CREATE TABLE communications (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  company TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL DEFAULT '',
  phone TEXT NOT NULL DEFAULT '',
  client_id TEXT REFERENCES clients(id),
  stage TEXT NOT NULL DEFAULT 'potential'
    CHECK(stage IN ('potential','in-discussion','proposal-sent','ordered','active-client','closed')),
  next_follow_up TEXT NOT NULL DEFAULT '',
  next_action TEXT NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1
);
CREATE INDEX communications_follow_up ON communications(stage, next_follow_up);
CREATE TABLE communication_entries (
  id TEXT PRIMARY KEY,
  communication_id TEXT NOT NULL REFERENCES communications(id),
  type TEXT NOT NULL CHECK(type IN ('email-sent','email-received','note')),
  occurred_at TEXT NOT NULL,
  subject TEXT NOT NULL,
  notes TEXT NOT NULL DEFAULT '',
  actor TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX communication_history ON communication_entries(communication_id, occurred_at DESC);
