import HomePage from "@/website/HomePage";
import { getHomeLocale, homeMetadata } from "@/website/request";
import type { HomeSearch } from "@/website/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const generateMetadata = () => homeMetadata();

export default async function Page({ searchParams }: { searchParams: HomeSearch }) {
  const [locale, query] = await Promise.all([getHomeLocale(), searchParams]);
  return <HomePage locale={locale} sent={query.sent === "1"} error={typeof query.error === "string" ? query.error : undefined} />;
}
