"use client";

import { useState } from "react";

interface TorrentResult {
  title: string;
  size: number;
  seeders: number;
  leechers: number;
  publishDate: string;
  magnetLink: string | null;
  downloadLink: string | null;
  indexer: string;
}

function formatSize(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
}

function formatAge(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const days = Math.floor(
    (now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24),
  );
  if (days === 0) return "Today";
  if (days === 1) return "1 day ago";
  if (days < 30) return `${days} days ago`;
  if (days < 365) return `${Math.floor(days / 30)} months ago`;
  return `${Math.floor(days / 365)} years ago`;
}

type SortField = "seeders" | "size" | "date";

export function SearchModal({
  mangaId,
  volumeNumber,
  onClose,
}: {
  mangaId: number;
  volumeNumber?: number;
  onClose: () => void;
}) {
  const [results, setResults] = useState<TorrentResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<SortField>("seeders");
  const [downloadingIdx, setDownloadingIdx] = useState<number | null>(null);
  const [downloadedIdxs, setDownloadedIdxs] = useState<Set<number>>(new Set());

  // Fetch on mount
  useState(() => {
    (async () => {
      try {
        const res = await fetch(`/api/manager/manga/${mangaId}/search`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ volumeNumber }),
        });
        if (res.ok) {
          setResults(await res.json());
        } else {
          const data = await res.json().catch(() => ({}));
          setError(data.error || `Search failed (${res.status})`);
        }
      } catch (e) {
        setError(
          `Network error: ${e instanceof Error ? e.message : "unknown"}`,
        );
      } finally {
        setLoading(false);
      }
    })();
  });

  const sortedResults = [...results].sort((a, b) => {
    if (sortBy === "seeders") return b.seeders - a.seeders;
    if (sortBy === "size") return b.size - a.size;
    return (
      new Date(b.publishDate).getTime() - new Date(a.publishDate).getTime()
    );
  });

  const handleDownload = async (result: TorrentResult, idx: number) => {
    if (!result.magnetLink) return;
    setDownloadingIdx(idx);
    try {
      const res = await fetch(`/api/manager/manga/${mangaId}/download`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          magnetLink: result.magnetLink,
          volumeNumber,
        }),
      });
      if (res.ok) {
        setDownloadedIdxs((prev) => new Set([...prev, idx]));
      }
    } catch {
      // silently fail
    } finally {
      setDownloadingIdx(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 pt-[10vh]">
      <div className="mx-4 max-h-[80vh] w-full max-w-3xl overflow-hidden rounded-xl border border-surface-600 bg-surface-800 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-surface-600 px-5 py-4">
          <h3 className="text-sm font-semibold">
            Search Results
            {volumeNumber != null && ` — Volume ${volumeNumber}`}
          </h3>
          <button
            onClick={onClose}
            className="rounded-md p-1 text-surface-300 hover:bg-surface-700 hover:text-surface-50"
          >
            <svg
              className="h-5 w-5"
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
          </button>
        </div>

        {/* Sort controls */}
        <div className="flex gap-2 border-b border-surface-700 px-5 py-2">
          {(["seeders", "size", "date"] as SortField[]).map((field) => (
            <button
              key={field}
              onClick={() => setSortBy(field)}
              className={`rounded-md px-2 py-1 text-xs font-medium transition-colors ${
                sortBy === field
                  ? "bg-surface-600 text-accent-300"
                  : "text-surface-300 hover:text-surface-50"
              }`}
            >
              {field.charAt(0).toUpperCase() + field.slice(1)}
            </button>
          ))}
        </div>

        {/* Results */}
        <div className="max-h-[60vh] overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-surface-300 border-t-accent-400" />
            </div>
          ) : error ? (
            <p className="py-12 text-center text-sm text-red-400">{error}</p>
          ) : sortedResults.length === 0 ? (
            <p className="py-12 text-center text-sm text-surface-300">
              No results found
            </p>
          ) : (
            <div className="divide-y divide-surface-700">
              {sortedResults.map((result, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between gap-4 px-5 py-3"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm" title={result.title}>
                      {result.title}
                    </p>
                    <div className="mt-1 flex items-center gap-3 text-xs text-surface-300">
                      <span>{formatSize(result.size)}</span>
                      <span className="text-green-400">{result.seeders} S</span>
                      <span className="text-red-400">{result.leechers} L</span>
                      <span>{formatAge(result.publishDate)}</span>
                      <span className="text-surface-400">{result.indexer}</span>
                    </div>
                  </div>
                  <button
                    onClick={() => handleDownload(result, idx)}
                    disabled={
                      !result.magnetLink ||
                      downloadingIdx === idx ||
                      downloadedIdxs.has(idx)
                    }
                    className={`shrink-0 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                      downloadedIdxs.has(idx)
                        ? "bg-surface-600 text-surface-300"
                        : "bg-accent-400 text-surface-900 hover:bg-accent-300 disabled:opacity-50"
                    }`}
                  >
                    {downloadingIdx === idx
                      ? "Sending..."
                      : downloadedIdxs.has(idx)
                        ? "Sent"
                        : "Download"}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
