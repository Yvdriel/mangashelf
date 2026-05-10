import type { IDBPDatabase } from "idb";
import type { DictDB } from "./db/idb";
import {
  findFrequencies,
  findKanji,
  findTermsBulk,
  listInstalled,
} from "./db/queries";
import { COND, rulesToConditions } from "./transforms/conditions";
import type { LanguageTransformer } from "./transforms/language-transformer";
import type {
  FrequencyRecord,
  InstalledDictionary,
  KanjiRecord,
  ScanResult,
  TermHit,
} from "./types";

export interface ScannerDeps {
  db: IDBPDatabase<DictDB>;
  transformer: LanguageTransformer;
  maxLength?: number;
}

const KANJI_RE = /[一-鿿㐀-䶿]/;
const KANA_RE = /[぀-ヿｦ-ﾟ]/;

export async function scanAt(
  deps: ScannerDeps,
  text: string,
  position: number,
): Promise<ScanResult | null> {
  const maxLen = deps.maxLength ?? 16;
  const dictsP = listInstalled(deps.db);

  // Build candidate substrings: longest → shortest. For each, run the
  // language transformer to get all deinflected forms.
  const upper = Math.min(maxLen, text.length - position);
  if (upper <= 0) return null;

  // Map deinflected term → list of {sourceLen, reasons, conditionsMask}.
  // Lookup is O(unique deinflected terms) regardless of source-length count.
  interface Cand {
    sourceLen: number;
    reasons: string[];
    conditions: number;
  }
  const candByTerm = new Map<string, Cand[]>();
  for (let len = upper; len >= 1; len--) {
    const sub = text.slice(position, position + len);
    if (!sub) continue;
    if (!KANJI_RE.test(sub) && !KANA_RE.test(sub)) break;
    const forms = deps.transformer.transform(sub, COND.ANY);
    for (const f of forms) {
      const arr = candByTerm.get(f.term);
      const c: Cand = {
        sourceLen: len,
        reasons: f.reasons,
        conditions: f.conditions,
      };
      if (arr) arr.push(c);
      else candByTerm.set(f.term, [c]);
    }
  }

  if (candByTerm.size === 0) return null;

  const dicts = await dictsP;
  const dictById = new Map(dicts.map((d) => [d.id, d]));
  const dictPriority = (id: string): number =>
    dictById.get(id)?.priority ?? 1000;

  const rows = await findTermsBulk(deps.db, [...candByTerm.keys()]);
  if (rows.length === 0) return null;

  // Group rows by the longest source-length they can match. A row matches a
  // candidate iff (a) its expression or reading matches the deinflected term,
  // and (b) its rule mask intersects the candidate's conditions.
  let bestLen = 0;
  const bestHits: TermHit[] = [];

  for (const row of rows) {
    const candsByExpr = candByTerm.get(row.expression) ?? [];
    const candsByRead = candByTerm.get(row.reading) ?? [];
    const candidates = candsByExpr.concat(candsByRead);
    const ruleMask = rulesToConditions(row.rules);
    let chosen: Cand | null = null;
    for (const c of candidates) {
      if ((c.conditions & ruleMask) === 0) continue;
      if (!chosen || c.sourceLen > chosen.sourceLen) chosen = c;
    }
    if (!chosen) continue;
    if (chosen.sourceLen > bestLen) bestLen = chosen.sourceLen;
  }

  if (bestLen === 0) return null;
  const surface = text.slice(position, position + bestLen);

  for (const row of rows) {
    const candidates = (candByTerm.get(row.expression) ?? []).concat(
      candByTerm.get(row.reading) ?? [],
    );
    const ruleMask = rulesToConditions(row.rules);
    const winning = candidates
      .filter((c) => (c.conditions & ruleMask) !== 0 && c.sourceLen === bestLen)
      .sort((a, b) => a.reasons.length - b.reasons.length)[0];
    if (!winning) continue;
    bestHits.push({
      record: row,
      source: text.slice(position, position + winning.sourceLen),
      reasons: winning.reasons,
      frequency: null,
      frequencyDisplay: null,
      dictTitle: dictById.get(row.dict)?.title ?? row.dict,
    });
  }

  if (bestHits.length === 0) return null;

  // Attach frequency from any frequency dictionary keyed by expression.
  const exprs = [...new Set(bestHits.map((h) => h.record.expression))];
  const freqs = await findFrequencies(deps.db, exprs);
  const freqByKey = new Map<string, FrequencyRecord>();
  for (const f of freqs) {
    const key = readingKey(f.expression, f.reading);
    const existing = freqByKey.get(key);
    if (!existing || f.rank < existing.rank) freqByKey.set(key, f);
  }
  for (const h of bestHits) {
    const f =
      freqByKey.get(readingKey(h.record.expression, h.record.reading)) ??
      freqByKey.get(readingKey(h.record.expression, null));
    if (f) {
      h.frequency = f.rank;
      h.frequencyDisplay = f.displayValue;
    }
  }

  bestHits.sort((a, b) => {
    const af = a.frequency ?? Number.POSITIVE_INFINITY;
    const bf = b.frequency ?? Number.POSITIVE_INFINITY;
    if (af !== bf) return af - bf;
    if (a.record.score !== b.record.score) return b.record.score - a.record.score;
    return dictPriority(a.record.dict) - dictPriority(b.record.dict);
  });

  // Kanji info for unique CJK chars in the winning surface.
  const kanjiChars = uniqueKanji(surface);
  const kanji = kanjiChars.length > 0 ? await findKanji(deps.db, kanjiChars) : [];

  return {
    position,
    surface,
    hits: bestHits,
    kanji: orderKanjiBySurface(kanji, surface),
  };
}

export async function scanAll(
  deps: ScannerDeps,
  text: string,
): Promise<ScanResult[]> {
  const out: ScanResult[] = [];
  let i = 0;
  while (i < text.length) {
    const r = await scanAt(deps, text, i);
    if (r) {
      out.push(r);
      i += r.surface.length;
    } else {
      // No hit at this position — emit a single-character placeholder result
      // so the dialog can still show every codepoint, then advance.
      const ch = text[i];
      out.push({ position: i, surface: ch, hits: [], kanji: [] });
      i += ch.length;
    }
  }
  return out;
}

function readingKey(expression: string, reading: string | null): string {
  return `${expression}|${reading ?? ""}`;
}

function uniqueKanji(s: string): string[] {
  const seen = new Set<string>();
  for (const ch of s) {
    if (KANJI_RE.test(ch)) seen.add(ch);
  }
  return [...seen];
}

function orderKanjiBySurface(
  rows: KanjiRecord[],
  surface: string,
): KanjiRecord[] {
  const order = new Map<string, number>();
  let idx = 0;
  for (const ch of surface) {
    if (KANJI_RE.test(ch) && !order.has(ch)) order.set(ch, idx++);
  }
  return [...rows].sort(
    (a, b) =>
      (order.get(a.character) ?? Number.POSITIVE_INFINITY) -
      (order.get(b.character) ?? Number.POSITIVE_INFINITY),
  );
}

// Re-export as a clean type so consumers can use the InstalledDictionary
// shape without crossing into the protocol layer.
export type { InstalledDictionary };
