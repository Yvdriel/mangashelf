"use client";

import Link from "next/link";
import { useDownloadStatus } from "@/contexts/download-status";

function formatSpeed(bytesPerSec: number): string {
  if (bytesPerSec < 1024) return `${bytesPerSec} B/s`;
  if (bytesPerSec < 1024 * 1024)
    return `${(bytesPerSec / 1024).toFixed(0)} KB/s`;
  return `${(bytesPerSec / (1024 * 1024)).toFixed(1)} MB/s`;
}

export function GlobalDownloadProgress() {
  const { active, bulk } = useDownloadStatus();

  // Pick the first active download to display (single volumes first, then bulk)
  const singleDownload = active.find((d) => d.status === "downloading");
  const bulkDownload = bulk[0];

  if (!singleDownload && !bulkDownload) return null;

  const title = singleDownload?.mangaTitle ?? bulkDownload?.mangaTitle ?? "";
  const label = singleDownload
    ? `Vol ${singleDownload.volumeNumber}`
    : "Bulk Download";
  const progress = singleDownload?.progress ?? bulkDownload?.progress ?? 0;
  const speed =
    singleDownload?.downloadSpeed ?? bulkDownload?.downloadSpeed ?? 0;

  return (
    <Link
      href="/downloads"
      className="group relative block h-8 overflow-hidden bg-surface-800 border-b border-surface-600 transition-colors hover:bg-surface-750"
    >
      {/* Progress fill */}
      <div
        className="absolute inset-y-0 left-0 bg-accent-400/15 transition-all duration-700 ease-out"
        style={{ width: `${progress}%` }}
      />
      <div
        className="absolute bottom-0 left-0 h-0.5 bg-accent-400 transition-all duration-700 ease-out"
        style={{ width: `${progress}%` }}
      />

      {/* Content */}
      <div className="relative flex h-full items-center justify-between px-4 text-xs">
        <div className="flex items-center gap-2 min-w-0">
          <svg
            className="h-3.5 w-3.5 shrink-0 text-accent-300"
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
          <span className="truncate text-surface-200">
            <span className="font-medium text-surface-50">{title}</span>
            <span className="mx-1.5 text-surface-400">·</span>
            <span className="text-surface-300">{label}</span>
          </span>
        </div>
        <div className="flex items-center gap-3 shrink-0 text-surface-300">
          {speed > 0 && <span>{formatSpeed(speed)}</span>}
          <span className="font-medium text-surface-100">
            {Math.round(progress)}%
          </span>
        </div>
      </div>
    </Link>
  );
}
