"use client";
import { useEffect, useMemo, useState } from "react";
import { ArrowUpRight, MapPin, RefreshCw, Search } from "lucide-react";
import { outreachPost } from "./outreach-api";
type Row = Record<string, any>;
const normalize = (value: string) => value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

export default function LeadDirectory({ leads, busy, run, compose, discoveryEnabled }: { leads: Row[]; busy: boolean; run: (label: string, callback: () => Promise<void>) => void; compose: (row: Row) => void; discoveryEnabled: boolean }) {
  const [query, setQuery] = useState(""), [location, setLocation] = useState<Row | null>(null), [directoryInfo, setDirectoryInfo] = useState<Row | null>(null);
  const [loading, setLoading] = useState(true), [locationError, setLocationError] = useState(""), [reload, setReload] = useState(0);
  const [discovered, setDiscovered] = useState<Row | null>(null), [filter, setFilter] = useState("");
  useEffect(() => {
    const controller = new AbortController(); setLoading(true); setLocationError("");
    async function load() {
      try {
        const response = await fetch("/api/outreach/locations?all=1", { signal: controller.signal, cache: "no-store" }); const payload = await response.json();
        if (!response.ok) throw new Error(payload.error || "Texas locations could not load.");
        if (!controller.signal.aborted) setDirectoryInfo(payload);
      } catch (e) { if (!controller.signal.aborted) setLocationError((e as Error).message); }
      finally { if (!controller.signal.aborted) setLoading(false); }
    }
    void load(); return () => controller.abort();
  }, [reload]);
  const locations = useMemo(() => (directoryInfo?.locations || []).map((row: Row) => ({ ...row, search: normalize(`${row.name} ${row.county}`) })), [directoryInfo]);
  const matches = useMemo(() => {
    const words = normalize(query).split(" ").filter(Boolean);
    return words.length ? locations.filter((row: Row) => words.every(word => row.search.includes(word))) : locations;
  }, [locations, query]);
  async function discover() {
    if (!location) return;
    await run("Searching HVAC companies", async () => {
      const response = await fetch("/api/outreach/discovery", { method: "POST", headers: { "Content-Type": "application/json", "x-platform-request": "admin" }, body: JSON.stringify({ location_id: location.id }) });
      const payload = await response.json(); if (!response.ok) throw new Error(payload.error || "Business search failed."); setDiscovered(payload);
    });
  }
  function links(row: Row) { return <span className="outreach-links">{row.website && <a href={row.website} target="_blank" rel="noreferrer">Open website <ArrowUpRight size={13} /></a>}{row.instagram && <a href={row.instagram} target="_blank" rel="noreferrer">Instagram <ArrowUpRight size={13} /></a>}</span>; }
  const visible = leads.filter(row => `${row.name} ${row.email} ${row.location_name} ${row.county}`.toLowerCase().includes(filter.toLowerCase()));
  return <section className="panel"><div className="panel-heading"><div><h2>Texas locations</h2><p>Browse cities, towns, villages and communities, or search by name or county.</p></div><span className="badge">Texas only</span></div><div className="outreach-content">
    <div className="outreach-location-search">
      <label htmlFor="texas-location-search"><Search size={16} />Search locations</label>
      <div className="outreach-location-input"><input id="texas-location-search" type="search" placeholder="Search a location or county…" value={query} disabled={busy || loading} onChange={event => { setQuery(event.target.value); setLocation(null); setDiscovered(null); }} />{query && <button className="text-button" disabled={busy} onClick={() => setQuery("")}>Show all</button>}</div>
      <label className="outreach-location-label" htmlFor="texas-location"><MapPin size={16} />Select a location</label>
      <select id="texas-location" className="outreach-location-select" size={12} value={location?.id || ""} disabled={busy || loading || !matches.length} aria-describedby="texas-location-status" onChange={event => { setLocation(locations.find((row: Row) => row.id === event.target.value) || null); setDiscovered(null); }}>
        <option value="" disabled>{loading ? "Loading Texas locations…" : matches.length ? "Choose a location…" : "No matching locations"}</option>
        {matches.map((row: Row) => <option key={row.id} value={row.id}>{row.name} — {row.county}</option>)}
      </select>
      <p className="outreach-meta" id="texas-location-status" role="status">{loading ? "Loading Texas locations…" : locationError || `${matches.length.toLocaleString()} of ${locations.length.toLocaleString()} locations${location ? ` · Selected: ${location.name}, ${location.county}` : " · Scroll to browse or use your keyboard to select."}`}</p>
      {locationError && <button className="secondary" disabled={busy || loading} onClick={() => setReload(value => value + 1)}><RefreshCw size={14} />Retry loading locations</button>}
    </div>
    <div className="outreach-actions outreach-composer-actions"><button className="secondary" disabled={busy || !location || !discoveryEnabled} onClick={discover}><Search size={15} />Find HVAC companies</button>{location && <a className="text-button" target="_blank" rel="noreferrer" href={`https://www.google.com/search?q=${encodeURIComponent(`HVAC companies ${location.name} ${location.county} Texas`)}`}>Search the web manually <ArrowUpRight size={13} /></a>}</div>
    <p className="outreach-meta outreach-discovery-note">{discoveryEnabled ? "OpenStreetMap discovery searches within 20 km. Confirm each company's service area and contact details on its website. Public-directory coverage varies." : "Live business discovery is disabled. You can write directly to a recipient in the email composer below."}</p>
    <p className="outreach-meta">Locations: <a className="text-button" href="https://www.geonames.org/" target="_blank" rel="noreferrer">GeoNames · CC BY 4.0</a>{directoryInfo && ` · ${directoryInfo.count.toLocaleString()} places · updated ${new Date(directoryInfo.imported_at).toLocaleDateString("en-GB")}`}. County is the primary county recorded in the dataset. Coverage may be incomplete.</p>
    {discovered && <div className="outreach-discovered"><h3>Nearby HVAC listings for {discovered.location.name}</h3><p className="outreach-meta">{discovered.businesses.length} results{discovered.cached ? " · cached for up to 24 hours" : ""} · <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">© OpenStreetMap contributors · ODbL</a></p>
      {!discovered.businesses.length && <p className="outreach-meta">No tagged companies were found. Use the web search above to find a business to message.</p>}
      <div className="outreach-lead-list">{discovered.businesses.map((row: Row) => <article key={row.source_id}><div><strong>{row.name}</strong><p>{row.address}</p><p>{row.email || "Public email not listed"}</p>{links(row)}<a className="text-button" href={row.source_url} target="_blank" rel="noreferrer">Directory source <ArrowUpRight size={13} /></a></div><div className="outreach-actions"><button className="secondary" disabled={busy} onClick={() => compose(row)}>Compose email</button><button className="secondary" disabled={busy || leads.some(saved => saved.source_id === row.source_id && saved.source === "openstreetmap")} onClick={() => run("Saving lead", async () => { await outreachPost({ action: "lead.save", record: { ...row, location_id: discovered.location.id, location_name: discovered.location.name, county: discovered.location.county } }); })}>Save lead</button></div></article>)}</div>
    </div>}
    {leads.length > 0 && <div className="outreach-saved-leads"><h3>Saved potential leads ({leads.length})</h3><label className="outreach-lead-filter">Search saved leads<input type="search" value={filter} onChange={event => setFilter(event.target.value)} /></label>
      <div className="outreach-lead-list">{visible.map(row => <article key={row.id}><div><strong>{row.name}</strong><p>{row.email || "No public email recorded"}</p>{row.location_name && <p>{row.location_name} · {row.county}</p>}{links(row)}{row.notes && <p className="preserve-lines">{row.notes}</p>}{row.source === "openstreetmap" && <p className="outreach-meta">Source: OpenStreetMap contributors · ODbL</p>}</div><button className="secondary" disabled={busy} onClick={() => compose(row)}>Compose email</button></article>)}</div>
    </div>}
  </div></section>;
}
