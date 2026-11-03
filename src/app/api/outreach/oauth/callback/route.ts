import "server-only";
import { owner, AccessError } from "@/admin/server/auth";
import { openOutreach } from "@/admin/server/outreach-store.mjs";
import { consumeOAuth, oauthFinish, GmailConnectionError, gmailConnectionCode } from "@/admin/server/outreach-gmail.mjs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  let store, actorEmail;
  const url = new URL(request.url);
  const headers = new Headers({ "Cache-Control": "private, no-store", "Referrer-Policy": "no-referrer", "Set-Cookie": `outreach_oauth=; HttpOnly; SameSite=Lax; Path=/api/outreach/oauth/callback; Max-Age=0${process.env.GMAIL_REDIRECT_URI?.startsWith("https:") ? "; Secure" : ""}` });
  try {
    const actor = await owner(); actorEmail = actor.email; store = openOutreach();
    const binding = request.headers.get("cookie")?.split(";").map(part => part.trim()).find(part => part.startsWith("outreach_oauth="))?.slice("outreach_oauth=".length) || "";
    const pending = consumeOAuth(store, actor.email, url.searchParams.get("state"), binding);
    const code = url.searchParams.get("code");
    if (url.searchParams.has("error")) throw new GmailConnectionError("denied");
    if (!code || code.length > 4096) throw new GmailConnectionError("code");
    await oauthFinish(store, actor.email, pending, code);
    headers.set("Location", "/admin/marketing/new-clients?oauth=connected");
  } catch (error) {
    const reason = error instanceof AccessError ? "admin" : gmailConnectionCode(error);
    // Fixed enum only: provider payloads, codes, cookies and tokens never enter URLs/audit.
    if (store && actorEmail) { try { store.audit(actorEmail, "account.connect.failed", "", { reason }); } catch { /* Failure reporting must still redirect safely. */ } }
    headers.set("Location", `/admin/marketing/new-clients?oauth=failed&reason=${reason}`);
  } finally { store?.close(); }
  // Never echo OAuth codes, provider errors or tokens in browser-facing URLs.
  return new Response(null, { status: 303, headers });
}
