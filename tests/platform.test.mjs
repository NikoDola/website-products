import test from "node:test";
import assert from "node:assert/strict";
import { database } from "./helpers.mjs";
import { seed, saveRecord, snapshot, acquireJob } from "../src/shared/platform.mjs";
import { dispatch } from "../src/shared/router.mjs";
test("initial Breeze registration is idempotent and contains no fabricated payments/health", async () => {
  const db = await database(); await seed(db);
  const data = await snapshot(db, {});
  assert.equal(data.clients.length, 1); assert.equal(data.sites[0].id, "breeze");
  assert.equal(data.payments.length, 0); assert.equal(data.health_checks.length, 0);
  assert.equal(data.sites[0].monitor_enabled, 0); db.raw.close();
});
test("records persist, stale edits fail and business changes have actor audit records", async () => {
  const db = await database();
  const input = { name:"Test Client",email:"owner@example.com",status:"active" };
  const { id } = await saveRecord(db,"clients",input,"test-owner");
  const record = await db.first("SELECT * FROM clients WHERE id=?",[id]);
  await saveRecord(db,"clients",{id,version:record.version,name:"Updated Client"},"test-owner");
  await assert.rejects(saveRecord(db,"clients",{id,version:record.version,name:"Old edit"},"other-owner"),/changed/);
  assert.equal((await db.first("SELECT name FROM clients WHERE id=?",[id])).name,"Updated Client");
  assert.equal((await db.all("SELECT actor FROM activity WHERE entity_id=?",[id])).length,2);
  db.raw.close();
});
test("service scope and task website must belong to the selected client", async () => {
  const db = await database();
  const other = await saveRecord(db,"clients",{name:"Other Client"},"owner");
  await assert.rejects(saveRecord(db,"agreements",{client_id:other.id,title:"Maintenance",site_ids:["breeze"]},"owner"),/belong/);
  await assert.rejects(saveRecord(db,"tasks",{title:"Update",client_id:other.id,site_id:"breeze"},"owner"),/belong/);
  await saveRecord(db,"agreements",{client_id:"breeze-client",title:"Maintenance",amount:9900,currency:"eur",site_ids:["breeze"]},"owner");
  assert.equal((await db.all("SELECT * FROM agreement_sites")).length,1); db.raw.close();
});
test("financial mode, validation, job leases and unknown fields are enforced", async () => {
  const db = await database();
  await assert.rejects(saveRecord(db,"clients",{name:"Test",admin:true},"owner"),/Unexpected/);
  await assert.rejects(saveRecord(db,"agreements",{title:"Bad",client_id:"breeze-client",amount:-10},"owner"),/nonnegative/);
  assert.equal(await acquireJob(db,"test"),true); assert.equal(await acquireJob(db,"test"),false);
  const data = await snapshot(db,{STRIPE_SECRET_KEY:"do-not-expose",PLATFORM_API_TOKEN:"also-private"});
  assert.ok(!JSON.stringify(data).includes("do-not-expose")); assert.ok(!JSON.stringify(data).includes("also-private")); db.raw.close();
});
test("CRUD request handles malformed JSON and oversized payloads without writes", async () => {
  const db = await database();
  const result = await dispatch(new Request("https://api.example.com/api/entities/clients",{method:"POST",headers:{"Content-Type":"application/json"},body:"{"}),db,{},"owner");
  assert.equal(result.status,400);
  const huge = await dispatch(new Request("https://api.example.com/api/entities/clients",{method:"POST",headers:{"Content-Type":"application/json"},body:"x".repeat(270000)}),db,{},"owner");
  assert.equal(huge.status,413); db.raw.close();
});
