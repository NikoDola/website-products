import test from "node:test";
import assert from "node:assert/strict";
import { mutationAllowed } from "../src/shared/security.mjs";

const development = { NODE_ENV: "development", ADMIN_ORIGIN: "http://127.0.0.1:3001" };
function request(host, origin, extra = {}) {
  return new Request(`http://${host}/api/entities/settings`, {
    method: "POST",
    headers: { host, ...(origin === undefined ? {} : { origin }), "x-platform-request": "admin", ...extra }
  });
}
test("settings saves support either exact local browser origin despite the configured default", () => {
  for (const host of ["localhost:3001", "127.0.0.1:3001"]) {
    assert.equal(mutationAllowed(request(host, `http://${host}`), development), true);
  }
});
test("local saves still reject foreign origins, other ports, missing headers and forged forwarded hosts", () => {
  for (const origin of [undefined, "null", "https://evil.example.com", "http://localhost:3000", "https://localhost:3001", "http://user@localhost:3001", "http://localhost:3001/"]) {
    assert.equal(mutationAllowed(request("localhost:3001", origin), development), false, String(origin));
  }
  assert.equal(mutationAllowed(request("localhost:3001", "http://127.0.0.1:3001"), development), false);
  assert.equal(mutationAllowed(request("localhost:3001", "http://localhost:3001", { "x-platform-request": "" }), development), false);
  assert.equal(mutationAllowed(request("evil.example.com", "http://localhost:3001", { "x-forwarded-host": "localhost:3001" }), development), false);
});
test("hosted saves retain exact configured HTTPS origin and host checks", () => {
  const hosted = { NODE_ENV: "production", ADMIN_ALLOW_LOCAL: "true", ADMIN_ORIGIN: "https://admin.example.com" };
  assert.equal(mutationAllowed(request("admin.example.com", "https://admin.example.com"), hosted), true);
  assert.equal(mutationAllowed(request("admin.example.com", "https://other.example.com"), hosted), false);
  assert.equal(mutationAllowed(request("other.example.com", "https://admin.example.com"), hosted), false);
  assert.equal(mutationAllowed(request("localhost:3001", "http://localhost:3001"), hosted), false);
  assert.equal(mutationAllowed(request("127.0.0.1:3001", "http://127.0.0.1:3001"), { ...development, VERCEL: "1" }), false);
  assert.equal(mutationAllowed(request("admin.example.com", "https://admin.example.com"), { NODE_ENV: "production" }), false);
});
