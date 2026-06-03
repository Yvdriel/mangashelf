// Iterate the parseable bank entries of a Yomitan dictionary .zip. Matches by
// BASENAME so it works whether banks sit at the zip root or under a folder.
import AdmZip from "adm-zip";

export interface BankEntry {
  base: string; // e.g. "term_bank_1.json"
  bytes: Uint8Array;
}

const BANK_RE = /^(term_bank_|term_meta_bank_|kanji_bank_|kanji_meta_bank_)\d+\.json$/;

export function readIndexBytes(zipPath: string): Uint8Array | null {
  const zip = new AdmZip(zipPath);
  for (const e of zip.getEntries()) {
    if (e.isDirectory) continue;
    if (e.entryName.split("/").pop() === "index.json") return e.getData();
  }
  return null;
}

export function* iterBankEntries(zipPath: string): Generator<BankEntry> {
  const zip = new AdmZip(zipPath);
  for (const e of zip.getEntries()) {
    if (e.isDirectory) continue;
    const base = e.entryName.split("/").pop() ?? "";
    if (BANK_RE.test(base)) yield { base, bytes: e.getData() };
  }
}
