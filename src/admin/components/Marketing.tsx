"use client";
import { Fragment, useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from "react";
import { ArrowUpRight, CalendarDays, Check, ChevronLeft, ChevronRight, CircleAlert, Download, LoaderCircle, Megaphone, Pencil, Plus, RefreshCw, Search, SlidersHorizontal, Trash2, X } from "lucide-react";
import { filterMarketing, marketingCsv, marketingEmails, marketingFields, paymentLabels, priorities, safeMarketingUrl, stages } from "../../shared/marketing.mjs";
import Modal from "./Modal";

type Row = Record<string, any>;
type Archive = { records: Row[]; contest_history: Row[]; sources: { file: string }[]; import_summary: Row };
const payments = paymentLabels as Record<string, string>;
const initialFilters = { query: "", priority: "", year: "", stage: "", payment: "", email: "", contact: "", followUp: "", from: "", to: "", sort: "recent" };
const label = (value: string) => value.replaceAll("-", " ").replace(/^./, c => c.toUpperCase());
const date = (value: string) => value ? new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Skopje", dateStyle: "medium" }).format(new Date(`${value}T12:00:00Z`)) : "Not recorded";
function Link({ url, children }: { url: string; children: ReactNode }) {
  const href = safeMarketingUrl(url);
  return href ? <a className="text-button" href={href} target="_blank" rel="noreferrer">{children}<ArrowUpRight size={13} /></a> : null;
}
function Badge({ value, text }: { value: string; text?: string }) {
  return <span className={`badge badge-${value}`}><span className="status-dot" />{text || label(value)}</span>;
}
function ContactChannel({ value, allowEmail }: { value: string; allowEmail: boolean }) {
  const emails = marketingEmails(value);
  if (!allowEmail || !emails.length) return value;
  const pattern = new RegExp(`(${[...emails].sort((a, b) => b.length - a.length).map(email => email.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})`, "gi");
  return value.split(pattern).map((part, index) => emails.includes(part.toLowerCase())
    ? <a className="marketing-email-link" key={index} href={`mailto:${encodeURIComponent(part)}`}>{part}</a> : part);
}
function uniqueLinks(links: [string, string][], seen = new Set<string>()) {
  return links.filter(([url]) => {
    const href = safeMarketingUrl(url);
    if (!href || seen.has(href)) return false;
    seen.add(href); return true;
  });
}
function contactNotes(record: Row) {
  const notes = String(record.notes || "").trim();
  let paymentNotes = String(record.payment_notes || "").trim();
  const relationship = String(record.relationship || "").trim();
  // The initial importer composed payment notes from these existing fields.
  // Strip only that exact prefix, preserving any distinct payment information.
  if (relationship && paymentNotes.startsWith(`${relationship}. `)) paymentNotes = paymentNotes.slice(relationship.length + 2).trim();
  if (paymentNotes === relationship || notes.includes(paymentNotes)) paymentNotes = "";
  const paragraphs: string[] = [];
  for (const value of [notes, ...(record.history || []).map((item: Row) => item.original_year_tab_notes)]) {
    const text = String(value || "").trim();
    if (text && !paragraphs.some(previous => previous.includes(text)) && !paymentNotes.includes(text)) paragraphs.push(text);
  }
  return { notes: paragraphs.join("\n\n"), paymentNotes };
}

function ContactForm({ record, close, save }: { record?: Row; close: () => void; save: (record: Row) => Promise<void> }) {
  const [values, setValues] = useState<Row>(() => Object.fromEntries(marketingFields.map(field => [field, record?.[field] ?? ({ priority: "review", stage: "to-review", payment_status: "unknown" } as Row)[field] ?? ""])));
  const [saving, setSaving] = useState(false), [error, setError] = useState("");
  const savingRef = useRef(false), closeRef = useRef(close); closeRef.current = close;
  const guardedClose = useRef(() => { if (!savingRef.current) closeRef.current(); }).current;
  const set = (field: string, value: string) => setValues(previous => ({ ...previous, [field]: value }));
  function field(name: string, title: string, type = "text", full = false, hint?: string) {
    return <div className={`field ${full ? "full" : ""}`} key={name}><label htmlFor={`marketing-${name}`}>{title}{name === "name" && <span className="required"> *</span>}</label>
      {type === "textarea" ? <textarea id={`marketing-${name}`} rows={3} value={values[name]} disabled={saving} maxLength={20000} onChange={event => set(name, event.target.value)} /> : <input id={`marketing-${name}`} type={type} required={name === "name"} maxLength={4000} value={values[name]} disabled={saving} onChange={event => set(name, event.target.value)} />}{hint && <small>{hint}</small>}</div>;
  }
  function select(name: string, title: string, options: string[], labels?: Record<string, string>) {
    return <div className="field"><label htmlFor={`marketing-${name}`}>{title}</label><select id={`marketing-${name}`} disabled={saving} value={values[name]} onChange={event => set(name, event.target.value)}>{options.map(value => <option value={value} key={value}>{labels?.[value] || label(value)}</option>)}</select></div>;
  }
  async function submit(event: FormEvent) {
    event.preventDefault(); setSaving(true); savingRef.current = true; setError("");
    try { await save(values); } catch (error) { setError((error as Error).message); }
    finally { setSaving(false); savingRef.current = false; }
  }
  return <Modal title={record ? "Edit marketing contact" : "Add marketing contact"} close={guardedClose}><form onSubmit={submit}>
    <div className="form-body">{error && <div className="notice error" role="alert">{error}</div>}<div className="form-grid">
      {field("name", "Business / contact name", "text", true)}{field("contact", "Contact people")}{field("email", "Emails / contact channel", "text", false, "Keep multiple emails or the original platform contact instructions.")}
      {field("phone", "Phone")}{field("year", "Archive year")}{select("priority", "Priority", priorities)}{select("stage", "Campaign stage", stages)}
      {field("last_contact", "Last contacted", "date")}{field("follow_up", "Next follow-up", "date")}{field("next_action", "Next action", "textarea", true)}
      {field("opportunity", "Opportunity", "textarea", true)}{field("relationship", "Past relationship", "textarea", true)}
      {select("payment_status", "Historical payment evidence", Object.keys(payments), payments)}{field("website", "Website", "url")}
      {field("payment_notes", "Payment notes / amounts", "textarea", true, "Keep the original currency and whether an amount was paid, quoted or expected. Historical notes do not change Stripe totals.")}
      {field("website_status", "Website verification / status", "text", true)}{field("gmail_thread", "Original Gmail thread", "url", true)}{field("website_evidence", "Website evidence link", "url", true)}{field("notes", "Notes", "textarea", true)}
    </div></div><div className="form-footer"><button type="button" className="secondary" disabled={saving} onClick={close}>Cancel</button><button className="primary" disabled={saving}>{saving ? <LoaderCircle size={16} className="spin" /> : <Check size={16} />}{saving ? "Saving..." : "Save contact"}</button></div>
  </form></Modal>;
}

export default function Marketing({ today }: { today: string }) {
  const [archive, setArchive] = useState<Archive | null>(null), [error, setError] = useState(""), [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(true), [filters, setFilters] = useState(initialFilters), [page, setPage] = useState(1);
  const [showFilters, setShowFilters] = useState(false);
  const [selectedId, setSelectedId] = useState(""), [editor, setEditor] = useState<{ record?: Row } | null>(null);
  const [deleting, setDeleting] = useState<Row | null>(null), [busy, setBusy] = useState(false), [deleteError, setDeleteError] = useState("");
  const detailTrigger = useRef<HTMLButtonElement | null>(null), closeEditor = useRef(() => setEditor(null)).current;
  const deleteBusy = useRef(false), closeDelete = useRef(() => { if (!deleteBusy.current) { setDeleting(null); setDeleteError(""); } }).current;
  async function load(signal?: AbortSignal) {
    setLoading(true);
    try {
      const response = await fetch("/api/marketing", { cache: "no-store", signal });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "The marketing list could not load.");
      if (!signal?.aborted) { setArchive(payload); setError(""); }
    } catch (error) { if (!signal?.aborted) setError((error as Error).message); }
    finally { if (!signal?.aborted) setLoading(false); }
  }
  useEffect(() => { const controller = new AbortController(); void load(controller.signal); return () => controller.abort(); }, []);
  useEffect(() => { setPage(1); setSelectedId(""); }, [filters]);
  useEffect(() => { if (!notice) return; const timer = setTimeout(() => setNotice(""), 6000); return () => clearTimeout(timer); }, [notice]);
  const records = archive?.records || [], selected = records.find(row => row.id === selectedId);
  const rows: Row[] = useMemo(() => filterMarketing(archive?.records || [], filters, today), [archive, filters, today]);
  const years = [...new Set(records.flatMap(row => [row.year, ...(row.history || []).map((item: Row) => item.year)]).filter(Boolean))].sort().reverse() as string[];
  const maxPage = Math.max(1, Math.ceil(rows.length / 25)), currentPage = Math.min(page, maxPage), start = (currentPage - 1) * 25;
  const due = records.filter(row => row.follow_up && row.follow_up <= today && !["do-not-contact", "not-interested", "won"].includes(row.stage)).length;
  const filtersActive = Object.entries(filters).some(([key, value]) => key !== "sort" && Boolean(value));
  const advancedFilterCount = Object.entries(filters).filter(([key, value]) => !["query", "sort"].includes(key) && Boolean(value)).length;
  const setFilter = (name: keyof typeof initialFilters, value: string) => setFilters(previous => ({ ...previous, [name]: value }));
  async function post(body: Row) {
    const response = await fetch("/api/marketing", { method: "POST", headers: { "Content-Type": "application/json", "x-platform-request": "admin" }, body: JSON.stringify(body) });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || "The contact could not be saved.");
    return payload;
  }
  async function save(values: Row) {
    const previous = editor?.record;
    const { record } = await post({ action: "save", id: previous?.id, version: previous?.version, record: values });
    setArchive(current => current && ({ ...current, records: previous ? current.records.map(row => row.id === record.id ? record : row) : [...current.records, record] }));
    setEditor(null); setSelectedId(record.id); setNotice("Marketing contact saved.");
  }
  async function remove() {
    if (!deleting) return;
    setBusy(true); deleteBusy.current = true; setDeleteError("");
    try {
      await post({ action: "delete", id: deleting.id, version: deleting.version });
      setArchive(current => current && ({ ...current, records: current.records.filter(row => row.id !== deleting.id) }));
      if (selectedId === deleting.id) setSelectedId("");
      setDeleting(null); setNotice("Marketing contact deleted.");
    } catch (error) { setDeleteError((error as Error).message); }
    finally { setBusy(false); deleteBusy.current = false; }
  }
  function exportCsv() {
    const url = URL.createObjectURL(new Blob(["\uFEFF", marketingCsv(rows)], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a"); link.href = url; link.download = `marketing-filtered-${today}.csv`; link.click(); URL.revokeObjectURL(url);
  }
  function filter(name: keyof typeof initialFilters, title: string, options: [string, string][]) {
    return <label className="marketing-filter"><span>{title}</span><select value={filters[name]} onChange={event => setFilter(name, event.target.value)}>{options.map(([value, text]) => <option value={value} key={value}>{text}</option>)}</select></label>;
  }
  function toggleDetails(row: Row, trigger: HTMLButtonElement) {
    detailTrigger.current = trigger;
    setSelectedId(current => current === row.id ? "" : row.id);
  }
  function closeDetails() { setSelectedId(""); detailTrigger.current?.focus(); }
  function changePage(next: number) { setPage(next); setSelectedId(""); }
  const emails = selected ? marketingEmails(selected.email) : [];
  const related = selected ? records.filter(row => row.id !== selected.id && marketingEmails(row.email).some(email => emails.includes(email))) : [];
  const notes = selected ? contactNotes(selected) : { notes: "", paymentNotes: "" };
  const detailLinks = selected ? uniqueLinks([[selected.website, "Website"], [selected.gmail_thread, "Original email thread"], [selected.website_evidence, "Website evidence"]]) : [];
  const seenDetailLinks = new Set(detailLinks.map(([url]) => safeMarketingUrl(url)));
  const contactDetails = selected && <section className="marketing-detail" id={`marketing-details-${selected.id}`} aria-label={`Contact details for ${selected.name}`}><div className="panel-heading"><h2>More details</h2><div className="marketing-row-actions"><button className="text-button" onClick={() => setEditor({ record: selected })}><Pencil size={14} />Edit contact</button><button className="icon-button" aria-label="Close contact details" onClick={closeDetails}><X size={18} /></button></div></div>
        <div className="marketing-detail-body">
          <dl className="marketing-facts">{[["Contact channel", selected.email], ["Phone", selected.phone], ["Past relationship", selected.relationship], ["Opportunity", selected.opportunity], ["Next action", selected.next_action], ["Website status", selected.website_status], ["Payment notes / amounts", notes.paymentNotes], ["Notes", notes.notes]].filter(([, value]) => Boolean(value)).map(([title, value]) => <div key={title}><dt>{title}</dt><dd>{title === "Contact channel" ? <ContactChannel value={value} allowEmail={selected.stage !== "do-not-contact"} /> : value}</dd></div>)}</dl>
          {detailLinks.length > 0 && <div className="marketing-source-links">{detailLinks.map(([url, title]) => <Link key={url} url={url}>{title}</Link>)}</div>}
          {related.length > 0 && <div className="notice info"><CircleAlert size={16} /><span>Other records share an email address: {related.map(row => row.name).join("; ")}. Review these together before contacting the same person.</span></div>}
          {selected.contests?.length > 0 && <div className="marketing-contest-notes"><h3>Contest details</h3>{selected.contests.map((contest: Row) => {
            const links = uniqueLinks([[contest.contest_url, "Contest"], [contest.gmail_thread, "Contest email thread"]], seenDetailLinks);
            return <article key={contest.source_index}><h4>{contest.name}</h4><dl className="marketing-facts">{[["Year", contest.year], ["Contest ID", contest.contest_id], ["Result", contest.result], ["Prize", contest.prize], ["Files accepted", contest.files_accepted ? date(contest.files_accepted) : ""], ["Company status", contest.company_status], ["Next step", contest.next_action]].filter(([, value]) => Boolean(value)).map(([title, value]) => <div key={title}><dt>{title}</dt><dd>{value}</dd></div>)}</dl>{links.length > 0 && <div className="marketing-source-links">{links.map(([url, title]) => <Link key={url} url={url}>{title}</Link>)}</div>}</article>;
          })}</div>}
        </div></section>;
  return <div className="marketing-section">
    <div className="marketing-actions"><span className="muted">Past clients, inquiries and research leads</span><div><button className="secondary" disabled={loading} onClick={() => void load()} aria-label="Reload marketing contacts"><RefreshCw size={15} className={loading ? "spin" : ""} />Reload</button><a className="secondary" href="/api/marketing?download=1"><Download size={15} />JSON backup</a><button className="primary" disabled={!archive} onClick={() => setEditor({})}><Plus size={16} />Add contact</button></div></div>
    {error && <div className="notice error" role="alert"><CircleAlert size={17} /><span>{error}</span><button className="text-button" onClick={() => void load()}>Retry</button></div>}
    {notice && <div className="toast" role="status"><Check size={17} />{notice}</div>}
    {!archive ? loading && <div className="loading"><LoaderCircle size={24} className="spin" />Loading your marketing contacts...</div> : <>
      <div className="metrics marketing-metrics"><div className="metric"><div className="metric-label">Contacts in your list<Megaphone size={18} /></div><strong>{records.length}</strong><span>{archive.import_summary.lead_records} historical records imported</span></div><div className="metric"><div className="metric-label">High priority<SlidersHorizontal size={18} /></div><strong>{records.filter(row => row.priority === "high").length}</strong><span>Use the priority filter to focus your list</span></div><div className="metric"><div className="metric-label">Payment evidence<Check size={18} /></div><strong>{records.filter(row => ["paid", "deposit"].includes(row.payment_status)).length}</strong><span>Archive reports payment or a deposit</span></div><div className="metric"><div className="metric-label">Follow-ups due<CalendarDays size={18} /></div><strong>{due}</strong><span>Dates you schedule for this campaign</span></div></div>
      <section className="panel marketing-filter-panel" aria-label="Filter marketing contacts"><div className="marketing-search-row"><label className="search"><Search size={17} /><input type="search" aria-label="Search marketing contacts" placeholder="Search business, people, emails or notes..." value={filters.query} onChange={event => setFilter("query", event.target.value)} /></label><span className="muted" role="status">{rows.length} of {records.length} contacts</span><div className="marketing-filter-actions"><button className="secondary marketing-filter-toggle" aria-expanded={showFilters} aria-controls="marketing-extra-filters" onClick={() => setShowFilters(current => !current)}><SlidersHorizontal size={14} />{showFilters ? "Hide filters" : "Show more filters"}{advancedFilterCount > 0 && <span className="marketing-active-filters">{advancedFilterCount} active</span>}</button><button className="text-button" disabled={!filtersActive} onClick={() => setFilters(initialFilters)}><X size={14} />Clear filters</button></div></div>
        <div className="marketing-filter-options" id="marketing-extra-filters" hidden={!showFilters}><div className="marketing-filters">
          {filter("priority", "Priority", [["", "All priorities"], ...priorities.map(value => [value, label(value)] as [string, string])])}
          {filter("year", "Archive year", [["", "All years"], ...years.map(value => [value, value] as [string, string])])}
          {filter("contact", "Last contacted", [["", "Any time"], ["recent", "Within 30 days"], ["90", "90+ days ago"], ["365", "1+ year ago"], ["missing", "No date recorded"]])}
          {filter("payment", "Payment history", [["", "All payment records"], ["evidence", "Any payment / quote notes"], ...Object.entries(payments)])}
          {filter("stage", "Campaign stage", [["", "All stages"], ...stages.map(value => [value, label(value)] as [string, string])])}
          {filter("email", "Email", [["", "All contact channels"], ["available", "Has email address"], ["missing", "Platform / no email"]])}
          {filter("followUp", "Follow-up", [["", "All follow-ups"], ["due", "Due today or earlier"]])}
          {filter("sort", "Sort by", [["recent", "Most recently contacted"], ["oldest", "Longest since contact"], ["priority", "Highest priority"], ["name", "Business A-Z"], ["follow-up", "Next follow-up"]])}
          <label className="marketing-filter"><span>Contacted from</span><input type="date" value={filters.from} onChange={event => setFilter("from", event.target.value)} /></label><label className="marketing-filter"><span>Contacted through</span><input type="date" min={filters.from} value={filters.to} onChange={event => setFilter("to", event.target.value)} /></label>
        </div>{filters.from && filters.to && filters.from > filters.to && <p className="marketing-filter-hint" role="status">The start date is after the end date. Adjust the date range to see contacts.</p>}</div>
      </section>
      <section className="panel section-gap"><div className="panel-heading"><div><h2>Marketing contacts</h2><p>Open a contact for the full relationship, payment evidence and next action.</p></div><button className="secondary" disabled={!rows.length} onClick={exportCsv}><Download size={15} />Export filtered CSV</button></div>
        {rows.length ? <><div className="table-scroll"><table className="marketing-table"><thead><tr>{["Business / contact", "Priority", "Last contacted", "Payment history", "Campaign", "Actions"].map(title => <th scope="col" key={title}>{title}</th>)}</tr></thead><tbody>{rows.slice(start, start + 25).map((row, index) => <Fragment key={row.id}><tr className={`marketing-contact-row ${(start + index) % 2 === 1 ? "marketing-contact-even" : ""} ${selectedId === row.id ? "selected-row" : ""}`}>
          <td><button className="record-name" aria-expanded={selectedId === row.id} aria-controls={`marketing-details-${row.id}`} onClick={event => toggleDetails(row, event.currentTarget)}>{row.name}</button><span className="subline">{row.contact || "Contact not identified"}</span>{selectedId !== row.id && <span className="subline marketing-email">{row.email || row.phone || "Contact details not recorded"}</span>}</td>
          <td><Badge value={row.priority} /><span className="subline">Archive: {row.year || "Manual entry"}</span></td><td>{date(row.last_contact)}{row.follow_up && <span className={`subline ${row.follow_up <= today && !["do-not-contact", "not-interested", "won"].includes(row.stage) ? "overdue-text" : ""}`}>Follow-up: {date(row.follow_up)}</span>}</td>
          <td><Badge value={row.payment_status} text={payments[row.payment_status]} /><span className="subline marketing-evidence">{row.payment_notes ? "Details in contact notes" : "No verified receipt in archive"}</span></td><td><Badge value={row.stage} />{selectedId !== row.id && <span className="subline marketing-next-action">{row.next_action || "Set the next action"}</span>}</td>
          <td><div className="marketing-row-actions"><button className="text-button marketing-details-toggle" aria-expanded={selectedId === row.id} aria-controls={`marketing-details-${row.id}`} aria-label={`${selectedId === row.id ? "Hide" : "Show"} details for ${row.name}`} onClick={event => toggleDetails(row, event.currentTarget)}>{selectedId === row.id ? "Hide details" : "Details"}<ChevronRight size={13} /></button><button className="icon-button" aria-label={`Edit ${row.name}`} onClick={() => setEditor({ record: row })}><Pencil size={15} /></button><button className="icon-button" aria-label={`Delete ${row.name}`} onClick={() => { setDeleteError(""); setDeleting(row); }}><Trash2 size={15} /></button></div></td>
        </tr>{selectedId === row.id && <tr className={`marketing-expanded-row ${(start + index) % 2 === 1 ? "marketing-contact-even" : ""}`}><td colSpan={6}>{contactDetails}</td></tr>}</Fragment>)}</tbody></table></div><div className="marketing-pagination"><span>{start + 1}-{Math.min(start + 25, rows.length)} of {rows.length}</span><div><button className="secondary" disabled={currentPage === 1} onClick={() => changePage(currentPage - 1)}><ChevronLeft size={15} />Previous</button><span>Page {currentPage} of {maxPage}</span><button className="secondary" disabled={currentPage === maxPage} onClick={() => changePage(currentPage + 1)}>Next<ChevronRight size={15} /></button></div></div></> : <div className="empty"><div className="empty-icon"><Search size={23} /></div><h3>{records.length ? "No matching contacts" : "Your marketing list is empty"}</h3><p>{records.length ? "Adjust the filters or search for another name, email or note." : "Add a contact to start your next campaign."}</p>{filtersActive && <button className="secondary" onClick={() => setFilters(initialFilters)}>Clear filters</button>}</div>}
        <div className="panel-foot">Payment labels describe historical evidence in the archive. Quotes and expected prizes are kept separate from reported payments. Stripe maintenance totals remain in Payments.</div>
      </section>

      <details className="panel section-gap marketing-archive"><summary>Contest history archive <span>{archive.contest_history.length} entries</span></summary><div className="panel-foot">Includes the platform-selected crowdSPRING award with no identified client. The original result and prize wording is preserved.</div><div className="table-scroll"><table><thead><tr>{["Year / contest", "Result", "Prize evidence", "Sources / next step"].map(title => <th scope="col" key={title}>{title}</th>)}</tr></thead><tbody>{archive.contest_history.map(contest => <tr key={contest.source_index}><td><strong className="wrap-text">{contest.name}</strong><span className="subline">{contest.year} / ID {contest.contest_id || "Not recorded"}</span></td><td><span className="wrap-text">{contest.result}</span><span className="subline">Files accepted: {contest.files_accepted}</span></td><td>{contest.prize}<span className="subline wrap-text">{contest.company_status}</span></td><td><div className="marketing-source-links"><Link url={contest.contest_url}>Contest</Link><Link url={contest.gmail_thread}>Email evidence</Link></div><span className="subline wrap-text">{contest.next_action}</span><span className="subline">Report pages {contest.source_pages.join(", ")}</span></td></tr>)}</tbody></table></div></details>
      <p className="footnote">Imported from both Business Prospects 2013-2026 PDFs. The sources contain 2014-2026 records; 2013 has no corroborated entries. Emails are sent through your email app; this section saves your campaign notes and dates.</p>
    </>}
    {editor && <ContactForm record={editor.record} close={closeEditor} save={save} />}
    {deleting && <Modal title="Delete marketing contact?" close={closeDelete}><div className="form-body">{deleteError && <div className="notice error" role="alert">{deleteError} Close this dialog and reload the list before trying again.</div>}<p className="marketing-delete-copy">Remove <strong>{deleting.name}</strong> from your marketing list? The original PDFs and contest archive are retained.</p></div><div className="form-footer"><button className="secondary" disabled={busy} onClick={closeDelete}>Cancel</button><button className="primary marketing-delete-button" disabled={busy || Boolean(deleteError)} onClick={() => void remove()}>{busy ? <LoaderCircle size={16} className="spin" /> : <Trash2 size={16} />}{busy ? "Deleting..." : "Delete contact"}</button></div></Modal>}
  </div>;
}
