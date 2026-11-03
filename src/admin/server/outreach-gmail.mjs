import { randomBytes } from 'node:crypto';
import { PlatformError } from '../../shared/entities.mjs';
import { email, markdownHtml, gmailConnectionMessages, gmailConnectionMessage } from '../../shared/outreach.mjs';
import { gmailConfig, hash, seal, unseal } from './outreach-store.mjs';

const READ = 'https://www.googleapis.com/auth/gmail.readonly';
const SEND = 'https://www.googleapis.com/auth/gmail.send';
const apiRoot = 'https://gmail.googleapis.com/gmail/v1/users/me';
const safeError = (message, status = 502) => new PlatformError(message, status);
export class GmailConnectionError extends PlatformError {
  constructor(code, status = 400) { super(gmailConnectionMessage(code), status); this.connectionCode = Object.hasOwn(gmailConnectionMessages, code) ? code : 'failed'; }
}
export function gmailConnectionCode(error) { return error instanceof GmailConnectionError ? error.connectionCode : 'failed'; }
async function oauthJson(fetcher, url, options) {
  let response;
  try { response = await fetcher(url, options); } catch { throw new GmailConnectionError('network', 503); }
  let payload;
  try { payload = await response.json(); } catch { throw new GmailConnectionError('failed', 502); }
  if (!payload || typeof payload !== 'object') throw new GmailConnectionError('failed', 502);
  return { response, payload };
}
const header = (message, name) => (message.payload?.headers || []).find(row => row.name.toLowerCase() === name.toLowerCase())?.value || '';
export function addresses(value) { return (String(value).match(/[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9.-]+\.[a-z]{2,}/gi) || []).map(value => value.toLowerCase()); }
const matchMessage = (item, draft) => header(item, 'Message-ID').trim() === draft.rfc_id && addresses(header(item, 'From')).includes(draft.sender) && addresses(header(item, 'To')).includes(draft.recipient);
export function oauthStart(store, actor, input, env = process.env, origin) {
  const config = gmailConfig(env), role = input.role === 'receiver' ? 'receiver' : 'sender';
  const callbackOrigin = new URL(config.redirectUri).origin;
  // The browser-binding cookie must be set on the same host that receives Google's callback.
  if (origin && origin !== callbackOrigin) return { url: `${callbackOrigin}/admin/marketing/new-clients?oauth=configured-host`, binding: null };
  const reconnect = input.id ? store.account(input.id) : null;
  const state = randomBytes(32).toString('base64url'), binding = randomBytes(32).toString('base64url'), verifier = randomBytes(48).toString('base64url');
  store.run('DELETE FROM oauth_states WHERE expires_at<?', Date.now());
  store.run('INSERT INTO oauth_states VALUES(?,?,?,?,?,?,?)', hash(state), actor, hash(binding), seal(verifier, env), reconnect ? reconnect.can_send ? 'sender' : 'receiver' : role, reconnect?.id || '', Date.now() + 600000);
  const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  url.search = new URLSearchParams({ client_id: config.clientId, redirect_uri: config.redirectUri, response_type: 'code', scope: `${READ}${(reconnect ? reconnect.can_send : role === 'sender') ? ` ${SEND}` : ''}`, state,
    access_type: 'offline', prompt: 'consent select_account', code_challenge_method: 'S256', code_challenge: Buffer.from(hashBytes(verifier)).toString('base64url'), ...(reconnect ? { login_hint: reconnect.email } : {}) }).toString();
  return { url: url.href, binding };
}
function hashBytes(value) { return Buffer.from(hash(value), 'hex'); }
export function consumeOAuth(store, actor, state, binding, env = process.env) {
  if (!binding) throw new GmailConnectionError('browser');
  if (!/^[a-zA-Z0-9_-]{40,100}$/.test(state || '')) throw new GmailConnectionError('session');
  return store.transaction(() => {
    const row = store.one('SELECT * FROM oauth_states WHERE hash=?', hash(state));
    if (!row || row.actor !== actor || row.expires_at < Date.now()) throw new GmailConnectionError('session');
    if (row.binding_hash !== hash(binding)) throw new GmailConnectionError('browser');
    store.run('DELETE FROM oauth_states WHERE hash=?', row.hash);
    return { ...row, verifier: unseal(row.verifier, env) };
  });
}
export async function oauthFinish(store, actor, pending, code, { env = process.env, fetcher = fetch } = {}) {
  const config = gmailConfig(env);
  const { response, payload: token } = await oauthJson(fetcher, 'https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ code, client_id: config.clientId, client_secret: config.clientSecret, redirect_uri: config.redirectUri, grant_type: 'authorization_code', code_verifier: pending.verifier }), signal: AbortSignal.timeout(20000), redirect: 'error' });
  if (!response.ok || !token.access_token) {
    const code = ['invalid_client','unauthorized_client'].includes(token.error) ? 'credentials' : token.error === 'invalid_grant' ? 'code' : token.error === 'access_denied' ? 'denied' : 'failed';
    throw new GmailConnectionError(code);
  }
  const scopes = new Set(String(token.scope || '').split(' '));
  if (!scopes.has(READ) || pending.role === 'sender' && !scopes.has(SEND)) throw new GmailConnectionError('permissions');
  const { response: profileResponse, payload: profile } = await oauthJson(fetcher, `${apiRoot}/profile`, { headers: { Authorization: `Bearer ${token.access_token}` }, signal: AbortSignal.timeout(20000), redirect: 'error' });
  if (!profileResponse.ok) {
    const reasons = [...(profile.error?.errors || []), ...(profile.error?.details || [])].map(row => row.reason);
    const code = reasons.some(reason => ['SERVICE_DISABLED','accessNotConfigured','serviceDisabled'].includes(reason)) ? 'api-disabled'
      : reasons.some(reason => ['ACCESS_TOKEN_SCOPE_INSUFFICIENT','insufficientPermissions'].includes(reason)) ? 'permissions'
      : reasons.includes('domainPolicy') ? 'policy' : 'identity';
    throw new GmailConnectionError(code, 502);
  }
  let address; try { address = email(profile.emailAddress); } catch { throw new GmailConnectionError('identity', 502); }
  return store.transaction(() => {
    const reconnect = pending.reconnect_id ? store.account(pending.reconnect_id) : null;
    if (reconnect && reconnect.email !== address) throw new GmailConnectionError('wrong-account', 409);
    const before = store.one('SELECT * FROM accounts WHERE email=?', address);
    if (before?.can_send && pending.role === 'receiver' && !pending.reconnect_id) {
      // A second read-only consent must not replace a working sender's tokens.
      store.run('UPDATE accounts SET test_receiver=1,version=version+1 WHERE id=?',before.id);
      store.audit(actor,'account.test-receiver',before.id);return {id:before.id};
    }
    const previous = before?.credentials && !token.refresh_token ? unseal(before.credentials, env) : {};
    const refresh = token.refresh_token || previous.refresh_token;
    if (!refresh) throw new GmailConnectionError('offline');
    const credentials = seal({ access_token: token.access_token, refresh_token: refresh, expires_at: Date.now() + Number(token.expires_in || 3600) * 1000, scope: token.scope }, env);
    const id = before?.id || randomBytes(16).toString('hex'), canSend = pending.role === 'sender' && scopes.has(SEND) ? 1 : 0;
    if (before) store.run("UPDATE accounts SET credentials=?,status='connected',can_send=?,test_receiver=?,paused_reason='',last_refresh=?,version=version+1 WHERE id=?", credentials, canSend, pending.role === 'receiver' ? 1 : before.test_receiver, store.now(), id);
    else store.run('INSERT INTO accounts(id,email,can_send,test_receiver,credentials,last_refresh,created_at) VALUES(?,?,?,?,?,?,?)', id, address, canSend, pending.role === 'receiver' ? 1 : 0, credentials, store.now(), store.now());
    store.audit(actor, 'account.connect', id, { email: address }); return { id };
  });
}
export function createGmail(store, { env = process.env, fetcher = fetch } = {}) {
  const usage = (id, method, units) => store.run('INSERT INTO api_usage(account_id,method,units,at) VALUES(?,?,?,?)', id, method, units, store.now());
  const pause = (id, reason, auth = false) => store.run('UPDATE accounts SET status=?,paused_reason=?,version=version+1 WHERE id=? AND status!=?', auth ? 'reconnect-required' : 'paused', reason, id, 'disconnected');
  async function access(id) {
    const row = store.account(id);
    if (!row.credentials || ['disconnected', 'reconnect-required'].includes(row.status)) throw safeError('Reconnect this Gmail account first.', 409);
    let tokens = unseal(row.credentials, env);
    if (tokens.expires_at > Date.now() + 60000) return tokens.access_token;
    const config = gmailConfig(env); usage(id, 'oauth.refresh', 0);
    const response = await fetcher('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: tokens.refresh_token, client_id: config.clientId, client_secret: config.clientSecret }), signal: AbortSignal.timeout(20000), redirect: 'error' });
    const payload = await response.json();
    if (!response.ok || !payload.access_token) {
      if (response.status === 400 || response.status === 401) pause(id, 'Gmail authorization expired or was revoked. Reconnect to resume.', true);
      throw safeError('Gmail authorization could not refresh. Reconnect if required.', 503);
    }
    tokens = { ...tokens, access_token: payload.access_token, refresh_token: payload.refresh_token || tokens.refresh_token, expires_at: Date.now() + Number(payload.expires_in || 3600) * 1000 };
    // A disconnect in another request must not restore credentials.
    const updated = store.run("UPDATE accounts SET credentials=? WHERE id=? AND credentials=? AND status NOT IN ('disconnected','reconnect-required')", seal(tokens, env), id, row.credentials);
    if (!updated.changes) throw safeError('The Gmail connection changed during refresh. Retry this operation.',409);
    return tokens.access_token;
  }
  async function api(id, path, { method = 'GET', body, units = 5, operation = 'messages.list' } = {}) {
    const token = await access(id); usage(id, operation, units);
    const response = await fetcher(`${apiRoot}${path}`, { method, headers: { Authorization: `Bearer ${token}`, ...(body ? { 'Content-Type': 'application/json' } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(20000), redirect: 'error' });
    if (!response.ok) {
      if ([401,403].includes(response.status)) pause(id, 'Gmail rejected authorization or permissions. Reconnect before sending.', true);
      if (response.status === 429) pause(id, 'Gmail rate limit reached. Wait, then refresh and resume manually.');
      // Do not expose provider payloads, tokens, email content or OAuth codes.
      const error = safeError(response.status === 404 ? 'Gmail message is currently unavailable.' : 'Gmail rejected this request. Refresh the account and check its status.', response.status === 404 ? 404 : 502);
      error.providerStatus = response.status; throw error;
    }
    return response.json();
  }
  const list = (id, query, page = '') => api(id, `/messages?${new URLSearchParams({ q: query, includeSpamTrash: 'true', maxResults: '100', ...(page ? { pageToken: page } : {}) })}`);
  const metadata = (id, gmailId) => api(id, `/messages/${encodeURIComponent(gmailId)}?format=metadata&metadataHeaders=Message-ID&metadataHeaders=From&metadataHeaders=To&metadataHeaders=In-Reply-To&metadataHeaders=References`, { units: 20, operation: 'messages.get.metadata' });
  async function send(input, actor) {
    // Refresh authorization before reserving. Reserve quota/content atomically before the irreversible API call.
    const original = store.message(input.id); await access(original.account_id);
    const draft = store.reserveSend(input, actor);
    try {
      const result = await api(draft.account_id, '/messages/send', { method: 'POST', body: { raw: mimeMessage(draft) }, units: 100, operation: 'messages.send' });
      if (!result.id) throw safeError('Gmail did not return a message ID.');
      store.run("UPDATE messages SET state='sent',gmail_id=?,thread_id=?,sent_at=?,updated_at=?,error='',version=version+1 WHERE id=?", result.id, result.threadId || '', store.now(), store.now(), draft.id);
      store.audit(actor, 'email.sent', draft.id, { gmail_id: result.id });
      return store.message(draft.id);
    } catch (error) {
      // A timeout, crash or 5xx may follow actual acceptance. Never automatically resend.
      const rejected = [400,401,403,404,429].includes(error.providerStatus);
      store.run('UPDATE messages SET state=?,error=?,updated_at=?,version=version+1 WHERE id=?', rejected ? 'failed' : 'uncertain', rejected ? 'Gmail rejected this attempt. Review before making a new draft.' : 'Send outcome is uncertain. Refresh to reconcile with Gmail. This message will not be resent automatically.', store.now(), draft.id);
      store.audit(actor, rejected ? 'email.rejected' : 'email.uncertain', draft.id);
      throw safeError(rejected ? 'Gmail rejected the send. Check account status and review the email history.' : 'Send outcome is uncertain. Refresh this email; do not send another copy.', 502);
    }
  }
  async function refreshMessage(id, actor) {
    let draft = store.message(id);
    if (['draft','failed'].includes(draft.state)) return draft;
    if (draft.state === 'sending' && Date.now() - Date.parse(draft.attempt_at) < 120000) throw safeError('This email is still sending. Refresh in a moment.', 409);
    if (['sending','uncertain'].includes(draft.state)) {
      const found = await list(draft.account_id, `in:sent rfc822msgid:${draft.rfc_id.slice(1,-1)}`);
      let confirmed;
      for (const item of found.messages || []) { const data = await metadata(draft.account_id,item.id); if (matchMessage(data,draft)) { confirmed = data; break; } }
      if (!confirmed) {
        store.run("UPDATE messages SET state='uncertain',last_refresh=?,error='Not confirmed in Gmail Sent. Outcome remains uncertain; automatic resend is blocked.',version=version+1 WHERE id=?", store.now(), id);
        return store.message(id);
      }
      store.run("UPDATE messages SET state='sent',gmail_id=?,thread_id=?,sent_at=?,error='',version=version+1 WHERE id=?", confirmed.id, confirmed.threadId || '', draft.attempt_at, id);
      draft = store.message(id);
    }
    // Normal recipients never acquire an Inbox/Spam placement from sender-side evidence.
    const receiver = store.one("SELECT * FROM accounts WHERE email=? AND test_receiver=1 AND credentials IS NOT NULL AND status IN ('connected','paused')", draft.recipient);
    if (receiver) {
      const found = await list(receiver.id, `rfc822msgid:${draft.rfc_id.slice(1,-1)}`);
      let placement = 'unknown';
      for (const item of found.messages || []) {
        const data = await metadata(receiver.id,item.id);
        if (!matchMessage(data,draft)) continue;
        if ((data.labelIds || []).includes('SPAM')) { placement = 'spam'; break; }
        if ((data.labelIds || []).includes('INBOX')) placement = 'inbox';
      }
      store.run('UPDATE messages SET placement=?,placement_account=? WHERE id=?', placement, receiver.id, id);
      store.run('UPDATE accounts SET last_refresh=? WHERE id=?', store.now(), receiver.id);
      if (placement === 'spam') pause(draft.account_id, 'A connected test mailbox confirmed Spam placement. Review the message and sender before resuming.');
    }
    if (draft.thread_id) {
      const thread = await api(draft.account_id, `/threads/${encodeURIComponent(draft.thread_id)}?format=metadata&metadataHeaders=Message-ID&metadataHeaders=From&metadataHeaders=In-Reply-To&metadataHeaders=References`, { units: 20, operation: 'threads.get.metadata' });
      const reply = (thread.messages || []).find(item => item.id !== draft.gmail_id && addresses(header(item,'From')).includes(draft.recipient) && `${header(item,'In-Reply-To')} ${header(item,'References')}`.includes(draft.rfc_id) && Number(item.internalDate) >= Date.parse(draft.attempt_at));
      if (reply) store.run('UPDATE messages SET replied_at=COALESCE(replied_at,?) WHERE id=?', new Date(Number(reply.internalDate)).toISOString(), id);
    }
    // Delivery reports are checked by exact original Message-ID and failed recipient, never by subject similarity.
    const since = Math.floor(Date.parse(draft.attempt_at) / 1000) - 60;
    let page = '', pages = 0, bounce = false;
    do {
      const reports = await list(draft.account_id, `after:${since} {from:mailer-daemon from:postmaster}`, page);
      for (const item of reports.messages || []) {
        const report = await api(draft.account_id, `/messages/${encodeURIComponent(item.id)}?format=full`, { units: 60, operation: 'messages.get.full' });
        if (isBounce(report, draft)) { bounce = true; break; }
      }
      page = reports.nextPageToken || ''; pages++;
    } while (page && pages < 3 && !bounce);
    if (bounce) {
      store.transaction(() => {
        store.run('UPDATE messages SET bounced_at=COALESCE(bounced_at,?) WHERE id=?', store.now(), id);
        store.run("INSERT OR IGNORE INTO suppression VALUES(?, 'email', ?, 'Confirmed delivery failure', ?, ?)", randomBytes(16).toString('hex'), draft.recipient, actor, store.now());
        store.audit(actor,'email.bounced',id);
      });
      const failures = store.one('SELECT COUNT(*) AS n FROM messages WHERE account_id=? AND bounced_at>?', draft.account_id, new Date(Date.now()-7*86400000).toISOString()).n;
      if (failures >= 3) pause(draft.account_id, 'Three confirmed delivery failures in seven days. Review recipients before resuming.');
    }
    store.run('UPDATE messages SET last_refresh=?,updated_at=?,version=version+1 WHERE id=?', store.now(), store.now(), id);
    store.run('UPDATE accounts SET last_refresh=? WHERE id=?', store.now(), draft.account_id);
    store.audit(actor,'email.refresh',id); return store.message(id);
  }
  async function refreshAccount(id, actor, resume = false) {
    const before = store.account(id), profile = await api(id,'/profile',{ units:1,operation:'users.getProfile' });
    if (email(profile.emailAddress) !== before.email) { pause(id,'The Gmail identity changed. Reconnect.',true); throw safeError('Gmail account identity mismatch.',409); }
    if (resume && before.status === 'paused') store.run("UPDATE accounts SET status='connected',paused_reason='',version=version+1 WHERE id=? AND status='paused'",id);
    store.run('UPDATE accounts SET last_refresh=? WHERE id=?',store.now(),id);
    store.audit(actor,resume ? 'account.resume' : 'account.refresh',id);
  }
  async function disconnect(id, actor, expectedVersion) {
    const before = store.transaction(() => {
      const row=store.account(id);
      if (row.version !== expectedVersion) throw safeError('This account changed. Refresh first.',409);
      if (store.one("SELECT id FROM messages WHERE account_id=? AND state='sending'",id)) throw safeError('A send is still in progress. Refresh its result before disconnecting.',409);
      store.run("UPDATE accounts SET credentials=NULL,status='disconnected',paused_reason='',version=version+1 WHERE id=?",id);
      store.audit(actor,'account.disconnect',id); return row;
    });
    let revoked = false;
    if (before.credentials) {
      try { const token=unseal(before.credentials,env); const response=await fetcher('https://oauth2.googleapis.com/revoke',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({token:token.refresh_token}),signal:AbortSignal.timeout(10000),redirect:'error'}); revoked=response.ok; } catch { /* Local credentials were already erased. */ }
    }
    return { disconnected:true, revoked, notice:revoked ? 'Account disconnected and Google grant revoked.' : 'Local credentials removed. If needed, also remove this app in your Google account permissions.' };
  }
  return { send, refreshMessage, refreshAccount, disconnect, api };
}
export function mimeMessage(draft) {
  const from=email(draft.sender), to=email(draft.recipient), boundary=`alt_${randomBytes(16).toString('hex')}`;
  const words=[]; let chunk='';
  for (const character of draft.subject) { if (Buffer.byteLength(chunk+character)>42) { words.push(chunk); chunk=''; } chunk+=character; }
  if(chunk) words.push(chunk);
  const subject=words.map(value=>`=?UTF-8?B?${Buffer.from(value).toString('base64')}?=`).join('\r\n ');
  const encoded=value=>Buffer.from(value,'utf8').toString('base64').match(/.{1,76}/g)?.join('\r\n') || '';
  return Buffer.from([`From: ${from}`,`To: ${to}`,`Subject: ${subject}`,`Message-ID: ${draft.rfc_id}`,`Date: ${new Date(draft.attempt_at).toUTCString()}`,'MIME-Version: 1.0',`Content-Type: multipart/alternative; boundary="${boundary}"`,'',`--${boundary}`,'Content-Type: text/plain; charset=UTF-8','Content-Transfer-Encoding: base64','',encoded(draft.body),`--${boundary}`,'Content-Type: text/html; charset=UTF-8','Content-Transfer-Encoding: base64','',encoded(markdownHtml(draft.body)),`--${boundary}--`,''].join('\r\n')).toString('base64url');
}
export function isBounce(report,draft) {
  const parts=[];
  function walk(part) {
    if (!part) return;
    parts.push((part.headers || []).map(row=>`${row.name}: ${row.value}`).join('\n'));
    if(part.body?.data) parts.push(Buffer.from(part.body.data,'base64url').toString('utf8'));
    for(const child of part.parts || []) walk(child);
  }
  walk(report.payload);
  const content=parts.join('\n').replaceAll('\r\n','\n');
  const machine=/multipart\/report|message\/delivery-status/i.test(content+' '+report.payload?.mimeType);
  const id=content.includes(draft.rfc_id);
  const escaped=draft.recipient.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
  // Pair the failed action/status with this recipient within the same DSN block.
  const failed=content.split(/\n\s*\n/).some(block=>new RegExp(`(?:Final|Original)-Recipient:[^\n]*[; ]${escaped}(?:\\s|$)`,'i').test(block) && /^Action:\s*failed\s*$/im.test(block) && /^Status:\s*5\.\d+\.\d+/im.test(block));
  return machine && id && failed;
}
