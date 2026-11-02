import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
export function migrateLocal(raw, directory = resolve("workers/api/migrations")) {
  raw.exec("PRAGMA foreign_keys=ON; CREATE TABLE IF NOT EXISTS platform_migrations(name TEXT PRIMARY KEY, applied_at TEXT NOT NULL);");
  for (const filename of readdirSync(directory).filter(name => /^\d+_.+\.sql$/.test(name)).sort()) {
    if (raw.prepare("SELECT name FROM platform_migrations WHERE name=?").get(filename)) continue;
    raw.exec("BEGIN IMMEDIATE");
    try {
      // Recheck under the write lock when two processes start together.
      if (!raw.prepare("SELECT name FROM platform_migrations WHERE name=?").get(filename)) {
        raw.exec(readFileSync(resolve(directory, filename), "utf8"));
        raw.prepare("INSERT INTO platform_migrations(name,applied_at) VALUES(?,?)").run(filename, new Date().toISOString());
      }
      raw.exec("COMMIT");
    } catch (error) { raw.exec("ROLLBACK"); throw error; }
  }
}
