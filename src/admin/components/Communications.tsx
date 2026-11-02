"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { ArrowRight, CalendarDays, Check, ChevronRight, CircleAlert, LoaderCircle, Mail, MessageSquare, Plus, UserRoundPlus, X } from "lucide-react";

type Row = Record<string, any>;
type History = { person: Row; entries: Row[]; total: number };
type Props = {
  people: Row[]; clients: Row[]; query: string; today: string; timezone: string; followUpsDue: number;
  post: (path: string, body?: Row) => Promise<any>; reload: () => Promise<void>;
  onEdit: (record: Row) => void; onAdd: () => void;
};
const stageNames: Record<string,string> = { potential:"Potential client", "in-discussion":"In discussion", "proposal-sent":"Proposal sent", ordered:"Website ordered", "active-client":"Active client", closed:"Closed" };
const activityNames: Record<string,string> = { "email-sent":"Email sent", "email-received":"Reply received", note:"Note" };
const isClient = (person: Row) => Boolean(person.client_id) || ["ordered","active-client"].includes(person.stage);
const due = (person: Row, today: string) => person.stage !== "closed" && person.next_follow_up && person.next_follow_up <= today;
function Stage({ value }: { value: string }) {
  return <span className={`badge badge-${value}`}><span className="status-dot" />{stageNames[value] || value}</span>;
}
function localInputNow() {
  const value = new Date();
  return new Date(value.getTime() - value.getTimezoneOffset() * 60000).toISOString().slice(0,16);
}
export default function Communications({ people, clients, query, today, timezone, followUpsDue, post, reload, onEdit, onAdd }: Props) {
  const [filter,setFilter] = useState("all"), [selectedId,setSelectedId] = useState("");
  const [history,setHistory] = useState<History | null>(null), [loading,setLoading] = useState(false), [error,setError] = useState("");
  const [logging,setLogging] = useState(false), [busy,setBusy] = useState(false), [notice,setNotice] = useState("");
  const detailRef = useRef<HTMLElement>(null);
  const selected = people.find(person => person.id === selectedId);
  const displayDate = (value?: string, time = false) => value ? new Intl.DateTimeFormat("en-GB", { timeZone:timezone, dateStyle:"medium", ...(time ? { timeStyle:"short" as const } : {}) }).format(new Date(value.length === 10 ? `${value}T12:00:00Z` : value)) : "No email logged";
  useEffect(() => {
    if (!selected) { setHistory(null); return; }
    const controller = new AbortController();
    setLoading(true); setError("");
    fetch(`/api/communications/${selected.id}`, { cache:"no-store", signal:controller.signal }).then(async response => {
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "The conversation could not load.");
      setHistory(result);
    }).catch(e => { if (e.name !== "AbortError") setError(e.message); }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [selected?.id,selected?.version]);
  function open(person: Row) {
    setSelectedId(person.id); setLogging(false); setNotice(""); setError("");
  }
  useEffect(() => { if (selectedId) detailRef.current?.scrollIntoView({ block:"nearest" }); }, [selectedId]);
  const rows = people.filter(person => {
    if (filter === "potential" && (isClient(person) || person.stage === "closed")) return false;
    if (filter === "clients" && !isClient(person)) return false;
    if (filter === "follow-ups" && !due(person,today)) return false;
    return `${person.name} ${person.company} ${person.email} ${person.phone} ${person.notes} ${person.next_action} ${stageNames[person.stage]}`.toLowerCase().includes(query.toLowerCase());
  });
  const person = history?.person.id === selectedId ? history.person : selected;
  async function convert() {
    if (!person) return;
    setBusy(true); setError("");
    try {
      await post(`communications/${person.id}/create-client`, { expectedVersion:person.version });
      await reload(); setNotice("Client created. This conversation and its history stay together.");
    } catch(e) { setError((e as Error).message); } finally { setBusy(false); }
  }
  return <>
    <div className="communication-summary">
      <div><span>Potential clients</span><strong>{people.filter(person => !isClient(person) && person.stage !== "closed").length}</strong></div>
      <div><span>Follow-ups due</span><strong>{followUpsDue}</strong></div>
      <div><span>Client conversations</span><strong>{people.filter(isClient).length}</strong></div>
    </div>
    <div className="section-tabs communication-filters">{[["all","Everyone"],["potential","Potential clients"],["clients","Clients"],["follow-ups","Follow-ups due"]].map(([value,label]) => <button key={value} className={filter === value ? "selected" : ""} onClick={() => setFilter(value)}>{label}</button>)}</div>
    <section className="panel">
      <div className="panel-heading"><div><h2>People & conversations</h2><p>Email dates reflect entries you log here. Keep following up before and after an order.</p></div></div>
      {rows.length ? <div className="table-scroll"><table><thead><tr><th scope="col">Person</th><th scope="col">Where we are</th><th scope="col">Last email sent</th><th scope="col">Next follow-up</th><th scope="col">Emails sent</th><th scope="col">Conversation</th></tr></thead><tbody>{rows.map(row => <tr key={row.id} className={selectedId === row.id ? "selected-row" : ""}>
        <td><div className="name-cell"><span className="client-avatar">{row.name.slice(0,1)}</span><div><button className="record-name" onClick={() => open(row)}>{row.name}</button><span className="subline">{row.company || row.email || "Potential website client"}</span></div></div></td>
        <td><Stage value={row.stage} /></td>
        <td><span className={!row.last_email_at ? "muted" : ""}>{displayDate(row.last_email_at,true)}</span></td>
        <td>{row.next_follow_up ? <><span className={due(row,today) ? "overdue-text" : ""}>{displayDate(row.next_follow_up)}</span><span className="subline">{due(row,today) ? "Follow-up due" : "Planned"}</span></> : <span className="muted">Not scheduled</span>}</td>
        <td>{row.emails_sent}</td><td><button className="text-button" onClick={() => open(row)}>Open <ChevronRight size={14} /></button></td>
      </tr>)}</tbody></table></div> : <div className="empty"><div className="empty-icon"><MessageSquare size={23} /></div><h3>{people.length ? "No matching conversations" : "Start with a person"}</h3><p>{people.length ? "Try another filter or search." : "Add someone interested in a website. Record your emails, current progress and when to follow up."}</p>{!people.length && <button className="primary" onClick={onAdd}><Plus size={16} />Add a person</button>}</div>}
    </section>
    {person && <section className="panel conversation-panel section-gap" ref={detailRef}>
      <div className="panel-heading"><div><h2>{person.name}{person.company ? ` · ${person.company}` : ""}</h2><p>{person.email || "Email not added"}{person.client_id ? ` · ${clients.find(client => client.id === person.client_id)?.name || "Linked client"}` : ""}</p></div><div className="conversation-heading-actions"><button className="text-button" onClick={() => onEdit(person)}>Edit person</button><button className="icon-button" aria-label="Close conversation" onClick={() => { setSelectedId(""); setLogging(false); }}><X size={18} /></button></div></div>
      <div className="conversation-body">
        {error && <div className="notice error" role="alert"><CircleAlert size={16} />{error}</div>}
        {notice && <div className="notice info" role="status"><Check size={16} />{notice}</div>}
        <div className="conversation-facts"><div><span>Where we are</span><Stage value={person.stage} /></div><div><span>Last email sent</span><strong>{displayDate(person.last_email_at,true)}</strong></div><div><span>Last reply</span><strong>{person.last_reply_at ? displayDate(person.last_reply_at,true) : "No reply logged"}</strong></div><div><span>Next follow-up</span><strong className={due(person,today) ? "overdue-text" : ""}>{person.next_follow_up ? displayDate(person.next_follow_up) : "Not scheduled"}</strong></div></div>
        {person.next_action && <div className="next-action"><CalendarDays size={17} /><div><span>Next action</span><p>{person.next_action}</p></div></div>}
        {person.notes && <p className="conversation-context preserve-lines">{person.notes}</p>}
        <div className="conversation-actions"><button className="primary" disabled={loading || busy} onClick={() => { setLogging(true); setNotice(""); }}><Mail size={16} />Log email / note</button>{!person.client_id && <button className="secondary" disabled={loading || busy} onClick={convert}><UserRoundPlus size={16} />{busy ? "Creating…" : "Create client"}</button>}{person.email && <a className="text-button" href={`mailto:${person.email}`}>Open email app <ArrowRight size={15} /></a>}</div>
        {logging && <EntryForm key={person.id} person={person} timezone={timezone} close={() => setLogging(false)} save={async input => {
          await post(`communications/${person.id}/entries`, input);
          await reload(); setLogging(false); setNotice("Communication recorded. Email dates and follow-up are updated.");
        }} />}
        <div className="timeline-heading"><h3>Conversation history</h3><span>{history?.total || 0} recorded {history?.total === 1 ? "entry" : "entries"}</span></div>
        {loading ? <div className="quiet-empty"><LoaderCircle className="spin" size={18} /><p>Loading conversation…</p></div> : history?.entries.length ? <div className="communication-timeline">{history.entries.map(entry => <article key={entry.id}><span className={`timeline-marker ${entry.type}`}><Mail size={15} /></span><div><div className="timeline-entry-heading"><strong>{entry.subject}</strong><time dateTime={entry.occurred_at}>{displayDate(entry.occurred_at,true)}</time></div><span className="timeline-kind">{activityNames[entry.type]}</span>{entry.notes && <p className="preserve-lines">{entry.notes}</p>}</div></article>)}</div> : <div className="quiet-empty"><MessageSquare size={20} /><p>Log the first email or note to start this conversation history.</p></div>}
        {history && history.total > history.entries.length && <p className="footnote">Showing the latest {history.entries.length} entries. Full business exports retain the complete history.</p>}
      </div>
    </section>}
  </>;
}

function EntryForm({ person, timezone, save, close }: { person:Row; timezone:string; save:(payload:Row)=>Promise<void>; close:()=>void }) {
  const [values,setValues] = useState<Row>({ type:"email-sent", occurred_at:localInputNow(), subject:"", notes:"", next_follow_up:"", next_action:person.next_action || "" });
  const [saving,setSaving] = useState(false), [error,setError] = useState("");
  const entryId = useRef(crypto.randomUUID());
  const change = (name:string,value:string) => setValues(previous => ({ ...previous,[name]:value }));
  async function submit(event:FormEvent) {
    event.preventDefault(); setSaving(true); setError("");
    try { await save({ ...values, id:entryId.current, expectedVersion:person.version, occurred_at:new Date(values.occurred_at).toISOString() }); }
    catch(e) { setError((e as Error).message); } finally { setSaving(false); }
  }
  return <form className="communication-entry-form" onSubmit={submit}><div className="entry-form-heading"><div><h3>Record a communication</h3><p>Log an email you have sent, a reply or a note. Dates are shown in {timezone}.</p></div><button type="button" className="icon-button" disabled={saving} onClick={close} aria-label="Close entry form"><X size={17} /></button></div>
    {error && <div className="notice error" role="alert">{error}</div>}
    <div className="form-grid"><div className="field"><label htmlFor="entry-type">Type</label><select id="entry-type" disabled={saving} value={values.type} onChange={e => change("type",e.target.value)}><option value="email-sent">Email sent</option><option value="email-received">Reply received</option><option value="note">Note</option></select></div><div className="field"><label htmlFor="entry-time">When it happened</label><input id="entry-time" type="datetime-local" required disabled={saving} value={values.occurred_at} onChange={e => change("occurred_at",e.target.value)} /></div><div className="field full"><label htmlFor="entry-subject">Subject / what was discussed</label><input id="entry-subject" required maxLength={300} disabled={saving} value={values.subject} onChange={e => change("subject",e.target.value)} /></div><div className="field full"><label htmlFor="entry-notes">Notes</label><textarea id="entry-notes" rows={3} maxLength={10000} disabled={saving} value={values.notes} onChange={e => change("notes",e.target.value)} /></div><div className="field"><label htmlFor="entry-followup">Next follow-up</label><input id="entry-followup" type="date" disabled={saving} value={values.next_follow_up} onChange={e => change("next_follow_up",e.target.value)} /><small>Choose the next reminder date, or leave blank to clear the previous one.</small></div><div className="field"><label htmlFor="entry-action">Next action</label><input id="entry-action" maxLength={2048} disabled={saving} value={values.next_action} onChange={e => change("next_action",e.target.value)} /></div></div><div className="entry-form-actions"><button type="button" className="secondary" disabled={saving} onClick={close}>Cancel</button><button className="primary" disabled={saving}>{saving ? <LoaderCircle className="spin" size={16} /> : <Check size={16} />}{saving ? "Saving…" : "Save communication"}</button></div>
  </form>;
}
