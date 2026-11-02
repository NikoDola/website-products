import test from "node:test";
import assert from "node:assert/strict";
import { database } from "./helpers.mjs";
import { saveRecord, snapshot } from "../src/shared/platform.mjs";
import { logCommunication, communicationHistory, createClientFromCommunication } from "../src/shared/communications.mjs";
import { dispatch, exportTables } from "../src/shared/router.mjs";
import { importFresh } from "../src/shared/import.mjs";
import { businessDate } from "../src/shared/time.mjs";
async function person(db) {
  return (await saveRecord(db,"communications",{name:"Potential Owner",company:"Potential Business",email:"owner@example.com",next_action:"Ask for website feedback"},"owner")).id;
}
async function log(db,id,type,days,extra={}) {
  const current=await db.first("SELECT version FROM communications WHERE id=?",[id]);
  const payload={id:crypto.randomUUID(),expectedVersion:current.version,type,occurred_at:new Date(Date.now()-days*86400000).toISOString(),subject:"Website follow-up",...extra};
  return { payload,result:await logCommunication(db,id,payload,"owner") };
}
test("potential people need no client record; four emails, replies and notes produce correct last-contact dates",async()=>{
  const db=await database(),id=await person(db);
  for(const day of [8,6,4,2]) await log(db,id,"email-sent",day);
  await log(db,id,"email-received",1,{subject:"Client reply"});
  await log(db,id,"note",0,{subject:"Proposal context"});
  const history=await communicationHistory(db,id);
  assert.equal(history.person.client_id,null);assert.equal(history.person.stage,"potential");assert.equal(history.person.emails_sent,4);
  assert.equal(history.total,6);
  assert.ok(history.person.last_email_at<history.person.last_reply_at);
  assert.equal(history.person.last_contact_at,history.person.last_reply_at);
  // A later log of an older email must not move the last-email timestamp back.
  await log(db,id,"email-sent",12);
  assert.equal((await communicationHistory(db,id)).person.last_email_at,history.person.last_email_at);
  db.raw.close();
});
test("follow-ups are due in Skopje and a logged email can schedule the next reminder",async()=>{
  const db=await database(),id=await person(db),today=businessDate("Europe/Skopje");
  const current=await db.first("SELECT version FROM communications WHERE id=?",[id]);
  await saveRecord(db,"communications",{id,version:current.version,next_follow_up:today},"owner");
  assert.equal((await snapshot(db,{})).summary.followUpsDue,1);
  await log(db,id,"email-sent",0,{next_follow_up:"",next_action:"Wait for reply"});
  const after=await snapshot(db,{});
  assert.equal(after.summary.followUpsDue,0);assert.equal(after.communications[0].next_action,"Wait for reply");
  db.raw.close();
});
test("logging is idempotent, rejects future emails and cannot overwrite newer edits",async()=>{
  const db=await database(),id=await person(db);
  const {payload}=await log(db,id,"email-sent",1);
  assert.equal((await logCommunication(db,id,payload,"owner")).duplicate,true);
  assert.equal((await communicationHistory(db,id)).total,1);
  await assert.rejects(logCommunication(db,id,{...payload,id:crypto.randomUUID()},"owner"),/changed/);
  const version=(await db.first("SELECT version FROM communications WHERE id=?",[id])).version;
  await assert.rejects(logCommunication(db,id,{...payload,id:crypto.randomUUID(),expectedVersion:version,occurred_at:new Date(Date.now()+86400000).toISOString()},"owner"),/after it has been sent/);
  assert.equal((await communicationHistory(db,id)).total,1);db.raw.close();
});
test("conversion creates the client/contact once and keeps communication history and reminders",async()=>{
  const db=await database(),id=await person(db);await log(db,id,"email-sent",1,{next_follow_up:"2030-01-01"});
  const current=await communicationHistory(db,id);
  const result=await createClientFromCommunication(db,id,{expectedVersion:current.person.version},"owner");
  const again=await createClientFromCommunication(db,id,{expectedVersion:current.person.version},"owner");
  assert.equal(again.id,result.id);assert.equal(again.alreadyLinked,true);
  const after=await communicationHistory(db,id);
  assert.equal(after.person.client_id,result.id);assert.equal(after.person.stage,"ordered");assert.equal(after.total,1);assert.equal(after.person.next_follow_up,"2030-01-01");
  assert.equal((await db.first("SELECT name FROM clients WHERE id=?",[result.id])).name,"Potential Business");
  assert.equal((await db.all("SELECT * FROM contacts WHERE client_id=?",[result.id])).length,1);
  await log(db,id,"email-sent",0,{subject:"Project update after ordering"});
  assert.equal((await communicationHistory(db,id)).person.emails_sent,2);db.raw.close();
});
test("communication history and retired-module records survive business export/import",async()=>{
  const source=await database(),target=await database(),id=await person(source);await log(source,id,"email-sent",1);
  await source.run("INSERT INTO orders(id,title,created_at,updated_at) VALUES('old-order','Previous request',?,?)",[new Date().toISOString(),new Date().toISOString()]);
  const active=await snapshot(source,{});
  assert.equal(active.orders,undefined);assert.equal(active.calls,undefined);assert.equal(active.campaigns,undefined);
  const tables={};for(const table of exportTables)tables[table]=await source.all(`SELECT * FROM ${table}`);
  await importFresh(target,{schemaVersion:1,tables},"owner");
  assert.equal((await communicationHistory(target,id)).person.emails_sent,1);
  assert.equal((await target.first("SELECT title FROM orders WHERE id='old-order'")).title,"Previous request");
  const response=await dispatch(new Request(`https://api.example.com/api/communications/${id}`),target,{},"owner");
  assert.equal(response.status,200);assert.equal((await response.json()).total,1);
  source.raw.close();target.raw.close();
});
