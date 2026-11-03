import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { listTexasLocations, loadTexasLocations, searchTexas, texasLocation } from '../src/admin/server/texas-locations.mjs';
import { businessFromOsm, discoverBusinesses } from '../src/admin/server/outreach-discovery.mjs';
import { openOutreach } from '../src/admin/server/outreach-store.mjs';
const places={locations:[{id:'one',name:'Austin',county:'Travis County',population:900000,normalized:'austin',search:'austin travis county',latitude:30.2672,longitude:-97.7431},{id:'two',name:'Austin Springs',county:'Other County',population:50,normalized:'austin springs',search:'austin springs other county',latitude:30,longitude:-98}]};
test('bundled Texas data covers all counties and includes cities, a CDP, a village and small communities',()=>{
  const data=loadTexasLocations();assert.equal(data.state_code,'TX');assert.ok(data.locations.length>1500);assert.equal(new Set(data.locations.map(row=>row.county)).size,254);
  for(const [name,county] of [['Austin','Travis County'],['The Woodlands','Montgomery County'],['Salado','Bell County'],['Luckenbach','Gillespie County'],['Terlingua','Brewster County']]) {
    const match=searchTexas(name,data).find(row=>row.name===name);assert.ok(match,`${name} must be present`);assert.equal(match.county,county);
  }
  assert.equal(new Set(data.locations.map(row=>row.id)).size,data.locations.length);
  assert.ok(data.locations.every(row=>row.latitude>25 && row.latitude<37 && row.longitude>-107 && row.longitude<-93));
});
test('Texas autocomplete matches names and counties and ranks exact places first',()=>{
  assert.equal(searchTexas('Austin',places)[0].id,'one');assert.equal(searchTexas('travis',places)[0].county,'Travis County');assert.equal(searchTexas('a',places).length,0);
  assert.equal(searchTexas('Austin Other',places)[0].id,'two');assert.equal(texasLocation('one',places).latitude,30.2672);assert.throws(()=>texasLocation('arbitrary',places));
});
test('browse directory includes every Texas location in name/county order without the search result cap',()=>{
  const data=loadTexasLocations(),rows=listTexasLocations(data);
  assert.equal(rows.length,data.locations.length);assert.ok(rows.length>30);
  assert.equal(new Set(rows.map(row=>row.id)).size,data.locations.length);
  assert.ok(rows.every(row=>Object.keys(row).sort().join(',')==='county,id,name'));
  for(let i=1;i<rows.length;i++) {
    const previous=rows[i-1],current=rows[i];
    assert.ok((previous.name.localeCompare(current.name,'en') || previous.county.localeCompare(current.county,'en'))<=0);
  }
});
test('OSM public contact fields are validated, unsafe URLs rejected, Instagram handles supported',()=>{
  const result=businessFromOsm({type:'node',id:1,tags:{name:'Heating Company',website:'javascript:alert(1)','contact:email':'info@example.com','contact:instagram':'@hvac'}});
  assert.equal(result.email,'info@example.com');assert.equal(result.website,'');assert.equal(result.instagram,'https://www.instagram.com/hvac');
  assert.equal(businessFromOsm({type:'node',id:2,tags:{name:'Company',website:'example.com'}}).website,'https://example.com/');
});
test('discovery is opt-in, uses server-known coordinates, caches and rate limits across requests',async t=>{
  const dir=await mkdtemp(join(tmpdir(),'discovery-')),store=openOutreach(join(dir,'outreach.sqlite'),{NODE_ENV:'test'});
  t.after(async()=>{store.close();await rm(dir,{recursive:true,force:true});});let calls=0;
  const fetcher=async(url,options)=>{calls++;assert.equal(url,'https://overpass-api.de/api/interpreter');assert.match(String(options.body),/30.2672/);return new Response(JSON.stringify({elements:[{type:'node',id:7,tags:{name:'HVAC','contact:email':'hello@example.com'}}]}));};
  await assert.rejects(discoverBusinesses(store,'one','owner',{env:{},fetcher,locationData:places}),/disabled/);assert.equal(calls,0);
  const config={env:{OUTREACH_DISCOVERY_ENABLED:'true'},fetcher,locationData:places};
  const first=await discoverBusinesses(store,'one','owner',config);assert.equal(first.businesses[0].name,'HVAC');
  const cached=await discoverBusinesses(store,'one','owner',config);assert.equal(cached.cached,true);assert.equal(calls,1);
  await assert.rejects(discoverBusinesses(store,'two','owner',config),/15 seconds/);
  await assert.rejects(discoverBusinesses(store,'injected;query','owner',config),/Choose a location/);
});
