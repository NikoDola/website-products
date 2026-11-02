"use client";
import { useState, type FormEvent } from "react";
import { Check, ChevronDown, Info, LoaderCircle } from "lucide-react";
import { entities as rawEntities, currencyDigits } from "../../shared/entities.mjs";
import AdditionalContacts from "./AdditionalContacts";
type Row = Record<string, any>;
type Field = { name: string; label: string; type: string; required?: boolean; createOnly?: boolean; advanced?: boolean; options?: string[]; hint?: string; default?: string };

export default function RecordForm({ entity, record, data, onSave, close }: { entity: string; record?: Row; data: Record<string, any>; onSave: (value: Row) => Promise<void>; close: () => void }) {
  const definition = (rawEntities as Record<string, { fields: Field[] }>)[entity];
  const [values, setValues] = useState<Row>(() => Object.fromEntries(definition.fields.map(field => {
    let value = record?.[field.name] ?? (field.type === "select" ? field.options?.[0] : field.type === "currency" ? data.settings[0]?.currency || "usd" : field.type === "sites" ? [] : field.type === "checkbox" ? false : field.default || (entity === "agreements" && field.name === "title" ? "Maintenance" : ""));
    if (field.type === "contacts") value = record ? data.contacts.filter((row: Row) => row.client_id === record.id).map(({ id, version, name, email, phone, role }: Row) => ({ id, version, name, email, phone, role })) : [];
    if (!record && entity === "agreements" && field.name === "stripe_mode") value = data.connections.stripeMode;
    if (field.type === "money") value = record ? String(Number(value) / 10 ** (currencyDigits(record.currency || "usd") || 0)) : "";
    if (field.type === "datetime-local" && value) { const at = new Date(value); value = new Date(at.getTime() - at.getTimezoneOffset() * 60000).toISOString().slice(0, 16); }
    return [field.name, value];
  })));
  const [error, setError] = useState(""), [saving, setSaving] = useState(false);
  const [contactsChanged, setContactsChanged] = useState(false);
  const set = (name: string, value: unknown) => setValues(previous => ({ ...previous, [name]: value }));
  async function submit(event: FormEvent) {
    event.preventDefault(); setSaving(true); setError("");
    try {
      const payload: Row = { ...values, ...(record ? { id: record.id, version: record.version } : {}) };
      if (entity === "clients" && !contactsChanged) delete payload.additional_contacts;
      for (const field of definition.fields) {
        if (field.type === "money") {
          const scale = 10 ** (currencyDigits(payload.currency || "usd") || 0), minor = Number(payload[field.name] || 0) * scale;
          if (!Number.isFinite(minor) || Math.abs(Math.round(minor) - minor) > 0.000001) throw new Error("The amount has too many decimal places for this currency.");
          payload[field.name] = Math.round(minor);
        }
        if (field.type === "datetime-local" && payload[field.name]) payload[field.name] = new Date(payload[field.name]).toISOString();
      }
      await onSave(payload);
    } catch (error) { setError((error as Error).message); }
    finally { setSaving(false); }
  }
  function renderField(field: Field) {
    const id = `field-${field.name}`, value = values[field.name];
    const base = { id, name: field.name, required: field.required, disabled: saving };
    const options: Row[] = field.type === "client" ? data.clients : ["site", "sites"].includes(field.type) ? data.sites.filter((row: Row) => !values.client_id || row.client_id === values.client_id) : [];
    if (field.type === "contacts") return <div className="field full" key={field.name}><span className="field-label">{field.label}</span><AdditionalContacts value={value} onChange={rows => { set(field.name, rows); setContactsChanged(true); }} disabled={saving} /></div>;
    return <div className={`field ${["textarea", "sites", "checkbox"].includes(field.type) ? "full" : ""}`} key={field.name}>
      {field.type !== "checkbox" && <label htmlFor={id}>{field.label}{field.required && <span className="required"> *</span>}</label>}
      {field.type === "textarea" ? <textarea {...base} rows={4} value={value} onChange={event => set(field.name, event.target.value)} />
        : field.type === "checkbox" ? <label className="checkbox-label"><input {...base} type="checkbox" checked={Boolean(value)} onChange={event => set(field.name, event.target.checked)} />{field.label}</label>
        : field.type === "sites" ? <div className="multi-sites">{options.length ? options.map(row => <label key={row.id}><input type="checkbox" disabled={saving} checked={value.includes(row.id)} onChange={event => set(field.name, event.target.checked ? [...value, row.id] : value.filter((id: string) => id !== row.id))} />{row.name}</label>) : <p className="muted">Select a client with a registered website.</p>}</div>
        : ["client", "site", "select"].includes(field.type) ? <select {...base} value={value || ""} onChange={event => set(field.name, event.target.value)}>{field.type !== "select" && <option value="">Select {field.type}</option>}{field.type === "select" ? field.options?.map(option => <option value={option} key={option}>{option.replaceAll("-", " ")}</option>) : options.map(row => <option value={row.id} key={row.id}>{row.name}</option>)}</select>
        : <input {...base} type={field.type === "money" ? "number" : field.type === "currency" ? "text" : field.type} min={field.type === "money" ? "0" : undefined} step={field.type === "money" ? "any" : undefined} maxLength={field.type === "currency" ? 3 : 2048} value={value || ""} onChange={event => set(field.name, event.target.value)} />}
      {field.hint && <small>{field.hint}</small>}
    </div>;
  }
  const fields = definition.fields.filter(field => !field.createOnly || !record);
  return <form onSubmit={submit} onInvalidCapture={event => { const group = (event.target as HTMLElement).closest("details"); if (group) group.open = true; }}>
    <div className="form-body">{error && <div className="notice error" role="alert">{error}</div>}
      <div className="form-grid">{fields.filter(field => !field.advanced).map(renderField)}</div>
      {fields.some(field => field.advanced) && <details className="client-form-more"><summary><Info size={17} /><span>More information<small>Optional names, other emails and notes</small></span><ChevronDown size={17} /></summary><div className="form-grid">{fields.filter(field => field.advanced).map(renderField)}</div></details>}
    </div>
    <div className="form-footer"><button type="button" className="secondary" disabled={saving} onClick={close}>Cancel</button><button className="primary" disabled={saving}>{saving ? <LoaderCircle size={16} className="spin" /> : <Check size={16} />}{saving ? "Saving..." : "Save changes"}</button></div>
  </form>;
}
