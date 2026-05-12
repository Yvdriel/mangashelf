import fs from "fs";
import path from "path";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";

export default async function globalSetup() {
  const root = path.resolve(__dirname, "..");

  const testDataDir = path.join(root, ".test-data");
  fs.rmSync(testDataDir, { recursive: true, force: true });
  const testMangaDir = path.join(testDataDir, "manga");
  fs.mkdirSync(testMangaDir, { recursive: true });

  // Copy persistent manga fixtures (e.g. Yotsuba&! v01 + .mokuro) into the
  // wiped test library so reader / OCR / Anki / progress flows have data on
  // every run. See tests/fixtures/README.md for the expected layout.
  const fixtureMangaDir = path.join(root, "tests", "fixtures", "manga");
  if (fs.existsSync(fixtureMangaDir)) {
    fs.cpSync(fixtureMangaDir, testMangaDir, {
      recursive: true,
      filter: (src) => path.basename(src) !== ".gitkeep",
    });
  }

  const authDir = path.join(root, "playwright", ".auth");
  fs.rmSync(authDir, { recursive: true, force: true });
  fs.mkdirSync(authDir, { recursive: true });

  const dbPath = path.join(testDataDir, "test.db");
  const sqlite = new Database(dbPath);
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");
  const db = drizzle(sqlite);
  migrate(db, { migrationsFolder: path.join(root, "drizzle") });
  sqlite.close();
}
