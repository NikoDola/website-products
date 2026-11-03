import WorkspacePage from "@/admin/components/WorkspacePage";
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export default async function Page() {
  return <WorkspacePage />;
}
