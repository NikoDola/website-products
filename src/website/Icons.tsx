export function Arrow() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><path d="M5 19 19 5M5 5h14v14" /></svg>;
}
export function Pin() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><path d="M19 10c0 5-7 11-7 11S5 15 5 10a7 7 0 1 1 14 0Z" /><circle cx="12" cy="10" r="2.5" /></svg>;
}
export function ServiceIcon({ icon }: { icon: string }) {
  return <svg className="service-icon" viewBox="0 0 30 30" fill="none" stroke="currentColor" strokeWidth="1.3" aria-hidden="true">
    {icon === "brand" ? <><rect x="4" y="4" width="12" height="12" rx="1" /><circle cx="17" cy="17" r="7" /><path d="M10 16h6v-6" /></> : icon === "web" ? <><rect x="2" y="4" width="25" height="21" rx="2" /><path d="M2 10h25M7 7h.01M11 7h.01m0 8-4 3 4 3m7-6 4 3-4 3" /></> : <><path d="m15 2 10 4v8c0 6-10 13-10 13S5 20 5 14V6l10-4Z" /><path d="m10 14 3 3 7-7" /></>}
  </svg>;
}
