// Open a better-sqlite3 DB tuned for a one-shot bulk bake. synchronous=OFF is safe:
// the bake is fully reproducible from sources — on a crash we just re-run.
import Database from "better-sqlite3";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
export const SCHEMA_PATH = join(HERE, "..", "schema.sql");

export function openBakeDb(path: string, applySchema = true): Database.Database {
  const db = new Database(path);
  db.pragma("journal_mode = WAL");
  db.pragma("synchronous = OFF");
  db.pragma("temp_store = MEMORY");
  db.pragma("cache_size = -200000"); // ~200 MB page cache
  db.pragma("page_size = 4096");
  db.pragma("foreign_keys = OFF");
  if (applySchema) db.exec(readFileSync(SCHEMA_PATH, "utf-8"));
  return db;
}
