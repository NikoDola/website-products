import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { openReferrals, referralPath, resolveReferral } from '../src/admin/server/referral-store.mjs';
import { referralSvg, referralOrigin } from '../src/admin/server/referral-assets.mjs';
import { referralInquiries, verifyReferralInquiry } from '../src/admin/server/referral-inquiries.mjs';
import { commissionMinor, percentageBps, moneyMinor, referralLink, validReferralCode, validatePartner } from '../src/shared/referrals.mjs';
import { openInbox } from '../src/shared/home-contact.mjs';
import { createHomeContactHandler } from '../src/shared/home-contact-handler.mjs';

const actor = 'test-owner', partnerValues = { name: 'Referral Test Person', email: 'person@example.test', phone: '', percentage: '12.50', basis: 'first-payment', payout_details: 'Test payment instructions', active: true };
const inquiryValues = { name: 'Referred Test Customer', email: 'customer@example.test', message: 'A website enquiry for isolated testing only.', service: 'website', locale: 'en' };
const req = body => new Request('http://127.0.0.1:3001/home/contact', { method: 'POST', headers: { host: '127.0.0.1:3001', origin: 'http://127.0.0.1:3001', accept: 'application/json', 'content-type': 'application/json' }, body: JSON.stringify(body) });
function fixture() {
  const directory = mkdtempSync(join(tmpdir(), 'referral-program-test-'));
  const path = join(directory, 'referrals.sqlite'), inboxPath = join(directory, 'inbox.sqlite');
  const env = { NODE_ENV: 'development', REFERRAL_DATA_PATH: path, HOME_INQUIRIES_DATA_PATH: inboxPath };
  const store = openReferrals(path);
  return { directory, path, inboxPath, env, store, close() { store.close(); assert.equal(dirname(directory), tmpdir()); rmSync(directory, { recursive: true, force: true }); } };
}
function createPartner(store, values = {}) { return store.savePartner({ record: { ...partnerValues, ...values } }, actor); }
function commission(partner, record = {}) { return { partner_id: partner.id, partner_version: partner.version, record: { customer: 'Test customer', amount: '100.01', currency: 'usd', reference: 'test-receipt-001', first_payment_confirmed: true, ...record } }; }

