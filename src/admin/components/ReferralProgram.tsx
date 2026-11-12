"use client";
import { useCallback, useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { Copy, Download, Plus, QrCode, RefreshCw, UsersRound } from 'lucide-react';
import { referralBases, referralBasis, referralCurrencies, referralLink, moneyMinor, percentageBps, commissionMinor } from '../../shared/referrals.mjs';
import Modal from './Modal';

type Partner = { id: string; code: string; name: string; email: string; phone: string; rate_bps: number; basis: string; payout_details: string; active: number; version: number };
type Commission = { id: string; partner_id: string; customer: string; reference: string; base_minor: number; commission_minor: number; currency: string; rate_bps: number; basis: string; status: string; payment_reference: string; paid_at: string | null; notes: string; inquiry_id: string; version: number };
type Inquiry = { id: string; name: string; email: string; service: string; message: string; created_at: string; referral_partner_id: string; referral_name: string; referral_code: string };
type Data = { partners: Partner[]; commissions: Commission[]; inquiries: Inquiry[]; totals: { currency: string; owed: number; paid: number }[]; website: { origin?: string; local?: boolean; error?: string } };
type Editor = { kind: 'partner'; partner?: Partner } | { kind: 'commission'; partner: Partner; inquiry?: Inquiry } | { kind: 'payout' | 'void'; commission: Commission } | { kind: 'assets'; partner: Partner };
const bases = referralBases as Record<string, string>;
const money = (amount: number, currency: string) => new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount / 100);
const percent = (rate: number) => `${rate / 100}%`;
const date = (value: string) => new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Skopje', dateStyle: 'medium' }).format(new Date(value));
function Field({ label, children, full = false }: { label: string; children: ReactNode; full?: boolean }) { return <label className={`referral-field${full ? ' full' : ''}`}>{label}{children}</label>; }
function PartnerForm({ partner }: { partner?: Partner }) {
  return <div className="form-grid">
    <Field label="Person’s name *" full><input name="name" required maxLength={120} defaultValue={partner?.name} autoComplete="name" /></Field>
    <Field label="Email"><input name="email" type="email" maxLength={254} defaultValue={partner?.email} autoComplete="email" /></Field>
    <Field label="Phone"><input name="phone" type="tel" maxLength={80} defaultValue={partner?.phone} autoComplete="tel" /></Field>
    <Field label="Commission (%) *"><input name="percentage" required type="number" min="0.01" max="100" step="0.01" placeholder="e.g. 10" defaultValue={partner ? partner.rate_bps / 100 : ''} /></Field>
    <Field label="Commission applies to"><input readOnly value="First website payment only" /><input type="hidden" name="basis" value={referralBasis} /></Field>
    <Field label="Payment instructions" full><textarea name="payout_details" rows={4} maxLength={2000} placeholder="Payee name, preferred payment method and where to send the commission. Do not store passwords, card security codes or login details." defaultValue={partner?.payout_details} /></Field>
    <p className="field-help referral-full">A permanent code is generated when you save. Changes to the rate apply to new commissions; existing amounts keep their original rate.</p>
    {partner && <Field label="Status" full><select name="active" defaultValue={partner.active ? 'true' : 'false'}><option value="true">Active</option><option value="false">Inactive — stop accepting new referrals</option></select></Field>}
  </div>;
}
function CommissionForm({ partner, inquiry }: { partner: Partner; inquiry?: Inquiry }) {
  const [amount, setAmount] = useState(''), [currency, setCurrency] = useState('usd');
  let calculated = '';
  try { calculated = money(commissionMinor(moneyMinor(amount), percentageBps(partner.rate_bps / 100)), currency); } catch { /* Wait for a valid amount. */ }
  return <div className="form-grid">
    <p className="field-help referral-full">{partner.name} · {partner.code}<br />{percent(partner.rate_bps)} of the referred customer’s first website payment only.</p>
    <Field label="Referred customer *" full><input name="customer" required maxLength={160} defaultValue={inquiry?.name} /></Field>
    <Field label="First website payment amount *"><input name="amount" type="number" min="0.01" max="999999999.99" step="0.01" required value={amount} onChange={event => setAmount(event.target.value)} /></Field>
    <Field label="Currency"><select name="currency" value={currency} onChange={event => setCurrency(event.target.value)}>{referralCurrencies.map(value => <option key={value} value={value}>{value.toUpperCase()}</option>)}</select></Field>
    <Field label="First website payment reference *" full><input name="reference" required maxLength={200} placeholder="Unique invoice, receipt or payment ID" /></Field>
    <label className="outreach-checkbox referral-full"><input name="first_payment_confirmed" type="checkbox" required />I have confirmed this is the customer’s first website payment.</label>
    <Field label="Notes" full><textarea name="notes" rows={3} maxLength={2000} /></Field>
    <p className="referral-calculation referral-full" aria-live="polite">Commission to pay: <strong>{calculated || 'Enter an amount'}</strong></p>
  </div>;
}
export default function ReferralProgram() {
  const [data, setData] = useState<Data | null>(null), [error, setError] = useState(''), [notice, setNotice] = useState(''), [busy, setBusy] = useState(false);
  const [editor, setEditor] = useState<Editor | null>(null), [query, setQuery] = useState(''), [selected, setSelected] = useState(''), [status, setStatus] = useState('all');
  const locked = useRef(false);
  const close = useCallback(() => { if (!locked.current) { setEditor(null); setError(''); } }, []);
  const load = useCallback(async () => {
    const response = await fetch('/api/referrals', { cache: 'no-store' }), payload = await response.json();
    if (!response.ok) throw new Error(payload.error || 'Referral Program could not load.');
    setData(payload);
  }, []);
  useEffect(() => { load().catch(e => setError(e.message)); }, [load]);
  function open(value: Editor) { setError(''); setNotice(''); setEditor(value); }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (locked.current || !editor) return;
    const values = Object.fromEntries(new FormData(event.currentTarget));
    let body: Record<string, unknown>;
    if (editor.kind === 'partner') body = { action: 'partner.save', id: editor.partner?.id, version: editor.partner?.version, record: { ...values, active: values.active !== 'false' } };
    else if (editor.kind === 'commission') body = { action: 'commission.add', partner_id: editor.partner.id, partner_version: editor.partner.version, record: { ...values, first_payment_confirmed: values.first_payment_confirmed === 'on', inquiry_id: editor.inquiry?.id || '' } };
    else if (editor.kind === 'payout' || editor.kind === 'void') body = { action: 'commission.settle', id: editor.commission.id, version: editor.commission.version, status: editor.kind === 'payout' ? 'paid' : 'void', payment_reference: values.payment_reference };
    else return;
    locked.current = true; setBusy(true); setError(''); setNotice('');
    try {
      const response = await fetch('/api/referrals', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-platform-request': 'admin' }, body: JSON.stringify(body) }), payload = await response.json();
      if (!response.ok) throw new Error(payload.error || 'The referral record could not be saved.');
      setEditor(null); setNotice('Referral record saved.');
      try { await load(); } catch { setError('Saved successfully, but the list could not refresh. Use Refresh before making further changes.'); }
    } catch (e) { setError((e as Error).message); }
    finally { locked.current = false; setBusy(false); }
  }
  async function copy(text: string) { try { await navigator.clipboard.writeText(text); setNotice('Copied.'); } catch { setError('Copy is unavailable in this browser. Select the code or link and copy it.'); } }
  const partners = data?.partners.filter(row => `${row.name} ${row.code} ${row.email} ${row.phone}`.toLowerCase().includes(query.toLowerCase())) || [];
  const partnerById = (id: string) => data?.partners.find(row => row.id === id);
  const commissions = data?.commissions.filter(row => (!selected || row.partner_id === selected) && (status === 'all' || row.status === status)) || [];
  const inquiries = data?.inquiries.filter(row => !selected || row.referral_partner_id === selected) || [];
  const assetUrl = (partner: Partner, asset: string, download = false) => `/api/referrals?partner=${encodeURIComponent(partner.id)}&asset=${asset}${download ? '&download=1' : ''}`;
  const title = editor?.kind === 'partner' ? editor.partner ? 'Edit referral partner' : 'Add referral partner' : editor?.kind === 'commission' ? 'Record commission' : editor?.kind === 'payout' ? 'Mark commission paid' : editor?.kind === 'void' ? 'Void commission' : 'QR code & flyer';
  return <div className="referral-program">
    <div className="marketing-actions"><div><h2>Referral Program</h2><span className="muted">Give each person a code. Track who to pay and how much.</span></div><div><button className="secondary" disabled={busy} onClick={() => { setError(''); load().catch(e => setError(e.message)); }}><RefreshCw size={14} />Refresh</button><a className="secondary" href="/api/referrals?download=backup"><Download size={14} />JSON backup</a><button className="primary" disabled={!data || busy} onClick={() => open({ kind: 'partner' })}><Plus size={16} />Add person</button></div></div>
    {!editor && error && <p className="referral-error" role="alert">{error}</p>}{!editor && notice && <p className="referral-notice" role="status">{notice}</p>}
    {!data ? <p role="status">{error ? 'Use Refresh to try loading again.' : 'Loading referral records…'}</p> : <>
      {(data.website.local || data.website.error) && <p className="referral-warning" role="status">{data.website.error || 'Local preview: these QR codes point to this computer. Set the public website address (HOME_PUBLIC_ORIGIN) before printing or sharing flyers. Downloaded files will need to be generated again with that address.'}</p>}
      <div className="referral-totals"><div><span>Referral partners</span><strong>{data.partners.length}</strong></div><div><span>Referred enquiries</span><strong>{data.inquiries.length}</strong></div>{data.totals.map(row => <div key={row.currency}><span>{row.currency.toUpperCase()} commissions</span><strong>{money(row.owed, row.currency)} owed</strong><small>{money(row.paid, row.currency)} paid</small></div>)}</div>
      <section className="panel"><div className="panel-heading"><div><h2>People & codes</h2><p>Payment instructions stay private. Names and codes appear on flyer downloads.</p></div><label className="referral-search">Search people<input type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Name, code or contact" /></label></div>
        {!partners.length ? <div className="empty"><UsersRound size={25} /><h3>{data.partners.length ? 'No matching people' : 'Add your first referral partner'}</h3><p>Save their name and agreed percentage to generate a permanent code and QR flyer.</p></div> : <div className="referral-people">{partners.map(partner => <article className="referral-person" key={partner.id}>
          <div className="referral-person-heading"><div><h3>{partner.name}</h3><span className="referral-code">{partner.code}</span></div><span className={`badge badge-${partner.active ? 'active' : 'disabled'}`}>{partner.active ? 'Active' : 'Inactive'}</span></div>
          <p><strong>{percent(partner.rate_bps)}</strong> · First website payment only</p><p className="muted">{partner.email || partner.phone ? [partner.email, partner.phone].filter(Boolean).join(' · ') : 'No contact details added'}</p>
          <details><summary>Payment instructions</summary><p className="referral-notes">{partner.payout_details || 'Add payment instructions so you know where to send their commission.'}</p></details>
          <div className="referral-actions"><button className="secondary" onClick={() => open({ kind: 'assets', partner })} disabled={!data.website.origin}><QrCode size={15} />QR & flyer</button><button className="text-button" onClick={() => copy(partner.code)}><Copy size={13} />Copy code</button><button className="text-button" onClick={() => open({ kind: 'partner', partner })}>Edit</button><button className="text-button" disabled={!partner.active} onClick={() => open({ kind: 'commission', partner })}>Record commission</button></div>
        </article>)}</div>}
      </section>
      <div className="referral-filters"><label>Person<select value={selected} onChange={event => setSelected(event.target.value)}><option value="">All people</option>{data.partners.map(row => <option key={row.id} value={row.id}>{row.name} · {row.code}</option>)}</select></label><label>Commission status<select value={status} onChange={event => setStatus(event.target.value)}>{['all', 'owed', 'paid', 'void'].map(value => <option key={value} value={value}>{value === 'all' ? 'All statuses' : value[0].toUpperCase() + value.slice(1)}</option>)}</select></label></div>
      <section className="panel"><div className="panel-heading"><div><h2>Commissions</h2><p>Enter confirmed qualifying payments. Mark paid after sending the money yourself.</p></div></div>{!commissions.length ? <p className="referral-empty">No commissions recorded for this selection.</p> : <div className="table-scroll"><table className="referral-table"><thead><tr><th>Person / customer</th><th>Qualifying payment</th><th>Commission</th><th>Status</th><th>Actions</th></tr></thead><tbody>{commissions.map(row => <tr key={row.id}><td><strong>{partnerById(row.partner_id)?.name || 'Unknown partner'}</strong><span className="subline">{row.customer}</span></td><td>{money(row.base_minor, row.currency)}<span className="subline">{row.reference}</span><span className="subline">{bases[row.basis]}</span>{row.notes && <span className="subline referral-notes">{row.notes}</span>}</td><td><strong>{money(row.commission_minor, row.currency)}</strong><span className="subline">{percent(row.rate_bps)}</span></td><td><span className={`badge badge-${row.status === 'paid' ? 'active' : row.status === 'owed' ? 'pending' : 'disabled'}`}>{row.status}</span>{row.paid_at && <span className="subline">{date(row.paid_at)}</span>}{row.payment_reference && <span className="subline">{row.payment_reference}</span>}</td><td>{row.status === 'owed' && <div className="referral-actions"><button className="secondary" onClick={() => open({ kind: 'payout', commission: row })}>Mark paid</button><button className="text-button" onClick={() => open({ kind: 'void', commission: row })}>Void</button></div>}</td></tr>)}</tbody></table></div>}</section>
      <section className="panel"><div className="panel-heading"><div><h2>Referred enquiries</h2><p>Website enquiries with a valid referral code appear here. An enquiry alone creates no commission.</p></div></div>{!inquiries.length ? <p className="referral-empty">No referred enquiries yet.</p> : <div className="referral-inquiries">{inquiries.map(inquiry => {
        const partner = partnerById(inquiry.referral_partner_id), recorded = data.commissions.some(row => row.inquiry_id === inquiry.id && row.status !== 'void');
        return <article key={inquiry.id}><div className="referral-person-heading"><div><h3>{inquiry.name}</h3><a href={`mailto:${inquiry.email}`}>{inquiry.email}</a><p>{date(inquiry.created_at)} · {inquiry.service}</p></div><span>{inquiry.referral_name}<br /><code>{inquiry.referral_code}</code></span></div><p className="referral-notes">{inquiry.message}</p><button className="secondary" disabled={!partner?.active || recorded} onClick={() => partner && open({ kind: 'commission', partner, inquiry })}>{recorded ? 'Commission recorded' : 'Record commission'}</button></article>;
      })}</div>}</section>
    </>}
    {editor && <Modal title={title} close={close}>{editor.kind === 'assets' ? <div className="form-body referral-assets">
      {error && <p className="referral-error" role="alert">{error}</p>}{notice && <p className="referral-notice" role="status">{notice}</p>}{data?.website.local && <p className="referral-warning">Local preview only. Configure the public website address before distribution.</p>}
      <img src={assetUrl(editor.partner, 'flyer')} width={450} height={600} alt={`Flyer with QR code, ${editor.partner.name} and code ${editor.partner.code}`} onError={() => setError('The flyer could not load. Check the website address and try again.')} />
      <p>{editor.partner.name} · <strong>{editor.partner.code}</strong></p>{data?.website.origin && <Field label="Referral link"><input readOnly value={referralLink(data.website.origin, editor.partner.code)} onFocus={event => event.target.select()} /></Field>}
      <div className="referral-actions"><a className="primary" href={assetUrl(editor.partner, 'flyer', true)}><Download size={15} />Download flyer SVG</a><a className="secondary" href={assetUrl(editor.partner, 'qr', true)}><Download size={15} />Download named QR SVG</a>{data?.website.origin && <button className="secondary" onClick={() => copy(referralLink(data.website.origin!, editor.partner.code))}><Copy size={14} />Copy link</button>}</div><p className="field-help">SVG downloads scale for print. Place the named QR card inside your own flyer, or print the complete flyer. Keep the white border around the QR code.</p>
    </div> : <form onSubmit={submit}><fieldset className="form-body referral-form-body" disabled={busy}>{error && <p className="referral-error" role="alert">{error}</p>}
      {editor.kind === 'partner' ? <PartnerForm partner={editor.partner} /> : editor.kind === 'commission' ? <CommissionForm partner={editor.partner} inquiry={editor.inquiry} /> : <>
        <p className="field-help">{partnerById(editor.commission.partner_id)?.name} · {editor.commission.customer}<br /><strong>{money(editor.commission.commission_minor, editor.commission.currency)}</strong></p>
        {editor.kind === 'payout' ? <><p className="referral-notes">{partnerById(editor.commission.partner_id)?.payout_details || 'No payment instructions saved.'}</p><Field label="Payout reference *"><input name="payment_reference" required maxLength={200} placeholder="Bank transfer ID, receipt or payment confirmation" /></Field><p className="field-help">Confirm that you have already sent this commission. This records your payment; it does not transfer money.</p></> : <p className="field-help">Void this unpaid commission if it was entered by mistake or is no longer due. Its record and audit history will be retained.</p>}
      </>}
    </fieldset><div className="form-footer"><button type="button" className="secondary" disabled={busy} onClick={close}>Cancel</button><button type="submit" className="primary" disabled={busy}>{busy ? 'Saving…' : editor.kind === 'partner' ? 'Save person' : editor.kind === 'commission' ? 'Record commission owed' : editor.kind === 'payout' ? 'Confirm paid' : 'Void commission'}</button></div></form>}</Modal>}
  </div>;
}
