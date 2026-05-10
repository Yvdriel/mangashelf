import type { IDBPDatabase } from "idb";
import type { DictDB } from "./idb";
import type {
  FrequencyRecord,
  InstalledDictionary,
  KanjiRecord,
  TermRecord,
} from "../types";

// Single-tx batched lookup. For each key, we read both the `expression` and
// `reading` indexes to support kana-only or kanji-only forms. Results are
// deduped by record `id`.
export async function findTermsBulk(
  db: IDBPDatabase<DictDB>,
  keys: readonly string[],
): Promise<TermRecord[]> {
  if (keys.length === 0) return [];
  const tx = db.transaction("terms", "readonly");
  const expr = tx.store.index("expression");
  const read = tx.store.index("reading");
  const seen = new Set<number>();
  const out: TermRecord[] = [];
  await Promise.all(
    keys.flatMap((k) => [
      expr.getAll(IDBKeyRange.only(k)).then((rows) => {
        for (const r of rows) collect(r, out, seen);
      }),
      read.getAll(IDBKeyRange.only(k)).then((rows) => {
        for (const r of rows) collect(r, out, seen);
      }),
    ]),
  );
  await tx.done;
  return out;
}

function collect(
  r: TermRecord,
  out: TermRecord[],
  seen: Set<number>,
): void {
  if (r.id === undefined || seen.has(r.id)) return;
  seen.add(r.id);
  out.push(r);
}

export async function findKanji(
  db: IDBPDatabase<DictDB>,
  chars: readonly string[],
): Promise<KanjiRecord[]> {
  if (chars.length === 0) return [];
  const tx = db.transaction("kanji", "readonly");
  const idx = tx.store.index("character");
  const seen = new Set<number>();
  const out: KanjiRecord[] = [];
  await Promise.all(
    chars.map((c) =>
      idx.getAll(IDBKeyRange.only(c)).then((rows) => {
        for (const r of rows) {
          if (r.id === undefined || seen.has(r.id)) continue;
          seen.add(r.id);
          out.push(r);
        }
      }),
    ),
  );
  await tx.done;
  return out;
}

export async function findFrequencies(
  db: IDBPDatabase<DictDB>,
  expressions: readonly string[],
): Promise<FrequencyRecord[]> {
  if (expressions.length === 0) return [];
  const tx = db.transaction("frequency", "readonly");
  const idx = tx.store.index("expression");
  const out: FrequencyRecord[] = [];
  await Promise.all(
    expressions.map((e) =>
      idx.getAll(IDBKeyRange.only(e)).then((rows) => {
        for (const r of rows) out.push(r);
      }),
    ),
  );
  await tx.done;
  return out;
}

export async function listInstalled(
  db: IDBPDatabase<DictDB>,
): Promise<InstalledDictionary[]> {
  const all = await db.getAll("dictionaries");
  return all.sort((a, b) => a.priority - b.priority);
}

export async function putInstalled(
  db: IDBPDatabase<DictDB>,
  dict: InstalledDictionary,
): Promise<void> {
  await db.put("dictionaries", dict);
}

// Yields between chunks so the worker's message queue can drain (otherwise
// `install` blocks `list` / `lookup` for the entire ingest).
export async function bulkInsert<S extends "terms" | "termMeta" | "kanji" | "kanjiMeta" | "frequency">(
  db: IDBPDatabase<DictDB>,
  store: S,
  rows: ReadonlyArray<DictDB[S]["value"]>,
  onChunk?: (done: number, total: number) => void,
  chunkSize = 1000,
): Promise<void> {
  const total = rows.length;
  for (let start = 0; start < total; start += chunkSize) {
    const end = Math.min(start + chunkSize, total);
    const tx = db.transaction(store, "readwrite");
    for (let i = start; i < end; i++) {
      // idb's typing for `add` on an autoIncrement store wants the value
      // without `id`. Casting is safe — the runtime accepts either shape.
      void tx.store.add(rows[i] as DictDB[S]["value"]);
    }
    await tx.done;
    onChunk?.(end, total);
    // Yield to the worker's message loop for incoming `lookup` /
    // cancellation messages.
    await new Promise<void>((r) => setTimeout(r, 0));
  }
}

export async function deleteDictionary(
  db: IDBPDatabase<DictDB>,
  dictId: string,
): Promise<void> {
  await db.delete("dictionaries", dictId);
  for (const store of [
    "terms",
    "termMeta",
    "kanji",
    "kanjiMeta",
    "frequency",
  ] as const) {
    const tx = db.transaction(store, "readwrite");
    let cursor = await tx.store.openCursor();
    while (cursor) {
      if ((cursor.value as { dict: string }).dict === dictId) {
        await cursor.delete();
      }
      cursor = await cursor.continue();
    }
    await tx.done;
  }
}
