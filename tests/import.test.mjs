import test from "node:test";
import assert from "node:assert/strict";
import { database } from "./helpers.mjs";
import { exportTables } from "../src/shared/router.mjs";
import { importFresh } from "../src/shared/import.mjs";
import { saveRecord } from "../src/shared/platform.mjs";
test("fresh cloud import preserves records atomically and refuses overwrite or unknown columns",async()=>{
  const source=await database(),target=await database(),tables={};
  await saveRecord(source,"tasks",{title:"Preserved task",client_id:"breeze-client"},"owner");
  for(const table of exportTables)tables[table]=await source.all(`SELECT * FROM ${table}`);
  await importFresh(target,{schemaVersion:1,tables},"owner-migration");
  assert.equal((await target.first("SELECT title FROM tasks")).title,"Preserved task");
  await assert.rejects(importFresh(target,{schemaVersion:1,tables},"owner-migration"),/fresh/);
  const clean=await database(),bad=structuredClone(tables);bad.clients[0].password="secret";
  await assert.rejects(importFresh(clean,{schemaVersion:1,tables:bad},"owner"),/Unknown/);
  assert.equal((await clean.all("SELECT * FROM tasks")).length,0);
  source.raw.close();target.raw.close();clean.raw.close();
});
