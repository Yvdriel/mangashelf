"use client";

import type {
  WorkerMessage,
  WorkerProgress,
  WorkerRequest,
  WorkerResponse,
  InstallTargetMessage,
} from "./protocol";
import type { InstalledDictionary, ScanResult } from "./types";

type DistributiveOmit<T, K extends PropertyKey> = T extends unknown
  ? Omit<T, K>
  : never;

interface PendingEntry<T> {
  resolve: (value: T) => void;
  reject: (err: Error) => void;
  onProgress?: (p: WorkerProgress) => void;
  signal?: AbortSignal;
  signalListener?: () => void;
}

export class DictClient {
  private worker: Worker | null = null;
  private nextId = 1;
  private pending = new Map<number, PendingEntry<unknown>>();

  private ensure(): Worker {
    if (this.worker) return this.worker;
    const w = new Worker(
      new URL("../../workers/dict-worker.ts", import.meta.url),
      { type: "module" },
    );
    w.onmessage = (ev: MessageEvent<WorkerMessage>) => {
      this.dispatch(ev.data);
    };
    w.onerror = (ev) => {
      const msg = ev.message || "Worker error";
      for (const [, p] of this.pending) p.reject(new Error(msg));
      this.pending.clear();
    };
    this.worker = w;
    return w;
  }

  private dispatch(msg: WorkerMessage): void {
    const entry = this.pending.get(msg.id);
    if (!entry) return;
    if (msg.type === "progress") {
      entry.onProgress?.(msg);
      return;
    }
    this.cleanup(msg.id, entry);
    if (msg.type === "error") {
      entry.reject(new Error(msg.message));
      return;
    }
    entry.resolve(extractResult(msg));
  }

  private cleanup(id: number, entry: PendingEntry<unknown>): void {
    if (entry.signal && entry.signalListener) {
      entry.signal.removeEventListener("abort", entry.signalListener);
    }
    this.pending.delete(id);
  }

  private send<T>(
    body: DistributiveOmit<WorkerRequest, "id">,
    opts: {
      signal?: AbortSignal;
      onProgress?: (p: WorkerProgress) => void;
      transfer?: Transferable[];
    } = {},
  ): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const id = this.nextId++;
      const w = this.ensure();
      const entry: PendingEntry<T> = {
        resolve,
        reject,
        onProgress: opts.onProgress,
        signal: opts.signal,
      };
      if (opts.signal) {
        if (opts.signal.aborted) {
          reject(new DOMException("Aborted", "AbortError"));
          return;
        }
        const listener = () => {
          const e = this.pending.get(id);
          if (!e) return;
          this.pending.delete(id);
          reject(new DOMException("Aborted", "AbortError"));
        };
        entry.signalListener = listener;
        opts.signal.addEventListener("abort", listener, { once: true });
      }
      this.pending.set(id, entry as PendingEntry<unknown>);
      const message = { id, ...body } as WorkerRequest;
      if (opts.transfer && opts.transfer.length > 0) {
        w.postMessage(message, opts.transfer);
      } else {
        w.postMessage(message);
      }
    });
  }

  scanText(text: string, signal?: AbortSignal): Promise<ScanResult[]> {
    return this.send<ScanResult[]>({ type: "scanText", text }, { signal });
  }

  lookup(
    text: string,
    position: number,
    signal?: AbortSignal,
  ): Promise<ScanResult | null> {
    return this.send<ScanResult | null>(
      { type: "lookup", text, position },
      { signal },
    );
  }

  list(): Promise<InstalledDictionary[]> {
    return this.send<InstalledDictionary[]>({ type: "list" });
  }

  install(
    target: InstallTargetMessage,
    zip: ArrayBuffer,
    onProgress?: (p: WorkerProgress) => void,
  ): Promise<InstalledDictionary> {
    return this.send<InstalledDictionary>(
      { type: "install", target, zip },
      { onProgress, transfer: [zip] },
    );
  }

  uninstall(dictId: string): Promise<void> {
    return this.send<void>({ type: "uninstall", dictId });
  }

  terminate(): void {
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }
    for (const [, p] of this.pending) {
      p.reject(new Error("Client terminated"));
    }
    this.pending.clear();
  }
}

function extractResult(msg: WorkerResponse): unknown {
  switch (msg.type) {
    case "lookup:ok":
      return msg.result;
    case "scanText:ok":
      return msg.results;
    case "install:ok":
      return msg.dict;
    case "uninstall:ok":
      return undefined;
    case "list:ok":
      return msg.dicts;
    case "error":
      throw new Error(msg.message);
  }
}

let singleton: DictClient | null = null;
export function getDictClient(): DictClient {
  if (typeof window === "undefined") {
    throw new Error("DictClient is browser-only");
  }
  if (!singleton) singleton = new DictClient();
  return singleton;
}
