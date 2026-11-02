import { readFileSync, mkdirSync, existsSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { resolve, dirname } from "node:path";
import { exportTables } from "../../src/shared/router.mjs";
import { migrateLocal } from "../../src/admin/server/migrations.mjs";
const [inputFile, outputFile] = process.argv.slice(2);
if (!inputFile || !outputFile) throw new Error("Usage: npm run db:import -- <export.json> <NEW-output.sqlite>");
const target = resolve(outputFile);
if (existsSync(target)) throw new Error("Restore requires a new filename; existing databases are never overwritten.");
const data = JSON.parse(readFileSync(resolve(inputFile), "utf8"));
if (data.schemaVersion !== 1 || !data.tables || Object.keys(data.tables).some(table => !exportTables.includes(table))) throw new Error("Unsupported export.");
mkdirSync(dirname(target), { recursive: true });
const db = new DatabaseSync(target); migrateLocal(db);
db.exec("PRAGMA foreign_keys=ON; BEGIN IMMEDIATE;");
try {
  for (const table of exportTables) for (const row of data.tables[table] || []) {
    const known = new Set(db.prepare(`PRAGMA table_info(${table})`).all().map(column => column.name));
    const columns = Object.keys(row);
    if (columns.some(key => !known.has(key))) throw new Error(`Unknown column in ${table}.`);
    db.prepare(`INSERT INTO ${table}(${columns.join(",")}) VALUES(${columns.map(() => "?").join(",")})`).run(...Object.values(row));
  }
  db.exec("COMMIT");
} catch (error) { db.exec("ROLLBACK"); db.close(); throw error; }
const result = db.prepare("PRAGMA integrity_check").get(); db.close();
console.log(`Restored into ${target}. Integrity: ${Object.values(result)[0]}. Set PLATFORM_DB_PATH to this file to open it.`);
