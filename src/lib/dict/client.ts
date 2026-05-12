"use client";

import type {
  InstallPhase,
  InstallTargetMessage,
  WorkerMessage,
  WorkerProgress,
  WorkerRequest,
  WorkerResponse,
} from "./protocol";
import type { InstalledDictionary, ScanResult } from "./types";

type DistributiveOmit<T, K extends PropertyKey> = T extends unknown
  ? Omit<T, K>
  : never;

export type InstallEvent =
  | { kind: "download"; sent: number; total: number | null }
  | { kind: "work"; phase: InstallPhase; detail: string | null };

interface PendingEntry<T> {
  resolve: (value: T) => void;
  reject: (err: Error) => void;
  onProgress?: (p: WorkerProgress) => void;
  signal?: AbortSignal;
  signalListener?: () => void;
}

// Subdivide reader chunks before postMessage so the worker's `unzip.push`
// increments are small — keeps `onfile` callbacks firing promptly during a
// single fetch chunk (Next/Docker may buffer the whole zip into one read).
const INSTALL_PIECE_SIZE = 256 * 1024;
// Yield to the event loop after this many pieces, so React renders the
// growing download bar. No backpressure — worker queues pieces and processes
// at its own pace.
const PIECES_PER_YIELD = 8;

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
    response: Response,
    onEvent?: (e: InstallEvent) => void,
    signal?: AbortSignal,
  ): Promise<InstalledDictionary> {
    return new Promise<InstalledDictionary>((resolve, reject) => {
      const id = this.nextId++;
      const w = this.ensure();

      let totalSent = 0;

      const entry: PendingEntry<InstalledDictionary> = {
        resolve,
        reject,
        onProgress: (p) => {
          onEvent?.({
            kind: "work",
            phase: p.phase,
            detail: p.detail ?? null,
          });
        },
        signal,
      };

      const abortFn = () => {
        try {
          w.postMessage({ id, type: "install:abort" } satisfies WorkerRequest);
        } catch {
          // worker may already be gone
        }
        const e = this.pending.get(id);
        if (e) this.pending.delete(id);
        reject(new DOMException("Aborted", "AbortError"));
      };

      if (signal) {
        if (signal.aborted) {
          reject(new DOMException("Aborted", "AbortError"));
          return;
        }
        entry.signalListener = abortFn;
        signal.addEventListener("abort", abortFn, { once: true });
      }

      this.pending.set(id, entry as PendingEntry<unknown>);

      const totalHeader = response.headers.get("content-length");
      const totalBytes = totalHeader ? Number(totalHeader) : null;
      w.postMessage({
        id,
        type: "install:start",
        target,
        totalBytes,
      } satisfies WorkerRequest);

      onEvent?.({ kind: "download", sent: 0, total: totalBytes });

      const body = response.body;
      if (!body) {
        reject(new Error("No response body"));
        return;
      }

      void (async () => {
        const reader = body.getReader();
        let piecesSinceYield = 0;
        try {
          while (true) {
            if (signal?.aborted) return;
            const { value, done } = await reader.read();
            if (done) {
              const empty = new ArrayBuffer(0);
              w.postMessage(
                {
                  id,
                  type: "install:chunk",
                  chunk: empty,
                  final: true,
                } satisfies WorkerRequest,
                [empty],
              );
              return;
            }
            if (!value || value.byteLength === 0) continue;
            for (
              let off = 0;
              off < value.byteLength;
              off += INSTALL_PIECE_SIZE
            ) {
              if (signal?.aborted) return;
              const end = Math.min(
                off + INSTALL_PIECE_SIZE,
                value.byteLength,
              );
              const piece = value.subarray(off, end);
              const ab = piece.slice().buffer;
              totalSent += ab.byteLength;
              w.postMessage(
                {
                  id,
                  type: "install:chunk",
                  chunk: ab,
                  final: false,
                } satisfies WorkerRequest,
                [ab],
              );
              onEvent?.({
                kind: "download",
                sent: totalSent,
                total: totalBytes,
              });
              piecesSinceYield++;
              if (piecesSinceYield >= PIECES_PER_YIELD) {
                piecesSinceYield = 0;
                await new Promise<void>((r) => setTimeout(r, 0));
              }
            }
          }
        } catch (e) {
          const pending = this.pending.get(id);
          if (pending) {
            this.pending.delete(id);
            pending.reject(e instanceof Error ? e : new Error(String(e)));
          }
        }
      })();
    });
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
