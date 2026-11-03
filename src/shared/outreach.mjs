import { PlatformError } from './entities.mjs';

export const emailPattern = /^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)+$/i;
export function email(value) {
  const result = String(value || '').trim().toLowerCase();
  if (result.length > 254 || !emailPattern.test(result)) throw new PlatformError('Enter one valid email address.');
  return result;
}
export function text(value, max, label, required = false) {
  if (value !== undefined && typeof value !== 'string') throw new PlatformError(`Invalid ${label}.`);
  const result = (value || '').trim();
  if (result.length > max || /\0/.test(result) || required && !result) throw new PlatformError(`Enter ${label}${required ? '' : ' or leave it empty'} (maximum ${max} characters).`);
  return result;
}
export function webUrl(value, instagram = false) {
  if (!value) return '';
  try {
    const url = new URL(String(value).trim());
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.href.length > 2000) throw Error();
    if (instagram && !['instagram.com', 'www.instagram.com'].includes(url.hostname.toLowerCase())) throw Error();
    return url.href;
  } catch { throw new PlatformError(`Enter a valid ${instagram ? 'Instagram' : 'HTTP(S) website'} URL.`); }
}
export function splitPastedEmail(value) {
  const first = String(value).match(/^\s*\*\*([^\r\n]+)\*\*[ \t]*(?:\r?\n|$)([\s\S]*)$/);
  if (!first) return null;
  const parameter = first[1].trim();
  if (emailPattern.test(parameter)) {
    const caption = first[2].match(/^\s*\*\*([^\r\n]+)\*\*[ \t]*(?:\r?\n|$)([\s\S]*)$/);
    return caption ? { recipient: email(parameter), subject: caption[1].trim(), body: caption[2].trimStart() } : null;
  }
  // An invalid address parameter must not silently become the Subject.
  if (parameter.includes('@')) return null;
  return { subject: parameter, body: first[2].trimStart() };
}
export function validateDraft(input, complete = false) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new PlatformError('Enter an email draft.');
  const subject = text(input.subject, 500, 'a subject', complete);
  if (/[\r\n]/.test(subject)) throw new PlatformError('The subject must be a single line.');
  return { account_id: text(input.account_id ?? '', 100, 'a sending account', complete), recipient: input.recipient ? email(input.recipient) : complete ? email('') : '',
    subject, body: text(input.body, 50000, 'an email body', complete), company: text(input.company, 300, 'company name'),
    website: webUrl(input.website), instagram: webUrl(input.instagram, true) };
}
export function escapeHtml(value) { return String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]); }
function inline(value) {
  // Escape all raw HTML first. Only fixed tags and validated HTTP(S) links can be emitted.
  const tokens = [];
  const stash = html => { tokens.push(html); return `\u0001${tokens.length - 1}\u0001`; };
  let safe = escapeHtml(value).replace(/`([^`]+)`/g, (_, code) => stash(`<code>${code}</code>`));
  safe = safe.replace(/\[([^\]\n]+)\]\((https?:\/\/[^\s<>]+)\)/g, (whole, label, href) => {
    try { const decoded = href.replaceAll('&amp;', '&').replaceAll('&#39;', "'").replaceAll('&quot;', '"'); return stash(`<a href="${escapeHtml(webUrl(decoded))}" rel="noreferrer">${label}</a>`); } catch { return whole; }
  });
  safe = safe.replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>').replace(/\*([^*\n]+)\*/g, '<em>$1</em>');
  return safe.replace(/\u0001(\d+)\u0001/g, (_, i) => tokens[Number(i)] || '');
}
export function markdownHtml(body) {
  // Basic Markdown, intentionally without images, embedded HTML or remote assets.
  const blocks = String(body || '').replace(/[\u0000\u0001]/g, '').replaceAll('\r\n', '\n').split(/\n\s*\n/);
  return blocks.filter(Boolean).map(block => {
    const lines = block.split('\n');
    if (lines.every(line => /^[-*] /.test(line))) return `<ul>${lines.map(line => `<li>${inline(line.slice(2))}</li>`).join('')}</ul>`;
    if (lines.every(line => /^\d+\. /.test(line))) return `<ol>${lines.map(line => `<li>${inline(line.replace(/^\d+\. /, ''))}</li>`).join('')}</ol>`;
    if (lines.length === 1 && /^#{1,3} /.test(block)) return `<h3>${inline(block.replace(/^#{1,3} /, ''))}</h3>`;
    return `<p>${lines.map(inline).join('<br>')}</p>`;
  }).join('\n');
}
export const placementLabels = { unknown: 'Unknown delivery placement', inbox: 'Inbox — verified test account', spam: 'Spam — verified test account' };
export const gmailConnectionMessages = {
  failed: 'Gmail connection could not be completed. Start a fresh connection and try again.',
  session: 'This Gmail connection expired or was already used. Click Connect again and complete one connection at a time.',
  browser: 'The Gmail connection lost its browser cookie. Open the app at the configured callback address, then click Connect again. Use the same browser throughout.',
  denied: 'Google did not authorize this account. If the Google app is in Testing, add this exact Gmail address under Google Auth Platform → Audience → Test users, then start a new connection.',
  credentials: 'Google rejected the OAuth client credentials. Check that the client ID and client secret in .env.local belong to the same Web application client.',
  code: 'Google rejected the sign-in code. Start a fresh connection and confirm that the authorized redirect URI matches GMAIL_REDIRECT_URI exactly.',
  permissions: 'Required Gmail permissions were not granted. Connect again and approve the requested Gmail access.',
  'api-disabled': 'The Gmail API is disabled for this Google Cloud project. Enable Gmail API in APIs & Services → Library, then connect again.',
  policy: 'Google or your account administrator blocked Gmail access. Review the account’s app-access restrictions.',
  network: 'The app server could not reach Google. Check its internet connection and try connecting again.',
  identity: 'Google could not verify this Gmail mailbox. Check that Gmail is enabled for the selected account, then reconnect.',
  'wrong-account': 'This is a different Gmail account. Reconnect using the original address, or use Connect sender to add a new account.',
  offline: 'Google did not supply offline access. Remove the old app grant from your Google account permissions, then reconnect.',
  admin: 'Owner sign-in is required to finish the Gmail connection. Open the protected admin and start again.'
};
export function gmailConnectionMessage(code) {
  return Object.hasOwn(gmailConnectionMessages, code || '') ? gmailConnectionMessages[code] : gmailConnectionMessages.failed;
}
