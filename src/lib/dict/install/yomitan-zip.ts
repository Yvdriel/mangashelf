import { unzip, type Unzipped } from "fflate";
import type {
  FrequencyRecord,
  GlossaryNode,
  KanjiMetaRecord,
  KanjiRecord,
  TermMetaRecord,
  TermRecord,
} from "../types";

// Yomitan v3 dictionary index. Older dictionaries (format 1/2) are rejected.
export interface YomitanIndex {
  title: string;
  revision: string;
  format: number;
  sequenced?: boolean;
  description?: string;
  author?: string;
  url?: string;
  attribution?: string;
}

// Term bank tuple (v3): [expression, reading, definitionTags, rules, score,
// glossary, sequence, termTags].
export type TermBankRow = [
  string,
  string,
  string,
  string,
  number,
  unknown[],
  number,
  string,
];

// Term meta bank tuple (v3): [expression, mode, data].
export type TermMetaBankRow = [string, string, unknown];

// Kanji bank tuple (v3): [character, onyomi, kunyomi, tags, meanings, stats].
export type KanjiBankRow = [
  string,
  string,
  string,
  string,
  string[],
  Record<string, string>,
];

export type KanjiMetaBankRow = [string, string, unknown];

export interface ParsedYomitanDict {
  index: YomitanIndex;
  terms: Array<Omit<TermRecord, "id" | "dict">>;
  termMeta: Array<Omit<TermMetaRecord, "id" | "dict">>;
  kanji: Array<Omit<KanjiRecord, "id" | "dict">>;
  kanjiMeta: Array<Omit<KanjiMetaRecord, "id" | "dict">>;
  frequency: Array<Omit<FrequencyRecord, "id" | "dict">>;
}

function unzipAsync(buf: Uint8Array): Promise<Unzipped> {
  return new Promise((resolve, reject) => {
    unzip(buf, (err, files) => {
      if (err) reject(err);
      else resolve(files);
    });
  });
}

const DECODER = new TextDecoder("utf-8");

function parseJSON<T>(bytes: Uint8Array): T {
  return JSON.parse(DECODER.decode(bytes)) as T;
}

export async function parseYomitanZip(
  zip: ArrayBuffer,
  onProgress?: (done: number, total: number) => void,
): Promise<ParsedYomitanDict> {
  const files = await unzipAsync(new Uint8Array(zip));
  const indexBytes = files["index.json"];
  if (!indexBytes) throw new Error("Missing index.json");
  const index = parseJSON<YomitanIndex>(indexBytes);
  if (index.format !== 3) {
    throw new Error(
      `Unsupported dictionary format ${index.format}. Only v3 is supported.`,
    );
  }

  const out: ParsedYomitanDict = {
    index,
    terms: [],
    termMeta: [],
    kanji: [],
    kanjiMeta: [],
    frequency: [],
  };

  const bankNames = Object.keys(files).filter((n) =>
    /(term|term_meta|kanji|kanji_meta)_bank_\d+\.json$/.test(n),
  );

  let processed = 0;
  const total = bankNames.length;
  for (const name of bankNames) {
    const bytes = files[name];
    if (!bytes) continue;
    if (name.startsWith("term_meta_bank_")) {
      const rows = parseJSON<TermMetaBankRow[]>(bytes);
      for (const r of rows) {
        const [expression, mode, data] = r;
        out.termMeta.push({ expression, mode, data });
        // Surface frequency entries into a queryable record. Yomitan freq
        // payloads come in several shapes:
        //   - number                                  → rank only
        //   - string                                  → display value (try to parse)
        //   - { value: number, displayValue?: string }
        //   - { reading: string, frequency: ... }     → reading-disambiguated
        if (mode === "freq") {
          const f = extractFrequency(data);
          if (f) {
            out.frequency.push({
              expression,
              reading: f.reading,
              rank: f.rank,
              displayValue: f.displayValue,
            });
          }
        }
      }
    } else if (name.startsWith("term_bank_")) {
      const rows = parseJSON<TermBankRow[]>(bytes);
      for (const r of rows) {
        const [
          expression,
          reading,
          defTags,
          rules,
          score,
          glossary,
          sequence,
          termTags,
        ] = r;
        out.terms.push({
          expression,
          reading: reading || expression,
          expressionReverse: reverseString(expression),
          definitionTags: splitTags(defTags),
          rules: splitTags(rules),
          score,
          glossary: glossary as GlossaryNode[],
          sequence,
          termTags: splitTags(termTags),
        });
      }
    } else if (name.startsWith("kanji_meta_bank_")) {
      const rows = parseJSON<KanjiMetaBankRow[]>(bytes);
      for (const r of rows) {
        const [character, mode, data] = r;
        out.kanjiMeta.push({ character, mode, data });
      }
    } else if (name.startsWith("kanji_bank_")) {
      const rows = parseJSON<KanjiBankRow[]>(bytes);
      for (const r of rows) {
        const [character, onyomi, kunyomi, tags, meanings, stats] = r;
        out.kanji.push({
          character,
          onyomi: splitTags(onyomi),
          kunyomi: splitTags(kunyomi),
          tags: splitTags(tags),
          meanings,
          stats: stats ?? {},
        });
      }
    }
    processed++;
    onProgress?.(processed, total);
  }

  return out;
}

function splitTags(s: string): string[] {
  if (!s) return [];
  return s.split(/\s+/).filter(Boolean);
}

function reverseString(s: string): string {
  return [...s].reverse().join("");
}

interface FreqExtract {
  rank: number;
  reading: string | null;
  displayValue: string | null;
}

function extractFrequency(data: unknown): FreqExtract | null {
  if (typeof data === "number") {
    return { rank: data, reading: null, displayValue: null };
  }
  if (typeof data === "string") {
    const n = Number(data);
    if (Number.isFinite(n)) {
      return { rank: n, reading: null, displayValue: data };
    }
    return { rank: Number.POSITIVE_INFINITY, reading: null, displayValue: data };
  }
  if (typeof data === "object" && data !== null) {
    const o = data as Record<string, unknown>;
    let reading: string | null = null;
    let payload: unknown = o;
    if (typeof o.reading === "string" && "frequency" in o) {
      reading = o.reading;
      payload = (o as { frequency: unknown }).frequency;
    }
    if (typeof payload === "number") {
      return { rank: payload, reading, displayValue: null };
    }
    if (typeof payload === "string") {
      const n = Number(payload);
      return {
        rank: Number.isFinite(n) ? n : Number.POSITIVE_INFINITY,
        reading,
        displayValue: payload,
      };
    }
    if (typeof payload === "object" && payload !== null) {
      const p = payload as Record<string, unknown>;
      const v =
        typeof p.value === "number"
          ? p.value
          : typeof p.frequency === "number"
            ? p.frequency
            : null;
      const display =
        typeof p.displayValue === "string"
          ? p.displayValue
          : typeof p.displayRank === "string"
            ? p.displayRank
            : null;
      if (v !== null) {
        return { rank: v, reading, displayValue: display };
      }
    }
  }
  return null;
}
