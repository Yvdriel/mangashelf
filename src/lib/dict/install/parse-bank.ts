import type {
  FrequencyRecord,
  GlossaryNode,
  KanjiMetaRecord,
  KanjiRecord,
  TermMetaRecord,
  TermRecord,
} from "../types";

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

export type TermMetaBankRow = [string, string, unknown];

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

export interface ParsedBank {
  inserts: BankChunk[];
  rowCount: number;
}

const DECODER = new TextDecoder("utf-8");

export function parseIndex(bytes: Uint8Array): YomitanIndex {
  const index = JSON.parse(DECODER.decode(bytes)) as YomitanIndex;
  if (index.format !== 3) {
    throw new Error(
      `Unsupported dictionary format ${index.format}. Only v3 is supported.`,
    );
  }
  return index;
}

export function parseBank(name: string, bytes: Uint8Array): ParsedBank {
  const text = DECODER.decode(bytes);

  if (name.startsWith("term_meta_bank_")) {
    const rows = JSON.parse(text) as TermMetaBankRow[];
    const termMeta: TermMetaRow[] = [];
    const frequency: FrequencyRow[] = [];
    for (const r of rows) {
      const [expression, mode, data] = r;
      termMeta.push({ expression, mode, data });
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
    const inserts: BankChunk[] = [{ kind: "termMeta", rows: termMeta }];
    if (frequency.length > 0) inserts.push({ kind: "frequency", rows: frequency });
    return { inserts, rowCount: termMeta.length + frequency.length };
  }

  if (name.startsWith("term_bank_")) {
    const rows = JSON.parse(text) as TermBankRow[];
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
    return { inserts: [{ kind: "terms", rows: terms }], rowCount: terms.length };
  }

  if (name.startsWith("kanji_meta_bank_")) {
    const rows = JSON.parse(text) as KanjiMetaBankRow[];
    const kanjiMeta: KanjiMetaRow[] = rows.map((r) => ({
      character: r[0],
      mode: r[1],
      data: r[2],
    }));
    return {
      inserts: [{ kind: "kanjiMeta", rows: kanjiMeta }],
      rowCount: kanjiMeta.length,
    };
  }

  if (name.startsWith("kanji_bank_")) {
    const rows = JSON.parse(text) as KanjiBankRow[];
    const kanji: KanjiRow[] = rows.map((r) => ({
      character: r[0],
      onyomi: splitTags(r[1]),
      kunyomi: splitTags(r[2]),
      tags: splitTags(r[3]),
      meanings: r[4],
      stats: r[5] ?? {},
    }));
    return {
      inserts: [{ kind: "kanji", rows: kanji }],
      rowCount: kanji.length,
    };
  }

  return { inserts: [], rowCount: 0 };
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
