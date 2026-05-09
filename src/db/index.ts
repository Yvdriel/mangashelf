import Database from "better-sqlite3";
import { drizzle, BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import * as schema from "./schema";
import path from "path";
import fs from "fs";

const DB_PATH = process.env.DATABASE_URL || "./data/mangashelf.db";

type SqliteClient = ReturnType<typeof Database>;

let _db: BetterSQLite3Database<typeof schema> | null = null;
let _sqlite: SqliteClient | null = null;

function getDb(): BetterSQLite3Database<typeof schema> {
  if (!_db) {
    const dbDir = path.dirname(DB_PATH);
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true });
    }

    const sqlite = new Database(DB_PATH);
    sqlite.pragma("journal_mode = WAL");
    sqlite.pragma("busy_timeout = 5000");
    sqlite.pragma("foreign_keys = ON");

    _sqlite = sqlite;
    _db = drizzle(sqlite, { schema });
  }
  return _db;
}

export const db = new Proxy({} as BetterSQLite3Database<typeof schema>, {
  get(_target, prop, receiver) {
    const instance = getDb();
    const value = Reflect.get(instance, prop, receiver);
    if (typeof value === "function") {
      return value.bind(instance);
    }
    return value;
  },
});

/** Underlying better-sqlite3 connection for raw SQL (FTS5, virtual tables). */
export function getSqliteClient(): SqliteClient {
  if (!_sqlite) getDb();
  return _sqlite!;
}
