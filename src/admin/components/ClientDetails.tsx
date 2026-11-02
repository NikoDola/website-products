"use client";
import { CalendarDays, Pencil, UserRound, Mail, Phone, ArrowUpRight } from "lucide-react";
type Row = Record<string, any>;

export default function ClientDetails({ client, data, onEdit }: { client: Row; data: Record<string, any>; onEdit: () => void }) {
  const timezone = data.settings[0]?.timezone || "Europe/Skopje";
  const date = (value?: string) => value ? new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeZone: timezone }).format(new Date(value)) : "Not available";
  const money = (amount: number, currency: string) => new Intl.NumberFormat("en-US", { style: "currency", currency }).format(amount / 10 ** (new Intl.NumberFormat("en", { style: "currency", currency }).resolvedOptions().maximumFractionDigits || 0));
  const contacts = data.contacts.filter((row: Row) => row.client_id === client.id);
  const websites = data.sites.filter((row: Row) => row.client_id === client.id);
  const services = data.agreements.filter((row: Row) => row.client_id === client.id && row.cadence !== "one-time");
  const tracked = services.filter((row: Row) => row.stripe_subscription_id && row.stripe_mode === data.connections.stripeMode);
  const billing = data.client_billing?.find((row: Row) => row.client_id === client.id);
  const historyComplete = tracked.length > 0 && tracked.every((service: Row) => data.jobs.some((job: Row) => job.id === `maintenance-${service.stripe_mode}-${service.id}-${service.stripe_subscription_id}` && job.cursor === "complete"));
  const upcoming = tracked.filter((row: Row) => row.stripe_next_payment_at && new Date(row.stripe_next_payment_at).getTime() > Date.now()).sort((a: Row, b: Row) => a.stripe_next_payment_at.localeCompare(b.stripe_next_payment_at));
  const next = upcoming[0];
  const nextText = next ? date(next.stripe_next_payment_at) : !tracked.length ? "No subscription linked" : tracked.some((row: Row) => row.stripe_next_payment_at) ? "Sync Stripe to refresh" : tracked.find((row: Row) => row.stripe_synced_at)?.stripe_schedule_note || "Sync Stripe to load";
  const contactName = [client.first_name, client.last_name].filter(Boolean).join(" ");
  return <div className="client-detail client-info">
    <div className="detail-toolbar"><span className={`badge badge-${client.status}`}><span className="status-dot" />{client.status}</span><button type="button" className="secondary" onClick={onEdit}><Pencil size={15} />Edit client</button></div>
    <div className="client-billing-dates">
      <div><CalendarDays size={18} /><span>{historyComplete ? "First payment" : "Earliest imported payment"}</span><strong>{billing?.first_payment_at ? date(billing.first_payment_at) : "No payments imported"}</strong></div>
      <div><CalendarDays size={18} /><span>Next expected payment</span><strong>{nextText}</strong></div>
    </div>
    <section className="client-info-section"><h3>Client information</h3><dl className="client-contact-details">
      <div><dt><UserRound size={15} />Name</dt><dd>{contactName || "Not added"}</dd></div>
      <div><dt><Mail size={15} />Primary email</dt><dd>{client.email ? <a href={`mailto:${client.email}`}>{client.email}</a> : "Not added"}</dd></div>
      {client.phone && <div><dt><Phone size={15} />Phone</dt><dd><a href={`tel:${client.phone}`}>{client.phone}</a></dd></div>}
    </dl></section>
    {contacts.length > 0 && <section className="client-info-section"><h3>Other contacts & emails</h3><div className="client-contact-cards">{contacts.map((contact: Row) => <div className="client-contact-card" key={contact.id}><strong>{contact.name}</strong>{contact.role && <span>{contact.role}</span>}{contact.email && <a href={`mailto:${contact.email}`}><Mail size={14} />{contact.email}</a>}{contact.phone && <a href={`tel:${contact.phone}`}><Phone size={14} />{contact.phone}</a>}</div>)}</div></section>}
    <section className="client-info-section"><h3>Maintenance subscriptions</h3>{services.length ? services.map((service: Row) => <div className="client-service-card" key={service.id}>
      <div><strong>{service.title}</strong><span>{money(service.amount, service.currency)} / {service.cadence}</span></div>
      {service.stripe_subscription_id && service.stripe_mode === data.connections.stripeMode ? <><p>{service.stripe_status ? `Stripe: ${service.stripe_status.replaceAll("_", " ")}` : "Sync Stripe to load subscription details"}</p><p>{service.stripe_next_payment_at ? `Next expected payment: ${date(service.stripe_next_payment_at)}` : service.stripe_schedule_note || "Next payment date not loaded"}</p>{service.stripe_synced_at && <small>Schedule last synced {date(service.stripe_synced_at)}</small>}</> : <p>Not linked in {data.connections.stripeMode} mode</p>}
    </div>) : <p className="muted">No maintenance service added.</p>}</section>
    {websites.length > 0 && <section className="client-info-section"><h3>Websites</h3>{websites.map((site: Row) => <a className="client-website-link" key={site.id} href={site.public_url} target="_blank" rel="noreferrer">{site.name}<ArrowUpRight size={15} /></a>)}</section>}
    {client.notes && <section className="client-info-section"><h3>Notes</h3><p className="preserve-lines">{client.notes}</p></section>}
  </div>;
}
