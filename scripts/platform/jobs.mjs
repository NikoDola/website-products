import { localDatabase } from "../../src/admin/server/local.mjs";
import { runMonitoring } from "../../src/shared/monitor.mjs";
import { syncStripe } from "../../src/shared/stripe.mjs";
const job = process.argv[2];
if (!["monitor", "stripe"].includes(job)) throw new Error("Choose monitor or stripe.");
if (process.env.PLATFORM_API_URL) {
  if (!process.env.PLATFORM_API_TOKEN || process.env.PLATFORM_API_TOKEN.length < 32) throw new Error("Set PLATFORM_API_TOKEN.");
  const origin = new URL(process.env.PLATFORM_API_URL);
  if (origin.origin !== process.env.PLATFORM_API_URL || origin.protocol !== "https:") throw new Error("Use an HTTPS platform origin.");
  const result = await fetch(`${origin}/api/jobs/${job}`, { method: "POST", headers: { Authorization: `Bearer ${process.env.PLATFORM_API_TOKEN}`, "Content-Type": "application/json", "x-platform-actor": "owner-cli" }, body: "{}" });
  if (!result.ok) throw new Error(`Job failed with HTTP ${result.status}.`);
  console.log(await result.json());
} else {
  const db = await localDatabase();
  console.log(await (job === "monitor" ? runMonitoring : syncStripe)(db, process.env));
}
