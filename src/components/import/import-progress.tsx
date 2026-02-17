"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";

interface VolumeProgress {
  volumeNumber: number;
  status: "pending" | "importing" | "complete" | "failed";
  pagesImported?: number;
  error?: string;
}

interface ImportProgressProps {
  importId: string;
  onReset: () => void;
}

export function ImportProgress({ importId, onReset }: ImportProgressProps) {
  const [volumes, setVolumes] = useState<VolumeProgress[]>([]);
  const [currentVolume, setCurrentVolume] = useState(0);
  const [totalVolumes, setTotalVolumes] = useState(0);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [totalPages, setTotalPages] = useState(0);
  const [mangaId, setMangaId] = useState<number | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);

  useEffect(() => {
    const es = new EventSource(`/api/import/progress/${importId}`);
    eventSourceRef.current = es;

    es.addEventListener("volume_start", (e) => {
      const data = JSON.parse(e.data);
      setCurrentVolume(data.currentVolume);
      setTotalVolumes(data.totalVolumes);
      setVolumes((prev) => {
        // Update or add
        const existing = prev.find((v) => v.volumeNumber === data.volumeNumber);
        if (existing) {
          return prev.map((v) =>
            v.volumeNumber === data.volumeNumber
              ? { ...v, status: "importing" }
              : v,
          );
        }
        return [
          ...prev,
          { volumeNumber: data.volumeNumber, status: "importing" },
        ];
      });
    });

    es.addEventListener("volume_complete", (e) => {
      const data = JSON.parse(e.data);
      setVolumes((prev) =>
        prev.map((v) =>
          v.volumeNumber === data.volumeNumber
            ? {
                ...v,
                status: "complete",
                pagesImported: data.pagesImported,
              }
            : v,
        ),
      );
    });

    es.addEventListener("volume_failed", (e) => {
      const data = JSON.parse(e.data);
      setVolumes((prev) =>
        prev.map((v) =>
          v.volumeNumber === data.volumeNumber
            ? { ...v, status: "failed", error: data.error }
            : v,
        ),
      );
    });

    es.addEventListener("complete", (e) => {
      const data = JSON.parse(e.data);
      setDone(true);
      setTotalPages(data.totalPages);
      setMangaId(data.mangaId);
      es.close();
    });

    es.addEventListener("error", (e) => {
      if (e instanceof MessageEvent) {
        const data = JSON.parse(e.data);
        setError(data.error);
      }
      setDone(true);
      es.close();
    });

    es.onerror = () => {
      // SSE connection closed or errored
      if (!done) {
        setDone(true);
      }
      es.close();
    };

    return () => {
      es.close();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [importId]);

  const completedCount = volumes.filter((v) => v.status === "complete").length;
  const failedCount = volumes.filter((v) => v.status === "failed").length;
  const progress = totalVolumes > 0 ? (completedCount / totalVolumes) * 100 : 0;

  return (
    <div className="space-y-6">
      {/* Overall progress */}
      <div className="rounded-xl border border-surface-600 bg-surface-800 p-5 space-y-4">
        {!done ? (
          <>
            <div className="flex items-center justify-between">
              <h3 className="text-base font-medium text-surface-50">
                Importing...
              </h3>
              <span className="text-sm text-surface-200">
                Volume {currentVolume} of {totalVolumes}
              </span>
            </div>
            <div className="h-2 rounded-full bg-surface-600 overflow-hidden">
              <div
                className="h-full rounded-full bg-accent-400 transition-all duration-500"
                style={{ width: `${progress}%` }}
              />
            </div>
          </>
        ) : error ? (
          <div className="space-y-2">
            <h3 className="text-base font-medium text-red-400">
              Import Failed
            </h3>
            <p className="text-sm text-red-400/80">{error}</p>
          </div>
        ) : (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <svg
                className="h-5 w-5 text-green-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <h3 className="text-base font-medium text-surface-50">
                Import Complete
              </h3>
            </div>
            <p className="text-sm text-surface-200">
              {completedCount} volume{completedCount !== 1 ? "s" : ""} imported
              {totalPages > 0 && ` (${totalPages.toLocaleString()} pages)`}
              {failedCount > 0 && (
                <span className="text-yellow-400">, {failedCount} failed</span>
              )}
            </p>
          </div>
        )}
      </div>

      {/* Per-volume list */}
      {volumes.length > 0 && (
        <div className="rounded-xl border border-surface-600 bg-surface-800 overflow-hidden">
          <div className="divide-y divide-surface-700">
            {volumes.map((vol) => (
              <div
                key={vol.volumeNumber}
                className="flex items-center gap-3 px-4 py-3"
              >
                {/* Status icon */}
                {vol.status === "importing" ? (
                  <svg
                    className="h-4 w-4 animate-spin text-accent-300 shrink-0"
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
                ) : vol.status === "complete" ? (
                  <svg
                    className="h-4 w-4 text-green-400 shrink-0"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M4.5 12.75l6 6 9-13.5"
                    />
                  </svg>
                ) : vol.status === "failed" ? (
                  <svg
                    className="h-4 w-4 text-red-400 shrink-0"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                ) : (
                  <div className="h-4 w-4 rounded-full border border-surface-500 shrink-0" />
                )}

                <span className="text-sm font-medium text-surface-50">
                  Volume {vol.volumeNumber}
                </span>

                {vol.pagesImported !== undefined && (
                  <span className="text-xs text-surface-300">
                    {vol.pagesImported} pages
                  </span>
                )}

                {vol.error && (
                  <span className="text-xs text-red-400 truncate ml-auto">
                    {vol.error}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Action buttons */}
      {done && (
        <div className="flex items-center gap-3 justify-end">
          <button
            onClick={onReset}
            className="rounded-lg border border-surface-500 px-4 py-2.5 text-sm text-surface-200 transition-colors hover:bg-surface-700"
          >
            Import More
          </button>
          {mangaId && (
            <Link
              href={`/manga/${mangaId}`}
              className="rounded-lg bg-accent-400 px-6 py-2.5 text-sm font-medium text-surface-900 transition-colors hover:bg-accent-300"
            >
              View in Library
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
