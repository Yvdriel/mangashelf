// D0.2 — custom ingests → out/d02.db (kanji_radical, radical, sentence, sentence_word,
// furigana) + KanjiVG SVG asset tree out/kanjivg/<shard>/<hex>.svg. No dependency on
// D0.1 → runs fully in parallel.
//   node --experimental-strip-types tools/bake-db/bake-d02.ts
import { existsSync, rmSync, mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { gunzipSync } from "node:zlib";
import AdmZip from "adm-zip";
import { openBakeDb } from "./lib/open-db.ts";
import { decodeEucJp } from "./lib/euc-jp.ts";

const HERE = dirname(fileURLToPath(import.meta.url));
const DATA = join(HERE, "..", "dict-data");
const OUT = join(HERE, "out");
const DB_PATH = join(OUT, "d02.db");
const SVG_OUT = join(OUT, "kanjivg");

function zipEntryByBase(zipPath: string, ...bases: string[]): Uint8Array | null {
  const zip = new AdmZip(zipPath);
  for (const e of zip.getEntries()) {
    if (!e.isDirectory && bases.includes(e.entryName.split("/").pop() ?? "")) return e.getData();
  }
  return null;
}

// --- KRADFILE → kanji_radical ; RADKFILE → radical(strokes) ------------------
function ingestRadicals(db: any) {
  const insKR = db.prepare(`INSERT INTO kanji_radical(character, radical) VALUES(?, ?)`);
  const insRad = db.prepare(`INSERT OR REPLACE INTO radical(radical, strokes) VALUES(?, ?)`);
  const zip = join(DATA, "kradzip.zip");

  let krCount = 0;
  const krTx = db.transaction((files: string[]) => {
    for (const f of files) {
      const bytes = zipEntryByBase(zip, f);
      if (!bytes) continue;
      for (const line of decodeEucJp(bytes).split("\n")) {
        if (!line || line.startsWith("#")) continue;
        const sep = line.indexOf(" : ");
        if (sep < 0) continue;
        const ch = line.slice(0, sep).trim();
        const rads = line.slice(sep + 3).trim().split(/\s+/).filter(Boolean);
        for (const r of rads) { insKR.run(ch, r); krCount++; }
      }
    }
  });
  krTx(["kradfile", "kradfile2"]);

  let radCount = 0;
  const radBytes = zipEntryByBase(zip, "radkfile");
  if (radBytes) {
    const radTx = db.transaction(() => {
      for (const line of decodeEucJp(radBytes).split("\n")) {
        if (!line.startsWith("$")) continue;        // "$ <radical> <strokes> [imgname]"
        const p = line.trim().split(/\s+/);
        if (p.length >= 3) { insRad.run(p[1], parseInt(p[2], 10) || null); radCount++; }
      }
    });
    radTx();
  }
  console.log(`  kanji_radical +${krCount} ; radical +${radCount}`);
}

// --- Tanaka examples.utf.gz → sentence + sentence_word -----------------------
// B-token: headword(reading)[sense]{surface}  — (#seqid) is a cross-ref, not a reading.
const TOKEN_RE = /^([^\s(\[{~]+)(?:\(([^)]*)\))?(?:\[([^\]]+)\])?(?:\{([^}]+)\})?~?$/;
function ingestSentences(db: any) {
  const insS = db.prepare(`INSERT INTO sentence(jp, en) VALUES(?, ?)`);
  const insW = db.prepare(
    `INSERT INTO sentence_word(sentence_id, headword, reading, sense, surface) VALUES(?,?,?,?,?)`,
  );
  const text = gunzipSync(readFileSync(join(DATA, "examples.utf.gz"))).toString("utf-8");
  let sCount = 0, wCount = 0;
  let pendingJp: string | null = null, pendingEn: string | null = null;

  const tx = db.transaction((lines: string[]) => {
    for (const line of lines) {
      if (line.startsWith("A: ")) {
        const body = line.slice(3);
        const tab = body.indexOf("\t");
        const jp = tab >= 0 ? body.slice(0, tab) : body;
        let en = tab >= 0 ? body.slice(tab + 1) : "";
        const hash = en.indexOf("#ID=");
        if (hash >= 0) en = en.slice(0, hash);
        pendingJp = jp.trim(); pendingEn = en.trim();
      } else if (line.startsWith("B: ") && pendingJp != null) {
        const info = insS.run(pendingJp, pendingEn);
        const sid = Number(info.lastInsertRowid);
        sCount++;
        for (const tok of line.slice(3).trim().split(/\s+/)) {
          const m = TOKEN_RE.exec(tok);
          if (!m) continue;
          const headword = m[1];
          const paren = m[2];                                  // reading or "#seqid"
          const reading = paren && !paren.startsWith("#") ? paren : null;
          insW.run(sid, headword, reading, m[3] ?? null, m[4] ?? null);
          wCount++;
        }
        pendingJp = pendingEn = null;
      }
    }
  });
  tx(text.split("\n"));
  console.log(`  sentence +${sCount} ; sentence_word +${wCount}`);
}

// --- JmdictFurigana → furigana -----------------------------------------------
function ingestFurigana(db: any) {
  const bytes = zipEntryByBase(join(DATA, "JmdictFurigana.json.zip"), "JmdictFurigana.json");
  if (!bytes) { console.log("  furigana: SKIP (entry not found)"); return; }
  let txt = Buffer.from(bytes).toString("utf-8");
  if (txt.charCodeAt(0) === 0xfeff) txt = txt.slice(1); // strip BOM
  const arr = JSON.parse(txt) as { text: string; reading: string; furigana: unknown[] }[];
  const ins = db.prepare(`INSERT INTO furigana(expression, reading, segments) VALUES(?,?,?)`);
  let n = 0;
  const tx = db.transaction(() => {
    for (const e of arr) { ins.run(e.text, e.reading, JSON.stringify(e.furigana)); n++; }
  });
  tx();
  console.log(`  furigana +${n}`);
}

// --- KanjiVG → out/kanjivg/<shard>/<hex>.svg ---------------------------------
function ingestKanjiVg() {
  if (existsSync(SVG_OUT)) rmSync(SVG_OUT, { recursive: true, force: true });
  mkdirSync(SVG_OUT, { recursive: true });
  const zip = new AdmZip(join(DATA, "kanjivg.zip"));
  let n = 0;
  for (const e of zip.getEntries()) {
    if (e.isDirectory) continue;
    const base = e.entryName.split("/").pop() ?? "";
    if (!base.endsWith(".svg")) continue;
    const shard = base.slice(0, 2);                  // first 2 hex chars
    const dir = join(SVG_OUT, shard);
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, base), e.getData());
    n++;
  }
  console.log(`  kanjivg svg files: ${n} → ${SVG_OUT}`);
}

function main() {
  if (existsSync(DB_PATH)) rmSync(DB_PATH);
  for (const ext of ["-wal", "-shm"]) if (existsSync(DB_PATH + ext)) rmSync(DB_PATH + ext);
  mkdirSync(OUT, { recursive: true });
  const db = openBakeDb(DB_PATH);

  ingestRadicals(db);
  ingestSentences(db);
  ingestFurigana(db);

  console.log("building d02 indexes…");
  db.exec(`
    CREATE INDEX idx_krad_char ON kanji_radical(character);
    CREATE INDEX idx_krad_rad ON kanji_radical(radical);
    CREATE INDEX idx_sw_head ON sentence_word(headword);
    CREATE INDEX idx_furi ON furigana(expression, reading);
  `);
  db.pragma("wal_checkpoint(TRUNCATE)");
  db.close();

  ingestKanjiVg();
  console.log("d02.db done");
}

main();
