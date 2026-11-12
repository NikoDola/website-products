import { PlatformError } from './entities.mjs';

export const referralBases = {
  'first-payment': 'First website payment',
  project: 'Website project payments',
  maintenance: 'Recurring maintenance payments',
};
// Older basis labels remain readable in history; every new commission uses this policy.
export const referralBasis = 'first-payment';
export function referralCode(value) {
  return typeof value === 'string' ? value.trim().toUpperCase() : '';
}
export function validReferralCode(value) { return /^REF-[A-F0-9]{12}$/.test(value); }
function text(value, label, max = 200, required = false) {
  if (value !== undefined && typeof value !== 'string') throw new PlatformError(`${label} must be text.`);
  const out = (value || '').trim();
  if (out.length > max || /[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/.test(out) || required && !out) throw new PlatformError(`Enter ${label.toLowerCase()} (up to ${max} characters).`);
  return out;
}
export function percentageBps(value) {
  const raw = String(value ?? '').trim();
  if (!/^\d{1,3}(\.\d{1,2})?$/.test(raw)) throw new PlatformError('Enter a commission percentage between 0.01 and 100, with up to two decimal places.');
  const rate = Math.round(Number(raw) * 100);
  if (rate < 1 || rate > 10000) throw new PlatformError('Commission must be between 0.01% and 100%.');
  return rate;
}
export function validatePartner(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new PlatformError('Enter referral partner details.');
  const name = text(input.name, "Person's name", 120, true), email = text(input.email, 'Email', 254);
  if (/[\r\n\t]/.test(name)) throw new PlatformError('Enter the name on one line.');
  if (email && !/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(email)) throw new PlatformError('Enter a valid email address.');
  if (input.basis !== referralBasis) throw new PlatformError('Referral commissions apply to the first website payment only.');
  if (input.active !== undefined && typeof input.active !== 'boolean') throw new PlatformError('Choose a valid partner status.');
  return { name, email, phone: text(input.phone, 'Phone', 80), rate_bps: percentageBps(input.percentage), basis: input.basis,
    payout_details: text(input.payout_details, 'Payment instructions', 2000), active: input.active === false ? 0 : 1 };
}
// Supported currencies use two decimal places. Store and calculate integer minor units.
export const referralCurrencies = ['usd', 'eur', 'gbp', 'mkd'];
export function moneyMinor(value) {
  const raw = String(value ?? '').trim();
  if (!/^\d{1,9}(\.\d{1,2})?$/.test(raw)) throw new PlatformError('Enter a positive amount with up to two decimal places.');
  const [whole, fraction = ''] = raw.split('.');
  const minor = Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
  if (!Number.isSafeInteger(minor) || minor < 1) throw new PlatformError('Enter a positive amount.');
  return minor;
}
export function commissionMinor(base, rate) {
  if (!Number.isSafeInteger(base) || base < 1 || base > 99999999999 || !Number.isInteger(rate) || rate < 1 || rate > 10000) throw new PlatformError('Invalid commission amount or rate.');
  // Integer half-up rounding avoids floating-point money errors.
  return Number((BigInt(base) * BigInt(rate) + 5000n) / 10000n);
}
export function validateCommission(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new PlatformError('Enter the qualifying payment.');
  if (input.first_payment_confirmed !== true) throw new PlatformError('Confirm that this is the referred customer’s first website payment.');
  const currency = text(input.currency, 'Currency', 3).toLowerCase();
  if (!referralCurrencies.includes(currency)) throw new PlatformError('Choose USD, EUR, GBP or MKD.');
  return { customer: text(input.customer, 'Referred customer', 160, true), reference: text(input.reference, 'Qualifying payment reference', 200, true),
    base_minor: moneyMinor(input.amount), currency, notes: text(input.notes, 'Notes', 2000), inquiry_id: text(input.inquiry_id, 'Enquiry ID', 100), first_payment_confirmed: true };
}
export function validatePayout(input) {
  return { payment_reference: text(input.payment_reference, 'Payout reference', 200, true) };
}
export function referralLink(origin, code) {
  if (!validReferralCode(code)) throw new PlatformError('Invalid referral code.');
  return `${origin}/home?ref=${encodeURIComponent(code)}#contact`;
}
