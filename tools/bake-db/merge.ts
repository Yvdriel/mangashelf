// Merge step — fold d02 tables into d01, build the one cross-dependent table
// (kanji_word, needs both terms + frequency), compact via VACUUM INTO dict.db.
// Operates on d01.db in place (it's a reproducible intermediate) then emits a
// fresh compacted OUT. kanji_word is built ONLY from non-name terms (JMnedict
// proper-names rarely form meaningful compounds and would bloat the table).
//   node --experimental-strip-types tools/bake-db/merge.ts            → out/dict.db
//   OUT=out/dict-trim.db D01=out/d01-trim.db node … merge.ts          → trimmed variant
import { existsSync, rmSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { openBakeDb } from "./lib/open-db.ts";

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(HERE, "out");
const D01 = process.env.D01 ?? join(OUT_DIR, "d01.db");
const D02 = join(OUT_DIR, "d02.db");
const OUT = process.env.OUT ?? join(OUT_DIR, "dict.db");
const CAP = 30; // max compounds stored per kanji

const isCjk = (cp: number) =>
  (cp >= 0x4e00 && cp <= 0x9fff) || (cp >= 0x3400 && cp <= 0x4dbf);

// SQLite string-literal escape for embedding a filesystem path (a path may
// legitimately contain a single quote). Paths here are dev-set, not user input.
const sql = (p: string) => p.replace(/'/g, "''");

function main() {
  if (!existsSync(D01)) throw new Error(`missing ${D01} (run bake-d01 first)`);
  if (!existsSync(D02)) throw new Error(`missing ${D02} (run bake-d02 first)`);
  const db = openBakeDb(D01, false); // schema already present

  console.log("attaching d02, folding custom tables…");
  db.exec(`ATTACH '${sql(D02)}' AS d02`);
  const fold = db.transaction(() => {
    db.exec(`INSERT INTO main.kanji_radical(character,radical) SELECT character,radical FROM d02.kanji_radical`);
    db.exec(`INSERT OR REPLACE INTO main.radical(radical,strokes) SELECT radical,strokes FROM d02.radical`);
    db.exec(`INSERT INTO main.sentence(id,jp,en) SELECT id,jp,en FROM d02.sentence`);
    db.exec(`INSERT INTO main.sentence_word(sentence_id,headword,reading,sense,surface) SELECT sentence_id,headword,reading,sense,surface FROM d02.sentence_word`);
    db.exec(`INSERT INTO main.furigana(expression,reading,segments) SELECT expression,reading,segments FROM d02.furigana`);
  });
  fold();
  db.exec(`DETACH d02`);

  // re-create d02 indexes in the merged db (they live in d02.db only)
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_krad_char ON kanji_radical(character);
    CREATE INDEX IF NOT EXISTS idx_krad_rad ON kanji_radical(radical);
    CREATE INDEX IF NOT EXISTS idx_sw_head ON sentence_word(headword);
    CREATE INDEX IF NOT EXISTS idx_furi ON furigana(expression, reading);
  `);

  console.log("building kanji_word (non-name terms, freq-ranked, cap %d)…", CAP);
  // valid kanji set (only build compounds for kanji we have pages for)
  const kanjiSet = new Set(
    (db.prepare(`SELECT character FROM kanji`).all() as { character: string }[]).map((r) => r.character),
  );
  // best (lowest) frequency rank per expression
  const freqMap = new Map<string, number>();
  for (const r of db.prepare(`SELECT expression, MIN(rank) AS r FROM frequency WHERE rank IS NOT NULL GROUP BY expression`).iterate() as Iterable<{ expression: string; r: number }>) {
    freqMap.set(r.expression, r.r);
  }
  // exclude the proper-name dictionary (kind='terms' priority>=100)
  const nameDicts = new Set(
    (db.prepare(`SELECT id FROM dictionaries WHERE kind='terms' AND priority>=100`).all() as { id: string }[]).map((r) => r.id),
  );
  const buckets = new Map<string, { id: number; rank: number }[]>();
  const INF = Number.MAX_SAFE_INTEGER;
  for (const t of db.prepare(`SELECT id, expression, dict FROM terms`).iterate() as Iterable<{ id: number; expression: string; dict: string }>) {
    if (nameDicts.has(t.dict)) continue;
    const rank = freqMap.get(t.expression) ?? INF;
    const seen = new Set<string>();
    for (const ch of t.expression) {
      if (seen.has(ch)) continue;
      seen.add(ch);
      if (!kanjiSet.has(ch) || !isCjk(ch.codePointAt(0)!)) continue;
      let arr = buckets.get(ch);
      if (!arr) buckets.set(ch, (arr = []));
      arr.push({ id: t.id, rank });
    }
  }
  const insKW = db.prepare(`INSERT INTO kanji_word(character, term_id, rank) VALUES(?,?,?)`);
  let kwRows = 0;
  const writeKW = db.transaction(() => {
    for (const [ch, arr] of buckets) {
      arr.sort((a, b) => a.rank - b.rank);
      for (const e of arr.slice(0, CAP)) { insKW.run(ch, e.id, e.rank === INF ? null : e.rank); kwRows++; }
    }
  });
  writeKW();
  db.exec(`CREATE INDEX IF NOT EXISTS idx_kw_char ON kanji_word(character)`);
  console.log(`  kanji_word +${kwRows} over ${buckets.size} kanji`);

  db.pragma("wal_checkpoint(TRUNCATE)");
  console.log("VACUUM INTO", OUT, "…");
  if (existsSync(OUT)) rmSync(OUT);
  db.exec(`VACUUM INTO '${sql(OUT)}'`);
  db.close();

  console.log(`dict.db = ${(statSync(OUT).size / 1048576).toFixed(1)} MB`);
}

main();
