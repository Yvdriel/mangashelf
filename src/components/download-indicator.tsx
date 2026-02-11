"use client";

import { useState, useEffect, useRef } from "react";
import { useDownloadStatus } from "@/contexts/download-status";
import Link from "next/link";

function formatSpeed(bytesPerSec: number): string {
  if (bytesPerSec < 1024) return `${bytesPerSec} B/s`;
  if (bytesPerSec < 1024 * 1024)
    return `${(bytesPerSec / 1024).toFixed(0)} KB/s`;
  return `${(bytesPerSec / (1024 * 1024)).toFixed(1)} MB/s`;
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  return `${Math.floor(mins / 60)}h ago`;
}

export function DownloadIndicator() {
  const { active, bulk, recent, importing, scanning, summary } =
    useDownloadStatus();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close on click outside
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open]);

  const totalActive = summary.activeCount + (summary.bulkCount || 0);
  const hasActivity =
    totalActive > 0 || importing || scanning || summary.recentCount > 0;
  if (!hasActivity) return null;

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="relative flex items-center gap-1.5 rounded-md px-2 py-1.5 text-sm text-surface-200 transition-colors hover:text-surface-50"
      >
        <svg
          className="h-4 w-4"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
          />
        </svg>
        {totalActive > 0 && (
          <>
            <span className="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-accent-400 text-[10px] font-bold text-surface-900">
              {totalActive}
            </span>
            <span className="absolute -top-0.5 -right-0.5 h-4 w-4 animate-ping rounded-full bg-accent-400 opacity-40" />
          </>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-[calc(100vw-2rem)] sm:w-80 max-w-80 overflow-hidden rounded-lg border border-surface-600 bg-surface-700 shadow-xl animate-in fade-in slide-in-from-top-2 duration-150">
          {/* Active downloads */}
          {(active.length > 0 || bulk.length > 0) && (
            <div className="p-3">
              <h3 className="mb-2 text-xs font-medium uppercase tracking-wider text-surface-300">
                Downloading
              </h3>
              <div className="space-y-2.5">
                {bulk.map((d) => (
                  <div key={`bulk-${d.mangaId}`}>
                    <div className="flex items-center justify-between text-sm">
                      <span className="truncate font-medium">
                        {d.mangaTitle}
                      </span>
                      <span className="ml-2 shrink-0 rounded-full bg-blue-500/20 px-1.5 py-0.5 text-[10px] font-medium text-blue-400">
                        Bulk
                      </span>
                    </div>
                    <div className="mt-1 flex items-center gap-2">
                      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-500">
                        <div
                          className="h-full rounded-full bg-accent-400 transition-all duration-500"
                          style={{ width: `${d.progress}%` }}
                        />
                      </div>
                      <span className="shrink-0 text-xs text-surface-300">
                        {Math.round(d.progress)}%
                      </span>
                    </div>
                    {d.downloadSpeed > 0 && (
                      <p className="mt-0.5 text-[11px] text-surface-400">
                        {formatSpeed(d.downloadSpeed)}
                      </p>
                    )}
                  </div>
                ))}
                {active.map((d) => (
                  <div key={d.managedVolumeId}>
                    <div className="flex items-center justify-between text-sm">
                      <span className="truncate font-medium">
                        {d.mangaTitle}
                      </span>
                      <span className="ml-2 shrink-0 text-xs text-surface-300">
                        Vol {d.volumeNumber}
                      </span>
                    </div>
                    <div className="mt-1 flex items-center gap-2">
                      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-500">
                        <div
                          className="h-full rounded-full bg-accent-400 transition-all duration-500"
                          style={{ width: `${d.progress}%` }}
                        />
                      </div>
                      <span className="shrink-0 text-xs text-surface-300">
                        {Math.round(d.progress)}%
                      </span>
                    </div>
                    {d.downloadSpeed > 0 && (
                      <p className="mt-0.5 text-[11px] text-surface-400">
                        {formatSpeed(d.downloadSpeed)}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Import / scan status */}
          {(importing || scanning) && (
            <div
              className={`p-3 ${active.length > 0 || bulk.length > 0 ? "border-t border-surface-600" : ""}`}
            >
              <div className="flex items-center gap-2 text-sm">
                <svg
                  className={`h-3.5 w-3.5 shrink-0 animate-spin ${importing ? "text-blue-400" : "text-green-400"}`}
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
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                  />
                </svg>
                <span
                  className={`text-xs font-medium ${importing ? "text-blue-300" : "text-green-300"}`}
                >
                  {importing ? "Importing volumes..." : "Scanning library..."}
                </span>
              </div>
            </div>
          )}

          {/* Recent completions */}
          {recent.length > 0 && (
            <div
              className={`p-3 ${active.length > 0 || bulk.length > 0 || importing || scanning ? "border-t border-surface-600" : ""}`}
            >
              <h3 className="mb-2 text-xs font-medium uppercase tracking-wider text-surface-300">
                Recently Imported
              </h3>
              <div className="space-y-1.5">
                {recent.slice(0, 5).map((d, i) => (
                  <div
                    key={`${d.mangaId}-${d.volumeNumber}-${i}`}
                    className="flex items-center justify-between text-sm"
                  >
                    <span className="truncate text-surface-200">
                      {d.mangaTitle} · Vol {d.volumeNumber}
                    </span>
                    <span className="ml-2 shrink-0 rounded-full bg-accent-400/15 px-1.5 py-0.5 text-[10px] font-medium text-accent-300">
                      {timeAgo(d.completedAt)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Footer */}
          <div className="border-t border-surface-600 p-2">
            <Link
              href="/downloads"
              onClick={() => setOpen(false)}
              className="block rounded-md px-3 py-1.5 text-center text-xs font-medium text-surface-300 transition-colors hover:bg-surface-600 hover:text-surface-100"
            >
              View all downloads
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
