import type { IDBPDatabase } from "idb";
import type { DictDB } from "../db/idb";
import { bulkInsert } from "../db/queries";
import { parseBank } from "./parse-bank";

export async function parseAndInsertBank(
  db: IDBPDatabase<DictDB>,
  dictId: string,
  name: string,
  bytes: Uint8Array,
  onProgress?: (kind: string, done: number, total: number) => void,
): Promise<number> {
  const { inserts, rowCount } = parseBank(name, bytes);
  for (const chunk of inserts) {
    await bulkInsert(db, chunk.kind, chunk.rows, dictId, (done, total) => {
      onProgress?.(chunk.kind, done, total);
    });
  }
  return rowCount;
}
