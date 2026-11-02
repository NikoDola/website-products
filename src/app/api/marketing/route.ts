import "server-only";
import { owner, AccessError, verifyMutation } from "@/admin/server/auth";
import { readMarketing, mutateMarketing } from "@/admin/server/marketing-store.mjs";
import { PlatformError } from "../../../shared/entities.mjs";
import { readLimited } from "../../../shared/security.mjs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "private, no-store" };
function failure(error: unknown) {
  const known = error instanceof AccessError || error instanceof PlatformError;
  return Response.json({ error: known ? error.message : "The marketing file could not be saved or loaded. Check file access and try again." }, { status: known ? error.status : 503, headers });
}
export async function GET(request: Request) {
  try {
    await owner();
    const data = await readMarketing();
    if (new URL(request.url).searchParams.get("download") === "1") return Response.json(data, { headers: { ...headers, "Content-Disposition": 'attachment; filename="marketing-backup.json"' } });
    // Full audit snapshots are available in the explicit backup download only.
    return Response.json({ ...data, activity: undefined }, { headers });
  } catch (error) { return failure(error); }
}
export async function POST(request: Request) {
  try {
    const actor = await owner();
    verifyMutation(request);
    let input;
    const body = await readLimited(request, 128 * 1024);
    try { input = JSON.parse(body); } catch { throw new PlatformError("Invalid JSON request."); }
    return Response.json(await mutateMarketing(input, actor.email), { headers });
  } catch (error) { return failure(error); }
}
