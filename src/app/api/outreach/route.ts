import "server-only";
import { owner, AccessError, verifyMutation } from "@/admin/server/auth";
import { openOutreach } from "@/admin/server/outreach-store.mjs";
import { createGmail, oauthStart } from "@/admin/server/outreach-gmail.mjs";
import { PlatformError } from "@/shared/entities.mjs";
import { readLimited } from "@/shared/security.mjs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const privateHeaders = { "Cache-Control": "private, no-store", "X-Robots-Tag": "noindex, nofollow" };
function failure(error: unknown) {
  const known = error instanceof AccessError || error instanceof PlatformError;
  return Response.json({ error: known ? error.message : "Outreach could not complete this request. Refresh and try again." }, { status: known ? error.status : 503, headers: privateHeaders });
}
export async function GET() {
  let store: ReturnType<typeof openOutreach> | undefined;
  try { await owner(); store = openOutreach(); return Response.json(store.snapshot(), { headers: privateHeaders }); }
  catch (error) { return failure(error); } finally { store?.close(); }
}
export async function POST(request: Request) {
  let store: ReturnType<typeof openOutreach> | undefined;
  try {
    const actor = await owner(); verifyMutation(request);
    let input;
    try { input = JSON.parse(await readLimited(request, 256000)); } catch (error) { if (error instanceof PlatformError) throw error; throw new PlatformError("Invalid JSON request."); }
    if (!input || typeof input !== "object" || Array.isArray(input)) throw new PlatformError("Invalid outreach request.");
    store = openOutreach(); const gmail = createGmail(store); let result: unknown;
    switch (input.action) {
      case "oauth.start": {
        const started = oauthStart(store, actor.email, input, process.env, request.headers.get("origin"));
        if (!started.binding) return Response.json({ url: started.url }, { headers: privateHeaders });
        // OAuth callback is a cross-site top-level GET. Lax keeps the browser binding intact.
        const secure = new URL(process.env.GMAIL_REDIRECT_URI!).protocol === "https:";
        return Response.json({ url: started.url }, { headers: { ...privateHeaders, "Set-Cookie": `outreach_oauth=${started.binding}; HttpOnly; SameSite=Lax; Path=/api/outreach/oauth/callback; Max-Age=600${secure ? "; Secure" : ""}` } });
      }
      case "account.update": result = store.updateAccount(input, actor.email); break;
      case "account.refresh": result = await gmail.refreshAccount(input.id, actor.email); break;
      case "account.resume": result = await gmail.refreshAccount(input.id, actor.email, true); break;
      case "account.disconnect": result = await gmail.disconnect(input.id, actor.email, input.version); break;
      case "draft.save": result = store.saveDraft(input, actor.email); break;
      case "email.send":
        if (input.deliberate_send !== true) throw new PlatformError("Use the Send button to send this email.");
        result = await gmail.send(input, actor.email); break;
      case "email.refresh": result = await gmail.refreshMessage(input.id, actor.email); break;
      case "lead.save": result = store.saveLead(input.record, actor.email); break;
      case "suppression.add": result = store.suppress(input, actor.email); break;
      case "suppression.remove": {
        const row = store.one("SELECT * FROM suppression WHERE id=?", String(input.id || ""));
        if (!row) throw new PlatformError("Suppression entry not found.", 404);
        const activeStore = store;
        activeStore.transaction(() => { activeStore.run("DELETE FROM suppression WHERE id=?", row.id); activeStore.audit(actor.email, "suppression.remove", row.id, { value: row.value, reason: row.reason }); });
        break;
      }
      default: throw new PlatformError("Choose a valid outreach action.");
    }
    return Response.json({ result: result ?? null }, { headers: privateHeaders });
  } catch (error) { return failure(error); } finally { store?.close(); }
}
