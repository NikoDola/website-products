import { localDatabase } from "../../src/admin/server/local.mjs";
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
if (process.env.PLATFORM_API_URL) throw new Error("For D1, use the export command in docs/SETUP.md. This command backs up local SQLite only.");
const directory = resolve("backups"); mkdirSync(directory, { recursive: true });
const filename = resolve(directory, `platform-${new Date().toISOString().replaceAll(":", "-")}.sqlite`);
const db = await localDatabase();
db.raw.prepare("VACUUM INTO ?").run(filename);
console.log(`Consistent database backup saved: ${filename}`);
