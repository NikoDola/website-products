import "server-only";
import { owner, AccessError, verifyMutation } from "@/admin/server/auth";
import { openOutreach } from "@/admin/server/outreach-store.mjs";
import { discoverBusinesses } from "@/admin/server/outreach-discovery.mjs";
import { PlatformError } from "@/shared/entities.mjs";
import { readLimited } from "@/shared/security.mjs";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "private, no-store" };
export async function POST(request: Request) {
  let store;
  try {
    const actor = await owner(); verifyMutation(request);
    let input;
    try { input = JSON.parse(await readLimited(request, 2000)); } catch { throw new PlatformError("Invalid location search."); }
    if (typeof input?.location_id !== "string") throw new PlatformError("Choose a Texas location.");
    store = openOutreach();
    return Response.json(await discoverBusinesses(store, input.location_id, actor.email), { headers });
  } catch (error) {
    const known = error instanceof AccessError || error instanceof PlatformError;
    return Response.json({ error: known ? error.message : "Business search could not complete." }, { status: known ? error.status : 503, headers });
  } finally { store?.close(); }
}
