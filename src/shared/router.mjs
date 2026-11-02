import { entities, PlatformError } from "./entities.mjs";
import { saveRecord, snapshot, audit } from "./platform.mjs";
import { runMonitoring } from "./monitor.mjs";
import { syncStripe, handleWebhook } from "./stripe.mjs";
import { readLimited } from "./security.mjs";
import { importFresh } from "./import.mjs";
import { communicationHistory, logCommunication, createClientFromCommunication } from "./communications.mjs";
export const response = (data, status = 200) => Response.json(data, { status, headers: { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" } });
// Retain any older Orders/Calls/Marketing rows in backups after hiding those modules.
export const exportTables = [...Object.keys(entities), "communication_entries", "orders", "calls", "campaigns", "agreement_sites", "invoices", "payments", "health_checks", "incidents", "activity"];
export async function dispatch(request, db, env, actor = "system") {
  const path = new URL(request.url).pathname.replace(/^\/api\//, "");
  try {
    if (path === "webhooks/stripe" && request.method === "POST") return response(await handleWebhook(db, env, await readLimited(request, 1024 * 1024), request.headers.get("stripe-signature")));
    if (path === "snapshot" && request.method === "GET") return response(await snapshot(db, env));
    const communication = path.match(/^communications\/([a-zA-Z0-9-]{1,100})(?:\/(entries|create-client))?$/);
    if (communication && request.method === "GET" && !communication[2]) return response(await communicationHistory(db, communication[1]));
    if (path === "export" && request.method === "GET") {
      const tables = {};
      for (const table of exportTables) tables[table] = await db.all(`SELECT * FROM ${table}`);
      await audit(db, actor, "exported", "platform", "all", "Exported business records");
      return response({ schemaVersion: 1, exportedAt: new Date().toISOString(), tables });
    }
    if (request.method === "POST") {
      if (request.headers.get("content-type")?.split(";")[0] !== "application/json") throw new PlatformError("Expected JSON.", 415);
      const raw = await readLimited(request, path === "import" ? 8 * 1024 * 1024 : 256 * 1024); let input;
      try { input = JSON.parse(raw || "{}"); } catch { throw new PlatformError("Invalid JSON."); }
      if (path === "import") return response(await importFresh(db, input, actor));
      if (communication?.[2] === "entries") return response(await logCommunication(db, communication[1], input, actor));
      if (communication?.[2] === "create-client") return response(await createClientFromCommunication(db, communication[1], input, actor));
      const match = path.match(/^entities\/([a-z]+)$/);
      if (match) return response(await saveRecord(db, match[1], input, actor));
      if (path === "jobs/monitor") {
        const result = await runMonitoring(db, env);
        await audit(db, actor, "checked", "monitor", "all", `Checked ${result.checked} website signals`); return response(result);
      }
      if (path === "jobs/stripe") {
        const result = await syncStripe(db, env);
        await audit(db, actor, "synced", "stripe", result.mode, `Synchronized ${result.clients} linked clients`); return response(result);
      }
    }
    return response({ error: "Not found." }, 404);
  } catch (error) {
    if (error instanceof PlatformError) return response({ error: error.message }, error.status);
    console.error("Platform request failed:", error instanceof Error ? error.name : "Unknown error");
    return response({ error: "The request could not complete. Check server configuration and retry." }, 500);
  }
}
