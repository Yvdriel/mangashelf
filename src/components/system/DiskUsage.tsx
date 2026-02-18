"use client";

import type { DiskInfo } from "./StatusPage";

interface DiskUsageProps {
  disk: {
    library: DiskInfo;
    database: { path: string; sizeBytes: number };
    staging: { path: string; activeSessions: number; totalSizeBytes: number };
    downloads?: { freeBytes: number };
  };
}

function formatBytes(bytes: number): string {
  if (bytes <= 0) return "0 B";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024)
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

function barColor(percent: number): string {
  if (percent >= 95) return "bg-red-500";
  if (percent >= 80) return "bg-yellow-500";
  return "bg-green-500";
}

interface DiskBarProps {
  label: string;
  path: string;
  usedBytes: number;
  totalBytes: number;
  percentUsed: number;
  freeBytes: number;
  sublabel?: string;
}

function DiskBar({
  label,
  path,
  usedBytes,
  totalBytes,
  percentUsed,
  freeBytes,
  sublabel,
}: DiskBarProps) {
  return (
    <div className="rounded-lg border border-surface-600 bg-surface-700 p-4">
      <div className="mb-1 flex items-baseline justify-between">
        <div>
          <span className="font-medium text-surface-50">{label}</span>
          {sublabel && (
            <span className="ml-2 text-xs text-surface-300">{sublabel}</span>
          )}
        </div>
        <span className="text-sm text-surface-200">
          {formatBytes(freeBytes)} free
        </span>
      </div>
      <p className="mb-2 text-xs text-surface-300 truncate">{path}</p>
      {totalBytes > 0 ? (
        <>
          <div className="mb-1.5 h-2 overflow-hidden rounded-full bg-surface-500">
            <div
              className={`h-full rounded-full transition-all ${barColor(percentUsed)}`}
              style={{ width: `${Math.min(percentUsed, 100)}%` }}
            />
          </div>
          <div className="flex justify-between text-xs text-surface-300">
            <span>
              {formatBytes(usedBytes)} / {formatBytes(totalBytes)}
            </span>
            <span>{percentUsed.toFixed(1)}%</span>
          </div>
        </>
      ) : (
        <p className="text-xs text-surface-300">Partition info unavailable</p>
      )}
    </div>
  );
}

export function DiskUsage({ disk }: DiskUsageProps) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {/* Library partition */}
      <DiskBar
        label="Manga Library"
        path={disk.library.path}
        usedBytes={disk.library.usedBytes}
        totalBytes={disk.library.totalBytes}
        percentUsed={disk.library.percentUsed}
        freeBytes={disk.library.freeBytes}
        sublabel={`${formatBytes(disk.library.libraryBytes)} manga`}
      />

      {/* Database + Staging combined card */}
      <div className="space-y-3 rounded-lg border border-surface-600 bg-surface-700 p-4">
        <div>
          <div className="flex items-baseline justify-between">
            <span className="font-medium text-surface-50">Database</span>
            <span className="text-sm text-surface-200">
              {formatBytes(disk.database.sizeBytes)}
            </span>
          </div>
          <p className="text-xs text-surface-300 truncate">
            {disk.database.path}
          </p>
        </div>

        <div className="border-t border-surface-600 pt-3">
          <div className="flex items-baseline justify-between">
            <span className="font-medium text-surface-50">Staging</span>
            <span className="text-sm text-surface-200">
              {disk.staging.activeSessions > 0
                ? `${disk.staging.activeSessions} session${disk.staging.activeSessions !== 1 ? "s" : ""} (${formatBytes(disk.staging.totalSizeBytes)})`
                : "Empty"}
            </span>
          </div>
          <p className="text-xs text-surface-300 truncate">
            {disk.staging.path}
          </p>
        </div>

        {disk.downloads && (
          <div className="border-t border-surface-600 pt-3">
            <div className="flex items-baseline justify-between">
              <span className="font-medium text-surface-50">Downloads</span>
              <span className="text-sm text-surface-200">
                {formatBytes(disk.downloads.freeBytes)} free
              </span>
            </div>
            <p className="text-xs text-surface-300">via Deluge</p>
          </div>
        )}
      </div>
    </div>
  );
}
