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
      type: "install:start";
      target: InstallTargetMessage;
      totalBytes: number | null;
    }
  | {
      id: number;
      type: "install:chunk";
      chunk: ArrayBuffer;
      final: boolean;
    }
  | { id: number; type: "install:abort" }
  | { id: number; type: "uninstall"; dictId: DictionaryId }
  | { id: number; type: "list" };

export type InstallPhase =
  | "extracting"
  | "parsing"
  | "inserting"
  | "finishing";

export type WorkerProgress = {
  id: number;
  type: "progress";
  phase: InstallPhase;
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
