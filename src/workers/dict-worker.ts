/// <reference lib="webworker" />

import { openDictDB } from "@/lib/dict/db/idb";
import { deleteDictionary, listInstalled } from "@/lib/dict/db/queries";
import { japaneseTransforms } from "@/lib/dict/transforms/ja-transforms";
import { LanguageTransformer } from "@/lib/dict/transforms/language-transformer";
import { scanAll, scanAt } from "@/lib/dict/scanner";
import { parseYomitanZip } from "@/lib/dict/install/yomitan-zip";
import { installDictionary } from "@/lib/dict/install/ingest";
import type {
  WorkerMessage,
  WorkerRequest,
} from "@/lib/dict/protocol";

const dbP = openDictDB();
const transformer = new LanguageTransformer(japaneseTransforms.rules);

const ctx = self as unknown as DedicatedWorkerGlobalScope;

function post(m: WorkerMessage): void {
  ctx.postMessage(m);
}

ctx.onmessage = async (ev: MessageEvent<WorkerRequest>) => {
  const req = ev.data;
  try {
    const db = await dbP;
    switch (req.type) {
      case "lookup": {
        const result = await scanAt({ db, transformer }, req.text, req.position);
        post({ id: req.id, type: "lookup:ok", result });
        break;
      }
      case "scanText": {
        const results = await scanAll({ db, transformer }, req.text);
        post({ id: req.id, type: "scanText:ok", results });
        break;
      }
      case "install": {
        const parsed = await parseYomitanZip(req.zip, (done, total) =>
          post({ id: req.id, type: "progress", phase: "parse", done, total }),
        );
        const dict = await installDictionary(db, req.target, parsed, (done, total) =>
          post({ id: req.id, type: "progress", phase: "insert", done, total }),
        );
        post({ id: req.id, type: "install:ok", dict });
        break;
      }
      case "uninstall": {
        await deleteDictionary(db, req.dictId);
        post({ id: req.id, type: "uninstall:ok" });
        break;
      }
      case "list": {
        const dicts = await listInstalled(db);
        post({ id: req.id, type: "list:ok", dicts });
        break;
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
  } catch (e) {
    post({
      id: req.id,
      type: "error",
      message: e instanceof Error ? e.message : String(e),
    });
  }
};
