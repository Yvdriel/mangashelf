import type {
  DictionaryId,
  DictionaryKind,
  InstalledDictionary,
  ScanResult,
} from "./types";

export interface InstallTargetMessage {
  id: DictionaryId;
  title: string;
  kind: DictionaryKind;
  priority: number;
}

export type WorkerRequest =
  | { id: number; type: "lookup"; text: string; position: number }
  | { id: number; type: "scanText"; text: string }
  | {
      id: number;
      type: "install";
      target: InstallTargetMessage;
      zip: ArrayBuffer;
    }
  | { id: number; type: "uninstall"; dictId: DictionaryId }
  | { id: number; type: "list" };

export type InstallPhase =
  | "scanning"
  | "parsing"
  | "inserting"
  | "finishing";

export type WorkerProgress = {
  id: number;
  type: "progress";
  done: number;
  total: number;
  phase?: InstallPhase;
  detail?: string;
};

export type WorkerResponse =
  | { id: number; type: "lookup:ok"; result: ScanResult | null }
  | { id: number; type: "scanText:ok"; results: ScanResult[] }
  | { id: number; type: "install:ok"; dict: InstalledDictionary }
  | { id: number; type: "uninstall:ok" }
  | { id: number; type: "list:ok"; dicts: InstalledDictionary[] }
  | { id: number; type: "error"; message: string };

export type WorkerMessage = WorkerResponse | WorkerProgress;
