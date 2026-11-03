import "server-only";
import { owner, AccessError } from "@/admin/server/auth";
import { listTexasLocations, loadTexasLocations, searchTexas } from "@/admin/server/texas-locations.mjs";
import { PlatformError } from "@/shared/entities.mjs";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "private, no-store" };
export async function GET(request: Request) {
  try {
    await owner(); const data = loadTexasLocations(), params = new URL(request.url).searchParams;
    return Response.json({ locations: params.get("all") === "1" ? listTexasLocations(data) : searchTexas(params.get("q"), data), count: data.locations.length, source: data.source, source_url: data.source_url, imported_at: data.imported_at, license: data.license }, { headers });
  } catch (error) {
    const known = error instanceof AccessError || error instanceof PlatformError;
    return Response.json({ error: known ? error.message : "Texas directory could not load." }, { status: known ? error.status : 503, headers });
  }
}
