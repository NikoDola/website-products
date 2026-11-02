// Only imported by authenticated server routes and temporary-directory tests.
import { readFile, mkdir, open, rename, unlink } from "node:fs/promises";
import { dirname, isAbsolute } from "node:path";
import { randomUUID } from "node:crypto";
import { PlatformError } from "../../shared/entities.mjs";
import { validateMarketingRecord } from "../../shared/marketing.mjs";
import { privateDataPath } from "../../shared/server/paths.mjs";

export function marketingPath(env = process.env) {
  if ((env.NODE_ENV === "production" || env.VERCEL) && (!env.MARKETING_DATA_PATH || !isAbsolute(env.MARKETING_DATA_PATH))) {
    throw new PlatformError("Marketing needs a persistent JSON file. Configure MARKETING_DATA_PATH on a persistent Node server before hosting this section.", 503);
  }
  return privateDataPath("marketing.json", env.MARKETING_DATA_PATH);
}
export async function readMarketing(path = marketingPath()) {
  let text;
  try { text = await readFile(path, "utf8"); }
  catch (error) {
    if (error.code === "ENOENT") throw new PlatformError("The marketing contact file is missing. Run python scripts/import-marketing-prospects.py from the project root to import the source PDFs.", 503);
    throw error;
  }
  let data;
  try { data = JSON.parse(text); } catch { throw new PlatformError("The marketing JSON file could not be read. Restore a backup before saving.", 503); }
  if (data.schema_version !== 1 || !Array.isArray(data.records) || !Array.isArray(data.activity) || !Array.isArray(data.contest_history)
    || data.records.some(row => !row || typeof row.id !== "string" || !Number.isInteger(row.version) || row.version < 1)
    || new Set(data.records.map(row => row.id)).size !== data.records.length) throw new PlatformError("The marketing file has an unsupported format. Restore a backup before saving.", 503);
  return data;
}
async function atomicWrite(path, data) {
  const temporary = `${path}.${randomUUID()}.tmp`;
  try {
    const file = await open(temporary, "wx", 0o600);
    try { await file.writeFile(JSON.stringify(data, null, 2) + "\n", "utf8"); await file.sync(); }
    finally { await file.close(); }
    await rename(temporary, path);
  } finally { await unlink(temporary).catch(error => { if (error.code !== "ENOENT") throw error; }); }
}
export async function mutateMarketing(input, actor, path = marketingPath()) {
  if (!input || typeof input !== "object" || Array.isArray(input) || !["save", "delete"].includes(input.action)) throw new PlatformError("Choose a valid marketing action.");
  await mkdir(dirname(path), { recursive: true });
  let lock;
  try { lock = await open(`${path}.lock`, "wx", 0o600); }
  catch (error) { if (error.code === "EEXIST") throw new PlatformError("Another marketing save is in progress. Retry in a moment.", 409); throw error; }
  try {
    await lock.writeFile(JSON.stringify({ pid: process.pid, at: new Date().toISOString() }));
    const data = await readMarketing(path);
    const before = input.id ? data.records.find(row => row.id === input.id) : undefined;
    if (input.id && !before || input.action === "delete" && !before) throw new PlatformError("This contact no longer exists. Reload the list.", 404);
    if (before && (!Number.isInteger(input.version) || before.version !== input.version)) throw new PlatformError("This contact changed in another window. Reload the list before editing again.", 409);
    const now = new Date().toISOString();
    let after = null;
    if (input.action === "save") {
      const values = validateMarketingRecord(input.record);
      after = { ...before, ...values, id: before?.id || `marketing-${randomUUID()}`, version: (before?.version || 0) + 1,
        history: before?.history || [], contests: before?.contests || [], kind: before?.kind || "manual",
        created_at: before?.created_at || now, updated_at: now };
    }
    const next = { ...data, updated_at: now, records: before ? data.records.flatMap(row => row.id === before.id ? (after ? [after] : []) : [row]) : [...data.records, after],
      activity: [...data.activity, { id: randomUUID(), actor, at: now, action: input.action === "delete" ? "delete" : before ? "update" : "create", record_id: after?.id || before.id, before: before || null, after }] };
    // Keep the preceding complete file, including source provenance and edits.
    await atomicWrite(`${path}.backup.json`, data);
    await atomicWrite(path, next);
    return { record: after };
  } finally {
    await lock.close();
    await unlink(`${path}.lock`);
  }
}
