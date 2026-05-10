import type { IDBPDatabase } from "idb";
import type { DictDB } from "../db/idb";
import {
  bulkInsert,
  deleteDictionary,
  putInstalled,
} from "../db/queries";
import type {
  DictionaryId,
  DictionaryKind,
  FrequencyRecord,
  InstalledDictionary,
  KanjiMetaRecord,
  KanjiRecord,
  TermMetaRecord,
  TermRecord,
} from "../types";
import type { ParsedYomitanDict } from "./yomitan-zip";

export interface InstallTarget {
  id: DictionaryId;
  title: string;
  kind: DictionaryKind;
  priority: number;
}

export async function installDictionary(
  db: IDBPDatabase<DictDB>,
  target: InstallTarget,
  parsed: ParsedYomitanDict,
  onProgress?: (done: number, total: number) => void,
): Promise<InstalledDictionary> {
  // Idempotent: wipe any prior install of the same dict id before inserting.
  await deleteDictionary(db, target.id);

  const dictId = target.id;
  const totals =
    parsed.terms.length +
    parsed.termMeta.length +
    parsed.kanji.length +
    parsed.kanjiMeta.length +
    parsed.frequency.length;
  let done = 0;
  const tick = (n: number, _t: number) => {
    onProgress?.(done + n, totals);
  };

  if (parsed.terms.length > 0) {
    const rows: TermRecord[] = parsed.terms.map((r) => ({
      ...r,
      dict: dictId,
    }));
    await bulkInsert(db, "terms", rows, tick);
    done += rows.length;
  }
  if (parsed.termMeta.length > 0) {
    const rows: TermMetaRecord[] = parsed.termMeta.map((r) => ({
      ...r,
      dict: dictId,
    }));
    await bulkInsert(db, "termMeta", rows, tick);
    done += rows.length;
  }
  if (parsed.kanji.length > 0) {
    const rows: KanjiRecord[] = parsed.kanji.map((r) => ({
      ...r,
      dict: dictId,
    }));
    await bulkInsert(db, "kanji", rows, tick);
    done += rows.length;
  }
  if (parsed.kanjiMeta.length > 0) {
    const rows: KanjiMetaRecord[] = parsed.kanjiMeta.map((r) => ({
      ...r,
      dict: dictId,
    }));
    await bulkInsert(db, "kanjiMeta", rows, tick);
    done += rows.length;
  }
  if (parsed.frequency.length > 0) {
    const rows: FrequencyRecord[] = parsed.frequency.map((r) => ({
      ...r,
      dict: dictId,
    }));
    await bulkInsert(db, "frequency", rows, tick);
    done += rows.length;
  }

  const dict: InstalledDictionary = {
    id: dictId,
    title: parsed.index.title || target.title,
    revision: parsed.index.revision || "unknown",
    kind: target.kind,
    priority: target.priority,
    entryCount: totals,
    installedAt: Date.now(),
  };
  await putInstalled(db, dict);
  onProgress?.(totals, totals);
  return dict;
}
