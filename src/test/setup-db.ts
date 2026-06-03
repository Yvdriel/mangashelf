// Vitest setupFile: runs before each test file's imports. Points DATABASE_URL
// at a fresh per-file temp SQLite DB and applies migrations, so any module that
// later imports `@/db` (which captures DATABASE_URL at load time) opens a clean,
// migrated database. Tests seed it via helpers in `./db`.
import fs from "fs";
import os from "os";
import path from "path";
import { randomUUID } from "crypto";
import { afterAll, beforeEach } from "vitest";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";

const dbPath = path.join(
  os.tmpdir(),
  `mangashelf-test-${process.pid}-${randomUUID()}.db`,
);
process.env.DATABASE_URL = dbPath;

const sqlite = new Database(dbPath);
sqlite.pragma("journal_mode = WAL");
sqlite.pragma("foreign_keys = ON");
migrate(drizzle(sqlite), {
  migrationsFolder: path.resolve(__dirname, "../../drizzle"),
});
sqlite.close();

// Reset table state before each test. Dynamic import so `@/db` is loaded only
// after DATABASE_URL is set above (static imports would hoist before that).
beforeEach(async () => {
  const { resetDb } = await import("./db");
  resetDb();
});

// Best-effort cleanup of temp DB files after the run.
afterAll(() => {
  for (const suffix of ["", "-wal", "-shm"]) {
    fs.rmSync(dbPath + suffix, { force: true });
  }
});
