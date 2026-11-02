import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { resolveLocale, homeLocaleFromHeaders } from '../src/shared/home-locale.mjs';
import { validateInquiry, openInbox, inboxPath, createRateLimiter } from '../src/shared/home-contact.mjs';
import { createHomeContactHandler, homeContactOriginAllowed } from '../src/shared/home-contact-handler.mjs';

const env = { NODE_ENV: 'development' };
const baseLocale = { url: 'http://localhost:3001/home' };
const valid = { name: 'Test person', email: 'person@example.test', service: 'website', message: 'A sample enquiry used only in a temporary test database.', locale: 'mk', company_url: '' };
function request(body, options = {}) {
  return new Request('http://127.0.0.1:3001/home/contact', {
    method: 'POST',
    headers: { host: '127.0.0.1:3001', origin: 'http://127.0.0.1:3001', 'content-type': 'application/json', accept: 'application/json', ...options.headers },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
}

test('home country selection and explicit Next.js language routes', () => {
  assert.equal(resolveLocale({ ...baseLocale, country: 'MK', acceptLanguage: 'en-US,en;q=0.9' }), 'mk');
  assert.equal(resolveLocale({ ...baseLocale, country: 'DE', acceptLanguage: 'mk' }), 'en');
  assert.equal(resolveLocale({ ...baseLocale, cookie: 'other=1; site_language=en', country: 'MK' }), 'en');
  assert.equal(resolveLocale({ ...baseLocale, url: 'http://localhost:3001/home/mk', cookie: 'site_language=en', country: 'US' }), 'mk');
});
test('home browser language fallback respects quality and missing country', () => {
  assert.equal(resolveLocale({ ...baseLocale, country: 'XX', acceptLanguage: 'mk-MK,en;q=0.8' }), 'mk');
  assert.equal(resolveLocale({ ...baseLocale, acceptLanguage: 'mk;q=0.2,en;q=0.9' }), 'en');
  assert.equal(resolveLocale({ ...baseLocale, acceptLanguage: 'mk;q=0,en;q=0.5' }), 'en');
});
test('home ignores country spoofing unless a trusted hosting header is configured', () => {
  const headers = new Headers({ 'cf-ipcountry': 'MK', 'accept-language': 'en' });
  assert.equal(homeLocaleFromHeaders(headers, undefined, env), 'en');
  assert.equal(homeLocaleFromHeaders(headers, undefined, { ...env, HOME_TRUST_COUNTRY_HEADER: 'true' }), 'mk');
  assert.equal(homeLocaleFromHeaders(headers, 'en', { ...env, HOME_TRUST_COUNTRY_HEADER: 'true' }), 'en');
  assert.equal(homeLocaleFromHeaders(headers, undefined, { ...env, HOME_DEV_COUNTRY: 'MK' }), 'mk');
  assert.equal(homeLocaleFromHeaders(headers, undefined, { NODE_ENV: 'production', HOME_DEV_COUNTRY: 'MK' }), 'en');
});
test('home inquiry validation accepts an enquiry without a consent checkbox and requires valid fields', () => {
  assert.ok(validateInquiry(valid).inquiry);
  for (const bad of [{ ...valid, email: 'wrong' }, { ...valid, message: 'short' }, { ...valid, service: 'unknown' }, { ...valid, name: 'x'.repeat(121) }, null, []]) assert.equal(validateInquiry(bad).error, 'invalid');
  assert.deepEqual(validateInquiry({ ...valid, company_url: 'https://spam.test' }), { spam: true });
});
test('home private inbox survives reopening without inventing checkbox consent', () => {
  const directory = mkdtempSync(join(tmpdir(), 'website-home-inbox-'));
  try {
    const path = join(directory, 'test.sqlite');
    let inbox = openInbox(path);
    const id = inbox.save(validateInquiry(valid).inquiry);
    inbox.close();
    inbox = openInbox(path);
    try {
      const [saved] = inbox.list();
      assert.equal(saved.id, id);
      assert.equal(saved.email, valid.email);
      assert.equal(saved.locale, 'mk');
      assert.ok(saved.created_at);
      assert.equal(saved.consent_at, '');
    } finally { inbox.close(); }
  } finally { rmSync(directory, { recursive: true, force: true }); }
});
test('home inbox requires an explicit persistent production path', () => {
  assert.throws(() => inboxPath({ NODE_ENV: 'production' }), /persistent/);
  assert.throws(() => inboxPath({ NODE_ENV: 'production', HOME_INQUIRIES_DATA_PATH: 'relative.sqlite' }), /persistent/);
  assert.ok(inboxPath(env).endsWith('home-inquiries.sqlite'));
});
test('home rate limits separate visitors and expire', () => {
  const allow = createRateLimiter({ limit: 2, windowMs: 100 });
  assert.equal(allow('a', 0), true);
  assert.equal(allow('a', 1), true);
  assert.equal(allow('a', 2), false);
  assert.equal(allow('b', 2), true);
  assert.equal(allow('a', 101), true);
});
test('home contact enforces local and production origins without changing admin auth', () => {
  assert.equal(homeContactOriginAllowed(request(valid), env), true);
  assert.equal(homeContactOriginAllowed(request(valid, { headers: { origin: 'http://localhost:3001' } }), env), false);
  assert.equal(homeContactOriginAllowed(request(valid, { headers: { origin: 'https://attacker.example' } }), env), false);
  assert.equal(homeContactOriginAllowed(request(valid), { NODE_ENV: 'production' }), false);
  const production = new Request('https://studio.example/home/contact', { method: 'POST', headers: { host: 'studio.example', origin: 'https://studio.example' } });
  assert.equal(homeContactOriginAllowed(production, { NODE_ENV: 'production', HOME_PUBLIC_ORIGIN: 'https://studio.example' }), true);
});
test('home Next.js contact handler validates and saves without touching real records', async () => {
  const saved = [];
  const handler = createHomeContactHandler({ env, save: (value) => saved.push(value) });
  assert.equal((await handler(request(valid, { headers: { origin: 'https://other.example' } }))).status, 403);
  assert.equal((await handler(request('{broken'))).status, 400);
  assert.equal((await handler(request({ ...valid, email: '' }))).status, 400);
  assert.equal((await handler(request(valid))).status, 201);
  assert.equal(saved.length, 1);
  assert.equal(saved[0].email, valid.email);
  assert.equal((await handler(request({ ...valid, company_url: 'spam' }))).status, 201);
  assert.equal(saved.length, 1);
});
test('home native form redirects back to its translated Next.js page', async () => {
  const saved = [];
  const handler = createHomeContactHandler({ env, save: (value) => saved.push(value) });
  const response = await handler(request(new URLSearchParams(valid).toString(), { headers: { 'content-type': 'application/x-www-form-urlencoded', accept: 'text/html' } }));
  assert.equal(response.status, 303);
  assert.equal(response.headers.get('location'), '/home/mk?sent=1#contact');
  assert.equal(saved.length, 1);
});
test('home handler rejects large bodies and repeated requests', async () => {
  const handler = createHomeContactHandler({ env, save: () => {} });
  assert.equal((await handler(request({ ...valid, message: 'a'.repeat(25_000) }))).status, 413);
  for (let i = 0; i < 4; i++) assert.equal((await handler(request(valid))).status, 201);
  assert.equal((await handler(request(valid))).status, 429);
});
test('home handler never reports success when persistence fails', async () => {
  const handler = createHomeContactHandler({ env, save: () => { throw new Error('storage unavailable'); } });
  assert.equal((await handler(request(valid))).status, 503);
});
