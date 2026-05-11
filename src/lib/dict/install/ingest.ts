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
  InstalledDictionary,
} from "../types";
import type { StreamYield, YomitanIndex } from "./yomitan-zip";

export interface InstallTarget {
  id: DictionaryId;
  title: string;
  kind: DictionaryKind;
  priority: number;
}

// Consumes the streaming generator from `streamYomitanZip` and inserts each
// bank into IDB as it arrives. Each chunk's parsed rows are released as soon
// as the IDB transaction commits — keeping sustained worker heap small.
export async function installDictionary(
  db: IDBPDatabase<DictDB>,
  target: InstallTarget,
  stream: AsyncGenerator<StreamYield, void, void>,
  onProgress?: (done: number, total: number) => void,
): Promise<InstalledDictionary> {
  // Idempotent: wipe any prior install of the same dict id before inserting.
  await deleteDictionary(db, target.id);

  const dictId = target.id;
  let entryCount = 0;
  let index: YomitanIndex | null = null;

  // Total is unknown until the stream completes (no central row count).
  // Report rolling total for UI; final tick reflects the true count.
  const tick = (chunkDone: number, chunkTotal: number) => {
    onProgress?.(entryCount + chunkDone, entryCount + chunkTotal);
  };

  for await (const chunk of stream) {
    if (chunk.kind === "index") {
      index = chunk.index;
      continue;
    }
    await bulkInsert(db, chunk.kind, chunk.rows, dictId, tick);
    entryCount += chunk.rows.length;
  }

  const dict: InstalledDictionary = {
    id: dictId,
    title: index?.title || target.title,
    revision: index?.revision || "unknown",
    kind: target.kind,
    priority: target.priority,
    entryCount,
    installedAt: Date.now(),
  };
  await putInstalled(db, dict);
  onProgress?.(entryCount, entryCount);
  return dict;
}
