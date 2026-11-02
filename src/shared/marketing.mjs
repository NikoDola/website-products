// Shared marketing rules contain no private contacts or filesystem access.
import { PlatformError } from "./entities.mjs";

export const priorities = ["high", "medium", "low", "review", "existing"];
export const stages = ["to-review", "ready", "contacted", "replied", "interested", "won", "not-interested", "do-not-contact"];
export const paymentLabels = {
  unknown: "Not established", paid: "Paid (archive)", deposit: "Deposit recorded",
  unresolved: "Payment unresolved", quoted: "Quote / terms only", prize: "Prize / award recorded",
};
export const marketingFields = ["name", "contact", "email", "phone", "year", "relationship", "opportunity", "priority", "stage",
  "website", "website_status", "last_contact", "follow_up", "next_action", "gmail_thread", "website_evidence", "notes", "payment_status", "payment_notes"];
const dates = ["last_contact", "follow_up"];
const urls = ["website", "gmail_thread", "website_evidence"];
export function safeMarketingUrl(value) {
  try {
    const url = new URL(value);
    return ["http:", "https:"].includes(url.protocol) && !url.username && !url.password ? url.href : "";
  } catch { return ""; }
}
export function validMarketingDate(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
}
export function validateMarketingRecord(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new PlatformError("Invalid contact.");
  const record = {};
  for (const field of marketingFields) {
    const value = input[field] ?? "";
    if (typeof value !== "string" || value.length > (["notes", "payment_notes"].includes(field) ? 20000 : 4000)) throw new PlatformError(`Invalid ${field.replaceAll("_", " ")}.`);
    record[field] = value.trim();
  }
  if (!record.name) throw new PlatformError("Enter a business or contact name.");
  if (!priorities.includes(record.priority)) throw new PlatformError("Choose a valid priority.");
  if (!stages.includes(record.stage)) throw new PlatformError("Choose a valid campaign stage.");
  if (!Object.hasOwn(paymentLabels, record.payment_status)) throw new PlatformError("Choose a valid payment classification.");
  if (record.year && !/^(19|20)\d{2}$/.test(record.year)) throw new PlatformError("Enter a four-digit archive year.");
  for (const field of dates) if (record[field] && !validMarketingDate(record[field])) throw new PlatformError("Enter a valid contact or follow-up date.");
  for (const field of urls) if (record[field] && !safeMarketingUrl(record[field])) throw new PlatformError("Links must be full HTTP or HTTPS URLs without credentials.");
  return record;
}
export function marketingEmails(value = "") {
  return [...new Set((value.match(/[A-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi) || []).map(email => email.toLowerCase()))];
}
export function filterMarketing(records, filters = {}, today = new Date().toISOString().slice(0, 10)) {
  const words = (filters.query || "").toLowerCase().trim().split(/\s+/).filter(Boolean);
  const rank = { high: 0, medium: 1, existing: 2, review: 3, low: 4 };
  const result = records.filter(row => {
    const text = JSON.stringify([marketingFields.map(key => row[key]), row.history, row.contests]).toLowerCase();
    if (!words.every(word => text.includes(word))) return false;
    if (filters.priority && row.priority !== filters.priority) return false;
    if (filters.year && row.year !== filters.year && !row.history?.some(item => item.year === filters.year)) return false;
    if (filters.stage && row.stage !== filters.stage) return false;
    if (filters.payment && (filters.payment === "evidence" ? row.payment_status === "unknown" : row.payment_status !== filters.payment)) return false;
    if (filters.email === "available" && !marketingEmails(row.email).length) return false;
    if (filters.email === "missing" && marketingEmails(row.email).length) return false;
    if (filters.followUp === "due" && (!row.follow_up || row.follow_up > today || ["do-not-contact", "not-interested", "won"].includes(row.stage))) return false;
    if (filters.contact === "missing" && row.last_contact) return false;
    const days = row.last_contact ? (Date.parse(today) - Date.parse(row.last_contact)) / 86400000 : null;
    if (filters.contact === "recent" && (days === null || days < 0 || days > 30)) return false;
    if (filters.contact === "90" && (days === null || days < 90)) return false;
    if (filters.contact === "365" && (days === null || days < 365)) return false;
    if (filters.from && (!row.last_contact || row.last_contact < filters.from)) return false;
    if (filters.to && (!row.last_contact || row.last_contact > filters.to)) return false;
    return true;
  });
  return result.sort((a, b) => {
    let order = 0;
    switch (filters.sort) {
      case "oldest": order = (a.last_contact || "9999").localeCompare(b.last_contact || "9999"); break;
      case "name": order = a.name.localeCompare(b.name); break;
      case "priority": order = rank[a.priority] - rank[b.priority]; break;
      case "follow-up": order = (a.follow_up || "9999").localeCompare(b.follow_up || "9999"); break;
      default: order = (b.last_contact || "").localeCompare(a.last_contact || "");
    }
    return order || a.name.localeCompare(b.name) || a.id.localeCompare(b.id);
  });
}
export function marketingCsv(records) {
  const escape = value => `"${String(value ?? "").replace(/^[\s]*[=+@-]/, "'$&").replaceAll('"', '""')}"`;
  return [marketingFields.join(","), ...records.map(row => marketingFields.map(key => escape(row[key])).join(","))].join("\r\n");
}
