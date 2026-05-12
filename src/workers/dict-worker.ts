/// <reference lib="webworker" />

import { Unzip, UnzipInflate, type UnzipFile } from "fflate";
import type { IDBPDatabase } from "idb";
import type { DictDB } from "@/lib/dict/db/idb";
import { openDictDB } from "@/lib/dict/db/idb";
import {
  deleteDictionary,
  listInstalled,
  putInstalled,
} from "@/lib/dict/db/queries";
import { parseAndInsertBank } from "@/lib/dict/install/install-bank";
import { parseIndex } from "@/lib/dict/install/parse-bank";
import { japaneseTransforms } from "@/lib/dict/transforms/ja-transforms";
import { LanguageTransformer } from "@/lib/dict/transforms/language-transformer";
import { scanAll, scanAt } from "@/lib/dict/scanner";
import type {
  InstallTargetMessage,
  WorkerMessage,
  WorkerRequest,
} from "@/lib/dict/protocol";
import type { InstalledDictionary } from "@/lib/dict/types";

const dbP = openDictDB();
const transformer = new LanguageTransformer(japaneseTransforms.rules);

const ctx = self as unknown as DedicatedWorkerGlobalScope;

function post(m: WorkerMessage): void {
  ctx.postMessage(m);
}

type Session = {
  id: number;
  target: InstallTargetMessage;
  unzip: Unzip;
  indexBytes: Uint8Array[] | null;
  insertChain: Promise<void>;
  banksDiscovered: number;
  banksDone: number;
  entryCount: number;
  finalChunkSeen: boolean;
  aborted: boolean;
};

let session: Session | null = null;

