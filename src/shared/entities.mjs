const f = (name, label, type = "text", extra = {}) => ({ name, label, type, ...extra });
const pick = (name, label, options, extra = {}) => f(name, label, "select", { options, ...extra });
export const entities = {
  clients: { label: "Clients", singular: "client", fields: [
    f("name", "Business name", "text", { required: true }), f("email", "Primary email", "email"),
    f("phone", "Phone"), pick("status", "Status", ["active", "prospect", "paused", "archived"]),
    f("first_name", "First name", "text", { advanced: true }), f("last_name", "Last name", "text", { advanced: true }),
    f("additional_contacts", "Other contacts & emails", "contacts", { advanced: true }),
    f("stripe_test_id", "Stripe customer ID (test)", "text", { advanced: true }), f("stripe_live_id", "Stripe customer ID (live)", "text", { advanced: true }),
    f("notes", "Notes", "textarea", { advanced: true })
  ] },
  contacts: { label: "Contacts", singular: "contact", fields: [
    f("client_id", "Client", "client", { required: true }), f("name", "Name", "text", { required: true }),
    f("role", "Role"), f("email", "Email", "email"), f("phone", "Phone")
  ] },
  sites: { label: "Websites", singular: "website", fields: [
    f("id", "Stable site ID", "text", { createOnly: true, required: true, hint: "Lowercase letters, numbers and hyphens. Example: breeze." }),
    f("client_id", "Client", "client", { required: true }), f("name", "Website name", "text", { required: true }),
    f("public_url", "Website URL", "url", { required: true }), f("cms_url", "Content editor URL", "url"),
    pick("state", "Lifecycle", ["development", "live", "paused", "archived"]), f("project_path", "Project folder"),
    f("repository_url", "Repository URL", "url"), f("hosting_url", "Hosting dashboard URL", "url"),
    f("domain_due", "Domain renewal", "date"), f("backup_verified_at", "Last verified restore", "date"),
    f("monitor_enabled", "Enable scheduled monitoring", "checkbox"), f("expected_text", "Expected page text"),
    f("cms_status_url", "Read-only CMS status URL", "url", { hint: "The new /api/monitor/status endpoint. Set its separate token on the server." })
  ] },
  agreements: { label: "Services", singular: "service agreement", fields: [
    f("client_id", "Client", "client", { required: true }), f("title", "Service name", "text", { required: true }),
    f("amount", "This client's agreed price", "money", { hint: "Set the maintenance price individually for this client." }), f("currency", "Currency", "currency"),
    pick("cadence", "Billing cycle", ["monthly", "quarterly", "yearly", "one-time"]),
    f("due_date", "Next agreed due date", "date"), pick("status", "Status", ["active", "paused", "ended"]),
    f("site_ids", "Covered websites", "sites"),
    f("stripe_subscription_id", "Stripe maintenance subscription ID", "text", { hint: "Paste the sub_... ID from this client's maintenance subscription. Required to import its payments." }),
    pick("stripe_mode", "Stripe environment", ["test", "live"], { hint: "Match the environment where this subscription exists." }),
    f("notes", "Included work and terms", "textarea")
  ] },
  tasks: { label: "Tasks", singular: "task", fields: [
    f("title", "Task", "text", { required: true }), f("client_id", "Client", "client"),
    f("site_id", "Website", "site"), f("due_date", "Due date", "date"),
    pick("priority", "Priority", ["normal", "high", "low"]),
    pick("status", "Status", ["open", "in-progress", "done", "cancelled"]), f("notes", "Notes", "textarea")
  ] },
  communications: { label: "Communications", singular: "person", fields: [
    f("name", "Person's name", "text", { required: true }), f("company", "Business / company"),
    f("email", "Email", "email"), f("phone", "Phone"),
    pick("stage", "Where we are", ["potential", "in-discussion", "proposal-sent", "ordered", "active-client", "closed"]),
    f("client_id", "Link to an existing client (optional)", "client"),
    f("next_follow_up", "Next follow-up", "date"), f("next_action", "Next action", "textarea"),
    f("notes", "Conversation context", "textarea")
  ] },
  settings: { label: "Settings", singular: "business settings", fields: [
    f("name", "Business name", "text", { required: true }), f("email", "Business email", "email"),
    f("country", "Based in", "text", { default: "North Macedonia" }),
    f("currency", "Default currency", "currency"), f("timezone", "Timezone")
  ] }
};
export class PlatformError extends Error {
  constructor(message, status = 400) { super(message); this.status = status; }
}
export function publicUrl(value, optional = false) {
  if (!value && optional) return "";
  let url;
  try { url = new URL(value); } catch { throw new PlatformError("Enter a complete HTTPS URL."); }
  const host = url.hostname.toLowerCase();
  if (url.protocol !== "https:" || url.username || url.password || (url.port && url.port !== "443") ||
      !host.includes(".") || host.endsWith(".") || /(^|\.)(localhost|local|internal|test|invalid)$/.test(host) ||
      /^[\d.]+$/.test(host) || host.includes(":") || host.startsWith("[") || host.endsWith(".local")) {
    throw new PlatformError("Use a public HTTPS hostname without credentials or a custom port.");
  }
  return url.href;
}
export function currencyDigits(currency) {
  try { return new Intl.NumberFormat("en", { style: "currency", currency }).resolvedOptions().maximumFractionDigits; }
  catch { throw new PlatformError("Use a valid three-letter currency code."); }
}
export function validateEntity(entity, input, existing = null) {
  const definition = entities[entity];
  if (!definition || !input || typeof input !== "object" || Array.isArray(input)) throw new PlatformError("Invalid record.");
  const allowed = new Set(["id", "version", ...definition.fields.map(field => field.name)]);
  if (Object.keys(input).some(key => !allowed.has(key))) throw new PlatformError("Unexpected record field.");
  const out = {};
  for (const field of definition.fields) {
    if (field.name === "id") continue;
    if (field.type === "contacts") {
      if (input[field.name] !== undefined) out[field.name] = validateAdditionalContacts(input[field.name]);
      continue;
    }
    let value = input[field.name] ?? existing?.[field.name] ?? field.default ?? "";
    if (field.type === "checkbox") { out[field.name] = value === true || value === 1 ? 1 : 0; continue; }
    if (field.type === "sites") {
      if (!Array.isArray(value) && value !== "") throw new PlatformError("Select covered websites.");
      out[field.name] = [...new Set(value || [])];
      if (out[field.name].length > 100 || out[field.name].some(id => typeof id !== "string")) throw new PlatformError("Invalid covered websites.");
      continue;
    }
    if (field.type === "money") {
      value = Number(value || 0);
      if (!Number.isSafeInteger(value) || value < 0 || value > 1e12) throw new PlatformError(`${field.label} must be a nonnegative amount in minor units.`);
      out[field.name] = value; continue;
    }
    if (typeof value !== "string") throw new PlatformError(`${field.label} must be text.`);
    value = value.trim();
    if (value.length > (field.type === "textarea" ? 10000 : 2048)) throw new PlatformError(`${field.label} is too long.`);
    if (field.required && !value) throw new PlatformError(`${field.label} is required.`);
    if (field.type === "select") {
      value ||= field.options[0];
      if (!field.options.includes(value)) throw new PlatformError(`Invalid ${field.label.toLowerCase()}.`);
    }
    if (field.type === "email" && value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) throw new PlatformError("Enter a valid email address.");
    if (field.type === "url") value = publicUrl(value, !field.required);
    if (field.type === "currency") {
      value = (value || "usd").toLowerCase();
      if (!/^[a-z]{3}$/.test(value)) throw new PlatformError("Currency must have three letters.");
      currencyDigits(value);
    }
    if (field.type === "date" && value && (!/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(Date.parse(value)) || new Date(value).toISOString().slice(0, 10) !== value)) throw new PlatformError("Enter a valid date.");
    if (field.type === "datetime-local" && value) {
      if (!Number.isFinite(Date.parse(value))) throw new PlatformError("Enter a valid date and time.");
      value = new Date(value).toISOString();
    }
    if (field.name === "timezone") {
      value ||= "Europe/Skopje";
      try { new Intl.DateTimeFormat("en", { timeZone: value }).format(); } catch { throw new PlatformError("Enter an IANA timezone, for example Europe/Skopje."); }
    }
    if (field.name.startsWith("stripe_") && field.name.endsWith("_id") && value) {
      const prefix = field.name === "stripe_subscription_id" ? "sub_" : "cus_";
      if (!new RegExp(`^${prefix}[A-Za-z0-9]+$`).test(value)) throw new PlatformError(`Invalid ${field.label}.`);
    }
    out[field.name] = ["client", "site"].includes(field.type) && !value ? null : value;
    if (["stripe_test_id", "stripe_live_id"].includes(field.name) && !value) out[field.name] = null;
  }
  return out;
}

