"use client";
import { useEffect, useRef, useState } from "react";
import { ArrowUpRight, CircleAlert, Eye, LoaderCircle, Mail, Plus, RefreshCw, Save, Send, ShieldCheck, Unplug } from "lucide-react";
import { gmailConnectionMessage, markdownHtml, placementLabels, splitPastedEmail, validateDraft } from "../../shared/outreach.mjs";
import Modal from "./Modal";
import LeadDirectory from "./LeadDirectory";
import { outreachPost } from "./outreach-api";

type Row = Record<string, any>;
const blank = (account_id = "") => ({ id: "", version: 0, state: "draft", account_id, recipient: "", subject: "", body: "", company: "", website: "", instagram: "" });
const labels = placementLabels as Record<string, string>;
function EmailPreview({ body }: { body: string }) {
  const content = `<!doctype html><html><head><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'"><style>body{font:15px/1.65 Arial,sans-serif;color:#25362e;padding:12px;margin:0;overflow-wrap:anywhere}a{color:#28694f}p{margin:0 0 16px}li{margin-bottom:5px}code{background:#f3f5f3;padding:2px 4px}</style></head><body>${markdownHtml(body)}</body></html>`;
  return <iframe className="outreach-preview" title="Email body preview" sandbox="" referrerPolicy="no-referrer" srcDoc={content} />;
}
function CompanyLinks({ row }: { row: Row }) {
  return <span className="outreach-links">{row.website && <a href={row.website} target="_blank" rel="noreferrer">Website <ArrowUpRight size={13} /></a>}{row.instagram && <a href={row.instagram} target="_blank" rel="noreferrer">Instagram <ArrowUpRight size={13} /></a>}</span>;
}
function AccountCard({ account, messages, busy, date, run }: { account: Row; messages: Row[]; busy: boolean; date: (value: string) => string; run: (label: string, callback: () => Promise<void>) => void }) {
  const [limit, setLimit] = useState(String(account.daily_limit)), [receiver, setReceiver] = useState(Boolean(account.test_receiver));
  useEffect(() => { setLimit(String(account.daily_limit)); setReceiver(Boolean(account.test_receiver)); }, [account.daily_limit, account.test_receiver]);
  const update = () => run("Saving account", async () => { await outreachPost({ action: "account.update", id: account.id, version: account.version, daily_limit: Number(limit), test_receiver: receiver }); });
  return <article className="outreach-account">
    <div className="outreach-card-heading"><h3><Mail size={17} />{account.email}</h3><span className={`badge badge-${account.status === "connected" ? "active" : "do-not-contact"}`}>{account.status.replaceAll("-", " ")}</span></div>
    <p className="muted">{account.can_send ? "Sending account" : "Read-only test account"}{account.test_receiver ? " · Verified test receiver" : ""}</p>
    {account.paused_reason && <p className="outreach-warning" role="status">{account.paused_reason}</p>}
    <dl className="outreach-account-stats">
      <div><dt>Total sent</dt><dd>{account.total_sent}</dd></div><div><dt>Sent today</dt><dd>{account.sent_today}</dd></div>
      <div><dt>Remaining today</dt><dd>{account.can_send ? account.remaining : "—"}</dd></div><div><dt>Detected bounces</dt><dd>{account.bounces}</dd></div>
      <div><dt>Tests sent: Inbox / Spam</dt><dd>{account.inbox_tests} / {account.spam_tests}</dd></div>
      {account.test_receiver && <div><dt>Tests received: Inbox / Spam</dt><dd>{account.received_tests.inbox} / {account.received_tests.spam}</dd></div>}
    </dl>
    <div className="outreach-account-settings"><label>Daily sending limit<input aria-label={`Daily limit for ${account.email}`} type="number" min="1" max="500" value={limit} disabled={busy || !account.can_send} onChange={event => setLimit(event.target.value)} /></label>
      <label className="outreach-checkbox"><input type="checkbox" checked={receiver} disabled={busy} onChange={event => setReceiver(event.target.checked)} />Use as a spam-test receiver</label>
      <button className="secondary" disabled={busy || limit === String(account.daily_limit) && receiver === Boolean(account.test_receiver)} onClick={update}>Save settings</button></div>
    <p className="outreach-meta">Last refresh: {date(account.last_refresh)}<br />API requests: {account.usage.requests} · Estimated quota units: {account.usage.estimated_quota_units}</p>
    <div className="outreach-actions">
      <button className="secondary" disabled={busy || account.status === "disconnected" || account.status === "reconnect-required"} onClick={() => run("Refreshing account", async () => {
        await outreachPost({ action: "account.refresh", id: account.id });
        const pending = messages.filter(row => ["sent", "uncertain", "sending"].includes(row.state) && (row.account_id === account.id || account.test_receiver && row.recipient === account.email));
        let failures = 0;
        for (const row of pending) { try { await outreachPost({ action: "email.refresh", id: row.id }); } catch { failures++; } }
        if (failures) throw new Error(`Account refreshed; ${failures} message(s) could not refresh. Check their individual history cards.`);
      })}><RefreshCw size={14} />Refresh</button>
      {account.status === "paused" && <button className="secondary" disabled={busy} onClick={() => run("Resuming account", async () => { await outreachPost({ action: "account.resume", id: account.id }); })}>Resume sending</button>}
      <button className="text-button" disabled={busy} onClick={() => run("Connecting Gmail", async () => { const result = await outreachPost({ action: "oauth.start", id: account.id }); window.location.assign(result.url); })}>{account.status === "disconnected" ? "Connect again" : "Reconnect"}</button>
      {account.status !== "disconnected" && <button className="text-button" disabled={busy} onClick={() => run("Disconnecting account", async () => { const result = await outreachPost({ action: "account.disconnect", id: account.id, version: account.version }); if (!result.revoked) throw new Error(result.notice); })}><Unplug size={14} />Disconnect</button>}
    </div>
  </article>;
}
export default function NewClients() {
  const [data, setData] = useState<Row | null>(null), [draft, setDraft] = useState<Row>(blank()), [error, setError] = useState(""), [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(""), [preview, setPreview] = useState(false), [confirm, setConfirm] = useState<Row | null>(null);
  const [suppression, setSuppression] = useState({ kind: "email", value: "", reason: "" });
  const locked = useRef(false), composer = useRef<HTMLElement | null>(null);
  async function load(signal?: AbortSignal): Promise<Row> {
    const response = await fetch("/api/outreach", { cache: "no-store", signal }); const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || "New Clients could not load.");
    if (!signal?.aborted) setData(payload); return payload;
  }
  useEffect(() => {
    const controller = new AbortController(); void load(controller.signal).catch(e => { if (!controller.signal.aborted) setError(e.message); });
    const parameters = new URLSearchParams(window.location.search), state = parameters.get("oauth");
    if (state === "connected") setNotice("Gmail account connected.");
    if (state === "failed") setError(gmailConnectionMessage(parameters.get("reason")));
    if (state === "configured-host") setNotice("You are now using the address configured for Gmail. Click Connect sender or Connect test receiver again to continue.");
    if (state) {
      parameters.delete("oauth"); parameters.delete("reason");
      history.replaceState(null, "", `${window.location.pathname}${parameters.size ? `?${parameters}` : ""}${window.location.hash}`);
    }
    return () => controller.abort();
  }, []);
  async function run(label: string, callback: () => Promise<void>) {
    if (locked.current) return; locked.current = true; setBusy(label); setError(""); setNotice("");
    try { await callback(); await load(); if (!label.startsWith("Connecting")) setNotice(`${label} complete.`); }
    catch (e) { setError((e as Error).message); await load().catch(() => {}); }
    finally { locked.current = false; setBusy(""); }
  }
  const date = (value: string) => value ? new Intl.DateTimeFormat("en-GB", { timeZone: data?.timezone || "Europe/Skopje", dateStyle: "medium", timeStyle: "short" }).format(new Date(value)) : "Not refreshed";
  const accounts: Row[] = data?.accounts || [], messages: Row[] = data?.messages || [];
  const senders = accounts.filter(row => row.can_send), active = accounts.find(row => row.id === draft.account_id);
  const field = (name: string, value: string) => { setDraft(previous => ({ ...previous, [name]: value })); };
  const disabled = Boolean(busy) || Boolean(confirm), editable = draft.state === "draft";
  function compose(lead: Row) {
    if (draft.body || draft.subject || draft.recipient) { setError("Save your current draft or choose New email before composing for another lead."); return; }
    setDraft({ ...blank(draft.account_id), recipient: lead.email, company: lead.name, website: lead.website, instagram: lead.instagram });
    composer.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }
  async function save(values = draft) {
    const saved = await outreachPost({ action: "draft.save", id: values.id || undefined, version: values.version, record: values });
    setDraft(saved); return saved;
  }
  function review() {
    try { validateDraft(draft, true); setError(""); setConfirm({ ...draft }); }
    catch (e) { setError((e as Error).message); }
  }
  async function send() {
    if (!confirm) return;
    const captured = confirm; setConfirm(null);
    await run("Sending email", async () => {
      const saved = await save(captured);
      try { await outreachPost({ action: "email.send", id: saved.id, version: saved.version, deliberate_send: true }); setDraft(blank(saved.account_id)); setPreview(false); }
      catch (e) { const fresh = await load(); setDraft(fresh.messages.find((row: Row) => row.id === saved.id) || saved); throw e; }
    });
  }
  async function refreshAll() {
    await run("Refreshing email history", async () => {
      const pending = messages.filter(row => ["sent", "uncertain", "sending"].includes(row.state)); const failures: string[] = [];
      for (let i = 0; i < pending.length; i++) {
        setBusy(`Refreshing email ${i + 1} of ${pending.length}`);
        try { await outreachPost({ action: "email.refresh", id: pending[i].id }); } catch { failures.push(pending[i].recipient); }
      }
      if (failures.length) throw new Error(`Could not refresh ${failures.length} email(s). Check account connections and use individual Refresh to retry.`);
    });
  }
  return <div className="outreach-section">
    {error && <div className="notice error" role="alert"><CircleAlert size={17} />{error}</div>}
    {notice && <div className="notice success" role="status"><ShieldCheck size={17} />{notice}</div>}
    {busy && <p className="outreach-progress" role="status"><LoaderCircle size={16} className="spin" />{busy}…</p>}
    {!data ? <button className="secondary" disabled={Boolean(busy)} onClick={() => run("Loading New Clients", async () => {})}><RefreshCw size={15} />{error ? "Retry loading" : "Loading New Clients…"}</button> : <>
      <section className="panel"><div className="panel-heading"><div><h2>Gmail accounts</h2><p>Counts cover messages sent through New Clients. Daily limits reset in {data.timezone}.</p></div><div className="outreach-actions">
        <button className="primary" disabled={Boolean(busy) || !data.gmail_configured} onClick={() => run("Connecting Gmail", async () => { const result = await outreachPost({ action: "oauth.start", role: "sender" }); window.location.assign(result.url); })}><Plus size={16} />Connect sender</button>
        <button className="secondary" disabled={Boolean(busy) || !data.gmail_configured} onClick={() => run("Connecting Gmail", async () => { const result = await outreachPost({ action: "oauth.start", role: "receiver" }); window.location.assign(result.url); })}>Connect test receiver</button>
      </div></div>
      {!data.gmail_configured && <div className="outreach-content"><div className="notice info">Gmail setup is required: OAuth client ID, client secret, redirect URI and an encryption key. You can save message drafts now.</div>
        <details className="outreach-gmail-help"><summary>How to connect Gmail</summary><ol>
          <li>Open <a href="https://console.cloud.google.com/" target="_blank" rel="noreferrer">Google Cloud Console</a>, create or select a project, and enable the Gmail API.</li>
          <li>Configure Google Auth Platform → Branding and Audience. For personal Gmail accounts, use External / Testing and add each account as a test user.</li>
          <li>Under Clients, create a Web application OAuth client. Add this authorized redirect URI: <code>http://127.0.0.1:3001/api/outreach/oauth/callback</code>.</li>
          <li>Add the client ID, client secret, redirect URI and encryption key to the existing project <code>.env.local</code>. Full settings and the key-generation command are in <code>docs/OUTREACH.md</code>.</li>
          <li>Restart <code>npm run dev</code>, open this app at <code>http://127.0.0.1:3001</code>, and click Connect sender. Approve the Google permissions. Use Connect test receiver for each authorized spam-test mailbox.</li>
        </ol></details></div>}
      {accounts.length ? <div className="outreach-account-grid">{accounts.map(account => <AccountCard key={account.id} account={account} messages={messages} busy={Boolean(busy)} run={run} date={date} />)}</div> : <p className="outreach-content muted">Connect each sending or test Gmail account individually.</p>}</section>

      <LeadDirectory leads={data.leads} busy={Boolean(busy)} run={run} compose={compose} discoveryEnabled={data.discovery_enabled} />

      <section className="panel" ref={composer}><div className="panel-heading"><div><h2>Manual email composer</h2><p>One recipient and one deliberate Send action per message.</p></div><button className="secondary" disabled={disabled || editable && Boolean(draft.body || draft.subject || draft.recipient) && !draft.id} onClick={() => { setDraft(blank(draft.account_id)); setPreview(false); }}>New email</button></div>
        <div className="outreach-content">
          {!editable && <div className="notice info">This email has already been submitted. Refresh its history card for the result, or choose New email.</div>}
          <div className="form-grid">
            <div className="field full"><label htmlFor="outreach-recipient">Email</label><input id="outreach-recipient" type="email" autoComplete="off" value={draft.recipient} maxLength={254} disabled={disabled || !editable} onChange={e => field("recipient", e.target.value)} /><small>The recipient's email address.</small></div>
            <div className="field full"><label htmlFor="outreach-subject">Caption</label><input id="outreach-subject" value={draft.subject} maxLength={500} disabled={disabled || !editable} onChange={e => field("subject", e.target.value)} /><small>Sent as the email Subject.</small></div>
            <div className="field full"><label htmlFor="outreach-body">Message · Markdown</label><textarea id="outreach-body" rows={10} value={draft.body} maxLength={50000} disabled={disabled || !editable} onChange={e => field("body", e.target.value)} onPaste={event => {
              const extracted = splitPastedEmail(event.clipboardData.getData("text"));
              if (extracted && !draft.subject && !draft.body) {
                event.preventDefault();
                if (extracted.recipient && draft.recipient.trim() && draft.recipient.trim().toLowerCase() !== extracted.recipient) { setError("The pasted email address differs from Email. Clear or update Email first."); return; }
                setDraft(previous => ({ ...previous, ...extracted })); setNotice(extracted.recipient ? "Email and Caption were separated from the message." : "The first bold line became Caption. The rest is the message.");
              }
            }} /><small>Enter Email and Caption above. Format the message with **bold**, *italic*, lists, `code` and [links](https://example.com).</small></div>
            <div className="field full"><label htmlFor="outreach-account">Send from</label><select id="outreach-account" value={draft.account_id || ""} disabled={disabled || !editable} onChange={e => field("account_id", e.target.value)}><option value="">Select a Gmail sender</option>{senders.map(row => <option key={row.id} value={row.id}>{row.email} · {row.remaining} remaining · {row.status}</option>)}</select></div>
          </div>
          <details className="outreach-company-details"><summary>Company details (optional)</summary><div className="form-grid">
            {([ ["company", "Company name"], ["website", "Company website"], ["instagram", "Instagram URL"] ] as const).map(([name, title]) => <div className={`field ${name === "company" ? "full" : ""}`} key={name}><label htmlFor={`outreach-${name}`}>{title} <span className="muted">(optional)</span></label><input id={`outreach-${name}`} type={name === "company" ? "text" : "url"} value={draft[name]} disabled={disabled || !editable} maxLength={name === "company" ? 300 : 2000} onChange={e => field(name, e.target.value)} /></div>)}
          </div></details>
          <div className="outreach-actions outreach-composer-actions">
            <button className="secondary" disabled={disabled || !editable} onClick={() => run("Saving draft", async () => { await save(); })}><Save size={16} />Save Draft</button>
            <button className="secondary" disabled={disabled} aria-expanded={preview} onClick={() => setPreview(!preview)}><Eye size={16} />{preview ? "Hide Preview" : "Preview"}</button>
            <button className="primary" disabled={disabled || !editable || !active || active.status !== "connected" || !active.remaining || !data.gmail_configured} onClick={review}><Send size={16} />Send</button>
            {active && <span className="muted">{active.remaining} of {active.daily_limit} remaining today</span>}
          </div>
          {preview && <div className="outreach-preview-wrap"><p><strong>Subject:</strong> {draft.subject || "(no subject)"}</p><EmailPreview body={draft.body} /></div>}
        </div>
      </section>

      <section className="panel"><div className="panel-heading"><div><h2>Email history</h2><p>Sent means Gmail accepted the message. Placement stays unknown for normal recipients.</p></div><button className="secondary" disabled={Boolean(busy)} onClick={refreshAll}><RefreshCw size={16} />Refresh All</button></div>
        <div className="outreach-history">{!messages.length && <p className="muted">Your drafts and sent emails will appear here.</p>}{messages.map(row => <article className={`outreach-email ${row.placement === "spam" ? "outreach-email-spam" : ""}`} key={row.id}>
          <div className="outreach-card-heading"><div><h3>{row.recipient || "No recipient yet"}</h3>{row.company && <p>{row.company}</p>}</div><div className="outreach-actions"><span className="badge">{row.state === "draft" ? "Draft" : row.bounced_at ? "Bounced" : row.replied_at ? "Replied" : row.state === "sent" ? "Sent" : row.state === "failed" ? "Send rejected" : row.state === "sending" ? "Sending" : "Send outcome uncertain"}</span>
            {row.state === "draft" ? <button className="secondary" disabled={Boolean(busy)} onClick={() => { if ((draft.body || draft.subject || draft.recipient) && !draft.id) { setError("Save your current draft before opening another."); return; } setDraft(row); composer.current?.scrollIntoView({ behavior: "smooth" }); }}>Edit draft</button> : <button className="secondary" disabled={Boolean(busy)} onClick={() => run("Refreshing email", async () => { await outreachPost({ action: "email.refresh", id: row.id }); })}><RefreshCw size={14} />Refresh</button>}</div></div>
          <p className="outreach-subject">{row.subject || "(no subject)"}</p><p className="outreach-meta">From: {row.sender || accounts.find(a => a.id === row.account_id)?.email || "Not selected"}<br />{row.sent_at ? `Sent: ${date(row.sent_at)}` : `Saved: ${date(row.created_at)}`} · Last refresh: {date(row.last_refresh)}</p>
          {row.state !== "draft" && <p className={`outreach-placement ${row.placement === "spam" ? "outreach-warning" : ""}`}>{row.placement === "spam" && <CircleAlert size={16} />}{labels[row.placement] || labels.unknown}{row.placement === "spam" ? " — Warning: the connected test mailbox marked this message as Spam." : ""}</p>}
          {row.error && <p className="outreach-warning">{row.error}</p>}
          <CompanyLinks row={row} /><details className="outreach-original"><summary>Read original email</summary><EmailPreview body={row.body} /><details><summary>Original Markdown</summary><pre>{row.body}</pre></details></details>
          {row.recipient && <button className="text-button" disabled={Boolean(busy)} onClick={() => { setSuppression({ kind: "email", value: row.recipient, reason: "Declined / opted out" }); document.getElementById("outreach-suppression")?.scrollIntoView({ behavior: "smooth" }); }}>Add recipient to suppression list</button>}
        </article>)}</div>
      </section>

      <section className="panel" id="outreach-suppression"><div className="panel-heading"><div><h2>Suppression list</h2><p>Blocked recipients and business domains apply to every sending account.</p></div></div><div className="outreach-content">
        <form className="outreach-suppression-form" onSubmit={event => { event.preventDefault(); void run("Saving suppression", async () => { await outreachPost({ action: "suppression.add", ...suppression }); setSuppression({ kind: "email", value: "", reason: "" }); }); }}>
          <label>Block by<select value={suppression.kind} disabled={Boolean(busy)} onChange={e => setSuppression({ ...suppression, kind: e.target.value })}><option value="email">Email address</option><option value="domain">Business domain</option></select></label>
          <label>Email or domain<input required value={suppression.value} disabled={Boolean(busy)} onChange={e => setSuppression({ ...suppression, value: e.target.value })} /></label>
          <label>Reason<input required maxLength={2000} value={suppression.reason} disabled={Boolean(busy)} onChange={e => setSuppression({ ...suppression, reason: e.target.value })} /></label><button className="secondary" disabled={Boolean(busy)}>Block contact</button>
        </form>
        <ul className="outreach-suppression-list">{data.suppression.map((row: Row) => <li key={row.id}><div><strong>{row.value}</strong><span>{row.reason}</span></div><button className="text-button" disabled={Boolean(busy)} onClick={() => run("Removing suppression", async () => { await outreachPost({ action: "suppression.remove", id: row.id }); })}>Remove block</button></li>)}</ul>
      </div></section>
    </>}
    {confirm && <Modal title="Review and send email" close={() => setConfirm(null)}><div className="outreach-content"><p><strong>From:</strong> {accounts.find(a => a.id === confirm.account_id)?.email}</p><p><strong>To:</strong> {confirm.recipient}</p><p><strong>Subject:</strong> {confirm.subject}</p><EmailPreview body={confirm.body} /><p className="muted">This sends one email from the selected Gmail account.</p></div><div className="form-footer"><button className="secondary" onClick={() => setConfirm(null)}>Keep editing</button><button className="primary" disabled={Boolean(busy)} onClick={send}><Send size={16} />Send this email</button></div></Modal>}
  </div>;
}

