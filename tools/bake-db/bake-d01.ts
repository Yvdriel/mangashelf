// D0.1 — Yomitan term/kanji/freq banks → out/d01.db (terms, kanji, frequency, gloss_fts).
// Calls the UNCHANGED src parser (parseBank/parseIndex). Runs in parallel with D0.2.
//   node --experimental-strip-types tools/bake-db/bake-d01.ts
import { existsSync, rmSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { openBakeDb } from "./lib/open-db.ts";
import { iterBankEntries, readIndexBytes } from "./lib/yomitan-zip.ts";
import { flattenGloss } from "./lib/gloss-text.ts";
import { parseBank, parseIndex } from "../../src/lib/dict/install/parse-bank.ts";

const HERE = dirname(fileURLToPath(import.meta.url));
const DATA = join(HERE, "..", "dict-data");
const OUT = join(HERE, "out");
const DB_PATH = process.env.OUT_DB ?? join(OUT, "d01.db");
// trim variant: EXCLUDE=JMnedict.zip skips proper-name banks (the biggest contributor).
const EXCLUDE = new Set((process.env.EXCLUDE ?? "").split(",").map((s) => s.trim()).filter(Boolean));

// dict-id is the index.json title; priority orders results (lower = higher).
interface Source { file: string; priority: number; kind: "terms" | "kanji" | "frequency" }
const SOURCES: Source[] = [
  { file: "jitendex-yomitan.zip", priority: 0, kind: "terms" },
  { file: "JMnedict.zip", priority: 100, kind: "terms" }, // proper names — low priority
  { file: "KANJIDIC_english.zip", priority: 0, kind: "kanji" },
  { file: "JPDB_v2.2_freq.zip", priority: 10, kind: "frequency" },
  { file: "BCCWJ_freq.zip", priority: 20, kind: "frequency" },
  { file: "innocent_corpus.zip", priority: 30, kind: "frequency" },
  { file: "aozora_freq.zip", priority: 40, kind: "frequency" },
];

function intRank(rank: number): number | null {
  return Number.isFinite(rank) ? Math.trunc(rank) : null;
}

function main() {
  if (existsSync(DB_PATH)) rmSync(DB_PATH);
  for (const ext of ["-wal", "-shm"]) if (existsSync(DB_PATH + ext)) rmSync(DB_PATH + ext);
  const db = openBakeDb(DB_PATH);

  const insDict = db.prepare(
    `INSERT OR REPLACE INTO dictionaries(id,title,revision,kind,priority,entryCount,installedAt)
     VALUES(@id,@title,@revision,@kind,@priority,@entryCount,0)`,
  );
  const insTerm = db.prepare(
    `INSERT INTO terms(dict,expression,reading,expressionReverse,definitionTags,rules,score,glossary,sequence,termTags)
     VALUES(@dict,@expression,@reading,@expressionReverse,@definitionTags,@rules,@score,@glossary,@sequence,@termTags)`,
  );
  const insKanji = db.prepare(
    `INSERT INTO kanji(dict,character,onyomi,kunyomi,tags,meanings,stats)
     VALUES(@dict,@character,@onyomi,@kunyomi,@tags,@meanings,@stats)`,
  );
  const insFreq = db.prepare(
    `INSERT INTO frequency(dict,expression,reading,rank,displayValue)
     VALUES(@dict,@expression,@reading,@rank,@displayValue)`,
  );

  const totals = { terms: 0, kanji: 0, frequency: 0 };

  for (const src of SOURCES) {
    if (EXCLUDE.has(src.file)) { console.log(`  ${src.file} → EXCLUDED`); continue; }
    const zip = join(DATA, src.file);
    if (!existsSync(zip)) throw new Error(`missing source: ${zip}`);
    const idxBytes = readIndexBytes(zip);
    const idx = idxBytes ? parseIndex(idxBytes) : null;
    const dictId = idx?.title ?? src.file;
    insDict.run({
      id: dictId, title: idx?.title ?? src.file, revision: idx?.revision ?? "",
      kind: src.kind, priority: src.priority, entryCount: 0,
    });

    let fileCount = 0;
    const runFile = db.transaction((entryBytes: Uint8Array, base: string) => {
      const pb = parseBank(base, entryBytes);
      for (const chunk of pb.inserts) {
        if (chunk.kind === "terms") {
          for (const r of chunk.rows) {
            insTerm.run({
              dict: dictId, expression: r.expression, reading: r.reading,
              expressionReverse: r.expressionReverse,
              definitionTags: JSON.stringify(r.definitionTags),
              rules: JSON.stringify(r.rules), score: r.score,
              glossary: JSON.stringify(r.glossary), sequence: r.sequence,
              termTags: JSON.stringify(r.termTags),
            });
            fileCount++;
          }
        } else if (chunk.kind === "kanji") {
          for (const r of chunk.rows) {
            insKanji.run({
              dict: dictId, character: r.character,
              onyomi: JSON.stringify(r.onyomi), kunyomi: JSON.stringify(r.kunyomi),
              tags: JSON.stringify(r.tags), meanings: JSON.stringify(r.meanings),
              stats: JSON.stringify(r.stats),
            });
            fileCount++;
          }
        } else if (chunk.kind === "frequency") {
          for (const r of chunk.rows) {
            insFreq.run({
              dict: dictId, expression: r.expression, reading: r.reading,
              rank: intRank(r.rank), displayValue: r.displayValue,
            });
            fileCount++;
          }
        }
        // termMeta / kanjiMeta chunks are intentionally dropped (freq already extracted).
      }
    });

    for (const e of iterBankEntries(zip)) runFile(e.bytes, e.base);
    totals[src.kind] += fileCount;
    db.prepare(`UPDATE dictionaries SET entryCount=? WHERE id=?`).run(fileCount, dictId);
    console.log(`  ${src.file} → ${src.kind} +${fileCount}`);
  }

  console.log("building indexes…");
  db.exec(`
    CREATE INDEX idx_terms_expr ON terms(expression);
    CREATE INDEX idx_terms_read ON terms(reading);
    CREATE INDEX idx_terms_exprrev ON terms(expressionReverse);
    CREATE INDEX idx_terms_seq ON terms(sequence);
    CREATE INDEX idx_kanji_char ON kanji(character);
    CREATE INDEX idx_freq_expr ON frequency(expression);
  `);

  console.log("building gloss_fts (English)…");
  const insFts = db.prepare(`INSERT INTO gloss_fts(term_id, gloss_en) VALUES(?, ?)`);
  const rows = db.prepare(`SELECT id, glossary FROM terms`).all() as { id: number; glossary: string }[];
  const buildFts = db.transaction((rs: typeof rows) => {
    for (const r of rs) {
      const en = flattenGloss(JSON.parse(r.glossary));
      if (en) insFts.run(r.id, en);
    }
  });
  buildFts(rows);
  db.exec(`INSERT INTO gloss_fts(gloss_fts) VALUES('optimize')`);

  db.pragma("wal_checkpoint(TRUNCATE)");
  console.log(`d01.db done — terms=${totals.terms} kanji=${totals.kanji} frequency=${totals.frequency} fts=${rows.length}`);
  db.close();
}

main();