function validateAdditionalContacts(rows) {
  if (!Array.isArray(rows) || rows.length > 50) throw new PlatformError("Use up to 50 additional contacts.");
  const seen = new Set(), result = [];
  for (const row of rows) {
    if (!row || typeof row !== "object" || Array.isArray(row) || Object.keys(row).some(key => !["id", "version", "name", "email", "phone", "role", "deleted"].includes(key))) throw new PlatformError("Invalid additional contact.");
    if (row.id !== undefined && (typeof row.id !== "string" || !/^[a-zA-Z0-9-]{1,100}$/.test(row.id) || seen.has(row.id))) throw new PlatformError("Invalid or repeated contact ID.");
    if (row.id) seen.add(row.id);
    if (row.version !== undefined && (!Number.isInteger(row.version) || row.version < 1)) throw new PlatformError("Invalid contact version.");
    if (row.deleted !== undefined && typeof row.deleted !== "boolean") throw new PlatformError("Invalid contact removal.");
    const reference = { ...(row.id ? { id: row.id } : {}), ...(row.version ? { version: row.version } : {}) };
    if (row.deleted) {
      if (!row.id || !row.version) throw new PlatformError("Refresh before removing this contact.");
      result.push({ ...reference, deleted: true }); continue;
    }
    for (const key of ["name", "email", "phone", "role"]) if (row[key] !== undefined && typeof row[key] !== "string") throw new PlatformError("Contact information must be text.");
    if (![row.name, row.email, row.phone].some(value => value?.trim())) {
      if (row.version) throw new PlatformError("Enter a contact name or email, or remove the contact.");
      continue;
    }
    const values = validateEntity("contacts", { client_id: "parent-client", name: row.name?.trim() || row.email?.trim() || "Additional contact", email: row.email || "", phone: row.phone || "", role: row.role || "" });
    delete values.client_id;
    result.push({ ...reference, ...values });
  }
  return result;
}
