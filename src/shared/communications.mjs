import { PlatformError, validateEntity } from "./entities.mjs";
import { now, stmt } from "./platform.mjs";

export const communicationQuery = `SELECT c.*,
  MAX(CASE WHEN e.type='email-sent' THEN e.occurred_at END) AS last_email_at,
  MAX(CASE WHEN e.type='email-received' THEN e.occurred_at END) AS last_reply_at,
  MAX(CASE WHEN e.type IN ('email-sent','email-received') THEN e.occurred_at END) AS last_contact_at,
  COUNT(CASE WHEN e.type='email-sent' THEN 1 END) AS emails_sent
  FROM communications c LEFT JOIN communication_entries e ON e.communication_id=c.id`;

export async function communicationHistory(db, id) {
  const person = await db.first(`${communicationQuery} WHERE c.id=? GROUP BY c.id`, [id]);
  if (!person) throw new PlatformError("This person was not found.", 404);
  const entries = await db.all("SELECT * FROM communication_entries WHERE communication_id=? ORDER BY occurred_at DESC,created_at DESC,id DESC LIMIT 200", [id]);
  const count = (await db.first("SELECT COUNT(*) AS count FROM communication_entries WHERE communication_id=?", [id])).count;
  return { person, entries, total: count };
}
function guard(statements) {
  statements.push(stmt("INSERT INTO platform_update_guard(value) VALUES(changes())"), stmt("DELETE FROM platform_update_guard"));
}
function conflict(error) {
  if (/platform_update_guard|CHECK constraint/.test(String(error))) throw new PlatformError("This conversation changed. Refresh it before saving again.", 409);
  if (/UNIQUE/.test(String(error))) throw new PlatformError("This communication entry is already recorded.", 409);
  throw error;
}
export async function logCommunication(db, personId, input, actor) {
  const allowed = new Set(["id","expectedVersion","type","occurred_at","subject","notes","next_follow_up","next_action"]);
  if (!input || typeof input !== "object" || Array.isArray(input) || Object.keys(input).some(key => !allowed.has(key))) throw new PlatformError("Invalid communication entry.");
  const id = input.id || crypto.randomUUID();
  if (!/^[a-zA-Z0-9-]{1,100}$/.test(id)) throw new PlatformError("Invalid entry ID.");
  if (!["email-sent","email-received","note"].includes(input.type)) throw new PlatformError("Choose an email sent, reply received or note.");
  for (const field of ["subject","notes"]) if (typeof (input[field] ?? "") !== "string") throw new PlatformError("Entry subject and notes must be text.");
  const subject = input.subject?.trim(), notes = (input.notes || "").trim();
  if (!subject || subject.length > 300 || notes.length > 10000) throw new PlatformError("Add a subject of up to 300 characters and notes of up to 10,000 characters.");
  if (typeof input.occurred_at !== "string" || !/(Z|[+-]\d{2}:\d{2})$/.test(input.occurred_at) || !Number.isFinite(Date.parse(input.occurred_at))) throw new PlatformError("Enter when this communication happened, including its timezone.");
  const occurredAt = new Date(input.occurred_at).toISOString();
  if (Date.parse(occurredAt) > Date.now() + 5 * 60000) throw new PlatformError("Log an email after it has been sent. Use the follow-up date to plan future contact.");
  const existingEntry = await db.first("SELECT * FROM communication_entries WHERE id=?", [id]);
  if (existingEntry) {
    if (existingEntry.communication_id === personId && existingEntry.type === input.type && existingEntry.occurred_at === occurredAt && existingEntry.subject === subject && existingEntry.notes === notes) return { id, duplicate: true };
    throw new PlatformError("This entry ID belongs to a different communication.", 409);
  }
  const person = await db.first("SELECT * FROM communications WHERE id=?", [personId]);
  if (!person) throw new PlatformError("This person was not found.", 404);
  if (input.expectedVersion !== person.version) throw new PlatformError("This conversation changed. Refresh it before saving again.", 409);
  const next = validateEntity("communications", { next_follow_up: input.next_follow_up ?? person.next_follow_up, next_action: input.next_action ?? person.next_action }, person);
  const at = now();
  const statements = [stmt("UPDATE communications SET next_follow_up=?,next_action=?,updated_at=?,version=version+1 WHERE id=? AND version=?", next.next_follow_up,next.next_action,at,personId,person.version)];
  guard(statements);
  statements.push(stmt("INSERT INTO communication_entries(id,communication_id,type,occurred_at,subject,notes,actor,created_at) VALUES(?,?,?,?,?,?,?,?)", id,personId,input.type,occurredAt,subject,notes,actor,at));
  const label = input.type === "email-sent" ? "Logged email sent to" : input.type === "email-received" ? "Logged reply from" : "Added conversation note for";
  statements.push(stmt("INSERT INTO activity(id,actor,action,entity,entity_id,summary,created_at) VALUES(?,?,?,?,?,?,?)", crypto.randomUUID(),actor,"logged","communications",personId,`${label} ${person.name}`,at));
  try { await db.batch(statements); } catch (error) { conflict(error); }
  return { id };
}
export async function createClientFromCommunication(db, personId, input, actor) {
  const person = await db.first("SELECT * FROM communications WHERE id=?", [personId]);
  if (!person) throw new PlatformError("This person was not found.", 404);
  if (person.client_id) return { id: person.client_id, alreadyLinked: true };
  if (!input || input.expectedVersion !== person.version) throw new PlatformError("This conversation changed. Refresh it before creating the client.", 409);
  const clientId = crypto.randomUUID(), at = now();
  const statements = [stmt("UPDATE communications SET client_id=?,stage=?,updated_at=?,version=version+1 WHERE id=? AND version=?", clientId,person.stage === "active-client" ? "active-client" : "ordered",at,personId,person.version)];
  // Insert the new client before assigning its foreign key to the conversation.
  statements.unshift(stmt("INSERT INTO clients(id,name,email,phone,status,notes,created_at,updated_at) VALUES(?,?,?,?,'active',?,?,?)",clientId,person.company || person.name,person.email,person.phone,`Primary contact: ${person.name}`,at,at));
  guard(statements);
  statements.push(stmt("INSERT INTO contacts(id,client_id,name,email,phone,role,created_at,updated_at) VALUES(?,?,?,?,?,'Primary contact',?,?)",crypto.randomUUID(),clientId,person.name,person.email,person.phone,at,at));
  statements.push(stmt("INSERT INTO activity(id,actor,action,entity,entity_id,summary,created_at) VALUES(?,?,?,?,?,?,?)",crypto.randomUUID(),actor,"converted","communications",personId,`Created client ${person.company || person.name}; conversation history retained`,at));
  try { await db.batch(statements); } catch (error) { conflict(error); }
  return { id: clientId };
}
