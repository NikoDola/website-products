import test from "node:test";
import assert from "node:assert/strict";
import { businessDate,localMidnightUtc } from "../src/shared/time.mjs";
import { database } from "./helpers.mjs";
import { snapshot,stmt,saveRecord } from "../src/shared/platform.mjs";
import { storeInvoice } from "../src/shared/stripe.mjs";
test("business date and monthly boundaries respect timezone and daylight saving",()=>{
  assert.equal(businessDate("Europe/Skopje",new Date("2026-10-31T23:30:00Z")),"2026-11-01");
  assert.equal(localMidnightUtc("2026-10-01","Europe/Skopje"),"2026-09-30T22:00:00.000Z");
  assert.equal(localMidnightUtc("2026-11-01","Europe/Skopje"),"2026-10-31T23:00:00.000Z");
  assert.equal(localMidnightUtc("2026-01-01","America/New_York"),"2026-01-01T05:00:00.000Z");
});
test("financial totals include records beyond the displayed 1000-row list",async()=>{
  const db=await database(),at=new Date().toISOString();
  const service=await saveRecord(db,"agreements",{client_id:"breeze-client",title:"Maintenance",stripe_subscription_id:"sub_Summary",stripe_mode:"test"},"owner");
  await storeInvoice(db,{id:"in_summary",livemode:false,subscription:"sub_Summary",amount_due:1001,amount_paid:1001,currency:"eur",status:"paid"},"breeze-client","test");
  await db.batch(Array.from({length:1001},(_,i)=>stmt("INSERT INTO payments(id,client_id,stripe_id,mode,amount,currency,status,paid_at,synced_at,agreement_id,stripe_subscription_id,stripe_invoice_id) VALUES(?,'breeze-client',?,'test',1,'eur','succeeded',?,?,?,'sub_Summary','in_summary')",`test-charge-${i}`,`ch_${i}`,at,at,service.id)));
  await storeInvoice(db,{id:"in_first",livemode:false,subscription:"sub_Summary",amount_due:100,amount_paid:100,currency:"eur",status:"paid"},"breeze-client","test");
  await db.batch([stmt("INSERT INTO payments(id,client_id,stripe_id,mode,amount,currency,status,paid_at,synced_at,agreement_id,stripe_subscription_id,stripe_invoice_id) VALUES('first-payment','breeze-client','ch_first','test',100,'eur','succeeded','2025-01-01T12:00:00.000Z',?,?,'sub_Summary','in_first')",at,service.id)]);
  const data=await snapshot(db,{});
  assert.equal(data.payments.length,1000);assert.equal(data.summary.received[0].amount,1001);
  assert.equal(data.client_billing[0].first_payment_at,"2025-01-01T12:00:00.000Z");db.raw.close();
});
