import { createHash } from 'node:crypto';
import { localAccess, readLimited } from './security.mjs';
import { validateInquiry, openInbox, inboxPath, createRateLimiter } from './home-contact.mjs';
import { resolveReferral } from '../admin/server/referral-store.mjs';
import { referralCode, validReferralCode } from './referrals.mjs';

export function homeContactOriginAllowed(request, env = process.env) {
  const origin = request.headers.get('origin');
  if (!origin || request.headers.get('sec-fetch-site') === 'cross-site') return false;
  const host = request.headers.get('host') || new URL(request.url).host;
  if (localAccess(host, env)) return origin === `http://${host}`;
  try {
    const expected = new URL(env.HOME_PUBLIC_ORIGIN || '');
    return expected.protocol === 'https:' && expected.origin === env.HOME_PUBLIC_ORIGIN && origin === expected.origin && host === expected.host;
  } catch { return false; }
}

export function createHomeContactHandler({ env = process.env, save, allowRequest = createRateLimiter(), resolveCode = value => resolveReferral(value, env) } = {}) {
  return async (request) => {
    const json = request.headers.get('accept')?.includes('application/json');
    let submittedReferral = '';
    const result = (status, code, locale = 'en') => {
      const headers = { 'Cache-Control': 'private, no-store', ...(status === 429 ? { 'Retry-After': '900' } : {}) };
      if (json) return Response.json(status === 201 ? { received: true } : { error: code }, { status, headers });
      // A native form submission returns to the React page for translated feedback.
      return new Response(null, { status: 303, headers: { ...headers, Location: `/home/${locale}?${status === 201 ? 'sent=1' : `error=${code}`}${submittedReferral ? `&ref=${encodeURIComponent(submittedReferral)}` : ''}#contact` } });
    };
    if (!homeContactOriginAllowed(request, env)) return result(403, 'origin');
    const trusted = env.HOME_TRUST_COUNTRY_HEADER === 'true' && ['cf-ipcountry', 'x-vercel-ip-country'].includes(env.HOME_COUNTRY_HEADER || 'cf-ipcountry');
    // In local development all loopback requests share a bucket. Never trust an arbitrary forwarded IP.
    const ip = trusted ? request.headers.get(env.HOME_COUNTRY_HEADER === 'x-vercel-ip-country' ? 'x-real-ip' : 'cf-connecting-ip') : null;
    const key = createHash('sha256').update(ip || 'unproxied-local').digest('hex');
    if (!allowRequest(key)) return result(429, 'rate');
    const type = request.headers.get('content-type')?.split(';')[0];
    if (!['application/json', 'application/x-www-form-urlencoded'].includes(type)) return result(415, 'invalid');
    let body;
    try {
      const raw = await readLimited(request, 24_000);
      body = type === 'application/json' ? JSON.parse(raw) : Object.fromEntries(new URLSearchParams(raw));
    } catch (error) { return result(error.status === 413 ? 413 : 400, 'invalid'); }
    const locale = body?.locale === 'mk' ? 'mk' : 'en';
    const code = referralCode(body?.referral_code);
    if (validReferralCode(code)) submittedReferral = code;
    const validated = validateInquiry(body);
    if (validated.error) return result(400, 'invalid', locale);
    try {
      if (!validated.spam) {
        if (validated.inquiry.referral_code) {
          const partner = await resolveCode(validated.inquiry.referral_code);
          if (!partner) return result(400, 'referral', locale);
          validated.inquiry.referral_partner_id = partner.id;
          validated.inquiry.referral_name = partner.name;
        }
        if (save) await save(validated.inquiry);
        else {
          const inbox = openInbox(inboxPath(env));
          try { inbox.save(validated.inquiry); } finally { inbox.close(); }
        }
      }
      return result(201, '', locale);
    } catch {
      return result(503, 'unavailable', locale);
    }
  };
}
