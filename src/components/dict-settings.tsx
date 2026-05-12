"use client";

import { useCallback, useEffect, useState } from "react";
import { CATALOG, type CatalogEntry } from "@/lib/dict/catalog";
import { getDictClient } from "@/lib/dict/client";
import type { InstalledDictionary } from "@/lib/dict/types";

type WorkPhase = "extracting" | "parsing" | "inserting" | "finishing";

type WorkingState = {
  kind: "working";
  download: { sent: number; total: number | null };
  work: { phase: WorkPhase; detail: string | null } | null;
};

type RowState =
  | { kind: "idle" }
  | WorkingState
  | { kind: "uninstalling" }
  | { kind: "error"; message: string };

export function DictSettings() {
  const [installed, setInstalled] = useState<InstalledDictionary[] | null>(null);
  const [rowState, setRowState] = useState<Record<string, RowState>>({});

  const refresh = useCallback(async () => {
    try {
      const list = await getDictClient().list();
      setInstalled(list);
    } catch (e) {
      setInstalled([]);
      console.error("DictSettings list failed:", e);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const setRow = useCallback((id: string, s: RowState) => {
    setRowState((prev) => ({ ...prev, [id]: s }));
  }, []);

  const updateWorking = useCallback(
    (id: string, patch: (w: WorkingState) => WorkingState) => {
      setRowState((prev) => {
        const cur = prev[id];
        if (!cur || cur.kind !== "working") return prev;
        return { ...prev, [id]: patch(cur) };
      });
    },
    [],
  );

  const handleInstall = useCallback(
    async (entry: CatalogEntry) => {
      setRow(entry.id, {
        kind: "working",
        download: { sent: 0, total: null },
        work: null,
      });
      try {
        const res = await fetch("/api/dict/install", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: entry.id }),
        });
        if (!res.ok) {
          const data = (await res.json().catch(() => ({}))) as {
            error?: string;
          };
          throw new Error(data.error || `Install failed (${res.status})`);
        }
        await getDictClient().install(
          {
            id: entry.id,
            title: entry.title,
            kind: entry.kind,
            priority: entry.priority,
          },
          res,
          (ev) => {
            if (ev.kind === "download") {
              updateWorking(entry.id, (w) => ({
                ...w,
                download: { sent: ev.sent, total: ev.total },
              }));
            } else {
              updateWorking(entry.id, (w) => ({
                ...w,
                work: { phase: ev.phase, detail: ev.detail },
              }));
            }
          },
        );
        setRow(entry.id, { kind: "idle" });
        await refresh();
      } catch (e) {
        setRow(entry.id, {
          kind: "error",
          message: e instanceof Error ? e.message : String(e),
        });
      }
    },
    [refresh, setRow, updateWorking],
  );

  const handleUninstall = useCallback(
    async (entry: CatalogEntry) => {
      if (!confirm(`Remove ${entry.title}?`)) return;
      setRow(entry.id, { kind: "uninstalling" });
      try {
        await getDictClient().uninstall(entry.id);
        setRow(entry.id, { kind: "idle" });
        await refresh();
      } catch (e) {
        setRow(entry.id, {
          kind: "error",
          message: e instanceof Error ? e.message : String(e),
        });
      }
    },
    [refresh, setRow],
  );

  const installedById = new Map((installed ?? []).map((d) => [d.id, d]));

  return (
    <section className="rounded-lg border border-surface-600 bg-surface-800 p-6">
      <h2 className="text-base font-semibold mb-2">Dictionaries</h2>
      <p className="text-xs text-surface-300 mb-4">
        Yomitan-format dictionaries indexed locally in your browser. Data lives
        in IndexedDB on this device.
      </p>
      <ul className="space-y-3">
        {CATALOG.map((entry) => {
          const inst = installedById.get(entry.id);
          const state = rowState[entry.id] ?? { kind: "idle" };
          return (
            <li
              key={entry.id}
              className="rounded-lg border border-surface-600 bg-surface-700/40 px-4 py-3"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-baseline gap-2">
                    <h3 className="text-sm font-medium text-surface-50">
                      {entry.title}
                    </h3>
                    <span className="text-[10px] uppercase tracking-wide text-surface-400">
                      {entry.kind}
                    </span>
                    {inst && (
                      <span className="rounded-full bg-green-500/15 px-2 py-0.5 text-[10px] font-medium text-green-400">
                        Installed{inst.revision ? ` · ${inst.revision}` : ""}
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-xs text-surface-300">
                    {entry.description}
                  </p>
                  <p className="mt-1 text-[10px] text-surface-400">
                    License: {entry.license} ·{" "}
                    <a
                      href={entry.homepage}
                      target="_blank"
                      rel="noreferrer"
                      className="underline hover:text-surface-200"
                    >
                      Source
                    </a>
                  </p>
                </div>
                <div className="shrink-0 flex flex-col items-end gap-1">
                  {state.kind === "idle" && !inst && (
                    <button
                      type="button"
                      onClick={() => handleInstall(entry)}
                      className="rounded-md bg-accent-400 px-3 py-1.5 text-xs font-medium text-surface-900 hover:bg-accent-300"
                    >
                      Install
                    </button>
                  )}
                  {state.kind === "idle" && inst && (
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => handleInstall(entry)}
                        className="rounded-md border border-surface-500 px-3 py-1.5 text-xs text-surface-100 hover:bg-surface-700"
                      >
                        Update
                      </button>
                      <button
                        type="button"
                        onClick={() => handleUninstall(entry)}
                        className="rounded-md border border-red-500/40 px-3 py-1.5 text-xs text-red-300 hover:bg-red-500/10"
                      >
                        Remove
                      </button>
                    </div>
                  )}
                  {state.kind === "working" && (
                    <WorkProgress
                      download={state.download}
                      work={state.work}
                    />
                  )}
                  {state.kind === "uninstalling" && (
                    <span className="text-xs text-surface-300">Removing…</span>
                  )}
                  {state.kind === "error" && (
                    <div className="flex flex-col items-end gap-1">
                      <p className="max-w-[18rem] text-right text-xs text-red-400">
                        {state.message}
                      </p>
                      <button
                        type="button"
                        onClick={() => setRow(entry.id, { kind: "idle" })}
                        className="text-[10px] text-surface-300 underline hover:text-surface-100"
                      >
                        Dismiss
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

const PHASE_LABEL: Record<WorkPhase, string> = {
  extracting: "Extracting",
  parsing: "Parsing",
  inserting: "Indexing",
  finishing: "Finishing",
};

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

function WorkProgress({
  download,
  work,
}: {
  download: { sent: number; total: number | null };
  work: { phase: WorkPhase; detail: string | null } | null;
}) {
  const { sent, total } = download;
  const pct =
    total !== null && total > 0 ? Math.min(100, (sent / total) * 100) : null;
  const complete = total !== null && sent >= total && total > 0;
  const downloadLabel = complete
    ? `Downloaded ${formatBytes(total)}`
    : total !== null && total > 0
      ? `Downloading ${pct?.toFixed(0)}%`
      : `Downloading…`;
  const bytesLine =
    total !== null && total > 0
      ? `${formatBytes(sent)} / ${formatBytes(total)}`
      : `${formatBytes(sent)} received`;

  return (
    <div className="text-right w-72">
      <p className="text-xs text-surface-200">{downloadLabel}</p>
      <div
        className="mt-1 h-1 w-full overflow-hidden rounded-full bg-surface-600"
        aria-hidden="true"
      >
        <div
          className={`h-full bg-accent-400 transition-[width] duration-200 ${
            pct === null ? "animate-pulse w-1/3" : ""
          }`}
          style={pct === null ? undefined : { width: `${pct}%` }}
        />
      </div>
      <p className="mt-0.5 text-[10px] text-surface-300 tabular-nums">
        {bytesLine}
      </p>
      {work && (
        <div className="mt-2 border-t border-surface-600/60 pt-2">
          <p className="text-[11px] font-medium text-surface-100">
            {PHASE_LABEL[work.phase]}
          </p>
          <div
            className="mt-1 h-0.5 w-full overflow-hidden rounded-full bg-surface-600"
            aria-hidden="true"
          >
            <div className="h-full w-1/3 animate-pulse bg-accent-300" />
          </div>
          {work.detail && (
            <p className="mt-1 text-[10px] text-surface-400 break-words leading-tight">
              {work.detail}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
