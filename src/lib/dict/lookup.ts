import fs from "fs";
import path from "path";
import type { IpadicFeatures } from "@patdx/kuromoji";
import { getSqliteClient } from "@/db";

export interface DictEntry {
  headword: string;
  reading: string;
  common: boolean;
  pos: string[];
  glosses: string[];
}

export interface TokenLookup {
  surface: string;
  lemma: string;
  reading?: string;
  entries: DictEntry[];
}

export interface LookupResult {
  tokens: TokenLookup[];
}

type TokenizeFn = (text: string) => IpadicFeatures[];

let tokenizerPromise: Promise<TokenizeFn> | null = null;

function resolveKuromojiDictPath(): string {
  if (process.env.KUROMOJI_DICT_DIR) return process.env.KUROMOJI_DICT_DIR;
  // Probe the same paths regardless of dev vs. standalone: `process.cwd()` is
  // `<repo>` in dev and `/app` in the Docker runner. `outputFileTracingIncludes`
  // ensures the dict files are copied into standalone's `node_modules/`.
  const candidates = [
    path.join(process.cwd(), "node_modules", "@patdx", "kuromoji", "dict"),
    "/opt/dict/kuromoji",
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  return candidates[0];
}

async function getTokenizer(): Promise<TokenizeFn> {
  if (!tokenizerPromise) {
    tokenizerPromise = (async () => {
      const dicPath = resolveKuromojiDictPath();
      // Dynamic import: `@patdx/kuromoji` is ESM-only, so it must be loaded
      // with `await import()` from a CJS-compiled Next.js server bundle.
      const kuromoji = await import("@patdx/kuromoji");
      const nodeLoaderMod = await import("@patdx/kuromoji/node");
      const NodeDictionaryLoader = nodeLoaderMod.default;
      const tokenizer = await new kuromoji.TokenizerBuilder({
        loader: new NodeDictionaryLoader({ dic_path: dicPath }),
      }).build();
      return (text: string) => tokenizer.tokenize(text);
    })();
  }
  return tokenizerPromise;
}

interface DictRow {
  headword: string;
  reading: string;
  common: number;
  pos: string;
  glosses: string;
}

function rowsForKey(
  sqlite: ReturnType<typeof getSqliteClient>,
  key: string,
  limit: number,
): DictEntry[] {
  if (!key) return [];
  // Plain indexed lookup. We only ever query lemmas/surface forms exactly,
  // so FTS5's tokenizer adds no value but introduces CJK quirks.
  const stmt = sqlite.prepare<[string, string, number], DictRow>(`
    SELECT headword, reading, common, pos, glosses
    FROM dict_term
    WHERE headword = ? OR reading = ?
    ORDER BY common DESC
    LIMIT ?
  `);
  let rows: DictRow[];
  try {
    rows = stmt.all(key, key, limit);
  } catch {
    return [];
  }
  return rows.map(rowToEntry);
}

function rowToEntry(r: DictRow): DictEntry {
  let glosses: string[] = [];
  try {
    const parsed: unknown = JSON.parse(r.glosses);
    if (Array.isArray(parsed)) {
      glosses = parsed.filter((x): x is string => typeof x === "string");
    }
  } catch {
    glosses = [];
  }
  return {
    headword: r.headword,
    reading: r.reading,
    common: r.common === 1,
    pos: r.pos ? r.pos.split(",") : [],
    glosses,
  };
}

function pickLemma(t: IpadicFeatures): string {
  if (t.basic_form && t.basic_form !== "*") return t.basic_form;
  return t.surface_form;
}

const SKIP_POS = new Set(["記号", "助詞", "助動詞", "BOS/EOS"]);

export async function lookupText(text: string): Promise<LookupResult> {
  const trimmed = text.trim();
  if (!trimmed) return { tokens: [] };

  const sqlite = getSqliteClient();
  const tokenize = await getTokenizer();
  const features = tokenize(trimmed);

  const seen = new Set<string>();
  const tokens: TokenLookup[] = [];

  // Whole-input fallback so compound-noun phrases land first when JMdict has
  // them as a single entry (e.g. 学校).
  if (trimmed.length <= 32) {
    const whole = rowsForKey(sqlite, trimmed, 5);
    if (whole.length > 0) {
      tokens.push({
        surface: trimmed,
        lemma: trimmed,
        entries: whole,
      });
      seen.add(trimmed);
    }
  }

  for (const f of features) {
    if (SKIP_POS.has(f.pos)) continue;
    const lemma = pickLemma(f);
    if (!lemma || seen.has(lemma)) continue;
    seen.add(lemma);

    let entries = rowsForKey(sqlite, lemma, 5);
    if (entries.length === 0 && lemma !== f.surface_form) {
      entries = rowsForKey(sqlite, f.surface_form, 5);
    }
    if (entries.length === 0) continue;

    tokens.push({
      surface: f.surface_form,
      lemma,
      reading: f.reading,
      entries,
    });
  }

  return { tokens };
}
