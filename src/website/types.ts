import { content } from "./content.mjs";
export type HomeLocale = "en" | "mk";
export type HomeCopy = typeof content.en;
export type HomeSearch = Promise<{ [key: string]: string | string[] | undefined }>;
