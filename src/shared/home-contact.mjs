import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname, isAbsolute } from 'node:path';
import { randomUUID } from 'node:crypto';
import { serviceIds } from '../website/content.mjs';
import { privateDataPath } from './server/paths.mjs';
import { referralCode, validReferralCode } from './referrals.mjs';

export function validateInquiry(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return { error: 'invalid' };
  if (typeof value.company_url === 'string' && value.company_url.trim()) return { spam: true };
  const text = (key) => typeof value[key] === 'string' ? value[key].trim() : '';
  const inquiry = { name: text('name'), email: text('email'), service: text('service'), message: text('message'), locale: value.locale === 'mk' ? 'mk' : 'en' };
  if (inquiry.name.length < 2 || inquiry.name.length > 120 || /[\x00-\x1f\x7f]/.test(inquiry.name)) return { error: 'invalid' };
  if (inquiry.email.length > 254 || !/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(inquiry.email)) return { error: 'invalid' };
  if (!serviceIds.includes(inquiry.service) || inquiry.message.length < 10 || inquiry.message.length > 5000 || /[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/.test(inquiry.message)) return { error: 'invalid' };
  if (value.referral_code !== undefined && typeof value.referral_code !== 'string') return { error: 'invalid' };
  const code = referralCode(value.referral_code);
  if (code && !validReferralCode(code)) return { error: 'invalid' };
  return { inquiry: { ...inquiry, referral_code: code } };
}

export function inboxPath(env = process.env) {
  if ((env.NODE_ENV === 'production' || env.VERCEL) && (!env.HOME_INQUIRIES_DATA_PATH || !isAbsolute(env.HOME_INQUIRIES_DATA_PATH))) {
    throw new Error('Configure HOME_INQUIRIES_DATA_PATH on a persistent Node filesystem before hosting the contact form.');
  }
  return env.HOME_INQUIRIES_DATA_PATH || privateDataPath('home-inquiries.sqlite');
}

export function openInbox(path = inboxPath()) {
  if (!isAbsolute(path)) throw new Error('HOME_INQUIRIES_DATA_PATH must be an absolute path on a persistent disk.');
  mkdirSync(dirname(path), { recursive: true });
  const database = new DatabaseSync(path);
  database.exec('PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 5000; CREATE TABLE IF NOT EXISTS inquiries (id TEXT PRIMARY KEY, created_at TEXT NOT NULL, name TEXT NOT NULL, email TEXT NOT NULL, service TEXT NOT NULL, message TEXT NOT NULL, locale TEXT NOT NULL, consent_at TEXT NOT NULL);');
  database.exec('BEGIN IMMEDIATE');
  try {
    const columns = new Set(database.prepare('PRAGMA table_info(inquiries)').all().map(row => row.name));
    for (const column of ['referral_code', 'referral_partner_id', 'referral_name']) if (!columns.has(column)) database.exec(`ALTER TABLE inquiries ADD COLUMN ${column} TEXT NOT NULL DEFAULT ''`);
    database.exec('COMMIT');
  } catch (error) { database.exec('ROLLBACK'); database.close(); throw error; }
  return {
    save(inquiry) {
      const id = randomUUID();
      const now = new Date().toISOString();
      // Retain the legacy column/history without recording consent that was not asked for.
      database.prepare('INSERT INTO inquiries (id, created_at, name, email, service, message, locale, consent_at, referral_code, referral_partner_id, referral_name) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').run(id, now, inquiry.name, inquiry.email, inquiry.service, inquiry.message, inquiry.locale, '', inquiry.referral_code || '', inquiry.referral_partner_id || '', inquiry.referral_name || '');
      return id;
    },
    list() { return database.prepare('SELECT * FROM inquiries ORDER BY created_at DESC').all(); },
    close() { database.close(); },
  };
}

export function createRateLimiter({ limit = 5, windowMs = 15 * 60_000, maxKeys = 10_000 } = {}) {
  const entries = new Map();
  return (key, now = Date.now()) => {
    // Keep request metadata in memory only and expire it promptly.
    for (const [id, item] of entries) if (item.expires <= now) entries.delete(id);
    let item = entries.get(key);
    if (!item) {
      if (entries.size >= maxKeys) return false;
      item = { count: 0, expires: now + windowMs };
      entries.set(key, item);
    }
    return ++item.count <= limit;
  };
}
