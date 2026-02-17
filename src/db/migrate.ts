import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { db } from "./index";
import Database from "better-sqlite3";
import path from "path";
import fs from "fs";

const DB_PATH = process.env.DATABASE_URL || "./data/mangashelf.db";
const CURRENT_MIGRATION_HASH =
  "b362d58d9b8ab06eda43d76a8e56f82dbf2aa0ff84bd894114ff72ae8898cabe";

// Detect and reset stale databases from before the auth migration rewrite.
// If the DB has old migration records that don't match the current schema,
// drop everything so the fresh migration can run cleanly.
function resetIfStale() {
  if (!fs.existsSync(DB_PATH)) return;

  const sqlite = new Database(DB_PATH);
  try {
    const table = sqlite
      .prepare(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='__drizzle_migrations'",
      )
      .get() as { name: string } | undefined;
    if (!table) return; // fresh DB

    const rows = sqlite
      .prepare("SELECT hash FROM __drizzle_migrations")
      .all() as { hash: string }[];
    if (rows.length === 0) return; // empty migrations table

    const hasCurrentMigration = rows.some(
      (r) => r.hash === CURRENT_MIGRATION_HASH,
    );
    if (hasCurrentMigration) return; // already up to date

    console.log(
      "[MangaShelf] Detected stale database from pre-auth era, resetting...",
    );

    const tables = sqlite
      .prepare(
        "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'",
      )
      .all() as { name: string }[];

    sqlite.exec("PRAGMA foreign_keys = OFF");
    for (const { name } of tables) {
      sqlite.exec(`DROP TABLE IF EXISTS \`${name}\``);
    }
    sqlite.exec("PRAGMA foreign_keys = ON");

    console.log(
      "[MangaShelf] Database reset complete, will apply fresh migrations.",
    );
  } finally {
    sqlite.close();
  }
}

resetIfStale();
migrate(db, { migrationsFolder: "./drizzle" });
