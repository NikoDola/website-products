"use client";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { LayoutDashboard, UsersRound, Globe2, Wallet, ListTodo, ClipboardList, MessageSquare, Settings, Search, Plus, ArrowUpRight, RefreshCw, X, ChevronRight, Check, CircleAlert, Menu, Download, Activity, CalendarDays, ArrowRight, LoaderCircle, ShieldCheck, Link2, Megaphone } from "lucide-react";
import { entities as rawEntities, currencyDigits } from "../../shared/entities.mjs";
import { businessDate } from "../../shared/time.mjs";
import Communications from "./Communications";
import MarketingHub from "./MarketingHub";
import { adminSelection, adminUrl } from "../../shared/admin-navigation.mjs";
import Modal from "./Modal";
import ClientActions from "./ClientActions";
import ClientDetails from "./ClientDetails";
import RecordForm from "./RecordForm";
import { monthlyPricing } from "../../shared/client-summary.mjs";

type Row = Record<string, any>;
type Data = Record<string, Row[]> & { connections: Row; summary: Row };
type Field = { name: string; label: string; type: string; required?: boolean; createOnly?: boolean; options?: string[]; hint?: string; default?: string };
type Entity = { label: string; singular: string; fields: Field[] };
const entities = rawEntities as Record<string, Entity>;
const navigation = [
  ["overview", "Overview", LayoutDashboard], ["clients", "Clients", UsersRound], ["sites", "Websites", Globe2],
  ["payments", "Payments", Wallet], ["communications", "Communications", MessageSquare], ["marketing", "Marketing", Megaphone],
  ["tasks", "Tasks", ListTodo], ["settings", "Settings", Settings]
] as const;
type Tab = typeof navigation[number][0];
const descriptions: Record<Tab, string> = {
  overview: "A clear view of your clients, websites and work ahead.", clients: "The people and businesses you work with.",
  sites: "Every client website, with its own home and history.", payments: "Track maintenance subscriptions and their payments.",
  tasks: "Maintenance, requests and the next thing to do.",
  communications: "Potential clients, ongoing conversations and your next follow-up.",
  marketing: "Reconnect with past clients and find your next opportunity.",
  settings: "Business details, connections and your records."
};
const titles: Record<Tab, string> = { overview: "Overview", clients: "Clients", sites: "Websites", payments: "Payments", communications: "Communications", marketing: "Marketing", tasks: "Tasks", settings: "Settings" };
function Badge({ value }: { value: string }) {
  const label = value.replaceAll("-", " ");
  return <span className={`badge badge-${value}`}><span className="status-dot" />{label}</span>;
}
function Empty({ title, text, action }: { title: string; text: string; action?: ReactNode }) {
  return <div className="empty"><div className="empty-icon"><ClipboardList size={23} /></div><h3>{title}</h3><p>{text}</p>{action}</div>;
}
function Panel({ title, subtitle, action, children, className = "" }: { title: string; subtitle?: string; action?: ReactNode; children: ReactNode; className?: string }) {
  return <section className={`panel ${className}`}><div className="panel-heading"><div><h2>{title}</h2>{subtitle && <p>{subtitle}</p>}</div>{action}</div>{children}</section>;
}
function Table({ columns, rows, empty }: { columns: { title: string; cell: (row: Row) => ReactNode }[]; rows: Row[]; empty?: ReactNode }) {
  if (!rows.length) return empty || <Empty title="Nothing here yet" text="Add your first record to get started." />;
  return <div className="table-scroll"><table><thead><tr>{columns.map(col => <th key={col.title} scope="col">{col.title}</th>)}</tr></thead><tbody>{rows.map(row => <tr key={row.id}>{columns.map(col => <td key={col.title}>{col.cell(row)}</td>)}</tr>)}</tbody></table></div>;
}
export default function Dashboard({ actor, local, initialMarketing }: { actor: string; local: boolean; initialMarketing?: "current" | "new" }) {
  const [data, setData] = useState<Data | null>(null), [tab, setTab] = useState<Tab>(initialMarketing ? "marketing" : "overview"), [query, setQuery] = useState("");
  const [marketingSection, setMarketingSection] = useState<"current" | "new">(initialMarketing || "current");
  const [error, setError] = useState(""), [notice, setNotice] = useState(""), [busy, setBusy] = useState("");
  const [editor, setEditor] = useState<{ entity: string; record?: Row } | null>(null), [detail, setDetail] = useState<Row | null>(null);
  const [paymentView, setPaymentView] = useState("invoices"), [siteView, setSiteView] = useState("websites"), [mobile, setMobile] = useState(false);
  const closeEditor = useRef(() => setEditor(null)).current, closeDetail = useRef(() => setDetail(null)).current;
  const business: Row = data?.settings?.[0] || { name: "Website Products", currency: "usd", timezone: "Europe/Skopje", country: "North Macedonia", email: "" }, timezone = business.timezone;
  const date = (value?: string, time = false) => value ? new Intl.DateTimeFormat("en-GB", { timeZone: timezone, dateStyle: "medium", ...(time ? { timeStyle: "short" as const } : {}) }).format(new Date(value.length === 10 ? `${value}T12:00:00Z` : value)) : "—";
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  const money = (amount: number, currency: string) => new Intl.NumberFormat("en-US", { style: "currency", currency: currency || "usd" }).format(amount / 10 ** (currencyDigits(currency || "usd") || 0));
  const clientName = (id: string) => data?.clients?.find(item => item.id === id)?.name || "Unassigned";
  const siteName = (id: string) => data?.sites?.find(item => item.id === id)?.name || "—";
  async function load() {
    const response = await fetch("/api/snapshot", { cache: "no-store" });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || "The workspace could not load.");
    setData(payload); setError("");
  }
  useEffect(() => {
    const sync = () => {
      const selection = adminSelection(window.location.pathname, window.location.search);
      if (navigation.some(item => item[0] === selection.tab)) setTab(selection.tab as Tab);
      setMarketingSection(selection.marketing as "current" | "new");
    };
    sync(); window.addEventListener("popstate", sync);
    load().catch(e => setError(e.message));
    return () => window.removeEventListener("popstate", sync);
  }, []);
  useEffect(() => { const timer = setInterval(() => load().catch(e => setError(e.message)), 60000); return () => clearInterval(timer); }, []);
  useEffect(() => { if (!notice) return; const timer = setTimeout(() => setNotice(""), 6000); return () => clearTimeout(timer); }, [notice]);
  function navigate(value: Tab) { setTab(value); setQuery(""); setMobile(false); history.replaceState(null, "", adminUrl(value, marketingSection)); }
  async function action(path: string, body: Row = {}) {
    const response = await fetch(`/api/${path}`, { method: "POST", headers: { "Content-Type": "application/json", "x-platform-request": "admin" }, body: JSON.stringify(body) });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "The request could not complete.");
    return result;
  }
  async function job(kind: string) {
    setBusy(kind); setError("");
    try { const result = await action(`jobs/${kind}`); await load(); setNotice(kind === "stripe" ? `Synced ${result.subscriptions} maintenance subscription(s).` : `Checked ${result.checked} website signal(s).`); }
    catch (e) { setError((e as Error).message); } finally { setBusy(""); }
  }
  const filtered = (rows: Row[] = []) => rows.filter(row => `${Object.values(row).join(" ")} ${clientName(row.client_id)}`.toLowerCase().includes(query.toLowerCase()));
  const add = (entity: string, label?: string) => <button className="primary" onClick={() => setEditor({ entity })}><Plus size={17} />{label || `Add ${entities[entity].singular}`}</button>;
  const edit = (entity: string, row: Row) => <button className="text-button small" onClick={() => setEditor({ entity, record: row })}>Edit <ChevronRight size={14} /></button>;
  const latest = (siteId: string, kind: string) => data?.health_checks?.find(row => row.site_id === siteId && row.kind === kind);
  const health = (site: Row, kind: string) => {
    if (!site.monitor_enabled) return "disabled";
    const check = latest(site.id, kind);
    if (!check) return kind === "cms" && !site.cms_status_url ? "not-configured" : "not-checked";
    return Date.now() - Date.parse(check.checked_at) > 20 * 60000 ? "stale" : check.status;
  };
  const link = (url: string, title: string) => url ? <a className="text-button" href={url} target="_blank" rel="noreferrer">{title}<ArrowUpRight size={14} /></a> : <span className="muted">—</span>;
  function websiteTable(rows: Row[]) {
    return <Table rows={filtered(rows)} columns={[
      { title: "Website", cell: row => <div className="name-cell"><span className="site-icon"><Globe2 size={19} /></span><div><button className="record-name" onClick={() => setEditor({ entity: "sites", record: row })}>{row.name}</button><span className="subline">{new URL(row.public_url).hostname}</span></div></div> },
      { title: "Client", cell: row => clientName(row.client_id) }, { title: "Status", cell: row => <Badge value={row.state} /> },
      { title: "Website health", cell: row => <Badge value={health(row, "public")} /> },
      { title: "Links", cell: row => <div className="row-links">{link(row.public_url, "Visit")}{link(row.cms_url, "Editor")}</div> }
    ]} empty={<Empty title="Add a website" text="Register a client project to keep its details and health together." action={add("sites")} />} />;
  }
  const invoices = data?.invoices || [], payments = data?.payments || [];
  const maintenanceServices = (data?.agreements || []).filter(service => service.cadence !== "one-time");
  const linkedMaintenance = maintenanceServices.filter(service => service.stripe_subscription_id && service.stripe_mode === data?.connections.stripeMode);
  const detailedClient = data?.clients.find(client => client.id === detail?.id) || detail;
  const overdue = invoices.filter(row => row.status === "open" && row.amount_remaining > 0 && row.due_at && businessDate(timezone,new Date(row.due_at)) < today);
  const openTasks = (data?.tasks || []).filter(row => !["done", "cancelled"].includes(row.status));
  const totals = (rows: Row[], amount: (row: Row) => number) => {
    const values: Record<string, number> = {};
    for (const row of rows) values[row.currency] = (values[row.currency] || 0) + amount(row);
    return Object.entries(values).map(([currency, amount]) => money(amount, currency)).join(" · ") || "—";
  };
  function downloadCsv() {
    const rows = paymentView === "transactions" ? payments : invoices;
    const columns = paymentView === "transactions" ? ["stripe_id", "client_id", "stripe_subscription_id", "stripe_invoice_id", "description", "amount", "refunded", "currency", "status", "paid_at", "mode"] : ["number", "client_id", "stripe_subscription_id", "description", "amount_due", "amount_paid", "amount_remaining", "currency", "status", "due_at", "paid_at", "mode"];
    const escape = (value: unknown) => `"${String(value ?? "").replace(/^[=+@-]/, "'$&").replaceAll('"', '""')}"`;
    const csv = [columns.join(","), ...rows.map(row => columns.map(key => escape(row[key])).join(","))].join("\r\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a"); a.href = url; a.download = `${paymentView}-${data?.connections.stripeMode}-${today}.csv`; a.click(); URL.revokeObjectURL(url);
  }
  function paymentsTable(rows = invoices) {
    return <Table rows={filtered(rows)} columns={[
      { title: "Invoice / service", cell: row => <><strong>{row.number}</strong><span className="subline">{row.description}</span></> },
      { title: "Client", cell: row => clientName(row.client_id) }, { title: "Due", cell: row => money(row.amount_due, row.currency) },
      { title: "Paid", cell: row => money(row.amount_paid, row.currency) },
      { title: "Status", cell: row => <Badge value={overdue.some(i => i.id === row.id) ? "overdue" : row.status} /> },
      { title: "Date", cell: row => date(row.paid_at || row.due_at) }, { title: "Source", cell: row => link(row.hosted_url, "Invoice") }
    ]} empty={<Empty title="Maintenance invoices will appear here" text="Add a maintenance service with its Stripe subscription ID, then sync Stripe." />} />;
  }
  return <div className="workspace">
    {mobile && <button className="sidebar-shade" aria-label="Close navigation" onClick={() => setMobile(false)} />}
    <aside className={`sidebar ${mobile ? "is-open" : ""}`}>
      <a href="?view=overview" className="brand" onClick={event => { event.preventDefault(); navigate("overview"); }}><span className="brand-mark">w<span>.</span></span><span>workspace<span className="brand-caption">WEBSITE PRODUCTS</span></span></a>
      <div className="workspace-switch"><span className="workspace-avatar">{(business?.name || "W").slice(0, 1)}</span><div><strong>{business?.name || "Website Products"}</strong><span>Your business workspace</span></div><ChevronRight size={14} /></div>
      <p className="nav-caption">WORKSPACE</p>
      <nav aria-label="Main navigation">{navigation.map(([id, label, Icon]) => <button key={id} aria-current={tab === id ? "page" : undefined} className={`nav-item ${tab === id ? "active" : ""}`} onClick={() => navigate(id)}><Icon size={19} strokeWidth={1.75} /><span>{label}</span>{id === "tasks" && openTasks.length > 0 && <span className="nav-count">{openTasks.length}</span>}{id === "communications" && data && data.summary.followUpsDue > 0 && <span className="nav-count">{data.summary.followUpsDue}</span>}</button>)}</nav>
      <div className="sidebar-bottom"><div className="storage-note"><span className="status-dot" /><span>{local ? "Local workspace" : "Private workspace"}</span></div><div className="owner"><span className="owner-avatar">D</span><div><strong>Business owner</strong><span>{local ? "Saved on this computer" : actor}</span></div><ShieldCheck size={17} /></div></div>
    </aside>
    <div className="workspace-body">
      <header className="topbar"><div className="breadcrumb"><button className="icon-button mobile-menu" aria-label="Open navigation" onClick={() => setMobile(true)}><Menu size={21} /></button><span>Workspace</span><ChevronRight size={14} /><strong>{titles[tab]}</strong></div><div className="topbar-right"><span className="today"><CalendarDays size={15} />{date(today)}</span><span className="private-label"><span className="status-dot" />Owner access</span></div></header>
      <main className="main-content">
        <div className="page-heading"><div><div className="eyebrow">YOUR WORKSPACE</div><h1>{titles[tab]}</h1><p>{descriptions[tab]}</p></div><div className="heading-actions">{tab === "marketing" ? null : tab === "overview" ? add("clients", "New client") : tab === "payments" ? <button className="primary" disabled={Boolean(busy) || !data?.connections.stripe} onClick={() => job("stripe")}><RefreshCw size={16} className={busy === "stripe" ? "spin" : ""} />{busy === "stripe" ? "Syncing…" : "Sync Stripe"}</button> : tab === "sites" ? add("sites") : tab === "settings" ? <a className="secondary" href="/api/export"><Download size={16} />Export records</a> : add(tab)}</div></div>
        {error && <div className="notice error" role="alert"><CircleAlert size={18} /><span>{error}</span><button className="text-button" onClick={() => load().catch(e => setError(e.message))}>Retry</button></div>}
        {notice && <div className="toast" role="status"><Check size={17} />{notice}</div>}
        {!data ? <div className="loading"><LoaderCircle size={25} className="spin" /><p>Loading your workspace…</p></div> : <>
          {tab === "overview" && <>
            {data.summary.followUpsDue > 0 && <div className="notice info"><MessageSquare size={18} /><span>{data.summary.followUpsDue} conversation follow-up{data.summary.followUpsDue !== 1 ? "s" : ""} due. Keep potential and current clients up to date.</span><button className="text-button" onClick={() => navigate("communications")}>Open communications <ArrowRight size={15} /></button></div>}
            {!data.connections.stripe && <div className="welcome-note"><span className="welcome-icon"><Link2 size={20} /></span><div><strong>A workspace ready to grow with you.</strong><p>Add your client details and connect Stripe when you are ready.</p></div><button className="text-button" onClick={() => navigate("settings")}>Set up connections <ArrowRight size={16} /></button></div>}
            <div className="metrics">
              <div className="metric"><div className="metric-label">Active clients<UsersRound size={18} /></div><strong>{data.summary.activeClients}</strong><span>{data.clients.length} total client{data.clients.length !== 1 ? "s" : ""}</span></div>
              <div className="metric"><div className="metric-label">Websites<Globe2 size={18} /></div><strong>{data.summary.siteCount}</strong><span>{data.sites.filter(row => row.state === "live").length} marked live · {data.sites.filter(row => row.monitor_enabled).length} monitored</span></div>
              <div className="metric"><div className="metric-label">Received this month<Wallet size={18} /></div><strong className="money-metric">{totals(data.summary.received,row => row.amount)}</strong><span>{data.connections.stripe ? `${data.connections.stripeMode} mode · net of refunds` : "Connect Stripe to track payments"}</span></div>
              <div className="metric"><div className="metric-label">Needs attention<CircleAlert size={18} /></div><strong>{data.summary.overdueCount + data.summary.openIncidents}</strong><span>{data.summary.overdueCount} overdue invoice{overdue.length !== 1 ? "s" : ""} · {data.summary.openIncidents} open incidents</span></div>
            </div>
            <div className="overview-grid"><Panel title="Your websites" subtitle="A quick look at your client projects." action={<button className="text-button" onClick={() => navigate("sites")}>View all <ArrowRight size={15} /></button>}>{websiteTable(data.sites)}</Panel>
              <Panel title="Next up" subtitle="Keep the important things moving."><div className="task-preview">{openTasks.length ? openTasks.sort((a,b) => (a.due_date || "9999").localeCompare(b.due_date || "9999")).slice(0,4).map(row => <button key={row.id} onClick={() => setEditor({ entity: "tasks", record: row })}><span className="task-square" /><span><strong>{row.title}</strong><small>{clientName(row.client_id)} · {date(row.due_date)}</small></span><ChevronRight size={15} /></button>) : <div className="small-empty"><Check size={23} /><strong>A clear task list</strong><p>Add maintenance work or your next client follow-up.</p></div>}<button className="text-button add-task" onClick={() => setEditor({ entity: "tasks" })}><Plus size={16} />Add a task</button></div></Panel></div>
            <div className="overview-grid lower"><Panel title="Recent activity" subtitle="Changes across your workspace.">{data.activity.length ? <div className="activity-list">{data.activity.slice(0,5).map(row => <div key={row.id}><span className="activity-icon"><Activity size={15} /></span><div><strong>{row.summary}</strong><span>{row.actor === "local-owner" ? "You" : row.actor} · {date(row.created_at, true)}</span></div></div>)}</div> : <div className="quiet-empty"><Activity size={19} /><p>Your saved changes will appear here.</p></div>}</Panel>
              <Panel title="Connections" subtitle="Your services, at a glance."><div className="connection-list"><div><span className="provider-icon stripe">S</span><span><strong>Stripe</strong><small>Service payment records</small></span><Badge value={data.connections.stripe ? "connected" : "not-connected"} /></div><div><span className="provider-icon"><Globe2 size={18} /></span><span><strong>Website monitoring</strong><small>Public pages and CMS readiness</small></span><span className="connection-count">{data.sites.filter(row => row.monitor_enabled).length} enabled</span></div><div><span className="provider-icon"><ShieldCheck size={18} /></span><span><strong>Owner access</strong><small>{local ? "Local development" : "Cloudflare Access"}</small></span><Badge value={local ? "local" : "protected"} /></div></div></Panel></div>
          </>}
          {tab !== "overview" && tab !== "settings" && tab !== "marketing" && <div className="toolbar"><label className="search"><Search size={17} /><input aria-label={`Search ${titles[tab].toLowerCase()}`} placeholder={`Search ${titles[tab].toLowerCase()}…`} value={query} onChange={e => setQuery(e.target.value)} />{query && <button className="icon-button" onClick={() => setQuery("")} aria-label="Clear search"><X size={14} /></button>}</label><span className="muted toolbar-meta">{tab === "payments" ? `${data.connections.stripeMode.toUpperCase()} MODE` : "Your business records"}</span></div>}
          {tab === "clients" && <><Panel title="Client directory" subtitle={`${data.clients.length} businesses in your workspace`}><Table rows={filtered(data.clients)} columns={[
            { title: "Client", cell: row => <div className="name-cell"><span className="client-avatar">{row.name.slice(0,1)}</span><button className="record-name" onClick={() => setDetail(row)}>{row.name}</button></div> },
            { title: "Contact", cell: row => <>{row.email || "Add contact details"}<span className="subline">{row.phone}</span></> },
            { title: "Websites", cell: row => data.sites.filter(site => site.client_id === row.id).length },
            { title: "Monthly pricing", cell: row => { const prices = monthlyPricing(data.agreements.filter(service => service.client_id === row.id && (!service.stripe_subscription_id || service.stripe_mode === data.connections.stripeMode))); return prices.length ? <span className="monthly-prices">{prices.map(price => <span key={price.currency}>{money(price.amount,price.currency)}</span>)}</span> : <span className="muted">Not set</span>; } },
            { title: "Status", cell: row => <Badge value={row.status} /> }, { title: "", cell: row => <ClientActions name={row.name} onEdit={() => setEditor({entity:"clients",record:row})} onMoreInfo={() => setDetail(row)} /> }
          ]} /></Panel></>}
          {tab === "sites" && <><div className="section-tabs"><button className={siteView === "websites" ? "selected" : ""} onClick={() => setSiteView("websites")}>Websites <span>{data.sites.length}</span></button><button className={siteView === "health" ? "selected" : ""} onClick={() => setSiteView("health")}>Health & incidents</button><button className="secondary monitor-run" disabled={!!busy} onClick={() => job("monitor")}><RefreshCw size={15} className={busy === "monitor" ? "spin" : ""} />Run checks</button></div>{siteView === "websites" ? <Panel title="Website directory" subtitle="Each project keeps its own content, design and deployment.">{websiteTable(data.sites)}<div className="panel-foot">Enable monitoring in a website's settings. Checks run on approved domains only.</div></Panel> : <>
            <Panel title="Website health" subtitle="Results become stale after 20 minutes. Scheduled checks require the deployed Worker."><Table rows={filtered(data.sites)} columns={[
              { title: "Website", cell: row => <strong>{row.name}</strong> }, { title: "Public website", cell: row => <Badge value={health(row,"public")} /> },
              { title: "CMS / publishing", cell: row => <Badge value={health(row,"cms")} /> },
              { title: "Last checked", cell: row => date(latest(row.id,"public")?.checked_at,true) },
              { title: "Details", cell: row => <span className="wrap-text">{latest(row.id,"cms")?.message || latest(row.id,"public")?.message || "Monitoring has not run."}</span> }
            ]} /></Panel>
            <Panel title="Incident history" subtitle="An incident opens after two consecutive failures and closes on recovery." className="section-gap"><Table rows={filtered(data.incidents)} columns={[
              { title: "Website", cell: row => siteName(row.site_id) }, { title: "Signal", cell: row => row.kind }, { title: "Status", cell: row => <Badge value={row.resolved_at ? "resolved" : "open"} /> }, { title: "Opened", cell: row => date(row.opened_at,true) }, { title: "Recovered", cell: row => date(row.resolved_at,true) }, { title: "Details", cell: row => <span className="wrap-text">{row.message}</span> }
            ]} empty={<div className="quiet-empty"><Activity size={20} /><p>No incidents recorded. Check monitoring results for current website health.</p></div>} /></Panel></>}</>}
          {tab === "payments" && <><div className="billing-summary"><div><span>Outstanding invoices</span><strong>{totals(data.summary.outstanding,row => row.amount)}</strong></div><div><span>Overdue</span><strong>{totals(data.summary.overdue,row => row.amount)}</strong></div><div><span>Last Stripe sync</span><strong className="sync-date">{date(data.jobs.find(row => row.id === `stripe-${data.connections.stripeMode}`)?.last_success_at,true)}</strong></div></div>
            {!data.connections.stripe && <div className="notice info"><Link2 size={18} /><span>Stripe is not connected. Add your server key using the Stripe setup guide.</span></div>}
            <div className="notice info"><Link2 size={18} /><span>{linkedMaintenance.length ? `Tracking ${linkedMaintenance.length} linked maintenance subscription(s). Only their invoices and payments appear in these records and totals.` : "Add a maintenance service with its Stripe subscription ID and the matching environment to start tracking payments."}</span></div>
            <div className="section-tabs">{["invoices","transactions","services"].map(view => <button key={view} className={paymentView === view ? "selected" : ""} onClick={() => setPaymentView(view)}>{view[0].toUpperCase() + view.slice(1)}</button>)}<div className="tab-actions">{paymentView === "services" ? add("agreements", "Add service") : <button className="secondary" onClick={downloadCsv}><Download size={15} />Export CSV</button>}</div></div>
            <Panel title={paymentView === "services" ? "Maintenance services" : paymentView === "transactions" ? "Maintenance payments" : "Maintenance invoices"} subtitle={paymentView === "transactions" ? "Payments for linked maintenance subscriptions, including refunds." : paymentView === "services" ? "Set each client's price and link the exact Stripe maintenance subscription." : "Invoices for linked maintenance subscriptions. Track what is due and paid."}>
              {paymentView === "invoices" ? paymentsTable() : paymentView === "transactions" ? <Table rows={filtered(payments)} columns={[
                { title: "Payment", cell: row => <><strong>{row.description}</strong><span className="subline">{row.stripe_id}</span></> }, { title: "Client", cell: row => clientName(row.client_id) },
                { title: "Received", cell: row => money(row.amount,row.currency) }, { title: "Refunded", cell: row => money(row.refunded,row.currency) }, { title: "Status", cell: row => <Badge value={row.status} /> }, { title: "Date", cell: row => date(row.paid_at,true) }, { title: "Source", cell: row => link(row.receipt_url,"Receipt") }
              ]} empty={<Empty title="No maintenance payments yet" text="Link a maintenance subscription under Services, then sync Stripe." />} /> : <Table rows={filtered(maintenanceServices)} columns={[
                { title: "Service", cell: row => <strong>{row.title}</strong> }, { title: "Client", cell: row => clientName(row.client_id) }, { title: "Amount", cell: row => <>{money(row.amount,row.currency)}<span className="subline">{row.cadence}</span></> }, { title: "Websites", cell: row => row.site_ids.map(siteName).join(", ") || "Not assigned" }, { title: "Next due", cell: row => date(row.due_date) }, { title: "Status", cell: row => <Badge value={row.status} /> }, { title: "", cell: row => edit("agreements",row) }
              ]} empty={<Empty title="Define your first service" text="Record maintenance scope, agreed pricing and covered websites." action={add("agreements","Add service")} />} />}
            </Panel>
            {data.jobs.some(row => row.id.startsWith(`maintenance-${data.connections.stripeMode}-`) && row.cursor !== "complete") && <p className="footnote">Older maintenance invoices are being checked in batches. Each sync continues from the last page.</p>}
            {data.jobs.find(row => row.id === `stripe-${data.connections.stripeMode}`)?.error && <div className="notice error"><CircleAlert size={18} />{data.jobs.find(row => row.id === `stripe-${data.connections.stripeMode}`)?.error}</div>}
          </>}
          {tab === "tasks" && <Panel title="Work to do" subtitle={`${openTasks.length} open tasks`}><Table rows={filtered(data.tasks)} columns={[
            { title: "Task", cell: row => <><strong>{row.title}</strong><span className="subline">{row.notes.slice(0,90)}</span></> }, { title: "Client / website", cell: row => <>{clientName(row.client_id)}<span className="subline">{row.site_id ? siteName(row.site_id) : ""}</span></> }, { title: "Due", cell: row => <span className={row.due_date && row.due_date < today && !["done","cancelled"].includes(row.status) ? "overdue-text" : ""}>{date(row.due_date)}</span> }, { title: "Priority", cell: row => <Badge value={row.priority} /> }, { title: "Status", cell: row => <Badge value={row.status} /> }, { title: "", cell: row => edit("tasks",row) }
          ]} empty={<Empty title="Start with the next action" text="Keep client requests, website maintenance and follow-ups here." action={add("tasks")} />} /></Panel>}
          {tab === "communications" && <Communications people={data.communications} clients={data.clients} query={query} today={today} timezone={timezone} followUpsDue={data.summary.followUpsDue} post={action} reload={load} onEdit={record => setEditor({entity:"communications",record})} onAdd={() => setEditor({entity:"communications"})} />}
          {tab === "marketing" && <MarketingHub today={today} section={marketingSection} navigate={section => { setMarketingSection(section); history.pushState(null, "", adminUrl("marketing", section)); }} />}
          {tab === "settings" && <div className="settings-grid"><Panel title="Business details" subtitle="Defaults for your workspace." action={edit("settings",business)}><dl className="details-list"><div><dt>Business name</dt><dd>{business.name}</dd></div><div><dt>Email</dt><dd>{business.email || "Add business email"}</dd></div><div><dt>Based in</dt><dd>{business.country || "North Macedonia"}</dd></div><div><dt>Default currency</dt><dd>{business.currency.toUpperCase()}</dd></div><div><dt>Timezone</dt><dd>{business.timezone}</dd></div></dl></Panel>
            <Panel title="Storage & access" subtitle="Where your records live."><dl className="details-list"><div><dt>Storage</dt><dd>{data.connections.storage === "local" ? "SQLite on this computer" : "Cloudflare D1"}</dd></div><div><dt>Owner access</dt><dd>{local ? "Loopback development only" : "Cloudflare Access"}</dd></div><div><dt>Account</dt><dd>{local ? "Local owner" : actor}</dd></div><div><dt>Backup</dt><dd>Export records or run npm run backup</dd></div></dl></Panel>
            <Panel title="Maintenance payment tracking" subtitle="Records for linked recurring maintenance subscriptions."><dl className="details-list"><div><dt>Connection</dt><dd><Badge value={data.connections.stripe ? "configured" : "not-connected"} /></dd></div><div><dt>Mode</dt><dd>{data.connections.stripeMode.toUpperCase()}</dd></div><div><dt>Webhook secret</dt><dd>{data.connections.webhook ? "Configured" : "Not configured"}</dd></div></dl><div className="panel-foot">Use STRIPE-SETUP.md in your main folder to add keys. Link each maintenance subscription under Payments &gt; Services.</div></Panel>
            <Panel title="Website monitoring" subtitle="Check registered sites without changing their content."><dl className="details-list"><div><dt>Enabled websites</dt><dd>{data.sites.filter(row => row.monitor_enabled).length}</dd></div><div><dt>Scheduled checks</dt><dd>{data.connections.storage === "cloud" ? "Worker cron every 5 minutes" : "Run manually or use npm run monitor"}</dd></div><div><dt>Approved hosts</dt><dd className="wrap-text">{data.connections.monitoringHosts.join(", ") || "None configured"}</dd></div></dl><div className="panel-foot">Breeze CMS monitoring uses its own read-only token.</div></Panel>
          </div>}
          <footer className="main-footer"><span>{business.name} <span className="footer-dot">·</span> Business workspace</span><span>Private records <ShieldCheck size={13} /></span></footer>
        </>}
      </main>
    </div>
    {editor && data && <Modal title={`${editor.record ? "Edit" : "Add"} ${entities[editor.entity].singular}`} close={closeEditor}><RecordForm entity={editor.entity} record={editor.record} data={data} onSave={async payload => { await action(`entities/${editor.entity}`,payload); await load(); setNotice("Record saved."); setEditor(null); }} close={closeEditor} /></Modal>}
    {detailedClient && data && <Modal title={detailedClient.name} close={closeDetail}><ClientDetails client={detailedClient} data={data} onEdit={() => { setEditor({entity:"clients",record:detailedClient}); setDetail(null); }} /></Modal>}
  </div>;
}
