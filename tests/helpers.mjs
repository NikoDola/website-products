import { DatabaseSync } from "node:sqlite";
import { fileURLToPath } from "node:url";
import { sqliteAdapter } from "../src/admin/server/local.mjs";
import { seed } from "../src/shared/platform.mjs";
import { migrateLocal } from "../src/admin/server/migrations.mjs";
export async function database() {
  const raw = new DatabaseSync(":memory:");
  migrateLocal(raw, fileURLToPath(new URL("../workers/api/migrations", import.meta.url)));
  const db = sqliteAdapter(raw); await seed(db); return db;
}
