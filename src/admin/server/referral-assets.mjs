import QRCode from 'qrcode';
import { PlatformError, publicUrl } from '../../shared/entities.mjs';
import { localAccess } from '../../shared/security.mjs';
import { referralLink } from '../../shared/referrals.mjs';

export function referralOrigin(request, env = process.env) {
  if (env.HOME_PUBLIC_ORIGIN) {
    const url = new URL(publicUrl(env.HOME_PUBLIC_ORIGIN));
    if (url.origin !== env.HOME_PUBLIC_ORIGIN) throw new PlatformError('HOME_PUBLIC_ORIGIN must be an HTTPS origin without a path or trailing slash.', 503);
    return { origin: url.origin, local: false };
  }
  const url = new URL(request.url), host = request.headers.get('host') || url.host;
  if (url.protocol === 'http:' && url.host === host && localAccess(host, env)) return { origin: url.origin, local: true };
  throw new PlatformError('Configure HOME_PUBLIC_ORIGIN with your public HTTPS website address before generating referral links.', 503);
}
const escape = value => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }[char]));
function lines(value, max = 32) {
  const result = []; let line = '';
  for (const word of value.split(/\s+/)) {
    if (line && (line + ' ' + word).length > max) { result.push(line); line = ''; }
    // Long unbroken names must also fit inside the printable width.
    let rest = word;
    while (rest.length > max) { if (line) { result.push(line); line = ''; } result.push(rest.slice(0, max)); rest = rest.slice(max); }
    line += (line ? ' ' : '') + rest;
  }
  if (line) result.push(line);
  return result;
}
export async function referralSvg(partner, origin, flyer = false) {
  const link = referralLink(origin, partner.code);
  const { modules } = QRCode.create(link, { errorCorrectionLevel: 'Q' });
  const size = modules.size + 8, path = [];
  for (let row = 0; row < modules.size; row++) for (let col = 0; col < modules.size; col++) {
    if (modules.data[row * modules.size + col]) path.push(`M${col + 4} ${row + 4}h1v1h-1z`);
  }
  // Flatten the QR into one transformed group. Some print/PDF importers ignore
  // the position of a nested SVG viewport. Four white modules form the quiet zone.
  const inner = `<g transform="translate(${flyer ? 230 : 80} ${flyer ? 390 : 20}) scale(${440 / size})" shape-rendering="crispEdges"><path fill="#fff" d="M0 0h${size}v${size}H0z"/><path fill="#10291f" d="${path.join('')}"/></g>`;
  const nameLines = lines(partner.name);
  if (!flyer) return `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="760" viewBox="0 0 600 760" role="img" aria-labelledby="title desc">
    <title id="title">${escape(partner.name)} — enigma referral</title><desc id="desc">Referral code ${escape(partner.code)}. Scan to visit ${escape(link)}.</desc>
    <rect width="600" height="760" fill="#fff"/>${inner}<g fill="#203e35" font-family="Arial, sans-serif" text-anchor="middle">
    <text x="300" y="500" font-size="22">Referred by</text>
    ${nameLines.map((line, i) => `<text x="300" y="${540 + i * 28}" font-size="25" font-weight="700">${escape(line)}</text>`).join('')}
    <text x="300" y="${575 + nameLines.length * 28}" font-size="22" letter-spacing="1">${escape(partner.code)}</text>
    <text x="300" y="730" font-size="${origin.length > 45 ? 11 : 17}">${escape(origin)}</text></g></svg>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="900" height="1200" viewBox="0 0 900 1200" role="img" aria-labelledby="title desc">
    <title id="title">${escape(partner.name)} — enigma referral</title><desc id="desc">Referral code ${escape(partner.code)}. Scan to visit ${escape(link)}.</desc>
    <rect width="900" height="1200" fill="#f8f8f3"/><rect x="28" y="28" width="844" height="1144" rx="14" fill="none" stroke="#cdd8cf"/>
    ${inner}
    <g fill="#203e35" font-family="Arial, sans-serif" text-anchor="middle">
    <text x="450" y="115" font-size="48" font-weight="700">enigma.</text>
    <text x="450" y="225" font-size="48" font-weight="700">A website for your</text>
    <text x="450" y="287" font-size="48" font-weight="700">next chapter.</text>
    <text x="450" y="345" font-size="22">Websites · Redesigns · Branding · Maintenance</text>
    <text x="450" y="875" font-size="22">Referred by</text>
    ${nameLines.map((line, i) => `<text x="450" y="${920 + i * 33}" font-size="28" font-weight="700">${escape(line)}</text>`).join('')}
    <text x="450" y="${955 + nameLines.length * 33}" font-size="25" letter-spacing="2">${escape(partner.code)}</text>
    <text x="450" y="1130" font-size="${origin.length > 45 ? 14 : 20}">${escape(origin)}</text></g></svg>`;
}
