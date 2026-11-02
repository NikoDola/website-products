import "server-only";
import { dispatch } from "../../shared/router.mjs";
export async function backend(path: string, method: string, actor: string, body?: string, extraHeaders?: Record<string, string>) {
  if (!/^[a-zA-Z0-9-]+(?:\/[a-zA-Z0-9-]+)*$/.test(path)) throw new Error("Invalid API path.");
  const url = process.env.PLATFORM_API_URL;
  if (url) {
    const origin = new URL(url);
    if (origin.origin !== url || origin.protocol !== "https:" || origin.username || origin.password || !process.env.PLATFORM_API_TOKEN || process.env.PLATFORM_API_TOKEN.length < 32) throw new Error("Invalid platform API configuration.");
    return fetch(`${origin.origin}/api/${path}`, { method, cache: "no-store", redirect: "error", signal: AbortSignal.timeout(180000), body,
      headers: { Authorization: `Bearer ${process.env.PLATFORM_API_TOKEN}`, "Content-Type": "application/json", "x-platform-actor": actor, ...extraHeaders } });
  }
  if (process.env.NODE_ENV === "production" || process.env.VERCEL) throw new Error("Configure the persistent platform API before hosting this application.");
  const { localDatabase } = await import("./local.mjs");
  return dispatch(new Request(`http://platform.local/api/${path}`, { method, body, headers: { "Content-Type": "application/json", ...extraHeaders } }), await localDatabase(), process.env, actor);
}
