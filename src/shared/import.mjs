import { entities, PlatformError, validateEntity, publicUrl } from "./entities.mjs";
import { exportTables } from "./router.mjs";
import { now, stmt } from "./platform.mjs";
export async function importFresh(db, payload, actor) {
  if (payload?.schemaVersion !== 1 || !payload.tables || Object.keys(payload.tables).some(table => !exportTables.includes(table))) throw new PlatformError("Unsupported business export.");
  const existing = await db.first("SELECT (SELECT COUNT(*) FROM activity) + (SELECT COUNT(*) FROM invoices) + (SELECT COUNT(*) FROM payments) + (SELECT COUNT(*) FROM tasks) + (SELECT COUNT(*) FROM orders) + (SELECT COUNT(*) FROM calls) + (SELECT COUNT(*) FROM campaigns) + (SELECT COUNT(*) FROM contacts) + (SELECT COUNT(*) FROM agreements) + (SELECT COUNT(*) FROM communications) AS count");
  if (existing.count || (await db.first("SELECT COUNT(*) AS count FROM clients")).count > 1 || (await db.first("SELECT COUNT(*) AS count FROM sites")).count > 1) throw new PlatformError("Import requires a fresh agency database. Existing business records will not be overwritten.", 409);
  let count = 0; const statements = [];
  for (const table of exportTables) {
    const rows = payload.tables[table] || [];
    if (!Array.isArray(rows) || rows.length > 10000) throw new PlatformError("The import is too large.");
    const columns = new Set((await db.all(`PRAGMA table_info(${table})`)).map(row => row.name));
    for (const row of rows) {
      if (!row || typeof row !== "object" || Array.isArray(row) || typeof row.id !== "string" && table !== "agreement_sites") throw new PlatformError("Invalid imported record.");
      const keys = Object.keys(row);
      if (!keys.length || keys.some(key => !columns.has(key)) || Object.values(row).some(value => value !== null && !["string", "number"].includes(typeof value))) throw new PlatformError("Unknown or invalid imported columns.");
      if (entities[table]) {
        const input = Object.fromEntries(entities[table].fields.filter(field => field.name !== "site_ids").map(field => [field.name, row[field.name]]));
        validateEntity(table, input);
      }
      for (const key of ["hosted_url", "receipt_url"]) if (row[key]) publicUrl(row[key]);
      statements.push(stmt(`INSERT INTO ${table}(${keys.join(",")}) VALUES(${keys.map(() => "?").join(",")}) ON CONFLICT DO UPDATE SET ${keys.filter(key => key !== "id").map(key => `${key}=excluded.${key}`).join(",")}`, ...Object.values(row)));
      count++;
    }
  }
  if (count > 15000) throw new PlatformError("The import is too large.");
  statements.push(stmt("INSERT INTO activity(id,actor,action,entity,entity_id,summary,created_at) VALUES(?,?,?,?,?,?,?)", crypto.randomUUID(), actor, "imported", "platform", "all", `Imported ${count} records into a fresh database`, now()));
  try { await db.batch(statements); } catch { throw new PlatformError("Import failed validation or database constraints. No records were imported."); }
  return { imported: count };
}
