import { unzipSync, type UnzipFileInfo } from "fflate";
import type { InstallPhase } from "../protocol";
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

export type TermRow = Omit<TermRecord, "id" | "dict">;
export type TermMetaRow = Omit<TermMetaRecord, "id" | "dict">;
export type KanjiRow = Omit<KanjiRecord, "id" | "dict">;
export type KanjiMetaRow = Omit<KanjiMetaRecord, "id" | "dict">;
export type FrequencyRow = Omit<FrequencyRecord, "id" | "dict">;

export type BankChunk =
  | { kind: "terms"; rows: TermRow[] }
  | { kind: "termMeta"; rows: TermMetaRow[] }
  | { kind: "kanji"; rows: KanjiRow[] }
  | { kind: "kanjiMeta"; rows: KanjiMetaRow[] }
  | { kind: "frequency"; rows: FrequencyRow[] };

export type StreamYield =
  | { kind: "index"; index: YomitanIndex; totalBanks: number }
  | { kind: "bankStart"; index: number }
  | BankChunk
  | { kind: "bankDone" };

const DECODER = new TextDecoder("utf-8");

function decodeOne(zip: Uint8Array, name: string): Uint8Array | null {
  const result = unzipSync(zip, {
    filter: (info: UnzipFileInfo) => info.name === name,
  });
  return result[name] ?? null;
}

function parseJSON<T>(bytes: Uint8Array): T {
  return JSON.parse(DECODER.decode(bytes)) as T;
}

// Streaming generator: decompresses + parses + transforms one bank at a time
// and yields the rows. The previous bank's bytes and parsed JSON go out of
// scope before the next is touched, so sustained worker heap stays low.
//
// iOS Safari (PWA) memory pressure during Jitendex install motivated this:
// holding all decompressed banks + all parsed entries simultaneously pushed
// the worker over WebKit's ~250 MB limit and the page would reload.
//
// Progress is reported by the consumer (`installDictionary`) on the
// `bankDone` marker — banks-completed is the single monotonic dimension.
export async function* streamYomitanZip(
  zip: ArrayBuffer,
  onPhase?: (phase: InstallPhase, detail: string) => void,
): AsyncGenerator<StreamYield, void, void> {
  const zipBytes = new Uint8Array(zip);

  onPhase?.("scanning", "Reading index");
  const indexBytes = decodeOne(zipBytes, "index.json");
  if (!indexBytes) throw new Error("Missing index.json");
  const index = parseJSON<YomitanIndex>(indexBytes);
  if (index.format !== 3) {
    throw new Error(
      `Unsupported dictionary format ${index.format}. Only v3 is supported.`,
    );
  }

  onPhase?.("scanning", "Scanning archive");
  const bankNames: string[] = [];
  unzipSync(zipBytes, {
    filter: (info: UnzipFileInfo) => {
      if (/(term|term_meta|kanji|kanji_meta)_bank_\d+\.json$/.test(info.name)) {
        bankNames.push(info.name);
      }
      return false;
    },
  });

  yield { kind: "index", index, totalBanks: bankNames.length };

  for (let i = 0; i < bankNames.length; i++) {
    const name = bankNames[i];
    yield { kind: "bankStart", index: i + 1 };
    const bytes = decodeOne(zipBytes, name);
    if (!bytes) {
      yield { kind: "bankDone" };
      continue;
    }

    if (name.startsWith("term_meta_bank_")) {
      const rows = parseJSON<TermMetaBankRow[]>(bytes);
      const termMeta: TermMetaRow[] = [];
      const frequency: FrequencyRow[] = [];
      for (const r of rows) {
        const [expression, mode, data] = r;
        termMeta.push({ expression, mode, data });
        // Surface frequency entries into a queryable record. Yomitan freq
        // payloads come in several shapes:
        //   - number                                  → rank only
        //   - string                                  → display value (try to parse)
        //   - { value: number, displayValue?: string }
        //   - { reading: string, frequency: ... }     → reading-disambiguated
        if (mode === "freq") {
          const f = extractFrequency(data);
          if (f) {
            frequency.push({
              expression,
              reading: f.reading,
              rank: f.rank,
              displayValue: f.displayValue,
            });
          }
        }
      }
      yield { kind: "termMeta", rows: termMeta };
      if (frequency.length > 0) {
        yield { kind: "frequency", rows: frequency };
      }
    } else if (name.startsWith("term_bank_")) {
      const rows = parseJSON<TermBankRow[]>(bytes);
      const terms: TermRow[] = new Array(rows.length);
      for (let i = 0; i < rows.length; i++) {
        const [
          expression,
          reading,
          defTags,
          rules,
          score,
          glossary,
          sequence,
          termTags,
        ] = rows[i];
        terms[i] = {
          expression,
          reading: reading || expression,
          expressionReverse: reverseString(expression),
          definitionTags: splitTags(defTags),
          rules: splitTags(rules),
          score,
          glossary: glossary as GlossaryNode[],
          sequence,
          termTags: splitTags(termTags),
        };
      }
      yield { kind: "terms", rows: terms };
    } else if (name.startsWith("kanji_meta_bank_")) {
      const rows = parseJSON<KanjiMetaBankRow[]>(bytes);
      const kanjiMeta: KanjiMetaRow[] = rows.map((r) => ({
        character: r[0],
        mode: r[1],
        data: r[2],
      }));
      yield { kind: "kanjiMeta", rows: kanjiMeta };
    } else if (name.startsWith("kanji_bank_")) {
      const rows = parseJSON<KanjiBankRow[]>(bytes);
      const kanji: KanjiRow[] = rows.map((r) => ({
        character: r[0],
        onyomi: splitTags(r[1]),
        kunyomi: splitTags(r[2]),
        tags: splitTags(r[3]),
        meanings: r[4],
        stats: r[5] ?? {},
      }));
      yield { kind: "kanji", rows: kanji };
    }

    yield { kind: "bankDone" };
  }
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
