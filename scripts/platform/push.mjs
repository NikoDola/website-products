import { readFile } from "node:fs/promises";
const input = process.argv[2];
if (!input) throw new Error("Usage: npm run db:push -- <export.json>");
const url = new URL(process.env.PLATFORM_API_URL || "");
if (url.origin !== process.env.PLATFORM_API_URL || url.protocol !== "https:" || !process.env.PLATFORM_API_TOKEN || process.env.PLATFORM_API_TOKEN.length < 32) throw new Error("Set PLATFORM_API_URL and PLATFORM_API_TOKEN for your fresh cloud backend.");
const response = await fetch(`${url.origin}/api/import`, { method: "POST", headers: { Authorization: `Bearer ${process.env.PLATFORM_API_TOKEN}`, "Content-Type": "application/json", "x-platform-actor": "owner-migration" }, body: await readFile(input, "utf8"), redirect: "error" });
const result = await response.json(); if (!response.ok) throw new Error(result.error || `HTTP ${response.status}`);
console.log(result);
