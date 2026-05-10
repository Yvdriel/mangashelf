import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import type {
  FrequencyRecord,
  InstalledDictionary,
  KanjiMetaRecord,
  KanjiRecord,
  TermMetaRecord,
  TermRecord,
} from "../types";

export interface DictDB extends DBSchema {
  dictionaries: {
    key: string;
    value: InstalledDictionary;
  };
  terms: {
    key: number;
    value: TermRecord;
    indexes: {
      expression: string;
      reading: string;
      "dict-expression": [string, string];
      "dict-reading": [string, string];
    };
  };
  termMeta: {
    key: number;
    value: TermMetaRecord;
    indexes: {
      expression: string;
      "dict-expression": [string, string];
    };
  };
  kanji: {
    key: number;
    value: KanjiRecord;
    indexes: {
      character: string;
      "dict-character": [string, string];
    };
  };
  kanjiMeta: {
    key: number;
    value: KanjiMetaRecord;
    indexes: {
      character: string;
    };
  };
  frequency: {
    key: number;
    value: FrequencyRecord;
    indexes: {
      expression: string;
      "dict-expression": [string, string];
    };
  };
}

const DB_NAME = "mangashelf-dict";
const DB_VERSION = 1;

export function openDictDB(): Promise<IDBPDatabase<DictDB>> {
  return openDB<DictDB>(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains("dictionaries")) {
        db.createObjectStore("dictionaries", { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains("terms")) {
        const s = db.createObjectStore("terms", {
          keyPath: "id",
          autoIncrement: true,
        });
        s.createIndex("expression", "expression");
        s.createIndex("reading", "reading");
        s.createIndex("dict-expression", ["dict", "expression"]);
        s.createIndex("dict-reading", ["dict", "reading"]);
      }
      if (!db.objectStoreNames.contains("termMeta")) {
        const s = db.createObjectStore("termMeta", {
          keyPath: "id",
          autoIncrement: true,
        });
        s.createIndex("expression", "expression");
        s.createIndex("dict-expression", ["dict", "expression"]);
      }
      if (!db.objectStoreNames.contains("kanji")) {
        const s = db.createObjectStore("kanji", {
          keyPath: "id",
          autoIncrement: true,
        });
        s.createIndex("character", "character");
        s.createIndex("dict-character", ["dict", "character"]);
      }
      if (!db.objectStoreNames.contains("kanjiMeta")) {
        const s = db.createObjectStore("kanjiMeta", {
          keyPath: "id",
          autoIncrement: true,
        });
        s.createIndex("character", "character");
      }
      if (!db.objectStoreNames.contains("frequency")) {
        const s = db.createObjectStore("frequency", {
          keyPath: "id",
          autoIncrement: true,
        });
        s.createIndex("expression", "expression");
        s.createIndex("dict-expression", ["dict", "expression"]);
      }
    },
  });
}
