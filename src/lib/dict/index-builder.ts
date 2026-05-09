import fs from "fs";
import path from "path";
import { eq } from "drizzle-orm";
import { loadDictionary } from "@scriptin/jmdict-simplified-loader";
import type { JMdictWord } from "@scriptin/jmdict-simplified-types";
import { db, getSqliteClient } from "@/db";
import { dictMeta } from "@/db/schema";

const DICT_SOURCE = "jmdict-eng-common";

function resolveDictPaths(): { jsonPath: string | null; version: string } {
  const dictDir =
    process.env.DICT_DIR ||
    path.join(process.cwd(), "var", "dict");
  const jsonPath = path.join(dictDir, "jmdict-eng-common.json");
  let version = "unknown";
  const versionFile = path.join(dictDir, "VERSION");
  if (fs.existsSync(versionFile)) {
    version = fs.readFileSync(versionFile, "utf8").trim() || "unknown";
  }
  if (!fs.existsSync(jsonPath)) {
    return { jsonPath: null, version };
  }
  return { jsonPath, version };
}

type SqliteClient = ReturnType<typeof getSqliteClient>;

function ensureSchema(sqlite: SqliteClient) {
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS dict_term (
      id INTEGER PRIMARY KEY,
      headword TEXT NOT NULL,
      reading TEXT NOT NULL,
      common INTEGER NOT NULL,
      pos TEXT NOT NULL,
      glosses TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS dict_term_headword_idx ON dict_term(headword);
    CREATE INDEX IF NOT EXISTS dict_term_reading_idx ON dict_term(reading);
    CREATE VIRTUAL TABLE IF NOT EXISTS dict_term_fts USING fts5(
      headword,
      reading,
      content='dict_term',
      content_rowid='id'
    );
  `);
}

function flattenEntry(word: JMdictWord): {
  headword: string;
  reading: string;
  common: number;
  pos: string;
  glosses: string;
}[] {
  const englishSenses = word.sense.filter((s) =>
    s.gloss.some((g) => g.lang === "eng" || !g.lang),
  );
  if (englishSenses.length === 0) return [];

  const glossList = englishSenses.map((s) =>
    s.gloss
      .filter((g) => g.lang === "eng" || !g.lang)
      .map((g) => g.text)
      .join("; "),
  );
  const glosses = JSON.stringify(glossList);

  const posSet = new Set<string>();
  for (const s of englishSenses) {
    for (const p of s.partOfSpeech) posSet.add(p);
  }
  const pos = [...posSet].join(",");

  const primaryKana =
    word.kana.find((k) => k.common)?.text ||
    word.kana[0]?.text ||
    "";

  const rows: ReturnType<typeof flattenEntry> = [];
  if (word.kanji.length > 0) {
    for (const k of word.kanji) {
      rows.push({
        headword: k.text,
        reading: primaryKana,
        common: k.common ? 1 : 0,
        pos,
        glosses,
      });
    }
  }
  for (const k of word.kana) {
    rows.push({
      headword: k.text,
      reading: k.text,
      common: k.common ? 1 : 0,
      pos,
      glosses,
    });
  }
  return rows;
}

/**
 * Build the JMdict-backed lookup tables when the bundled file is present and
 * the version on disk differs from the indexed version. Idempotent across
 * boots; safe to call from instrumentation.
 */
export async function ensureDictIndex(): Promise<void> {
  const { jsonPath, version } = resolveDictPaths();
  if (!jsonPath) {
    console.log(
      "[MangaShelf] Dictionary skipped: no jmdict-eng-common.json found (set DICT_DIR or run scripts/fetch-dict.sh)",
    );
    return;
  }

  const sqlite = getSqliteClient();
  ensureSchema(sqlite);

  const existing = await db
    .select()
    .from(dictMeta)
    .where(eq(dictMeta.source, DICT_SOURCE))
    .get();

  // Defensive: a stale `dict_meta` row could survive a failed/partial build.
  // Rebuild if the term table is empty even when the version matches.
  const rowCount =
    (sqlite
      .prepare("SELECT COUNT(*) AS n FROM dict_term")
      .get() as { n: number } | undefined)?.n ?? 0;

  if (existing && existing.version === version && rowCount > 0) {
    return;
  }

  console.log(
    `[MangaShelf] Building dictionary index from ${jsonPath} (version ${version})…`,
  );
  const start = Date.now();

  sqlite.exec(`
    DELETE FROM dict_term_fts;
    DELETE FROM dict_term;
  `);

  const insert = sqlite.prepare(
    "INSERT INTO dict_term (headword, reading, common, pos, glosses) VALUES (?, ?, ?, ?, ?)",
  );
  const beginTx = sqlite.prepare("BEGIN");
  const commitTx = sqlite.prepare("COMMIT");
  const rollbackTx = sqlite.prepare("ROLLBACK");

  let entryCount = 0;
  beginTx.run();
  try {
    await new Promise<void>((resolve, reject) => {
      loadDictionary("jmdict", jsonPath)
        .onEntry((word: JMdictWord) => {
          for (const row of flattenEntry(word)) {
            insert.run(
              row.headword,
              row.reading,
              row.common,
              row.pos,
              row.glosses,
            );
            entryCount++;
          }
        })
        .onEnd(() => resolve());
      // The loader emits errors on its underlying parser; surface via reject.
      // (No public error hook in 3.6.x — failures end the stream.)
      const parser = (loadDictionary as unknown as { parser?: unknown }).parser;
      if (parser && typeof parser === "object" && "on" in parser) {
        (parser as { on: (e: string, cb: (err: Error) => void) => void }).on(
          "error",
          reject,
        );
      }
    });
    sqlite.exec("INSERT INTO dict_term_fts(dict_term_fts) VALUES('rebuild')");
    commitTx.run();
  } catch (err) {
    try {
      rollbackTx.run();
    } catch {
      // ignore
    }
    throw err;
  }

  await db
    .insert(dictMeta)
    .values({
      source: DICT_SOURCE,
      version,
      entryCount,
      builtAt: new Date(),
    })
    .onConflictDoUpdate({
      target: dictMeta.source,
      set: {
        version,
        entryCount,
        builtAt: new Date(),
      },
    });

  const seconds = ((Date.now() - start) / 1000).toFixed(1);
  console.log(
    `[MangaShelf] Dictionary index built (${DICT_SOURCE} ${version}, ${entryCount} rows in ${seconds}s)`,
  );
}
