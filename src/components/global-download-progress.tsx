"use client";

import Link from "next/link";
import { useDownloadStatus } from "@/contexts/download-status";

function formatSpeed(bytesPerSec: number): string {
  if (bytesPerSec < 1024) return `${bytesPerSec} B/s`;
  if (bytesPerSec < 1024 * 1024)
    return `${(bytesPerSec / 1024).toFixed(0)} KB/s`;
  return `${(bytesPerSec / (1024 * 1024)).toFixed(1)} MB/s`;
}

function Spinner({ className }: { className?: string }) {
  return (
    <svg
      className={`animate-spin ${className ?? "h-3.5 w-3.5"}`}
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
  );
}

export function GlobalDownloadProgress() {
  const { active, bulk, importing, scanning } = useDownloadStatus();

  const singleDownload = active.find((d) => d.status === "downloading");
  const bulkDownload = bulk[0];
  const isDownloading = !!singleDownload || !!bulkDownload;

  // Priority: downloading > importing > scanning
  if (!isDownloading && !importing && !scanning) return null;

  if (isDownloading) {
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
        <div
          className="absolute inset-y-0 left-0 bg-accent-400/15 transition-all duration-700 ease-out"
          style={{ width: `${progress}%` }}
        />
        <div
          className="absolute bottom-0 left-0 h-0.5 bg-accent-400 transition-all duration-700 ease-out"
          style={{ width: `${progress}%` }}
        />
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

  // Importing or scanning state
  const label = importing ? "Importing volumes..." : "Scanning library...";
  const color = importing ? "text-blue-400" : "text-green-400";
  const bgColor = importing ? "bg-blue-400" : "bg-green-400";

  return (
    <Link
      href="/downloads"
      className="group relative block h-8 overflow-hidden bg-surface-800 border-b border-surface-600 transition-colors hover:bg-surface-750"
    >
      {/* Animated pulse bar */}
      <div
        className={`absolute inset-y-0 left-0 w-full ${bgColor}/5 animate-pulse`}
      />
      <div
        className={`absolute bottom-0 left-0 h-0.5 w-full ${bgColor}/40 animate-pulse`}
      />
      <div className="relative flex h-full items-center justify-between px-4 text-xs">
        <div className="flex items-center gap-2 min-w-0">
          <Spinner className={`h-3.5 w-3.5 shrink-0 ${color}`} />
          <span className={`font-medium ${color}`}>{label}</span>
        </div>
      </div>
    </Link>
  );
}
