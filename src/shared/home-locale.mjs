export function resolveLocale({ url, cookie = '', country = '', acceptLanguage = '' }) {
  const pathname = new URL(url).pathname;
  if (/^\/home\/mk\/?$/.test(pathname)) return 'mk';
  if (/^\/home\/en\/?$/.test(pathname)) return 'en';
  const saved = cookie.match(/(?:^|;\s*)site_language=(mk|en)(?:;|$)/)?.[1];
  if (saved) return saved;
  if (/^[A-Z]{2}$/.test(country) && !['XX', 'T1'].includes(country)) return country === 'MK' ? 'mk' : 'en';
  const languages = acceptLanguage.split(',').map((part) => {
    const [tag, ...params] = part.trim().toLowerCase().split(';');
    const q = params.find((item) => item.trim().startsWith('q='));
    return { tag, q: q ? Number(q.trim().slice(2)) : 1 };
  }).filter(({ q }) => Number.isFinite(q) && q > 0).sort((a, b) => b.q - a.q);
  return languages[0]?.tag.split('-')[0] === 'mk' ? 'mk' : 'en';
}

export function homeLocaleFromHeaders(headers, explicit, env = process.env) {
  const header = env.HOME_COUNTRY_HEADER || 'cf-ipcountry';
  const trusted = env.HOME_TRUST_COUNTRY_HEADER === 'true' && ['cf-ipcountry', 'x-vercel-ip-country'].includes(header);
  const country = env.NODE_ENV !== 'production' && env.HOME_DEV_COUNTRY
    ? env.HOME_DEV_COUNTRY : trusted ? headers.get(header) || '' : '';
  return resolveLocale({
    url: `http://localhost/home${explicit ? `/${explicit}` : ''}`,
    country,
    cookie: headers.get('cookie') || '',
    acceptLanguage: headers.get('accept-language') || '',
  });
}
