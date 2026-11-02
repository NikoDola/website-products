import { publicUrl, PlatformError } from "./entities.mjs";
import { acquireJob, finishJob, now, stmt } from "./platform.mjs";
export function monitorTarget(value, env) {
  const url = new URL(publicUrl(value));
  const allowed = (env.MONITOR_ALLOWED_HOSTS || "").split(",").map(host => host.trim().toLowerCase()).filter(Boolean);
  if (!allowed.includes(url.hostname)) throw new PlatformError("Hostname is not approved in MONITOR_ALLOWED_HOSTS.");
  return url.href;
}
async function boundedText(response, limit = 1024 * 1024) {
  const reader = response.body?.getReader(); if (!reader) return "";
  const decoder = new TextDecoder(); let text = "", bytes = 0;
  try {
    while (true) {
      const chunk = await reader.read(); if (chunk.done) break;
      bytes += chunk.value.byteLength;
      if (bytes > limit) throw new Error("Response exceeds the monitor size limit.");
      text += decoder.decode(chunk.value, { stream: true });
    }
    return text + decoder.decode();
  } finally { await reader.cancel().catch(() => {}); }
}
export async function probe(site, kind, env, fetcher = fetch) {
  const started = performance.now(), checked_at = now();
  const result = { id: crypto.randomUUID(), site_id: site.id, kind, checked_at, status: "down", http_status: null, latency_ms: null, message: "" };
  try {
    const target = monitorTarget(kind === "public" ? site.public_url : site.cms_status_url, env);
    const headers = { "User-Agent": "WebsiteProducts-Monitor/1.0", "Cache-Control": "no-cache" };
    if (kind === "cms") {
      let tokens;
      try { tokens = JSON.parse(env.CMS_MONITOR_TOKENS_JSON || "{}"); } catch { throw new PlatformError("CMS monitor token configuration is invalid."); }
      if (typeof tokens[site.id] !== "string" || tokens[site.id].length < 32) throw new PlatformError("Add this website's read-only CMS monitoring token.");
      headers.Authorization = `Bearer ${tokens[site.id]}`;
    }
    const response = await fetcher(target, { method: "GET", redirect: "error", cache: "no-store", signal: AbortSignal.timeout(10000), headers });
    result.http_status = response.status;
    const body = await boundedText(response);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    if (kind === "public") {
      if (!response.headers.get("content-type")?.includes("text/html")) throw new Error("Expected an HTML page.");
      if (site.expected_text && !body.toLowerCase().includes(site.expected_text.toLowerCase())) throw new Error("Expected website text was not found.");
      result.status = "healthy"; result.message = "Public page responded successfully.";
    } else {
      const status = JSON.parse(body);
      if (status.version !== 1 || status.siteId !== site.id || status.environment !== "live" || typeof status.ready !== "boolean" || !Number.isInteger(status.pendingPublications)) throw new Error("Unexpected CMS status contract or site/environment identity.");
      result.status = status.ready ? status.pendingPublications > 0 ? "degraded" : "healthy" : "down";
      result.message = !status.ready ? "CMS storage or schema is not ready." : status.pendingPublications ? `${status.pendingPublications} publication(s) awaiting delivery.` : "CMS storage and schema are ready.";
    }
  } catch (error) {
    if (error instanceof PlatformError) result.status = "not-configured";
    result.message = error instanceof PlatformError ? error.message : String(error.message || "Monitor request failed.").slice(0, 250);
  }
  result.latency_ms = Math.round(performance.now() - started);
  return result;
}
export async function recordProbe(db, result) {
  const keys = Object.keys(result);
  const actions = [stmt(`INSERT INTO health_checks(${keys.join(",")}) VALUES(${keys.map(() => "?").join(",")})`, ...Object.values(result))];
  if (result.status === "healthy") actions.push(stmt("UPDATE incidents SET resolved_at = ? WHERE site_id = ? AND kind = ? AND resolved_at IS NULL", result.checked_at, result.site_id, result.kind));
  await db.batch(actions);
  if (["down", "degraded"].includes(result.status)) {
    const recent = await db.all("SELECT status FROM health_checks WHERE site_id = ? AND kind = ? ORDER BY checked_at DESC LIMIT 2", [result.site_id, result.kind]);
    if (recent.length === 2 && recent.every(row => ["down", "degraded"].includes(row.status))) {
      await db.batch([stmt("INSERT OR IGNORE INTO incidents(id,site_id,kind,opened_at,message) VALUES(?,?,?,?,?)", crypto.randomUUID(), result.site_id, result.kind, result.checked_at, result.message)]);
    }
  }
}
export async function runMonitoring(db, env, fetcher = fetch) {
  if (!await acquireJob(db, "monitor", 840)) throw new PlatformError("Monitoring is already running.", 409);
  let count = 0;
  try {
    const sites = await db.all("SELECT * FROM sites WHERE monitor_enabled = 1 AND state != 'archived' ORDER BY id LIMIT 100");
    // Limit concurrency to avoid exhausting Worker subrequests/connections.
    for (let i = 0; i < sites.length; i += 3) {
      await Promise.all(sites.slice(i, i + 3).map(async site => {
        for (const kind of site.cms_status_url ? ["public", "cms"] : ["public"]) {
          await recordProbe(db, await probe(site, kind, env, fetcher)); count++;
        }
      }));
    }
    await db.batch([stmt("DELETE FROM health_checks WHERE checked_at < ?", new Date(Date.now() - 90 * 86400000).toISOString())]);
    await finishJob(db, "monitor"); return { checked: count };
  } catch (error) { await finishJob(db, "monitor", "Monitoring could not complete."); throw error; }
}