test('referral money rounds exactly and rejects invalid amounts and percentages', () => {
  assert.equal(moneyMinor('100.01'), 10001); assert.equal(percentageBps('12.50'), 1250);
  assert.equal(commissionMinor(10001, 1250), 1250); assert.equal(commissionMinor(1, 5000), 1);
  assert.equal(commissionMinor(99999999999, 10000), 99999999999);
  for (const value of ['-1', '0', 'Infinity', '1e2', '12.333', '100.01', '']) assert.throws(() => percentageBps(value));
  for (const value of ['0', '-1', '1e4', '1.001', '1000000000', '']) assert.throws(() => moneyMinor(value));
  assert.throws(() => validatePartner({ ...partnerValues, basis: 'toString' }));
});
test('partners receive unique permanent codes, protect versions, and preserve history', () => {
  const f = fixture();
  try {
    const first = createPartner(f.store), second = createPartner(f.store);
    assert.ok(validReferralCode(first.code)); assert.notEqual(first.code, second.code);
    assert.equal(resolveReferral(first.code.toLowerCase(), f.env).id, first.id);
    const updated = f.store.savePartner({ id: first.id, version: first.version, record: { ...partnerValues, name: 'Updated name', percentage: '20' } }, actor);
    assert.equal(updated.code, first.code); assert.equal(updated.version, 2);
    assert.throws(() => f.store.savePartner({ id: first.id, version: 1, record: partnerValues }, actor), /changed/);
    assert.equal(f.store.backup().audit.length, 3);
    const paused = f.store.savePartner({ id: first.id, version: 2, record: { ...partnerValues, active: false } }, actor);
    assert.equal(resolveReferral(first.code, f.env), null);
    assert.throws(() => f.store.addCommission(commission(paused), actor), /Reactivate/);
    assert.equal(resolveReferral('REF-000000000000', f.env), null);
  } finally { f.close(); }
});
test('commissions accept only the confirmed first website payment policy', () => {
  const f = fixture();
  try {
    for (const basis of ['project', 'maintenance']) assert.throws(() => createPartner(f.store, { basis }), /first website payment only/);
    const partner = createPartner(f.store);
    for (const first_payment_confirmed of [false, undefined, 'true']) assert.throws(() => f.store.addCommission(commission(partner, { first_payment_confirmed }), actor), /first website payment/);
    assert.equal(f.store.snapshot().commissions.length, 0);
    // A partner saved before the owner selected this policy must still use the new policy.
    const db = new DatabaseSync(f.path); try { db.prepare("UPDATE partners SET basis='maintenance' WHERE id=?").run(partner.id); } finally { db.close(); }
    const saved = f.store.addCommission(commission(partner), actor);
    assert.equal(saved.basis, 'first-payment');
    const entry = f.store.backup().audit.find(row => row.action === 'commission.create');
    assert.equal(JSON.parse(entry.after_json).first_payment_confirmed, true);
  } finally { f.close(); }
});
test('commissions snapshot the agreed rate, separate currencies and require deliberate payout evidence', () => {
  const f = fixture();
  try {
    const partner = createPartner(f.store), first = f.store.addCommission(commission(partner), actor);
    assert.equal(first.commission_minor, 1250); assert.equal(first.status, 'owed');
    const updated = f.store.savePartner({ id: partner.id, version: 1, record: { ...partnerValues, percentage: '20' } }, actor);
    assert.throws(() => f.store.addCommission(commission(partner, { reference: 'stale' }), actor), /changed/);
    f.store.addCommission(commission(updated, { reference: 'euro-receipt', amount: '200.00', currency: 'eur' }), actor);
    assert.equal(f.store.snapshot().commissions.find(row => row.id === first.id).rate_bps, 1250);
    assert.throws(() => f.store.settle({ id: first.id, version: 1, status: 'paid', payment_reference: '' }, actor), /Payout reference/i);
    assert.equal(f.store.backup().audit.length, 4);
    const paid = f.store.settle({ id: first.id, version: 1, status: 'paid', payment_reference: 'test-transfer' }, actor);
    assert.ok(paid.paid_at); assert.equal(paid.version, 2);
    assert.throws(() => f.store.settle({ id: first.id, version: 1, status: 'paid', payment_reference: 'repeat' }, actor), /changed/);
    assert.throws(() => f.store.settle({ id: first.id, version: 2, status: 'void' }, actor), /Only an owed/);
    assert.deepEqual(f.store.snapshot().totals.map(row => ({ ...row })), [{ currency: 'eur', owed: 4000, paid: 0 }, { currency: 'usd', owed: 0, paid: 1250 }]);
    const audit = f.store.backup().audit.find(row => row.action === 'commission.paid');
    assert.equal(JSON.parse(audit.before_json).status, 'owed'); assert.equal(JSON.parse(audit.after_json).payment_reference, 'test-transfer');
  } finally { f.close(); }
});
test('duplicate payment references and enquiry commissions roll back without double counting', () => {
  const f = fixture();
  try {
    const partner = createPartner(f.store), other = createPartner(f.store), first = f.store.addCommission(commission(partner, { reference: 'Receipt  ONE', inquiry_id: 'test-inquiry' }), actor);
    assert.throws(() => f.store.addCommission(commission(other, { reference: '  receipt one  ' }), actor), /already has/);
    assert.throws(() => f.store.addCommission(commission(partner, { reference: 'different-receipt', inquiry_id: 'test-inquiry' }), actor), /already has/);
    assert.equal(f.store.snapshot().commissions.length, 1);
    f.store.settle({ id: first.id, version: 1, status: 'void' }, actor);
    assert.equal(f.store.snapshot().totals[0].owed, 0);
    f.store.addCommission(commission(partner, { reference: 'corrected-receipt', inquiry_id: 'test-inquiry' }), actor);
    assert.equal(f.store.snapshot().totals[0].owed, 1250);
  } finally { f.close(); }
});
test('referral state persists across database connections and rejects stale writes', () => {
  const f = fixture(); let second;
  try {
    const partner = createPartner(f.store); second = openReferrals(f.path);
    assert.equal(second.snapshot().partners[0].code, partner.code);
    second.savePartner({ id: partner.id, version: 1, record: { ...partnerValues, percentage: '15' } }, actor);
    assert.throws(() => f.store.savePartner({ id: partner.id, version: 1, record: partnerValues }, actor), /changed/);
    assert.equal(f.store.snapshot().partners[0].rate_bps, 1500);
  } finally { second?.close(); f.close(); }
});
test('contact submissions resolve code server-side and save real partner attribution privately', async () => {
  const f = fixture();
  try {
    const partner = createPartner(f.store), other = createPartner(f.store);
    const handler = createHomeContactHandler({ env: f.env });
    const body = { ...inquiryValues, referral_code: partner.code.toLowerCase(), referral_partner_id: other.id, referral_name: 'Forged name' };
    const response = await handler(req(body));
    assert.equal(response.status, 201); assert.deepEqual(await response.json(), { received: true });
    const [saved] = referralInquiries(f.env);
    assert.equal(saved.referral_partner_id, partner.id); assert.equal(saved.referral_name, partner.name); assert.equal(saved.referral_code, partner.code);
    assert.equal(f.store.snapshot().commissions.length, 0);
    assert.doesNotThrow(() => verifyReferralInquiry(saved.id, partner.id, f.env));
    assert.throws(() => verifyReferralInquiry(saved.id, other.id, f.env), /does not belong/);
    assert.throws(() => verifyReferralInquiry('made-up-id', partner.id, f.env), /does not belong/);
    assert.equal((await handler(req({ ...inquiryValues, referral_code: 'REF-000000000000' }))).status, 400);
    f.store.savePartner({ id: partner.id, version: 1, record: { ...partnerValues, active: false } }, actor);
    assert.equal((await handler(req(body))).status, 400);
    assert.equal(referralInquiries(f.env).length, 1);
  } finally { f.close(); }
});
test('native form keeps referral codes after feedback and errors fail closed', async () => {
  const f = fixture();
  try {
    const partner = createPartner(f.store), handler = createHomeContactHandler({ env: f.env });
    const request = new Request('http://127.0.0.1:3001/home/contact', { method: 'POST', headers: { host: '127.0.0.1:3001', origin: 'http://127.0.0.1:3001', 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ ...inquiryValues, referral_code: partner.code }) });
    assert.equal((await handler(request)).headers.get('location'), `/home/en?sent=1&ref=${partner.code}#contact`);
    const failing = createHomeContactHandler({ env: f.env, resolveCode() { throw new Error('storage failure'); } });
    assert.equal((await failing(req({ ...inquiryValues, referral_code: partner.code }))).status, 503);
    assert.equal(referralInquiries(f.env).length, 1);
  } finally { f.close(); }
});
test('legacy inbox migration keeps prior messages and consent, without inventing attribution', () => {
  const f = fixture();
  try {
    const db = new DatabaseSync(f.inboxPath);
    db.exec("CREATE TABLE inquiries (id TEXT PRIMARY KEY, created_at TEXT NOT NULL, name TEXT NOT NULL, email TEXT NOT NULL, service TEXT NOT NULL, message TEXT NOT NULL, locale TEXT NOT NULL, consent_at TEXT NOT NULL); INSERT INTO inquiries VALUES ('legacy','2026-01-01','Old person','old@example.test','website','Previous message','en','legacy-consent');"); db.close();
    let inbox = openInbox(f.inboxPath);
    try { const [row] = inbox.list(); assert.equal(row.message, 'Previous message'); assert.equal(row.consent_at, 'legacy-consent'); assert.equal(row.referral_code, ''); } finally { inbox.close(); }
    inbox = openInbox(f.inboxPath); inbox.close();
    assert.deepEqual(referralInquiries(f.env), []);
  } finally { f.close(); }
});
test('hosting requires persistent storage and QR links use a trusted configured origin', () => {
  assert.throws(() => referralPath({ NODE_ENV: 'production' }), /persistent/);
  assert.throws(() => referralPath({ NODE_ENV: 'production', REFERRAL_DATA_PATH: 'relative.sqlite' }), /persistent/);
  assert.throws(() => referralPath({ VERCEL: '1', REFERRAL_DATA_PATH: join(tmpdir(), 'not-supported.sqlite') }), /persistent/);
  const local = new Request('http://127.0.0.1:3001/api/referrals');
  assert.equal(referralOrigin(local, { NODE_ENV: 'development' }).local, true);
  assert.throws(() => referralOrigin(local, { NODE_ENV: 'production' }), /HOME_PUBLIC_ORIGIN/);
  assert.throws(() => referralOrigin(new Request('https://attacker.example/api/referrals'), {}), /HOME_PUBLIC_ORIGIN/);
  assert.equal(referralOrigin(local, { HOME_PUBLIC_ORIGIN: 'https://studio.example' }).origin, 'https://studio.example');
  for (const origin of ['https://studio.example/path', 'https://studio.example/', 'https://user:pass@studio.example', 'http://studio.example']) assert.throws(() => referralOrigin(local, { HOME_PUBLIC_ORIGIN: origin }));
});
test('printable SVGs contain only public identity, safe escaped text and the real referral link', async () => {
  const partner = { name: 'Test <Person> & "Friend"', code: 'REF-A123456789BC', payout_details: 'PRIVATE-PAYOUT-INSTRUCTIONS' };
  for (const flyer of [true, false]) {
    const svg = await referralSvg(partner, 'https://studio.example', flyer);
    assert.match(svg, /Test &lt;Person&gt; &amp; &quot;Friend&quot;/);
    assert.ok(svg.includes(referralLink('https://studio.example', partner.code)));
    assert.ok(!svg.includes('PRIVATE-PAYOUT-INSTRUCTIONS')); assert.ok(!svg.includes('<script'));
    assert.match(svg, /shape-rendering="crispEdges"/);
  }
});
test('resolving a referral never creates storage for an unknown or missing program', () => {
  const path = join(tmpdir(), `missing-referral-test-${Date.now()}.sqlite`);
  assert.equal(resolveReferral('REF-000000000000', { NODE_ENV: 'development', REFERRAL_DATA_PATH: path }), null);
  assert.equal(existsSync(path), false);
});
