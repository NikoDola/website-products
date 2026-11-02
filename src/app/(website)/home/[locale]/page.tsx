import { notFound } from "next/navigation";
import HomePage from "@/website/HomePage";
import { homeMetadata } from "@/website/request";
import type { HomeSearch, HomeLocale } from "@/website/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
type Props = { params: Promise<{ locale: string }>; searchParams: HomeSearch };
function validLocale(value: string): HomeLocale {
  if (value !== "en" && value !== "mk") notFound();
  return value;
}
export async function generateMetadata({ params }: Props) {
  return homeMetadata(validLocale((await params).locale));
}
export default async function Page({ params, searchParams }: Props) {
  const [parameters, query] = await Promise.all([params, searchParams]);
  return <HomePage locale={validLocale(parameters.locale)} sent={query.sent === "1"} error={typeof query.error === "string" ? query.error : undefined} />;
}
