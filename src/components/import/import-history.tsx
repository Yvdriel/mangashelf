"use client";

import { useState, useEffect } from "react";

interface HistoryVolume {
  id: number;
  volumeNumber: number;
  pageCount: number;
  sizeBytes: number;
  sourcePath: string;
  status: string;
  errorMessage: string | null;
}

interface HistoryEntry {
  id: number;
  mangaId: number | null;
  mangaTitle: string;
  sourceType: string;
  sourcePath: string;
  volumesImported: number;
  pagesImported: number;
  totalSizeBytes: number;
  mode: string;
  status: string;
  errorMessage: string | null;
  createdAt: string;
  volumes: HistoryVolume[];
}

function formatSize(bytes: number): string {
  if (bytes === 0) return "0 B";
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  if (bytes < 1024 * 1024 * 1024)
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function timeAgo(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 30) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

export function ImportHistory() {
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<Set<number>>(new Set());

  useEffect(() => {
    fetch("/api/import/history")
      .then((res) => res.json())
      .then(setHistory)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  function toggleExpand(id: number) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <svg
          className="h-5 w-5 animate-spin text-accent-300"
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          />
        </svg>
      </div>
    );
  }

  if (history.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-surface-300">
        No import history yet.
      </p>
    );
  }

  return (
    <div className="rounded-xl border border-surface-600 bg-surface-800 overflow-hidden">
      <div className="divide-y divide-surface-700">
        {history.map((entry) => (
          <div key={entry.id}>
            <button
              onClick={() => toggleExpand(entry.id)}
              className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-surface-700/50 transition-colors"
            >
              {/* Status indicator */}
              <div
                className={`h-2 w-2 rounded-full shrink-0 ${
                  entry.status === "completed"
                    ? "bg-green-400"
                    : entry.status === "partial"
                      ? "bg-yellow-400"
                      : "bg-red-400"
                }`}
              />

              {/* Title */}
              <span className="text-sm font-medium text-surface-50 truncate flex-1">
                {entry.mangaTitle}
              </span>

              {/* Source type badge */}
              <span
                className={`rounded px-1.5 py-0.5 text-[10px] font-medium shrink-0 ${
                  entry.sourceType === "automated"
                    ? "bg-blue-500/15 text-blue-400"
                    : entry.sourceType === "upload"
                      ? "bg-purple-500/15 text-purple-400"
                      : "bg-surface-600 text-surface-200"
                }`}
              >
                {entry.sourceType}
              </span>

              {/* Stats */}
              <span className="text-xs text-surface-300 shrink-0">
                {entry.volumesImported} vol
                {entry.volumesImported !== 1 ? "s" : ""}
              </span>
              <span className="text-xs text-surface-400 shrink-0">
                {formatSize(entry.totalSizeBytes)}
              </span>
              <span className="text-xs text-surface-400 shrink-0">
                {timeAgo(entry.createdAt)}
              </span>

              {/* Expand arrow */}
              <svg
                className={`h-4 w-4 text-surface-400 transition-transform shrink-0 ${
                  expanded.has(entry.id) ? "rotate-180" : ""
                }`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M19 9l-7 7-7-7"
                />
              </svg>
            </button>

            {/* Expanded detail */}
            {expanded.has(entry.id) && (
              <div className="border-t border-surface-700 bg-surface-800/50 px-4 py-3 space-y-2">
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-surface-300">
                  <span>Mode: {entry.mode}</span>
                  <span>Pages: {entry.pagesImported.toLocaleString()}</span>
                  <span className="truncate" title={entry.sourcePath}>
                    Source: {entry.sourcePath}
                  </span>
                </div>

                {entry.errorMessage && (
                  <p className="text-xs text-red-400">{entry.errorMessage}</p>
                )}

                {entry.volumes.length > 0 && (
                  <div className="mt-2 space-y-1">
                    {entry.volumes.map((vol) => (
                      <div
                        key={vol.id}
                        className="flex items-center gap-2 text-xs"
                      >
                        <span
                          className={`h-1.5 w-1.5 rounded-full ${
                            vol.status === "imported" ||
                            vol.status === "replaced"
                              ? "bg-green-400"
                              : vol.status === "skipped"
                                ? "bg-surface-400"
                                : "bg-red-400"
                          }`}
                        />
                        <span className="text-surface-200">
                          v{String(vol.volumeNumber).padStart(2, "0")}
                        </span>
                        <span className="text-surface-400">
                          {vol.pageCount} pages
                        </span>
                        <span className="text-surface-400">
                          {formatSize(vol.sizeBytes)}
                        </span>
                        <span
                          className={`${
                            vol.status === "failed"
                              ? "text-red-400"
                              : "text-surface-400"
                          }`}
                        >
                          {vol.status}
                        </span>
                        {vol.errorMessage && (
                          <span className="text-red-400 truncate">
                            {vol.errorMessage}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
