import test from "node:test";
import assert from "node:assert/strict";
import { publicUrl } from "../src/shared/entities.mjs";
import { localAccess } from "../src/shared/security.mjs";
import { probe, recordProbe, monitorTarget } from "../src/shared/monitor.mjs";
import { database } from "./helpers.mjs";
test("local development access cannot be enabled in production or on external hosts", () => {
  assert.equal(localAccess("127.0.0.1:3001",{NODE_ENV:"development"}),true);
  assert.equal(localAccess("127.0.0.1:3001",{NODE_ENV:"production",ADMIN_ALLOW_LOCAL:"true"}),false);
  assert.equal(localAccess("example.com:3001",{NODE_ENV:"development"}),false);
  assert.equal(localAccess("localhost:3001",{NODE_ENV:"development",VERCEL:"1"}),false);
});
test("monitor blocks private/non-HTTPS targets, unapproved hosts, redirects and credential reuse", async () => {
  for (const url of ["http://example.com","https://127.0.0.1","https://2130706433","https://[::1]","https://user:password@example.com","https://example.local","https://example.com:444"]) assert.throws(()=>publicUrl(url));
  assert.throws(()=>monitorTarget("https://example.com",{}),/approved/);
  let calls=0;
  const site={id:"breeze",public_url:"https://example.com",cms_status_url:"https://cms.example.com/api/monitor/status"};
  const missing = await probe(site,"cms",{MONITOR_ALLOWED_HOSTS:"cms.example.com"},async()=>{calls++;});
  assert.equal(missing.status,"not-configured"); assert.equal(calls,0);
  await probe(site,"public",{MONITOR_ALLOWED_HOSTS:"example.com"},async(url,options)=>{assert.equal(options.redirect,"error"); assert.equal(options.headers.Authorization,undefined);return new Response("<html>ok</html>",{headers:{"content-type":"text/html"}});});
});
test("monitor checks expected content and CMS identity, not just HTTP success",async()=>{
  const site={id:"breeze",public_url:"https://example.com",expected_text:"Breeze",cms_status_url:"https://cms.example.com/api/monitor/status"};
  const bad=await probe(site,"public",{MONITOR_ALLOWED_HOSTS:"example.com"},async()=>new Response("Wrong website",{headers:{"content-type":"text/html"}}));
  assert.equal(bad.status,"down");
  const cms=await probe(site,"cms",{MONITOR_ALLOWED_HOSTS:"cms.example.com",CMS_MONITOR_TOKENS_JSON:JSON.stringify({breeze:"m".repeat(40)})},async()=>Response.json({version:1,siteId:"other",environment:"live",ready:true,pendingPublications:0}));
  assert.equal(cms.status,"down");
});
test("two failures create one incident and recovery resolves it",async()=>{
  const db=await database();
  const base={site_id:"breeze",kind:"public",status:"down",http_status:503,latency_ms:10,message:"HTTP 503"};
  await recordProbe(db,{...base,id:crypto.randomUUID(),checked_at:"2026-10-29T10:00:00Z"});
  assert.equal((await db.all("SELECT * FROM incidents")).length,0);
  await recordProbe(db,{...base,id:crypto.randomUUID(),checked_at:"2026-10-29T10:05:00Z"});
  await recordProbe(db,{...base,id:crypto.randomUUID(),checked_at:"2026-10-29T10:10:00Z"});
  assert.equal((await db.all("SELECT * FROM incidents")).length,1);
  await recordProbe(db,{...base,id:crypto.randomUUID(),status:"healthy",checked_at:"2026-10-29T10:15:00Z"});
  assert.equal((await db.first("SELECT resolved_at FROM incidents")).resolved_at,"2026-10-29T10:15:00Z"); db.raw.close();
});
