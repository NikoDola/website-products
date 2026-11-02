import { entities, PlatformError, validateEntity } from "./entities.mjs";
import { businessDate, localMidnightUtc } from "./time.mjs";
import { communicationQuery } from "./communications.mjs";
export const now = () => new Date().toISOString();
export const stmt = (sql, ...args) => ({ sql, args });
export async function seed(db) {
  const at = now();
  await db.batch([
    stmt("INSERT OR IGNORE INTO settings(id,currency,timezone,country,updated_at) VALUES('business','usd','Europe/Skopje','North Macedonia',?)", at),
    stmt("INSERT OR IGNORE INTO clients(id, name, notes, created_at, updated_at) VALUES('breeze-client', 'Breeze Heating & Cooling', 'First website. Confirm contact, service and billing details before entering them.', ?, ?)", at, at),
    stmt("INSERT OR IGNORE INTO sites(id, client_id, name, public_url, cms_url, project_path, cms_status_url, state, expected_text, created_at, updated_at) VALUES('breeze', 'breeze-client', 'Breeze Heating & Cooling', 'https://breeze-full.vercel.app/', 'https://breeze-full.vercel.app/admin', 'breeze-web', 'https://breeze-live-api.nikodola.workers.dev/api/monitor/status', 'live', 'Breeze', ?, ?)", at, at)
  ]);
}
export async function audit(db, actor, action, entity, id, summary) {
  await db.batch([stmt("INSERT INTO activity(id,actor,action,entity,entity_id,summary,created_at) VALUES(?,?,?,?,?,?,?)", crypto.randomUUID(), actor, action, entity, id, summary, now())]);
}
export async function saveRecord(db, entity, input, actor) {
  if (!entities[entity]) throw new PlatformError("Unknown record type.", 404);
  const id = entity === "settings" ? "business" : input.id || crypto.randomUUID();
  if (!/^[a-zA-Z0-9-]{1,100}$/.test(id)) throw new PlatformError("Use a stable ID with letters, numbers and hyphens.");
  const existing = await db.first(`SELECT * FROM ${entity} WHERE id = ?`, [id]);
  if (existing && (!Number.isInteger(input.version) || input.version !== existing.version)) throw new PlatformError("This record changed. Refresh before saving again.", 409);
  const values = validateEntity(entity, input, existing);
  const additionalContacts = values.additional_contacts;
  delete values.additional_contacts;
  if (entity === "clients" && existing) {
    for (const [mode, field] of [["test", "stripe_test_id"], ["live", "stripe_live_id"]]) {
      if (existing[field] && existing[field] !== values[field]) {
        const linked = await db.first("SELECT id FROM invoices WHERE client_id = ? AND mode = ? AND stripe_subscription_id!='' UNION ALL SELECT id FROM payments WHERE client_id = ? AND mode = ? AND stripe_subscription_id!='' LIMIT 1", [id, mode, id, mode]);
        if (linked) throw new PlatformError("This customer has imported payment records. Keep its Stripe mapping and create a separate client for another customer.");
      }
    }
  }
  if (entity === "agreements" && values.stripe_subscription_id) {
    if (values.cadence === "one-time") throw new PlatformError("Maintenance subscription tracking requires a recurring billing cycle.");
    const duplicate = await db.first("SELECT id FROM agreements WHERE stripe_subscription_id=? AND stripe_mode=? AND id!=?", [values.stripe_subscription_id, values.stripe_mode, id]);
    if (duplicate) throw new PlatformError("This maintenance subscription is already linked to a service.", 409);
  }
  if (entity === "agreements" && existing && (existing.stripe_subscription_id !== values.stripe_subscription_id || existing.stripe_mode !== values.stripe_mode || existing.client_id !== values.client_id)) {
    if (await db.first("SELECT id FROM invoices WHERE agreement_id=? LIMIT 1", [id])) throw new PlatformError("This service has imported invoices. Keep its subscription mapping and create another service for a new subscription.", 409);
  }
  if (values.client_id && !await db.first("SELECT id FROM clients WHERE id = ?", [values.client_id])) throw new PlatformError("Select an existing client.");
  if (values.site_id) {
    const site = await db.first("SELECT client_id FROM sites WHERE id = ?", [values.site_id]);
    if (!site || (values.client_id && values.client_id !== site.client_id)) throw new PlatformError("The selected website must belong to this client.");
    values.client_id = site.client_id;
  }
  const siteIds = values.site_ids || []; delete values.site_ids;
  for (const siteId of siteIds) {
    const site = await db.first("SELECT client_id FROM sites WHERE id = ?", [siteId]);
    if (!site || site.client_id !== values.client_id) throw new PlatformError("Covered websites must belong to the selected client.");
  }
  if (entity === "sites" && existing && existing.client_id !== values.client_id) {
    const linked = await db.first("SELECT site_id FROM agreement_sites WHERE site_id = ? UNION ALL SELECT site_id FROM tasks WHERE site_id = ? LIMIT 1", [id, id]);
    if (linked) throw new PlatformError("This website is linked to services/tasks. Resolve those links before changing its client.");
  }
  const at = now(), columns = Object.keys(values);
  const statements = existing ? [stmt(`UPDATE ${entity} SET ${columns.map(key => `${key} = ?`).join(", ")}, updated_at = ?, version = version + 1 WHERE id = ? AND version = ?`, ...Object.values(values), at, id, input.version)] :
    [stmt(`INSERT INTO ${entity}(id,${columns.join(",")},created_at,updated_at) VALUES(${Array(columns.length + 3).fill("?").join(",")})`, id, ...Object.values(values), at, at)];
  // Force the entire batch to roll back if a concurrent update won the race.
  if (existing) statements.push(stmt("INSERT INTO platform_update_guard(value) VALUES(changes())"), stmt("DELETE FROM platform_update_guard"));
  if (entity === "clients" && additionalContacts) {
    for (const contact of additionalContacts) {
      const contactId = contact.id || crypto.randomUUID();
      const previous = await db.first("SELECT client_id,version FROM contacts WHERE id=?", [contactId]);
      if (previous && previous.client_id !== id) throw new PlatformError("This contact belongs to another client.");
      if (previous && previous.version !== contact.version || !previous && contact.version) throw new PlatformError("A contact changed. Refresh before saving again.", 409);
      if (contact.deleted) statements.push(stmt("DELETE FROM contacts WHERE id=? AND client_id=? AND version=?", contactId, id, contact.version));
      else if (previous) statements.push(stmt("UPDATE contacts SET name=?,email=?,phone=?,role=?,updated_at=?,version=version+1 WHERE id=? AND client_id=? AND version=?", contact.name, contact.email, contact.phone, contact.role, at, contactId, id, contact.version));
      else statements.push(stmt("INSERT INTO contacts(id,client_id,name,email,phone,role,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?)", contactId, id, contact.name, contact.email, contact.phone, contact.role, at, at));
      if (previous) statements.push(stmt("INSERT INTO platform_update_guard(value) VALUES(changes())"), stmt("DELETE FROM platform_update_guard"));
    }
  }
  if (entity === "agreements") {
    statements.push(stmt("DELETE FROM agreement_sites WHERE agreement_id = ?", id));
    for (const siteId of siteIds) statements.push(stmt("INSERT INTO agreement_sites(agreement_id,site_id) VALUES(?,?)", id, siteId));
  }
  statements.push(stmt("INSERT INTO activity(id,actor,action,entity,entity_id,summary,created_at) VALUES(?,?,?,?,?,?,?)", crypto.randomUUID(), actor, existing ? "updated" : "created", entity, id, `${existing ? "Updated" : "Added"} ${values.name || values.title || entities[entity].singular}`, at));
  try { await db.batch(statements); }
  catch (error) {
    if (String(error).includes("platform_update_guard") || String(error).includes("CHECK constraint")) throw new PlatformError("This record changed. Refresh and try again.", 409);
    if (String(error).includes("UNIQUE")) throw new PlatformError("This ID or Stripe customer is already registered.", 409);
    throw error;
  }
  return { id };
}
export async function snapshot(db, env) {
  const data = {};
  for (const entity of Object.keys(entities)) {
    data[entity] = entity === "communications"
      ? await db.all(`${communicationQuery} GROUP BY c.id ORDER BY c.updated_at DESC LIMIT 1000`)
      : await db.all(`SELECT * FROM ${entity} ORDER BY updated_at DESC LIMIT 1000`);
  }
  data.agreement_sites = await db.all("SELECT * FROM agreement_sites");
  for (const agreement of data.agreements) agreement.site_ids = data.agreement_sites.filter(link => link.agreement_id === agreement.id).map(link => link.site_id);
  const mode = env.STRIPE_MODE === "live" ? "live" : "test";
  const maintenanceInvoices = "invoices i JOIN agreements a ON a.id=i.agreement_id AND a.client_id=i.client_id AND a.stripe_subscription_id=i.stripe_subscription_id AND a.stripe_mode=i.mode AND a.cadence!='one-time' AND i.stripe_subscription_id!=''";
  const maintenancePayments = "payments p JOIN invoices i ON i.stripe_id=p.stripe_invoice_id AND i.mode=p.mode AND i.client_id=p.client_id AND i.agreement_id=p.agreement_id AND i.stripe_subscription_id=p.stripe_subscription_id JOIN agreements a ON a.id=p.agreement_id AND a.client_id=p.client_id AND a.stripe_subscription_id=p.stripe_subscription_id AND a.stripe_mode=p.mode AND a.cadence!='one-time' AND p.stripe_subscription_id!=''";
  data.invoices = await db.all(`SELECT i.* FROM ${maintenanceInvoices} WHERE i.mode=? ORDER BY COALESCE(i.paid_at,i.due_at,i.synced_at) DESC LIMIT 1000`, [mode]);
  data.payments = await db.all(`SELECT p.* FROM ${maintenancePayments} WHERE p.mode=? ORDER BY p.paid_at DESC LIMIT 1000`, [mode]);
  data.client_billing = await db.all(`SELECT p.client_id,MIN(p.paid_at) AS first_payment_at,MAX(p.paid_at) AS last_payment_at FROM ${maintenancePayments} WHERE p.mode=? AND p.amount>0 GROUP BY p.client_id`, [mode]);
  data.health_checks = await db.all("SELECT * FROM health_checks ORDER BY checked_at DESC LIMIT 500");
  data.incidents = await db.all("SELECT * FROM incidents ORDER BY opened_at DESC LIMIT 100");
  data.activity = await db.all("SELECT * FROM activity ORDER BY created_at DESC LIMIT 100");
  data.jobs = await db.all("SELECT id,last_success_at,last_attempt_at,error,cursor FROM jobs");
  const timezone = data.settings[0]?.timezone || "Europe/Skopje", today = businessDate(timezone);
  const start = localMidnightUtc(`${today.slice(0,7)}-01`, timezone), dueBefore = localMidnightUtc(today, timezone);
  data.summary = {
    followUpsDue: (await db.first("SELECT COUNT(*) AS count FROM communications WHERE stage!='closed' AND next_follow_up!='' AND next_follow_up<=?", [today])).count,
    activeClients: (await db.first("SELECT COUNT(*) AS count FROM clients WHERE status='active'")).count,
    siteCount: (await db.first("SELECT COUNT(*) AS count FROM sites")).count,
    openIncidents: (await db.first("SELECT COUNT(*) AS count FROM incidents WHERE resolved_at IS NULL")).count,
    overdueCount: (await db.first(`SELECT COUNT(*) AS count FROM ${maintenanceInvoices} WHERE i.mode=? AND i.status='open' AND i.amount_remaining>0 AND i.due_at<?`, [mode,dueBefore])).count,
    received: await db.all(`SELECT p.currency,SUM(p.amount-p.refunded) AS amount FROM ${maintenancePayments} WHERE p.mode=? AND p.paid_at>=? GROUP BY p.currency`,[mode,start]),
    outstanding: await db.all(`SELECT i.currency,SUM(i.amount_remaining) AS amount FROM ${maintenanceInvoices} WHERE i.mode=? AND i.status='open' GROUP BY i.currency`,[mode]),
    overdue: await db.all(`SELECT i.currency,SUM(i.amount_remaining) AS amount FROM ${maintenanceInvoices} WHERE i.mode=? AND i.status='open' AND i.amount_remaining>0 AND i.due_at<? GROUP BY i.currency`,[mode,dueBefore])
  };
  data.connections = {
    storage: env.PLATFORM_API_URL || env.DB ? "cloud" : "local",
    stripe: Boolean(env.STRIPE_SECRET_KEY), stripeMode: mode,
    webhook: Boolean(env.STRIPE_WEBHOOK_SECRET), monitoringHosts: (env.MONITOR_ALLOWED_HOSTS || "").split(",").filter(Boolean),
    authentication: env.CF_ACCESS_AUD ? "Cloudflare Access" : "Local development",
    stripeApiVersion: "2025-09-30.clover"
  };
  return data;
}
export async function acquireJob(db, id, seconds = 240) {
  const at = now(), until = Date.now() + seconds * 1000;
  await db.batch([stmt("INSERT OR IGNORE INTO jobs(id) VALUES(?)", id)]);
  const result = await db.run("UPDATE jobs SET lease_until = ?, last_attempt_at = ? WHERE id = ? AND lease_until < ?", [until, at, id, Date.now()]);
  return result.changes > 0;
}
export async function finishJob(db, id, error = null) {
  await db.batch([stmt(error ? "UPDATE jobs SET lease_until = 0,error = ? WHERE id = ?" : "UPDATE jobs SET lease_until = 0,error = NULL,last_success_at = ? WHERE id = ?", error || now(), id)]);
}
