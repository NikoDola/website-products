import { redirect } from "next/navigation";

// Preserve the old dashboard entry point and its bookmarked tab selection.
export default async function Page({ searchParams }: { searchParams: Promise<{ view?: string | string[] }> }) {
  const { view } = await searchParams;
  redirect(`/admin${typeof view === "string" ? `?${new URLSearchParams({ view })}` : ""}`);
}
