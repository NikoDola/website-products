import "server-only";
import { headers } from "next/headers";
import type { Metadata } from "next";
import { homeLocaleFromHeaders } from "../shared/home-locale.mjs";
import { content } from "./content.mjs";
import { site } from "./site.config.mjs";
import type { HomeLocale } from "./types";

export async function getHomeLocale(explicit?: HomeLocale): Promise<HomeLocale> {
  return homeLocaleFromHeaders(await headers(), explicit) as HomeLocale;
}

export async function homeMetadata(explicit?: HomeLocale): Promise<Metadata> {
  const locale = await getHomeLocale(explicit);
  const t = content[locale];
  const origin = process.env.HOME_PUBLIC_ORIGIN || site.url;
  return {
    title: `${t.title} | ${site.name}`,
    description: t.description,
    // Local Lighthouse checks use the public site's intended indexing policy.
    robots: { index: true, follow: true },
    icons: { icon: "/home/favicon.svg" },
    ...(origin ? { alternates: { canonical: `${origin}/home/${locale}`, languages: { en: `${origin}/home/en`, mk: `${origin}/home/mk`, "x-default": `${origin}/home` } } } : {}),
    openGraph: { title: t.title, description: t.description, siteName: site.name, type: "website", locale: locale === "mk" ? "mk_MK" : "en_US" },
  };
}
