import { owner } from "@/admin/server/auth";
import Dashboard from "@/admin/components/Dashboard";
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export default async function Page() {
  try {
    const actor = await owner();
    return <Dashboard actor={actor.email} local={actor.local} />;
  } catch {
    return <main className="access-page"><div className="access-card"><div className="brand-mark">w<span>.</span></div><h1>Sign in to your workspace</h1><p>Use your protected admin domain and authorized account.</p><p className="muted">If this is your first setup, follow the setup guide in the main project folder.</p></div></main>;
  }
}
