import type { IDBPDatabase } from "idb";
import type { DictDB } from "../db/idb";
import {
  bulkInsert,
  deleteDictionary,
  putInstalled,
} from "../db/queries";
import type { InstallPhase } from "../protocol";
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
//
// Progress is reported in "banks completed", a single monotonic dimension
// known up-front from the first yield. Bank size is roughly uniform so this
// tracks wall time well enough for a UI bar.
export async function installDictionary(
  db: IDBPDatabase<DictDB>,
  target: InstallTarget,
  stream: AsyncGenerator<StreamYield, void, void>,
  onProgress?: (
    done: number,
    total: number,
    phase?: InstallPhase,
    detail?: string,
  ) => void,
): Promise<InstalledDictionary> {
  // Idempotent: wipe any prior install of the same dict id before inserting.
  await deleteDictionary(db, target.id);

  const dictId = target.id;
  let entryCount = 0;
  let banksDone = 0;
  let totalBanks = 0;
  let currentBankIndex = 0;
  let index: YomitanIndex | null = null;

  // Progress is reported in milli-banks (1000 ticks per bank) so the UI
  // bar moves smoothly within a single large bank (e.g. Jitendex term_bank
  // of ~10k rows takes seconds; per-chunk fractional ticks keep the bar
  // alive instead of jumping bank-to-bank).
  const TICKS_PER_BANK = 1000;
  const tickTotal = () => totalBanks * TICKS_PER_BANK;
  const bankDetail = () =>
    totalBanks > 0 ? `bank ${currentBankIndex} of ${totalBanks}` : undefined;

  for await (const chunk of stream) {
    if (chunk.kind === "index") {
      index = chunk.index;
      totalBanks = chunk.totalBanks;
      onProgress?.(0, tickTotal(), "scanning");
      continue;
    }
    if (chunk.kind === "bankStart") {
      currentBankIndex = chunk.index;
      onProgress?.(
        banksDone * TICKS_PER_BANK,
        tickTotal(),
        "parsing",
        bankDetail(),
      );
      continue;
    }
    if (chunk.kind === "bankDone") {
      banksDone++;
      onProgress?.(
        banksDone * TICKS_PER_BANK,
        tickTotal(),
        "parsing",
        bankDetail(),
      );
      continue;
    }
    await bulkInsert(
      db,
      chunk.kind,
      chunk.rows,
      dictId,
      (chunkDone, chunkTotal) => {
        const frac =
          chunkTotal > 0 ? Math.floor((chunkDone / chunkTotal) * TICKS_PER_BANK) : 0;
        onProgress?.(
          banksDone * TICKS_PER_BANK + frac,
          tickTotal(),
          "inserting",
          bankDetail(),
        );
      },
    );
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
  onProgress?.(tickTotal(), tickTotal(), "finishing");
  return dict;
}
