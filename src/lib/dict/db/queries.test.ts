import { afterEach, beforeEach, describe, expect, it } from "vitest";
import "fake-indexeddb/auto";
import { openDictDB } from "./idb";
import {
  bulkInsert,
  deleteDictionary,
  findKanji,
  findTermsBulk,
  putInstalled,
  listInstalled,
} from "./queries";
import type { TermRecord, KanjiRecord, InstalledDictionary } from "../types";

function deleteDB(name: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.deleteDatabase(name);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
    req.onblocked = () => resolve();
  });
}

describe("dict IDB queries", () => {
  let db: Awaited<ReturnType<typeof openDictDB>> | null = null;

  beforeEach(async () => {
    if (db) {
      db.close();
      db = null;
    }
    await deleteDB("mangashelf-dict");
  });
  afterEach(async () => {
    if (db) {
      db.close();
      db = null;
    }
    await deleteDB("mangashelf-dict");
  });

  it("findTermsBulk dedupes hits matching both expression and reading", async () => {
    db = await openDictDB();
    const rows: Array<Omit<TermRecord, "id" | "dict">> = [
      {
        expression: "食べる",
        reading: "たべる",
        expressionReverse: "るべ食",
        definitionTags: ["v1"],
        rules: ["v1"],
        score: 0,
        glossary: ["to eat"],
        sequence: 1,
        termTags: [],
      },
      {
        expression: "たべる",
        reading: "たべる",
        expressionReverse: "るべた",
        definitionTags: [],
        rules: ["v1"],
        score: 0,
        glossary: ["to eat (kana)"],
        sequence: 2,
        termTags: [],
      },
    ];
    await bulkInsert(db, "terms", rows, "test");
    const hits = await findTermsBulk(db, ["食べる", "たべる"]);
    expect(hits).toHaveLength(2);
    expect(new Set(hits.map((h) => h.expression))).toEqual(
      new Set(["食べる", "たべる"]),
    );
  });

  it("findKanji returns one row per character", async () => {
    db = await openDictDB();
    const rows: Array<Omit<KanjiRecord, "id" | "dict">> = [
      {
        character: "食",
        onyomi: ["ショク"],
        kunyomi: ["た.べる"],
        tags: [],
        meanings: ["food", "eat"],
        stats: {},
      },
    ];
    await bulkInsert(db, "kanji", rows, "k");
    const hits = await findKanji(db, ["食", "X"]);
    expect(hits).toHaveLength(1);
    expect(hits[0].character).toBe("食");
  });

  it("deleteDictionary removes terms and the dictionary row", async () => {
    db = await openDictDB();
    const dict: InstalledDictionary = {
      id: "test",
      title: "Test",
      revision: "1",
      kind: "terms",
      priority: 0,
      entryCount: 0,
      installedAt: 0,
    };
    await putInstalled(db, dict);
    await bulkInsert(
      db,
      "terms",
      [
        {
          expression: "x",
          reading: "x",
          expressionReverse: "x",
          definitionTags: [],
          rules: [],
          score: 0,
          glossary: ["x"],
          sequence: 0,
          termTags: [],
        },
      ],
      "test",
    );

    await deleteDictionary(db, "test");
    expect(await listInstalled(db)).toHaveLength(0);
    expect(await findTermsBulk(db, ["x"])).toHaveLength(0);
  });
});
