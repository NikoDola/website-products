// Node-only private referral records. No writes to Clients, Stripe or maintenance totals.
import { DatabaseSync } from 'node:sqlite';
import { mkdirSync, chmodSync, existsSync } from 'node:fs';
import { dirname, isAbsolute } from 'node:path';
import { randomUUID, randomBytes } from 'node:crypto';
import { privateDataPath } from '../../shared/server/paths.mjs';
import { PlatformError } from '../../shared/entities.mjs';
import { referralCode, validReferralCode, validatePartner, validateCommission, validatePayout, commissionMinor, referralBasis } from '../../shared/referrals.mjs';

export function referralPath(env = process.env) {
  if (env.VERCEL || env.NODE_ENV === 'production' && (!env.REFERRAL_DATA_PATH || !isAbsolute(env.REFERRAL_DATA_PATH))) throw new PlatformError('Referral Program needs REFERRAL_DATA_PATH on a persistent Node server before hosting.', 503);
  return privateDataPath('referrals.sqlite', env.REFERRAL_DATA_PATH);
}
// Contact submissions resolve a code privately, without creating an empty database.
export function resolveReferral(value, env = process.env) {
  const code = referralCode(value);
  if (!validReferralCode(code)) return null;
  const path = referralPath(env);
  if (!existsSync(path)) return null;
  const db = new DatabaseSync(path, { readOnly: true });
  try { return db.prepare('SELECT id, name, code FROM partners WHERE code=? AND active=1').get(code) || null; }
  finally { db.close(); }
}
export function openReferrals(path = referralPath()) {
  mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
  const db = new DatabaseSync(path);
  try { chmodSync(path, 0o600); } catch { /* Windows inherits the private directory ACL. */ }
  db.exec(`PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;
    CREATE TABLE IF NOT EXISTS partners (
      id TEXT PRIMARY KEY, code TEXT NOT NULL UNIQUE, name TEXT NOT NULL, email TEXT NOT NULL, phone TEXT NOT NULL,
      rate_bps INTEGER NOT NULL CHECK(rate_bps BETWEEN 1 AND 10000), basis TEXT NOT NULL, payout_details TEXT NOT NULL,
      active INTEGER NOT NULL DEFAULT 1, version INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS commissions (
      id TEXT PRIMARY KEY, partner_id TEXT NOT NULL REFERENCES partners(id), customer TEXT NOT NULL,
      reference TEXT NOT NULL, reference_key TEXT NOT NULL UNIQUE, inquiry_id TEXT NOT NULL DEFAULT '', base_minor INTEGER NOT NULL,
      currency TEXT NOT NULL, rate_bps INTEGER NOT NULL, basis TEXT NOT NULL, commission_minor INTEGER NOT NULL,
      notes TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'owed', payment_reference TEXT NOT NULL DEFAULT '', paid_at TEXT,
      version INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
    CREATE UNIQUE INDEX IF NOT EXISTS commission_inquiry ON commissions(inquiry_id) WHERE inquiry_id<>'' AND status<>'void';
    CREATE TABLE IF NOT EXISTS referral_audit (id TEXT PRIMARY KEY, actor TEXT NOT NULL, action TEXT NOT NULL, record_id TEXT NOT NULL, at TEXT NOT NULL, before_json TEXT, after_json TEXT);
  `);
  const all = (sql, ...args) => db.prepare(sql).all(...args), one = (sql, ...args) => db.prepare(sql).get(...args);
  const transaction = callback => { db.exec('BEGIN IMMEDIATE'); try { const result = callback(); db.exec('COMMIT'); return result; } catch (error) { db.exec('ROLLBACK'); throw error; } };
  function get(table, id) { const row = one(`SELECT * FROM ${table} WHERE id=?`, String(id || '')); if (!row) throw new PlatformError('This referral record was not found. Refresh the list.', 404); return row; }
  function version(row, value) { if (!Number.isInteger(value) || row.version !== value) throw new PlatformError('This record changed in another window. Refresh before saving.', 409); }
  function audit(actor, action, before, after) {
    db.prepare('INSERT INTO referral_audit VALUES (?, ?, ?, ?, ?, ?, ?)').run(randomUUID(), actor, action, after.id, new Date().toISOString(), before ? JSON.stringify(before) : null, JSON.stringify(after));
  }
  return {
    close() { db.close(); },
    partner(id) { return get('partners', id); },
    snapshot() {
      return transaction(() => ({ partners: all('SELECT * FROM partners ORDER BY created_at DESC, id'), commissions: all('SELECT * FROM commissions ORDER BY created_at DESC, id'),
        totals: all("SELECT currency, SUM(CASE WHEN status='owed' THEN commission_minor ELSE 0 END) AS owed, SUM(CASE WHEN status='paid' THEN commission_minor ELSE 0 END) AS paid FROM commissions GROUP BY currency ORDER BY currency") }));
    },
    backup() { return transaction(() => ({ schema_version: 1, exported_at: new Date().toISOString(), partners: all('SELECT * FROM partners'), commissions: all('SELECT * FROM commissions'), audit: all('SELECT * FROM referral_audit ORDER BY at, id') })); },
    savePartner(input, actor) { return transaction(() => {
      const before = input.id ? get('partners', input.id) : null;
      if (before) version(before, input.version);
      const values = validatePartner(input.record), now = new Date().toISOString();
      const after = { ...values, id: before?.id || randomUUID(), code: before?.code || `REF-${randomBytes(6).toString('hex').toUpperCase()}`, version: (before?.version || 0) + 1, created_at: before?.created_at || now, updated_at: now };
      db.prepare(`INSERT INTO partners (id,code,name,email,phone,rate_bps,basis,payout_details,active,version,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)
        ON CONFLICT(id) DO UPDATE SET name=excluded.name,email=excluded.email,phone=excluded.phone,rate_bps=excluded.rate_bps,basis=excluded.basis,payout_details=excluded.payout_details,active=excluded.active,version=excluded.version,updated_at=excluded.updated_at`)
        .run(after.id, after.code, after.name, after.email, after.phone, after.rate_bps, after.basis, after.payout_details, after.active, after.version, after.created_at, after.updated_at);
      audit(actor, 'partner.save', before, after); return after;
    }); },
    addCommission(input, actor) { return transaction(() => {
      const partner = get('partners', input.partner_id); version(partner, input.partner_version);
      if (!partner.active) throw new PlatformError('Reactivate this partner before recording a new commission.');
      const values = validateCommission(input.record), key = values.reference.toLowerCase().replace(/\s+/g, ' ');
      if (one('SELECT id FROM commissions WHERE reference_key=?', key)) throw new PlatformError('That payment reference already has a commission. Use its existing entry.', 409);
      if (values.inquiry_id && one("SELECT id FROM commissions WHERE inquiry_id=? AND status<>'void'", values.inquiry_id)) throw new PlatformError('This enquiry already has its first-payment commission.', 409);
      const now = new Date().toISOString(), after = { ...values, id: randomUUID(), partner_id: partner.id, rate_bps: partner.rate_bps, basis: referralBasis, commission_minor: commissionMinor(values.base_minor, partner.rate_bps), status: 'owed', created_at: now, updated_at: now, version: 1, payment_reference: '', paid_at: null };
      db.prepare('INSERT INTO commissions (id,partner_id,customer,reference,reference_key,inquiry_id,base_minor,currency,rate_bps,basis,commission_minor,notes,status,version,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)')
        .run(after.id, after.partner_id, after.customer, after.reference, key, after.inquiry_id, after.base_minor, after.currency, after.rate_bps, after.basis, after.commission_minor, after.notes, 'owed', 1, now, now);
      audit(actor, 'commission.create', null, after); return after;
    }); },
    settle(input, actor) { return transaction(() => {
      const before = get('commissions', input.id); version(before, input.version);
      if (before.status !== 'owed') throw new PlatformError('Only an owed commission can be marked paid or void.', 409);
      if (!['paid', 'void'].includes(input.status)) throw new PlatformError('Choose paid or void.');
      const payout = input.status === 'paid' ? validatePayout(input) : { payment_reference: '' }, now = new Date().toISOString();
      const after = { ...before, ...payout, status: input.status, paid_at: input.status === 'paid' ? now : null, version: before.version + 1, updated_at: now };
      db.prepare('UPDATE commissions SET status=?,payment_reference=?,paid_at=?,version=?,updated_at=? WHERE id=?').run(after.status, after.payment_reference, after.paid_at, after.version, now, after.id);
      audit(actor, `commission.${after.status}`, before, after); return after;
    }); },
  };
}
