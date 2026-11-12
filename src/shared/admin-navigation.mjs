export function adminSelection(pathname, search = "") {
  if (/^\/admin\/marketing(?:\/|$)/.test(pathname)) return { tab: "marketing", marketing: pathname.replace(/\/$/, "").endsWith("/referral-program") ? "referrals" : pathname.replace(/\/$/, "").endsWith("/new-clients") ? "new" : "current" };
  return { tab: new URLSearchParams(search).get("view") || "overview", marketing: "current" };
}
export function adminUrl(tab, marketing = "current") {
  return tab === "marketing" ? `/admin/marketing/${marketing === "referrals" ? "referral-program" : marketing === "new" ? "new-clients" : "current-clients"}` : `/admin?view=${encodeURIComponent(tab)}`;
}
