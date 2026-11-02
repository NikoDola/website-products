import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
const script=fileURLToPath(new URL("../scripts/new-site.mjs",import.meta.url));
test("onboarding dry run validates names, ports and workspace boundaries without copying client data",()=>{
  const output=JSON.parse(execFileSync(process.execPath,[script,"--id","qa-client","--name","A Quoted \"Name\"","--dry-run"],{encoding:"utf8"}));
  assert.equal(output.name,'A Quoted "Name"');assert.equal(output.port,3002);assert.ok(output.folder.endsWith("qa-client-web"));
  assert.throws(()=>execFileSync(process.execPath,[script,"--id","../breeze-web","--dry-run"],{stdio:"pipe"}));
  assert.throws(()=>execFileSync(process.execPath,[script,"--id","breeze","--dry-run"],{stdio:"pipe"}));
  assert.throws(()=>execFileSync(process.execPath,[script,"--id","qa-client","--port","3001","--dry-run"],{stdio:"pipe"}));
});
