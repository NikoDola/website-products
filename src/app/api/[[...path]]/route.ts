import { owner, AccessError, verifyMutation } from "@/admin/server/auth";
import { backend } from "@/admin/server/backend";
import { PlatformError } from "../../../shared/entities.mjs";
import { readLimited } from "../../../shared/security.mjs";
export const runtime = "nodejs";
export const maxDuration = 180;
async function handle(request: Request, context: { params: Promise<{ path?: string[] }> }) {
  try {
    const path = (await context.params).path?.join("/") || "";
    if (path === "webhooks/stripe" && request.method === "POST") {
      const upstream = await backend(path, "POST", "stripe-webhook", await readLimited(request, 1024 * 1024), { "stripe-signature": request.headers.get("stripe-signature") || "" });
      return new Response(upstream.body, { status: upstream.status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });
    }
    const actor = await owner();
    if (request.method === "POST") verifyMutation(request);
    const upstream = await backend(path, request.method, actor.email, request.method === "POST" ? await readLimited(request, path === "import" ? 8 * 1024 * 1024 : 256 * 1024) : undefined);
    return new Response(upstream.body, { status: upstream.status, headers: { "Content-Type": "application/json", "Cache-Control": "private, no-store", ...(path === "export" ? { "Content-Disposition": `attachment; filename="website-products-export-${new Date().toISOString().slice(0, 10)}.json"` } : {}) } });
  } catch (error) {
    const known = error instanceof AccessError || error instanceof PlatformError;
    return Response.json({ error: known ? error.message : "Check the platform API configuration and try again." }, { status: known ? error.status : 503, headers: { "Cache-Control": "no-store" } });
  }
}
export const GET = handle;
export const POST = handle;
