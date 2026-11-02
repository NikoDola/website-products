"use client";
import { Plus, X } from "lucide-react";
type Contact = { id: string; version?: number; name: string; email: string; phone: string; role: string; deleted?: boolean };

export default function AdditionalContacts({ value, onChange, disabled }: { value: Contact[]; onChange: (value: Contact[]) => void; disabled: boolean }) {
  const visible = value.filter(contact => !contact.deleted);
  const change = (id: string, key: string, text: string) => onChange(value.map(contact => contact.id === id ? { ...contact, [key]: text } : contact));
  return <div className="additional-contacts">
    <p className="field-help">Add an assistant, billing contact or another email only when needed.</p>
    {visible.map((contact, index) => <div className="additional-contact" key={contact.id}>
      <div className="additional-contact-heading"><strong>Contact {index + 1}</strong><button type="button" className="icon-button" disabled={disabled} aria-label={`Remove contact ${index + 1}`} onClick={() => onChange(contact.version ? value.map(row => row.id === contact.id ? { ...row, deleted: true } : row) : value.filter(row => row.id !== contact.id))}><X size={15} /></button></div>
      <div className="form-grid">{([['name', 'Name', 'text'], ['email', 'Email', 'email'], ['role', 'Role, e.g. assistant', 'text'], ['phone', 'Phone', 'tel']] as const).map(([key, label, type]) => <div className="field" key={key}><label htmlFor={`contact-${contact.id}-${key}`}>{label}</label><input id={`contact-${contact.id}-${key}`} type={type} disabled={disabled} maxLength={2048} value={contact[key]} onChange={event => change(contact.id, key, event.target.value)} /></div>)}</div>
    </div>)}
    <button type="button" className="secondary" disabled={disabled || value.length >= 50} onClick={() => onChange([...value, { id: crypto.randomUUID(), name: "", email: "", phone: "", role: "" }])}><Plus size={15} />{visible.length ? "Add another contact" : "Add contact / email"}</button>
  </div>;
}