function concat(parts: Uint8Array[]): Uint8Array {
  let len = 0;
  for (const p of parts) len += p.byteLength;
  const out = new Uint8Array(len);
  let offset = 0;
  for (const p of parts) {
    out.set(p, offset);
    offset += p.byteLength;
  }
  return out;
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

async function processBank(
  s: Session,
  db: IDBPDatabase<DictDB>,
  name: string,
  bytes: Uint8Array,
): Promise<void> {
  if (s.aborted) return;
  post({
    id: s.id,
    type: "progress",
    phase: "parsing",
    detail: `Parsing ${name} (${formatBytes(bytes.byteLength)})`,
  });
  const rows = await parseAndInsertBank(
    db,
    s.target.id,
    name,
    bytes,
    (_kind, done, total) => {
      if (s.aborted) return;
      post({
        id: s.id,
        type: "progress",
        phase: "inserting",
        detail: `Indexing ${name}: ${done.toLocaleString()} / ${total.toLocaleString()} rows`,
      });
    },
  );
  if (s.aborted) return;
  s.banksDone++;
  s.entryCount += rows;
  post({
    id: s.id,
    type: "progress",
    phase: "inserting",
    detail: `Indexed ${name} (${rows.toLocaleString()} rows, ${s.banksDone}/${s.banksDiscovered}${s.finalChunkSeen ? "" : "+"} banks)`,
  });
}

function setupOnFile(s: Session, db: IDBPDatabase<DictDB>): void {
  s.unzip.onfile = (file: UnzipFile) => {
    if (s.aborted) return;
    if (file.name === "index.json") {
      post({
        id: s.id,
        type: "progress",
        phase: "extracting",
        detail: "Reading index.json",
      });
      const acc: Uint8Array[] = [];
      file.ondata = (err, chunk, final) => {
        if (err || s.aborted) return;
        if (chunk && chunk.byteLength > 0) acc.push(chunk);
        if (final) s.indexBytes = acc;
      };
      file.start();
      return;
    }
    if (
      !/(term|term_meta|kanji|kanji_meta)_bank_\d+\.json$/.test(file.name)
    ) {
      return;
    }
    s.banksDiscovered++;
    const total = s.finalChunkSeen
      ? `${s.banksDiscovered}`
      : `${s.banksDiscovered}+`;
    post({
      id: s.id,
      type: "progress",
      phase: "extracting",
      detail: `Extracting ${file.name} (${s.banksDiscovered} of ${total})`,
    });
    const acc: Uint8Array[] = [];
    const bankName = file.name;
    file.ondata = (err, chunk, final) => {
      if (err || s.aborted) return;
      if (chunk && chunk.byteLength > 0) acc.push(chunk);
      if (final) {
        const bytes = concat(acc);
        acc.length = 0;
        s.insertChain = s.insertChain.then(() =>
          processBank(s, db, bankName, bytes),
        );
      }
    };
    file.start();
  };
}

async function finalize(
  s: Session,
  db: IDBPDatabase<DictDB>,
): Promise<void> {
  post({
    id: s.id,
    type: "progress",
    phase: "finishing",
    detail: `Waiting for ${s.banksDiscovered - s.banksDone} bank(s) to finish indexing…`,
  });
  await s.insertChain;
  if (s.aborted) return;
  if (!s.indexBytes) throw new Error("Missing index.json");
  const index = parseIndex(concat(s.indexBytes));
  post({
    id: s.id,
    type: "progress",
    phase: "finishing",
    detail: "Saving dictionary index…",
  });
  const dict: InstalledDictionary = {
    id: s.target.id,
    title: index.title || s.target.title,
    revision: index.revision || "unknown",
    kind: s.target.kind,
    priority: s.target.priority,
    entryCount: s.entryCount,
    installedAt: Date.now(),
  };
  await putInstalled(db, dict);
  post({ id: s.id, type: "install:ok", dict });
  if (session === s) session = null;
}

async function abortSession(
  s: Session,
  db: IDBPDatabase<DictDB>,
): Promise<void> {
  s.aborted = true;
  try {
    await s.insertChain;
  } catch {
    // ignored
  }
  await deleteDictionary(db, s.target.id);
  if (session === s) session = null;
}

async function failSession(
  s: Session,
  db: IDBPDatabase<DictDB>,
  message: string,
): Promise<void> {
  s.aborted = true;
  post({ id: s.id, type: "error", message });
  await deleteDictionary(db, s.target.id);
  if (session === s) session = null;
}

async function handleInstall(
  req: Extract<
    WorkerRequest,
    { type: "install:start" | "install:chunk" | "install:abort" }
  >,
): Promise<void> {
  const db = await dbP;
  switch (req.type) {
    case "install:start": {
      if (session) {
        await abortSession(session, db);
      }
      post({
        id: req.id,
        type: "progress",
        phase: "extracting",
        detail: "Cleaning previous install…",
      });
      await deleteDictionary(db, req.target.id, (store, deleted) => {
        if (deleted > 0) {
          post({
            id: req.id,
            type: "progress",
            phase: "extracting",
            detail: `Removed ${deleted.toLocaleString()} rows from ${store}`,
          });
        }
      });
      const unzip = new Unzip();
      unzip.register(UnzipInflate);
      const s: Session = {
        id: req.id,
        target: req.target,
        unzip,
        indexBytes: null,
        insertChain: Promise.resolve(),
        banksDiscovered: 0,
        banksDone: 0,
        entryCount: 0,
        finalChunkSeen: false,
        aborted: false,
      };
      setupOnFile(s, db);
      session = s;
      post({
        id: s.id,
        type: "progress",
        phase: "extracting",
        detail: "Waiting for first bytes…",
      });
      return;
    }
    case "install:chunk": {
      const s = session;
      if (!s || s.id !== req.id) {
        post({
          id: req.id,
          type: "error",
          message: "no install session",
        });
        return;
      }
      const chunk = new Uint8Array(req.chunk);
      s.finalChunkSeen = req.final;
      try {
        s.unzip.push(chunk, req.final);
      } catch (e) {
        await failSession(
          s,
          db,
          e instanceof Error ? e.message : String(e),
        );
        return;
      }
      if (req.final) {
        finalize(s, db).catch(async (e) => {
          await failSession(
            s,
            db,
            e instanceof Error ? e.message : String(e),
          );
        });
      }
      return;
    }
    case "install:abort": {
      const s = session;
      if (s && s.id === req.id) {
        await abortSession(s, db);
      }
      return;
    }
  }
}

let installChain: Promise<unknown> = Promise.resolve();

async function handleOther(req: WorkerRequest): Promise<void> {
  const db = await dbP;
  switch (req.type) {
    case "lookup": {
      const result = await scanAt({ db, transformer }, req.text, req.position);
      post({ id: req.id, type: "lookup:ok", result });
      return;
    }
    case "scanText": {
      const results = await scanAll({ db, transformer }, req.text);
      post({ id: req.id, type: "scanText:ok", results });
      return;
    }
    case "uninstall": {
      await deleteDictionary(db, req.dictId);
      post({ id: req.id, type: "uninstall:ok" });
      return;
    }
    case "list": {
      const dicts = await listInstalled(db);
      post({ id: req.id, type: "list:ok", dicts });
      return;
    }
    default: {
      const unknown = req as { id: number; type: string };
      post({
        id: unknown.id,
        type: "error",
        message: `unknown request type: ${unknown.type}`,
      });
    }
  }
}

ctx.onmessage = (ev: MessageEvent<WorkerRequest>) => {
  const req = ev.data;
  if (
    req.type === "install:start" ||
    req.type === "install:chunk" ||
    req.type === "install:abort"
  ) {
    installChain = installChain.then(() =>
      handleInstall(req).catch((e) => {
        post({
          id: req.id,
          type: "error",
          message: e instanceof Error ? e.message : String(e),
        });
      }),
    );
    return;
  }
  handleOther(req).catch((e) => {
    post({
      id: req.id,
      type: "error",
      message: e instanceof Error ? e.message : String(e),
    });
  });
};
