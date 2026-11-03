import { PlatformError } from '../../shared/entities.mjs';
import { email, webUrl } from '../../shared/outreach.mjs';
import { texasLocation } from './texas-locations.mjs';

function safeUrl(value, instagram=false) {
  try { return webUrl(value && !/^https?:\/\//i.test(value) ? `https://${instagram && !value.includes('instagram.com') ? `www.instagram.com/${value.replace(/^@/,'')}` : value}` : value,instagram); }
  catch { return ''; }
}
export function businessFromOsm(item) {
  const tags=item.tags || {};let contact='';
  try { contact=email((tags['contact:email'] || tags.email || '').split(/[;,]/)[0]); } catch { /* No valid public email tagged. */ }
  return {name:String(tags.name || '').slice(0,300),website:safeUrl(tags['contact:website'] || tags.website || ''),email:contact,
    instagram:safeUrl(tags['contact:instagram'] || tags.instagram || '',true),source:'openstreetmap',source_id:`${item.type}/${item.id}`,
    source_url:`https://www.openstreetmap.org/${item.type}/${item.id}`,address:[tags['addr:housenumber'],tags['addr:street'],tags['addr:city']].filter(Boolean).join(' ')};
}
export async function discoverBusinesses(store, locationId, actor, {env=process.env,fetcher=fetch,locationData}={}) {
  if(env.OUTREACH_DISCOVERY_ENABLED !== 'true') throw new PlatformError('Live OpenStreetMap discovery is disabled. Enable OUTREACH_DISCOVERY_ENABLED after reviewing docs/OUTREACH.md. No paid API is enabled.',503);
  const location=texasLocation(locationId,locationData),cached=store.one('SELECT * FROM discovery_cache WHERE location_id=?',location.id);
  if(cached && cached.expires_at>Date.now()) return {...JSON.parse(cached.data),cached:true};
  // Persist a request reservation before calling the public service, across tabs/processes.
  store.transaction(()=>{
    const recent=store.one("SELECT at FROM api_usage WHERE method='overpass.search' ORDER BY id DESC LIMIT 1");
    if(recent && Date.now()-Date.parse(recent.at)<15000)throw new PlatformError('Wait 15 seconds between live business searches.',429);
    const today=store.one("SELECT COUNT(*) AS n FROM api_usage WHERE method='overpass.search' AND at>?",new Date(Date.now()-86400000).toISOString()).n;
    if(today>=100)throw new PlatformError('Discovery limit reached: 100 live searches per 24 hours.',429);
    store.run('INSERT INTO api_usage(account_id,method,units,at) VALUES(NULL,?,?,?)','overpass.search',0,store.now());
  });
  const point=`around:20000,${Number(location.latitude)},${Number(location.longitude)}`;
  const query=`[out:json][timeout:25];area["ISO3166-2"="US-TX"]["admin_level"="4"]->.tx;(nwr(area.tx)(${point})["craft"~"^(hvac|heating_engineer|air_conditioning|ventilation)$"];nwr(area.tx)(${point})["name"~"HVAC|heating|air conditioning|cooling",i];);out center tags 60;`;
  let response,payload;
  try {
    response=await fetcher('https://overpass-api.de/api/interpreter',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded','User-Agent':'WebsiteProducts-ManualDiscovery/1.0'},body:new URLSearchParams({data:query}),signal:AbortSignal.timeout(35000),redirect:'error'});
    if(!response.ok)throw Error();
    const raw=await response.text();if(raw.length>2000000)throw Error();payload=JSON.parse(raw);
    if(payload.remark || !Array.isArray(payload.elements))throw Error();
  } catch { throw new PlatformError('The public business directory is unavailable or rate-limited. Try later or add the company manually.',503); }
  const businesses=payload.elements.filter(item=>['node','way','relation'].includes(item.type) && Number.isSafeInteger(item.id) && item.tags?.name).map(businessFromOsm);
  const result={location,businesses,source:'OpenStreetMap contributors',source_url:'https://www.openstreetmap.org/copyright',license:'ODbL',radius_km:20,at:store.now(),cached:false};
  store.run('INSERT INTO discovery_cache VALUES(?,?,?) ON CONFLICT(location_id) DO UPDATE SET data=excluded.data,expires_at=excluded.expires_at',location.id,JSON.stringify(result),Date.now()+86400000);
  store.audit(actor,'business.search',location.id,{results:businesses.length});return result;
}
