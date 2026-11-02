import "server-only";
import { headers } from "next/headers";
import { createRemoteJWKSet, jwtVerify } from "jose";
import { localAccess, mutationAllowed } from "../../shared/security.mjs";
export class AccessError extends Error {
  constructor(message: string, public status = 401) { super(message); }
}
let jwks: ReturnType<typeof createRemoteJWKSet> | undefined;
export async function owner() {
  const requestHeaders = await headers();
  const host = requestHeaders.get("host") || "";
  if (localAccess(host)) return { email: "local-owner", local: true };
  const domain = process.env.CF_ACCESS_TEAM_DOMAIN, audience = process.env.CF_ACCESS_AUD;
  const allowed = (process.env.ADMIN_ALLOWED_EMAILS || "").split(",").map(value => value.trim().toLowerCase()).filter(Boolean);
  if (!domain || !/^[a-z0-9-]+\.cloudflareaccess\.com$/.test(domain) || !audience || !allowed.length) throw new AccessError("Configure owner sign-in before hosting the admin.", 503);
  const token = requestHeaders.get("cf-access-jwt-assertion");
  if (!token) throw new AccessError("Open the admin through its protected custom domain to sign in.");
  jwks ||= createRemoteJWKSet(new URL(`https://${domain}/cdn-cgi/access/certs`));
  try {
    const { payload } = await jwtVerify(token, jwks, { issuer: `https://${domain}`, audience, algorithms: ["RS256"] });
    if (typeof payload.email !== "string" || !payload.sub || !allowed.includes(payload.email.toLowerCase())) throw new AccessError("This account does not have access.", 403);
    return { email: payload.email, local: false };
  } catch (error) {
    if (error instanceof AccessError) throw error;
    throw new AccessError("Your sign-in could not be verified. Sign in again through the protected domain.");
  }
}
export function verifyMutation(request: Request) {
  if (!mutationAllowed(request)) throw new AccessError("Invalid request origin.", 403);
}
