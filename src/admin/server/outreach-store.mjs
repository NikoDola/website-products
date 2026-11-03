// Node-only. Imported by authenticated routes, backup tools and isolated tests.
import { DatabaseSync } from 'node:sqlite';
import { mkdirSync, chmodSync } from 'node:fs';
import { dirname, isAbsolute } from 'node:path';
import { randomUUID, createHash, createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { privateDataPath } from '../../shared/server/paths.mjs';
import { PlatformError } from '../../shared/entities.mjs';
import { email, text, validateDraft, webUrl } from '../../shared/outreach.mjs';

export const hash = value => createHash('sha256').update(value).digest('hex');
export function outreachPath(env = process.env) {
  if (env.VERCEL || env.NODE_ENV === 'production' && (!env.OUTREACH_DATA_PATH || !isAbsolute(env.OUTREACH_DATA_PATH))) throw new PlatformError('New Clients needs OUTREACH_DATA_PATH on a persistent Node server. Ephemeral hosting is unsupported.', 503);
  return privateDataPath('outreach.sqlite', env.OUTREACH_DATA_PATH);
}
function encryptionKey(env) {
  const value = env.OUTREACH_ENCRYPTION_KEY || '';
  if (!/^[a-f\d]{64}$/i.test(value)) throw new PlatformError('Configure OUTREACH_ENCRYPTION_KEY as 32 random bytes in hexadecimal before connecting Gmail.', 503);
  return Buffer.from(value, 'hex');
}
export function seal(value, env = process.env) {
  const iv = randomBytes(12), cipher = createCipheriv('aes-256-gcm', encryptionKey(env), iv);
  const encrypted = Buffer.concat([cipher.update(JSON.stringify(value), 'utf8'), cipher.final()]);
  return [iv, cipher.getAuthTag(), encrypted].map(part => part.toString('base64url')).join('.');
}
export function unseal(value, env = process.env) {
  try {
    const [iv, tag, data] = value.split('.').map(part => Buffer.from(part, 'base64url'));
    const cipher = createDecipheriv('aes-256-gcm', encryptionKey(env), iv); cipher.setAuthTag(tag);
    return JSON.parse(Buffer.concat([cipher.update(data), cipher.final()]).toString('utf8'));
  } catch { throw new PlatformError('Gmail credentials cannot be decrypted. Restore the encryption key or reconnect this account.', 503); }
}
export function gmailConfig(env = process.env) {
  encryptionKey(env);
  if (!env.GMAIL_CLIENT_ID || !env.GMAIL_CLIENT_SECRET || !env.GMAIL_REDIRECT_URI) throw new PlatformError('Configure Gmail OAuth client ID, secret and redirect URI. See docs/OUTREACH.md.', 503);
  let url; try { url = new URL(env.GMAIL_REDIRECT_URI); } catch { throw new PlatformError('Invalid Gmail redirect URI.', 503); }
  const local = env.NODE_ENV !== 'production' && ['127.0.0.1', 'localhost'].includes(url.hostname) && url.port === '3001';
  if (url.pathname !== '/api/outreach/oauth/callback' || url.search || url.hash || url.username || url.password || !(url.protocol === 'https:' || local && url.protocol === 'http:')) throw new PlatformError('Use the exact /api/outreach/oauth/callback URI on the protected admin origin.', 503);
  if (!local && url.origin !== env.ADMIN_ORIGIN) throw new PlatformError('Gmail redirect origin must match ADMIN_ORIGIN.', 503);
  return { clientId: env.GMAIL_CLIENT_ID, clientSecret: env.GMAIL_CLIENT_SECRET, redirectUri: url.href };
}
export function openOutreach(path = outreachPath(), env = process.env) {
  mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
  const db = new DatabaseSync(path);
  try { chmodSync(path, 0o600); } catch { /* Windows uses the directory's owner ACL. */ }
  db.exec(`PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;
    CREATE TABLE IF NOT EXISTS outreach_meta (version INTEGER NOT NULL);
    INSERT INTO outreach_meta SELECT 1 WHERE NOT EXISTS (SELECT 1 FROM outreach_meta);
    CREATE TABLE IF NOT EXISTS accounts (
      id TEXT PRIMARY KEY, email TEXT NOT NULL UNIQUE, status TEXT NOT NULL DEFAULT 'connected',
      can_send INTEGER NOT NULL DEFAULT 0, test_receiver INTEGER NOT NULL DEFAULT 0,
      daily_limit INTEGER NOT NULL DEFAULT 10 CHECK(daily_limit BETWEEN 1 AND 500),
      credentials TEXT, paused_reason TEXT NOT NULL DEFAULT '', version INTEGER NOT NULL DEFAULT 1,
      last_refresh TEXT, created_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY, account_id TEXT REFERENCES accounts(id), sender TEXT NOT NULL DEFAULT '', recipient TEXT NOT NULL DEFAULT '',
      subject TEXT NOT NULL DEFAULT '', body TEXT NOT NULL DEFAULT '', company TEXT NOT NULL DEFAULT '', website TEXT NOT NULL DEFAULT '', instagram TEXT NOT NULL DEFAULT '',
      state TEXT NOT NULL DEFAULT 'draft', placement TEXT NOT NULL DEFAULT 'unknown', placement_account TEXT NOT NULL DEFAULT '',
      gmail_id TEXT NOT NULL DEFAULT '', thread_id TEXT NOT NULL DEFAULT '', rfc_id TEXT NOT NULL DEFAULT '', fingerprint TEXT,
      attempt_at TEXT, day TEXT, sent_at TEXT, replied_at TEXT, bounced_at TEXT, last_refresh TEXT,
      error TEXT NOT NULL DEFAULT '', version INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
    CREATE UNIQUE INDEX IF NOT EXISTS unique_message_content ON messages(fingerprint) WHERE fingerprint IS NOT NULL;
    CREATE INDEX IF NOT EXISTS messages_account_day ON messages(account_id, day);
    CREATE TABLE IF NOT EXISTS leads (id TEXT PRIMARY KEY, name TEXT NOT NULL, email TEXT NOT NULL DEFAULT '', website TEXT NOT NULL DEFAULT '',
      instagram TEXT NOT NULL DEFAULT '', location_id TEXT NOT NULL DEFAULT '', location_name TEXT NOT NULL DEFAULT '', county TEXT NOT NULL DEFAULT '',
      source TEXT NOT NULL DEFAULT 'manual', source_id TEXT NOT NULL DEFAULT '', notes TEXT NOT NULL DEFAULT '', version INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS suppression (id TEXT PRIMARY KEY, kind TEXT NOT NULL, value TEXT NOT NULL, reason TEXT NOT NULL, actor TEXT NOT NULL, created_at TEXT NOT NULL, UNIQUE(kind, value));
    CREATE TABLE IF NOT EXISTS oauth_states (hash TEXT PRIMARY KEY, actor TEXT NOT NULL, binding_hash TEXT NOT NULL, verifier TEXT NOT NULL, role TEXT NOT NULL, reconnect_id TEXT NOT NULL, expires_at INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS api_usage (id INTEGER PRIMARY KEY, account_id TEXT, method TEXT NOT NULL, units INTEGER NOT NULL, at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS audit (id TEXT PRIMARY KEY, actor TEXT NOT NULL, action TEXT NOT NULL, record_id TEXT NOT NULL, at TEXT NOT NULL, detail TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS discovery_cache (location_id TEXT PRIMARY KEY, data TEXT NOT NULL, expires_at INTEGER NOT NULL);
  `);
  if (db.prepare('SELECT version FROM outreach_meta').get().version !== 1) { db.close(); throw new PlatformError('Unsupported outreach database version.', 503); }
  const all = (sql, ...args) => db.prepare(sql).all(...args), one = (sql, ...args) => db.prepare(sql).get(...args), run = (sql, ...args) => db.prepare(sql).run(...args);
  const now = () => new Date().toISOString();
  const audit = (actor, action, id, detail = {}) => run('INSERT INTO audit VALUES (?, ?, ?, ?, ?, ?)', randomUUID(), actor, action, id, now(), JSON.stringify(detail));
  const transaction = callback => { db.exec('BEGIN IMMEDIATE'); try { const result = callback(); db.exec('COMMIT'); return result; } catch (error) { db.exec('ROLLBACK'); throw error; } };
  const account = id => { const row = one('SELECT * FROM accounts WHERE id=?', String(id || '')); if (!row) throw new PlatformError('Gmail account not found.', 404); return row; };
  const message = id => { const row = one('SELECT * FROM messages WHERE id=?', String(id || '')); if (!row) throw new PlatformError('Email not found.', 404); return row; };
  const version = (row, expected) => { if (!Number.isInteger(expected) || row.version !== expected) throw new PlatformError('This record changed. Refresh before trying again.', 409); };
  const day = () => new Intl.DateTimeFormat('en-CA', { timeZone: env.OUTREACH_TIMEZONE || 'Europe/Skopje', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  const suppressed = draft => {
    const recipient = draft.recipient.toLowerCase(), domain = recipient.split('@')[1];
    const website = draft.website ? new URL(draft.website).hostname.replace(/^www\./, '') : '';
    return all('SELECT * FROM suppression').find(row => row.kind === 'email' ? row.value === recipient : row.value === domain || row.value === website || domain?.endsWith(`.${row.value}`) || website.endsWith(`.${row.value}`));
  };
  return { db, all, one, run, now, audit, transaction, account, message, day, suppressed, close: () => db.close(),
    snapshot() {
      const today = day();
      const accounts = all('SELECT id,email,status,can_send,test_receiver,daily_limit,paused_reason,version,last_refresh,created_at FROM accounts').map(row => {
        const totals = one(`SELECT COUNT(CASE WHEN sent_at IS NOT NULL THEN 1 END) AS total_sent,
          COUNT(CASE WHEN sent_at IS NOT NULL AND day=? THEN 1 END) AS sent_today,
          COUNT(CASE WHEN day=? AND state IN ('sending','uncertain','sent') THEN 1 END) AS reserved_today,
          COUNT(CASE WHEN bounced_at IS NOT NULL THEN 1 END) AS bounces,
          COUNT(CASE WHEN placement='spam' THEN 1 END) AS spam_tests,
          COUNT(CASE WHEN placement='inbox' THEN 1 END) AS inbox_tests FROM messages WHERE account_id=?`, today, today, row.id);
        const usage = one('SELECT COUNT(*) AS requests, COALESCE(SUM(units),0) AS estimated_quota_units FROM api_usage WHERE account_id=?', row.id);
        const received = one("SELECT COUNT(*) AS spam, COUNT(CASE WHEN placement='inbox' THEN 1 END) AS inbox FROM messages WHERE placement_account=? AND placement IN ('inbox','spam')", row.id);
        return { ...row, ...totals, remaining: Math.max(0, row.daily_limit - totals.reserved_today), usage, received_tests: { spam: received.spam - received.inbox, inbox: received.inbox } };
      });
      let configured = true; try { gmailConfig(env); } catch { configured = false; }
      return { accounts, messages: all('SELECT * FROM messages ORDER BY created_at DESC'), leads: all('SELECT * FROM leads ORDER BY created_at DESC'), suppression: all('SELECT * FROM suppression ORDER BY created_at DESC'),
        gmail_configured: configured, discovery_enabled: env.OUTREACH_DISCOVERY_ENABLED === 'true', timezone: env.OUTREACH_TIMEZONE || 'Europe/Skopje', day: today };
    },
    saveDraft(input, actor) {
      return transaction(() => {
        const values = validateDraft(input.record), before = input.id ? message(input.id) : null;
        if (before) { version(before, input.version); if (before.state !== 'draft') throw new PlatformError('Only drafts can be edited.', 409); }
        if (values.account_id) account(values.account_id);
        const id = before?.id || randomUUID(), at = now();
        if (before) run('UPDATE messages SET account_id=?,recipient=?,subject=?,body=?,company=?,website=?,instagram=?,version=version+1,updated_at=? WHERE id=?', values.account_id || null, values.recipient, values.subject, values.body, values.company, values.website, values.instagram, at, id);
        else run('INSERT INTO messages(id,account_id,recipient,subject,body,company,website,instagram,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?)', id, values.account_id || null, values.recipient, values.subject, values.body, values.company, values.website, values.instagram, at, at);
        audit(actor, 'draft.save', id); return message(id);
      });
    },
    reserveSend(input, actor) {
      return transaction(() => {
        const draft = message(input.id);
        if (draft.state !== 'draft') throw new PlatformError('This email was already submitted. Refresh its status; do not resend.', 409);
        version(draft, input.version); validateDraft(draft, true);
        const sender = account(draft.account_id);
        if (!sender.can_send || sender.status !== 'connected' || !sender.credentials || sender.paused_reason) throw new PlatformError('Choose a connected, unpaused sending account.', 409);
        if (suppressed(draft)) throw new PlatformError('This business or recipient is on the suppression list.', 409);
        const today = day(), used = one("SELECT COUNT(*) AS n FROM messages WHERE account_id=? AND day=? AND state IN ('sending','uncertain','sent')", sender.id, today).n;
        if (used >= sender.daily_limit) throw new PlatformError('Daily sending limit reached for this Gmail account.', 429);
        const fingerprint = hash([sender.id, draft.recipient, draft.subject.trim(), draft.body.trim()].join('\0'));
        if (one('SELECT id FROM messages WHERE fingerprint=?', fingerprint)) throw new PlatformError('An identical message has already been submitted from this account.', 409);
        const at = now(), rfc = `<${randomUUID()}@${sender.email.split('@')[1]}>`;
        run("UPDATE messages SET state='sending',sender=?,fingerprint=?,rfc_id=?,attempt_at=?,day=?,updated_at=?,version=version+1 WHERE id=?", sender.email, fingerprint, rfc, at, today, at, draft.id);
        audit(actor, 'email.submit', draft.id, { account_id: sender.id }); return message(draft.id);
      });
    },
    updateAccount(input, actor) {
      return transaction(() => {
        const row = account(input.id); version(row, input.version);
        const limit = Number(input.daily_limit);
        if (!Number.isInteger(limit) || limit < 1 || limit > 500) throw new PlatformError('Daily limit must be between 1 and 500.');
        run('UPDATE accounts SET daily_limit=?,test_receiver=?,version=version+1 WHERE id=?', limit, input.test_receiver === true ? 1 : 0, row.id);
        audit(actor, 'account.settings', row.id, { daily_limit: limit, test_receiver: input.test_receiver === true });
      });
    },
    saveLead(input, actor) {
      if (!input || typeof input !== 'object' || Array.isArray(input)) throw new PlatformError('Enter company details.');
      return transaction(() => {
        const name = text(input.name, 300, 'a company name', true), contact = input.email ? email(input.email) : '', website = webUrl(input.website), instagram = webUrl(input.instagram, true);
        const location = text(input.location_id, 100, 'location'), source = input.source === 'openstreetmap' ? 'openstreetmap' : 'manual', sourceId = text(input.source_id, 150, 'source ID');
        const host = website ? new URL(website).hostname.replace(/^www\./, '').toLowerCase() : '';
        const duplicate = all('SELECT * FROM leads').find(row => contact && row.email === contact || host && row.website && new URL(row.website).hostname.replace(/^www\./, '').toLowerCase() === host || sourceId && source === row.source && sourceId === row.source_id || row.name.toLowerCase().replace(/[^a-z0-9]/g,'') === name.toLowerCase().replace(/[^a-z0-9]/g,'') && row.location_id === location);
        if (duplicate) throw new PlatformError('This company is already saved as a potential lead.', 409);
        const id = randomUUID();
        run('INSERT INTO leads(id,name,email,website,instagram,location_id,location_name,county,source,source_id,notes,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)', id, name, contact, website, instagram, location, text(input.location_name,300,'location name'), text(input.county,200,'county'), source, sourceId, text(input.notes,10000,'notes'), now());
        audit(actor, 'lead.save', id); return one('SELECT * FROM leads WHERE id=?', id);
      });
    },
    suppress(input, actor) {
      return transaction(() => {
        const kind = input.kind === 'domain' ? 'domain' : 'email';
        const value = kind === 'email' ? email(input.value) : text(input.value,253,'a domain',true).toLowerCase().replace(/^www\./,'');
        if (kind === 'domain' && !/^[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?\.[a-z]{2,}$/i.test(value)) throw new PlatformError('Enter a domain such as example.com.');
        const reason = text(input.reason, 2000, 'a reason', true), id = randomUUID();
        run('INSERT INTO suppression VALUES(?,?,?,?,?,?) ON CONFLICT(kind,value) DO UPDATE SET reason=excluded.reason,actor=excluded.actor', id, kind, value, reason, actor, now());
        audit(actor, 'suppression.add', value, { kind, reason });
      });
    }
  };
}
