import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { PlatformError } from '../../shared/entities.mjs';

let cached;
const normalize = value => String(value).normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
export function loadTexasLocations() {
  if (cached) return cached;
  let data;
  try { data = JSON.parse(readFileSync(join(process.cwd(),'data','texas-locations.json'),'utf8')); }
  catch { throw new PlatformError('Texas directory is missing. Run python scripts/import-texas-locations.py from the project root.',503); }
  if (data.schema_version !== 1 || data.state_code !== 'TX' || !Array.isArray(data.locations) || !data.locations.length) throw new PlatformError('Texas location data is invalid. Re-import the GeoNames dataset.',503);
  cached = { ...data, locations:data.locations.map(row=>({...row, search:normalize(`${row.name} ${row.county} ${(row.aliases || []).join(' ')}`), normalized:normalize(row.name)})) };
  return cached;
}
export function searchTexas(query, data = loadTexasLocations()) {
  const needle = normalize(String(query || '').slice(0,150)), words = needle.split(' ');
  if (needle.length < 2) return [];
  return data.locations.filter(row=>words.every(word=>row.search.includes(word))).sort((a,b)=>{
    const score = row=>row.normalized === needle ? 3 : row.normalized.startsWith(needle) ? 2 : row.normalized.includes(needle) ? 1 : 0;
    return score(b)-score(a) || b.population-a.population || a.name.localeCompare(b.name) || a.county.localeCompare(b.county);
  }).slice(0,30).map(({search,normalized,aliases,...row})=>row);
}
export function listTexasLocations(data = loadTexasLocations()) {
  return data.locations.map(({ id, name, county }) => ({ id, name, county }))
    .sort((a,b) => a.name.localeCompare(b.name, 'en') || a.county.localeCompare(b.county, 'en'));
}
export function texasLocation(id, data = loadTexasLocations()) {
  const row=data.locations.find(row=>row.id===id);
  if(!row) throw new PlatformError('Choose a location from the Texas directory.',400);
  const {search,normalized,aliases,...location}=row;return location;
}
