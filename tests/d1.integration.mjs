import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFile, readdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
const require=createRequire(new URL("../workers/api/package.json",import.meta.url));
const {build}=require("esbuild");
const {Miniflare,Log,LogLevel,convertV4MiniflareOptions}=require("miniflare");
test("cloud D1 API enforces authentication, CRUD, optimistic updates and export",async()=>{
  const script=(await build({entryPoints:[fileURLToPath(new URL("../workers/api/src/index.mjs",import.meta.url))],bundle:true,write:false,format:"esm",platform:"neutral",target:"es2022"})).outputFiles[0].text;
  const token="cloud-api-"+"x".repeat(40);
  const mf=new Miniflare(convertV4MiniflareOptions({modules:true,script,compatibilityDate:"2026-10-01",host:"127.0.0.1",port:0,d1Databases:["DB"],bindings:{PLATFORM_API_TOKEN:token},log:new Log(LogLevel.ERROR)}));
  try {
    const db=await mf.getD1Database("DB");
    const migrations=new URL("../workers/api/migrations/",import.meta.url);
    for (const file of (await readdir(migrations)).filter(name=>name.endsWith(".sql")).sort()) {
      const schema=await readFile(new URL(file,migrations),"utf8");
      await db.exec(schema.replace(/^--.*$/gm,"").replaceAll("\n"," "));
    }
    assert.equal((await mf.dispatchFetch("https://platform.example.com/api/snapshot")).status,401);
    const headers={Authorization:`Bearer ${token}`,"Content-Type":"application/json","x-platform-actor":"qa-owner"};
    const first=await(await mf.dispatchFetch("https://platform.example.com/api/snapshot",{headers})).json();assert.equal(first.sites[0].id,"breeze");
    const settings=first.settings[0];
    const saved=await mf.dispatchFetch("https://platform.example.com/api/entities/settings",{method:"POST",headers,body:JSON.stringify({id:"business",version:settings.version,name:"QA Business",timezone:"Europe/Skopje",currency:"eur"})});
    assert.equal(saved.status,200,await saved.text());
    const stale=await mf.dispatchFetch("https://platform.example.com/api/entities/settings",{method:"POST",headers,body:JSON.stringify({id:"business",version:settings.version,name:"Stale"})});assert.equal(stale.status,409);
    const latest=await(await mf.dispatchFetch("https://platform.example.com/api/snapshot",{headers})).json();assert.equal(latest.settings[0].name,"QA Business");assert.equal(latest.activity[0].actor,"qa-owner");
    await db.exec("INSERT INTO agreements(id,client_id,title,stripe_subscription_id,stripe_mode,created_at,updated_at) VALUES('maintenance','breeze-client','Maintenance','sub_Cloud','test','2026-01-01','2026-01-01'); INSERT INTO invoices(id,client_id,agreement_id,stripe_id,mode,amount_due,amount_paid,amount_remaining,currency,status,synced_at,stripe_subscription_id) VALUES('test-in_cloud','breeze-client','maintenance','in_cloud','test',2500,2500,0,'usd','paid','2026-01-01','sub_Cloud'); INSERT INTO payments(id,client_id,stripe_id,mode,amount,currency,status,paid_at,synced_at,agreement_id,stripe_subscription_id,stripe_invoice_id) VALUES('test-ch_cloud','breeze-client','ch_cloud','test',2500,'usd','succeeded','2026-01-01','2026-01-01','maintenance','sub_Cloud','in_cloud'); INSERT INTO payments(id,client_id,stripe_id,mode,amount,currency,status,synced_at) VALUES('legacy','breeze-client','ch_legacy','test',25000,'usd','succeeded','2026-01-01');");
    const billing=await(await mf.dispatchFetch("https://platform.example.com/api/snapshot",{headers})).json();assert.equal(billing.invoices.length,1);assert.equal(billing.payments.length,1);assert.equal(billing.payments[0].amount,2500);
    assert.equal(billing.client_billing[0].first_payment_at,"2026-01-01");
    const clientInfo=await mf.dispatchFetch("https://platform.example.com/api/entities/clients",{method:"POST",headers,body:JSON.stringify({name:"Client with assistant",first_name:"Alex",last_name:"Taylor",additional_contacts:[{email:"assistant@example.com",role:"Assistant"}]})});assert.equal(clientInfo.status,200,await clientInfo.text());
    const withInfo=await(await mf.dispatchFetch("https://platform.example.com/api/snapshot",{headers})).json();assert.equal(withInfo.clients.find(row=>row.name==="Client with assistant").last_name,"Taylor");assert.equal(withInfo.contacts.find(row=>row.role==="Assistant").email,"assistant@example.com");
    const added=await mf.dispatchFetch("https://platform.example.com/api/entities/communications",{method:"POST",headers,body:JSON.stringify({name:"Prospective Owner",email:"person@example.com"})});
    assert.equal(added.status,200);const personId=(await added.json()).id;
    const sent=await mf.dispatchFetch(`https://platform.example.com/api/communications/${personId}/entries`,{method:"POST",headers,body:JSON.stringify({id:crypto.randomUUID(),expectedVersion:1,type:"email-sent",occurred_at:new Date().toISOString(),subject:"Website proposal"})});
    assert.equal(sent.status,200,await sent.text());
    const history=await(await mf.dispatchFetch(`https://platform.example.com/api/communications/${personId}`,{headers})).json();assert.equal(history.person.emails_sent,1);
    const converted=await mf.dispatchFetch(`https://platform.example.com/api/communications/${personId}/create-client`,{method:"POST",headers,body:JSON.stringify({expectedVersion:history.person.version})});assert.equal(converted.status,200,await converted.text());
    const exported=await(await mf.dispatchFetch("https://platform.example.com/api/export",{headers})).json();assert.equal(exported.schemaVersion,1);assert.equal(exported.tables.settings[0].name,"QA Business");
    assert.equal((await mf.dispatchFetch("https://platform.example.com/api/snapshot",{headers:{...headers,Origin:"https://evil.example.com"}})).status,401);
  }finally{await mf.dispose();}
});
