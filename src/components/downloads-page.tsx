"use client";

import Link from "next/link";
import { useDownloadStatus } from "@/contexts/download-status";

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

export function DownloadsPage() {
  const { active, bulk, recent, importing, scanning } = useDownloadStatus();

  // Group single downloads by manga
  const grouped = new Map<
    number,
    {
      mangaTitle: string;
      mangaId: number;
      coverImage: string | null;
      volumes: typeof active;
    }
  >();
  for (const d of active) {
    if (!grouped.has(d.mangaId)) {
      grouped.set(d.mangaId, {
        mangaTitle: d.mangaTitle,
        mangaId: d.mangaId,
        coverImage: d.coverImage,
        volumes: [],
      });
    }
    grouped.get(d.mangaId)!.volumes.push(d);
  }

  const hasAnything =
    active.length > 0 ||
    bulk.length > 0 ||
    recent.length > 0 ||
    importing ||
    scanning;

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold">Downloads</h1>

      {/* Status banners */}
      {importing && (
        <div className="mb-4 flex items-center gap-3 rounded-lg border border-blue-500/30 bg-blue-500/10 px-4 py-3">
          <svg
            className="h-4 w-4 shrink-0 animate-spin text-blue-400"
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
          <span className="text-sm font-medium text-blue-300">
            Importing downloaded volumes...
          </span>
        </div>
      )}
      {scanning && (
        <div className="mb-4 flex items-center gap-3 rounded-lg border border-green-500/30 bg-green-500/10 px-4 py-3">
          <svg
            className="h-4 w-4 shrink-0 animate-spin text-green-400"
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
          <span className="text-sm font-medium text-green-300">
            Scanning library...
          </span>
        </div>
      )}

      {!hasAnything && (
        <div className="flex flex-col items-center justify-center rounded-lg border border-surface-600 bg-surface-700 py-16">
          <svg
            className="mb-4 h-12 w-12 text-surface-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.5}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
            />
          </svg>
          <p className="text-surface-300">No active downloads</p>
          <Link
            href="/manager"
            className="mt-3 rounded-md bg-accent-400 px-4 py-2 text-sm font-medium text-surface-900 transition-colors hover:bg-accent-300"
          >
            Go to Manager
          </Link>
        </div>
      )}

      {/* Bulk downloads */}
      {bulk.length > 0 && (
        <section className="mb-8">
          <h2 className="mb-3 text-sm font-medium uppercase tracking-wider text-surface-300">
            Bulk Downloads
          </h2>
          <div className="grid gap-3">
            {bulk.map((d) => (
              <Link
                key={`bulk-${d.mangaId}`}
                href={`/manager/${d.mangaId}`}
                className="flex items-center gap-4 rounded-lg border border-surface-600 bg-surface-700 p-4 transition-colors hover:bg-surface-650"
              >
                {d.coverImage && (
                  <img
                    src={d.coverImage}
                    alt=""
                    className="h-16 w-11 shrink-0 rounded object-cover"
                  />
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between">
                    <h3 className="truncate font-medium">{d.mangaTitle}</h3>
                    <span className="ml-2 shrink-0 rounded-full bg-blue-500/20 px-2 py-0.5 text-xs font-medium text-blue-400">
                      Bulk
                    </span>
                  </div>
                  <div className="mt-2 flex items-center gap-3">
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-surface-500">
                      <div
                        className="h-full rounded-full bg-accent-400 transition-all duration-700 ease-out"
                        style={{ width: `${d.progress}%` }}
                      />
                    </div>
                    <span className="shrink-0 text-sm font-medium text-surface-100">
                      {Math.round(d.progress)}%
                    </span>
                  </div>
                  {d.downloadSpeed > 0 && (
                    <p className="mt-1 text-xs text-surface-400">
                      {formatSpeed(d.downloadSpeed)}
                    </p>
                  )}
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Single volume downloads grouped by manga */}
      {grouped.size > 0 && (
        <section className="mb-8">
          <h2 className="mb-3 text-sm font-medium uppercase tracking-wider text-surface-300">
            Volume Downloads
          </h2>
          <div className="grid gap-3">
            {Array.from(grouped.values()).map((group) => (
              <Link
                key={group.mangaId}
                href={`/manager/${group.mangaId}`}
                className="rounded-lg border border-surface-600 bg-surface-700 p-4 transition-colors hover:bg-surface-650"
              >
                <div className="flex items-start gap-4">
                  {group.coverImage && (
                    <img
                      src={group.coverImage}
                      alt=""
                      className="h-16 w-11 shrink-0 rounded object-cover"
                    />
                  )}
                  <div className="min-w-0 flex-1">
                    <h3 className="truncate font-medium">{group.mangaTitle}</h3>
                    <div className="mt-2 space-y-2">
                      {group.volumes.map((vol) => (
                        <div key={vol.managedVolumeId}>
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-surface-200">
                              Volume {vol.volumeNumber}
                            </span>
                            <div className="flex items-center gap-2">
                              {vol.downloadSpeed > 0 && (
                                <span className="text-xs text-surface-400">
                                  {formatSpeed(vol.downloadSpeed)}
                                </span>
                              )}
                              <span className="text-xs font-medium text-surface-100">
                                {vol.status === "downloaded"
                                  ? "Importing..."
                                  : `${Math.round(vol.progress)}%`}
                              </span>
                            </div>
                          </div>
                          <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-surface-500">
                            <div
                              className="h-full rounded-full bg-accent-400 transition-all duration-700 ease-out"
                              style={{ width: `${vol.progress}%` }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Recently imported */}
      {recent.length > 0 && (
        <section>
          <h2 className="mb-3 text-sm font-medium uppercase tracking-wider text-surface-300">
            Recently Imported
          </h2>
          <div className="grid gap-2">
            {recent.map((d, i) => (
              <div
                key={`${d.mangaId}-${d.volumeNumber}-${i}`}
                className="flex items-center justify-between rounded-lg border border-surface-600 bg-surface-700 px-4 py-3"
              >
                <span className="truncate text-sm text-surface-200">
                  {d.mangaTitle}
                  <span className="mx-1.5 text-surface-400">·</span>
                  Vol {d.volumeNumber}
                </span>
                <span className="ml-2 shrink-0 rounded-full bg-accent-400/15 px-2 py-0.5 text-xs font-medium text-accent-300">
                  {timeAgo(d.completedAt)}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
