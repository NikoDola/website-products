import { PlatformError } from "./entities.mjs";
export function localAccess(host, env = process.env) {
  return env.NODE_ENV !== "production" && !env.VERCEL && env.ADMIN_ALLOW_LOCAL !== "false" &&
    /^(127\.0\.0\.1|localhost):3001$/.test(host || "");
}
export function mutationAllowed(request, env = process.env) {
  if (request.headers.get("x-platform-request") !== "admin") return false;
  const origin = request.headers.get("origin");
  if (!origin) return false;
  try {
    const source = new URL(origin);
    const host = request.headers.get("host") || new URL(request.url).host;
    if (source.origin !== origin) return false;
    // Either supported loopback address can be used in development, but each
    // browser request must still come from its own exact origin and port.
    if (localAccess(host, env)) {
      return source.protocol === "http:" && localAccess(source.host, env) && source.host === host;
    }
    const expected = new URL(env.ADMIN_ORIGIN || "");
    return expected.protocol === "https:" && expected.origin === env.ADMIN_ORIGIN &&
      origin === expected.origin && host === expected.host;
  } catch { return false; }
}
export async function secretEqual(candidate, expected) {
  if (!candidate || !expected || candidate.length > 1024) return false;
  const bytes = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", bytes.encode(expected), { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]);
  return crypto.subtle.verify("HMAC", key, await crypto.subtle.sign("HMAC", key, bytes.encode(candidate)), bytes.encode(expected));
}
export async function readLimited(request, max = 256 * 1024) {
  if (Number(request.headers.get("content-length") || 0) > max) throw new PlatformError("Request is too large.", 413);
  const reader = request.body?.getReader();
  if (!reader) return "";
  const chunks = []; let count = 0;
  while (true) {
    const { value, done } = await reader.read(); if (done) break;
    count += value.length;
    if (count > max) { await reader.cancel(); throw new PlatformError("Request is too large.", 413); }
    chunks.push(value);
  }
  const bytes = new Uint8Array(count); let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  return new TextDecoder().decode(bytes);
}
