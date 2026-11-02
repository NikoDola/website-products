import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { seed } from "../../shared/platform.mjs";
import { migrateLocal } from "./migrations.mjs";
import { privateDataPath } from "../../shared/server/paths.mjs";
export function platformDatabasePath(env = process.env) {
  return privateDataPath("platform.sqlite", env.PLATFORM_DB_PATH);
}
export function sqliteAdapter(raw) {
  const prepared = (sql, args = []) => raw.prepare(sql);
  return {
    raw,
    async all(sql, args = []) { return prepared(sql).all(...args); },
    async first(sql, args = []) { return prepared(sql).get(...args) || null; },
    async run(sql, args = []) { const result = prepared(sql).run(...args); return { changes: Number(result.changes) }; },
    async batch(statements) {
      raw.exec("BEGIN IMMEDIATE");
      try { for (const { sql, args = [] } of statements) raw.prepare(sql).run(...args); raw.exec("COMMIT"); }
      catch (error) { raw.exec("ROLLBACK"); throw error; }
    }
  };
}
export async function localDatabase() {
  if (process.env.VERCEL) throw new Error("Hosted deployments require PLATFORM_API_URL. Local disk is not persistent on Vercel.");
  const filename = platformDatabasePath();
  globalThis.__agencyStores ||= new Map();
  if (!globalThis.__agencyStores.has(filename)) {
    const pending = (async () => {
      mkdirSync(dirname(filename), { recursive: true });
      const raw = new DatabaseSync(filename);
      raw.exec("PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;");
      migrateLocal(raw);
      const db = sqliteAdapter(raw); await seed(db); return db;
    })();
    globalThis.__agencyStores.set(filename, pending);
  }
  const db = await globalThis.__agencyStores.get(filename);
  // Next dev can retain the connection while a new migration is added.
  migrateLocal(db.raw);
  return db;
}
